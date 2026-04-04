import { z } from 'zod';

export const proposalStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'published',
  'failed',
  'rolled_back',
]);

export const proposalRecordSchema = z.object({
  proposal_id: z.string().uuid(),
  scope_id: z.string(),
  proposal_type: z.enum(['create_page', 'update_page']),
  doc_type: z.string(),
  template_id: z.string().nullable().optional(),
  target_page_id: z.string().nullable().optional(),
  target_parent_page_id: z.string().nullable().optional(),
  title: z.string(),
  body_input: z.record(z.string(), z.unknown()),
  body_rendered: z.record(z.string(), z.unknown()),
  labels: z.array(z.string()).default([]),
  content_properties: z.record(z.string(), z.unknown()).default({}),
  write_mode: z.enum(['append_only', 'managed_sections']),
  status: proposalStatusSchema,
  created_by: z.string(),
});

export const proposalDiffSchema = z.object({
  proposal_id: z.string().uuid(),
  base_snapshot_id: z.string().uuid().nullable().optional(),
  before_body: z.record(z.string(), z.unknown()).nullable().optional(),
  after_body: z.record(z.string(), z.unknown()),
  diff_summary: z.record(z.string(), z.unknown()),
  diff_text: z.string(),
  risk_flags: z.array(z.string()).default([]),
});

export type ProposalRecord = z.infer<typeof proposalRecordSchema>;
export type ProposalDiffRecord = z.infer<typeof proposalDiffSchema>;
