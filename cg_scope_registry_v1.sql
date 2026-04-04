-- Cybergogne MCP gateway - scope registry V1 (PostgreSQL)
-- Source of truth for project -> Atlassian site -> Confluence space/root -> approver group -> publication policy mapping.

create table if not exists cg_approver_group (
    approver_group_key text primary key,
    principal_type text not null check (principal_type in ('external_directory_group','atlassian_group','email_list')),
    principal_ref text not null,
    display_name text not null,
    quorum_rule text not null check (quorum_rule in ('one_of','all_of','n_of_m')),
    quorum_value integer,
    escalation_group_key text null references cg_approver_group(approver_group_key),
    active boolean not null default true,
    notes text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (quorum_rule = 'n_of_m' and quorum_value is not null and quorum_value > 0)
        or
        (quorum_rule <> 'n_of_m')
    )
);

create table if not exists cg_publication_policy (
    publication_policy_key text primary key,
    description text not null,
    approval_required boolean not null default true,
    create_mode text not null check (create_mode in ('current_page','draft_only')),
    update_mode text not null check (update_mode in ('none','managed_sections','full_page')),
    publish_after_approval boolean not null default true,
    max_pages_per_operation integer not null default 1 check (max_pages_per_operation > 0),
    diff_required boolean not null default true,
    rollback_allowed boolean not null default true,
    default_publish_parent_strategy text not null check (default_publish_parent_strategy in ('default_parent_page_id','ai_inbox_page_id','target_page_or_default_parent')),
    default_labels jsonb not null default '[]'::jsonb,
    default_content_properties jsonb not null default '{}'::jsonb,
    notes text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists cg_scope_registry (
    scope_id text primary key,
    enabled boolean not null default true,
    environment text not null check (environment in ('prod','staging','dev')),
    tenant_id text not null,
    scope_kind text not null check (scope_kind in ('internal_domain','client_project','territory_program')),
    chatgpt_project_slug text not null,
    knowledge_app_slug text not null,
    publisher_app_slug text not null,
    atlassian_site text not null,
    confluence_space_key text not null,
    confluence_space_id text null,
    root_page_id text not null,
    default_parent_page_id text not null,
    ai_inbox_page_id text not null,
    approver_group_key text not null references cg_approver_group(approver_group_key),
    publication_policy_key text not null references cg_publication_policy(publication_policy_key),
    identity_mode text not null check (identity_mode in ('managed_scope','user_context')),
    write_target_mode text not null check (write_target_mode in ('append_only','managed_sections','full_page')),
    read_cql_guard text not null,
    allowed_doc_types jsonb not null default '[]'::jsonb,
    allowed_template_ids jsonb not null default '[]'::jsonb,
    required_labels jsonb not null default '[]'::jsonb,
    forbidden_labels jsonb not null default '[]'::jsonb,
    owner_ref text null,
    notes text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (environment, chatgpt_project_slug),
    unique (environment, knowledge_app_slug),
    unique (environment, publisher_app_slug)
);

create index if not exists ix_cg_scope_registry_lookup_project on cg_scope_registry (environment, chatgpt_project_slug) where enabled;
create index if not exists ix_cg_scope_registry_lookup_space on cg_scope_registry (atlassian_site, confluence_space_key) where enabled;

comment on table cg_scope_registry is 'Authoritative mapping used by the Cybergogne MCP gateway to resolve read/write scope.';
comment on column cg_scope_registry.read_cql_guard is 'Deterministic CQL constraint applied to all search operations (typically space + ancestor + optional labels).';
comment on column cg_scope_registry.write_target_mode is 'append_only | managed_sections | full_page. V1 recommendation: append_only or managed_sections.';
