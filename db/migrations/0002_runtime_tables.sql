create table if not exists cg_scope_resolution (
  resolution_id uuid primary key,
  scope_id text not null references cg_scope_registry(scope_id),
  resolved_space_key text not null,
  resolved_space_id text null,
  resolved_root_page_id text not null,
  resolved_default_parent_page_id text not null,
  resolved_ai_inbox_page_id text not null,
  resolved_approver_principal_ref text null,
  resolution_source jsonb not null default '{}'::jsonb,
  resolved_by text not null,
  resolved_at timestamptz not null default now(),
  is_current boolean not null default true
);

create table if not exists cg_proposal (
  proposal_id uuid primary key,
  scope_id text not null references cg_scope_registry(scope_id),
  proposal_type text not null check (proposal_type in ('create_page','update_page')),
  doc_type text not null,
  template_id text null,
  target_page_id text null,
  target_parent_page_id text null,
  title text not null,
  body_input jsonb not null default '{}'::jsonb,
  body_rendered jsonb not null default '{}'::jsonb,
  labels jsonb not null default '[]'::jsonb,
  content_properties jsonb not null default '{}'::jsonb,
  write_mode text not null check (write_mode in ('append_only','managed_sections')),
  status text not null check (status in ('draft','pending_approval','approved','rejected','published','failed','rolled_back')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cg_proposal_diff (
  proposal_id uuid primary key references cg_proposal(proposal_id),
  base_snapshot_id uuid null,
  before_body jsonb null,
  after_body jsonb not null,
  diff_summary jsonb not null default '{}'::jsonb,
  diff_text text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create table if not exists cg_page_snapshot (
  snapshot_id uuid primary key,
  scope_id text not null references cg_scope_registry(scope_id),
  page_id text not null,
  version_number integer not null,
  title text not null,
  body_storage jsonb null,
  body_atlas_doc_format jsonb null,
  labels jsonb not null default '[]'::jsonb,
  content_properties jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table if not exists cg_approval (
  approval_id uuid primary key,
  proposal_id uuid not null references cg_proposal(proposal_id),
  approver_group_key text not null references cg_approver_group(approver_group_key),
  actor_ref text not null,
  decision text not null check (decision in ('approved','rejected')),
  comment text null,
  decided_at timestamptz not null default now()
);

create table if not exists cg_publication (
  publication_id uuid primary key,
  proposal_id uuid not null references cg_proposal(proposal_id),
  scope_id text not null references cg_scope_registry(scope_id),
  action text not null check (action in ('create','update_managed_sections','create_draft','restore_version')),
  page_id text not null,
  version_number integer null,
  confluence_response jsonb not null default '{}'::jsonb,
  published_by text not null,
  published_at timestamptz not null default now(),
  rollback_of_publication_id uuid null references cg_publication(publication_id)
);

create table if not exists cg_audit_log (
  audit_id uuid primary key,
  scope_id text null references cg_scope_registry(scope_id),
  proposal_id uuid null references cg_proposal(proposal_id),
  actor_type text not null check (actor_type in ('model','widget','user','system','script')),
  actor_ref text null,
  action text not null,
  resource_type text not null,
  resource_ref text not null,
  request_payload_redacted jsonb not null default '{}'::jsonb,
  result_payload_redacted jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  trace_id text null
);

create index if not exists ix_scope_resolution_current on cg_scope_resolution(scope_id, is_current);
create index if not exists ix_proposal_scope_status on cg_proposal(scope_id, status);
create index if not exists ix_approval_proposal on cg_approval(proposal_id, decided_at desc);
create index if not exists ix_publication_proposal on cg_publication(proposal_id, published_at desc);
create index if not exists ix_audit_scope_created on cg_audit_log(scope_id, created_at desc);
