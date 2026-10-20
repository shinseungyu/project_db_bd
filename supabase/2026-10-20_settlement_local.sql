-- 지방 정산(local) 추가 — settlement_exclusions.grp 에 'local' 을 허용한다. 여러 번 실행해도 안전하다.
alter table settlement_exclusions drop constraint if exists settlement_exclusions_grp_check;
alter table settlement_exclusions add constraint settlement_exclusions_grp_check check (grp in ('ipsi', 'dangwa', 'local'));
