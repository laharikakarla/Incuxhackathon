SELECT 'role: incux_rpc_owner' AS object_name,
       EXISTS (
           SELECT 1 FROM pg_catalog.pg_roles
           WHERE rolname = 'incux_rpc_owner'
       ) AS already_exists
UNION ALL
SELECT 'table: public.phase_2_6_validation_table',
       to_regclass('public.phase_2_6_validation_table') IS NOT NULL
UNION ALL
SELECT 'view: public.phase_2_6_validation_view',
       to_regclass('public.phase_2_6_validation_view') IS NOT NULL
UNION ALL
SELECT 'function: public.phase_2_6_validation_rpc()',
       to_regprocedure('public.phase_2_6_validation_rpc()') IS NOT NULL
UNION ALL
SELECT 'view: private.phase_2_6_validation_view',
       to_regclass('private.phase_2_6_validation_view') IS NOT NULL
UNION ALL
SELECT 'function: private.phase_2_6_validation_rpc()',
       to_regprocedure('private.phase_2_6_validation_rpc()') IS NOT NULL;
