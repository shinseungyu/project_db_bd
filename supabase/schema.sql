-- 1. 클라이언트 사이트 등록 테이블
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text unique not null default gen_random_uuid()::text,
  owner_email text,
  created_at timestamptz default now()
);

-- 2. 수신 데이터 테이블
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  name text,
  birthday text,
  cellphone text,
  sex text,
  ipaddress text,
  useragent text,
  location text,
  raw_data jsonb,
  created_at timestamptz default now(),
  sent_at timestamptz default null  -- null이면 클라이언트에게 미전송 상태
);

-- 인덱스
create index if not exists submissions_site_id_idx on submissions(site_id);
create index if not exists submissions_created_at_idx on submissions(created_at desc);

-- RLS 비활성화 (서버사이드 service_role key로만 접근)
alter table sites disable row level security;
alter table submissions disable row level security;
