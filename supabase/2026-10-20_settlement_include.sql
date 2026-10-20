-- 정산 표시에 "살리기"(자동 중복을 다시 정산에 포함) 추가 — settlement_exclusions 에 action 칸
--   exclude = 정산에서 뺌(판매처·관리자 제외) / include = 자동 중복이지만 정산에 포함(살림)
-- 2026-10-20_settlement_exclusions.sql 다음에 한 번 실행한다. 여러 번 실행해도 안전하다.

alter table settlement_exclusions add column if not exists action text not null default 'exclude';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settlement_exclusions_action_check') then
    alter table settlement_exclusions add constraint settlement_exclusions_action_check check (action in ('exclude', 'include'));
  end if;
end $$;
