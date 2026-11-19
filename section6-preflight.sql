WITH api_roles(rolname) AS (
    VALUES
        ('authenticator'::name),
        ('anon'::name),
        ('authenticated'::name),
        ('service_role'::name)
)
SELECT
    api.rolname AS api_role,
    api.rolsuper,
    api.rolcreaterole,
    owner_role.oid IS NOT NULL AS owner_role_exists,
    CASE WHEN owner_role.oid IS NULL THEN NULL
         ELSE pg_has_role(api.oid, owner_role.oid, 'MEMBER')
    END AS is_owner_role_member,
    CASE WHEN owner_role.oid IS NULL THEN NULL
         ELSE pg_has_role(api.oid, owner_role.oid, 'USAGE')
    END AS inherits_owner_privileges,
    CASE WHEN owner_role.oid IS NULL THEN NULL
         ELSE pg_has_role(api.oid, owner_role.oid, 'SET')
    END AS can_set_owner_role,
    CASE WHEN owner_role.oid IS NULL THEN NULL
         ELSE pg_has_role(api.oid, owner_role.oid, 'SET WITH ADMIN OPTION')
    END AS can_administer_owner_membership
FROM api_roles
JOIN pg_catalog.pg_roles AS api
    ON api.rolname = api_roles.rolname
LEFT JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.rolname = 'incux_rpc_owner'
ORDER BY api.rolname;
