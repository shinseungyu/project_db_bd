-- 사이트 업종 구분 — 뷰티 / 인터넷
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행한다. 여러 번 실행해도 안전하다.
-- 기존 사이트는 전부 'beauty' 로 채워진다. 인터넷 사이트는 관리자 화면에서 업종을 '인터넷'으로 골라 등록한다.

alter table sites add column if not exists vertical text not null default 'beauty';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sites_vertical_check') then
    alter table sites add constraint sites_vertical_check check (vertical in ('beauty', 'internet'));
  end if;
end $$;

create index if not exists sites_vertical_idx on sites(vertical);
