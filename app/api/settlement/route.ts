import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verticalOf } from "@/lib/verticals"
import {
  GROUP_KEY_ENV, IPSI_SITES, buyerEditableWeeks, isGroupId, isMetro, normPhone, weekKey,
  type GroupId, type SettlementLead,
} from "@/lib/settlement"

function isAdmin(req: NextRequest) {
  return (
    req.headers.get("x-admin-id") === process.env.ADMIN_ID &&
    req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
  )
}

/** 관리자 또는 그 판매처 키. 판매처 키로는 자기 그룹만 열린다 */
function who(req: NextRequest, group: GroupId): "admin" | "buyer" | null {
  if (isAdmin(req)) return "admin"
  const groupKey = process.env[GROUP_KEY_ENV[group]]
  return groupKey && req.headers.get("x-settlement-key") === groupKey ? "buyer" : null
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

/** 정산 대상이면 그 그룹, 아니면 null (인터넷·테스트·비수도권) */
function groupOf(r: Row): GroupId | null {
  if (verticalOf(r.sites) === "internet") return null
  if ((r.name ?? "").trim() === "테스트") return null
  if (!isMetro(r.region)) return null
  return r.category === "미용입시" || IPSI_SITES.includes(r.sites?.name ?? "") ? "ipsi" : "dangwa"
}

/**
 * 주간 정산 데이터 — ?group=ipsi|dangwa 한 판매처의 수도권 접수만, 중복·제외 표시를 붙여 돌려준다.
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
  const marks = new Map<string, { reason: string; marked_by: string; created_at: string }>()
  const { data: ex, error: exErr } = await supabaseAdmin.from("settlement_exclusions").select("*").eq("grp", group)
  for (const e of ex ?? []) marks.set(e.submission_id, e)

  const seen = new Map<string, { at: string; site: string }>()
  const leads: SettlementLead[] = []

  for (const r of rows) {
    if (groupOf(r) !== group) continue
    const siteName = r.sites?.name ?? ""
    const phone = normPhone(r.cellphone)

    let excluded: SettlementLead["excluded"] = null
    if (!/^\d{10,11}$/.test(phone)) {
      excluded = { reason: "번호 오류" }
    } else {
      const first = seen.get(phone)
      if (first) excluded = { reason: "중복", firstAt: first.at, firstSite: first.site }
      else seen.set(phone, { at: r.created_at, site: siteName })
    }
    const mark = marks.get(r.id)
    if (!excluded && mark) {
      excluded = { reason: mark.marked_by === "buyer" ? "판매처 제외" : "관리자 제외", note: mark.reason, at: mark.created_at }
    }

    leads.push({
      id: r.id,
      created_at: r.created_at,
      week: weekKey(r.created_at),
      group,
      site: siteName,
      name: r.name ?? "",
      phone,
      birthday: r.birthday ?? "",
      sex: r.sex ?? "",
      region: (r.region ?? "").trim(),
      excluded,
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
 * 제외 표시 / 되돌리기 — body { group, id, exclude: boolean, reason? }
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

  const { error } = body.exclude
    ? await supabaseAdmin.from("settlement_exclusions").upsert({
        submission_id: body.id,
        grp: group,
        reason: String(body.reason ?? "").slice(0, 200),
        marked_by: role,
      })
    : await supabaseAdmin.from("settlement_exclusions").delete().eq("submission_id", body.id).eq("grp", group)
  if (error) {
    const hint = /settlement_exclusions/.test(error.message) ? " (supabase/2026-10-20_settlement_exclusions.sql 을 먼저 실행해야 합니다)" : ""
    return NextResponse.json({ error: error.message + hint }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
