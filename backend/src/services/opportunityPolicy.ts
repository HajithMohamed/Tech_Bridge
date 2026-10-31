import { Types } from 'mongoose';
import type { IUser } from '../models/User';
import type { IOpportunity, OpportunityType } from '../models/Opportunity';
import { ScholarshipError } from './scholarshipPolicy';
import { canonicalSkill } from '../utils/matchEngine';

export const opportunityTypes: OpportunityType[] = ['job', 'internship', 'scholarship', 'course', 'freelance', 'promotion', 'workshop', 'mentorship'];
export interface OpportunityEligibility { degrees: string[]; institutions: string[]; requiredSkills: string[]; minStudyYear: number; maxStudyYear: number }
export const defaultOpportunityEligibility = (): OpportunityEligibility => ({ degrees: [], institutions: [], requiredSkills: [], minStudyYear: 1, maxStudyYear: 6 });
export function opportunityObject(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new ScholarshipError(400, 'Provide only supported opportunity fields.');
  return value as Record<string, unknown>;
}
export function opportunityText(value: unknown, min = 1, max = 80) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new ScholarshipError(400, `Provide text of ${min}–${max} characters without control characters.`);
  return value.trim();
}
export function opportunityId(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new ScholarshipError(400, 'Invalid opportunity or application ID.');
  return new Types.ObjectId(value);
}
export function opportunityPage(value: unknown, fallback = 1, max = 10000) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw new ScholarshipError(400, `Select a page or limit from 1 to ${max}.`);
  return Number(value);
}
export function opportunityDate(value: unknown): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value)) throw new ScholarshipError(400, 'Use a calendar date or explicit UTC timestamp.');
  const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value.length === 20 ? value.replace('Z', '.000Z') : value;
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()) || result.toISOString() !== normalized) throw new ScholarshipError(400, 'Invalid calendar date.');
  return result;
}
export function effectiveOpportunityStatus(opportunity: Pick<IOpportunity, 'status' | 'applicationDeadline'>, now = new Date()) {
  return opportunity.status === 'open' && opportunity.applicationDeadline <= now ? 'expired' : opportunity.status;
}
export const providerCurrentlyVerified = (user: Pick<IUser, 'role' | 'accountStatus' | 'providerProfile' | 'requiresEmailVerification' | 'emailVerifiedAt'> | null) => Boolean(user?.role === 'provider' && user.accountStatus !== 'suspended' && user.providerProfile?.verified === true && user.providerProfile.verificationStatus === 'VERIFIED' && (!user.requiresEmailVerification || user.emailVerifiedAt));
export function eligibilityInput(value: unknown): OpportunityEligibility {
  const body = opportunityObject(value, ['degrees', 'institutions', 'requiredSkills', 'minStudyYear', 'maxStudyYear']);
  const list = (value: unknown, max: number, length: number) => {
    if (!Array.isArray(value) || value.length > max) throw new ScholarshipError(400, 'Provide bounded eligibility lists.');
    return [...new Set(value.map(item => opportunityText(item, 1, length).toLowerCase()))];
  };
  const degrees = list(body.degrees, 4, 10); const institutions = list(body.institutions, 20, 150); const requiredSkills = list(body.requiredSkills, 20, 60);
  if (degrees.some(value => !['ict', 'et', 'bst', 'other'].includes(value)) || !Number.isInteger(body.minStudyYear) || !Number.isInteger(body.maxStudyYear) || Number(body.minStudyYear) < 1 || Number(body.maxStudyYear) > 6 || Number(body.minStudyYear) > Number(body.maxStudyYear)) throw new ScholarshipError(400, 'Choose valid degree programmes and study-year bounds.');
  return { degrees, institutions, requiredSkills, minStudyYear: Number(body.minStudyYear), maxStudyYear: Number(body.maxStudyYear) };
}
export function explainOrdinaryEligibility(student: Pick<IUser, 'role' | 'accountStatus' | 'studentProfile' | 'requiresEmailVerification' | 'emailVerifiedAt'> | null, rules: OpportunityEligibility) {
  const profile = student?.studentProfile;
  const skills = new Set((profile?.skills ?? []).map(canonicalSkill));
  const checks = [
    { code: 'active_student', passed: Boolean(student?.role === 'student' && student.accountStatus !== 'suspended' && profile && (!student.requiresEmailVerification || student.emailVerifiedAt)), explanation: 'An active student profile and any required email verification are needed.' },
    { code: 'degree', passed: !rules.degrees.length || rules.degrees.includes(profile?.degree?.toLowerCase() ?? ''), explanation: 'Degree programme must meet the explicitly published requirements.' },
    { code: 'institution', passed: !rules.institutions.length || rules.institutions.includes(profile?.institution?.trim().toLowerCase() ?? ''), explanation: 'Institution must meet the explicitly published requirements.' },
    { code: 'study_year', passed: Boolean(profile && Number.isInteger(profile.studyYear) && profile.studyYear >= rules.minStudyYear && profile.studyYear <= rules.maxStudyYear), explanation: 'Study year must fall within the published range.' },
    { code: 'required_skills', passed: rules.requiredSkills.every(skill => skills.has(canonicalSkill(skill))), explanation: 'All explicitly mandatory skills are required; matching preferences alone do not block an application.' },
  ];
  return { eligible: checks.every(check => check.passed), checks, reasons: checks.filter(check => !check.passed).map(check => check.explanation) };
}
export function ordinaryApplicationTransition(from: string, to: string, reason?: unknown) {
  if (from === to) return;
  const allowed: Record<string, string[]> = { applied: ['reviewed', 'accepted', 'rejected'], reviewed: ['accepted', 'rejected'], accepted: ['reviewed', 'rejected'], rejected: ['reviewed'] };
  if (!allowed[from]?.includes(to)) throw new ScholarshipError(409, 'This application status transition is not allowed.');
  if (to === 'reviewed' && ['accepted', 'rejected'].includes(from) && reason === undefined) throw new ScholarshipError(400, 'Provide a reason when reopening a decided application.');
  if (reason !== undefined) opportunityText(reason, 10, 1000);
}
const literal = (value: unknown) => opportunityText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function opportunitySearch(queryValue: unknown, now = new Date(), matched = false) {
  const query = opportunityObject(queryValue, ['type', 'skill', 'workMode', 'q', 'location', 'providerId', 'deadlineFrom', 'deadlineTo', 'isPaid', 'isFree', 'page', 'limit', 'sort']);
  const page = opportunityPage(query.page, 1, matched ? 100 : 10000); const limit = opportunityPage(query.limit, 20, matched ? 50 : 100);
  const filter: Record<string, unknown> = { status: 'open', scholarshipWithdrawnByAdmin: { $ne: true }, opportunityWithdrawnByAdmin: { $ne: true }, applicationDeadline: { $gt: now } };
  if (query.type !== undefined) { if (!opportunityTypes.includes(query.type as OpportunityType)) throw new ScholarshipError(400, 'Select a valid opportunity type.'); filter.type = query.type; }
  if (query.workMode !== undefined) { if (!['remote', 'on-site', 'hybrid'].includes(query.workMode as string)) throw new ScholarshipError(400, 'Select a valid work mode.'); filter.workMode = query.workMode; }
  if (query.skill !== undefined) filter.requiredSkills = { $regex: literal(query.skill), $options: 'i' };
  if (query.location !== undefined) filter.location = { $regex: literal(query.location), $options: 'i' };
  if (query.providerId !== undefined) filter.providerId = opportunityId(query.providerId);
  if (query.q !== undefined) { const q = literal(query.q); filter.$or = [{ title: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }]; }
  for (const key of ['isPaid', 'isFree']) if (query[key] !== undefined) { if (!['true', 'false'].includes(query[key] as string)) throw new ScholarshipError(400, 'Use true or false for paid/free filters.'); filter[key] = query[key] === 'true'; }
  const from = query.deadlineFrom === undefined ? undefined : opportunityDate(query.deadlineFrom); const to = query.deadlineTo === undefined ? undefined : opportunityDate(query.deadlineTo);
  if (from && to && from > to) throw new ScholarshipError(400, 'Deadline bounds are reversed.');
  if (from || to) filter.applicationDeadline = { $gt: now, ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const sort = query.sort ?? (matched ? 'match' : 'newest');
  if (!(matched ? ['match'] : ['newest', 'deadline']).includes(sort as string)) throw new ScholarshipError(400, 'Select a valid opportunity ordering.');
  const ordering: Record<string, 1 | -1> = sort === 'deadline' ? { applicationDeadline: 1, _id: 1 } : { createdAt: -1, _id: -1 };
  return { filter, page, limit, sort: ordering };
}
