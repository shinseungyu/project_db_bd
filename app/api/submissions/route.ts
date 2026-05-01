import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get("api_key")
  const adminMode = isAdmin(req)

  if (!apiKey && !adminMode) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  if (adminMode) {
    const { data } = await supabaseAdmin
      .from("submissions")
      .select("*, sites(name)")
      .order("created_at", { ascending: false })
      .limit(500)
    return NextResponse.json(data ?? [])
  }

  // 클라이언트: api_key로 자기 사이트 + 전송된 데이터만
  const { data: site } = await supabaseAdmin
    .from("sites")
    .select("id, name")
    .eq("api_key", apiKey!)
    .single()

  if (!site) return NextResponse.json({ error: "invalid api_key" }, { status: 401 })

  const { data } = await supabaseAdmin
    .from("submissions")
    .select("id, name, birthday, cellphone, sex, location, sent_at, created_at")
    .eq("site_id", site.id)
    .not("sent_at", "is", null)   // 전송된 것만
    .order("sent_at", { ascending: false })
    .limit(500)

  return NextResponse.json({ site, submissions: data ?? [] })
}

// 관리자가 전송 처리 (sent_at 설정)
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await req.json()
  const { error } = await supabaseAdmin
    .from("submissions")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await req.json()
  await supabaseAdmin.from("submissions").delete().eq("id", id)
  return NextResponse.json({ ok: true })
}
