/**
 * 업종(vertical) — 사이트마다 하나. sites.vertical 컬럼(supabase/2026-10-15_sites_vertical.sql).
 * 접수 데이터는 같은 submissions 테이블에 쌓이고, 사이트의 업종으로 나눠 본다.
 * 컬럼이 없는 DB(마이그레이션 전)나 값이 비어 있는 사이트는 beauty 로 본다 — 기존 사이트가 전부 뷰티라서.
 */
export type Vertical = "beauty" | "internet"

export const VERTICALS: { key: Vertical; label: string }[] = [
  { key: "beauty", label: "뷰티" },
  { key: "internet", label: "인터넷" },
]

export const verticalLabel = (v: Vertical) => VERTICALS.find((x) => x.key === v)!.label

export function verticalOf(site?: { vertical?: string | null } | null): Vertical {
  return site?.vertical === "internet" ? "internet" : "beauty"
}

export function parseVertical(v: unknown): Vertical | undefined {
  return v === "beauty" || v === "internet" ? v : undefined
}

export type LeadRow = {
  name: string
  birthday: string
  cellphone: string
  sex: string
  location: string
  region: string
  has_license: string
  category: string
  purpose: string
}

/** 업종별 표 컬럼 — 관리자·클라이언트 대시보드·CSV 가 같이 쓴다 */
export type Column = { label: string; get: (s: LeadRow) => string; strong?: boolean; wide?: boolean }

export const COLUMNS: Record<Vertical, Column[]> = {
  beauty: [
    { label: "이름", get: (s) => s.name, strong: true },
    { label: "생년월일", get: (s) => s.birthday },
    { label: "전화번호", get: (s) => s.cellphone },
    { label: "성별", get: (s) => s.sex },
    { label: "지역", get: (s) => s.region },
    { label: "자격증", get: (s) => s.has_license },
    { label: "카테고리", get: (s) => s.category },
    { label: "목적", get: (s) => s.purpose },
  ],
  // 인터넷 폼은 휴대폰 번호 하나만 받는다. purpose = 신청한 페이지 제목, location = 신청한 페이지 주소
  internet: [
    { label: "전화번호", get: (s) => s.cellphone, strong: true },
    { label: "신청 페이지", get: (s) => s.purpose },
    { label: "페이지 주소", get: (s) => s.location, wide: true },
  ],
}
