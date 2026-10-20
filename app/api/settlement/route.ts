import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verticalOf } from "@/lib/verticals"
import { GROUP_KEY_ENV, IPSI_SITES, isGroupId, isMetro, normPhone, weekKey, type GroupId, type SettlementLead } from "@/lib/settlement"

function isAdmin(req: NextRequest) {
  return (
    req.headers.get("x-admin-id") === process.env.ADMIN_ID &&
    req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
  )
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

/**
 * 주간 정산 데이터 — ?group=ipsi|dangwa 한 판매처의 수도권 접수만, 중복을 표시해 돌려준다. 읽기 전용.
 * 두 판매처는 서로의 데이터를 보면 안 되므로 한 번에 한 그룹만 내려준다.
 * 열람: 관리자(x-admin-id/x-admin-password) 또는 그 판매처 키(x-settlement-key = 환경변수 SETTLEMENT_KEY_*).
 * 규칙은 lib/settlement.ts.
 */
export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group")
  if (!isGroupId(group)) return NextResponse.json({ error: "group required" }, { status: 400 })
  const groupKey = process.env[GROUP_KEY_ENV[group]]
  const keyOk = !!groupKey && req.headers.get("x-settlement-key") === groupKey
  if (!isAdmin(req) && !keyOk) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // PostgREST 는 한 번에 1000행까지 — 전부 읽을 때까지 나눠 받는다
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select("id, name, birthday, cellphone, sex, region, category, created_at, sites(*)")
      .order("created_at", { ascending: true })
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < 1000) break
  }

  const seen = new Map<string, { at: string; site: string }>()
  const leads: SettlementLead[] = []

  for (const r of rows) {
    const siteName = r.sites?.name ?? ""
    if (verticalOf(r.sites) === "internet") continue
    if ((r.name ?? "").trim() === "테스트") continue
    if (!isMetro(r.region)) continue

    const leadGroup: GroupId = r.category === "미용입시" || IPSI_SITES.includes(siteName) ? "ipsi" : "dangwa"
    if (leadGroup !== group) continue
    const phone = normPhone(r.cellphone)

    let excluded: SettlementLead["excluded"] = null
    if (!/^\d{10,11}$/.test(phone)) {
      excluded = { reason: "번호 오류" }
    } else {
      const first = seen.get(phone)
      if (first) excluded = { reason: "중복", firstAt: first.at, firstSite: first.site }
      else seen.set(phone, { at: r.created_at, site: siteName })
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

  return NextResponse.json({ group, leads: leads.reverse(), generatedAt: new Date().toISOString() })
}
