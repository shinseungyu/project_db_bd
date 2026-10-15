import { supabaseAdmin } from "@/lib/supabase"
import { verticalOf, type Vertical } from "@/lib/verticals"

/** 존재하지 않는 uuid — `.in("site_id", [])` 는 PostgREST 에서 문법 오류라 빈 목록 대신 쓴다 */
const NO_SITE = "00000000-0000-0000-0000-000000000000"

/**
 * 해당 업종 사이트 id 목록. select("*") 로 읽어서 vertical 컬럼이 아직 없는 DB 에서도 깨지지 않는다(전부 beauty).
 */
export async function siteIdsOf(vertical: Vertical): Promise<string[]> {
  const { data } = await supabaseAdmin.from("sites").select("*")
  const ids = (data ?? []).filter((s) => verticalOf(s) === vertical).map((s) => s.id as string)
  return ids.length ? ids : [NO_SITE]
}
