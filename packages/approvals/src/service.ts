import { AppError } from '@cybergogne/common';
import type { AuditService } from '@cybergogne/audit';
import { ApproverDirectory } from './directory.js';
import type { RegistryRepository } from '@cybergogne/registry';

export class ApprovalService {
  constructor(
    private readonly registry: RegistryRepository,
    private readonly audit: AuditService,
    private readonly directory: ApproverDirectory,
    private readonly defaultActorRef: string,
  ) {}

  private async resolveContext(proposalId: string) {
    const proposal = await this.registry.getProposalById(proposalId);
    if (!proposal) {
      throw new AppError('PROPOSAL_NOT_FOUND', `Proposal ${proposalId} not found`, 404);
    }
    const scope = await this.registry.findScopeById(proposal.scope_id);
    if (!scope) {
      throw new AppError('SCOPE_NOT_FOUND', `Scope ${proposal.scope_id} not found`, 404);
    }
    const approverGroup = await this.registry.findApproverGroup(scope.approver_group_key);
    if (!approverGroup) {
      throw new AppError('APPROVER_GROUP_NOT_FOUND', `Approver group ${scope.approver_group_key} not found`, 404);
    }
    return { proposal, scope, approverGroup };
  }

  async approveProposal(input: { proposal_id: string; actor_ref?: string; comment?: string }) {
    const { proposal, scope, approverGroup } = await this.resolveContext(input.proposal_id);
    const actorRef = input.actor_ref ?? this.defaultActorRef;
    this.directory.assertCanApprove(actorRef, approverGroup);

    await this.registry.addApproval({
      proposal_id: proposal.proposal_id,
      approver_group_key: approverGroup.approver_group_key,
      actor_ref: actorRef,
      decision: 'approved',
      comment: input.comment,
    });

    const approvals = await this.registry.listApprovals(proposal.proposal_id);
    const status = this.directory.isQuorumSatisfied(approverGroup, approvals)
      ? 'approved'
      : 'pending_approval';

    const updated = await this.registry.updateProposalStatus(proposal.proposal_id, status);

    await this.audit.log({
      scope_id: scope.scope_id,
      proposal_id: proposal.proposal_id,
      actor_type: 'widget',
      actor_ref: actorRef,
      action: 'approve_proposal',
      resource_type: 'proposal',
      resource_ref: proposal.proposal_id,
      request_payload_redacted: { comment: input.comment ?? null },
      result_payload_redacted: { status },
    });

    return { proposal: updated, approvals };
  }

  async rejectProposal(input: { proposal_id: string; actor_ref?: string; comment?: string }) {
    const { proposal, scope, approverGroup } = await this.resolveContext(input.proposal_id);
    const actorRef = input.actor_ref ?? this.defaultActorRef;
    this.directory.assertCanApprove(actorRef, approverGroup);

    await this.registry.addApproval({
      proposal_id: proposal.proposal_id,
      approver_group_key: approverGroup.approver_group_key,
      actor_ref: actorRef,
      decision: 'rejected',
      comment: input.comment,
    });

    const updated = await this.registry.updateProposalStatus(proposal.proposal_id, 'rejected');

    await this.audit.log({
      scope_id: scope.scope_id,
      proposal_id: proposal.proposal_id,
      actor_type: 'widget',
      actor_ref: actorRef,
      action: 'reject_proposal',
      resource_type: 'proposal',
      resource_ref: proposal.proposal_id,
      request_payload_redacted: { comment: input.comment ?? null },
      result_payload_redacted: { status: 'rejected' },
    });

    return { proposal: updated };
  }
}
