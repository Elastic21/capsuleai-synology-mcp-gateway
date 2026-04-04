import { AppError } from '@cybergogne/common';

function splitRefs(value: string): string[] {
  return value.split(/[;,]/g).map((item) => item.trim()).filter(Boolean);
}

export class ApproverDirectory {
  constructor(private readonly devBypass: boolean) {}

  assertCanApprove(actorRef: string, approverGroup: any) {
    if (this.devBypass) return;

    if (!actorRef) {
      throw new AppError('APPROVER_IDENTITY_REQUIRED', 'Approver identity is required', 403);
    }

    if (approverGroup.principal_type === 'email_list') {
      const allowed = splitRefs(approverGroup.principal_ref);
      if (!allowed.includes(actorRef)) {
        throw new AppError('APPROVER_NOT_ALLOWED', `Actor ${actorRef} is not in approver list`, 403);
      }
      return;
    }

    throw new AppError(
      'APPROVER_DIRECTORY_NOT_IMPLEMENTED',
      `Principal type ${approverGroup.principal_type} requires production directory integration`,
      501,
    );
  }

  isQuorumSatisfied(approverGroup: any, approvals: any[]) {
    if (approverGroup.quorum_rule === 'one_of') return approvals.some((item) => item.decision === 'approved');
    if (approverGroup.quorum_rule === 'all_of') {
      const approved = approvals.filter((item) => item.decision === 'approved');
      return approved.length > 0;
    }
    if (approverGroup.quorum_rule === 'n_of_m') {
      const approved = approvals.filter((item) => item.decision === 'approved').length;
      return approved >= Number(approverGroup.quorum_value ?? 1);
    }
    return false;
  }
}
