-- PHASE 2.6 DISPOSABLE-ONLY ROLE VALIDATION — NOT A MIGRATION.
-- NOT EXECUTED. Use only in a fresh disposable Supabase project.
-- Expected ref is pinned to the named disposable project; the separately
-- entered Dashboard ref is a human check, not proof of the connected project.
-- Never put connection URLs, passwords, tokens, or keys in this file.
-- This must run as the actual migration operator. SQL Editor or read-only CLI
-- identities are not substitutes unless they are exactly that operator.
-- Any failed assertion aborts the transaction. Issue ROLLBACK (or close the
-- session) after an error; do not continue or commit an aborted transaction.

-- Pinned to the disposable project named for this validation package.
set app.phase_2_6_expected_project_ref = 'bhnhhaurdnnalcozsviq';
-- Re-read the Dashboard URL immediately before any future execution and fill
-- this value with the same ref. SQL cannot attest the connected project ref.
set app.phase_2_6_confirmed_dashboard_ref = 'REPLACE_WITH_DASHBOARD_CONFIRMED_REF';
set app.phase_2_6_expected_operator = 'REPLACE_WITH_ACTUAL_MIGRATION_OPERATOR_ROLE';

begin;

-- PREFLIGHT: no database objects are changed before this block passes.
do $$
declare
  expected_ref text := current_setting('app.phase_2_6_expected_project_ref', true);
  confirmed_ref text := current_setting('app.phase_2_6_confirmed_dashboard_ref', true);
  expected_operator text := current_setting('app.phase_2_6_expected_operator', true);
  operator_can_create_role boolean;
  operator_is_superuser boolean;
begin
  if expected_ref is distinct from 'bhnhhaurdnnalcozsviq'
     or confirmed_ref is null or confirmed_ref = 'REPLACE_WITH_DASHBOARD_CONFIRMED_REF'
     or confirmed_ref <> expected_ref
     or expected_ref !~ '^[a-z0-9]{20}$' then
    raise exception 'ABORT: target must be the pinned disposable ref and the Dashboard-confirmed ref must match it';
  end if;
  if expected_operator is null
     or expected_operator = 'REPLACE_WITH_ACTUAL_MIGRATION_OPERATOR_ROLE'
     or session_user <> expected_operator or current_user <> expected_operator then
    raise exception 'ABORT: both session_user and current_user must exactly match the confirmed actual migration operator';
  end if;
  if current_database() <> 'postgres' then
    raise exception 'ABORT: unexpected database name; reconfirm the disposable Supabase target';
  end if;
  if current_setting('server_version_num')::integer < 170000 then
    raise exception 'ABORT: this hardened script requires PostgreSQL 17+ membership options';
  end if;
  select r.rolcreaterole, r.rolsuper into operator_can_create_role, operator_is_superuser
    from pg_catalog.pg_roles r where r.rolname = current_user;
  if not coalesce(operator_can_create_role,false) then
    raise exception 'ABORT: actual migration operator lacks CREATEROLE';
  end if;
  if coalesce(operator_is_superuser,false) then
    raise exception 'ABORT: superuser identity would mask managed-role behavior';
  end if;
  if not has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') then
    raise exception 'ABORT: operator lacks CREATE with grant option on public';
  end if;
  if to_regnamespace('private') is null then
    if not has_database_privilege(current_user,current_database(),'CREATE') then
      raise exception 'ABORT: private schema is absent and operator lacks database CREATE';
    end if;
  elsif not has_schema_privilege(current_user,'private','CREATE WITH GRANT OPTION') then
    raise exception 'ABORT: operator lacks CREATE with grant option on the existing private schema';
  end if;
  if exists(select 1 from pg_catalog.pg_roles where rolname='incux_rpc_owner') then
    raise exception 'ABORT: incux_rpc_owner already exists; use a fresh disposable project';
  end if;
  if to_regclass('public.phase_2_6_validation_table') is not null
     or to_regclass('public.phase_2_6_validation_view') is not null
     or to_regprocedure('public.phase_2_6_validation_rpc()') is not null
     or to_regclass('private.phase_2_6_validation_view') is not null
     or to_regprocedure('private.phase_2_6_validation_rpc()') is not null then
    raise exception 'ABORT: a fixture object already exists; use a fresh disposable project';
  end if;
end $$;

-- Credential-free identity report. This does not disclose project credentials.
select current_database() as database_name,
       session_user as session_identity,
       current_user as effective_identity,
       current_setting('server_version') as postgres_version,
       has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') as public_create_grant_option,
       exists(select 1 from pg_catalog.pg_roles r where r.rolname=current_user and r.rolcreaterole) as has_createrole,
       coalesce((select r.rolsuper from pg_catalog.pg_roles r where r.rolname=current_user),false) as is_superuser;

-- Read-only operator role-chain diagnostic. Review every reachable parent role
-- and its grants before continuing; membership options alone do not show the
-- privileges inherited or reachable through SET ROLE.
with recursive role_chain(member_oid, granted_role_oid, grantor_oid, depth, oid_path,
                           admin_option, inherit_option, set_option) as (
  select m.member, m.roleid, m.grantor, 1, array[m.member,m.roleid]::oid[],
         m.admin_option, m.inherit_option, m.set_option
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles login_role on login_role.oid=m.member
   where login_role.rolname=current_user
  union all
  select m.member, m.roleid, m.grantor, c.depth + 1, c.oid_path || m.roleid,
         m.admin_option, m.inherit_option, m.set_option
    from role_chain c
    join pg_catalog.pg_auth_members m on m.member=c.granted_role_oid
   where not m.roleid = any(c.oid_path)
)
select c.depth,
       member_role.rolname as member_role,
       granted_role.rolname as granted_role,
       grantor_role.rolname as grantor_role,
       c.admin_option,
       c.inherit_option,
       c.set_option,
       granted_role.rolsuper,
       granted_role.rolcreaterole,
       granted_role.rolcreatedb,
       granted_role.rolreplication,
       granted_role.rolbypassrls
  from role_chain c
  join pg_catalog.pg_roles member_role on member_role.oid=c.member_oid
  join pg_catalog.pg_roles granted_role on granted_role.oid=c.granted_role_oid
  join pg_catalog.pg_roles grantor_role on grantor_role.oid=c.grantor_oid
 order by c.depth, member_role.rolname, granted_role.rolname, grantor_role.rolname;

create role incux_rpc_owner
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- PostgreSQL 17 automatically grants the non-superuser CREATEROLE creator a
-- bootstrap membership with ADMIN TRUE, SET FALSE, INHERIT FALSE. Its grantor
-- is the bootstrap/platform administrator (Supabase documents supabase_admin);
-- it cannot be changed by this creator. The explicit self-GRANT below has a
-- different grantor and therefore is a second membership record. GRANT updates
-- an existing row from the same grantor; it does not downgrade the bootstrap
-- row. Effective ADMIN TRUE is accepted only for this trusted operator.
create schema if not exists private;
grant usage on schema private to incux_rpc_owner;
grant incux_rpc_owner to current_user with set true, inherit false, admin false;

-- Fail closed unless the catalog contains the expected two operator rows:
-- PG17's bootstrap ADMIN row and the explicit non-admin SET row. No other
-- membership shape is accepted. API roles must have neither membership nor
-- ADMIN capability, so they cannot grant themselves access to the owner role.
do $$
declare
  membership_rows integer;
  auto_admin_rows integer;
  explicit_set_rows integer;
begin
  select count(*)::integer,
         count(*) filter (where m.admin_option and not m.set_option and not m.inherit_option
                           and m.grantor <> member_role.oid)::integer,
         count(*) filter (where m.grantor=member_role.oid and m.set_option
                           and not m.inherit_option and not m.admin_option)::integer
    into membership_rows, auto_admin_rows, explicit_set_rows
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles granted_role on granted_role.oid=m.roleid
    join pg_catalog.pg_roles member_role on member_role.oid=m.member
   where granted_role.rolname='incux_rpc_owner' and member_role.rolname=current_user;

  if membership_rows <> 2 or auto_admin_rows <> 1 or explicit_set_rows <> 1 then
    raise exception 'ABORT: expected two grantor-distinct rows: bootstrap ADMIN and operator-granted SET-only membership';
  end if;
  if not pg_catalog.pg_has_role(current_user,'incux_rpc_owner','SET')
     or pg_catalog.pg_has_role(current_user,'incux_rpc_owner','USAGE')
     or not pg_catalog.pg_has_role(current_user,'incux_rpc_owner','SET WITH ADMIN OPTION') then
    raise exception 'ABORT: effective membership must allow SET, deny inheritance, and report the documented creator ADMIN option';
  end if;
  if pg_catalog.pg_has_role('authenticator','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('anon','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('authenticated','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('service_role','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('authenticator','incux_rpc_owner','SET WITH ADMIN OPTION')
     or pg_catalog.pg_has_role('anon','incux_rpc_owner','SET WITH ADMIN OPTION')
     or pg_catalog.pg_has_role('authenticated','incux_rpc_owner','SET WITH ADMIN OPTION')
     or pg_catalog.pg_has_role('service_role','incux_rpc_owner','SET WITH ADMIN OPTION') then
    raise exception 'ABORT: a Supabase API role is a member of, or can administer, the RPC owner role';
  end if;
end $$;

-- Required pre-grant negative check for both tested schemas.
do $$
begin
  if has_schema_privilege('incux_rpc_owner','public','CREATE')
     or has_schema_privilege('incux_rpc_owner','private','CREATE') then
    raise exception 'ABORT: owner already has CREATE on a tested schema before the temporary grant';
  end if;
end $$;

create table public.phase_2_6_validation_table (id integer primary key, label text not null);
alter table public.phase_2_6_validation_table enable row level security;
alter table public.phase_2_6_validation_table force row level security;
create policy phase_2_6_owner_only on public.phase_2_6_validation_table
  for all to incux_rpc_owner using (true) with check (true);
grant select, insert, update, delete on public.phase_2_6_validation_table to incux_rpc_owner;

set role incux_rpc_owner;
do $$
begin
  if session_user <> current_setting('app.phase_2_6_expected_operator')
     or current_user <> 'incux_rpc_owner' then
    raise exception 'ABORT: SET ROLE identity transition did not match the expected session and owner roles';
  end if;
end $$;
insert into public.phase_2_6_validation_table(id,label) values (1,'phase-2.6 disposable fixture');
reset role;
do $$
begin
  if session_user <> current_setting('app.phase_2_6_expected_operator')
     or current_user <> session_user then
    raise exception 'ABORT: RESET ROLE did not restore the confirmed migration identity';
  end if;
end $$;

create function public.phase_2_6_validation_rpc()
returns text language sql security definer
set search_path = pg_catalog, public
as $$ select label from public.phase_2_6_validation_table where id=1 $$;
create view public.phase_2_6_validation_view with (security_barrier=true) as
  select id,label from public.phase_2_6_validation_table;
create function private.phase_2_6_validation_rpc()
returns text language sql security definer
set search_path = pg_catalog, public
as $$ select label from public.phase_2_6_validation_table where id=1 $$;
create view private.phase_2_6_validation_view with (security_barrier=true) as
  select id,label from public.phase_2_6_validation_table;

-- Required owner-transfer sequence on both public and private schemas.
grant create on schema public, private to incux_rpc_owner;
alter view public.phase_2_6_validation_view owner to incux_rpc_owner;
alter view private.phase_2_6_validation_view owner to incux_rpc_owner;
revoke create on schema public, private from incux_rpc_owner;
do $$ begin
  if has_schema_privilege('incux_rpc_owner','public','CREATE')
     or has_schema_privilege('incux_rpc_owner','private','CREATE') then
    raise exception 'ABORT: post-view-transfer CREATE revoke did not take effect in both schemas';
  end if;
end $$;

grant create on schema public, private to incux_rpc_owner;
alter function public.phase_2_6_validation_rpc() owner to incux_rpc_owner;
alter function private.phase_2_6_validation_rpc() owner to incux_rpc_owner;
revoke create on schema public, private from incux_rpc_owner;
do $$ begin
  if has_schema_privilege('incux_rpc_owner','public','CREATE')
     or has_schema_privilege('incux_rpc_owner','private','CREATE') then
    raise exception 'ABORT: post-function-transfer CREATE revoke did not take effect in both schemas';
  end if;
end $$;

-- Simulate a later migration. Every temporary CREATE grant is immediately
-- revoked and asserted before proceeding.
grant create on schema public, private to incux_rpc_owner;
set role incux_rpc_owner;
create or replace function public.phase_2_6_validation_rpc()
returns text language sql security definer
set search_path = pg_catalog, public
as $$ select label from public.phase_2_6_validation_table where id=1 $$;
create or replace view public.phase_2_6_validation_view with (security_barrier=true) as
  select id,label from public.phase_2_6_validation_table where id=1;
create or replace function private.phase_2_6_validation_rpc()
returns text language sql security definer
set search_path = pg_catalog, public
as $$ select label from public.phase_2_6_validation_table where id=1 $$;
create or replace view private.phase_2_6_validation_view with (security_barrier=true) as
  select id,label from public.phase_2_6_validation_table where id=1;
reset role;
revoke create on schema public, private from incux_rpc_owner;
do $$ begin
  if has_schema_privilege('incux_rpc_owner','public','CREATE')
     or has_schema_privilege('incux_rpc_owner','private','CREATE') then
    raise exception 'ABORT: post-subsequent-migration CREATE revoke did not take effect in both schemas';
  end if;
end $$;

-- Restrict this isolated fixture's API access; service_role receives no direct
-- base-table grant either. This does not establish the full application's RLS.
revoke all on public.phase_2_6_validation_table from public, authenticator, anon, authenticated, service_role;
revoke all on public.phase_2_6_validation_view from public, authenticator, anon, authenticated, service_role;
revoke all on function public.phase_2_6_validation_rpc() from public, authenticator, anon, authenticated, service_role;
revoke all on private.phase_2_6_validation_view from public, authenticator, anon, authenticated, service_role;
revoke all on function private.phase_2_6_validation_rpc() from public, authenticator, anon, authenticated, service_role;
grant select on public.phase_2_6_validation_view to authenticated;
grant execute on function public.phase_2_6_validation_rpc() to authenticated;

-- Final assertions run before COMMIT. Any mismatch aborts and rolls back every
-- role/object/grant mutation in this transaction.
do $$
declare
  r record;
begin
  select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
    into r from pg_catalog.pg_roles where rolname='incux_rpc_owner';
  if not found or r.rolcanlogin or r.rolsuper or r.rolcreatedb or r.rolcreaterole
     or r.rolreplication or r.rolbypassrls then
    raise exception 'ABORT: RPC owner has an unsafe role attribute';
  end if;
  if has_schema_privilege('incux_rpc_owner','public','CREATE')
     or has_schema_privilege('incux_rpc_owner','private','CREATE') then
    raise exception 'ABORT: owner retains CREATE on public or private';
  end if;
  if not pg_catalog.pg_has_role(current_user,'incux_rpc_owner','SET WITH ADMIN OPTION') then
    raise exception 'ABORT: expected PostgreSQL 17 creator ADMIN OPTION is absent from the trusted operator';
  end if;
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
        where oid='public.phase_2_6_validation_rpc()'::regprocedure) <> 'incux_rpc_owner' then
    raise exception 'ABORT: test RPC has unexpected owner';
  end if;
  if (select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class
        where oid='public.phase_2_6_validation_view'::regclass) <> 'incux_rpc_owner' then
    raise exception 'ABORT: test view has unexpected owner';
  end if;
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
        where oid='private.phase_2_6_validation_rpc()'::regprocedure) <> 'incux_rpc_owner' then
    raise exception 'ABORT: private test RPC has unexpected owner';
  end if;
  if (select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class
        where oid='private.phase_2_6_validation_view'::regclass) <> 'incux_rpc_owner' then
    raise exception 'ABORT: private test view has unexpected owner';
  end if;
  if has_any_column_privilege('authenticator','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, REFERENCES')
     or has_any_column_privilege('anon','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, REFERENCES')
     or has_any_column_privilege('authenticated','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, REFERENCES')
     or has_any_column_privilege('service_role','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, REFERENCES')
     or has_table_privilege('authenticator','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
     or has_table_privilege('anon','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
     or has_table_privilege('authenticated','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
     or has_table_privilege('service_role','public.phase_2_6_validation_table','SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') then
    raise exception 'ABORT: an API role retains direct table or column privileges on fixture table';
  end if;
  if has_table_privilege('authenticator','public.phase_2_6_validation_view','SELECT')
     or not has_table_privilege('authenticated','public.phase_2_6_validation_view','SELECT')
     or has_table_privilege('anon','public.phase_2_6_validation_view','SELECT')
     or has_table_privilege('service_role','public.phase_2_6_validation_view','SELECT')
     or has_function_privilege('authenticator','public.phase_2_6_validation_rpc()','EXECUTE')
     or not has_function_privilege('authenticated','public.phase_2_6_validation_rpc()','EXECUTE')
     or has_function_privilege('anon','public.phase_2_6_validation_rpc()','EXECUTE')
     or has_function_privilege('service_role','public.phase_2_6_validation_rpc()','EXECUTE') then
    raise exception 'ABORT: public fixture view/RPC ACLs do not match the authenticated-only expectation';
  end if;
  if has_function_privilege('authenticator','private.phase_2_6_validation_rpc()','EXECUTE')
     or has_function_privilege('anon','private.phase_2_6_validation_rpc()','EXECUTE')
     or has_function_privilege('authenticated','private.phase_2_6_validation_rpc()','EXECUTE')
     or has_function_privilege('service_role','private.phase_2_6_validation_rpc()','EXECUTE')
     or has_table_privilege('authenticator','private.phase_2_6_validation_view','SELECT')
     or has_table_privilege('anon','private.phase_2_6_validation_view','SELECT')
     or has_table_privilege('authenticated','private.phase_2_6_validation_view','SELECT')
     or has_table_privilege('service_role','private.phase_2_6_validation_view','SELECT')
     or pg_catalog.pg_has_role('authenticator','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('anon','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('authenticated','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('service_role','incux_rpc_owner','MEMBER') then
    raise exception 'ABORT: API role can execute the private RPC or is a member of the owner role';
  end if;
end $$;

commit;

-- Reaching this result means the checks above passed. The committed disposable
-- fixtures remain until manually cleaned or the disposable project is deleted.
select session_user as session_identity,
       current_user as effective_identity,
       'incux_rpc_owner' as tested_owner_role,
       (select rolcanlogin=false and rolsuper=false and rolcreatedb=false
           and rolcreaterole=false and rolreplication=false and rolbypassrls=false
          from pg_catalog.pg_roles where rolname='incux_rpc_owner') as safe_owner_attributes,
       (select pg_catalog.pg_get_userbyid(proowner)='incux_rpc_owner'
          from pg_catalog.pg_proc where oid='public.phase_2_6_validation_rpc()'::regprocedure) as public_function_owner_ok,
       (select pg_catalog.pg_get_userbyid(relowner)='incux_rpc_owner'
          from pg_catalog.pg_class where oid='public.phase_2_6_validation_view'::regclass) as public_view_owner_ok,
       (select pg_catalog.pg_get_userbyid(proowner)='incux_rpc_owner'
          from pg_catalog.pg_proc where oid='private.phase_2_6_validation_rpc()'::regprocedure) as private_function_owner_ok,
       (select pg_catalog.pg_get_userbyid(relowner)='incux_rpc_owner'
          from pg_catalog.pg_class where oid='private.phase_2_6_validation_view'::regclass) as private_view_owner_ok,
       has_schema_privilege('incux_rpc_owner','public','CREATE') as owner_public_create_after_test,
       has_schema_privilege('incux_rpc_owner','private','CREATE') as owner_private_create_after_test;
