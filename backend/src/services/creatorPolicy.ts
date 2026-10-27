import { isIP } from 'node:net';
import { Types } from 'mongoose';
import type { CreatorPlatform, ICreatorProfile } from '../models/User';
import type { PromotionCompensationType } from '../models/PromotionRequest';
import { AdminActionError } from './adminUsers';

export const creatorPlatforms: CreatorPlatform[] = ['instagram', 'tiktok', 'youtube', 'facebook', 'other'];
export const creatorCompensation: PromotionCompensationType[] = ['paid', 'product_exchange', 'experience', 'affiliate'];
export const creatorAvailability = ['available', 'busy', 'unavailable'] as const;
const platformHosts: Record<Exclude<CreatorPlatform, 'other'>, string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
};
export const creatorId = (value: unknown): Types.ObjectId => {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new AdminActionError(400, 'Choose a valid campaign or creator.');
  return new Types.ObjectId(value);
};
export function creatorText(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new AdminActionError(400, `${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function publicWorkUrl(value: unknown): string {
  const text = creatorText(value, 'Public link', 1, 500);
  let url: URL;
  try { url = new URL(text); } catch { throw new AdminActionError(400, 'Use a complete public HTTP or HTTPS link.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || /[\\\s\u0000-\u001f\u007f<>]/.test(text) || isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.') || url.hostname.endsWith('.') || /\.(local|localhost|internal)$/i.test(url.hostname)) throw new AdminActionError(400, 'Use a public HTTP or HTTPS link without credentials or a custom port.');
  return url.href;
}
export function platformWorkUrl(platform: CreatorPlatform, value: unknown): string {
  const href = publicWorkUrl(value);
  if (platform !== 'other' && !platformHosts[platform].includes(new URL(href).hostname)) throw new AdminActionError(400, `The ${platform} link must use that platform's official domain.`);
  return href;
}
function textList(value: unknown, name: string, count: number, length: number): string[] {
  if (!Array.isArray(value) || value.length > count || value.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > length)) throw new AdminActionError(400, `Provide up to ${count} valid ${name}.`);
  return [...new Set(value.map((item: string) => item.trim()))];
}
function profileText(value: unknown, name: string, min: number, max: number): string {
  const text = creatorText(value, name, min, max);
  if (/[\u0000-\u001f\u007f<>]/.test(text)) throw new AdminActionError(400, `${name} must be plain single-line text.`);
  return text;
}
export function creatorRevision(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) >= Number.MAX_SAFE_INTEGER) throw new AdminActionError(400, 'Provide a valid creator profile revision.');
  return Number(value);
}
export function creatorProfileInput(value: unknown): ICreatorProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AdminActionError(400, 'Provide your creator profile.');
  const body = value as Record<string, unknown>;
  if (typeof body.isDiscoverable !== 'boolean') throw new AdminActionError(400, 'Choose whether your creator profile is discoverable.');
  const displayName = body.displayName === undefined || body.displayName === '' ? undefined : profileText(body.displayName, 'Public display name', 2, 80);
  const availability = body.availability ?? 'available';
  if (!creatorAvailability.includes(availability as typeof creatorAvailability[number])) throw new AdminActionError(400, 'Choose a valid creator availability.');
  if (body.showInstitution !== undefined && typeof body.showInstitution !== 'boolean') throw new AdminActionError(400, 'Choose whether to show your institution.');
  const profileImageUrl = body.profileImageUrl === undefined || body.profileImageUrl === '' ? undefined : publicWorkUrl(body.profileImageUrl);
  const niches = textList(body.niches, 'niches', 12, 80).map((item) => profileText(item, 'Niche', 1, 80));
  const contentTypes = textList(body.contentTypes, 'content types', 12, 80).map((item) => profileText(item, 'Content type', 1, 80));
  const sampleWorkLinks = textList(body.sampleWorkLinks ?? [], 'sample-work links', 8, 500).map(publicWorkUrl);
  const preferences = textList(body.compensationPreference, 'compensation preferences', 4, 30);
  if (preferences.some((item) => !creatorCompensation.includes(item as PromotionCompensationType))) throw new AdminActionError(400, 'Choose valid compensation preferences.');
  if (!Array.isArray(body.platforms) || body.platforms.length > 6) throw new AdminActionError(400, 'Add up to six creator platforms.');
  const platforms = body.platforms.map((item) => {
    if (!item || typeof item !== 'object') throw new AdminActionError(400, 'Provide valid creator platforms.');
    const row = item as Record<string, unknown>; const platform = row.platform as CreatorPlatform;
    if (!creatorPlatforms.includes(platform)) throw new AdminActionError(400, 'Choose a valid creator platform.');
    if (row.followerCount !== undefined && (!Number.isInteger(row.followerCount) || Number(row.followerCount) < 0 || Number(row.followerCount) > 1_000_000_000)) throw new AdminActionError(400, 'Follower counts must be whole numbers between zero and one billion.');
    return { platform, handle: profileText(row.handle, 'Public handle', 1, 100), profileUrl: platformWorkUrl(platform, row.profileUrl), ...(typeof row.followerCount === 'number' ? { followerCount: row.followerCount } : {}) };
  });
  if (body.isDiscoverable && (!platforms.length || !niches.length || !contentTypes.length || !preferences.length)) throw new AdminActionError(400, 'Add a platform, niche, content type and compensation preference before becoming discoverable.');
  return { isDiscoverable: body.isDiscoverable, ...(displayName ? { displayName } : {}), ...(profileImageUrl ? { profileImageUrl } : {}), showInstitution: body.showInstitution === true, availability: availability as typeof creatorAvailability[number], platforms, niches, contentTypes, compensationPreference: preferences as PromotionCompensationType[], sampleWorkLinks };
}
/** Public data is explicitly projected; verification/metrics labels are server-owned. */
export function publicCreator(student: { _id: unknown; fullName: string; studentProfile?: { institution?: string; creatorProfile?: ICreatorProfile } }) {
  const profile = student.studentProfile?.creatorProfile;
  return {
    _id: student._id,
    fullName: profile?.displayName || student.fullName,
    studentProfile: {
      ...(profile?.showInstitution === true ? { institution: student.studentProfile?.institution, institutionSource: 'self_reported' } : {}),
      creatorProfile: {
        isDiscoverable: true,
        ...(profile?.displayName ? { displayName: profile.displayName } : {}),
        ...(profile?.profileImageUrl ? { profileImageUrl: profile.profileImageUrl } : {}),
        availability: profile?.availability ?? 'available',
        platforms: (profile?.platforms ?? []).map(({ platform, handle, profileUrl, followerCount }) => ({ platform, handle, profileUrl, ...(typeof followerCount === 'number' ? { followerCount } : {}) })),
        niches: profile?.niches ?? [], contentTypes: profile?.contentTypes ?? [],
        compensationPreference: profile?.compensationPreference ?? [], sampleWorkLinks: profile?.sampleWorkLinks ?? [],
        metricsSource: 'self_reported', verificationStatus: 'unverified',
      },
    },
  };
}
export const literalCreatorSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function creatorQueryText(value: unknown): string {
  if (value === undefined) return '';
  return creatorText(value, 'Search filter', 0, 80);
}
export function creatorPage(value: unknown, fallback = 1, max = 10_000): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new AdminActionError(400, 'Choose valid pagination.');
  return Number(value);
}
export function campaignProposalInput(body: Record<string, unknown>) {
  const compensationType = body.compensationType as PromotionCompensationType;
  if (!creatorCompensation.includes(compensationType)) throw new AdminActionError(400, 'Choose a valid compensation type.');
  const deadline = body.deadline ? new Date(String(body.deadline)) : undefined;
  if (deadline && (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now())) throw new AdminActionError(400, 'Campaign deadline must be in the future.');
  return { studentId: creatorId(body.studentId), campaignBrief: creatorText(body.campaignBrief, 'Campaign brief', 1, 1000), deliverables: creatorText(body.deliverables, 'Deliverables', 1, 2000), compensationType, ...(body.compensationDetails ? { compensationDetails: creatorText(body.compensationDetails, 'Compensation details', 1, 1000) } : {}), ...(deadline ? { deadline } : {}) };
}
export function campaignRevision(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 1000) throw new AdminActionError(400, 'Provide a valid campaign revision.');
  return Number(value);
}
export function campaignSubmissionInput(body: Record<string, unknown>) {
  const text = body.text === undefined || body.text === '' ? '' : creatorText(body.text, 'Submission notes', 1, 2000);
  const urls = textList(body.urls ?? [], 'deliverable links', 6, 500).map(publicWorkUrl);
  if (!text && !urls.length) throw new AdminActionError(400, 'Add submission notes or at least one public deliverable link.');
  return { text, urls };
}
