# Phase 2 database architecture and security design

**Status:** design draft for review. No database has been created or contacted. The companion SQL file is a draft only; it is not a migration and has not been executed.

## 1. Scope and design choices

The platform is for one IncuX AI hackathon. Use one Supabase project with PostgreSQL as the source of truth, Supabase Auth as the identity provider, Row Level Security (RLS) for row-by-row access, private Supabase Storage buckets for restricted files, and a small number of Edge Functions for trusted operations. Keep the application modular; do not split it into microservices at this stage.

Design for a growing audience, including 10,000 or more registered people. This is a schema and access-control design, not a claim about simultaneous-user capacity. Capacity needs measurements under representative load before it can be stated.

Key decisions:

1. `auth.users.id` is the canonical identity. Application tables reference it and never store passwords. Email remains in Auth; public profile data does not repeat it.
2. Roles are grants in database rows, not editable profile fields or trusted JWT claims. A signed-in user cannot promote themselves by changing frontend data.
3. Registration, team membership, payment, submission, evaluation, and certificate records are separate concepts. This avoids one status field accidentally implying another business decision.
4. Money is an integer number of paise (`bigint`) and a currency code. Browser-supplied amounts are never authoritative.
5. Fee versions, audit entries, gateway transactions, refunds, and submission versions preserve history. Their financial or historical facts are not edited in place.
6. Public-facing reads should use narrow views or RPCs that expose only approved fields. RLS still applies to the underlying tables; a view is not a substitute for a safe policy.
7. Exposed tables start with RLS enabled and no broad policies. A table with no matching policy is inaccessible through the client API until a reviewed policy is added.

## 2. Logical modules

| Module | Main tables | Responsibility |
|---|---|---|
| Identity and access | `profiles`, `user_role_grants`, `admin_permission_grants`, `admin_invitations`, `audit_log` | Profile details, role grants, delegated admin capabilities, and durable admin audit. Auth remains in Supabase Auth. |
| Registration | `participant_registrations`, `skills`, `participant_skills`, `profile_links` | Free event registration and participant-discoverable profile fields. |
| Teams | `team_size_policy_versions`, `teams`, `team_memberships`, `team_invitations`, `team_join_requests`, `team_skill_requirements` | Team discovery, membership history, invitations, join requests, and size rules. |
| Payments | `team_fee_config_versions`, `team_fee_config_cancellations`, `team_payment_orders`, `payment_transactions`, `payment_webhook_events`, `payment_refunds`, `payment_receipts` | One team-level INR fee, order snapshots, verified gateway events, refunds, and receipts. |
| Submissions | `team_submissions`, `submission_versions`, `technologies`, `submission_version_technologies` | Versioned work with one current official final per team. |
| Community | `community_categories`, `community_posts`, `community_comments`, `community_reactions`, `community_reports`, `moderation_actions`, `team_discussions`, `team_discussion_messages` | Public participant conversation, moderation, and private team conversations. |
| Recruiting | `recruiter_profiles`, `recruiter_access_grants`, `candidate_shortlists`, `recruiter_notes`, `recruiter_consent_events` | Explicit scoped participant consent, recruiter grant revocation, private notes and shortlists; no workspace sharing or access to payment/judging data. |
| Judging | `judge_profiles`, `evaluation_rubrics`, `evaluation_criteria`, `judge_assignments`, `judge_conflicts`, `evaluations`, `evaluation_scores`, `evaluation_feedback` | Assigned-project access, rubric snapshots, scores, conflicts, and confidential feedback. |
| Communications | `announcements`, `announcement_targets`, `notification_preferences`, `notifications`, `event_schedule` | Targeted notices, per-user delivery/read state, and schedule entries. |
| Certificates | `certificate_types`, `certificates`, `certificate_verifications` | Issuance, revocation, high-entropy identifiers, and privacy-preserving public verification. |

The complete table and relationship map is in [phase-2-relationships.md](phase-2-relationships.md). The authorization matrix is in [phase-2-rls-matrix.md](../security/phase-2-rls-matrix.md).

## 3. Identity, roles, and delegated permissions

Every participant or staff account has a Supabase Auth user. `profiles.user_id` is a one-to-one foreign key to `auth.users.id`. The profile contains display and event information, not passwords or a second login credential.

`user_role_grants` is a grant history. Revocation records when access ended; it does not erase who granted it. A partial unique index allows at most one active `super_admin` grant across the platform, while still allowing a prior super admin to be revoked and a successor to be appointed. The initial bootstrap of that one grant must be a controlled operator procedure, not a public signup path.

Admins may receive narrowly scoped `admin_permission_grants`, for example `payment.fee.configure`, `team.policy.configure`, `announcement.publish`, `schedule.manage`, `rubric.manage`, `catalog.manage`, or `certificate.issue`. The Super Admin grants and revokes these permissions through RPCs. The SQL defines `private.has_role` and `private.has_permission` as fixed-search-path `SECURITY DEFINER` helpers. They read protected grant tables as a no-login, no-RLS-bypass function owner and always derive the subject from `auth.uid()`; callers cannot ask about another user. The `private` schema must not be exposed by PostgREST. No frontend role selector, client-writable `user_metadata`, or caller-supplied role claim is an authority source.

Recruiter, judge, participant, moderator, admin, and super-admin capabilities remain separate grants. The SQL prevents a user from granting/revoking their own roles or permissions. A guarded service-only transfer handles Super Admin succession; initial bootstrap/recovery remains an operator procedure. The SQL disallows simultaneous Judge and Recruiter grants. Other role combinations remain a product decision.

`audit_log` is append-only from the application’s point of view. Only trusted database functions/triggers insert records; no client update or delete is granted. It records actor, action, target, timestamp, reason, request/correlation identifier, and small before/after snapshots that exclude secrets and unnecessary personal data. A safe audit view exposes metadata only to Super Admin or an Admin with `audit.read`; before/after JSON remains restricted. A separate safe view exposes an Admin’s own active permission names.

## 4. Registration and profiles

Initial participant registration is free. `participant_registrations` stores event registration state (`draft`, `submitted`, `approved`, `rejected`, or `withdrawn`) separately from payment orders. Payment does not determine whether a user has an account, and registration does not imply that a team has paid.

Keep profile collection minimal. Profile fields include display name, phone, college, degree, branch, academic year, city, and state. Email is read from Auth only in trusted contexts. Interests and skills use normalized catalog tables. Profile links use typed rows rather than a JSON object. Recruiter consent is not a profile boolean: `recruiter_consent_events` records scope, consent text/version, grant/revoke action, and timestamp. Each recruiter projection checks the latest event for the specific scope, so withdrawal changes future access immediately.

Recruiter visibility must be opt-in and field-limited. `recruiter_consent_requirements` stores the currently required text version per scope; a consent event authorizes access only when it is the latest serialized event and matches that current version. Changing a required version immediately makes older grants ineffective until the participant consents again. A recruiter-facing view omits phone, registration decisions, payment data, and private links unless separate, explicit permission and consent are approved.

## 5. Teams and membership rules

Creating a team and its first leader membership is one transaction. The leader is represented by an active `team_memberships` row with `membership_role = 'leader'`, rather than a second leader ID on `teams` that could disagree with the roster. A partial unique index permits at most one active leader per team and at most one active team membership per participant.

Team-size limits live in immutable `team_size_policy_versions`; each team stores its policy version at creation, and that version governs the team’s later membership changes. The team leader counts toward the configured minimum and maximum. A deferred database constraint trigger verifies at commit that each forming or locked team has an in-range active roster and exactly one active leader. A unique partial index independently prevents one participant joining multiple active teams. Changing policy affects teams created under the new version; changing a team’s version is not a client operation.

Invitations and join requests are separate records so each party’s intent and response can be audited. The initial invitation flow targets existing registered users by Auth user ID; email-only invitations are deliberately deferred. Accepting an invitation or join request locks the team row, checks request state, active memberships, policy bounds, team state, and payment state, then inserts membership and closes the request atomically. Unique constraints and the deferred roster trigger are final race-condition guards. Trusted RPCs cover creation, joining, requests, invitation responses, removal, leader transfer, dissolution, and roster lock changes.

**Roster/payment boundary:** before checkout starts, an open team can change its roster. Creating a pending order locks the roster for that attempt. A definitive failure, cancellation, or 24-hour expiry returns the team to forming; a successful payment keeps it locked. Only an explicit Super Admin exception can change a paid roster, and it records the actor, previous/new roster action, and reason without rewriting the original payment. Any refund remains a separate financial event.

## 6. Team payment lifecycle and fee configuration

### Free sign-up, paid team participation

Participant identity and registration have no fee. The participation fee is charged once per team, and the active leader is the payer. A team’s applicable fee is fetched from trusted database state when creating the order. The frontend may display a server-returned quote, but it cannot choose the amount.

`team_fee_config_versions` stores a monotonically numbered, versioned INR amount in integer paise, the prior amount, its effective timestamp, actor, reason, and creation time. The actual amount remains **TBD**; the draft contains no seed fee. Only a Super Admin or an Admin holding `payment.fee.configure` can create a version through a privileged operation. Fee versions are immutable. A future version can be cancelled only through an append-only cancellation record, latest scheduled version first. New orders use the latest uncancelled fee effective at creation. Retroactive and out-of-sequence versions are rejected.

Changing the fee affects only orders created after the new version takes effect. Every order stores a snapshot of the fee version, amount in paise, and INR currency, with a composite foreign key requiring the snapshot to equal that immutable version. Existing unpaid orders retain their amount until expiry. A trigger prevents edits to the order snapshot, and the team-level unique index prevents a paid team from creating another pending order.

### Order and gateway lifecycle

1. The team leader requests checkout. A trusted Edge Function authenticates the caller, checks active leader membership, team state, registration eligibility, roster size, prior successful payment, and absence of another pending order.
2. The database RPC locks the team, reads the effective fee, freezes roster changes, inserts a `pending` order snapshot expiring in **24 hours**, and returns the local order ID. The Edge Function uses that stable ID as the provider idempotency key to create the gateway order, then records the gateway order ID through a service-only RPC. If provider creation fails, it cancels the local order through a trusted operation and releases the roster lock.
3. The browser receives only the checkout data necessary for the payment UI. No secret key or service-role key is sent to the browser.
4. The Edge Function verifies the gateway signature, expected gateway order ID, currency, amount, and provider status before it can call the service-only database RPC. Event and transaction identifiers are unique; duplicate callbacks create an attempt-history row but not a duplicate transaction.
5. A trusted database function locks team then order, records a normalized transaction, changes a still-pending/unexpired order to paid only when the transaction is verified, succeeded, and matches order amount/currency, then writes audit history. Composite keys enforce the transaction/order/snapshot match. The chosen applied transaction is recorded on the order. Webhook event status and digest are retained. A verified `failed` transaction may advance once to `succeeded`; identity and amount facts remain fixed, the event history preserves both reports, and success applies to the order only if it is still pending/unexpired. Otherwise it is retained as an unapplied capture for reconciliation/refund.
6. A payment is treated as paid only after server-side verification. A browser success redirect is informational and cannot mark an order paid.
7. Refunds are separate financial records with gateway refund IDs, amount, actor/reason, and audited state transitions. Their order and transaction must match. The refund RPC locks the order and reserves prior requested/processing/successful refunds for that transaction before checking the remaining captured balance. Refunds never erase transactions. A receipt must reference the exact applied successful transaction for a paid order and cannot be edited after issue.

Payment orders, normalized transactions, webhook idempotency events, refund records, and receipts are service-only tables through the public API. The leader can view a narrowly scoped read-only payment summary, not mutate financial facts. Gateway payloads should be minimized; store a digest and normalized fields rather than unrestricted raw payloads unless retention/legal needs are confirmed.

Razorpay is a future integration target only. No gateway SDK, credentials, webhook, or live call is included in this phase.

## 7. Submissions and evaluation

Each team has one `team_submissions` parent row and append-only `submission_versions` containing description, repository URL, demo URL, documentation URL, and submission timestamp. A partial unique index permits only one version marked as the current final for a submission. A trusted submit/finalize function enforces the deadline using server time and checks that the caller is an active team member (or the leader if that rule is selected). Reopening/replacing a final requires an explicit privileged operation and audit entry; older version contents remain preserved.

Store GitHub repository URL and metadata only. Never put a GitHub OAuth or personal access token into a public database column. If a later integration needs tokens, use a server-side secret store and minimize scopes.

Judging is assignment-based. `judge_assignments` binds an active Judge to one team submission and one published rubric version. A partial unique index prevents duplicate active assignments. Composite keys bind evaluation judge/rubric to the assignment and each score criterion to that rubric. A database trigger enforces the maximum score; a publish operation validates total weights equal 10,000 basis points and freezes the rubric. Conflict declarations immediately remove assignment-scoped read/write access. Only an Admin with `evaluation.release` or Super Admin can release scores; other judges, recruiters, moderators, and participants cannot read confidential evaluations.

The proposed initial weights are a product suggestion only: innovation 20%, technical implementation 25%, problem solving 20%, practical impact 20%, presentation/demo 15%. The schema does not silently make them official; the first rubric version must be reviewed and published by an authorized admin.

## 8. Community, recruiters, communication, and certificates

Public community posts are readable only when published and marked public; posting and interaction require an authenticated, registered participant. Reports create a moderator queue. Moderators can hide or restore community content and record a reason, but cannot inspect payment data or alter admin roles. Private team discussions use separate tables and team membership checks; a public post must never double as a private conversation.

Recruiter access requires an active Recruiter role, an active explicit access grant, and current consent for the exact field scope. Candidate views omit email, phone, payment, registration decisions, team conversations, and evaluations. Recruiter notes and shortlists are private to the single recruiter account that created them; shared workspaces are not in the initial design. Access checks are repeated on each read, so role/grant revocation or consent withdrawal immediately removes future access. Retention duration remains a product/legal decision.

Announcements have a live audience rule and optional normalized user/team/role targets, managed only through audited draft/publish RPCs. Schedule entries use matching live role/team audiences; unsupported targeted schedules are rejected until a target model exists. Notifications are per-user delivery/read records created only by a service RPC. A notification does not grant access to the referenced resource; opening it re-checks the resource’s RLS policy.

Certificates have a unique high-entropy public verification code, type, issue/revocation timestamps, and a participant or team recipient. The public verification endpoint returns only validity, certificate type, event label, and an optional display name when the recipient has explicitly agreed. It must not return email, phone, profile URL, team roster, or internal IDs. Verification attempts should not log IP address or unnecessary browser identifiers by default.

Restricted uploads belong in private Storage buckets. Object paths must include an owner/team identifier, and Storage policies must check the same role/membership/assignment rules as the database. Use signed URLs with short expirations for authorized downloads. Certificate lookup is a service-only RPC: the public verifier must call it through an Edge Function that applies per-source and global abuse limits. The database RPC is not executable by `anon` or `authenticated`, and it has no global lock/rate counter. Public verification renders a safe certificate page; source files remain private.

## 9. Operations requiring trusted transactions/functions

The following are not safe as independent browser writes:

| Operation | Required server-side behavior |
|---|---|
| Bootstrap/grant/revoke staff role | Verify trusted operator or Super Admin, prevent self-grant, enforce one active Super Admin, write audit record in same transaction. |
| Admin permission change | Require Super Admin, ensure target has Admin role, grant only allow-listed permission codes, audit. |
| Create team | Lock effective size-policy version; insert team and leader membership atomically. |
| Accept invite/join request | Lock team, check request state, roster count and policy, active membership uniqueness, payment freeze; update request and insert membership atomically. |
| Change team roster | Apply same serialized checks; prevent any changes during pending or paid freeze except an audited override. |
| Create/cancel fee version | Check Super Admin or delegated permission, validate positive INR paise and effective time, avoid retroactive timing, write immutable version/cancellation plus audit. |
| Create payment order | Verify leader and roster, lock team, select current fee, snapshot amount/currency/version, enforce one pending/successful order, freeze roster. |
| Process gateway webhook | Verify signature and order/amount/currency, use unique gateway event and transaction IDs, lock order, apply one-way state transition and audit. |
| Refund | Check privileged permission and remaining refundable amount, call gateway server-side, append refund history, audit. |
| Finalize submission | Check deadline using trusted clock, active team membership and policy; atomically mark one current final, preserve versions. |
| Publish rubric/announcement/winners | Verify specific permission, validate criteria weight sum or audience, persist publication and audit. |
| Evaluate project | Validate assigned judge, no unresolved conflict, rubric version and score bounds; lock evaluation against duplicate submission. |
| Issue/revoke certificate | Validate approved result/participant, generate code server-side, prevent duplicates, append audit/revocation event. |

Use normal SQL transactions and constraints for atomicity. The draft defines restrictive policies and column grants, plus safe security-barrier views. All base-table privileges are revoked from `anon`, `authenticated`, and `service_role` first; only allow-listed self-service columns/catalog reads are granted back. Financial, role, evaluation, submission, moderator, consent, and certificate transitions use narrowly scoped RPCs. A non-login `incux_rpc_owner` has no `BYPASSRLS`; tables use `FORCE ROW LEVEL SECURITY` and a role-specific internal policy so definer RPCs still pass through RLS. Every definer function has a fixed `search_path`, its execute privilege is revoked from `PUBLIC`, and only named roles receive execution. PostgREST must not expose the `private` schema. A service-role key bypasses RLS and must only exist in server-side secrets, never browser code.

### Migration ownership sequence and compatibility gate

The draft defines `incux_rpc_owner` as `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`. On PostgreSQL 17, a non-superuser `CREATEROLE` creator receives an automatic bootstrap/platform-granted `ADMIN TRUE`, `SET FALSE`, `INHERIT FALSE` membership. PostgreSQL 16+ permits multiple membership records for one role/member pair when the grantor differs. The operator's explicit self-grant therefore creates a second row; a grant by the same grantor instead updates its existing row. The creator cannot alter or remove the bootstrap/platform grant. The design accepts this elevated ADMIN capability only for the named trusted migration operator and adds the separate explicit membership with `SET TRUE`, `INHERIT FALSE`, `ADMIN FALSE`. `authenticator`, `anon`, `authenticated`, and `service_role` must have no membership or ADMIN capability in the owner role. Review the operator's entire inherited and SETtable role chain before treating it as trusted. The observed disposable-project `postgres` membership in `supabase_privileged_role` is not itself proof of what privileges that group grants. The operator can delegate membership, so operator credentials and every membership change require restricted operational access and audit review. PostgreSQL 16 or later is required for per-membership privilege options; target-specific Supabase grants still require disposable validation.

Schema `CREATE` is a temporary migration privilege for `incux_rpc_owner`: grant it before changing any safe-view owner, transfer view ownership, then revoke it. Repeat the temporary grant before transferring function ownership, then revoke it before exposing callable RPCs. Runtime definer functions need the role's table/sequence grants and RLS policy, not schema `CREATE`.

For later migrations, the intended operator must be able to temporarily grant schema `CREATE` to `incux_rpc_owner`, `SET ROLE incux_rpc_owner`, replace or alter the owner-controlled objects, `RESET ROLE`, then revoke schema `CREATE`. The explicit membership path is retained with `SET TRUE`, `INHERIT FALSE`, `ADMIN FALSE`; PostgreSQL's separate automatic ADMIN path remains for the trusted role creator. Subsequent migrations use the explicit SET path and temporary schema grant, not inherited privileges. The validation must confirm the exact membership rows, API-role exclusion, schema grants, and object ownership on the target project.

PostgreSQL supports the role-membership options and ownership sequence, but this does not establish target-project behavior. Supabase does not provide ordinary customers superuser access; a separately provisioned role with constrained ADMIN is only an option if Supabase-supported provisioning is confirmed. If the actual migration identity cannot safely retain the documented ADMIN authority, prefer a separately reviewed `SECURITY INVOKER`/RLS design or move the narrowly privileged operation to a trusted server boundary. Do not substitute `service_role` or assume `postgres` is a suitable function owner. Validate the current design in the named disposable project using [phase-2.6-validation-runbook.md](../security/phase-2.6-validation-runbook.md) and its companion script.

## 10. Capacity and operations

The schema uses UUID foreign keys, targeted indexes, uniqueness constraints, and normalized relationships. Important indexes support active membership uniqueness/team roster scans, pending-or-paid team order exclusion/order expiry, provider event/transaction idempotency, recruiter candidate ownership/consent joins, judge assignment/conflict checks, notification unread lookups, and audit history by target/actor. Avoid unbounded list queries: paginate and filter on indexed columns. At 10,000+ accounts, test peak registration, team discovery, simultaneous join requests, and webhook concurrency with production-like data. Add caching only for public/read-only content after measuring. Add connection pooling and query monitoring in Supabase deployment configuration. None of these choices alone proves a concurrency level.

## 11. Open product decisions

Adopted defaults: participant registration is free; one team leader pays in INR; fee and team-size policy versions are immutable; each team records its creation-time size-policy version; leader counts toward size; paid/pending teams are roster-locked; unpaid orders expire after 24 hours; an existing order keeps its fee; an authorized Super Admin exception is required for a paid-roster change; refund is authorized and audited; recruiters require current versioned scoped consent and have account-private notes; judge scores stay confidential until authorized release. See [phase-2-security-review.md](../security/phase-2-security-review.md#unresolved-decisions) for unresolved values: actual fee, min/max team sizes, refund policy, event dates/location/timezone, registration eligibility, consent wording, judge count/rules, certificate eligibility, and retention/privacy requirements. No values have been invented for those decisions.

## 12. Phase 3 recommendation

After this design is approved, Phase 3 should proceed in small reviewable steps: (1) resolve product decisions and finalize schema; (2) create reviewed migrations in a new migration directory, never by applying this draft directly; (3) implement Auth profile synchronization and bootstrap the Super Admin through an operator-controlled process; (4) add RLS policies and adversarial policy tests before frontend data access; (5) implement team transactions and race-condition tests; (6) implement server-side fee quotes/orders and webhook idempotency in a sandbox; (7) add submissions and judge assignment/evaluation; (8) add community moderation, recruiter consent, notifications, and certificates; (9) load-test and security-review before production. Do not connect or migrate until the schema, RLS, and payment decisions are explicitly approved.
