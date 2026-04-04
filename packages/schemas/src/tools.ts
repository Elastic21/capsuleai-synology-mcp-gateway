import { z } from 'zod';

export const scopeHintSchema = z.object({
  scope_id: z.string().optional(),
  chatgpt_project_slug: z.string().optional(),
  knowledge_app_slug: z.string().optional(),
  publisher_app_slug: z.string().optional(),
});

export const searchKnowledgeInputSchema = scopeHintSchema.extend({
  query: z.string().min(1),
  doc_types: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(50).default(10),
  cursor: z.string().nullable().optional(),
});

export const fetchPageInputSchema = scopeHintSchema.extend({
  page_id: z.string().min(1),
  include_body: z.boolean().default(true),
  body_format: z.enum(['storage', 'atlas_doc_format']).default('storage'),
});

export const proposeCreatePageInputSchema = scopeHintSchema.extend({
  doc_type: z.string().min(1),
  template_id: z.string().optional(),
  title: z.string().min(1),
  target_parent_page_id: z.string().nullable().optional(),
  content_markdown: z.string().min(1),
  labels: z.array(z.string()).default([]),
  content_properties: z.record(z.string(), z.unknown()).default({}),
});

export const proposeUpdatePageInputSchema = scopeHintSchema.extend({
  target_page_id: z.string().min(1),
  update_mode: z.enum(['managed_sections']),
  managed_section_key: z.string().min(1),
  content_markdown: z.string().min(1),
  labels: z.array(z.string()).default([]),
});

export const proposalLookupInputSchema = scopeHintSchema.extend({
  proposal_id: z.string().uuid(),
});

export const approvalInputSchema = scopeHintSchema.extend({
  proposal_id: z.string().uuid(),
  actor_ref: z.string().optional(),
  comment: z.string().optional(),
});

export const rollbackInputSchema = scopeHintSchema.extend({
  publication_id: z.string().uuid(),
  actor_ref: z.string().optional(),
});
