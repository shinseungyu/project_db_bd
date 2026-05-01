import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co"
const anon = process.env.SUPABASE_ANON_KEY ?? "placeholder"
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder"

export const supabase = createClient(url, anon)
export const supabaseAdmin = createClient(url, service)
