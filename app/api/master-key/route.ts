import { NextRequest, NextResponse } from "next/server"

function isAdmin(req: NextRequest) {
  return (
    req.headers.get("x-admin-id") === process.env.ADMIN_ID &&
    req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
  )
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.json({ key: process.env.MASTER_API_KEY })
}
