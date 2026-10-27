import { describe, expect, it } from 'vitest';
import { campaignSubmissionInput, creatorProfileInput, literalCreatorSearch, platformWorkUrl, publicWorkUrl } from '../../src/services/creatorPolicy';

const profile = () => ({ isDiscoverable: true, displayName: 'Campus Studio', availability: 'available', platforms: [{ platform: 'instagram', handle: '@campusstudio', profileUrl: 'https://www.instagram.com/campusstudio/', followerCount: 0 }], niches: ['Campus life'], contentTypes: ['Video'], compensationPreference: ['paid'], sampleWorkLinks: [] });
describe('creator profile and public-work policy', () => {
  it('preserves an explicit public alias, availability and zero followers', () => {
    expect(creatorProfileInput(profile())).toMatchObject({ displayName: 'Campus Studio', availability: 'available', platforms: [{ followerCount: 0 }] });
    const legacy = profile(); delete (legacy as Partial<typeof legacy>).availability;
    expect(creatorProfileInput(legacy).availability).toBe('available');
  });
  it.each(['https://instagram.com.evil.test/campus', 'https://instagram.com@evil.test/campus', 'https://user:secret@instagram.com/campus', 'https://instagrаm.com/campus', 'https://instagram.com:444/campus', 'javascript:alert(1)', 'https://evil.test\\@instagram.com/campus'])('rejects misleading platform link %s', (url) => {
    expect(() => platformWorkUrl('instagram', url)).toThrow();
  });
  it.each(['http://127.0.0.1/file', 'https://localhost/file', 'https://private.local/file', 'https://user:password@portfolio.example.test/file', 'data:text/html,work'])('rejects private or credential-bearing work link %s', (url) => {
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
