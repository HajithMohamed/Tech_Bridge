import type { IUser } from '../models/User';
import type { IOpportunity } from '../models/Opportunity';
import { matchScore } from '../utils/matchEngine';

export class ScholarshipError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}
export interface ScholarshipPolicyValues {
  weights: { need: number; fit: number; benefits: number; timing: number };
  eligibility: { degrees: string[]; institutions: string[]; requiredSkills: string[]; minStudyYear: number; maxStudyYear: number; requireEvidence: boolean };
  duplicateBenefitPolicy: 'application_year' | 'lifetime' | 'allow_multiple';
}
export const defaultScholarshipPolicy = (): ScholarshipPolicyValues => ({ weights: { need: 40, fit: 30, benefits: 20, timing: 10 }, eligibility: { degrees: [], institutions: [], requiredSkills: [], minStudyYear: 1, maxStudyYear: 6, requireEvidence: false }, duplicateBenefitPolicy: 'application_year' });
export const academicYearStart = (now = new Date()) => new Date(now.getFullYear(), 0, 1);
export function awardCapacity(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new ScholarshipError(409, 'This scholarship has an invalid award capacity.');
  return value;
}
export function scholarshipId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new ScholarshipError(400, 'Provide a valid scholarship or application ID.');
  return value;
}
export function scholarshipReason(value: unknown, minimum = 10, maximum = 1000): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new ScholarshipError(400, `Provide a plain-text reason of ${minimum}-${maximum} characters.`);
  return value.trim();
}
export function scholarshipRevision(value: unknown, required = false): number | undefined {
  if (value === undefined && !required) return undefined;
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 10000) throw new ScholarshipError(400, 'Provide a valid expected scholarship revision.');
  return Number(value);
}
const labels = (value: unknown, count: number, length: number): string[] => {
  if (!Array.isArray(value) || value.length > count || value.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > length || /[<>\u0000-\u001f\u007f]/.test(item))) throw new ScholarshipError(400, 'Provide bounded plain-text eligibility lists.');
  return [...new Set(value.map((item: string) => item.trim().toLowerCase()))];
};
export function scholarshipPolicyInput(value: unknown): ScholarshipPolicyValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ScholarshipError(400, 'Provide scholarship policy settings.');
  const body = value as Record<string, any>; const weights = body.weights; const rules = body.eligibility;
  if (!weights || typeof weights !== 'object' || Array.isArray(weights) || ['need', 'fit', 'benefits', 'timing'].some((key) => !Number.isInteger(weights[key]) || weights[key] < 0 || weights[key] > 100) || ['need', 'fit', 'benefits', 'timing'].reduce((sum, key) => sum + weights[key], 0) !== 100) throw new ScholarshipError(400, 'Priority weights must be whole percentages totaling 100.');
  if (!rules || typeof rules !== 'object' || Array.isArray(rules) || !Number.isInteger(rules.minStudyYear) || !Number.isInteger(rules.maxStudyYear) || rules.minStudyYear < 1 || rules.maxStudyYear > 6 || rules.minStudyYear > rules.maxStudyYear || typeof rules.requireEvidence !== 'boolean') throw new ScholarshipError(400, 'Provide valid study-year limits and an evidence requirement.');
  const degrees = labels(rules.degrees, 4, 10); const institutions = labels(rules.institutions, 20, 150); const requiredSkills = labels(rules.requiredSkills, 20, 60);
  if (degrees.some((degree) => !['ict', 'et', 'bst', 'other'].includes(degree))) throw new ScholarshipError(400, 'Choose valid degree programmes.');
  if (!['application_year', 'lifetime', 'allow_multiple'].includes(body.duplicateBenefitPolicy)) throw new ScholarshipError(400, 'Choose a valid duplicate-benefit policy.');
  return { weights: { need: weights.need, fit: weights.fit, benefits: weights.benefits, timing: weights.timing }, eligibility: { degrees, institutions, requiredSkills, minStudyYear: rules.minStudyYear, maxStudyYear: rules.maxStudyYear, requireEvidence: rules.requireEvidence }, duplicateBenefitPolicy: body.duplicateBenefitPolicy };
}
export function scholarshipEligibility(student: Pick<IUser, 'role' | 'accountStatus' | 'studentProfile'> | undefined, policy: ScholarshipPolicyValues) {
  const reasons: string[] = []; const profile = student?.studentProfile;
  if (!student || student.role !== 'student' || student.accountStatus !== 'active' || !profile) reasons.push('An active student profile is required.');
  if (policy.eligibility.degrees.length && !policy.eligibility.degrees.includes(profile?.degree?.toLowerCase() ?? '')) reasons.push('Degree programme does not meet the published policy.');
  if (policy.eligibility.institutions.length && !policy.eligibility.institutions.includes(profile?.institution?.trim().toLowerCase() ?? '')) reasons.push('Institution does not meet the published policy.');
  if (!Number.isInteger(profile?.studyYear) || profile!.studyYear < policy.eligibility.minStudyYear || profile!.studyYear > policy.eligibility.maxStudyYear) reasons.push('Study year does not meet the published policy.');
  const skills = new Set((profile?.skills ?? []).map((skill) => skill.trim().toLowerCase()));
  if (policy.eligibility.requiredSkills.some((skill) => !skills.has(skill))) reasons.push('Required skills are missing from the student profile.');
  return { eligible: reasons.length === 0, reasons };
}
export function scholarshipPriority(need: unknown, student: IUser | undefined, opportunity: IOpportunity, policy: ScholarshipPolicyValues, benefits: number, appliedAt: Date, timingStart: Date, timingEnd: Date) {
  if (!['low', 'medium', 'high'].includes(need as string)) throw new ScholarshipError(400, 'Select a valid declared need.');
  const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const dates = [appliedAt, timingStart, timingEnd].map((date) => date.getTime());
  const components = {
    need: { low: 100 / 3, medium: 200 / 3, high: 100 }[need as 'low' | 'medium' | 'high'],
    fit: clamp(student ? matchScore(student.studentProfile, opportunity).matchPercentage : 50),
    benefits: clamp(100 - Math.max(0, Number.isFinite(benefits) ? benefits : 0) * 40),
    timing: dates.every(Number.isFinite) && dates[2] > dates[1] ? clamp(100 * (dates[2] - dates[0]) / (dates[2] - dates[1])) : 50,
  };
  const priorityScore = Math.round((Object.keys(components) as (keyof typeof components)[]).reduce((sum, key) => sum + components[key] * policy.weights[key] / 100, 0));
  return { priorityScore, components, weights: { ...policy.weights }, priorityReasons: [`${need} self-declared need; not independently verified`, `Rule-based profile fit: ${components.fit}/100`, `${benefits} prior accepted scholarship allocation(s) in the scoring period`, `Submission timing: ${Math.round(components.timing)}/100`, 'Advisory score only; a recorded human decision is required.'] };
}
export function compareScholarshipCandidates(a: { priorityScore: number; appliedAt: Date; _id: unknown }, b: { priorityScore: number; appliedAt: Date; _id: unknown }) {
  return b.priorityScore - a.priorityScore || a.appliedAt.getTime() - b.appliedAt.getTime() || String(a._id).localeCompare(String(b._id));
}
export function scholarshipTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed: Record<string, string[]> = { applied: ['reviewed', 'waitlisted', 'accepted', 'rejected'], reviewed: ['waitlisted', 'accepted', 'rejected'], waitlisted: ['reviewed', 'accepted', 'rejected'], rejected: ['reviewed'], accepted: ['reviewed', 'rejected'] };
  return allowed[from]?.includes(to) ?? false;
}
export function duplicateBenefitConflict(policy: ScholarshipPolicyValues['duplicateBenefitPolicy'], benefits: { appliedAt: Date; restriction?: ScholarshipPolicyValues['duplicateBenefitPolicy'] }[], now = new Date()): boolean {
  const current = academicYearStart(now).getTime();
  return benefits.some((benefit) => policy === 'lifetime' || (policy === 'application_year' && benefit.appliedAt.getTime() >= current) || benefit.restriction === 'lifetime' || ((benefit.restriction ?? 'application_year') === 'application_year' && benefit.appliedAt.getTime() >= current));
}
