import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verticalOf } from "@/lib/verticals"
import {
  GROUP_KEY_ENV, GROUP_LOGIN_ENV, IPSI_SITES, SETTLEMENT_START_WEEK, buyerEditableWeeks, isGroupId, isMetro, normPhone, testSuspect, weekKey,
  type GroupId, type SettlementLead,
} from "@/lib/settlement"

function isAdmin(req: NextRequest) {
  return (
    req.headers.get("x-admin-id") === process.env.ADMIN_ID &&
    req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
  )
}

/** 관리자 또는 그 판매처(키 링크 · 전용 아이디·비번). 판매처 자격으로는 자기 그룹만 열린다 */
function who(req: NextRequest, group: GroupId): "admin" | "buyer" | null {
  if (isAdmin(req)) return "admin"
  const groupKey = process.env[GROUP_KEY_ENV[group]]
  if (groupKey && req.headers.get("x-settlement-key") === groupKey) return "buyer"
  const id = process.env[GROUP_LOGIN_ENV[group].id]
  const pw = process.env[GROUP_LOGIN_ENV[group].pw]
  if (id && pw && req.headers.get("x-settlement-id") === id && req.headers.get("x-settlement-pw") === pw) return "buyer"
  return null
}

type Row = {
  id: string
  name: string | null
  birthday: string | null
  cellphone: string | null
  sex: string | null
  region: string | null
  category: string | null
  created_at: string
  sites: { name: string | null; vertical?: string | null } | null
}

const SELECT = "id, name, birthday, cellphone, sex, region, category, created_at, sites(*)"

const kindOf = (r: Row): "입시" | "단과" => (r.category === "미용입시" || IPSI_SITES.includes(r.sites?.name ?? "") ? "입시" : "단과")

/** 정산 대상이면 그 그룹, 아니면 null (인터넷·이름 "테스트"·지역 미입력) */
function groupOf(r: Row): GroupId | null {
  if (verticalOf(r.sites) === "internet") return null
  if ((r.name ?? "").trim() === "테스트") return null
  if (!(r.region ?? "").trim()) return null
  if (!isMetro(r.region)) return "local" // 지방은 입시·단과를 한 그룹으로
  return kindOf(r) === "입시" ? "ipsi" : "dangwa"
}

/**
 * 주간 정산 데이터 — ?group=ipsi|dangwa|local 한 판매처의 접수만, 중복·제외 표시를 붙여 돌려준다.
 * 두 판매처는 서로의 데이터를 보면 안 되므로 한 번에 한 그룹만 내려준다.
 * 열람: 관리자(x-admin-id/x-admin-password) 또는 그 판매처 키(x-settlement-key = 환경변수 SETTLEMENT_KEY_*).
 * 규칙은 lib/settlement.ts.
 */
export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group")
  if (!isGroupId(group)) return NextResponse.json({ error: "group required" }, { status: 400 })
  const role = who(req, group)
  if (!role) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // PostgREST 는 한 번에 1000행까지 — 전부 읽을 때까지 나눠 받는다
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select(SELECT)
      .order("created_at", { ascending: true })
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < 1000) break
  }

  // 사람이 표시한 제외 — 테이블이 아직 없으면(마이그레이션 전) 표시 기능만 꺼진다
  // action: exclude(뺌) / include(자동 중복 살림). action 칸이 없던 때의 행은 exclude
  const marks = new Map<string, { reason: string; marked_by: string; created_at: string; action?: string }>()
  const { data: ex, error: exErr } = await supabaseAdmin.from("settlement_exclusions").select("*").eq("grp", group)
  for (const e of ex ?? []) marks.set(e.submission_id, e)

  const seen = new Map<string, { at: string; site: string }>()
  const leads: SettlementLead[] = []

  for (const r of rows) {
    if (weekKey(r.created_at) < SETTLEMENT_START_WEEK) continue // 정산 시작 전 접수는 보이지도, 중복 계산에도 넣지 않는다
    if (groupOf(r) !== group) continue
    const siteName = r.sites?.name ?? ""
    const phone = normPhone(r.cellphone)

    const mark = marks.get(r.id)
    const forceInclude = !!mark && (mark.action ?? "exclude") === "include"
    const suspect = testSuspect(r.name, phone)

    let excluded: SettlementLead["excluded"] = null
    if (!/^\d{10,11}$/.test(phone)) {
      excluded = { reason: "번호 오류" }
    } else if (suspect && !forceInclude) {
      // 테스트 의심은 중복 계산(seen)에도 넣지 않는다 — 같은 가짜 번호의 첫 접수가 유효로 남지 않게
      excluded = { reason: "테스트 의심", why: suspect }
    } else {
      const first = seen.get(phone)
      if (first) excluded = { reason: "중복", firstAt: first.at, firstSite: first.site }
      else seen.set(phone, { at: r.created_at, site: siteName })
    }
    const by = mark?.marked_by === "buyer" ? "판매처" : "관리자"
    let restored: SettlementLead["restored"]
    if (forceInclude) {
      // 살리기 — 자동 중복·테스트 의심만(번호 오류는 그대로 제외)
      if (excluded?.reason === "중복") {
        restored = { by, note: mark!.reason, at: mark!.created_at, was: "중복", firstAt: excluded.firstAt, firstSite: excluded.firstSite }
        excluded = null
      } else if (!excluded && suspect) {
        restored = { by, note: mark!.reason, at: mark!.created_at, was: "테스트 의심" }
      }
    } else if (!excluded && mark) {
      excluded = { reason: by === "판매처" ? "판매처 제외" : "관리자 제외", note: mark.reason, at: mark.created_at }
    }

    leads.push({
      id: r.id,
      created_at: r.created_at,
      week: weekKey(r.created_at),
      group,
      kind: kindOf(r),
      site: siteName,
      name: r.name ?? "",
      phone,
      birthday: r.birthday ?? "",
      sex: r.sex ?? "",
      region: (r.region ?? "").trim(),
      excluded,
      ...(restored ? { restored } : {}),
    })
  }

  return NextResponse.json({
    group,
    role,
    leads: leads.reverse(),
    // 판매처가 제외 표시를 할 수 있는 주(관리자는 전체)
    editableWeeks: role === "admin" ? null : buyerEditableWeeks(),
    marksReady: !exErr,
    generatedAt: new Date().toISOString(),
  })
}

/**
 * 표시 바꾸기 — body { group, id, action: "exclude" | "include" | "clear", reason? }
 *   exclude = 정산에서 뺌 / include = 자동 중복을 정산에 다시 넣음(살리기) / clear = 표시 지움(원래 판정으로)
 *   (예전 형식 { exclude: boolean } 도 받는다)
 * 판매처는 자기 그룹 접수만, 지난주·이번 주만 바꿀 수 있다. 관리자는 제한 없음.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const group = body.group
  if (!isGroupId(group) || typeof body.id !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 })
  const role = who(req, group)
  if (!role) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // 그 접수가 정말 이 그룹 정산 대상인지 서버에서 다시 확인 — 다른 판매처 접수를 건드리지 못하게
  const { data: r } = await supabaseAdmin.from("submissions").select(SELECT).eq("id", body.id).single()
  if (!r || groupOf(r as unknown as Row) !== group) return NextResponse.json({ error: "not found" }, { status: 404 })
  if (role === "buyer" && !buyerEditableWeeks().includes(weekKey((r as unknown as Row).created_at))) {
    return NextResponse.json({ error: "지난주·이번 주 접수만 바꿀 수 있습니다. 이전 주는 관리자에게 요청해 주세요." }, { status: 403 })
  }

  const action: "exclude" | "include" | "clear" =
    body.action === "exclude" || body.action === "include" || body.action === "clear" ? body.action : body.exclude ? "exclude" : "clear"
  const row = { submission_id: body.id, grp: group, reason: String(body.reason ?? "").slice(0, 200), marked_by: role }
  let error
  if (action === "clear") {
    ;({ error } = await supabaseAdmin.from("settlement_exclusions").delete().eq("submission_id", body.id).eq("grp", group))
  } else {
    ;({ error } = await supabaseAdmin.from("settlement_exclusions").upsert({ ...row, action }))
    // action 칸이 없는 DB(2026-10-20_settlement_include.sql 실행 전) — 제외는 예전 방식으로 저장
    if (error && action === "exclude" && /action/.test(error.message)) {
      ;({ error } = await supabaseAdmin.from("settlement_exclusions").upsert(row))
    }
  }
  if (error) {
    const hint = /action/.test(error.message)
      ? " (살리기는 supabase/2026-10-20_settlement_include.sql 을 먼저 실행해야 합니다)"
      : /settlement_exclusions/.test(error.message) ? " (supabase/2026-10-20_settlement_exclusions.sql 을 먼저 실행해야 합니다)" : ""
    return NextResponse.json({ error: error.message + hint }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
