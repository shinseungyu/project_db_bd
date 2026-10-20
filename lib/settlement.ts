/**
 * 주간 정산 규칙 — /settlement 페이지와 /api/settlement 가 같이 쓴다. 단가·구분을 바꾸려면 여기만 고친다.
 *
 * - 판매처(그룹)별로 따로 정산한다. 수도권(서울·경기·인천) 접수만 대상.
 * - 주 = 월요일 00:00 ~ 일요일 23:59 (한국 시간). 매주 월요일에 지난주를 정산한다.
 * - 중복 = 같은 그룹에서 같은 전화번호가 이전에 이미 정산 대상으로 들어온 경우(주가 달라도). 처음 1건만 유효.
 * - 제외: 인터넷 업종 사이트, 이름이 "테스트"인 접수, 번호가 10~11자리가 아닌 접수.
 */

export type GroupId = "ipsi" | "dangwa"

export const GROUPS: { id: GroupId; label: string; price: number; desc: string }[] = [
  { id: "ipsi", label: "입시 · 수도권", price: 20000, desc: "뷰티입시(beautyip.kr·beautyipsi.kr) · 서울·경기·인천" },
  { id: "dangwa", label: "단과 · 수도권", price: 10000, desc: "네일·메이크업·헤어 등 단과 사이트 · 서울·경기·인천" },
]

export const isGroupId = (v: unknown): v is GroupId => v === "ipsi" || v === "dangwa"

/**
 * 판매처별 열람 키(환경변수) — 두 판매처는 서로의 데이터를 보면 안 된다.
 * /settlement/{group}?key=… 링크로 해당 판매처만 열린다. 키가 없으면 관리자 로그인으로만 볼 수 있다.
 */
export const GROUP_KEY_ENV: Record<GroupId, string> = { ipsi: "SETTLEMENT_KEY_IPSI", dangwa: "SETTLEMENT_KEY_DANGWA" }

/** 입시 사이트 — 카테고리 '미용입시' 이거나 아래 사이트명이면 입시 */
export const IPSI_SITES = ["beautyip.kr", "beautyipsi.kr"]

export const isMetro = (region?: string | null) => /^(서울|경기|인천)/.test((region ?? "").trim())

export const normPhone = (v?: string | null) => (v ?? "").replace(/\D/g, "")

/**
 * 테스트로 의심되는 접수 — 정산·중복 계산에서 뺀다(사람이 "살리기"로 넣을 수 있다). 이유를 돌려주고, 아니면 null.
 *  - 번호: 국번 뒤 8자리가 모두 같은 숫자(8888-8888) · 연속 숫자(1234-5678 / 8765-4321)
 *  - 이름: 테스트·test 와 오타(태스트·탱스트·태스틍…), 한글 자판으로 친 "테스트"(xptmxm 계열)
 */
export function testSuspect(name?: string | null, phone?: string): string | null {
  const body = (phone ?? "").slice(-8)
  if (/^(\d){7}$/.test(body)) return "가짜 번호(같은 숫자 반복)"
  if (["12345678", "23456789", "87654321", "98765432", "01234567"].includes(body)) return "가짜 번호(연속 숫자)"
  const n = (name ?? "").replace(/\s/g, "").toLowerCase()
  if (/test|테스트|^[테태탱텟][스슽]/.test(n) || /^x[a-z]{0,2}ptm/.test(n)) return "테스트 이름"
  return null
}

/** 한국 시간 기준 그 주 월요일 날짜(YYYY-MM-DD) */
export function weekKey(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  const dow = (kst.getUTCDay() + 6) % 7 // 월=0 … 일=6
  kst.setUTCDate(kst.getUTCDate() - dow)
  return kst.toISOString().slice(0, 10)
}

/** "2026-10-13" → "10/13(월) ~ 10/19(일)" */
export function weekLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, d))
  const end = new Date(Date.UTC(y, m - 1, d + 6))
  const f = (t: Date) => `${t.getUTCMonth() + 1}/${t.getUTCDate()}`
  return `${f(start)}(월) ~ ${f(end)}(일)`
}

export type SettlementLead = {
  id: string
  created_at: string
  week: string
  group: GroupId
  site: string
  name: string
  phone: string
  birthday: string
  sex: string
  region: string
  /** 정산에서 빠지는 이유. null 이면 유효 */
  excluded: null | Exclusion
  /** 자동 중복이었지만 사람이 "살리기"로 정산에 다시 넣은 경우 */
  restored?: { by: "판매처" | "관리자"; note: string; at: string; was: "중복" | "테스트 의심"; firstAt?: string; firstSite?: string }
}

/**
 * 제외 사유
 *  - 중복 / 번호 오류: 자동 판정
 *  - 판매처 제외 / 관리자 제외: 사람이 표시(settlement_exclusions 테이블) — 판매처가 "이미 가진 중복"이라고 알려 온 건
 */
export type Exclusion =
  | { reason: "중복"; firstAt: string; firstSite: string }
  | { reason: "번호 오류" }
  | { reason: "테스트 의심"; why: string }
  | { reason: "판매처 제외" | "관리자 제외"; note: string; at: string }

/** 판매처가 직접 제외 표시를 할 수 있는 주 — 지난주(정산 대상)·이번 주. 관리자는 제한 없음 */
export function buyerEditableWeeks(now = new Date()): string[] {
  const thisWeek = weekKey(now.toISOString())
  const [y, m, d] = thisWeek.split("-").map(Number)
  const lastWeek = new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10)
  return [lastWeek, thisWeek]
}
