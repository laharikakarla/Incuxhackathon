SELECT
    current_database() AS query_database,
    session_user AS query_runner_session_user,
    current_user AS query_runner_current_user,
    current_setting('server_version') AS postgres_version,
    r.rolname AS proposed_operator,
    r.rolsuper,
    r.rolcreaterole,
    r.rolcreatedb,
    pg_get_userbyid(d.datdba) AS database_owner,
    has_database_privilege('postgres', d.datname, 'CREATE')
        AS operator_database_create,
    has_schema_privilege('postgres', 'public', 'CREATE')
        AS operator_public_create,
    has_schema_privilege('postgres', 'public', 'CREATE WITH GRANT OPTION')
        AS operator_public_create_with_grant_option,
    to_regnamespace('private') IS NOT NULL AS private_schema_exists,
    CASE
        WHEN to_regnamespace('private') IS NULL
        THEN has_database_privilege('postgres', d.datname, 'CREATE')
        ELSE has_schema_privilege('postgres', 'private', 'CREATE WITH GRANT OPTION')
    END AS operator_can_prepare_private_schema
FROM pg_catalog.pg_roles AS r
JOIN pg_catalog.pg_database AS d ON d.datname = current_database()
WHERE r.rolname = 'postgres';
