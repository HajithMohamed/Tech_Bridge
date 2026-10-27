import { describe, expect, it } from 'vitest';
import type { ICreatorProfile } from '../../src/models/User';
import { campaignSubmissionInput, creatorPage, creatorProfileInput, creatorQueryText, creatorRevision, literalCreatorSearch, platformWorkUrl, publicCreator, publicWorkUrl } from '../../src/services/creatorPolicy';

const profile = () => ({ isDiscoverable: true, displayName: 'Campus Studio', availability: 'available', platforms: [{ platform: 'instagram', handle: '@campusstudio', profileUrl: 'https://www.instagram.com/campusstudio/', followerCount: 0 }], niches: ['Campus life'], contentTypes: ['Video'], compensationPreference: ['paid'], sampleWorkLinks: [] } satisfies ICreatorProfile);
describe('creator profile and public-work policy', () => {
  it('preserves an explicit public alias, availability and zero followers', () => {
    expect(creatorProfileInput(profile())).toMatchObject({ displayName: 'Campus Studio', availability: 'available', platforms: [{ followerCount: 0 }] });
    const legacy = profile(); delete (legacy as Partial<typeof legacy>).availability;
    expect(creatorProfileInput(legacy).availability).toBe('available');
  });
  it.each(['https://instagram.com.evil.test/campus', 'https://instagram.com@evil.test/campus', 'https://user:secret@instagram.com/campus', 'https://instagrаm.com/campus', 'https://instagram.com:444/campus', 'javascript:alert(1)', 'https://evil.test\\@instagram.com/campus'])('rejects misleading platform link %s', (url) => {
    expect(() => platformWorkUrl('instagram', url)).toThrow();
  });
  it.each(['http://127.0.0.1/file', 'https://localhost/file', 'https://private.local/file', 'https://user:password@portfolio.example.test/file', 'data:text/html,work', 'https://[::ffff:127.0.0.1]/file', 'http://2130706433/file', 'https://portfolio.example.test/<script>', 'https://portfolio.example.test/\u0000file'])('rejects private or credential-bearing work link %s', (url) => {
    expect(() => publicWorkUrl(url)).toThrow();
  });
  it('matches directory search punctuation literally', () => {
    const pattern = new RegExp(literalCreatorSearch('Campus [A].*'), 'i');
    expect(pattern.test('Campus [A].* studio')).toBe(true);
    expect(pattern.test('Campus A studio')).toBe(false);
    expect(new RegExp(literalCreatorSearch('a+b? (video)'), 'i').test('a+b? (video)')).toBe(true);
  });
  it('requires opt-in profile details and valid bounded submissions', () => {
    expect(() => creatorProfileInput({ ...profile(), platforms: [] })).toThrow();
    expect(() => creatorProfileInput({ ...profile(), availability: 'unknown' })).toThrow();
    expect(() => campaignSubmissionInput({ text: '', urls: [] })).toThrow();
    expect(campaignSubmissionInput({ text: 'Completed draft', urls: ['https://portfolio.example.test/draft'] })).toMatchObject({ text: 'Completed draft' });
  });
});

describe('complete creator profile boundaries', () => {
  it.each([
    ['instagram', 'https://instagram.com/campus'], ['tiktok', 'https://www.tiktok.com/@campus'],
    ['youtube', 'https://youtube.com/@campus'], ['facebook', 'https://www.facebook.com/campus'],
    ['other', 'https://portfolio.example.test/campus'],
  ] as const)('accepts official %s links without fetching social accounts', (platform, profileUrl) => {
    expect(creatorProfileInput({ ...profile(), platforms: [{ platform, handle: 'campus', profileUrl }] }).platforms[0]).toEqual({ platform, handle: 'campus', profileUrl });
  });
  it.each([-1, 1.2, 1_000_000_001, '100', true, NaN, Infinity])('rejects invalid follower counts %s', (followerCount) => {
    expect(() => creatorProfileInput({ ...profile(), platforms: [{ ...profile().platforms[0], followerCount }] })).toThrow();
  });
  it('accepts bounded metrics, optional images, and explicit institution consent', () => {
    const result = creatorProfileInput({ ...profile(), profileImageUrl: 'https://images.example.test/avatar.png', showInstitution: true, platforms: [{ ...profile().platforms[0], followerCount: 1_000_000_000 }] });
    expect(result).toMatchObject({ showInstitution: true, profileImageUrl: 'https://images.example.test/avatar.png', platforms: [{ followerCount: 1_000_000_000 }] });
    expect(creatorProfileInput(profile()).showInstitution).toBe(false);
  });
  it.each([
    { isDiscoverable: 'true' }, { availability: {} }, { showInstitution: 'true' },
    { displayName: '<script>alert(1)</script>' }, { displayName: 'Campus\nStudio' },
    { niches: ['<b>Campus</b>'] }, { contentTypes: ['Video\u0000'] },
    { platforms: [{ ...profile().platforms[0], handle: '<img>' }] },
    { platforms: [{ ...profile().platforms[0], platform: 'invalid' }] },
    { platforms: Array(7).fill(profile().platforms[0]) },
    { niches: Array(13).fill('Campus') }, { contentTypes: Array(13).fill('Video') },
    { sampleWorkLinks: Array(9).fill('https://portfolio.example.test') },
    { compensationPreference: ['free_private_data'] },
    { profileImageUrl: 'data:image/svg+xml,script' },
  ])('rejects malformed, unsafe or unbounded profile fields %j', (patch) => {
    expect(() => creatorProfileInput({ ...profile(), ...patch })).toThrow();
  });
  it('does not accept client-supplied verification, ownership or revision metadata', () => {
    const result = creatorProfileInput({ ...profile(), _id: 'someone-else', role: 'admin', revision: 99, verificationStatus: 'verified', metricsSource: 'verified' });
    expect(result).not.toHaveProperty('_id'); expect(result).not.toHaveProperty('role'); expect(result).not.toHaveProperty('revision');
    expect(result).not.toHaveProperty('verificationStatus'); expect(result).not.toHaveProperty('metricsSource');
  });
  it('deduplicates labels and preserves a private incomplete draft', () => {
    expect(creatorProfileInput({ ...profile(), niches: [' Campus ', 'Campus'] }).niches).toEqual(['Campus']);
    expect(creatorProfileInput({ isDiscoverable: false, platforms: [], niches: [], contentTypes: [], compensationPreference: [] }).isDiscoverable).toBe(false);
  });
});

describe('public creator response privacy', () => {
  const student = () => ({ _id: 'owner', fullName: 'Private Legal Name', email: 'private@example.test', password: 'private-hash', studentProfile: { institution: 'Test University', degree: 'ICT', creatorProfile: { ...profile(), revision: 8, internalNotes: 'private', verificationStatus: 'verified' } } });
  it('exposes only public fields and labels owner-supplied metrics as self reported', () => {
    const result = publicCreator(student()); const serialized = JSON.stringify(result);
    expect(result.fullName).toBe('Campus Studio'); expect(result.studentProfile.creatorProfile).toMatchObject({ metricsSource: 'self_reported', verificationStatus: 'unverified', platforms: [{ followerCount: 0 }] });
    for (const secret of ['Private Legal Name', 'private@example.test', 'private-hash', 'Test University', 'internalNotes', 'revision']) expect(serialized).not.toContain(secret);
  });
  it('exposes institution only after separate consent, without verifying affiliation', () => {
    const value = student(); Object.assign(value.studentProfile.creatorProfile, { showInstitution: true });
    expect(publicCreator(value).studentProfile).toMatchObject({ institution: 'Test University', institutionSource: 'self_reported' });
  });
  it('retains legacy names and availability defaults without inventing audience numbers', () => {
    const value = { _id: 'legacy', fullName: 'Opted In Legacy Name', studentProfile: { creatorProfile: { ...profile(), displayName: undefined, availability: undefined, platforms: [{ platform: 'youtube' as const, handle: 'campus', profileUrl: 'https://youtube.com/@campus' }] } } };
    const result = publicCreator(value); expect(result.fullName).toBe(value.fullName); expect(result.studentProfile.creatorProfile.availability).toBe('available'); expect(result.studentProfile.creatorProfile.platforms[0]).not.toHaveProperty('followerCount');
  });
});

describe('creator filter and optimistic revision boundaries', () => {
  it.each([0, 1, 40])('accepts expected revision %s', (revision) => expect(creatorRevision(revision)).toBe(revision));
  it.each([-1, 1.5, '1', null, {}, Number.MAX_SAFE_INTEGER, Infinity])('rejects invalid expected revision %s', (revision) => expect(() => creatorRevision(revision)).toThrow());
  it('allows legacy clients to omit revisions', () => expect(creatorRevision(undefined)).toBeUndefined());
  it.each(['0', '-1', '1.5', '10001', ['1'], { $gt: 1 }])('rejects invalid page %j', (page) => expect(() => creatorPage(page)).toThrow());
  it('bounds page sizes and rejects injected filter objects', () => {
    expect(creatorPage(undefined, 12, 24)).toBe(12); expect(creatorPage('24', 12, 24)).toBe(24); expect(() => creatorPage('25', 12, 24)).toThrow();
    expect(() => creatorQueryText({ $ne: null })).toThrow(); expect(() => creatorQueryText('x'.repeat(81))).toThrow(); expect(creatorQueryText(' Campus ')).toBe('Campus');
  });
});
