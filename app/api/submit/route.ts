import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get("api_key")
  if (!apiKey) return NextResponse.json({ error: "api_key required" }, { status: 401 })

  const { data: site } = await supabaseAdmin
    .from("sites")
    .select("id")
    .eq("api_key", apiKey)
    .single()

  if (!site) return NextResponse.json({ error: "invalid api_key" }, { status: 401 })

  let body: Record<string, string> = {}
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    body = await req.json()
  } else {
    const fd = await req.formData()
    fd.forEach((v, k) => { body[k] = String(v) })
  }

  // PHP 파일과 동일한 필드 매핑
  let birthday = body.customer_birth ?? body.birthday ?? ""
  if (birthday.length === 6) {
    const y = parseInt(birthday.slice(0, 2))
    birthday = (y >= 30 ? "19" : "20") + birthday
  }

  const cellphone = body.cellphone
    ?? (body.mobile1 && body.mobile2 && body.mobile3
      ? body.mobile1 + body.mobile2 + body.mobile3
      : body.mobile1 ?? "")

  const submission = {
    site_id: site.id,
    name: body.customer_name ?? body.name ?? "",
    birthday,
    cellphone,
    sex: body.customer_sex === "1" ? "M" : body.customer_sex === "2" ? "F" : (body.sex ?? ""),
    ipaddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "",
    useragent: req.headers.get("user-agent") ?? "",
    location: body.location ?? req.headers.get("referer") ?? "",
    raw_data: body,
  }

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .insert(submission)
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}

// CORS - 외부 사이트에서 POST 가능하도록
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
