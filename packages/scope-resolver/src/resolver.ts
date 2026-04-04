import { AppError } from '@cybergogne/common';
import type { RegistryRepository } from '@cybergogne/registry';

export interface ScopeHints {
  scope_id?: string;
  chatgpt_project_slug?: string;
  knowledge_app_slug?: string;
  publisher_app_slug?: string;
}

export class ScopeResolver {
  constructor(
    private readonly registry: RegistryRepository,
    private readonly environment: string,
  ) {}

  async resolve(hints: ScopeHints) {
    const { scope_id, chatgpt_project_slug, knowledge_app_slug, publisher_app_slug } = hints;

    const scope =
      (scope_id ? await this.registry.findScopeById(scope_id, this.environment) : null) ??
      (publisher_app_slug
        ? await this.registry.findScopeByPublisherAppSlug(publisher_app_slug, this.environment)
        : null) ??
      (knowledge_app_slug
        ? await this.registry.findScopeByKnowledgeAppSlug(knowledge_app_slug, this.environment)
        : null) ??
      (chatgpt_project_slug
        ? await this.registry.findScopeByProjectSlug(chatgpt_project_slug, this.environment)
        : null);

    if (!scope) {
      throw new AppError('SCOPE_NOT_RESOLVED', 'Unable to resolve an active scope', 403, hints);
    }

    if (!scope.enabled) {
      throw new AppError('SCOPE_DISABLED', `Scope ${scope.scope_id} is disabled`, 403);
    }

    return scope;
  }

  assertSearchAllowed(scope: any) {
    const guard = String(scope.read_cql_guard ?? '').trim();
    if (!guard) {
      throw new AppError('READ_GUARD_MISSING', `Scope ${scope.scope_id} has no read_cql_guard`, 403);
    }
  }

  async assertWriteAuthorized(scope: any) {
    if (!scope.publication_policy_key) {
      throw new AppError(
        'PUBLICATION_POLICY_MISSING',
        `Scope ${scope.scope_id} has no publication policy`,
        403,
      );
    }

    const policy = await this.registry.findPublicationPolicy(scope.publication_policy_key);
    if (!policy) {
      throw new AppError(
        'PUBLICATION_POLICY_INVALID',
        `Publication policy ${scope.publication_policy_key} was not found`,
        403,
      );
    }

    return policy;
  }

  assertDocTypeAllowed(scope: any, docType: string) {
    const allowed = Array.isArray(scope.allowed_doc_types) ? scope.allowed_doc_types : [];
    if (allowed.length > 0 && !allowed.includes(docType)) {
      throw new AppError('DOC_TYPE_NOT_ALLOWED', `Doc type ${docType} is not allowed`, 403);
    }
  }

  assertTemplateAllowed(scope: any, templateId?: string) {
    if (!templateId) return;
    const allowed = Array.isArray(scope.allowed_template_ids) ? scope.allowed_template_ids : [];
    if (allowed.length > 0 && !allowed.includes(templateId)) {
      throw new AppError('TEMPLATE_NOT_ALLOWED', `Template ${templateId} is not allowed`, 403);
    }
  }

  normalizeLabels(scope: any, labels: string[]) {
    const required = Array.isArray(scope.required_labels) ? scope.required_labels : [];
    const forbidden = new Set(Array.isArray(scope.forbidden_labels) ? scope.forbidden_labels : []);
    const merged = Array.from(new Set([...required, ...labels]));
    for (const label of merged) {
      if (forbidden.has(label)) {
        throw new AppError('LABEL_FORBIDDEN', `Label ${label} is forbidden`, 403);
      }
    }
    return merged;
  }

  assertWriteMode(scope: any, requested: 'append_only' | 'managed_sections') {
    if (scope.write_target_mode === 'append_only' && requested !== 'append_only') {
      throw new AppError('WRITE_MODE_NOT_ALLOWED', 'Only append_only is allowed for this scope', 403);
    }
    if (scope.write_target_mode === 'managed_sections' && requested !== 'managed_sections') {
      throw new AppError('WRITE_MODE_NOT_ALLOWED', 'Only managed_sections is allowed for this scope', 403);
    }
  }

  assertPageUnderRoot(scope: any, page: { id: string; ancestors: string[] }) {
    const root = String(scope.root_page_id);
    if (String(page.id) === root) return;
    if (!page.ancestors.map(String).includes(root)) {
      throw new AppError('PAGE_OUT_OF_SCOPE', `Page ${page.id} is not under root ${root}`, 403);
    }
  }
}
