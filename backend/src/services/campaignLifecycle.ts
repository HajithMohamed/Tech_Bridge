import type { CampaignStage, IPromotionRequest, PromotionRequestStatus } from '../models/PromotionRequest';
import { AdminActionError } from './adminUsers';

export const campaignStages: CampaignStage[] = ['draft', 'pending', 'accepted', 'in_progress', 'submitted', 'changes_requested', 'reviewed', 'completed', 'declined', 'cancelled'];
export const terminalCampaignStages: CampaignStage[] = ['completed', 'declined', 'cancelled'];
export function campaignStage(row: Pick<IPromotionRequest, 'stage' | 'status' | 'deliveryStatus'>): CampaignStage {
  if (row.stage) return row.stage;
  if (row.status !== 'accepted') return row.status;
  if (row.deliveryStatus === 'submitted') return 'submitted';
  if (row.deliveryStatus === 'changes_requested') return 'changes_requested';
  if (row.deliveryStatus === 'approved') return 'reviewed';
  return 'accepted';
}
export function legacyCampaignStatus(stage: CampaignStage): PromotionRequestStatus {
  if (stage === 'draft' || stage === 'pending') return 'pending';
  if (terminalCampaignStages.includes(stage)) return stage as PromotionRequestStatus;
  return 'accepted';
}
export function statusTransition(stage: CampaignStage, actor: 'student' | 'provider', target: unknown): CampaignStage {
  if (stage === 'draft' && actor !== 'provider') throw new AdminActionError(409, 'Only the provider controls an unpublished draft.');
  if (target === 'cancelled' && !terminalCampaignStages.includes(stage)) return 'cancelled';
  if (stage === 'draft' && actor === 'provider' && target === 'pending') return 'pending';
  if (stage === 'pending' && actor === 'student' && (target === 'accepted' || target === 'declined')) return target;
  if (stage === 'accepted' && target === 'in_progress') return 'in_progress';
  if (stage === 'reviewed' && actor === 'provider' && target === 'completed') return 'completed';
  throw new AdminActionError(409, 'This campaign action is not allowed in its current stage.');
}
export function assertFutureCampaignDeadline(deadline: Date | undefined, now = Date.now()) {
  if (deadline && deadline.getTime() <= now) throw new AdminActionError(409, 'The campaign deadline has passed. Create a revised invitation.');
}
export function campaignTerms(row: Pick<IPromotionRequest, 'campaignBrief' | 'deliverables' | 'compensationType' | 'compensationDetails' | 'deadline'>) {
  return { campaignBrief: row.campaignBrief, deliverables: row.deliverables, compensationType: row.compensationType, ...(row.compensationDetails ? { compensationDetails: row.compensationDetails } : {}), ...(row.deadline ? { deadline: row.deadline } : {}) };
}
