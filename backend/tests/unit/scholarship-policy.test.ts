import { describe, expect, it } from 'vitest';
import User from '../../src/models/User';
import Opportunity from '../../src/models/Opportunity';
import { ScholarshipPolicy } from '../../src/models/Scholarship';
import { academicYearStart, compareScholarshipCandidates, defaultScholarshipPolicy, duplicateBenefitConflict, scholarshipEligibility, scholarshipId, scholarshipPolicyInput, scholarshipPriority, scholarshipReason, scholarshipRevision, scholarshipTransition } from '../../src/services/scholarshipPolicy';
import { ids, scholarshipFixture, studentFixture } from '../support/fixtures';

const student = () => new User(studentFixture()); const opportunity = () => new Opportunity(scholarshipFixture());
const start = new Date('2026-01-01'), end = new Date('2026-12-31');
describe('bounded configurable scholarship policy', () => {
  it('preserves default weights without sharing mutable configuration', () => {
    expect(scholarshipPolicyInput(defaultScholarshipPolicy()).weights).toEqual({ need: 40, fit: 30, benefits: 20, timing: 10 });
    const first = defaultScholarshipPolicy(); first.weights.need = 0; expect(defaultScholarshipPolicy().weights.need).toBe(40);
  });
  it.each([{ need: 40, fit: 30, benefits: 20 }, { need: -1, fit: 31, benefits: 60, timing: 10 }, { need: '40', fit: 30, benefits: 20, timing: 10 }, { need: 41, fit: 30, benefits: 20, timing: 10 }, { need: Infinity, fit: 0, benefits: 0, timing: 0 }, []])('rejects malformed percentages %j', (weights) => expect(() => scholarshipPolicyInput({ ...defaultScholarshipPolicy(), weights })).toThrow());
  it.each([{ minStudyYear: 0 }, { maxStudyYear: 7 }, { minStudyYear: 5, maxStudyYear: 4 }, { requireEvidence: 'yes' }, { degrees: ['medicine'] }, { institutions: Array(21).fill('University') }, { requiredSkills: ['<script>'] }])('rejects invalid eligibility settings %j', (patch) => expect(() => scholarshipPolicyInput({ ...defaultScholarshipPolicy(), eligibility: { ...defaultScholarshipPolicy().eligibility, ...patch } })).toThrow());
  it('normalizes exact institution, skill and degree labels without accepting unrelated metadata', () => {
    const result = scholarshipPolicyInput({ ...defaultScholarshipPolicy(), providerId: 'spoofed', eligibility: { ...defaultScholarshipPolicy().eligibility, degrees: ['ICT'], institutions: [' Test University ', 'test university'], requiredSkills: ['TypeScript'] } });
    expect(result.eligibility).toMatchObject({ degrees: ['ict'], institutions: ['test university'], requiredSkills: ['typescript'] }); expect(result).not.toHaveProperty('providerId');
  });
  it('also rejects invalid policy shapes through Mongoose document validation', async () => {
    const record = new ScholarshipPolicy({ opportunityId: ids.scholarship, providerId: ids.provider, revision: 1, settings: { ...defaultScholarshipPolicy(), weights: { need: 100, fit: 100, benefits: 100, timing: 100 } } });
    await expect(record.validate()).rejects.toThrow('Invalid scholarship policy');
  });
});
describe('eligibility and missing profile information', () => {
  it('supports configurable programme, institution, skills and year limits', () => {
    const settings = scholarshipPolicyInput({ ...defaultScholarshipPolicy(), eligibility: { ...defaultScholarshipPolicy().eligibility, degrees: ['ICT'], institutions: ['Test University'], requiredSkills: ['TypeScript'], minStudyYear: 2, maxStudyYear: 2 } });
    expect(scholarshipEligibility(student(), settings).eligible).toBe(true);
    const other = student(); other.studentProfile!.studyYear = 3; expect(scholarshipEligibility(other, settings).reasons).toContain('Study year does not meet the published policy.');
  });
  it.each([undefined, new User(studentFixture({ accountStatus: 'suspended' })), new User(studentFixture({ role: 'provider' })), new User(studentFixture({ studentProfile: undefined }))])('fails closed for missing/inactive student records', (value) => expect(scholarshipEligibility(value, defaultScholarshipPolicy()).eligible).toBe(false));
  it('does not treat self-declared need or uploaded evidence as verified identity', () => expect(scholarshipEligibility(student(), defaultScholarshipPolicy())).toEqual({ eligible: true, reasons: [] }));
});
describe('explainable scoring, fairness limitations and stable ties', () => {
  const score = (settings = defaultScholarshipPolicy(), appliedAt = start, benefits = 0, need = 'high') => scholarshipPriority(need, student(), opportunity(), settings, benefits, appliedAt, start, end);
  it('honors configurable weights and explains that scores are advisory', () => {
    const policy = { ...defaultScholarshipPolicy(), weights: { need: 100, fit: 0, benefits: 0, timing: 0 } }; expect(score(policy).priorityScore).toBe(100); expect(score(policy, start, 0, 'low').priorityScore).toBe(33); expect(score(policy).priorityReasons.join(' ')).toContain('human decision');
  });
  it('permits timing to be disabled so late connectivity does not lower otherwise equal applicants', () => {
    const policy = { ...defaultScholarshipPolicy(), weights: { need: 50, fit: 30, benefits: 20, timing: 0 } };
    expect(score(policy, start).priorityScore).toBe(score(policy, end).priorityScore); expect(score(defaultScholarshipPolicy(), start).priorityScore).toBeGreaterThan(score(defaultScholarshipPolicy(), end).priorityScore);
  });
  it.each([[0, 100], [1, 60], [2, 20], [3, 0], [100, 0]])('bounds prior-benefit component for %s allocations', (benefits, expected) => {
    const policy = { ...defaultScholarshipPolicy(), weights: { need: 0, fit: 0, benefits: 100, timing: 0 } }; expect(score(policy, start, benefits).priorityScore).toBe(expected);
  });
  it('clamps before/after-window timing and handles missing/invalid dates without NaN', () => {
    const policy = { ...defaultScholarshipPolicy(), weights: { need: 0, fit: 0, benefits: 0, timing: 100 } };
    expect(score(policy, new Date('2025-01-01')).priorityScore).toBe(100); expect(score(policy, new Date('2027-01-01')).priorityScore).toBe(0); expect(score(policy, new Date('invalid')).priorityScore).toBe(50);
    expect(scholarshipPriority('medium', undefined, opportunity(), defaultScholarshipPolicy(), NaN, start, end, start).priorityScore).toBeGreaterThanOrEqual(0);
  });
  it('ties by earliest application then ID, independently of database arrival order', () => {
    const a = { priorityScore: 90, appliedAt: start, _id: 'a' }, b = { priorityScore: 90, appliedAt: start, _id: 'b' };
    expect([b, a].sort(compareScholarshipCandidates).map((row) => row._id)).toEqual(['a', 'b']); expect(compareScholarshipCandidates(a, { ...b, appliedAt: end })).toBeLessThan(0);
  });
});
describe('duplicate-benefit restrictions and safe decisions', () => {
  const now = new Date(2026, 5, 1), current = new Date(2026, 0, 2), historic = new Date(2025, 0, 2);
  it('preserves the server-local application-year legacy window', () => {
    expect(academicYearStart(now)).toEqual(new Date(2026, 0, 1)); expect(duplicateBenefitConflict('application_year', [{ appliedAt: current }], now)).toBe(true); expect(duplicateBenefitConflict('application_year', [{ appliedAt: historic }], now)).toBe(false);
  });
  it('requires mutual allow-multiple policies and honors existing stricter commitments', () => {
    expect(duplicateBenefitConflict('allow_multiple', [{ appliedAt: current, restriction: 'allow_multiple' }], now)).toBe(false);
    expect(duplicateBenefitConflict('allow_multiple', [{ appliedAt: current }], now)).toBe(true);
    expect(duplicateBenefitConflict('allow_multiple', [{ appliedAt: historic, restriction: 'lifetime' }], now)).toBe(true);
    expect(duplicateBenefitConflict('lifetime', [{ appliedAt: historic, restriction: 'allow_multiple' }], now)).toBe(true);
  });
  it.each([['applied', 'accepted', true], ['applied', 'waitlisted', true], ['waitlisted', 'accepted', true], ['rejected', 'accepted', false], ['rejected', 'reviewed', true], ['reviewed', 'applied', false], ['accepted', 'rejected', true], ['accepted', 'accepted', true]])('validates %s -> %s', (from, to, allowed) => expect(scholarshipTransition(String(from), String(to))).toBe(allowed));
  it.each([-1, '1', 1.5, 10001, {}, null])('rejects invalid expected revisions %j', (value) => expect(() => scholarshipRevision(value)).toThrow());
  it('requires explicit revision only where requested and rejects injection/unsafe reasons', () => {
    expect(scholarshipRevision(undefined)).toBeUndefined(); expect(() => scholarshipRevision(undefined, true)).toThrow(); expect(scholarshipRevision(0)).toBe(0); expect(() => scholarshipId({ $ne: null })).toThrow(); expect(() => scholarshipReason('<script>unsafe reason</script>')).toThrow(); expect(() => scholarshipReason('short')).toThrow();
  });
});
