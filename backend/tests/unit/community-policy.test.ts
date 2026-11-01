import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { claimRevision, claimTarget, claimTransition, communityApproved, communityProfile, communityVisible } from '../../src/services/communityPolicy';
import type { CommunityClaimRecord } from '../../src/models/CommunityClaim';
import { directoryContacts } from '../../src/data/communityDirectory';
import User from '../../src/models/User';
import { lecturerFixture, studentFixture, ids } from '../support/fixtures';

const documentId = new Types.ObjectId();
const provider = () => new User({ ...lecturerFixture(), providerProfile: { ...lecturerFixture().providerProfile, verificationDocumentId: documentId } });
const claim = (): CommunityClaimRecord => ({ providerId: ids.lecturer, directoryId: 'ict-chandana', documentId, institution: 'University of Ruhuna', justification: 'Synthetic claim justification.', status: 'APPROVED', revision: 1, profile: { visibility: 'members', acceptsStudentMessages: true, expertise: ['TypeScript'], availability: '', bio: '' }, createdAt: new Date(), updatedAt: new Date() });

describe('community claim eligibility and ownership', () => {
  it('uses a stable catalog ID and matching provider category', () => {
    expect(claimTarget('ict-chandana', provider()).id).toBe('ict-chandana');
    expect(new Set(directoryContacts.map((item) => item.id)).size).toBe(directoryContacts.length);
  });
  it('rejects student, administrator and suspended claimants', () => {
    expect(() => claimTarget('ict-chandana', new User(studentFixture()))).toThrow('faculty or alumni');
    for (const changes of [{ role: 'admin' }, { accountStatus: 'suspended' }]) expect(() => claimTarget('ict-chandana', Object.assign(provider(), changes))).toThrow('faculty or alumni');
  });
  it.each(['unknown-id', 'alumni-rishitha', undefined, { $ne: null }])('rejects unknown or mismatched directory identities', (id) => {
    expect(() => claimTarget(id, provider())).toThrow('matching your');
  });
  it('does not infer an approved identity from a name, email or old provider flag', () => {
    const account = provider(); account.fullName = directoryContacts[0].name;
    expect(communityApproved(account, null)).toBe(false);
    expect(communityApproved(account, claim())).toBe(true);
  });
  it.each(['PENDING', 'NEEDS_INFO', 'REJECTED', 'REVOKED'] as const)('withholds eligibility for claim status %s', (status) => {
    expect(communityApproved(provider(), { ...claim(), status })).toBe(false);
  });
  it('requires current ownership, type, document, verification and account status', () => {
    expect(communityApproved(provider(), { ...claim(), providerId: ids.outsider })).toBe(false);
    expect(communityApproved(provider(), { ...claim(), documentId: new Types.ObjectId() })).toBe(false);
    expect(communityApproved(provider(), { ...claim(), directoryId: 'alumni-rishitha' })).toBe(false);
    for (const apply of [
      (user: ReturnType<typeof provider>) => { user.accountStatus = 'suspended'; },
      (user: ReturnType<typeof provider>) => { user.role = 'admin'; },
      (user: ReturnType<typeof provider>) => { user.providerProfile!.verified = false; },
      (user: ReturnType<typeof provider>) => { user.providerProfile!.verificationStatus = 'NEEDS_INFO'; },
    ]) { const user = provider(); apply(user); expect(communityApproved(user, claim())).toBe(false); }
    expect(communityVisible(provider(), { ...claim(), profile: { ...claim().profile, visibility: 'hidden' } })).toBe(false);
  });
  it.each([undefined, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1])('rejects invalid revisions', (value) => expect(() => claimRevision(value)).toThrow('revision'));
});

describe('community decisions and owner privacy validation', () => {
  it.each([['approve', 'APPROVED'], ['reject', 'REJECTED'], ['request-info', 'NEEDS_INFO']] as const)('permits pending %s decisions', (action, target) => {
    expect(claimTransition('PENDING', action)).toBe(target);
  });
  it('permits explicit revocation of an approved claim', () => expect(claimTransition('APPROVED', 'revoke')).toBe('REVOKED'));
  it.each(['APPROVED', 'REJECTED', 'REVOKED', 'NEEDS_INFO'] as const)('prevents direct approval from %s', (status) => expect(() => claimTransition(status, 'approve')).toThrow('not valid'));
  it('rejects unknown decisions and revoking a pending claim', () => {
    expect(() => claimTransition('PENDING', 'anything')).toThrow(); expect(() => claimTransition('PENDING', 'revoke')).toThrow();
  });
  it('accepts bounded privacy settings and normalizes expertise without HTML interpretation', () => {
    expect(communityProfile({ ...claim().profile, expertise: [' TypeScript ', 'TypeScript'], bio: '<script>plain text</script>' })).toMatchObject({ expertise: ['TypeScript'], bio: '<script>plain text</script>' });
  });
  it.each([
    { status: 'APPROVED' }, { providerId: ids.outsider }, { directoryId: 'alumni-rishitha' },
    { visibility: 'public' }, { acceptsStudentMessages: 'yes' }, { expertise: ['x'.repeat(81)] },
    { expertise: Array(13).fill('topic') }, { expertise: [{ $ne: null }] }, { availability: 'x'.repeat(201) }, { bio: 'x'.repeat(1001) },
  ])('rejects forged ownership/status and invalid privacy fields', (changes) => {
    expect(() => communityProfile({ ...claim().profile, ...changes })).toThrow();
  });
});
