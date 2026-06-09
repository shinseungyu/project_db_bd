import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  const apiKey = req.nextUrl.searchParams.get("api_key")
  if (!apiKey) return NextResponse.json({ error: "api_key required" }, { status: 401, headers: corsHeaders })

  const { data: site } = await supabaseAdmin
    .from("sites")
    .select("id")
    .eq("api_key", apiKey)
    .single()
  if (!site) return NextResponse.json({ error: "invalid api_key" }, { status: 401, headers: corsHeaders })
  const siteId: string = site.id

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
    ?? (body.mobile1 && body.mobile2
      ? body.mobile1 + body.mobile2 + (body.mobile3 ?? "")
      : body.mobile1 ?? "")

  const submission = {
    site_id: siteId,
    name: body.customer_name ?? body.name ?? "",
    birthday,
    cellphone,
    sex: body.customer_sex === "1" ? "M" : body.customer_sex === "2" ? "F" : (body.sex ?? ""),
    ipaddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "",
    useragent: req.headers.get("user-agent") ?? "",
    location: body.location ?? req.headers.get("referer") ?? "",
    region: body.region ?? "",
    has_license: body.has_license ?? "",
    category: body.category ?? "",
    purpose: body.purpose ?? "",
    raw_data: body,
  }

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .insert(submission)
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })

  // Discord 알림
  const webhookUrl = "https://discord.com/api/webhooks/1513916271052198124/4srLa7so23W6ZUnY14hqOBg7EQhZhdkn0OcVUHsCTg6P5OKlIDHshAt8p970uZOULJQ4"
  if (webhookUrl) {
    const { data: siteInfo } = await supabaseAdmin.from("sites").select("name").eq("id", siteId).single()
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "📥 새 신청 접수",
          color: 0x5865F2,
          fields: [
            { name: "사이트", value: siteInfo?.name ?? "-", inline: true },
            { name: "이름", value: submission.name || "-", inline: true },
            { name: "전화번호", value: submission.cellphone || "-", inline: true },
            { name: "지역", value: submission.region || "-", inline: true },
            { name: "카테고리", value: submission.category || "-", inline: true },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, id: data.id }, { headers: corsHeaders })
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
