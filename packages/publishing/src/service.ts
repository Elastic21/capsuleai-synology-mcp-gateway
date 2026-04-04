import { AppError, normalizeContentProperties } from '@cybergogne/common';
import type { AuditService } from '@cybergogne/audit';
import type { ConfluenceClient } from '@cybergogne/confluence';
import type { RegistryRepository } from '@cybergogne/registry';

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export class PublishingService {
  constructor(
    private readonly registry: RegistryRepository,
    private readonly confluence: ConfluenceClient,
    private readonly audit: AuditService,
    private readonly defaultActorRef: string,
  ) {}

  async publishApprovedProposal(input: { proposal_id: string; actor_ref?: string }) {
    const proposal = await this.registry.getProposalById(input.proposal_id);
    if (!proposal) {
      throw new AppError('PROPOSAL_NOT_FOUND', `Proposal ${input.proposal_id} not found`, 404);
    }
    if (proposal.status !== 'approved') {
      throw new AppError('PROPOSAL_NOT_APPROVED', `Proposal ${proposal.proposal_id} is not approved`, 409);
    }

    const scope = await this.registry.findScopeById(proposal.scope_id);
    const policy = await this.registry.findPublicationPolicy(scope.publication_policy_key);
    if (!policy) {
      throw new AppError(
        'PUBLICATION_POLICY_INVALID',
        `Publication policy ${scope.publication_policy_key} was not found`,
        403,
      );
    }
    const actorRef = input.actor_ref ?? this.defaultActorRef;
    const rendered = String(proposal.body_rendered?.storage ?? '');

    let pageId = '';
    let versionNumber: number | null = null;
    let action: 'create' | 'update_managed_sections' | 'create_draft';

    if (proposal.proposal_type === 'create_page') {
      const targetParent =
        policy.default_publish_parent_strategy === 'ai_inbox_page_id'
          ? scope.ai_inbox_page_id
          : proposal.target_parent_page_id ?? scope.default_parent_page_id;

      const created =
        policy.create_mode === 'draft_only'
          ? await this.confluence.createDraftInAiInbox({
              spaceKey: scope.confluence_space_key,
              aiInboxPageId: scope.ai_inbox_page_id,
              title: proposal.title,
              bodyStorage: rendered,
            })
          : await this.confluence.createPage({
              spaceKey: scope.confluence_space_key,
              parentId: targetParent,
              title: proposal.title,
              bodyStorage: rendered,
            });

      pageId = String(created.id);
      versionNumber = Number(created.version?.number ?? 1);
      action = policy.create_mode === 'draft_only' ? 'create_draft' : 'create';
    } else {
      const targetPage = await this.confluence.getPage(proposal.target_page_id, 'storage');
      const updated = await this.confluence.updatePageManagedSections({
        pageId: targetPage.id,
        title: targetPage.title,
        spaceKey: targetPage.spaceKey ?? scope.confluence_space_key,
        versionNumber: targetPage.versionNumber,
        bodyStorage: rendered,
      });
      pageId = String(updated.id ?? targetPage.id);
      versionNumber = Number(updated.version?.number ?? targetPage.versionNumber + 1);
      action = 'update_managed_sections';
    }

    const labels = unique([
      ...(Array.isArray(policy.default_labels) ? policy.default_labels : []),
      ...(Array.isArray(scope.required_labels) ? scope.required_labels : []),
      ...(Array.isArray(proposal.labels) ? proposal.labels : []),
    ]);

    await this.confluence.addLabels(pageId, labels);

    const contentProperties = normalizeContentProperties({
      ...(policy.default_content_properties ?? {}),
      ...(proposal.content_properties ?? {}),
      'cg.proposalId': proposal.proposal_id,
      'cg.scopeId': scope.scope_id,
      'cg.docType': proposal.doc_type,
      'cg.sourceApp': scope.publisher_app_slug,
      'cg.publicationPolicy': scope.publication_policy_key,
      'cg.publishedAt': new Date().toISOString(),
    });

    for (const [key, value] of Object.entries(contentProperties)) {
      await this.confluence.setContentProperty(pageId, key, value);
    }

    const publication = await this.registry.addPublication({
      proposal_id: proposal.proposal_id,
      scope_id: scope.scope_id,
      action,
      page_id: pageId,
      version_number: versionNumber,
      confluence_response: { pageId, versionNumber },
      published_by: actorRef,
    });

    await this.registry.updateProposalStatus(proposal.proposal_id, 'published');

    await this.audit.log({
      scope_id: scope.scope_id,
      proposal_id: proposal.proposal_id,
      actor_type: 'widget',
      actor_ref: actorRef,
      action: 'publish_approved_proposal',
      resource_type: 'publication',
      resource_ref: publication.publication_id,
      result_payload_redacted: { pageId, versionNumber, action },
    });

    return { publication, pageId, versionNumber };
  }

  async rollbackPublication(input: { publication_id: string; actor_ref?: string }) {
    const publication = await this.registry.getPublication(input.publication_id);
    if (!publication) {
      throw new AppError('PUBLICATION_NOT_FOUND', `Publication ${input.publication_id} not found`, 404);
    }

    const proposal = await this.registry.getProposalById(publication.proposal_id);
    const scope = await this.registry.findScopeById(publication.scope_id);
    const policy = await this.registry.findPublicationPolicy(scope.publication_policy_key);

    if (!policy.rollback_allowed) {
      throw new AppError('ROLLBACK_NOT_ALLOWED', 'Rollback is not allowed for this publication policy', 403);
    }

    if (publication.action === 'create' || publication.action === 'create_draft') {
      throw new AppError(
        'ROLLBACK_NOT_SUPPORTED',
        'Rollback of newly created pages is intentionally not automatic in V1',
        409,
      );
    }

    const diff = await this.registry.getProposalDiff(publication.proposal_id);
    const snapshotId = diff?.base_snapshot_id;
    if (!snapshotId) {
      throw new AppError('SNAPSHOT_NOT_FOUND', 'Base snapshot is required for rollback', 404);
    }

    const snapshot = await this.registry.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new AppError('SNAPSHOT_NOT_FOUND', `Snapshot ${snapshotId} not found`, 404);
    }

    const restored = await this.confluence.restoreVersion(publication.page_id, snapshot.version_number);
    const actorRef = input.actor_ref ?? this.defaultActorRef;

    const rollbackPublication = await this.registry.addPublication({
      proposal_id: proposal.proposal_id,
      scope_id: scope.scope_id,
      action: 'restore_version',
      page_id: publication.page_id,
      version_number: Number(restored.number ?? snapshot.version_number),
      confluence_response: { restoredVersionNumber: snapshot.version_number },
      published_by: actorRef,
      rollback_of_publication_id: publication.publication_id,
    });

    await this.registry.updateProposalStatus(proposal.proposal_id, 'rolled_back');

    await this.audit.log({
      scope_id: scope.scope_id,
      proposal_id: proposal.proposal_id,
      actor_type: 'widget',
      actor_ref: actorRef,
      action: 'rollback_publication',
      resource_type: 'publication',
      resource_ref: rollbackPublication.publication_id,
      result_payload_redacted: { rolled_back_publication_id: publication.publication_id },
    });

    return { publication: rollbackPublication };
  }
}
