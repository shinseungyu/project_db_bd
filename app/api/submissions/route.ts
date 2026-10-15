import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { siteIdsOf } from "@/lib/sites"
import { parseVertical, verticalLabel, verticalOf } from "@/lib/verticals"

function isAdmin(req: NextRequest) {
  return (
    req.headers.get("x-admin-id") === process.env.ADMIN_ID &&
    req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
  )
}

export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get("api_key")
  const adminMode = isAdmin(req)
  // ?vertical=beauty|internet — 관리자·마스터 조회를 업종별로 나눈다(각각 최근 500건)
  const vertical = parseVertical(req.nextUrl.searchParams.get("vertical"))

  if (!apiKey && !adminMode) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  if (adminMode) {
    const testOnly = req.nextUrl.searchParams.get("test") === "1"
    let query = supabaseAdmin
      .from("submissions")
      .select("*, sites(name)")
      .order("created_at", { ascending: false })
      .limit(500)
    if (testOnly) query = query.eq("name", "테스트")
    if (vertical) query = query.in("site_id", await siteIdsOf(vertical))
    const { data } = await query
    return NextResponse.json(data ?? [])
  }

  // 마스터 키: 전체 데이터 조회 (전송 여부 무관)
  if (apiKey === process.env.MASTER_API_KEY) {
    let query = supabaseAdmin
      .from("submissions")
      .select("id, name, birthday, cellphone, sex, location, region, has_license, category, purpose, sent_at, created_at, sites(name)")
      .order("created_at", { ascending: false })
      .limit(500)
    if (vertical) query = query.in("site_id", await siteIdsOf(vertical))
    const { data } = await query
    const name = vertical ? `전체 · ${verticalLabel(vertical)}` : "전체"
    return NextResponse.json({ site: { name, vertical: vertical ?? "beauty" }, submissions: data ?? [] })
  }

  // 클라이언트: api_key로 자기 사이트 + 전송된 데이터만
  // select("*") — vertical 컬럼이 없는 DB(마이그레이션 전)에서도 깨지지 않게
  const { data: site } = await supabaseAdmin
    .from("sites")
    .select("*")
    .eq("api_key", apiKey!)
    .single()

  if (!site) return NextResponse.json({ error: "invalid api_key" }, { status: 401 })

  const { data } = await supabaseAdmin
    .from("submissions")
    .select("id, name, birthday, cellphone, sex, location, region, has_license, category, purpose, sent_at, created_at")
    .eq("site_id", site.id)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(500)

  return NextResponse.json({ site: { id: site.id, name: site.name, vertical: verticalOf(site) }, submissions: data ?? [] })
}

// 관리자가 전송 처리 (sent_at 설정)
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()

  // 전체 전송
  if (body.all) {
    let query = supabaseAdmin
      .from("submissions")
      .update({ sent_at: new Date().toISOString() })
      .is("sent_at", null)
    if (body.site_id) query = query.eq("site_id", body.site_id)
    // 관리자 화면의 업종 탭에서 누른 "전체 전송"은 그 업종만
    const vertical = parseVertical(body.vertical)
    if (vertical) query = query.in("site_id", await siteIdsOf(vertical))
    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, all: true })
  }

  // 개별 전송
  const { error } = await supabaseAdmin
    .from("submissions")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { id } = body

  // 관리자 또는 마스터키
  if (isAdmin(req) || body.api_key === process.env.MASTER_API_KEY) {
    await supabaseAdmin.from("submissions").delete().eq("id", id)
    return NextResponse.json({ ok: true })
  }

  // 클라이언트: api_key로 자기 사이트 데이터만 삭제 허용
  const apiKey = body.api_key
  if (apiKey) {
    const { data: site } = await supabaseAdmin.from("sites").select("id").eq("api_key", apiKey).single()
    if (!site) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    await supabaseAdmin.from("submissions").delete().eq("id", id).eq("site_id", site.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}
