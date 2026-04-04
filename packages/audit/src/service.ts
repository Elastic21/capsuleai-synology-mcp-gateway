import { newTraceId } from '@cybergogne/common';
import type { RegistryRepository } from '@cybergogne/registry';

export class AuditService {
  constructor(private readonly registry: RegistryRepository) {}

  async log(input: {
    scope_id?: string | null;
    proposal_id?: string | null;
    actor_type: 'model' | 'widget' | 'user' | 'system' | 'script';
    actor_ref?: string | null;
    action: string;
    resource_type: string;
    resource_ref: string;
    request_payload_redacted?: Record<string, unknown>;
    result_payload_redacted?: Record<string, unknown>;
    trace_id?: string | null;
  }) {
    return this.registry.addAuditLog({
      ...input,
      trace_id: input.trace_id ?? newTraceId(),
    });
  }
}
