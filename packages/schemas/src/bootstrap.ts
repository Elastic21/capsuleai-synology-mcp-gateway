import { z } from 'zod';

export const bootstrapManifestSchema = z.object({
  scopes: z.array(z.object({
    scope_id: z.string(),
    atlassian_site: z.string(),
    space_hint: z.object({
      key: z.string().optional(),
      name: z.string().optional(),
    }),
    page_hints: z.object({
      root: z.object({ title: z.string() }),
      default_parent: z.object({ title: z.string() }),
      ai_inbox: z.object({ title: z.string() }),
    }),
    approver_hint: z.object({
      principal_type: z.enum(['atlassian_group', 'external_directory_group', 'email_list']),
      candidates: z.array(z.string()).default([]),
    }).optional(),
  })),
});

export const resolvedRegistrySchema = z.object({
  schema_version: z.literal('v1'),
  generated_at: z.string(),
  scopes: z.array(z.object({
    scope_id: z.string(),
    status: z.enum(['resolved', 'requires_manual_choice', 'unresolved']),
    resolved_space_key: z.string().nullable().optional(),
    resolved_space_id: z.string().nullable().optional(),
    resolved_root_page_id: z.string().nullable().optional(),
    resolved_default_parent_page_id: z.string().nullable().optional(),
    resolved_ai_inbox_page_id: z.string().nullable().optional(),
    resolved_approver_principal_ref: z.string().nullable().optional(),
    candidates: z.array(z.record(z.string(), z.unknown())).default([]),
    notes: z.array(z.string()).default([]),
  })),
});

export type BootstrapManifest = z.infer<typeof bootstrapManifestSchema>;
export type ResolvedRegistry = z.infer<typeof resolvedRegistrySchema>;
