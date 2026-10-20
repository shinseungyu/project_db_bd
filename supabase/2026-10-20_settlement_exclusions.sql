-- 정산 제외 표시 — 판매처(또는 관리자)가 "이미 가진 중복 DB"라고 표시한 접수를 정산에서 뺀다.
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행한다. 여러 번 실행해도 안전하다. 기존 테이블·데이터는 건드리지 않는다.

create table if not exists settlement_exclusions (
  submission_id uuid primary key references submissions(id) on delete cascade,
  grp text not null check (grp in ('ipsi', 'dangwa', 'local')),
  reason text not null default '',
  marked_by text not null check (marked_by in ('buyer', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists settlement_exclusions_grp_idx on settlement_exclusions(grp);

-- 서버(service_role)로만 접근한다 — submissions·sites 와 같다
alter table settlement_exclusions disable row level security;
