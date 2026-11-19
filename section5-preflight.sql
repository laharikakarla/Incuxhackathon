WITH RECURSIVE role_paths (
    member_oid,
    granted_role_oid,
    grantor_oid,
    depth,
    oid_path,
    admin_option,
    inherit_option,
    set_option,
    all_inherit_options,
    all_set_options
) AS (
    SELECT
        m.member,
        m.roleid,
        m.grantor,
        1,
        ARRAY[m.member, m.roleid]::oid[],
        m.admin_option,
        m.inherit_option,
        m.set_option,
        m.inherit_option,
        m.set_option
    FROM pg_catalog.pg_auth_members AS m
    JOIN pg_catalog.pg_roles AS login_role
        ON login_role.oid = m.member
    WHERE login_role.rolname = 'postgres'

    UNION ALL

    SELECT
        m.member,
        m.roleid,
        m.grantor,
        p.depth + 1,
        p.oid_path || m.roleid,
        m.admin_option,
        m.inherit_option,
        m.set_option,
        p.all_inherit_options AND m.inherit_option,
        p.all_set_options AND m.set_option
    FROM role_paths AS p
    JOIN pg_catalog.pg_auth_members AS m
        ON m.member = p.granted_role_oid
    WHERE NOT m.roleid = ANY (p.oid_path)
)
SELECT
    p.depth,
    member_role.rolname AS member_role,
    member_role.rolinherit AS member_role_inherit_attribute,
    granted_role.rolname AS granted_role,
    grantor_role.rolname AS grantor_role,
    p.admin_option,
    p.inherit_option,
    p.set_option,
    p.all_inherit_options,
    p.all_set_options,
    pg_has_role('postgres', p.granted_role_oid, 'MEMBER')
        AS is_direct_or_indirect_member,
    pg_has_role('postgres', p.granted_role_oid, 'USAGE')
        AS effective_inherited_privileges,
    pg_has_role('postgres', p.granted_role_oid, 'SET')
        AS can_set_role,
    granted_role.rolsuper,
    granted_role.rolcreaterole,
    granted_role.rolcreatedb,
    granted_role.rolreplication,
    granted_role.rolbypassrls
FROM role_paths AS p
JOIN pg_catalog.pg_roles AS member_role
    ON member_role.oid = p.member_oid
JOIN pg_catalog.pg_roles AS granted_role
    ON granted_role.oid = p.granted_role_oid
JOIN pg_catalog.pg_roles AS grantor_role
    ON grantor_role.oid = p.grantor_oid
ORDER BY p.depth, member_role.rolname, granted_role.rolname, grantor_role.rolname;
