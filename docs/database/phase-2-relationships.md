# Phase 2 relationship map

This map describes the logical ownership and enforced relationships in [the NOT EXECUTED schema draft](phase-2-schema-draft.sql). Auth identities reference `auth.users`; this draft does not create Auth users.

## Identity and participation

```text
auth.users 1 ── 0..1 profiles
auth.users 1 ── 0..1 participant_registrations
auth.users 1 ── 0..N user_role_grants / admin_permission_grants
auth.users 1 ── 0..N profile_links / participant_skills / participant_interests
skills 1 ── 0..N participant_skills
interest_areas 1 ── 0..N participant_interests
```

Role and permission rows are append/revoke history, not editable profile attributes. A partial unique index permits one active Super Admin. Registration has one row per user; only draft fields are directly writable, and approval is an audited RPC transition.

## Teams

```text
team_size_policy_versions 1 ── 0..N teams (required creation-time policy version)
teams 1 ── 0..N team_memberships (history; active roster is a subset)
auth.users 1 ── 0..N team_memberships (history)
teams 1 ── 0..N team_invitations / team_join_requests
teams N ── N skills through team_skill_requirements
```

Each team stores its applicable size-policy version; versions are immutable. The leader is a membership row and counts toward min/max size. Partial unique indexes enforce one active team per participant and at most one active leader per team; a deferred constraint trigger checks exactly one active leader and valid active roster size at transaction end. Trusted team operations lock the team row, validate status, payment lock, policy, and participant role, then mutate roster in one transaction. Pending invites/requests confer no membership. Invites target registered Auth users by ID.

During the unpaid forming state, authorized roster changes are permitted. Starting payment locks the roster. Definitive failure, cancellation, or expiry releases the lock through a trusted operation; successful payment keeps it locked. A post-payment exception requires Super Admin authority, a reason, and an audit record. Paid financial history remains intact if an exception changes the roster.

## Payment and refunds

```text
team_fee_config_versions 1 ── 0..N team_payment_orders (fee snapshot)
teams 1 ── 0..N team_payment_orders (at most one pending-or-paid order)
team_payment_orders 1 ── 0..N payment_transactions
team_payment_orders 1 ── 0..N payment_webhook_events / payment_webhook_attempts
payment_transactions 1 ── 0..N payment_refunds
payment_webhook_events 1 ── 0..N payment_webhook_attempts
team_payment_orders 1 ── 0..N payment_refunds / payment_receipts
```

Composite foreign keys bind order amount/currency to the exact fee version, each transaction to its order and snapshot, each refund to a transaction on the same order, and a receipt to the exact applied successful transaction. A successful order points to a verified succeeded transaction marked applied to that order. Webhook event digest/status and attempt rows preserve provider event history. A failed transaction identity may advance once to succeeded through the verified webhook RPC; identity and amount facts remain immutable, and the history records both provider reports. Captures for terminal orders remain unapplied and require reconciliation/refund. Gateway event/transaction/refund identifiers are unique for idempotency. Refund requests serialize on the order and reserve pending/processing/succeeded amounts against the captured transaction balance. Paid order snapshots remain immutable; refund lifecycle is monotonic and audited.

Fee versions are immutable and each change records actor, old/new amount, reason, and time. Existing orders keep their snapshot; new orders use the current version. Default expiry is 24 hours. No gateway is integrated in this phase.

## Submission and evaluation

```text
teams 1 ── 0..1 team_submissions
team_submissions 1 ── 1..N submission_versions
submission_versions N ── N technologies through submission_version_technologies
team_submissions 1 ── 0..N judge_assignments
judge_profiles 1 ── 0..N judge_assignments
judge_assignments 1 ── 0..N judge_conflicts / 0..1 evaluations
evaluation_rubrics 1 ── 1..N evaluation_criteria
evaluations 1 ── 1..N evaluation_scores / 0..1 evaluation_feedback
```

An assignment fixes both judge and rubric. Composite foreign keys ensure the evaluation belongs to that assigned judge and rubric, and score criteria belong to the same rubric. A partial unique index prevents duplicate active judge/submission assignments. Score checks and a trigger enforce `0 <= score <= criterion maximum`. Conflicted judges lose access immediately. Submitted evaluations are locked; only authorized score-release permission can publish results. One submission parent per team and version history preserve official project changes.

## Recruiter, community, and audit

```text
recruiter_profiles 1 ── 0..N recruiter_access_grants
auth.users N ── N candidate profiles through candidate_shortlists
recruiter_profiles 1 ── 0..N recruiter_notes / candidate_shortlists
participant profiles 1 ── 0..N recruiter_consent_events
recruiter_consent_requirements 1 ── current required consent text version per scope
community_posts 1 ── 0..N community_comments / community_reports / community_reactions
team_discussions 1 ── 1..N team_discussion_messages
```

There are no shared recruiter workspaces. Candidate access requires an active recruiter role, grant, and latest participant consent matching the current required text version for the requested scope. Per-scope consent writes are serialized; revocation or a text-version change immediately blocks future reads. Notes and shortlists are recruiter-owned and only visible while access and consent remain valid. Recruiters cannot read financial, team-private, or judge data. Community parent-comment relationships are checked against the same post and cycles are rejected. Moderation actions reference the actual report/content target; restore only transitions hidden content to published. Team discussions are readable only by current members; moderator access is absent.

## Certificates and event operations

```text
announcement 1 ── 0..N announcement_targets
auth.users 1 ── 0..N notifications / notification_preferences
certificate_types 1 ── 0..N certificates
auth.users 0..1 ─┐
                 ├─ certificate recipient (exactly one participant or team)
teams 0..1 ──────┘
certificates 1 ── 0..N certificate_verifications
event_deadline_versions: immutable version history for event deadlines
```

Certificate verification codes are generated server-side and never exposed in recipient views. The public verifier returns only validity, type, and a consented display name; rate limiting and verification logging are applied. Revocation preserves the issued record. Notifications do not grant access to their linked resources.

## Deletion and retention

Auth deletion is not a cascade-based cleanup strategy. Financial, consent, moderation, evaluation, and audit history need an approved retention/de-identification process; the product owner must decide legal retention and deletion rules before implementation.
