import { describe, expect, it } from 'vitest';
import { assertFutureCampaignDeadline, campaignStage, campaignTerms, legacyCampaignStatus, statusTransition } from '../../src/services/campaignLifecycle';
import { campaignDeadline, campaignProposalInput, campaignRevision, campaignSubmissionInput } from '../../src/services/creatorPolicy';
import type { CampaignStage } from '../../src/models/PromotionRequest';

const proposal = () => ({ studentId: '000000000000000000000001', campaignBrief: 'Campus promotion', deliverables: 'One portfolio video', compensationType: 'paid', compensationDetails: 'Proposed LKR 1000 for the described work', deadline: '2099-01-01T00:00:00.000Z' });
describe('explicit campaign status transitions', () => {
  it.each([
    ['draft', 'provider', 'pending'], ['draft', 'provider', 'cancelled'],
    ['pending', 'student', 'accepted'], ['pending', 'student', 'declined'],
    ['accepted', 'student', 'in_progress'], ['accepted', 'provider', 'in_progress'],
    ['reviewed', 'provider', 'completed'], ['submitted', 'student', 'cancelled'], ['changes_requested', 'provider', 'cancelled'],
  ] as const)('permits %s -> %s acting toward %s', (from, actor, target) => expect(statusTransition(from, actor, target)).toBe(target));
  it.each([
    ['draft', 'student', 'pending'], ['draft', 'student', 'cancelled'], ['pending', 'provider', 'accepted'],
    ['pending', 'provider', 'declined'], ['pending', 'student', 'completed'], ['accepted', 'provider', 'completed'],
    ['in_progress', 'student', 'submitted'], ['submitted', 'provider', 'reviewed'], ['reviewed', 'student', 'completed'],
    ['completed', 'student', 'cancelled'], ['cancelled', 'provider', 'pending'], ['declined', 'student', 'accepted'],
  ] as const)('rejects stage skipping, wrong roles and terminal reuse: %s %s %s', (from, actor, target) => expect(() => statusTransition(from, actor, target)).toThrow());
  it.each(['draft', 'pending', 'accepted', 'in_progress', 'submitted', 'changes_requested', 'reviewed', 'completed', 'declined', 'cancelled'] as CampaignStage[])('preserves legacy summary mapping for %s', (stage) => {
    const status = legacyCampaignStatus(stage); expect(['pending', 'accepted', 'declined', 'completed', 'cancelled']).toContain(status);
    expect(campaignStage({ stage, status })).toBe(stage);
  });
  it('maps legacy versions without inventing stored progress or rewriting them', () => {
    expect(campaignStage({ status: 'accepted' })).toBe('accepted'); expect(campaignStage({ status: 'accepted', deliveryStatus: 'submitted' })).toBe('submitted');
    expect(campaignStage({ status: 'accepted', deliveryStatus: 'changes_requested' })).toBe('changes_requested'); expect(campaignStage({ status: 'accepted', deliveryStatus: 'approved' })).toBe('reviewed'); expect(campaignStage({ status: 'completed', deliveryStatus: 'approved' })).toBe('completed');
  });
});
describe('campaign terms, compensation and deadlines', () => {
  it.each(['paid', 'product_exchange', 'experience', 'affiliate'])('supports bounded %s compensation proposals without payment processing', (compensationType) => expect(campaignProposalInput({ ...proposal(), compensationType }).compensationType).toBe(compensationType));
  it.each([{ campaignBrief: '' }, { deliverables: 'x'.repeat(2001) }, { compensationType: 'bank_transfer' }, { compensationDetails: {} }, { compensationDetails: 'x'.repeat(1001) }, { campaignBrief: '<script>' }, { studentId: { $ne: null } }])('rejects malformed terms %j', (patch) => expect(() => campaignProposalInput({ ...proposal(), ...patch })).toThrow());
  it.each(['2099-01-01', '2099-01-01T12:00:00Z', '2099-01-01T12:00:00.123+05:30'])('accepts a valid explicit date %s', (date) => expect(campaignDeadline(date)).toBeInstanceOf(Date));
  it.each(['2099-02-30', 'tomorrow', '2099-01-01T12:00:00', '2099-01-01T24:00:00Z', 123, true, {}, null])('rejects invalid or ambiguous deadlines %j', (date) => expect(() => campaignDeadline(date)).toThrow());
  it('supports omitted dates and rejects equal/past acceptance deadlines', () => {
    expect(campaignDeadline(undefined)).toBeUndefined(); expect(campaignDeadline('')).toBeUndefined();
    const deadline = new Date('2099-01-01T00:00:00Z'); expect(() => assertFutureCampaignDeadline(deadline, deadline.getTime())).toThrow(); expect(() => assertFutureCampaignDeadline(deadline, deadline.getTime() - 1)).not.toThrow();
    expect(() => campaignProposalInput({ ...proposal(), deadline: '2000-01-01' })).toThrow();
  });
  it('copies only contractual terms into immutable agreement snapshots', () => {
    const terms = campaignProposalInput(proposal()); expect(campaignTerms(terms)).not.toHaveProperty('studentId'); expect(campaignTerms(terms)).toMatchObject({ compensationType: 'paid', deliverables: proposal().deliverables });
  });
  it.each([-1, 1.5, '1', {}, 1001])('rejects invalid expected revisions %j', (revision) => expect(() => campaignRevision(revision)).toThrow());
  it('retains optional legacy revisions and bounded deliverable references', () => {
    expect(campaignRevision(undefined)).toBeUndefined(); expect(campaignRevision(0)).toBe(0);
    expect(() => campaignSubmissionInput({ text: '<img src=x>' })).toThrow(); expect(() => campaignSubmissionInput({ urls: Array(7).fill('https://portfolio.example.test') })).toThrow();
    expect(campaignSubmissionInput({ text: 'Line one\nLine two', urls: [] }).text).toContain('\n');
  });
});
