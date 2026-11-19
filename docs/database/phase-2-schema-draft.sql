-- INCUX AI HACKATHON — Phase 2 schema review draft
--
-- DESIGN ARTIFACT ONLY. DO NOT EXECUTE.
-- This file is intentionally under docs/, not a migration directory. It has not
-- been run, connected to Supabase, or validated against a live database.
-- Review product/security decisions and prepare real ordered migrations later.
-- No fee amount is seeded: the initial team fee is TBD.
--
-- All application users are Supabase Auth users. This draft references
-- auth.users(id); it does not create Auth identities or store passwords.
-- RLS policies, safe projections, column exposure and RPC grants are proposed
-- in this draft. It remains a review artifact and has NOT been executed.

-- ---------- Stable domain types ----------
create type public.app_role as enum
  ('super_admin', 'admin', 'participant', 'recruiter', 'judge', 'moderator');
create type public.registration_state as enum
  ('draft', 'submitted', 'approved', 'rejected', 'withdrawn');
create type public.team_state as enum
  ('forming', 'locked', 'withdrawn', 'disqualified');
create type public.membership_role as enum ('leader', 'member');
create type public.invitation_state as enum
  ('pending', 'accepted', 'declined', 'revoked', 'expired');
create type public.join_request_state as enum
  ('pending', 'accepted', 'rejected', 'withdrawn', 'expired');
create type public.payment_order_state as enum
  ('pending', 'paid', 'failed', 'cancelled', 'expired');
create type public.payment_transaction_state as enum
  ('succeeded', 'failed');
create type public.refund_state as enum
  ('requested', 'processing', 'succeeded', 'failed', 'cancelled');
create type public.content_state as enum ('draft', 'published', 'hidden', 'archived');
create type public.post_visibility as enum ('public', 'participants');
create type public.report_state as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.evaluation_state as enum ('draft', 'submitted', 'released');
create type public.rubric_state as enum ('draft', 'published', 'retired');
create type public.judge_conflict_state as enum ('declared', 'cleared', 'recused');
create type public.announcement_audience as enum
  ('public', 'registered_participants', 'paid_teams', 'judges', 'recruiters', 'moderators', 'admins', 'targeted');
create type public.notification_channel as enum ('in_app', 'email');
create type public.certificate_kind as enum ('participation', 'winner', 'special_recognition');
create type public.submission_state as enum ('draft', 'submitted', 'finalized');

-- ---------- Identity, roles, and audit ----------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  phone text,
  college text,
  degree text,
  branch text,
  academic_year text,
  city text,
  state_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  reason text,
  check ((revoked_at is null) = (revoked_by is null))
);
create unique index user_role_grants_one_active_role
  on public.user_role_grants(user_id, role) where revoked_at is null;
create unique index user_role_grants_one_active_super_admin
  on public.user_role_grants(role) where role = 'super_admin' and revoked_at is null;

create table public.admin_permission_grants (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  permission_code text not null check (permission_code in (
    'registration.manage', 'team.policy.configure', 'payment.fee.configure',
    'payment.refund', 'announcement.publish', 'schedule.manage',
    'submission.override_deadline', 'judge.assignment.manage',
    'rubric.manage', 'evaluation.release', 'certificate.issue',
    'moderation.manage', 'audit.read', 'catalog.manage'
    , 'recruitment.consent.configure'
  )),
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  reason text,
  check ((revoked_at is null) = (revoked_by is null))
);
create unique index admin_permission_grants_one_active
  on public.admin_permission_grants(admin_user_id, permission_code) where revoked_at is null;

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  invitee_email_hash bytea not null,
  invited_role public.app_role not null default 'admin' check (invited_role = 'admin'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accepted_at timestamptz,
  reason text,
  check (octet_length(invitee_email_hash) = 32),
  check (expires_at > created_at),
  check (accepted_at is null or accepted_user_id is not null)
);
create index admin_invitations_expiry_idx on public.admin_invitations(expires_at)
  where accepted_at is null and revoked_at is null;

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete restrict,
  action_code text not null,
  target_table text not null,
  target_id text,
  reason text,
  request_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_target_idx on public.audit_log(target_table, target_id, created_at desc);
create index audit_log_actor_idx on public.audit_log(actor_user_id, created_at desc);

-- ---------- Registration and discovery ----------
create table public.participant_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  status public.registration_state not null default 'draft',
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete restrict,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('approved', 'rejected')) = (decided_at is not null)),
  check ((decided_at is null) = (decided_by is null)),
  check ((status='draft') = (submitted_at is null))
);
create index participant_registrations_status_idx
  on public.participant_registrations(status, created_at desc);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 80),
  category text,
  created_at timestamptz not null default now()
);

create table public.participant_skills (
  user_id uuid not null references auth.users(id) on delete restrict,
  skill_id uuid not null references public.skills(id) on delete restrict,
  proficiency smallint check (proficiency between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create index participant_skills_skill_idx on public.participant_skills(skill_id, user_id);

create table public.interest_areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null unique,
  active boolean not null default true
);

create table public.participant_interests (
  user_id uuid not null references auth.users(id) on delete restrict,
  interest_area_id uuid not null references public.interest_areas(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_area_id)
);
create index participant_interests_area_idx
  on public.participant_interests(interest_area_id, user_id);

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  link_kind text not null check (link_kind in ('github', 'linkedin', 'portfolio', 'other')),
  url text not null check (length(url) <= 2048),
  recruiter_visible boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, link_kind, url)
);
create index profile_links_user_idx on public.profile_links(user_id);

-- ---------- Team policy and team formation ----------
create table public.team_size_policy_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null unique check (version_number > 0),
  minimum_members smallint not null check (minimum_members >= 1),
  maximum_members smallint not null,
  effective_at timestamptz not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now(),
  check (maximum_members >= minimum_members)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  discoverable boolean not null default true,
  status public.team_state not null default 'forming',
  size_policy_version_id uuid not null references public.team_size_policy_versions(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz,
  withdrawn_at timestamptz,
  check (status <> 'locked' or locked_at is not null)
);
create index teams_discovery_idx on public.teams(status, discoverable, created_at desc)
  where status = 'forming' and discoverable;

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  membership_role public.membership_role not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  left_reason text,
  check ((left_at is null) = (left_reason is null))
);
create unique index team_memberships_one_active_team_per_user
  on public.team_memberships(user_id) where left_at is null;
create unique index team_memberships_one_active_leader_per_team
  on public.team_memberships(team_id) where left_at is null and membership_role = 'leader';
create unique index team_memberships_no_duplicate_active_member
  on public.team_memberships(team_id, user_id) where left_at is null;
create index team_memberships_team_active_idx
  on public.team_memberships(team_id, joined_at) where left_at is null;

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  invited_by uuid not null references auth.users(id) on delete restrict,
  invited_user_id uuid not null references auth.users(id) on delete restrict,
  status public.invitation_state not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  check (expires_at > created_at),
  check ((status = 'pending') = (responded_at is null))
);
create index team_invitations_team_pending_idx on public.team_invitations(team_id, expires_at)
  where status = 'pending';
create index team_invitations_invitee_pending_idx on public.team_invitations(invited_user_id, expires_at)
  where status = 'pending';
create index team_invitations_expiry_scan_idx on public.team_invitations(expires_at) where status='pending';
create unique index team_invitations_one_pending_user_team
  on public.team_invitations(team_id,invited_user_id) where status='pending';

create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  message text,
  status public.join_request_state not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '30 days'),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete restrict,
  check ((status = 'pending') = (decided_at is null)),
  check (expires_at>created_at)
);
create unique index team_join_requests_one_pending_per_user_team
  on public.team_join_requests(team_id, requester_user_id) where status = 'pending';
create index team_join_requests_team_pending_idx on public.team_join_requests(team_id, created_at)
  where status = 'pending';
create index team_join_requests_expiry_idx on public.team_join_requests(expires_at) where status='pending';

create table public.team_skill_requirements (
  team_id uuid not null references public.teams(id) on delete restrict,
  skill_id uuid not null references public.skills(id) on delete restrict,
  desired_proficiency smallint check (desired_proficiency between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (team_id, skill_id)
);
create index team_skill_requirements_skill_idx
  on public.team_skill_requirements(skill_id, team_id);

-- ---------- Versioned team fee and financial history ----------
create table public.team_fee_config_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null unique check (version_number > 0),
  old_amount_paise bigint check (old_amount_paise is null or old_amount_paise > 0),
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  effective_at timestamptz not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now(),
  unique (id, amount_paise, currency)
);

create table public.team_fee_config_cancellations (
  fee_config_version_id uuid primary key references public.team_fee_config_versions(id) on delete restrict,
  cancelled_by uuid not null references auth.users(id) on delete restrict,
  cancelled_at timestamptz not null default now(),
  reason text not null check (length(btrim(reason)) > 0)
);

create table public.team_payment_orders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  fee_config_version_id uuid not null references public.team_fee_config_versions(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null check (currency = 'INR'),
  status public.payment_order_state not null default 'pending',
  gateway_name text not null check (gateway_name in ('razorpay')),
  gateway_order_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  expired_at timestamptz,
  failure_code text,
  expires_at timestamptz not null,
  successful_transaction_id uuid,
  successful_transaction_status public.payment_transaction_state,
  successful_transaction_applied boolean,
  idempotency_key text not null unique,
  check (expires_at > created_at),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check ((status = 'failed') = (failed_at is not null)),
  check ((status = 'expired') = (expired_at is not null)),
  check ((status = 'paid') = (paid_at is not null)),
  check ((status = 'paid') = (successful_transaction_id is not null)),
  check ((successful_transaction_id is null) = (successful_transaction_status is null)),
  check (successful_transaction_status is null or successful_transaction_status = 'succeeded'),
  check ((successful_transaction_id is null) = (successful_transaction_applied is null)),
  check (successful_transaction_applied is null or successful_transaction_applied),
  unique (id, amount_paise, currency),
  unique (successful_transaction_id, id),
  unique (successful_transaction_id, id, amount_paise, currency, successful_transaction_status,successful_transaction_applied),
  foreign key (fee_config_version_id, amount_paise, currency)
    references public.team_fee_config_versions(id, amount_paise, currency) on delete restrict
);
create unique index team_payment_orders_one_pending_or_paid_per_team
  on public.team_payment_orders(team_id) where status in ('pending', 'paid');
create index team_payment_orders_payer_idx
  on public.team_payment_orders(payer_user_id, created_at desc);
create index team_payment_orders_expiry_idx
  on public.team_payment_orders(expires_at) where status = 'pending';

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.team_payment_orders(id) on delete restrict,
  gateway_name text not null check (gateway_name in ('razorpay')),
  gateway_transaction_id text not null,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null check (currency = 'INR'),
  status public.payment_transaction_state not null,
  applied_to_order boolean not null default false,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (gateway_name, gateway_transaction_id),
  unique (id, payment_order_id),
  unique (id, payment_order_id, amount_paise, currency, status,applied_to_order),
  foreign key (payment_order_id, amount_paise, currency)
    references public.team_payment_orders(id, amount_paise, currency) on delete restrict,
  check (status in ('succeeded', 'failed')),
  check (not applied_to_order or status='succeeded')
);
create unique index payment_transactions_one_applied_success_per_order
  on public.payment_transactions(payment_order_id) where status='succeeded' and applied_to_order;
create index payment_transactions_order_idx
  on public.payment_transactions(payment_order_id, created_at desc);

alter table public.team_payment_orders
  add constraint team_payment_orders_success_transaction_fk
  foreign key (successful_transaction_id, id, amount_paise, currency, successful_transaction_status,successful_transaction_applied)
  references public.payment_transactions(id, payment_order_id, amount_paise, currency, status,applied_to_order)
  deferrable initially deferred;

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway_name text not null check (gateway_name in ('razorpay')),
  gateway_event_id text not null check (length(gateway_event_id) between 1 and 200),
  payment_order_id uuid references public.team_payment_orders(id) on delete restrict,
  payload_sha256 bytea not null check (octet_length(payload_sha256) = 32),
  reported_transaction_status public.payment_transaction_state not null,
  signature_verified_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_result text,
  check ((processed_at is null) = (processing_result is null)),
  unique (gateway_name, gateway_event_id)
);
create index payment_webhook_events_unprocessed_idx
  on public.payment_webhook_events(received_at) where processed_at is null;

create table public.payment_webhook_attempts (
  id bigint generated always as identity primary key,
  webhook_event_id uuid not null references public.payment_webhook_events(id) on delete restrict,
  attempted_at timestamptz not null default now(),
  outcome_code text not null,
  details_digest bytea check (details_digest is null or octet_length(details_digest)=32)
);
create index payment_webhook_attempts_event_idx on public.payment_webhook_attempts(webhook_event_id,attempted_at desc);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.team_payment_orders(id) on delete restrict,
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  gateway_name text not null check (gateway_name in ('razorpay')),
  gateway_refund_id text,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null check (currency = 'INR'),
  status public.refund_state not null default 'requested',
  requested_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) > 0),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (gateway_name, gateway_refund_id),
  check ((status = 'requested') = (processed_at is null)),
  check (status<>'succeeded' or gateway_refund_id is not null)
);
alter table public.payment_refunds
  add constraint payment_refunds_transaction_same_order_fk
  foreign key (payment_transaction_id, payment_order_id)
  references public.payment_transactions(id, payment_order_id) on delete restrict;
create index payment_refunds_order_idx on public.payment_refunds(payment_order_id, requested_at desc);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null unique references public.team_payment_orders(id) on delete restrict,
  payment_transaction_id uuid not null,
  receipt_number text not null unique,
  storage_object_path text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete restrict,
  foreign key (payment_transaction_id,payment_order_id)
    references public.team_payment_orders(successful_transaction_id,id) on delete restrict
);

-- ---------- Team project submissions ----------
create table public.team_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete restrict,
  status public.submission_state not null default 'draft',
  submitted_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  public_release_at timestamptz,
  check ((status = 'draft') = (submitted_at is null)),
  check ((status = 'finalized') = (finalized_at is not null))
);

create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.team_submissions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  title text not null check (length(btrim(title)) between 1 and 160),
  project_description text not null,
  github_repository_url text,
  demo_url text,
  documentation_url text,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  unique (submission_id, version_number),
  check (github_repository_url is null or length(github_repository_url) <= 2048),
  check (demo_url is null or length(demo_url) <= 2048),
  check (documentation_url is null or length(documentation_url) <= 2048),
  check (not is_final or submitted_at is not null)
);
create unique index submission_versions_one_current_final
  on public.submission_versions(submission_id) where is_final;
create index submission_versions_submission_idx
  on public.submission_versions(submission_id, version_number desc);

create table public.technologies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 80)
);

create table public.submission_version_technologies (
  submission_version_id uuid not null references public.submission_versions(id) on delete restrict,
  technology_id uuid not null references public.technologies(id) on delete restrict,
  primary key (submission_version_id, technology_id)
);
create index submission_version_technologies_technology_idx
  on public.submission_version_technologies(technology_id, submission_version_id);

-- ---------- Public community and private team conversations ----------
create table public.community_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.community_categories(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 180),
  body text not null,
  visibility public.post_visibility not null default 'participants',
  status public.content_state not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden_at timestamptz,
  check ((status = 'hidden') = (hidden_at is not null))
);
create index community_posts_feed_idx
  on public.community_posts(category_id, created_at desc)
  where status = 'published';
create index community_posts_author_idx
  on public.community_posts(author_user_id, created_at desc);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  parent_comment_id uuid references public.community_comments(id) on delete restrict,
  body text not null,
  status public.content_state not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden_at timestamptz,
  check ((status='hidden') = (hidden_at is not null))
);
create index community_comments_post_idx
  on public.community_comments(post_id, created_at) where status = 'published';

create table public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  reaction_code text not null check (reaction_code in ('like', 'celebrate', 'insightful')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, reaction_code)
);
create index community_reactions_user_idx on public.community_reactions(user_id, created_at desc);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  post_id uuid references public.community_posts(id) on delete restrict,
  comment_id uuid references public.community_comments(id) on delete restrict,
  reason_code text not null,
  details text,
  status public.report_state not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  check (num_nonnulls(post_id, comment_id) = 1),
  check ((status in ('resolved', 'dismissed')) = (resolved_at is not null)),
  check ((resolved_at is null) = (resolved_by is null))
);
create index community_reports_queue_idx on public.community_reports(status, created_at)
  where status in ('open', 'reviewing');

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_user_id uuid not null references auth.users(id) on delete restrict,
  report_id uuid references public.community_reports(id) on delete restrict,
  post_id uuid references public.community_posts(id) on delete restrict,
  comment_id uuid references public.community_comments(id) on delete restrict,
  action_code text not null check (action_code in ('hide', 'restore', 'warn', 'dismiss_report')),
  reason text not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1)
);
create index moderation_actions_target_idx
  on public.moderation_actions(post_id, comment_id, created_at desc);

create table public.team_discussions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.team_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.team_discussions(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index team_discussion_messages_feed_idx
  on public.team_discussion_messages(discussion_id, created_at desc);

-- ---------- Recruiter access and candidate relationships ----------
create table public.recruiter_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  organization_name text not null,
  job_title text,
  created_at timestamptz not null default now()
);

create table public.recruiter_access_grants (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references auth.users(id) on delete restrict,
  permission_code text not null check (permission_code in (
    'candidate.discover', 'candidate.shortlist', 'candidate.note', 'recruitment.interest.read'
  )),
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  reason text,
  check ((revoked_at is null) = (revoked_by is null))
);
create unique index recruiter_access_grants_one_active
  on public.recruiter_access_grants(recruiter_user_id, permission_code) where revoked_at is null;

create table public.candidate_shortlists (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references auth.users(id) on delete restrict,
  candidate_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (recruiter_user_id, candidate_user_id)
);
create index candidate_shortlists_recruiter_idx
  on public.candidate_shortlists(recruiter_user_id, created_at desc);

create table public.recruiter_notes (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references auth.users(id) on delete restrict,
  candidate_user_id uuid not null references auth.users(id) on delete restrict,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recruiter_user_id, candidate_user_id)
);
create index recruiter_notes_recruiter_idx on public.recruiter_notes(recruiter_user_id);

create table public.recruiter_consent_events (
  id bigint generated always as identity primary key,
  participant_user_id uuid not null references auth.users(id) on delete restrict,
  consent_scope text not null check (consent_scope in ('candidate_profile', 'skills', 'interests', 'profile_links')),
  consent_version text not null,
  action text not null check (action in ('granted', 'revoked')),
  occurred_at timestamptz not null default now(),
  unique (participant_user_id, consent_scope, id)
);
create index recruiter_consent_latest_idx
  on public.recruiter_consent_events(participant_user_id, consent_scope, id desc);

-- Current disclosure text version per recruiter-facing consent scope. A
-- candidate's old consent stops authorizing reads as soon as this changes.
create table public.recruiter_consent_requirements (
  consent_scope text primary key check (consent_scope in ('candidate_profile','skills','interests','profile_links')),
  required_version text not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  reason text not null check (length(btrim(reason))>0)
);
alter table public.recruiter_consent_requirements enable row level security;

-- ---------- Judge assignment and confidential evaluation ----------
create table public.judge_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  public_bio text,
  created_at timestamptz not null default now()
);

create table public.evaluation_rubrics (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null unique check (version_number > 0),
  title text not null,
  status public.rubric_state not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check ((status = 'draft') = (published_at is null))
);

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.evaluation_rubrics(id) on delete restrict,
  criterion_code text not null,
  title text not null,
  description text,
  weight_basis_points integer not null check (weight_basis_points between 1 and 10000),
  maximum_score numeric(7,2) not null check (maximum_score > 0),
  display_order smallint not null,
  unique (rubric_id, criterion_code),
  unique (rubric_id, display_order),
  unique (id, rubric_id)
);
create index evaluation_criteria_rubric_idx on public.evaluation_criteria(rubric_id, display_order);

create table public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  judge_user_id uuid not null references auth.users(id) on delete restrict,
  submission_id uuid not null references public.team_submissions(id) on delete restrict,
  rubric_id uuid not null references public.evaluation_rubrics(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  reason text,
  unique (judge_user_id, submission_id, assigned_at),
  unique (id, judge_user_id),
  unique (id, judge_user_id, rubric_id)
);
create unique index judge_assignments_one_active_judge_submission
  on public.judge_assignments(judge_user_id, submission_id) where revoked_at is null;
create index judge_assignments_current_idx
  on public.judge_assignments(judge_user_id, submission_id) where revoked_at is null;
create index judge_assignments_submission_idx
  on public.judge_assignments(submission_id, judge_user_id) where revoked_at is null;

create table public.judge_conflicts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  judge_user_id uuid not null references auth.users(id) on delete restrict,
  status public.judge_conflict_state not null default 'declared',
  confidential_reason text,
  declared_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  resolution_reason text,
  foreign key (assignment_id, judge_user_id)
    references public.judge_assignments(id, judge_user_id) on delete restrict,
  check ((status = 'declared') or (resolved_at is not null and resolved_by is not null))
);
create index judge_conflicts_assignment_idx
  on public.judge_conflicts(assignment_id, declared_at desc);
create unique index judge_conflicts_one_unresolved
  on public.judge_conflicts(assignment_id) where status = 'declared';

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.judge_assignments(id) on delete restrict,
  judge_user_id uuid not null,
  rubric_id uuid not null references public.evaluation_rubrics(id) on delete restrict,
  status public.evaluation_state not null default 'draft',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  released_at timestamptz,
  check ((status = 'draft') = (submitted_at is null)),
  check ((status = 'released') = (released_at is not null)),
  unique (id, rubric_id),
  foreign key (assignment_id, judge_user_id, rubric_id)
    references public.judge_assignments(id, judge_user_id, rubric_id) on delete restrict
);
create index evaluations_rubric_idx on public.evaluations(rubric_id, status);

create table public.evaluation_scores (
  evaluation_id uuid not null references public.evaluations(id) on delete restrict,
  rubric_id uuid not null,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete restrict,
  score numeric(7,2) not null check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (evaluation_id, criterion_id),
  foreign key (evaluation_id, rubric_id) references public.evaluations(id, rubric_id) on delete restrict,
  foreign key (criterion_id, rubric_id) references public.evaluation_criteria(id, rubric_id) on delete restrict
);
create index evaluation_scores_criterion_idx on public.evaluation_scores(criterion_id);

create table public.evaluation_feedback (
  evaluation_id uuid primary key references public.evaluations(id) on delete restrict,
  feedback_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Announcements, notifications, and event schedule ----------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience public.announcement_audience not null,
  status public.content_state not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status = 'draft') = (published_at is null))
);
create index announcements_published_idx on public.announcements(published_at desc)
  where status = 'published';

create table public.announcement_targets (
  announcement_id uuid not null references public.announcements(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete restrict,
  target_team_id uuid references public.teams(id) on delete restrict,
  target_role public.app_role,
  created_at timestamptz not null default now(),
  check (num_nonnulls(target_user_id, target_team_id, target_role) = 1)
);
-- Nullable target columns can otherwise make duplicate target rows possible.
create unique index announcement_targets_user_unique
  on public.announcement_targets(announcement_id, target_user_id) where target_user_id is not null;
create unique index announcement_targets_team_unique
  on public.announcement_targets(announcement_id, target_team_id) where target_team_id is not null;
create unique index announcement_targets_role_unique
  on public.announcement_targets(announcement_id, target_role) where target_role is not null;
create index announcement_targets_user_idx on public.announcement_targets(target_user_id)
  where target_user_id is not null;
create index announcement_targets_team_idx on public.announcement_targets(target_team_id)
  where target_team_id is not null;
create index announcement_targets_role_idx on public.announcement_targets(target_role)
  where target_role is not null;

create table public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete restrict,
  channel public.notification_channel not null,
  purpose_code text not null check (purpose_code in ('event_updates','team_activity','payment_updates','judging_updates','community_updates')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel, purpose_code)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  announcement_id uuid references public.announcements(id) on delete restrict,
  notification_type text not null,
  resource_type text,
  resource_id uuid,
  safe_summary text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc)
  where read_at is null and archived_at is null;

create table public.event_schedule (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  display_timezone text not null,
  audience public.announcement_audience not null default 'public',
  status public.content_state not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (ends_at > starts_at),
  check ((status = 'draft') = (published_at is null))
);
create index event_schedule_published_idx on public.event_schedule(starts_at)
  where status = 'published';

create table public.event_deadline_versions (
  id uuid primary key default gen_random_uuid(),
  deadline_code text not null check (deadline_code in ('submission')),
  version_number integer not null check (version_number>0),
  deadline_at timestamptz not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(btrim(reason))>0),
  created_at timestamptz not null default now(),
  unique (deadline_code,version_number)
);

-- ---------- Certificate issuance and privacy-preserving verification ----------
create table public.certificate_types (
  id uuid primary key default gen_random_uuid(),
  kind public.certificate_kind not null,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_type_id uuid not null references public.certificate_types(id) on delete restrict,
  recipient_user_id uuid references auth.users(id) on delete restrict,
  recipient_team_id uuid references public.teams(id) on delete restrict,
  verification_code text not null unique check (length(verification_code)=64),
  public_display_name text,
  public_name_consent_at timestamptz,
  public_name_revoked_at timestamptz,
  storage_object_path text,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text,
  check (num_nonnulls(recipient_user_id, recipient_team_id) = 1),
  check ((public_display_name is null) = (public_name_consent_at is null)),
  check (public_name_revoked_at is null or public_name_consent_at is not null),
  check ((revoked_at is null) = (revoked_by is null))
);
create unique index certificates_user_type_unique
  on public.certificates(recipient_user_id, certificate_type_id)
  where recipient_user_id is not null and revoked_at is null;
create unique index certificates_team_type_unique
  on public.certificates(recipient_team_id, certificate_type_id)
  where recipient_team_id is not null and revoked_at is null;

create table public.certificate_verifications (
  id bigint generated always as identity primary key,
  certificate_id uuid references public.certificates(id) on delete restrict,
  result_code text not null check (result_code in ('valid', 'revoked', 'not_found')),
  queried_at timestamptz not null default now(),
  check ((result_code='not_found') = (certificate_id is null))
);
create index certificate_verifications_queried_idx
  on public.certificate_verifications(queried_at desc);

-- Supporting indexes for foreign-key joins, actor history, and common lookups.
create index user_role_grants_user_history_idx on public.user_role_grants(user_id,granted_at desc);
create index user_role_grants_grantor_idx on public.user_role_grants(granted_by,granted_at desc) where granted_by is not null;
create index admin_permission_grants_history_idx on public.admin_permission_grants(admin_user_id,granted_at desc);
create index admin_permission_grants_grantor_idx on public.admin_permission_grants(granted_by,granted_at desc);
create index admin_invitations_invitee_idx on public.admin_invitations(accepted_user_id) where accepted_user_id is not null;
create index team_invitations_inviter_idx on public.team_invitations(invited_by,created_at desc);
create index team_join_requests_requester_idx on public.team_join_requests(requester_user_id,created_at desc);
create index team_payment_orders_fee_version_idx on public.team_payment_orders(fee_config_version_id);
create index payment_webhook_events_order_idx on public.payment_webhook_events(payment_order_id,received_at desc) where payment_order_id is not null;
create index payment_refunds_transaction_idx on public.payment_refunds(payment_transaction_id,requested_at desc);
create index submission_versions_submitter_idx on public.submission_versions(submitted_by,created_at desc);
create index community_reports_reporter_idx on public.community_reports(reporter_user_id,created_at desc);
create index moderation_actions_report_idx on public.moderation_actions(report_id,created_at desc) where report_id is not null;
create index moderation_actions_actor_idx on public.moderation_actions(moderator_user_id,created_at desc);
create index team_discussion_messages_author_idx on public.team_discussion_messages(author_user_id,created_at desc);
create index recruiter_access_grants_grantor_idx on public.recruiter_access_grants(granted_by,granted_at desc);
create index candidate_shortlists_candidate_idx on public.candidate_shortlists(candidate_user_id,created_at desc);
create index recruiter_notes_candidate_idx on public.recruiter_notes(candidate_user_id);
create index judge_assignments_rubric_idx on public.judge_assignments(rubric_id);
create index judge_assignments_assignor_idx on public.judge_assignments(assigned_by,assigned_at desc);
create index judge_conflicts_judge_idx on public.judge_conflicts(judge_user_id,declared_at desc);
create index announcements_author_idx on public.announcements(created_by,created_at desc);
create index event_schedule_author_idx on public.event_schedule(created_by,starts_at desc);
create index certificate_verifications_certificate_idx on public.certificate_verifications(certificate_id,queried_at desc) where certificate_id is not null;

-- ---------- Deny-by-default API posture for every exposed table ----------
-- RLS is enabled here. Concrete user policies, grants and safe projections
-- follow in this same unexecuted design draft for review before migration work.
alter table public.profiles enable row level security;
alter table public.user_role_grants enable row level security;
alter table public.admin_permission_grants enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.audit_log enable row level security;
alter table public.participant_registrations enable row level security;
alter table public.skills enable row level security;
alter table public.participant_skills enable row level security;
alter table public.interest_areas enable row level security;
alter table public.participant_interests enable row level security;
alter table public.profile_links enable row level security;
alter table public.team_size_policy_versions enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.team_skill_requirements enable row level security;
alter table public.team_fee_config_versions enable row level security;
alter table public.team_fee_config_cancellations enable row level security;
alter table public.team_payment_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.payment_webhook_attempts enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.team_submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.technologies enable row level security;
alter table public.submission_version_technologies enable row level security;
alter table public.community_categories enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.team_discussions enable row level security;
alter table public.team_discussion_messages enable row level security;
alter table public.recruiter_profiles enable row level security;
alter table public.recruiter_access_grants enable row level security;
alter table public.candidate_shortlists enable row level security;
alter table public.recruiter_notes enable row level security;
alter table public.recruiter_consent_events enable row level security;
alter table public.judge_profiles enable row level security;
alter table public.evaluation_rubrics enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.judge_assignments enable row level security;
alter table public.judge_conflicts enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.evaluation_feedback enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_targets enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.event_schedule enable row level security;
alter table public.event_deadline_versions enable row level security;
alter table public.certificate_types enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_verifications enable row level security;

-- The reviewed authorization proposal, functions, and policies follow below.

-- ===========================================================================
-- Authorization contract (reviewed proposal; still NOT EXECUTED)
-- ===========================================================================
-- Base tables are not granted to anon/authenticated. Clients use the narrow
-- views below and RPCs. RLS remains enabled as defense in depth. The RPC owner
-- is a NOLOGIN, NOBYPASSRLS role; migrations force RLS and add one internal
-- policy per table for that role. Only the trusted migration operator may
-- SET ROLE to it; no client/API role receives membership.
do $$
begin
  if current_setting('server_version_num')::integer < 160000 then
    raise exception 'RPC owner membership options require PostgreSQL 16+; stop before creating the role';
  end if;
  if not exists(select 1 from pg_catalog.pg_roles r
                 where r.rolname=current_user and r.rolcreaterole and not r.rolsuper) then
    raise exception 'RPC owner provisioning requires a non-superuser CREATEROLE migration operator';
  end if;
end $$;
create role incux_rpc_owner nologin noinherit nosuperuser nocreatedb
  nocreaterole noreplication nobypassrls;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public,private from public,anon,authenticated,service_role;
grant usage on schema public, auth, private to incux_rpc_owner;
grant select, insert, update, delete on all tables in schema public to incux_rpc_owner;
grant usage, select on all sequences in schema public to incux_rpc_owner;

-- Ownership changes below require the migration operator to SET ROLE to the
-- target owner. Per-membership INHERIT/SET/ADMIN controls require PostgreSQL
-- 16+. PostgreSQL 17 gives a non-superuser CREATEROLE creator a bootstrap
-- ADMIN TRUE membership, recorded under the bootstrap/platform grantor. A
-- self-GRANT by the operator is a second catalog row because its grantor is
-- different; same-grantor GRANT updates that grantor's row. The creator cannot
-- alter the platform row. Effective ADMIN remains on the trusted operator;
-- its separate SET grant is INHERIT FALSE / ADMIN FALSE. No API role may join.
-- This is elevated deployment authority, not a runtime application permission.
grant incux_rpc_owner to current_user with set true, inherit false, admin false;
do $$
begin
  if not pg_catalog.pg_has_role(current_user,'incux_rpc_owner','SET')
     or pg_catalog.pg_has_role(current_user,'incux_rpc_owner','USAGE')
     or not pg_catalog.pg_has_role(current_user,'incux_rpc_owner','SET WITH ADMIN OPTION')
     or pg_catalog.pg_has_role('authenticator','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('anon','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('authenticated','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('service_role','incux_rpc_owner','MEMBER')
     or pg_catalog.pg_has_role('authenticator','incux_rpc_owner','SET WITH ADMIN OPTION')
     or pg_catalog.pg_has_role('anon','incux_rpc_owner','SET WITH ADMIN OPTION')
     or pg_catalog.pg_has_role('authenticated','incux_rpc_owner','SET WITH ADMIN OPTION')
     or pg_catalog.pg_has_role('service_role','incux_rpc_owner','SET WITH ADMIN OPTION') then
    raise exception 'migration operator must have SET and documented creator ADMIN capability without inheritance; API roles must have no membership or ADMIN capability';
  end if;
  if (select count(*) from pg_catalog.pg_auth_members m
       where m.roleid=(select oid from pg_catalog.pg_roles where rolname='incux_rpc_owner')
         and m.member=(select oid from pg_catalog.pg_roles where rolname=current_user)) <> 2
     or (select count(*) from pg_catalog.pg_auth_members m
          where m.roleid=(select oid from pg_catalog.pg_roles where rolname='incux_rpc_owner')
            and m.member=(select oid from pg_catalog.pg_roles where rolname=current_user)
            and m.grantor <> m.member
            and m.admin_option and not m.set_option and not m.inherit_option) <> 1
     or (select count(*) from pg_catalog.pg_auth_members m
          where m.roleid=(select oid from pg_catalog.pg_roles where rolname='incux_rpc_owner')
            and m.member=(select oid from pg_catalog.pg_roles where rolname=current_user)
            and m.grantor=m.member and m.set_option and not m.inherit_option and not m.admin_option) <> 1 then
    raise exception 'expected PostgreSQL creator ADMIN membership plus one explicit non-admin SET membership for the migration operator';
  end if;
end $$;

create or replace function private.has_role(p_role public.app_role)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (
    select 1 from public.user_role_grants g
    where g.user_id = auth.uid() and g.role = p_role and g.revoked_at is null
  );
$$;

create or replace function private.has_permission(p_code text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select private.has_role('super_admin') or (
    private.has_role('admin') and exists (
      select 1 from public.admin_permission_grants g
      where g.admin_user_id = auth.uid() and g.permission_code = p_code
        and g.revoked_at is null
    )
  );
$$;

create or replace function private.is_team_member(p_team_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (select 1 from public.team_memberships m
    where m.team_id = p_team_id and m.user_id = auth.uid() and m.left_at is null);
$$;

create or replace function private.is_team_leader(p_team_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (select 1 from public.team_memberships m
    where m.team_id = p_team_id and m.user_id = auth.uid()
      and m.membership_role = 'leader' and m.left_at is null);
$$;

create or replace function private.can_judge_submission(p_submission_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select private.has_role('judge') and exists (
    select 1 from public.judge_assignments a
    where a.submission_id = p_submission_id and a.judge_user_id = auth.uid()
      and a.revoked_at is null and not exists (
        select 1 from public.judge_conflicts c
        where c.assignment_id = a.id and c.status = 'declared'
      )
  );
$$;

create or replace function private.can_recruiter_view(p_candidate_id uuid, p_scope text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select private.has_role('recruiter') and exists (
    select 1 from public.recruiter_access_grants g
    where g.recruiter_user_id = auth.uid() and g.permission_code = 'candidate.discover'
      and g.revoked_at is null
  ) and exists (
    select 1 from public.recruiter_consent_events c
    where c.participant_user_id = p_candidate_id and c.consent_scope = p_scope
      and c.action = 'granted' and c.id = (
        select max(c2.id) from public.recruiter_consent_events c2
        where c2.participant_user_id = p_candidate_id and c2.consent_scope = p_scope
      )
      and c.consent_version=(select r.required_version from public.recruiter_consent_requirements r where r.consent_scope=p_scope)
  ) and (p_scope<>'interests' or exists(
    select 1 from public.recruiter_access_grants g where g.recruiter_user_id=auth.uid()
      and g.permission_code='recruitment.interest.read' and g.revoked_at is null
  ));
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.has_role(public.app_role),
  private.has_permission(text), private.is_team_member(uuid),
  private.is_team_leader(uuid), private.can_judge_submission(uuid),
  private.can_recruiter_view(uuid, text) to authenticated;

-- RLS recursion is avoided because only these helpers read role, membership,
-- assignment, consent, and permission tables as the restricted definer role.
-- They accept resource IDs, never a caller-supplied user ID. auth.uid() is the
-- subject. The helper owner is not login-capable and has no RLS bypass.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_role_grants','admin_permission_grants','admin_invitations','audit_log',
    'participant_registrations','skills','participant_skills','interest_areas','participant_interests','profile_links',
    'team_size_policy_versions','teams','team_memberships','team_invitations','team_join_requests','team_skill_requirements',
    'team_fee_config_versions','team_fee_config_cancellations','team_payment_orders','payment_transactions','payment_webhook_events','payment_webhook_attempts','payment_refunds','payment_receipts',
    'team_submissions','submission_versions','technologies','submission_version_technologies',
    'community_categories','community_posts','community_comments','community_reactions','community_reports','moderation_actions','team_discussions','team_discussion_messages',
    'recruiter_profiles','recruiter_access_grants','candidate_shortlists','recruiter_notes','recruiter_consent_events','recruiter_consent_requirements',
    'judge_profiles','evaluation_rubrics','evaluation_criteria','judge_assignments','judge_conflicts','evaluations','evaluation_scores','evaluation_feedback',
    'announcements','announcement_targets','notification_preferences','notifications','event_schedule','event_deadline_versions','certificate_types','certificates','certificate_verifications'
  ] loop
    execute format('alter table public.%I force row level security', t);
    execute format('create policy internal_rpc_owner on public.%I for all to incux_rpc_owner using (true) with check (true)', t);
  end loop;
end $$;

-- All client base-table privileges are revoked. Row policies below document
-- defense-in-depth and become effective only if a later reviewed migration
-- grants a specific column. Sensitive mutations remain RPC-only.
revoke all on all tables in schema public from public, anon, authenticated, service_role;
revoke all on all sequences in schema public from public, anon, authenticated, service_role;

create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (user_id=auth.uid() and length(btrim(display_name)) between 1 and 120);
create policy profiles_self_update on public.profiles for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy roles_self_read on public.user_role_grants for select to authenticated
  using (user_id = auth.uid());
create policy permissions_self_read on public.admin_permission_grants for select to authenticated
  using (admin_user_id = auth.uid() or private.has_role('super_admin'));
create policy registrations_self_read on public.participant_registrations for select to authenticated
  using (user_id = auth.uid());
create policy registrations_self_insert on public.participant_registrations for insert to authenticated
  with check (user_id=auth.uid() and status='draft' and submitted_at is null and decided_at is null and decided_by is null);
create policy skills_catalog_read on public.skills for select to authenticated using (true);
create policy participant_skills_read on public.participant_skills for select to authenticated
  using (user_id = auth.uid() or private.can_recruiter_view(user_id, 'skills'));
create policy participant_skills_self_insert on public.participant_skills for insert to authenticated with check (user_id=auth.uid() and private.has_role('participant'));
create policy participant_skills_self_delete on public.participant_skills for delete to authenticated using (user_id=auth.uid());
create policy interest_catalog_read on public.interest_areas for select to authenticated using (active);
create policy participant_interests_read on public.participant_interests for select to authenticated
  using (user_id = auth.uid());
create policy participant_interests_self_insert on public.participant_interests for insert to authenticated with check (user_id=auth.uid() and private.has_role('participant'));
create policy participant_interests_self_delete on public.participant_interests for delete to authenticated using (user_id=auth.uid());
create policy profile_links_read on public.profile_links for select to authenticated
  using (user_id = auth.uid() or (recruiter_visible and private.can_recruiter_view(user_id, 'profile_links')));
create policy profile_links_self_insert on public.profile_links for insert to authenticated with check (user_id=auth.uid());
create policy profile_links_self_update on public.profile_links for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy profile_links_self_delete on public.profile_links for delete to authenticated using (user_id=auth.uid());
create policy team_policy_read on public.team_size_policy_versions for select to authenticated using (true);
create policy teams_read on public.teams for select to authenticated
  using ((status = 'forming' and discoverable) or private.is_team_member(id));
create policy team_memberships_read on public.team_memberships for select to authenticated
  using (user_id = auth.uid() or private.is_team_member(team_id));
create policy team_invitations_read on public.team_invitations for select to authenticated
  using (invited_user_id = auth.uid() or invited_by = auth.uid() or private.is_team_leader(team_id));
create policy team_join_requests_read on public.team_join_requests for select to authenticated
  using (requester_user_id = auth.uid() or private.is_team_leader(team_id));
create policy team_skill_requirements_read on public.team_skill_requirements for select to authenticated
  using (private.is_team_member(team_id) or exists(select 1 from public.teams t where t.id=team_id and t.discoverable and t.status='forming'));
create policy submission_read on public.team_submissions for select to authenticated
  using (private.is_team_member(team_id) or private.can_judge_submission(id));
create policy submission_versions_read on public.submission_versions for select to authenticated
  using (exists(select 1 from public.team_submissions s where s.id=submission_id and private.is_team_member(s.team_id))
    or exists(select 1 from public.judge_assignments a where a.submission_id=(select s.id from public.team_submissions s where s.id=submission_id) and private.can_judge_submission(a.submission_id)));
create policy technologies_read on public.technologies for select to authenticated using (true);
create policy submission_technologies_read on public.submission_version_technologies for select to authenticated
  using (exists(select 1 from public.submission_versions v join public.team_submissions s on s.id=v.submission_id
    where v.id=submission_version_id and (private.is_team_member(s.team_id) or private.can_judge_submission(s.id))));
create policy community_categories_read on public.community_categories for select to authenticated using (enabled);
create policy community_posts_read on public.community_posts for select to authenticated
  using ((status='published' and (visibility='public' or private.has_role('participant')))
    or author_user_id=auth.uid() or private.has_role('moderator'));
create policy community_comments_read on public.community_comments for select to authenticated
  using (exists(select 1 from public.community_posts p where p.id=post_id and p.status='published'
    and (p.visibility='public' or private.has_role('participant')))
    or author_user_id=auth.uid() or private.has_role('moderator'));
create policy community_reactions_read on public.community_reactions for select to authenticated
  using (user_id=auth.uid());
create policy community_reports_read on public.community_reports for select to authenticated
  using (reporter_user_id=auth.uid() or private.has_role('moderator'));
create policy moderation_actions_read on public.moderation_actions for select to authenticated
  using (private.has_role('moderator') or private.has_permission('moderation.manage'));
create policy team_discussions_member_read on public.team_discussions for select to authenticated
  using (private.is_team_member(team_id));
create policy team_messages_member_read on public.team_discussion_messages for select to authenticated
  using (exists(select 1 from public.team_discussions d where d.id=discussion_id and private.is_team_member(d.team_id)));
create policy recruiter_profile_self_read on public.recruiter_profiles for select to authenticated
  using (user_id=auth.uid());
create policy recruiter_grant_self_read on public.recruiter_access_grants for select to authenticated
  using (recruiter_user_id=auth.uid() or private.has_role('super_admin'));
create policy shortlist_owner_read on public.candidate_shortlists for select to authenticated
  using (recruiter_user_id=auth.uid() and private.has_role('recruiter')
    and exists(select 1 from public.recruiter_access_grants g where g.recruiter_user_id=auth.uid() and g.permission_code='candidate.shortlist' and g.revoked_at is null)
    and private.can_recruiter_view(candidate_user_id,'candidate_profile'));
create policy recruiter_notes_owner_read on public.recruiter_notes for select to authenticated
  using (recruiter_user_id=auth.uid() and private.has_role('recruiter')
    and exists(select 1 from public.recruiter_access_grants g where g.recruiter_user_id=auth.uid() and g.permission_code='candidate.note' and g.revoked_at is null)
    and private.can_recruiter_view(candidate_user_id,'candidate_profile'));
create policy recruiter_consent_self_read on public.recruiter_consent_events for select to authenticated
  using (participant_user_id=auth.uid());
create policy judge_profile_self_read on public.judge_profiles for select to authenticated
  using (user_id=auth.uid() or private.has_permission('judge.assignment.manage'));
create policy rubrics_published_read on public.evaluation_rubrics for select to authenticated
  using (status in ('published','retired'));
create policy criteria_published_read on public.evaluation_criteria for select to authenticated
  using (exists(select 1 from public.evaluation_rubrics r where r.id=rubric_id and r.status in ('published','retired')));
create policy assignments_judge_read on public.judge_assignments for select to authenticated
  using (judge_user_id=auth.uid() or private.has_permission('judge.assignment.manage'));
create policy conflicts_judge_read on public.judge_conflicts for select to authenticated
  using (judge_user_id=auth.uid() or private.has_permission('judge.assignment.manage'));
create policy evaluations_assigned_read on public.evaluations for select to authenticated
  using ((judge_user_id=auth.uid() and private.can_judge_submission((select a.submission_id from public.judge_assignments a where a.id=assignment_id)))
    or private.has_permission('evaluation.release'));
create policy evaluation_scores_owner_read on public.evaluation_scores for select to authenticated
  using (exists(select 1 from public.evaluations e where e.id=evaluation_id and e.judge_user_id=auth.uid()
    and e.status='draft' and private.can_judge_submission((select a.submission_id from public.judge_assignments a where a.id=e.assignment_id))));
create policy evaluation_feedback_owner_read on public.evaluation_feedback for select to authenticated
  using (exists(select 1 from public.evaluations e where e.id=evaluation_id and e.judge_user_id=auth.uid()
    and e.status='draft' and private.can_judge_submission((select a.submission_id from public.judge_assignments a where a.id=e.assignment_id))));
create policy announcements_published_read on public.announcements for select to authenticated
  using (status='published' and (
    audience='public'
    or (audience='registered_participants' and private.has_role('participant'))
    or (audience='paid_teams' and exists(select 1 from public.team_memberships m
      join public.team_payment_orders o on o.team_id=m.team_id and o.status='paid'
      where m.user_id=auth.uid() and m.left_at is null))
    or (audience='judges' and private.has_role('judge'))
    or (audience='recruiters' and private.has_role('recruiter'))
    or (audience='moderators' and private.has_role('moderator'))
    or (audience='admins' and (private.has_role('admin') or private.has_role('super_admin')))
    or (audience='targeted' and exists(select 1 from public.announcement_targets t
      where t.announcement_id=id and (t.target_user_id=auth.uid()
        or t.target_role in (select g.role from public.user_role_grants g where g.user_id=auth.uid() and g.revoked_at is null)
        or (t.target_team_id is not null and private.is_team_member(t.target_team_id)))))
  ));
create policy announcement_targets_recipient_read on public.announcement_targets for select to authenticated
  using (target_user_id=auth.uid()
    or (target_role is not null and private.has_role(target_role))
    or (target_team_id is not null and private.is_team_member(target_team_id)));
create policy notification_preferences_self_read on public.notification_preferences for select to authenticated
  using (user_id=auth.uid());
create policy notifications_self_read on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_self_update on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy notification_preferences_self_write on public.notification_preferences for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy reactions_self_insert on public.community_reactions for insert to authenticated
  with check (user_id=auth.uid() and private.has_role('participant') and exists(select 1 from public.community_posts p where p.id=post_id and p.status='published'));
create policy reactions_self_delete on public.community_reactions for delete to authenticated using (user_id=auth.uid());

-- Explicit column grants: identity/role/status/owner fields are not writable
-- through PostgREST. All other table privileges remain revoked by default.
grant select (user_id,display_name,phone,college,degree,branch,academic_year,city,state_region,created_at,updated_at),
  insert (user_id,display_name), update (display_name,phone,college,degree,branch,academic_year,city,state_region)
  on public.profiles to authenticated;
grant select (user_id,status,submitted_at,decided_at,decision_reason,created_at,updated_at),
  insert (user_id) on public.participant_registrations to authenticated;
grant select (id,name,category,created_at) on public.skills to authenticated;
grant select (id,name) on public.technologies to authenticated;
grant select (user_id,skill_id,proficiency,created_at),insert (user_id,skill_id,proficiency),delete
  on public.participant_skills to authenticated;
grant select (id,code,label,active) on public.interest_areas to authenticated;
grant select (user_id,interest_area_id,created_at),insert (user_id,interest_area_id),delete
  on public.participant_interests to authenticated;
grant select (id,user_id,link_kind,url,recruiter_visible,created_at),insert (user_id,link_kind,url,recruiter_visible),
  update (link_kind,url,recruiter_visible),delete on public.profile_links to authenticated;
grant select (id,name,slug,description,discoverable,status,created_by,created_at,updated_at) on public.teams to authenticated;
grant select on public.team_memberships to authenticated;
grant select (id,team_id,invited_by,invited_user_id,status,created_at,expires_at,responded_at) on public.team_invitations to authenticated;
grant select on public.team_join_requests,public.team_skill_requirements to authenticated;
grant select (id,team_id,created_at,updated_at) on public.team_submissions to authenticated;
grant select on public.submission_versions,public.technologies,public.submission_version_technologies to authenticated;
grant select on public.community_categories,public.community_posts,public.community_comments to authenticated;
grant select on public.community_reports,public.moderation_actions to authenticated;
grant select on public.recruiter_profiles to authenticated;
grant select (recruiter_user_id,permission_code,granted_at,revoked_at) on public.recruiter_access_grants to authenticated;
grant select on public.candidate_shortlists,public.recruiter_notes,public.recruiter_consent_events to authenticated;
grant select on public.judge_profiles,public.evaluation_rubrics,public.evaluation_criteria to authenticated;
grant select (id,judge_user_id,submission_id,rubric_id,assigned_at,revoked_at) on public.judge_assignments to authenticated;
grant select on public.judge_conflicts,public.evaluations,public.evaluation_scores,public.evaluation_feedback to authenticated;
grant select on public.announcements,public.announcement_targets,public.notification_preferences to authenticated;
grant select on public.event_schedule,public.certificate_types to authenticated;
grant select (post_id,user_id,reaction_code,created_at),insert (post_id,user_id,reaction_code),delete
  on public.community_reactions to authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id,channel,purpose_code,enabled),update (enabled),delete
  on public.notification_preferences to authenticated;
grant select (id,user_id,announcement_id,notification_type,resource_type,resource_id,safe_summary,created_at,read_at,archived_at),
  update (read_at,archived_at) on public.notifications to authenticated;
create policy schedule_published_read on public.event_schedule for select to authenticated
  using (status='published' and (
    audience='public'
    or (audience='registered_participants' and private.has_role('participant'))
    or (audience='paid_teams' and exists(select 1 from public.team_memberships m join public.team_payment_orders o on o.team_id=m.team_id and o.status='paid'
      where m.user_id=auth.uid() and m.left_at is null))
    or (audience='judges' and private.has_role('judge'))
    or (audience='recruiters' and private.has_role('recruiter'))
    or (audience='moderators' and private.has_role('moderator'))
    or (audience='admins' and (private.has_role('admin') or private.has_role('super_admin')))
  ));
create policy certificate_types_active_read on public.certificate_types for select to authenticated using (active);
create policy certificates_recipient_read on public.certificates for select to authenticated
  using (recipient_user_id=auth.uid() or (recipient_team_id is not null and private.is_team_member(recipient_team_id)));

-- No authenticated or anon policies are intentionally defined on financial
-- tables, audit_log, admin invitations, or verification logs. Their client
-- interfaces are the safe views/RPCs only. Moderators have no team-discussion
-- policy. All client writes to base tables are revoked; RPCs own transitions.

-- Safe projections. These views run with the non-login, forced-RLS owner and
-- repeat authorization in their predicates; they expose only named columns.
create view public.my_profile with (security_barrier=true) as
  select user_id, display_name, phone, college, degree, branch, academic_year,
         city, state_region, created_at, updated_at
  from public.profiles where user_id=auth.uid();
create view public.my_registration with (security_barrier=true) as
  select user_id,status,submitted_at,decided_at,decision_reason,created_at,updated_at
  from public.participant_registrations where user_id=auth.uid();
create view public.public_team_directory with (security_barrier=true) as
  select id,name,slug,description,created_at from public.teams
  where status='forming' and discoverable;
create view public.my_team_roster with (security_barrier=true) as
  select m.team_id,m.user_id,p.display_name,m.membership_role,m.joined_at
  from public.team_memberships m join public.profiles p on p.user_id=m.user_id
  where m.left_at is null and private.is_team_member(m.team_id);
create view public.my_teams with (security_barrier=true) as
  select t.id,t.name,t.slug,t.description,t.status,t.size_policy_version_id,t.created_at,t.updated_at
  from public.teams t where private.is_team_member(t.id);
create view public.current_team_size_policy with (security_barrier=true) as
  select version_number,minimum_members,maximum_members,effective_at from public.team_size_policy_versions
  where effective_at<=now() order by effective_at desc limit 1;
create view public.current_team_fee with (security_barrier=true) as
  select version_number,amount_paise,currency,effective_at from public.team_fee_config_versions f
  where effective_at<=now() and not exists(select 1 from public.team_fee_config_cancellations c where c.fee_config_version_id=f.id)
  order by effective_at desc limit 1;
create view public.my_payment_summary with (security_barrier=true) as
  select o.id,o.team_id,o.status,
    case when o.payer_user_id=auth.uid() or private.is_team_leader(o.team_id) then o.amount_paise else null end amount_paise,
    case when o.payer_user_id=auth.uid() or private.is_team_leader(o.team_id) then o.currency else null end currency,
    o.created_at,o.expires_at,o.paid_at
  from public.team_payment_orders o
  where o.payer_user_id=auth.uid() or private.is_team_member(o.team_id);
create view public.recruiter_candidate_directory with (security_barrier=true) as
  select p.user_id,p.display_name,p.college,p.degree,p.branch,p.academic_year,p.city,p.state_region
  from public.profiles p where private.can_recruiter_view(p.user_id,'candidate_profile');
create view public.recruiter_candidate_skills with (security_barrier=true) as
  select ps.user_id,s.name,ps.proficiency from public.participant_skills ps
  join public.skills s on s.id=ps.skill_id where private.can_recruiter_view(ps.user_id,'skills');
create view public.recruiter_candidate_links with (security_barrier=true) as
  select l.user_id,l.link_kind,l.url from public.profile_links l
  where l.recruiter_visible and private.can_recruiter_view(l.user_id,'profile_links');
create view public.released_evaluation_projection with (security_barrier=true) as
  select e.id evaluation_id,s.team_id,c.criterion_code,c.title criterion_title,
         sc.score,c.maximum_score,f.feedback_text,e.released_at
  from public.evaluations e
  join public.judge_assignments a on a.id=e.assignment_id
  join public.team_submissions s on s.id=a.submission_id
  join public.evaluation_scores sc on sc.evaluation_id=e.id
  join public.evaluation_criteria c on c.id=sc.criterion_id and c.rubric_id=e.rubric_id
  left join public.evaluation_feedback f on f.evaluation_id=e.id
  where e.status='released' and private.is_team_member(s.team_id);
create view public.my_submission_versions with (security_barrier=true) as
  select s.team_id,v.id version_id,v.version_number,v.title,v.project_description,
    v.github_repository_url,v.demo_url,v.documentation_url,v.submitted_at,v.is_final
  from public.team_submissions s join public.submission_versions v on v.submission_id=s.id
  where private.is_team_member(s.team_id) or private.can_judge_submission(s.id);
create view public.public_released_projects with (security_barrier=true) as
  select s.team_id,t.name team_name,v.title,v.project_description,v.github_repository_url,v.demo_url,v.documentation_url
  from public.team_submissions s join public.teams t on t.id=s.team_id
  join public.submission_versions v on v.submission_id=s.id and v.is_final
  where s.status='finalized' and s.public_release_at is not null and s.public_release_at<=now();
create view public.public_community_feed with (security_barrier=true) as
  select id,category_id,title,body,created_at,updated_at from public.community_posts
  where status='published' and visibility='public';
create view public.public_announcements with (security_barrier=true) as
  select id,title,body,published_at from public.announcements where status='published' and audience='public';
create view public.public_schedule with (security_barrier=true) as
  select id,title,description,starts_at,ends_at,display_timezone from public.event_schedule
  where status='published' and audience='public';
create view public.my_role_summary with (security_barrier=true) as
  select role,granted_at from public.user_role_grants where user_id=auth.uid() and revoked_at is null;
create view public.my_admin_permissions with (security_barrier=true) as
  select permission_code,granted_at from public.admin_permission_grants
  where admin_user_id=auth.uid() and revoked_at is null;
create view public.authorized_audit_log with (security_barrier=true) as
  select id,actor_user_id,action_code,target_table,target_id,reason,request_id,created_at
  from public.audit_log where private.has_role('super_admin') or private.has_permission('audit.read');
create view public.my_admin_invitations with (security_barrier=true) as
  select id,invited_role,invited_by,accepted_user_id,created_at,expires_at,revoked_at,accepted_at,reason
  from public.admin_invitations where private.has_role('super_admin');
create view public.recruiter_candidate_interests with (security_barrier=true) as
  select i.user_id,a.code,a.label from public.participant_interests i
  join public.interest_areas a on a.id=i.interest_area_id and a.active
  where private.can_recruiter_view(i.user_id,'interests');
create view public.my_recruiter_notes with (security_barrier=true) as
  select id,candidate_user_id,note,created_at,updated_at from public.recruiter_notes
  where recruiter_user_id=auth.uid() and private.has_role('recruiter')
    and private.can_recruiter_view(candidate_user_id,'candidate_profile');
create view public.my_candidate_shortlists with (security_barrier=true) as
  select s.id,s.candidate_user_id,p.display_name,s.created_at from public.candidate_shortlists s
  join public.profiles p on p.user_id=s.candidate_user_id
  where s.recruiter_user_id=auth.uid() and private.has_role('recruiter')
    and exists(select 1 from public.recruiter_access_grants g where g.recruiter_user_id=auth.uid() and g.permission_code='candidate.shortlist' and g.revoked_at is null)
    and private.can_recruiter_view(s.candidate_user_id,'candidate_profile');
create view public.my_judge_assignments with (security_barrier=true) as
  select a.id,a.submission_id,a.rubric_id,a.assigned_at from public.judge_assignments a
  where a.judge_user_id=auth.uid() and a.revoked_at is null and private.can_judge_submission(a.submission_id);
create view public.my_judge_score_sheet with (security_barrier=true) as
  select e.id evaluation_id,e.assignment_id,c.id criterion_id,c.criterion_code,c.title,c.description,c.maximum_score,
    c.weight_basis_points,s.score,f.feedback_text
  from public.evaluations e join public.judge_assignments a on a.id=e.assignment_id
  join public.evaluation_criteria c on c.rubric_id=e.rubric_id
  left join public.evaluation_scores s on s.evaluation_id=e.id and s.criterion_id=c.id
  left join public.evaluation_feedback f on f.evaluation_id=e.id
  where e.judge_user_id=auth.uid() and e.status='draft' and private.can_judge_submission(a.submission_id);
create view public.my_certificates with (security_barrier=true) as
  select c.id,t.kind,t.name certificate_name,c.issued_at,c.revoked_at,
    (c.public_name_consent_at is not null and c.public_name_revoked_at is null) name_is_public
  from public.certificates c join public.certificate_types t on t.id=c.certificate_type_id
  where c.recipient_user_id=auth.uid() or (c.recipient_team_id is not null and private.is_team_member(c.recipient_team_id));
create view public.my_notifications with (security_barrier=true) as
  select id,announcement_id,notification_type,resource_type,resource_id,safe_summary,created_at,read_at,archived_at
  from public.notifications where user_id=auth.uid();
create view public.my_team_discussion_messages with (security_barrier=true) as
  select d.team_id,m.id,m.author_user_id,m.body,m.created_at,m.edited_at,m.deleted_at
  from public.team_discussions d join public.team_discussion_messages m on m.discussion_id=d.id
  where private.is_team_member(d.team_id) and m.deleted_at is null;
create view public.community_reaction_counts with (security_barrier=true) as
  select r.post_id,r.reaction_code,count(*)::bigint reaction_count from public.community_reactions r
  join public.community_posts p on p.id=r.post_id
  where p.status='published' and (p.visibility='public' or private.has_role('participant'))
  group by r.post_id,r.reaction_code;
-- The new owner needs CREATE on these schemas at OWNER TO time. Keep this
-- grant only for the ownership-transfer statement block, not at runtime.
grant create on schema public,private to incux_rpc_owner;
alter view public.my_profile owner to incux_rpc_owner;
alter view public.my_registration owner to incux_rpc_owner;
alter view public.public_team_directory owner to incux_rpc_owner;
alter view public.my_team_roster owner to incux_rpc_owner;
alter view public.my_teams owner to incux_rpc_owner;
alter view public.current_team_size_policy owner to incux_rpc_owner;
alter view public.current_team_fee owner to incux_rpc_owner;
alter view public.my_payment_summary owner to incux_rpc_owner;
alter view public.recruiter_candidate_directory owner to incux_rpc_owner;
alter view public.recruiter_candidate_skills owner to incux_rpc_owner;
alter view public.recruiter_candidate_links owner to incux_rpc_owner;
alter view public.released_evaluation_projection owner to incux_rpc_owner;
alter view public.my_submission_versions owner to incux_rpc_owner;
alter view public.public_released_projects owner to incux_rpc_owner;
alter view public.public_community_feed owner to incux_rpc_owner;
alter view public.public_announcements owner to incux_rpc_owner;
alter view public.public_schedule owner to incux_rpc_owner;
alter view public.my_role_summary owner to incux_rpc_owner;
alter view public.my_admin_permissions owner to incux_rpc_owner;
alter view public.authorized_audit_log owner to incux_rpc_owner;
alter view public.my_admin_invitations owner to incux_rpc_owner;
alter view public.recruiter_candidate_interests owner to incux_rpc_owner;
alter view public.my_recruiter_notes owner to incux_rpc_owner;
alter view public.my_candidate_shortlists owner to incux_rpc_owner;
alter view public.my_judge_assignments owner to incux_rpc_owner;
alter view public.my_judge_score_sheet owner to incux_rpc_owner;
alter view public.my_certificates owner to incux_rpc_owner;
alter view public.my_notifications owner to incux_rpc_owner;
alter view public.my_team_discussion_messages owner to incux_rpc_owner;
alter view public.community_reaction_counts owner to incux_rpc_owner;
revoke create on schema public,private from incux_rpc_owner;
do $$
begin
  if pg_catalog.has_schema_privilege('incux_rpc_owner','public','CREATE')
     or pg_catalog.has_schema_privilege('incux_rpc_owner','private','CREATE') then
    raise exception 'RPC owner must not retain schema CREATE after view ownership transfer';
  end if;
end $$;
grant select on public.my_profile,public.my_registration,public.public_team_directory,
  public.my_team_roster,public.my_teams,public.current_team_size_policy,public.my_payment_summary,public.recruiter_candidate_directory,public.recruiter_candidate_skills,public.recruiter_candidate_links,
  public.released_evaluation_projection,public.my_submission_versions,public.my_role_summary,public.my_admin_permissions,public.authorized_audit_log,public.my_admin_invitations,public.recruiter_candidate_interests,
  public.my_recruiter_notes,public.my_candidate_shortlists,public.my_judge_assignments,public.my_judge_score_sheet,
  public.current_team_fee,public.my_certificates,public.my_notifications,public.my_team_discussion_messages,public.community_reaction_counts to authenticated;
grant select on public.public_team_directory,public.current_team_size_policy,public.current_team_fee,
  public.public_community_feed,public.public_announcements,public.public_schedule,public.public_released_projects to anon,authenticated;

-- Deferred roster invariant: at commit every forming/locked team has exactly
-- one active leader and a roster within its recorded policy bounds. Team
-- creation and membership RPCs lock the team row before changing membership.
create or replace function private.assert_team_roster(p_team_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
declare t public.teams%rowtype; members integer; leaders integer; lo smallint; hi smallint;
begin
  select * into t from public.teams where id=p_team_id;
  if not found or t.status in ('withdrawn','disqualified') then return; end if;
  select minimum_members,maximum_members into lo,hi from public.team_size_policy_versions
    where id=t.size_policy_version_id;
  select count(*),count(*) filter(where membership_role='leader') into members,leaders
    from public.team_memberships where team_id=p_team_id and left_at is null;
  if leaders<>1 or members<lo or members>hi then
    raise exception 'team roster violates active team policy' using errcode='23514';
  end if;
end $$;

create or replace function private.team_roster_constraint_trigger()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
begin
  if tg_table_name='teams' then
    perform private.assert_team_roster(coalesce(new.id,old.id));
  else
    perform private.assert_team_roster(coalesce(new.team_id,old.team_id));
  end if;
  return null;
end $$;
create constraint trigger teams_roster_invariant
  after insert or update on public.teams deferrable initially deferred
  for each row execute function private.team_roster_constraint_trigger();
create constraint trigger memberships_roster_invariant
  after insert or update or delete on public.team_memberships deferrable initially deferred
  for each row execute function private.team_roster_constraint_trigger();

create or replace function private.check_score_bound()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
declare mx numeric;
begin
  select maximum_score into mx from public.evaluation_criteria
    where id=new.criterion_id and rubric_id=new.rubric_id;
  if mx is null or new.score<0 or new.score>mx then
    raise exception 'score is outside criterion bounds' using errcode='23514';
  end if;
  return new;
end $$;
create trigger evaluation_score_bound before insert or update on public.evaluation_scores
  for each row execute function private.check_score_bound();

create or replace function private.guard_published_rubric()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
declare total_weight integer; criterion_count integer;
begin
  if tg_table_name='evaluation_rubrics' then
    if old.status<>'draft' then raise exception 'published rubric is immutable'; end if;
    if new.status='published' then
      select coalesce(sum(weight_basis_points),0),count(*) into total_weight,criterion_count
        from public.evaluation_criteria where rubric_id=new.id;
      if criterion_count=0 or total_weight<>10000 then
        raise exception 'published rubric must have criteria totaling 10000 basis points';
      end if;
      new.published_at=coalesce(new.published_at,now());
    end if;
  else
    if exists(select 1 from public.evaluation_rubrics r where r.id=coalesce(new.rubric_id,old.rubric_id) and r.status<>'draft') then
      raise exception 'criteria for a published rubric are immutable';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger rubric_immutable before update on public.evaluation_rubrics
  for each row execute function private.guard_published_rubric();
create trigger criteria_immutable before insert or update or delete on public.evaluation_criteria
  for each row execute function private.guard_published_rubric();

create or replace function private.check_comment_parent()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
begin
  if new.parent_comment_id is not null and not exists(
    select 1 from public.community_comments p where p.id=new.parent_comment_id and p.post_id=new.post_id
  ) then raise exception 'parent comment must belong to the same post' using errcode='23514'; end if;
  if new.parent_comment_id=new.id then raise exception 'comment cannot parent itself' using errcode='23514'; end if;
  if new.parent_comment_id is not null and exists(
    with recursive ancestors(id,parent_comment_id) as (
      select id,parent_comment_id from public.community_comments where id=new.parent_comment_id
      union all select c.id,c.parent_comment_id from public.community_comments c join ancestors a on c.id=a.parent_comment_id
    ) select 1 from ancestors where id=new.id
  ) then raise exception 'comment parent cycle is not allowed' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger comment_parent_valid before insert or update on public.community_comments
  for each row execute function private.check_comment_parent();

create or replace function private.check_moderation_target()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
declare rp uuid; rc uuid;
begin
  if new.report_id is not null then
    select post_id,comment_id into rp,rc from public.community_reports where id=new.report_id;
    if (new.post_id,new.comment_id) is distinct from (rp,rc) then
      raise exception 'moderation target must match reported content' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger moderation_target_valid before insert or update on public.moderation_actions
  for each row execute function private.check_moderation_target();

-- Team lifecycle RPCs. Each locks the team row; deferred roster constraints
-- validate the final state at commit. No client receives base-table write grants.
create or replace function public.team_create(p_name text,p_slug text,p_description text,p_member_ids uuid[])
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_team uuid; v_policy public.team_size_policy_versions%rowtype; v_count integer;
begin
  if auth.uid() is null or not private.has_role('participant') then raise exception 'participant role required'; end if;
  if p_member_ids is null or not (auth.uid()=any(p_member_ids)) then raise exception 'creator must be in initial roster'; end if;
  select * into v_policy from public.team_size_policy_versions
    where effective_at<=now() order by effective_at desc limit 1;
  if not found then raise exception 'team size policy is not configured'; end if;
  select count(distinct x) into v_count from unnest(p_member_ids) x;
  if v_count<v_policy.minimum_members or v_count>v_policy.maximum_members then raise exception 'initial roster outside policy'; end if;
  if (select count(distinct g.user_id) from public.user_role_grants g where g.user_id=any(p_member_ids)
      and g.role='participant' and g.revoked_at is null)<>v_count then raise exception 'every initial member must have an active participant role'; end if;
  insert into public.teams(name,slug,description,created_by,size_policy_version_id)
    values(p_name,p_slug,p_description,auth.uid(),v_policy.id) returning id into v_team;
  insert into public.team_memberships(team_id,user_id,membership_role)
    select v_team,x,case when x=auth.uid() then 'leader'::public.membership_role else 'member'::public.membership_role end
    from (select distinct unnest(p_member_ids) x) roster;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'team.created','teams',v_team::text,'Initial team and leader roster created atomically');
  return v_team;
end $$;

create or replace function public.team_join(p_team_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_team public.teams%rowtype; v_count integer; v_max smallint;
begin
  if auth.uid() is null or not private.has_role('participant') then raise exception 'participant role required'; end if;
  select * into v_team from public.teams where id=p_team_id for update;
  if not found or v_team.status<>'forming' then raise exception 'team is not open'; end if;
  if exists(select 1 from public.team_payment_orders where team_id=p_team_id and status in ('pending','paid')) then raise exception 'team roster is locked by payment'; end if;
  if exists(select 1 from public.team_memberships where user_id=auth.uid() and left_at is null) then raise exception 'participant already has an active team'; end if;
  select maximum_members into v_max from public.team_size_policy_versions where id=v_team.size_policy_version_id;
  select count(*) into v_count from public.team_memberships where team_id=p_team_id and left_at is null;
  if v_count>=v_max then raise exception 'team is full'; end if;
  insert into public.team_memberships(team_id,user_id,membership_role) values(p_team_id,auth.uid(),'member');
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id) values(auth.uid(),'team.member_joined','teams',p_team_id::text);
end $$;

create or replace function public.team_request_join(p_team_id uuid,p_message text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not private.has_role('participant') then raise exception 'participant role required'; end if;
  if exists(select 1 from public.team_memberships where user_id=auth.uid() and left_at is null) then raise exception 'participant already has an active team'; end if;
  if not exists(select 1 from public.teams where id=p_team_id and status='forming' and discoverable) then raise exception 'team is not discoverable'; end if;
  insert into public.team_join_requests(team_id,requester_user_id,message) values(p_team_id,auth.uid(),p_message) returning id into v_id;
  return v_id;
end $$;

create or replace function public.team_decide_join_request(p_request_id uuid,p_accept boolean,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare r public.team_join_requests%rowtype; t public.teams%rowtype; n integer; mx smallint;
begin
  select * into r from public.team_join_requests where id=p_request_id for update;
  if not found or r.status<>'pending' then raise exception 'pending join request required'; end if;
  select * into t from public.teams where id=r.team_id for update;
  if not private.is_team_leader(t.id) or t.status<>'forming' or exists(select 1 from public.team_payment_orders where team_id=t.id and status in ('pending','paid')) then raise exception 'active leader and open roster required'; end if;
  if p_accept then
    if not exists(select 1 from public.user_role_grants where user_id=r.requester_user_id and role='participant' and revoked_at is null) then raise exception 'registered participant required'; end if;
    if exists(select 1 from public.team_memberships where user_id=r.requester_user_id and left_at is null) then raise exception 'requester already has an active team'; end if;
    select maximum_members into mx from public.team_size_policy_versions where id=t.size_policy_version_id;
    select count(*) into n from public.team_memberships where team_id=t.id and left_at is null;
    if n>=mx then raise exception 'team is full'; end if;
    insert into public.team_memberships(team_id,user_id,membership_role) values(t.id,r.requester_user_id,'member');
  end if;
  update public.team_join_requests set status=case when p_accept then 'accepted'::public.join_request_state else 'rejected'::public.join_request_state end,
    decided_at=now(),decided_by=auth.uid() where id=r.id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),case when p_accept then 'team.join_request_accepted' else 'team.join_request_rejected' end,'team_join_requests',r.id::text,p_reason);
end $$;

create or replace function public.team_invite_member(p_team_id uuid,p_invited_user_id uuid)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found or not private.is_team_leader(p_team_id) or not exists(select 1 from public.user_role_grants where user_id=p_invited_user_id and role='participant' and revoked_at is null) then raise exception 'leader and registered participant required'; end if;
  if exists(select 1 from public.team_memberships where user_id=p_invited_user_id and left_at is null) then raise exception 'participant already has an active team'; end if;
  if exists(select 1 from public.teams where id=p_team_id and status<>'forming') or exists(select 1 from public.team_payment_orders where team_id=p_team_id and status in ('pending','paid')) then raise exception 'team roster is locked'; end if;
  insert into public.team_invitations(team_id,invited_by,invited_user_id,expires_at)
    values(p_team_id,auth.uid(),p_invited_user_id,now()+interval '7 days') returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id) values(auth.uid(),'team.invitation_created','team_invitations',v_id::text);
  return v_id;
end $$;

create or replace function public.team_accept_invitation(p_invitation_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_inv public.team_invitations%rowtype; v_team public.teams%rowtype; v_count integer; v_max smallint;
begin
  select * into v_inv from public.team_invitations where id=p_invitation_id for update;
  if not found or v_inv.status<>'pending' or v_inv.expires_at<=now() or v_inv.invited_user_id<>auth.uid() then raise exception 'invitation is unavailable'; end if;
  select * into v_team from public.teams where id=v_inv.team_id for update;
  if not private.has_role('participant') or v_team.status<>'forming' or exists(select 1 from public.team_payment_orders where team_id=v_team.id and status in ('pending','paid')) then raise exception 'eligible participant and open team required'; end if;
  if exists(select 1 from public.team_memberships where user_id=auth.uid() and left_at is null) then raise exception 'participant already has an active team'; end if;
  select maximum_members into v_max from public.team_size_policy_versions where id=v_team.size_policy_version_id;
  select count(*) into v_count from public.team_memberships where team_id=v_team.id and left_at is null;
  if v_count>=v_max then raise exception 'team is full'; end if;
  insert into public.team_memberships(team_id,user_id,membership_role) values(v_team.id,auth.uid(),'member');
  update public.team_invitations set status='accepted',responded_at=now() where id=v_inv.id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id) values(auth.uid(),'team.invitation_accepted','team_invitations',v_inv.id::text);
end $$;

create or replace function public.team_respond_invitation(p_invitation_id uuid,p_accept boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare i public.team_invitations%rowtype;
begin
  if p_accept then perform public.team_accept_invitation(p_invitation_id); return; end if;
  update public.team_invitations set status='declined',responded_at=now()
    where id=p_invitation_id and invited_user_id=auth.uid() and status='pending' and expires_at>now()
    returning * into i;
  if not found then raise exception 'pending invitation for this user required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'team.invitation_declined','team_invitations',i.id::text,'Invitee declined invitation');
end $$;

create or replace function public.team_revoke_invitation(p_invitation_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare i public.team_invitations%rowtype;
begin
  select * into i from public.team_invitations where id=p_invitation_id for update;
  if not found or i.status<>'pending' or not private.is_team_leader(i.team_id) or exists(select 1 from public.team_payment_orders where team_id=i.team_id and status in ('pending','paid')) then raise exception 'pending invitation and open team leader required'; end if;
  update public.team_invitations set status='revoked',responded_at=now() where id=i.id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'team.invitation_revoked','team_invitations',i.id::text,p_reason);
end $$;

create or replace function public.team_withdraw_join_request(p_request_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if length(btrim(p_reason))=0 then raise exception 'withdrawal reason required'; end if;
  update public.team_join_requests set status='withdrawn',decided_at=now(),decided_by=auth.uid()
    where id=p_request_id and requester_user_id=auth.uid() and status='pending';
  if not found then raise exception 'pending request by this user required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'team.join_request_withdrawn','team_join_requests',p_request_id::text,p_reason);
end $$;

create or replace function public.team_expire_pending_workflows()
returns integer language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare changed integer:=0; n integer;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  update public.team_invitations set status='expired',responded_at=now()
    where status='pending' and expires_at<=now(); get diagnostics n=row_count; changed:=changed+n;
  update public.team_join_requests set status='expired',decided_at=now(),decided_by=null
    where status='pending' and expires_at<=now(); get diagnostics n=row_count; changed:=changed+n;
  return changed;
end $$;

create or replace function public.team_remove_member(p_team_id uuid,p_user_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found or length(btrim(p_reason))=0 or not private.is_team_leader(p_team_id) or p_user_id=auth.uid() or exists(select 1 from public.teams where id=p_team_id and status<>'forming') then raise exception 'leader, reason, and forming team required; transfer or dissolve to leave'; end if;
  if exists(select 1 from public.team_payment_orders where team_id=p_team_id and status in ('pending','paid')) then raise exception 'paid or pending team roster requires Super Admin exception'; end if;
  update public.team_memberships set left_at=now(),left_reason=p_reason
    where team_id=p_team_id and user_id=p_user_id and left_at is null and membership_role='member';
  if not found then raise exception 'active member not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'team.member_removed','team_memberships',p_team_id::text,p_reason);
end $$;

create or replace function public.team_transfer_leader(p_team_id uuid,p_new_leader uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_old_leader uuid;
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found or length(btrim(p_reason))=0 or not private.is_team_leader(p_team_id) or exists(select 1 from public.teams where id=p_team_id and status<>'forming') then raise exception 'active leader, reason, and forming team required'; end if;
  if exists(select 1 from public.team_payment_orders where team_id=p_team_id and status in ('pending','paid')) then raise exception 'roster locked during or after payment'; end if;
  if not exists(select 1 from public.team_memberships where team_id=p_team_id and user_id=p_new_leader and left_at is null) then raise exception 'new leader must be an active member'; end if;
  select user_id into v_old_leader from public.team_memberships where team_id=p_team_id and membership_role='leader' and left_at is null;
  update public.team_memberships set membership_role='member' where team_id=p_team_id and user_id=auth.uid() and left_at is null;
  update public.team_memberships set membership_role='leader' where team_id=p_team_id and user_id=p_new_leader and left_at is null;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,before_data,after_data)
    values(auth.uid(),'team.leader_transferred','teams',p_team_id::text,p_reason,
      jsonb_build_object('leader_user_id',v_old_leader),jsonb_build_object('leader_user_id',p_new_leader));
end $$;

create or replace function public.team_dissolve(p_team_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found or length(btrim(p_reason))=0 or (not private.is_team_leader(p_team_id) and not private.has_role('super_admin')) then raise exception 'leader or Super Admin and reason required'; end if;
  if exists(select 1 from public.team_payment_orders where team_id=p_team_id and status='pending') then raise exception 'pending payment must be resolved before dissolution'; end if;
  if exists(select 1 from public.team_payment_orders where team_id=p_team_id and status='paid') and not private.has_role('super_admin') then raise exception 'paid team dissolution requires Super Admin'; end if;
  update public.teams set status='withdrawn',withdrawn_at=now(),updated_at=now() where id=p_team_id;
  update public.team_memberships set left_at=now(),left_reason=p_reason where team_id=p_team_id and left_at is null;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'team.dissolved','teams',p_team_id::text,p_reason);
end $$;

create or replace function public.team_lock_roster(p_team_id uuid,p_lock boolean,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_permission('team.policy.configure') then raise exception 'team policy permission required'; end if;
  perform 1 from public.teams where id=p_team_id for update;
  if p_lock then update public.teams set status='locked',locked_at=now() where id=p_team_id and status='forming';
  else
    if exists(select 1 from public.team_payment_orders where team_id=p_team_id and status in ('pending','paid')) then raise exception 'payment lock cannot be manually cleared'; end if;
    update public.teams set status='forming',locked_at=null where id=p_team_id and status='locked';
  end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),case when p_lock then 'team.roster_locked' else 'team.roster_unlocked' end,'teams',p_team_id::text,p_reason);
end $$;

create or replace function public.team_post_payment_exception(p_team_id uuid,p_action text,p_user_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare t public.teams%rowtype; n integer; mx smallint; v_old_leader uuid;
begin
  if not private.has_role('super_admin') or p_reason is null or length(btrim(p_reason))=0 then raise exception 'Super Admin and reason required'; end if;
  select * into t from public.teams where id=p_team_id for update;
  if not found or not exists(select 1 from public.team_payment_orders where team_id=p_team_id and status='paid') then raise exception 'paid team required'; end if;
  if p_action='add_member' then
    if not exists(select 1 from public.user_role_grants where user_id=p_user_id and role='participant' and revoked_at is null) then raise exception 'participant role required'; end if;
    if exists(select 1 from public.team_memberships where user_id=p_user_id and left_at is null) then raise exception 'participant already has an active team'; end if;
    select maximum_members into mx from public.team_size_policy_versions where id=t.size_policy_version_id;
    select count(*) into n from public.team_memberships where team_id=p_team_id and left_at is null;
    if n>=mx then raise exception 'team would exceed recorded size limit'; end if;
    insert into public.team_memberships(team_id,user_id,membership_role) values(p_team_id,p_user_id,'member');
  elsif p_action='remove_member' then
    update public.team_memberships set left_at=now(),left_reason=p_reason
      where team_id=p_team_id and user_id=p_user_id and left_at is null and membership_role='member';
    if not found then raise exception 'active non-leader member not found'; end if;
  elsif p_action='transfer_leader' then
    if not exists(select 1 from public.team_memberships where team_id=p_team_id and user_id=p_user_id and left_at is null) then raise exception 'new leader must be an active member'; end if;
    select user_id into v_old_leader from public.team_memberships where team_id=p_team_id and membership_role='leader' and left_at is null;
    update public.team_memberships set membership_role='member' where team_id=p_team_id and membership_role='leader' and left_at is null;
    update public.team_memberships set membership_role='leader' where team_id=p_team_id and user_id=p_user_id and left_at is null;
  else raise exception 'unsupported post-payment exception'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,before_data,after_data)
    values(auth.uid(),'team.post_payment_roster_exception','teams',p_team_id::text,p_reason,
      case when p_action='transfer_leader' then jsonb_build_object('leader_user_id',v_old_leader)
           else jsonb_build_object('team_status',t.status) end,
      jsonb_build_object('action',p_action,'user_id',p_user_id));
end $$;

create or replace function public.team_policy_set(p_min smallint,p_max smallint,p_effective_at timestamptz,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_permission('team.policy.configure') then raise exception 'team policy permission required'; end if;
  if p_min<1 or p_max<p_min or p_effective_at<=now() or length(btrim(p_reason))=0 then raise exception 'invalid team-size policy'; end if;
  perform pg_advisory_xact_lock(hashtext('incux-team-policy'));
  if exists(select 1 from public.team_size_policy_versions where effective_at>=p_effective_at) then raise exception 'new team policy must follow the latest version'; end if;
  insert into public.team_size_policy_versions(version_number,minimum_members,maximum_members,effective_at,created_by,reason)
    select coalesce(max(version_number),0)+1,p_min,p_max,p_effective_at,auth.uid(),p_reason
      from public.team_size_policy_versions returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'team.policy_created','team_size_policy_versions',v_id::text,p_reason);
  return v_id;
end $$;

create or replace function public.admin_grant_role(p_user_id uuid,p_role public.app_role,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('super_admin') or p_reason is null or length(btrim(p_reason))=0 then raise exception 'Super Admin and reason required'; end if;
  if p_user_id=auth.uid() then raise exception 'self-grant is forbidden'; end if;
  if p_role in ('judge','recruiter') and exists(select 1 from public.user_role_grants where user_id=p_user_id and role in ('judge','recruiter') and revoked_at is null and role<>p_role) then
    raise exception 'judge/recruiter role combination is not allowed';
  end if;
  insert into public.user_role_grants(user_id,role,granted_by,reason) values(p_user_id,p_role,auth.uid(),p_reason) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'access.role_granted','user_role_grants',v_id::text,p_reason);
  return v_id;
end $$;

create or replace function public.admin_revoke_role(p_grant_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_role('super_admin') or p_reason is null or length(btrim(p_reason))=0 then raise exception 'Super Admin and reason required'; end if;
  update public.user_role_grants set revoked_by=auth.uid(),revoked_at=now(),reason=p_reason
    where id=p_grant_id and revoked_at is null and user_id<>auth.uid();
  if not found then raise exception 'active non-self grant not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'access.role_revoked','user_role_grants',p_grant_id::text,p_reason);
end $$;

create or replace function public.admin_grant_permission(p_admin_id uuid,p_code text,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('super_admin') or p_reason is null or length(btrim(p_reason))=0 then raise exception 'Super Admin and reason required'; end if;
  if p_admin_id=auth.uid() or not exists(select 1 from public.user_role_grants where user_id=p_admin_id and role='admin' and revoked_at is null) then raise exception 'different active Admin target required'; end if;
  insert into public.admin_permission_grants(admin_user_id,permission_code,granted_by,reason)
    values(p_admin_id,p_code,auth.uid(),p_reason) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'access.permission_granted','admin_permission_grants',v_id::text,p_reason);
  return v_id;
end $$;

create or replace function public.admin_revoke_permission(p_grant_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_role('super_admin') or p_reason is null or length(btrim(p_reason))=0 then raise exception 'Super Admin and reason required'; end if;
  update public.admin_permission_grants set revoked_by=auth.uid(),revoked_at=now(),reason=p_reason
    where id=p_grant_id and revoked_at is null and admin_user_id<>auth.uid();
  if not found then raise exception 'active permission grant not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'access.permission_revoked','admin_permission_grants',p_grant_id::text,p_reason);
end $$;

create or replace function public.admin_grant_recruiter_access(p_recruiter_id uuid,p_code text,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('super_admin') then raise exception 'Super Admin required'; end if;
  if not exists(select 1 from public.user_role_grants where user_id=p_recruiter_id and role='recruiter' and revoked_at is null) then raise exception 'active Recruiter role required'; end if;
  insert into public.recruiter_access_grants(recruiter_user_id,permission_code,granted_by,reason)
    values(p_recruiter_id,p_code,auth.uid(),p_reason) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'recruiter.access_granted','recruiter_access_grants',v_id::text,p_reason);
  return v_id;
end $$;

create or replace function public.admin_revoke_recruiter_access(p_grant_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_role('super_admin') then raise exception 'Super Admin required'; end if;
  update public.recruiter_access_grants set revoked_by=auth.uid(),revoked_at=now(),reason=p_reason
    where id=p_grant_id and revoked_at is null;
  if not found then raise exception 'active recruiter grant not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'recruiter.access_revoked','recruiter_access_grants',p_grant_id::text,p_reason);
end $$;

create or replace function public.admin_set_recruiter_consent_version(p_scope text,p_version text,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_permission('recruitment.consent.configure') then raise exception 'consent configuration permission required'; end if;
  if p_scope not in ('candidate_profile','skills','interests','profile_links') or length(btrim(p_version))=0 or length(btrim(p_reason))=0 then
    raise exception 'valid consent scope, version, and reason required';
  end if;
  insert into public.recruiter_consent_requirements(consent_scope,required_version,changed_by,reason)
    values(p_scope,p_version,auth.uid(),p_reason)
    on conflict(consent_scope) do update set required_version=excluded.required_version,
      changed_by=excluded.changed_by,changed_at=now(),reason=excluded.reason;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
    values(auth.uid(),'recruiter.consent_version_changed','recruiter_consent_requirements',p_scope,p_reason,
      jsonb_build_object('version',p_version));
end $$;

create or replace function public.admin_transfer_super_admin(p_current_user_id uuid,p_new_user_id uuid,p_operator_user_id uuid,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_old uuid; v_new uuid;
begin
  if auth.role()<>'service_role' or p_operator_user_id is null or p_current_user_id=p_new_user_id or p_reason is null or length(btrim(p_reason))=0 then raise exception 'trusted operator, reason, and different successor required'; end if;
  perform pg_advisory_xact_lock(hashtext('incux-super-admin-transfer'));
  update public.user_role_grants set revoked_by=p_operator_user_id,revoked_at=now(),reason=p_reason
    where user_id=p_current_user_id and role='super_admin' and revoked_at is null returning id into v_old;
  if v_old is null then raise exception 'active Super Admin grant not found'; end if;
  insert into public.user_role_grants(user_id,role,granted_by,reason)
    values(p_new_user_id,'super_admin',p_operator_user_id,p_reason) returning id into v_new;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,before_data,after_data)
    values(p_operator_user_id,'access.super_admin_transferred','user_role_grants',v_new::text,p_reason,
      jsonb_build_object('revoked_grant_id',v_old),jsonb_build_object('new_grant_id',v_new));
  return v_new;
end $$;

create or replace function public.payment_set_gateway_order(p_order_id uuid,p_gateway_order_id text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  if p_gateway_order_id is null or length(btrim(p_gateway_order_id))=0 then raise exception 'gateway order identifier required'; end if;
  if exists(select 1 from public.team_payment_orders where id=p_order_id and status='pending' and gateway_order_id=p_gateway_order_id) then return; end if;
  update public.team_payment_orders set gateway_order_id=p_gateway_order_id
    where id=p_order_id and status='pending' and gateway_order_id is null;
  if not found then raise exception 'pending order without gateway order required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(null,'payment.gateway_order_created','team_payment_orders',p_order_id::text,'Gateway ID recorded by trusted Edge Function');
end $$;

create or replace function private.log_state_transition()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id text; v_old jsonb; v_new jsonb;
begin
  if tg_op='DELETE' then return old; end if;
  v_id:=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id',to_jsonb(new)->>'team_id');
  v_old:=case when tg_op='INSERT' then null else jsonb_build_object(
    'status',to_jsonb(old)->'status','revoked_at',to_jsonb(old)->'revoked_at','left_at',to_jsonb(old)->'left_at',
    'membership_role',to_jsonb(old)->'membership_role') end;
  v_new:=jsonb_build_object('status',to_jsonb(new)->'status','revoked_at',to_jsonb(new)->'revoked_at','left_at',to_jsonb(new)->'left_at',
    'membership_role',to_jsonb(new)->'membership_role');
  if v_old is distinct from v_new then
    insert into public.audit_log(actor_user_id,action_code,target_table,target_id,before_data,after_data)
      values(auth.uid(),'state.transition',tg_table_name,v_id,v_old,v_new);
  end if;
  return new;
end $$;
create trigger audit_registration_state after insert or update on public.participant_registrations for each row execute function private.log_state_transition();
create trigger audit_team_state after insert or update on public.teams for each row execute function private.log_state_transition();
create trigger audit_membership_state after insert or update on public.team_memberships for each row execute function private.log_state_transition();
create trigger audit_invitation_state after insert or update on public.team_invitations for each row execute function private.log_state_transition();
create trigger audit_join_state after insert or update on public.team_join_requests for each row execute function private.log_state_transition();
create trigger audit_payment_order_state after insert or update on public.team_payment_orders for each row execute function private.log_state_transition();
create trigger audit_payment_transaction after insert or update on public.payment_transactions for each row execute function private.log_state_transition();
create trigger audit_refund_state after insert or update on public.payment_refunds for each row execute function private.log_state_transition();
create trigger audit_submission_state after insert or update on public.team_submissions for each row execute function private.log_state_transition();
create trigger audit_community_post_state after insert or update on public.community_posts for each row execute function private.log_state_transition();
create trigger audit_community_comment_state after insert or update on public.community_comments for each row execute function private.log_state_transition();
create trigger audit_report_state after insert or update on public.community_reports for each row execute function private.log_state_transition();
create trigger audit_evaluation_state after insert or update on public.evaluations for each row execute function private.log_state_transition();
create trigger audit_certificate_state after insert or update on public.certificates for each row execute function private.log_state_transition();

-- Immutability guards supplement revoked client privileges and RPC state
-- transitions. A paid order can change only its state/audit fields; its amount,
-- payer, team, fee version, expiry, and gateway order key stay fixed.
create or replace function private.guard_payment_order_update()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
begin
  if (new.team_id,new.payer_user_id,new.fee_config_version_id,new.amount_paise,new.currency,new.gateway_name,
      new.created_at,new.expires_at,new.idempotency_key)
    is distinct from
     (old.team_id,old.payer_user_id,old.fee_config_version_id,old.amount_paise,old.currency,old.gateway_name,
      old.created_at,old.expires_at,old.idempotency_key) then raise exception 'payment order snapshot is immutable'; end if;
  if old.gateway_order_id is not null and new.gateway_order_id is distinct from old.gateway_order_id then raise exception 'gateway order id is immutable'; end if;
  if old.status<>'pending' and (new.status,new.paid_at,new.cancelled_at,new.failed_at,new.expired_at,new.failure_code,new.successful_transaction_id,new.successful_transaction_status,new.successful_transaction_applied)
      is distinct from (old.status,old.paid_at,old.cancelled_at,old.failed_at,old.expired_at,old.failure_code,old.successful_transaction_id,old.successful_transaction_status,old.successful_transaction_applied) then
    raise exception 'terminal payment order is immutable';
  end if;
  return new;
end $$;
create trigger payment_order_guard before update on public.team_payment_orders for each row execute function private.guard_payment_order_update();

create or replace function private.reject_financial_fact_mutation()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$ begin raise exception 'financial history rows are append-only'; end $$;
create trigger fee_version_immutable before update or delete on public.team_fee_config_versions for each row execute function private.reject_financial_fact_mutation();
create trigger fee_cancel_immutable before update or delete on public.team_fee_config_cancellations for each row execute function private.reject_financial_fact_mutation();
create or replace function private.guard_transaction_update()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
begin
  if (new.id,new.payment_order_id,new.gateway_name,new.gateway_transaction_id,new.amount_paise,new.currency,new.verified_at,new.created_at)
     is distinct from
     (old.id,old.payment_order_id,old.gateway_name,old.gateway_transaction_id,old.amount_paise,old.currency,old.verified_at,old.created_at)
    or old.status<>'failed' or new.status<>'succeeded'
    or (old.applied_to_order and not new.applied_to_order) then
    raise exception 'only verified failed-to-succeeded transaction reconciliation is allowed';
  end if;
  return new;
end $$;
create trigger transaction_status_reconcile before update on public.payment_transactions for each row execute function private.guard_transaction_update();
create trigger transaction_immutable_delete before delete on public.payment_transactions for each row execute function private.reject_financial_fact_mutation();
create trigger receipt_immutable before update or delete on public.payment_receipts for each row execute function private.reject_financial_fact_mutation();
create trigger audit_log_append_only before update or delete on public.audit_log for each row execute function private.reject_financial_fact_mutation();

create or replace function private.guard_refund_transition()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
begin
  if (new.payment_order_id,new.payment_transaction_id,new.gateway_name,new.amount_paise,new.currency,new.requested_by,new.reason,new.requested_at)
      is distinct from (old.payment_order_id,old.payment_transaction_id,old.gateway_name,old.amount_paise,old.currency,old.requested_by,old.reason,old.requested_at) then
    raise exception 'refund request facts are immutable';
  end if;
  if not ((old.status='requested' and new.status in ('processing','succeeded','failed','cancelled'))
       or (old.status='processing' and new.status in ('succeeded','failed','cancelled'))) then
    raise exception 'invalid refund state transition';
  end if;
  return new;
end $$;
create trigger refund_transition_guard before update on public.payment_refunds for each row execute function private.guard_refund_transition();

-- Fee versions are inserted only by this function. The prior amount is copied
-- for audit; orders retain their immutable FK+amount snapshot. New orders use
-- the latest effective, uncancelled version; default lifetime is 24 hours.
-- The 24-hour interval is a provisional product/configuration default, not an
-- approved immutable event value; confirm or change it before implementation.
create or replace function public.payment_set_fee(p_amount_paise bigint,p_effective_at timestamptz,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_old bigint; v_id uuid;
begin
  if not private.has_permission('payment.fee.configure') then raise exception 'fee configuration permission required'; end if;
  if p_amount_paise<=0 or p_effective_at<=now() or length(btrim(p_reason))=0 then raise exception 'invalid fee version'; end if;
  perform pg_advisory_xact_lock(hashtext('incux-fee-version'));
  select amount_paise into v_old from public.team_fee_config_versions
    where effective_at<p_effective_at and not exists(select 1 from public.team_fee_config_cancellations c where c.fee_config_version_id=id)
    order by effective_at desc limit 1;
  if exists(select 1 from public.team_fee_config_versions where effective_at>=p_effective_at) then raise exception 'new fee version must follow the latest version'; end if;
  insert into public.team_fee_config_versions(version_number,old_amount_paise,amount_paise,currency,effective_at,created_by,reason)
    select coalesce(max(version_number),0)+1,v_old,p_amount_paise,'INR',p_effective_at,auth.uid(),p_reason
    from public.team_fee_config_versions returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,before_data,after_data)
    values(auth.uid(),'payment.fee_changed','team_fee_config_versions',v_id::text,p_reason,
      jsonb_build_object('amount_paise',v_old),jsonb_build_object('amount_paise',p_amount_paise,'effective_at',p_effective_at));
  return v_id;
end $$;

create or replace function public.payment_cancel_fee_version(p_fee_version_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_permission('payment.fee.configure') then raise exception 'fee configuration permission required'; end if;
  if not exists(select 1 from public.team_fee_config_versions where id=p_fee_version_id and effective_at>now()) then raise exception 'only a future fee version may be cancelled'; end if;
  insert into public.team_fee_config_cancellations(fee_config_version_id,cancelled_by,reason) values(p_fee_version_id,auth.uid(),p_reason);
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'payment.fee_cancelled','team_fee_config_versions',p_fee_version_id::text,p_reason);
end $$;

create or replace function public.payment_create_order(p_team_id uuid)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_team public.teams%rowtype; v_fee public.team_fee_config_versions%rowtype;
  v_order uuid; v_existing public.team_payment_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_team from public.teams where id=p_team_id for update;
  if not found or not private.is_team_leader(p_team_id) then raise exception 'active team leader required'; end if;
  select * into v_existing from public.team_payment_orders where team_id=p_team_id and status='pending' for update;
  if found then
    if v_existing.expires_at>now() then return v_existing.id; end if;
    update public.team_payment_orders set status='expired',expired_at=now() where id=v_existing.id;
    update public.teams set status='forming',locked_at=null,updated_at=now() where id=p_team_id;
    insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
      values(auth.uid(),'payment.order_expired','team_payment_orders',v_existing.id::text,'Expired during new order request');
    v_team.status:='forming';
  end if;
  if exists(select 1 from public.team_payment_orders where team_id=p_team_id and status='paid') then raise exception 'team already paid'; end if;
  if v_team.status<>'forming' then raise exception 'team roster is locked'; end if;
  perform private.assert_team_roster(p_team_id);
  select * into v_fee from public.team_fee_config_versions f
    where f.effective_at<=now() and not exists(select 1 from public.team_fee_config_cancellations c where c.fee_config_version_id=f.id)
    order by f.effective_at desc limit 1;
  if not found then raise exception 'no active team fee is configured'; end if;
  insert into public.team_payment_orders(team_id,payer_user_id,fee_config_version_id,amount_paise,currency,
      gateway_name,expires_at,idempotency_key)
    values(p_team_id,auth.uid(),v_fee.id,v_fee.amount_paise,v_fee.currency,'razorpay',now()+interval '24 hours',gen_random_uuid()::text)
    returning id into v_order;
  update public.teams set status='locked',locked_at=now(),updated_at=now() where id=p_team_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
    values(auth.uid(),'payment.order_created','team_payment_orders',v_order::text,'24-hour immutable fee snapshot',
      jsonb_build_object('fee_version_id',v_fee.id,'amount_paise',v_fee.amount_paise,'currency',v_fee.currency,'expires_at',now()+interval '24 hours'));
  return v_order;
end $$;

-- Edge Function verifies the provider signature and exact gateway payload
-- before calling this service-role-only RPC. Duplicate event IDs are no-ops.
create or replace function public.payment_record_verified_webhook(
  p_event_id text,p_order_id uuid,p_gateway_order_id text,p_gateway_transaction_id text,
  p_amount_paise bigint,p_currency char(3),p_status public.payment_transaction_state,p_payload_sha256 bytea
) returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_event uuid; v_order public.team_payment_orders%rowtype; v_tx uuid; v_team_id uuid;
  v_existing_tx public.payment_transactions%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  insert into public.payment_webhook_events(gateway_name,gateway_event_id,payment_order_id,payload_sha256,reported_transaction_status,signature_verified_at)
    values('razorpay',p_event_id,p_order_id,p_payload_sha256,p_status,now())
    on conflict(gateway_name,gateway_event_id) do nothing returning id into v_event;
  if v_event is null then
    select id into v_event from public.payment_webhook_events where gateway_name='razorpay' and gateway_event_id=p_event_id;
    if v_event is not null then
      insert into public.payment_webhook_attempts(webhook_event_id,outcome_code,details_digest)
        select v_event,case when payload_sha256=p_payload_sha256 then 'duplicate_event' else 'duplicate_event_digest_mismatch' end,p_payload_sha256
        from public.payment_webhook_events where id=v_event;
    end if;
    return;
  end if;
  select team_id into v_team_id from public.team_payment_orders where id=p_order_id;
  if found then perform 1 from public.teams where id=v_team_id for update; end if;
  select * into v_order from public.team_payment_orders where id=p_order_id for update;
  if not found or v_order.gateway_name<>'razorpay' or v_order.gateway_order_id is null
    or v_order.gateway_order_id<>p_gateway_order_id or v_order.amount_paise<>p_amount_paise or v_order.currency<>p_currency then
    update public.payment_webhook_events set processed_at=now(),processing_result='rejected_order_mismatch' where id=v_event;
    insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'rejected_order_mismatch');
    return;
  end if;
  select * into v_existing_tx from public.payment_transactions
    where gateway_name='razorpay' and gateway_transaction_id=p_gateway_transaction_id for update;
  if found then
    if v_existing_tx.payment_order_id<>v_order.id or v_existing_tx.amount_paise<>p_amount_paise or v_existing_tx.currency<>p_currency then
      update public.payment_webhook_events set processed_at=now(),processing_result='transaction_identity_mismatch' where id=v_event;
      insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'transaction_identity_mismatch');
      return;
    end if;
    if v_existing_tx.status='succeeded' or p_status='failed' then
      update public.payment_webhook_events set processed_at=now(),processing_result='duplicate_or_stale_transaction_event' where id=v_event;
      insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'duplicate_or_stale_transaction_event');
      return;
    end if;
    -- Keep each gateway event immutable. A later verified success may advance
    -- the normalized transaction from failed to succeeded exactly once.
    if v_order.status='pending' and v_order.expires_at>now() then
      update public.payment_transactions set status='succeeded',applied_to_order=true where id=v_existing_tx.id;
      update public.team_payment_orders set status='paid',paid_at=now(),successful_transaction_id=v_existing_tx.id,
        successful_transaction_status='succeeded',successful_transaction_applied=true where id=v_order.id;
      update public.teams set status='locked',locked_at=coalesce(locked_at,now()),updated_at=now() where id=v_order.team_id;
      update public.payment_webhook_events set processed_at=now(),processing_result='reconciled_applied_success' where id=v_event;
      insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'reconciled_applied_success');
    else
      update public.payment_transactions set status='succeeded',applied_to_order=false where id=v_existing_tx.id;
      update public.payment_webhook_events set processed_at=now(),processing_result='reconciled_capture_unapplied' where id=v_event;
      insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'reconciled_capture_unapplied');
    end if;
    insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
      values(null,'payment.transaction_reconciled','payment_transactions',v_existing_tx.id::text,
        'Verified provider status advanced an existing transaction',jsonb_build_object('status','succeeded','applied_to_order',v_order.status='pending' and v_order.expires_at>now()));
    return;
  end if;
  if p_status='succeeded' and v_order.status='pending' and v_order.expires_at>now() then
    insert into public.payment_transactions(payment_order_id,gateway_name,gateway_transaction_id,amount_paise,currency,status,applied_to_order,verified_at)
      values(v_order.id,'razorpay',p_gateway_transaction_id,p_amount_paise,p_currency,'succeeded',true,now()) returning id into v_tx;
    update public.team_payment_orders set status='paid',paid_at=now(),successful_transaction_id=v_tx,
      successful_transaction_status='succeeded',successful_transaction_applied=true where id=v_order.id;
    update public.teams set status='locked',locked_at=coalesce(locked_at,now()),updated_at=now() where id=v_order.team_id;
    update public.payment_webhook_events set processed_at=now(),processing_result='applied_success' where id=v_event;
    insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'applied_success');
  elsif p_status='succeeded' then
    -- Record late or duplicate captured funds as real but unapplied transactions.
    -- They do not mark an order paid or unlock/alter another roster.
    insert into public.payment_transactions(payment_order_id,gateway_name,gateway_transaction_id,amount_paise,currency,status,applied_to_order,verified_at)
      values(v_order.id,'razorpay',p_gateway_transaction_id,p_amount_paise,p_currency,'succeeded',false,now()) returning id into v_tx;
    if v_order.status='pending' and v_order.expires_at<=now() then
      update public.team_payment_orders set status='expired',expired_at=now() where id=v_order.id;
      update public.teams set status='forming',locked_at=null,updated_at=now() where id=v_order.team_id;
    end if;
    update public.payment_webhook_events set processed_at=now(),processing_result='captured_unapplied_review_refund' where id=v_event;
    insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'captured_unapplied_review_refund');
    insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
      values(null,'payment.unapplied_capture','payment_transactions',v_tx::text,'Late or additional captured funds require reconciliation/refund',jsonb_build_object('order_id',v_order.id,'amount_paise',p_amount_paise));
  else
    insert into public.payment_transactions(payment_order_id,gateway_name,gateway_transaction_id,amount_paise,currency,status,verified_at)
      values(v_order.id,'razorpay',p_gateway_transaction_id,p_amount_paise,p_currency,'failed',now()) returning id into v_tx;
    if v_order.status='pending' and v_order.expires_at>now() then
      update public.team_payment_orders set status='failed',failed_at=now(),failure_code='gateway_declined' where id=v_order.id;
      update public.teams set status='forming',locked_at=null,updated_at=now() where id=v_order.team_id;
    elsif v_order.status='pending' then
      update public.team_payment_orders set status='expired',expired_at=now() where id=v_order.id;
      update public.teams set status='forming',locked_at=null,updated_at=now() where id=v_order.team_id;
    end if;
    update public.payment_webhook_events set processed_at=now(),processing_result='verified_failure' where id=v_event;
    insert into public.payment_webhook_attempts(webhook_event_id,outcome_code) values(v_event,'verified_failure');
  end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
    values(null,'payment.webhook_processed','team_payment_orders',v_order.id::text,'Signature verified by server gateway adapter',
      jsonb_build_object('event_id',p_event_id,'transaction_id',v_tx,'status',p_status));
end $$;

-- Expiry is a trusted transition, run by a scheduled server job. It locks the
-- order and team, then releases roster only for a still-pending expired order.
create or replace function public.payment_expire_order(p_order_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_order public.team_payment_orders%rowtype;
  v_team_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select team_id into v_team_id from public.team_payment_orders where id=p_order_id;
  if not found then return; end if;
  perform 1 from public.teams where id=v_team_id for update;
  select * into v_order from public.team_payment_orders where id=p_order_id for update;
  if not found or v_order.status<>'pending' or v_order.expires_at>now() then return; end if;
  update public.team_payment_orders set status='expired',expired_at=now() where id=v_order.id;
  update public.teams set status='forming',locked_at=null,updated_at=now() where id=v_order.team_id
    and not exists(select 1 from public.team_payment_orders where team_id=v_order.team_id and status='paid');
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(null,'payment.order_expired','team_payment_orders',v_order.id::text,'24-hour order expired');
end $$;

create or replace function public.payment_cancel_order(p_order_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare o public.team_payment_orders%rowtype;
  v_team_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  if length(btrim(p_reason))=0 then raise exception 'cancellation reason required'; end if;
  select team_id into v_team_id from public.team_payment_orders where id=p_order_id;
  if not found then raise exception 'pending order required'; end if;
  perform 1 from public.teams where id=v_team_id for update;
  select * into o from public.team_payment_orders where id=p_order_id for update;
  if not found or o.status<>'pending' then raise exception 'pending order required'; end if;
  update public.team_payment_orders set status='cancelled',cancelled_at=now(),failure_code=left(p_reason,120) where id=o.id;
  update public.teams set status='forming',locked_at=null,updated_at=now() where id=o.team_id
    and not exists(select 1 from public.team_payment_orders where team_id=o.team_id and status='paid');
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(null,'payment.order_cancelled','team_payment_orders',o.id::text,p_reason);
end $$;

-- Refund reservation serializes on the order. Requested and processing refunds
-- count against the remaining balance, preventing concurrent over-refunds.
create or replace function public.payment_request_refund(
  p_order_id uuid,p_transaction_id uuid,p_amount_paise bigint,p_reason text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_order public.team_payment_orders%rowtype; v_paid bigint; v_reserved bigint; v_refund uuid;
begin
  if not private.has_permission('payment.refund') then raise exception 'refund permission required'; end if;
  select * into v_order from public.team_payment_orders where id=p_order_id for update;
  if not found then raise exception 'payment order required'; end if;
  if not exists(select 1 from public.payment_transactions t where t.id=p_transaction_id and t.payment_order_id=p_order_id and t.status='succeeded') then raise exception 'successful transaction for this order required'; end if;
  select amount_paise into v_paid from public.payment_transactions where id=p_transaction_id;
  select coalesce(sum(amount_paise),0) into v_reserved from public.payment_refunds
    where payment_transaction_id=p_transaction_id and status not in ('failed','cancelled');
  if p_amount_paise<=0 or p_amount_paise>v_paid-v_reserved or length(btrim(p_reason))=0 then raise exception 'refund exceeds remaining refundable balance'; end if;
  insert into public.payment_refunds(payment_order_id,payment_transaction_id,gateway_name,amount_paise,currency,requested_by,reason)
    values(p_order_id,p_transaction_id,v_order.gateway_name,p_amount_paise,v_order.currency,auth.uid(),p_reason) returning id into v_refund;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
    values(auth.uid(),'payment.refund_requested','payment_refunds',v_refund::text,p_reason,jsonb_build_object('amount_paise',p_amount_paise));
  return v_refund;
end $$;

create or replace function public.payment_finish_refund(p_refund_id uuid,p_gateway_refund_id text,p_succeeded boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_refund public.payment_refunds%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into v_refund from public.payment_refunds where id=p_refund_id for update;
  if not found or v_refund.status<>'requested' then raise exception 'refund is not awaiting gateway result'; end if;
  update public.payment_refunds set status=case when p_succeeded then 'succeeded'::public.refund_state else 'failed'::public.refund_state end,
    gateway_refund_id=p_gateway_refund_id,processed_at=now() where id=p_refund_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
    values(null,'payment.refund_settled','payment_refunds',p_refund_id::text,'Gateway refund result recorded',jsonb_build_object('succeeded',p_succeeded));
end $$;

create or replace function public.payment_issue_receipt(p_order_id uuid,p_receipt_number text,p_storage_path text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare o public.team_payment_orders%rowtype; v_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into o from public.team_payment_orders where id=p_order_id for update;
  if not found or o.status<>'paid' or o.successful_transaction_id is null or o.successful_transaction_applied is not true then raise exception 'successfully paid order required'; end if;
  insert into public.payment_receipts(payment_order_id,payment_transaction_id,receipt_number,storage_object_path)
    values(o.id,o.successful_transaction_id,p_receipt_number,p_storage_path) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(null,'payment.receipt_issued','payment_receipts',v_id::text,'Receipt created for verified paid order');
  return v_id;
end $$;

create or replace function public.recruiter_set_consent(p_scope text,p_consent_version text,p_granted boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if auth.uid() is null or not private.has_role('participant') then raise exception 'participant role required'; end if;
  if p_scope not in ('candidate_profile','skills','interests','profile_links') or length(btrim(p_consent_version))=0 then raise exception 'invalid consent scope/version'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_scope,0));
  if not exists(select 1 from public.recruiter_consent_requirements r where r.consent_scope=p_scope and r.required_version=p_consent_version) then
    raise exception 'consent text version is not current for this scope';
  end if;
  insert into public.recruiter_consent_events(participant_user_id,consent_scope,consent_version,action)
    values(auth.uid(),p_scope,p_consent_version,case when p_granted then 'granted' else 'revoked' end);
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
    values(auth.uid(),case when p_granted then 'recruiter_consent.granted' else 'recruiter_consent.revoked' end,
      'recruiter_consent_events',auth.uid()::text,'Participant consent choice',jsonb_build_object('scope',p_scope,'version',p_consent_version));
end $$;

create or replace function public.recruiter_add_shortlist(p_candidate_id uuid)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('recruiter') or not exists(select 1 from public.recruiter_access_grants g where g.recruiter_user_id=auth.uid() and g.permission_code='candidate.shortlist' and g.revoked_at is null)
    or not private.can_recruiter_view(p_candidate_id,'candidate_profile') then raise exception 'active recruiter grant and candidate consent required'; end if;
  insert into public.candidate_shortlists(recruiter_user_id,candidate_user_id) values(auth.uid(),p_candidate_id)
  on conflict(recruiter_user_id,candidate_user_id) do update set created_at=excluded.created_at returning id into v_id;
  return v_id;
end $$;

create or replace function public.recruiter_save_note(p_candidate_id uuid,p_note text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('recruiter') or not exists(select 1 from public.recruiter_access_grants g where g.recruiter_user_id=auth.uid() and g.permission_code='candidate.note' and g.revoked_at is null)
    or not private.can_recruiter_view(p_candidate_id,'candidate_profile') then raise exception 'active recruiter grant and candidate consent required'; end if;
  insert into public.recruiter_notes(recruiter_user_id,candidate_user_id,note) values(auth.uid(),p_candidate_id,p_note)
  on conflict(recruiter_user_id,candidate_user_id) do update set note=excluded.note,updated_at=now() returning id into v_id;
  return v_id;
end $$;

create or replace function public.community_create_post(p_category_id uuid,p_title text,p_body text,p_visibility public.post_visibility)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('participant') or not exists(select 1 from public.community_categories where id=p_category_id and enabled) then raise exception 'registered participant and enabled category required'; end if;
  insert into public.community_posts(category_id,author_user_id,title,body,visibility,status)
    values(p_category_id,auth.uid(),p_title,p_body,p_visibility,'published') returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'community.post_created','community_posts',v_id::text,'Participant-created post');
  return v_id;
end $$;

create or replace function public.community_create_comment(p_post_id uuid,p_parent_comment_id uuid,p_body text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('participant') or not exists(select 1 from public.community_posts p where p.id=p_post_id and p.status='published') then raise exception 'participant and visible post required'; end if;
  if p_parent_comment_id is not null and not exists(select 1 from public.community_comments c where c.id=p_parent_comment_id and c.post_id=p_post_id and c.status='published') then raise exception 'parent comment must be visible and on this post'; end if;
  insert into public.community_comments(post_id,author_user_id,parent_comment_id,body,status)
    values(p_post_id,auth.uid(),p_parent_comment_id,p_body,'published') returning id into v_id;
  return v_id;
end $$;

create or replace function public.community_report_content(p_post_id uuid,p_comment_id uuid,p_reason_code text,p_details text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_role('participant') or num_nonnulls(p_post_id,p_comment_id)<>1 then raise exception 'participant and exactly one target required'; end if;
  if p_comment_id is not null and not exists(select 1 from public.community_comments where id=p_comment_id and status='published') then raise exception 'visible comment required'; end if;
  if p_post_id is not null and not exists(select 1 from public.community_posts where id=p_post_id and status='published') then raise exception 'visible post required'; end if;
  insert into public.community_reports(reporter_user_id,post_id,comment_id,reason_code,details)
    values(auth.uid(),p_post_id,p_comment_id,p_reason_code,p_details) returning id into v_id;
  return v_id;
end $$;

create or replace function public.team_post_discussion_message(p_team_id uuid,p_body text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare d_id uuid; m_id uuid;
begin
  if not private.is_team_member(p_team_id) or length(btrim(p_body))=0 then raise exception 'active team member and message required'; end if;
  insert into public.team_discussions(team_id) values(p_team_id) on conflict(team_id) do nothing;
  select id into d_id from public.team_discussions where team_id=p_team_id;
  insert into public.team_discussion_messages(discussion_id,author_user_id,body)
    values(d_id,auth.uid(),p_body) returning id into m_id;
  return m_id;
end $$;

create or replace function public.judge_assign_submission(p_judge_id uuid,p_submission_id uuid,p_rubric_id uuid,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_permission('judge.assignment.manage') then raise exception 'assignment permission required'; end if;
  if not exists(select 1 from public.user_role_grants where user_id=p_judge_id and role='judge' and revoked_at is null) then raise exception 'active judge role required'; end if;
  if not exists(select 1 from public.evaluation_rubrics where id=p_rubric_id and status='published') then raise exception 'published rubric required'; end if;
  insert into public.judge_assignments(judge_user_id,submission_id,rubric_id,assigned_by,reason)
    values(p_judge_id,p_submission_id,p_rubric_id,auth.uid(),p_reason) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'judge.assignment_created','judge_assignments',v_id::text,p_reason);
  return v_id;
end $$;

create or replace function public.judge_declare_conflict(p_assignment_id uuid,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare a public.judge_assignments%rowtype; v_id uuid;
begin
  select * into a from public.judge_assignments where id=p_assignment_id for update;
  if not found or a.judge_user_id<>auth.uid() or a.revoked_at is not null or not private.has_role('judge') then raise exception 'current judge assignment required'; end if;
  insert into public.judge_conflicts(assignment_id,judge_user_id,status,confidential_reason)
    values(a.id,auth.uid(),'declared',p_reason) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'judge.conflict_declared','judge_conflicts',v_id::text,'Confidential conflict declaration');
  return v_id;
end $$;

create or replace function public.judge_resolve_conflict(p_conflict_id uuid,p_status public.judge_conflict_state,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare c public.judge_conflicts%rowtype;
begin
  if not private.has_permission('judge.assignment.manage') or p_status not in ('cleared','recused') then raise exception 'assignment permission and terminal conflict resolution required'; end if;
  update public.judge_conflicts set status=p_status,resolved_by=auth.uid(),resolved_at=now(),resolution_reason=p_reason
    where id=p_conflict_id and status='declared' returning * into c;
  if not found then raise exception 'unresolved conflict not found'; end if;
  if p_status='recused' then
    update public.judge_assignments set revoked_at=now(),reason=p_reason where id=c.assignment_id and revoked_at is null;
  end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'judge.conflict_resolved','judge_conflicts',c.id::text,p_reason);
end $$;

create or replace function public.judge_save_score(p_assignment_id uuid,p_criterion_id uuid,p_score numeric,p_feedback text default null)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare a public.judge_assignments%rowtype; e_id uuid;
begin
  select * into a from public.judge_assignments where id=p_assignment_id for update;
  if not found or a.judge_user_id<>auth.uid() or not private.can_judge_submission(a.submission_id) then raise exception 'current unconflicted assignment required'; end if;
  if not exists(select 1 from public.evaluation_criteria where id=p_criterion_id and rubric_id=a.rubric_id) then raise exception 'criterion is outside assigned rubric'; end if;
  insert into public.evaluations(assignment_id,judge_user_id,rubric_id) values(a.id,a.judge_user_id,a.rubric_id)
    on conflict(assignment_id) do update set assignment_id=excluded.assignment_id returning id into e_id;
  if exists(select 1 from public.evaluations where id=e_id and status<>'draft') then raise exception 'submitted evaluation is immutable'; end if;
  insert into public.evaluation_scores(evaluation_id,rubric_id,criterion_id,score)
    values(e_id,a.rubric_id,p_criterion_id,p_score)
    on conflict(evaluation_id,criterion_id) do update set score=excluded.score,updated_at=now();
  if p_feedback is not null then
    insert into public.evaluation_feedback(evaluation_id,feedback_text) values(e_id,p_feedback)
      on conflict(evaluation_id) do update set feedback_text=excluded.feedback_text,updated_at=now();
  end if;
  return e_id;
end $$;

create or replace function public.judge_submit_evaluation(p_evaluation_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare e public.evaluations%rowtype; required_count integer; actual_count integer;
begin
  select * into e from public.evaluations where id=p_evaluation_id for update;
  if not found or e.judge_user_id<>auth.uid() or e.status<>'draft' then raise exception 'owned draft evaluation required'; end if;
  if not private.can_judge_submission((select submission_id from public.judge_assignments where id=e.assignment_id)) then raise exception 'current unconflicted assignment required'; end if;
  select count(*) into required_count from public.evaluation_criteria where rubric_id=e.rubric_id;
  select count(*) into actual_count from public.evaluation_scores where evaluation_id=e.id;
  if required_count=0 or actual_count<>required_count then raise exception 'all rubric criteria must be scored'; end if;
  update public.evaluations set status='submitted',submitted_at=now() where id=e.id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'evaluation.submitted','evaluations',e.id::text,'Judge submitted complete rubric');
end $$;

create or replace function public.submission_save_version(
  p_team_id uuid,p_title text,p_description text,p_repository_url text,p_demo_url text,p_documentation_url text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare s_id uuid; v_id uuid; v_number integer;
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found or not private.is_team_member(p_team_id) then raise exception 'active team member required'; end if;
  if not exists(select 1 from public.team_payment_orders where team_id=p_team_id and status='paid') then raise exception 'paid team required'; end if;
  insert into public.team_submissions(team_id) values(p_team_id) on conflict(team_id) do nothing;
  select id into s_id from public.team_submissions where team_id=p_team_id for update;
  if (select status from public.team_submissions where id=s_id)='finalized' then raise exception 'final submission is locked'; end if;
  select coalesce(max(version_number),0)+1 into v_number from public.submission_versions where submission_id=s_id;
  insert into public.submission_versions(submission_id,version_number,title,project_description,github_repository_url,demo_url,documentation_url,submitted_by)
    values(s_id,v_number,p_title,p_description,p_repository_url,p_demo_url,p_documentation_url,auth.uid()) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,after_data)
    values(auth.uid(),'submission.version_saved','submission_versions',v_id::text,'New immutable submission version',jsonb_build_object('version_number',v_number));
  return v_id;
end $$;

create or replace function public.submission_finalize(p_submission_id uuid,p_version_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare s public.team_submissions%rowtype; v public.submission_versions%rowtype; deadline timestamptz;
begin
  select * into s from public.team_submissions where id=p_submission_id for update;
  if not found or not private.is_team_member(s.team_id) or s.status='finalized' then raise exception 'active team and unfinalized submission required'; end if;
  select deadline_at into deadline from public.event_deadline_versions where deadline_code='submission' order by version_number desc limit 1;
  if deadline is null then raise exception 'submission deadline is not configured'; end if;
  if now()>deadline then raise exception 'submission deadline has passed'; end if;
  select * into v from public.submission_versions where id=p_version_id and submission_id=s.id for update;
  if not found then raise exception 'version does not belong to submission'; end if;
  update public.submission_versions set submitted_at=now(),is_final=true where id=v.id and is_final=false;
  if not found then raise exception 'version already finalized'; end if;
  update public.team_submissions set status='finalized',submitted_at=now(),finalized_at=now(),updated_at=now() where id=s.id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'submission.finalized','team_submissions',s.id::text,'Deadline checked against trusted event configuration');
end $$;

create or replace function public.event_set_submission_deadline(p_deadline_at timestamptz,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_id uuid;
begin
  if not private.has_permission('schedule.manage') or p_deadline_at<=now() then raise exception 'schedule permission and future deadline required'; end if;
  insert into public.event_deadline_versions(deadline_code,version_number,deadline_at,changed_by,reason)
    select 'submission',coalesce(max(version_number),0)+1,p_deadline_at,auth.uid(),p_reason from public.event_deadline_versions where deadline_code='submission'
    returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'event.submission_deadline_changed','event_deadline_versions',v_id::text,p_reason);
  return v_id;
end $$;

create or replace function public.evaluation_release(p_evaluation_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare e public.evaluations%rowtype;
begin
  if not private.has_permission('evaluation.release') then raise exception 'evaluation release permission required'; end if;
  select * into e from public.evaluations where id=p_evaluation_id for update;
  if not found or e.status<>'submitted' then raise exception 'submitted evaluation required'; end if;
  update public.evaluations set status='released',released_at=now() where id=e.id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'evaluation.released','evaluations',e.id::text,p_reason);
end $$;

-- Service-only verifier. The public Edge Function must apply per-source and
-- global abuse controls before invoking this narrow response function. It is
-- deliberately not executable by anon/authenticated, avoiding a direct RPC
-- bypass of edge rate limiting and a database-wide serialization point.
create or replace function public.certificate_verify(p_code text)
returns table(is_valid boolean,certificate_kind public.certificate_kind,display_name text)
language plpgsql security definer
set search_path = pg_catalog, public, private
set row_security = off
as $$
declare c public.certificates%rowtype; v_result text;
begin
  if auth.role()<>'service_role' then raise exception 'service role required'; end if;
  select * into c from public.certificates where verification_code=p_code;
  if not found then
    insert into public.certificate_verifications(certificate_id,result_code) values(null,'not_found');
    return query select false,null::public.certificate_kind,null::text; return;
  end if;
  v_result:=case when c.revoked_at is null then 'valid' else 'revoked' end;
  insert into public.certificate_verifications(certificate_id,result_code) values(c.id,v_result);
  return query select c.revoked_at is null,t.kind,
    case when c.public_name_consent_at is not null and c.public_name_revoked_at is null then c.public_display_name else null end
    from public.certificate_types t where t.id=c.certificate_type_id;
end $$;

create or replace function public.certificate_issue(
  p_type_id uuid,p_recipient_user_id uuid,p_recipient_team_id uuid,p_reason text
) returns text language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare v_code text; v_id uuid;
begin
  if not private.has_permission('certificate.issue') then raise exception 'certificate permission required'; end if;
  if num_nonnulls(p_recipient_user_id,p_recipient_team_id)<>1 then raise exception 'exactly one recipient required'; end if;
  v_code:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.certificates(certificate_type_id,recipient_user_id,recipient_team_id,verification_code,
    public_display_name,public_name_consent_at,issued_by)
    values(p_type_id,p_recipient_user_id,p_recipient_team_id,v_code,null,null,auth.uid()) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'certificate.issued','certificates',v_id::text,p_reason);
  return v_code;
end $$;

create or replace function public.certificate_grant_name_consent(p_certificate_id uuid,p_allow boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare display_name text;
begin
  if p_allow then
    select p.display_name into display_name from public.certificates c join public.profiles p on p.user_id=c.recipient_user_id
      where c.id=p_certificate_id and c.recipient_user_id=auth.uid();
    if display_name is null then raise exception 'individual recipient certificate required'; end if;
    update public.certificates set public_display_name=display_name,public_name_consent_at=now(),public_name_revoked_at=null where id=p_certificate_id;
  else
    update public.certificates set public_name_revoked_at=now() where id=p_certificate_id and recipient_user_id=auth.uid() and public_name_consent_at is not null and public_name_revoked_at is null;
    if not found then raise exception 'consented certificate not found'; end if;
  end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),case when p_allow then 'certificate.public_name_consent_granted' else 'certificate.public_name_consent_revoked' end,
      'certificates',p_certificate_id::text,'Recipient name display preference');
end $$;

create or replace function public.certificate_revoke(p_certificate_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_permission('certificate.issue') or length(btrim(p_reason))=0 then raise exception 'certificate permission and reason required'; end if;
  update public.certificates set revoked_by=auth.uid(),revoked_at=now(),revocation_reason=p_reason
    where id=p_certificate_id and revoked_at is null;
  if not found then raise exception 'active certificate not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'certificate.revoked','certificates',p_certificate_id::text,p_reason);
end $$;

create or replace function public.certificate_revoke_name_consent(p_certificate_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  update public.certificates set public_name_revoked_at=now()
    where id=p_certificate_id and recipient_user_id=auth.uid()
      and public_name_consent_at is not null and public_name_revoked_at is null;
  if not found then raise exception 'consented certificate name not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'certificate.public_name_consent_revoked','certificates',p_certificate_id::text,'Recipient withdrew public name consent');
end $$;

create or replace function public.registration_decide(p_registration_id uuid,p_approve boolean,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if not private.has_permission('registration.manage') then raise exception 'registration permission required'; end if;
  if p_approve then
    insert into public.user_role_grants(user_id,role,granted_by,reason)
      select r.user_id,'participant',auth.uid(),'Approved hackathon registration'
      from public.participant_registrations r where r.id=p_registration_id
        and not exists(select 1 from public.user_role_grants g where g.user_id=r.user_id and g.role='participant' and g.revoked_at is null);
  end if;
  update public.participant_registrations set status=case when p_approve then 'approved'::public.registration_state else 'rejected'::public.registration_state end,
    decided_at=now(),decided_by=auth.uid(),decision_reason=p_reason,updated_at=now()
    where id=p_registration_id and status='submitted';
  if not found then raise exception 'submitted registration not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),case when p_approve then 'registration.approved' else 'registration.rejected' end,'participant_registrations',p_registration_id::text,p_reason);
end $$;

create or replace function public.registration_submit()
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.participant_registrations set status='submitted',submitted_at=now(),updated_at=now()
    where user_id=auth.uid() and status='draft';
  if not found then raise exception 'draft registration not found'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'registration.submitted','participant_registrations',auth.uid()::text,'Participant submitted registration');
end $$;

create or replace function public.registration_withdraw(p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare r public.participant_registrations%rowtype;
begin
  if auth.uid() is null or length(btrim(p_reason))=0 then raise exception 'authenticated user and reason required'; end if;
  update public.participant_registrations set status='withdrawn',updated_at=now()
    where user_id=auth.uid() and status='submitted' returning * into r;
  if not found then raise exception 'submitted registration required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason,before_data,after_data)
    values(auth.uid(),'registration.withdrawn','participant_registrations',r.id::text,p_reason,
      jsonb_build_object('status','submitted'),jsonb_build_object('status','withdrawn'));
end $$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_touch_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger registration_touch_updated before update on public.participant_registrations for each row execute function private.touch_updated_at();
create trigger notification_preferences_touch_updated before update on public.notification_preferences for each row execute function private.touch_updated_at();

create or replace function public.community_moderate(
  p_report_id uuid,p_post_id uuid,p_comment_id uuid,p_action text,p_reason text
) returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare r public.community_reports%rowtype;
begin
  if not (private.has_role('moderator') or private.has_permission('moderation.manage')) then raise exception 'moderation role required'; end if;
  if p_reason is null or length(btrim(p_reason))=0 then raise exception 'moderation reason required'; end if;
  if p_action not in ('hide','restore','warn','dismiss_report') then raise exception 'invalid moderation action'; end if;
  if p_report_id is not null then
    select * into r from public.community_reports where id=p_report_id for update;
    if not found then raise exception 'report not found'; end if;
    if p_post_id is null and p_comment_id is null then p_post_id:=r.post_id; p_comment_id:=r.comment_id; end if;
    if (p_post_id,p_comment_id) is distinct from (r.post_id,r.comment_id) then raise exception 'report target mismatch'; end if;
  end if;
  if num_nonnulls(p_post_id,p_comment_id)<>1 then raise exception 'exactly one moderation target required'; end if;
  if p_post_id is not null then
    update public.community_posts set status=case when p_action='hide' then 'hidden'::public.content_state else 'published'::public.content_state end,
      hidden_at=case when p_action='hide' then now() else null end,updated_at=now()
      where id=p_post_id and ((p_action='hide' and status='published') or (p_action='restore' and status='hidden'));
  elsif p_comment_id is not null then
    update public.community_comments set status=case when p_action='hide' then 'hidden'::public.content_state else 'published'::public.content_state end,
      hidden_at=case when p_action='hide' then now() else null end,
      updated_at=now() where id=p_comment_id and ((p_action='hide' and status='published') or (p_action='restore' and status='hidden'));
  end if;
  if p_action in ('hide','restore') and not found then raise exception 'only published content can be hidden and only hidden content restored'; end if;
  insert into public.moderation_actions(moderator_user_id,report_id,post_id,comment_id,action_code,reason)
    values(auth.uid(),p_report_id,p_post_id,p_comment_id,p_action,p_reason);
  if p_report_id is not null then
    update public.community_reports set status=case when p_action='dismiss_report' then 'dismissed'::public.report_state else 'resolved'::public.report_state end,
      resolved_at=now(),resolved_by=auth.uid() where id=p_report_id and status in ('open','reviewing');
  end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'community.moderation_action','community_reports',p_report_id::text,p_reason);
end $$;

-- Administrative CRUD is RPC-only; draft content is not public until the
-- explicit publish operation succeeds and its permission/audit check passes.
create or replace function public.admin_invitation_create(p_email_hash bytea,p_expires_at timestamptz,p_reason text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_role('super_admin') or p_email_hash is null or octet_length(p_email_hash)<>32
     or p_expires_at<=now() or length(btrim(p_reason))=0 then raise exception 'Super Admin, valid email digest, future expiry, and reason required'; end if;
  insert into public.admin_invitations(invitee_email_hash,invited_by,expires_at,reason)
    values(p_email_hash,auth.uid(),p_expires_at,p_reason) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'admin.invitation_created','admin_invitations',v_id::text,p_reason);
  return v_id;
end $$;

create or replace function public.admin_invitation_revoke(p_invitation_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  if not private.has_role('super_admin') or length(btrim(p_reason))=0 then raise exception 'Super Admin and reason required'; end if;
  update public.admin_invitations set revoked_at=now(),reason=p_reason
    where id=p_invitation_id and accepted_at is null and revoked_at is null;
  if not found then raise exception 'active unaccepted invitation required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'admin.invitation_revoked','admin_invitations',p_invitation_id::text,p_reason);
end $$;

create or replace function public.admin_invitation_accept(p_invitation_id uuid,p_user_id uuid,p_email_hash bytea)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare i public.admin_invitations%rowtype;
begin
  if auth.role()<>'service_role' or p_user_id is null or p_email_hash is null then raise exception 'verified server identity required'; end if;
  select * into i from public.admin_invitations where id=p_invitation_id for update;
  if not found or i.accepted_at is not null or i.revoked_at is not null or i.expires_at<=now()
     or i.invitee_email_hash<>p_email_hash then raise exception 'matching active invitation required'; end if;
  update public.admin_invitations set accepted_user_id=p_user_id,accepted_at=now() where id=i.id;
  insert into public.user_role_grants(user_id,role,granted_by,reason)
    values(p_user_id,'admin',i.invited_by,'Accepted verified Admin invitation');
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(i.invited_by,'admin.invitation_accepted','admin_invitations',i.id::text,'Email verified by trusted server flow');
end $$;

create or replace function public.admin_announcement_create(p_title text,p_body text,p_audience public.announcement_audience)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('announcement.publish') then raise exception 'announcement permission required'; end if;
  if length(btrim(p_title))=0 or length(btrim(p_body))=0 then raise exception 'announcement title and body required'; end if;
  insert into public.announcements(title,body,audience,created_by) values(p_title,p_body,p_audience,auth.uid()) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'announcement.created','announcements',v_id::text,'Draft created');
  return v_id;
end $$;

create or replace function public.admin_announcement_update(p_id uuid,p_title text,p_body text,p_audience public.announcement_audience,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  if not private.has_permission('announcement.publish') or length(btrim(p_reason))=0 then raise exception 'announcement permission and reason required'; end if;
  update public.announcements set title=p_title,body=p_body,audience=p_audience,updated_at=now()
    where id=p_id and status='draft';
  if not found then raise exception 'draft announcement required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'announcement.updated','announcements',p_id::text,p_reason);
end $$;

create or replace function public.admin_announcement_target(p_id uuid,p_user_id uuid,p_team_id uuid,p_role public.app_role,p_remove boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  if not private.has_permission('announcement.publish') or num_nonnulls(p_user_id,p_team_id,p_role)<>1 then raise exception 'announcement permission and exactly one target required'; end if;
  if not exists(select 1 from public.announcements where id=p_id and status='draft') then raise exception 'draft announcement required'; end if;
  if p_remove then
    delete from public.announcement_targets where announcement_id=p_id and target_user_id is not distinct from p_user_id
      and target_team_id is not distinct from p_team_id and target_role is not distinct from p_role;
  else
    insert into public.announcement_targets(announcement_id,target_user_id,target_team_id,target_role)
      values(p_id,p_user_id,p_team_id,p_role) on conflict do nothing;
  end if;
end $$;

create or replace function public.admin_announcement_publish(p_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  if not private.has_permission('announcement.publish') or length(btrim(p_reason))=0 then raise exception 'announcement permission and reason required'; end if;
  update public.announcements set status='published',published_at=now(),updated_at=now() where id=p_id and status='draft';
  if not found then raise exception 'draft announcement required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'announcement.published','announcements',p_id::text,p_reason);
end $$;

create or replace function public.admin_schedule_create(p_title text,p_description text,p_starts timestamptz,p_ends timestamptz,p_timezone text,p_audience public.announcement_audience)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('schedule.manage') or p_starts is null or p_ends<=p_starts or length(btrim(p_timezone))=0 or p_audience='targeted' then raise exception 'schedule permission and valid supported audience values required'; end if;
  insert into public.event_schedule(title,description,starts_at,ends_at,display_timezone,audience,created_by)
    values(p_title,p_description,p_starts,p_ends,p_timezone,p_audience,auth.uid()) returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'schedule.created','event_schedule',v_id::text,'Draft schedule item created');
  return v_id;
end $$;

create or replace function public.admin_schedule_publish(p_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  if not private.has_permission('schedule.manage') or length(btrim(p_reason))=0 then raise exception 'schedule permission and reason required'; end if;
  update public.event_schedule set status='published',published_at=now() where id=p_id and status='draft';
  if not found then raise exception 'draft schedule item required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'schedule.published','event_schedule',p_id::text,p_reason);
end $$;

create or replace function public.admin_schedule_update(p_id uuid,p_title text,p_description text,p_starts timestamptz,p_ends timestamptz,p_timezone text,p_audience public.announcement_audience,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  if not private.has_permission('schedule.manage') or p_starts is null or p_ends<=p_starts
     or length(btrim(p_timezone))=0 or length(btrim(p_reason))=0 or p_audience='targeted' then
    raise exception 'schedule permission, reason, and valid supported schedule values required';
  end if;
  update public.event_schedule set title=p_title,description=p_description,starts_at=p_starts,ends_at=p_ends,
    display_timezone=p_timezone,audience=p_audience where id=p_id and status='draft';
  if not found then raise exception 'draft schedule item required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'schedule.updated','event_schedule',p_id::text,p_reason);
end $$;

create or replace function public.admin_rubric_create(p_title text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('rubric.manage') or length(btrim(p_title))=0 then raise exception 'rubric permission and title required'; end if;
  insert into public.evaluation_rubrics(version_number,title,created_by)
    select coalesce(max(version_number),0)+1,p_title,auth.uid() from public.evaluation_rubrics returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'rubric.created','evaluation_rubrics',v_id::text,'Draft rubric created');
  return v_id;
end $$;

create or replace function public.admin_rubric_add_criterion(p_rubric_id uuid,p_code text,p_title text,p_description text,p_weight integer,p_max_score numeric,p_order smallint)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('rubric.manage') or not exists(select 1 from public.evaluation_rubrics where id=p_rubric_id and status='draft') then raise exception 'rubric permission and draft required'; end if;
  insert into public.evaluation_criteria(rubric_id,criterion_code,title,description,weight_basis_points,maximum_score,display_order)
    values(p_rubric_id,p_code,p_title,p_description,p_weight,p_max_score,p_order) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_rubric_publish(p_id uuid,p_reason text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  if not private.has_permission('rubric.manage') or length(btrim(p_reason))=0 then raise exception 'rubric permission and reason required'; end if;
  update public.evaluation_rubrics set status='published' where id=p_id and status='draft';
  if not found then raise exception 'draft rubric required'; end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'rubric.published','evaluation_rubrics',p_id::text,p_reason);
end $$;

create or replace function public.admin_certificate_type_set(p_kind public.certificate_kind,p_name text,p_active boolean)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('certificate.issue') or length(btrim(p_name))=0 then raise exception 'certificate permission and name required'; end if;
  insert into public.certificate_types(kind,name,active) values(p_kind,p_name,p_active)
    on conflict(name) do update set kind=excluded.kind,active=excluded.active returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason) values(auth.uid(),'certificate.type_configured','certificate_types',v_id::text,'Type configuration changed');
  return v_id;
end $$;

create or replace function public.service_enqueue_notification(p_user_id uuid,p_type text,p_resource_type text,p_resource_id uuid,p_safe_summary text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if auth.role()<>'service_role' or p_user_id is null or length(btrim(p_type))=0
     or length(coalesce(p_safe_summary,''))>240 then raise exception 'trusted service and valid notification fields required'; end if;
  insert into public.notifications(user_id,notification_type,resource_type,resource_id,safe_summary)
    values(p_user_id,p_type,p_resource_type,p_resource_id,p_safe_summary) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_community_category_set(p_slug text,p_title text,p_enabled boolean)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('moderation.manage') or length(btrim(p_slug))=0 or length(btrim(p_title))=0 then raise exception 'category permission and values required'; end if;
  insert into public.community_categories(slug,title,enabled) values(p_slug,p_title,p_enabled)
    on conflict(slug) do update set title=excluded.title,enabled=excluded.enabled returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'community.category_configured','community_categories',v_id::text,'Category configuration changed');
  return v_id;
end $$;

create or replace function public.team_skill_requirement_set(p_team_id uuid,p_skill_id uuid,p_desired smallint,p_remove boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
begin
  perform 1 from public.teams where id=p_team_id for update;
  if not found or not private.is_team_leader(p_team_id) then raise exception 'active team leader required'; end if;
  if exists(select 1 from public.teams where id=p_team_id and status<>'forming')
     or exists(select 1 from public.team_payment_orders where team_id=p_team_id and status in ('pending','paid')) then
    raise exception 'team skill requirements are locked';
  end if;
  if p_remove then
    delete from public.team_skill_requirements where team_id=p_team_id and skill_id=p_skill_id;
  else
    insert into public.team_skill_requirements(team_id,skill_id,desired_proficiency)
      values(p_team_id,p_skill_id,p_desired)
      on conflict(team_id,skill_id) do update set desired_proficiency=excluded.desired_proficiency;
  end if;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),case when p_remove then 'team.skill_requirement_removed' else 'team.skill_requirement_set' end,
      'team_skill_requirements',p_team_id::text,'Leader updated forming-team discovery requirements');
end $$;

create or replace function public.admin_skill_set(p_name text,p_category text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('catalog.manage') or length(btrim(p_name))=0 then raise exception 'catalog permission and skill name required'; end if;
  insert into public.skills(name,category) values(p_name,p_category)
    on conflict(name) do update set category=excluded.category returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'catalog.skill_configured','skills',v_id::text,'Skill catalog changed');
  return v_id;
end $$;

create or replace function public.admin_technology_set(p_name text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('catalog.manage') or length(btrim(p_name))=0 then raise exception 'catalog permission and technology name required'; end if;
  insert into public.technologies(name) values(p_name)
    on conflict(name) do update set name=excluded.name returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'catalog.technology_configured','technologies',v_id::text,'Technology catalog changed');
  return v_id;
end $$;

create or replace function public.admin_interest_area_set(p_code text,p_label text,p_active boolean)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth set row_security = off as $$
declare v_id uuid;
begin
  if not private.has_permission('catalog.manage') or length(btrim(p_code))=0 or length(btrim(p_label))=0 then raise exception 'catalog permission and interest values required'; end if;
  insert into public.interest_areas(code,label,active) values(p_code,p_label,p_active)
    on conflict(code) do update set label=excluded.label,active=excluded.active returning id into v_id;
  insert into public.audit_log(actor_user_id,action_code,target_table,target_id,reason)
    values(auth.uid(),'catalog.interest_area_configured','interest_areas',v_id::text,'Interest catalog changed');
  return v_id;
end $$;

-- Final function ownership and executable grants are deliberately last,
-- after every function exists. PostgreSQL otherwise grants EXECUTE to PUBLIC
-- by default. Temporarily restore schema CREATE for owner transfer, then
-- remove it before any RPC is callable.
grant create on schema public,private to incux_rpc_owner;
do $$
declare f record;
begin
  for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
  loop
    execute format('alter function %I.%I(%s) owner to incux_rpc_owner',f.nspname,f.proname,f.args);
  end loop;
end $$;
revoke create on schema public,private from incux_rpc_owner;
do $$
begin
  if pg_catalog.has_schema_privilege('incux_rpc_owner','public','CREATE')
     or pg_catalog.has_schema_privilege('incux_rpc_owner','private','CREATE') then
    raise exception 'RPC owner must not retain schema CREATE after function ownership transfer';
  end if;
end $$;
revoke all on all functions in schema public,private from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.has_role(public.app_role),private.has_permission(text),
  private.is_team_member(uuid),private.is_team_leader(uuid),private.can_judge_submission(uuid),
  private.can_recruiter_view(uuid,text) to authenticated;
grant execute on function public.team_create(text,text,text,uuid[]),public.team_join(uuid),
  public.team_request_join(uuid,text),public.team_decide_join_request(uuid,boolean,text),
  public.team_invite_member(uuid,uuid),public.team_accept_invitation(uuid),
  public.team_respond_invitation(uuid,boolean),public.team_revoke_invitation(uuid,text),
  public.team_withdraw_join_request(uuid,text),
  public.team_remove_member(uuid,uuid,text),public.team_transfer_leader(uuid,uuid,text),
  public.team_dissolve(uuid,text),public.team_lock_roster(uuid,boolean,text),
  public.team_post_payment_exception(uuid,text,uuid,text),
  public.team_policy_set(smallint,smallint,timestamptz,text),
  public.payment_set_fee(bigint,timestamptz,text),public.payment_cancel_fee_version(uuid,text),
  public.payment_create_order(uuid),public.payment_request_refund(uuid,uuid,bigint,text),
  public.admin_grant_recruiter_access(uuid,text,text),public.admin_revoke_recruiter_access(uuid,text),
  public.admin_set_recruiter_consent_version(text,text,text),
  public.recruiter_set_consent(text,text,boolean),public.recruiter_add_shortlist(uuid),
  public.recruiter_save_note(uuid,text),public.team_post_discussion_message(uuid,text),
  public.judge_assign_submission(uuid,uuid,uuid,text),
  public.judge_declare_conflict(uuid,text),public.judge_resolve_conflict(uuid,public.judge_conflict_state,text),
  public.judge_save_score(uuid,uuid,numeric,text),
  public.judge_submit_evaluation(uuid),public.evaluation_release(uuid,text),
  public.submission_save_version(uuid,text,text,text,text,text),public.submission_finalize(uuid,uuid),
  public.event_set_submission_deadline(timestamptz,text),
  public.certificate_issue(uuid,uuid,uuid,text),public.certificate_revoke(uuid,text),
  public.certificate_grant_name_consent(uuid,boolean),public.certificate_revoke_name_consent(uuid),
  public.registration_decide(uuid,boolean,text),public.registration_submit(),
  public.registration_withdraw(text),
  public.community_create_post(uuid,text,text,public.post_visibility),
  public.community_create_comment(uuid,uuid,text),public.community_report_content(uuid,uuid,text,text),
  public.community_moderate(uuid,uuid,uuid,text,text),public.admin_grant_role(uuid,public.app_role,text),
  public.admin_revoke_role(uuid,text),public.admin_grant_permission(uuid,text,text),
  public.admin_revoke_permission(uuid,text),
  public.admin_announcement_create(text,text,public.announcement_audience),
  public.admin_announcement_update(uuid,text,text,public.announcement_audience,text),
  public.admin_announcement_target(uuid,uuid,uuid,public.app_role,boolean),public.admin_announcement_publish(uuid,text),
  public.admin_schedule_create(text,text,timestamptz,timestamptz,text,public.announcement_audience),
  public.admin_schedule_update(uuid,text,text,timestamptz,timestamptz,text,public.announcement_audience,text),public.admin_schedule_publish(uuid,text),
  public.admin_rubric_create(text),public.admin_rubric_add_criterion(uuid,text,text,text,integer,numeric,smallint),public.admin_rubric_publish(uuid,text),
  public.admin_certificate_type_set(public.certificate_kind,text,boolean),
  public.admin_community_category_set(text,text,boolean),public.admin_skill_set(text,text),
  public.admin_technology_set(text),public.admin_interest_area_set(text,text,boolean),
  public.team_skill_requirement_set(uuid,uuid,smallint,boolean),
  public.admin_invitation_create(bytea,timestamptz,text),public.admin_invitation_revoke(uuid,text),
  public.admin_grant_recruiter_access(uuid,text,text),public.admin_revoke_recruiter_access(uuid,text) to authenticated;
grant execute on function public.certificate_verify(text) to service_role;
grant execute on function public.admin_invitation_accept(uuid,uuid,bytea),public.service_enqueue_notification(uuid,text,text,uuid,text),
  public.admin_transfer_super_admin(uuid,uuid,uuid,text),
  public.team_expire_pending_workflows(),
  public.payment_record_verified_webhook(text,uuid,text,text,bigint,char(3),public.payment_transaction_state,bytea),
  public.payment_expire_order(uuid),public.payment_cancel_order(uuid,text),
  public.payment_finish_refund(uuid,text,boolean),public.payment_set_gateway_order(uuid,text),
  public.payment_issue_receipt(uuid,text,text) to service_role;

-- The helper schema must stay absent from PostgREST's exposed-schema list.
-- Views are security-barrier projections owned by the non-login RPC role.
-- User changes to profile, skills, interests, links, reactions and preferences
-- are limited by the column grants above and their own-row RLS policies.
alter default privileges in schema public revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema public revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated,service_role;
