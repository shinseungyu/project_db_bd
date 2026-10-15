import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { parseVertical } from "@/lib/verticals"

function isAdmin(req: NextRequest) {
  return (
    req.headers.get("x-admin-id") === process.env.ADMIN_ID &&
    req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
  )
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data } = await supabaseAdmin.from("sites").select("*").order("created_at", { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  const insertRow: Record<string, string> = { name: body.name, owner_email: body.owner_email ?? "" }
  if (body.api_key) insertRow.api_key = body.api_key
  // 뷰티는 컬럼 기본값. 인터넷만 명시 — vertical 컬럼 마이그레이션 전이면 여기서 에러가 난다
  const vertical = parseVertical(body.vertical)
  if (vertical && vertical !== "beauty") insertRow.vertical = vertical
  const { data, error } = await supabaseAdmin
    .from("sites")
    .insert(insertRow)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await req.json()
  await supabaseAdmin.from("sites").delete().eq("id", id)
  return NextResponse.json({ ok: true })
}
