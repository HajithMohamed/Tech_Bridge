import { describe, expect, it } from 'vitest';
import User from '../../src/models/User';
import Opportunity from '../../src/models/Opportunity';
import { canonicalSkill, getResourceForSkill, matchScore } from '../../src/utils/matchEngine';
import { defaultOpportunityEligibility, effectiveOpportunityStatus, eligibilityInput, explainOrdinaryEligibility, ordinaryApplicationTransition, opportunityDate, opportunityId, opportunitySearch, providerCurrentlyVerified } from '../../src/services/opportunityPolicy';
import { ids, providerFixture, scholarshipFixture, studentFixture } from '../support/fixtures';

const now = new Date('2030-01-01T12:00:00.000Z');
const listing = (changes = {}) => new Opportunity(scholarshipFixture({ type: 'job', ...changes }));
describe('strict literal opportunity queries and expiration', () => {
  it('combines filters with bounded stable pagination and a strict future deadline', () => {
    const result = opportunitySearch({ q: 'C++ [test]', skill: 'React.js', type: 'job', workMode: 'remote', providerId: String(ids.provider), location: 'Campus', page: '2', limit: '5', sort: 'deadline', isPaid: 'true' }, now);
    expect(result).toMatchObject({ page: 2, limit: 5, sort: { applicationDeadline: 1, _id: 1 }, filter: { status: 'open', type: 'job', workMode: 'remote', providerId: ids.provider, isPaid: true, applicationDeadline: { $gt: now } } });
    expect(result.filter.requiredSkills).toEqual({ $regex: 'React\\.js', $options: 'i' });
    expect(result.filter.$or).toEqual([{ title: { $regex: 'C\\+\\+ \\[test\\]', $options: 'i' } }, { description: { $regex: 'C\\+\\+ \\[test\\]', $options: 'i' } }]);
  });
  it.each([{ page: '0' }, { limit: '101' }, { q: ['x', 'y'] }, { q: { $ne: null } }, { q: 'x'.repeat(81) }, { type: 'admin' }, { workMode: 'anywhere' }, { status: 'draft' }, { providerId: 'bad' }, { isPaid: true }, { isFree: 'yes' }, { sort: 'unknown' }, { deadlineFrom: 'tomorrow' }, { deadlineFrom: '2031-01-02', deadlineTo: '2030-01-02' }])('rejects invalid search %j', query => { expect(() => opportunitySearch(query, now)).toThrow(); });
  it('bounds match result windows and does not pretend a recent-only sample is a global ranking', () => {
    expect(opportunitySearch({ page: '100', limit: '50' }, now, true)).toMatchObject({ page: 100, limit: 50 });
    expect(() => opportunitySearch({ page: '101' }, now, true)).toThrow(); expect(() => opportunitySearch({ limit: '51' }, now, true)).toThrow();
  });
  it.each(['2030-02-30', '2030-01-01T25:00:00Z', '2030-01-01T12:00:00', 12, null, {}, '2030-01-01T12:00:00+05:30'])('rejects ambiguous or invalid calendar input %j', value => { expect(() => opportunityDate(value)).toThrow(); });
  it.each(['2030-01-01', '2030-01-01T12:00:00Z', '2030-01-01T12:00:00.000Z'])('supports canonical date/UTC input %s', value => { expect(Number.isFinite(opportunityDate(value).getTime())).toBe(true); });
  it('treats deadline equality as expired while preserving closed and draft states', () => {
    expect(effectiveOpportunityStatus(listing({ applicationDeadline: now }), now)).toBe('expired');
    expect(effectiveOpportunityStatus(listing({ applicationDeadline: new Date(now.getTime() + 1) }), now)).toBe('open');
    expect(effectiveOpportunityStatus(listing({ applicationDeadline: now, status: 'closed' }), now)).toBe('closed');
    expect(effectiveOpportunityStatus(listing({ applicationDeadline: now, status: 'draft' }), now)).toBe('draft');
  });
  it.each(['bad', { $ne: null }, ['000000000000000000000001']])('rejects noncanonical IDs %j', value => { expect(() => opportunityId(value)).toThrow(); });
});
describe('explicit eligibility and ordinary application transitions', () => {
  it('allows preferred-skill mismatches by default and explains mandatory rules separately', () => {
    const student = new User(studentFixture()); expect(explainOrdinaryEligibility(student, defaultOpportunityEligibility()).eligible).toBe(true);
    const rules = eligibilityInput({ ...defaultOpportunityEligibility(), degrees: ['ET'], institutions: ['Other Campus'], requiredSkills: ['Java'], minStudyYear: 3 });
    const result = explainOrdinaryEligibility(student, rules); expect(result.eligible).toBe(false); expect(result.checks.filter(row => !row.passed).map(row => row.code)).toEqual(['degree', 'institution', 'study_year', 'required_skills']);
  });
  it('normalizes explicit rules and accepts known skill aliases without substring matches', () => {
    const rules = eligibilityInput({ ...defaultOpportunityEligibility(), degrees: ['ICT', 'ict'], requiredSkills: ['React.js'] }); expect(rules.degrees).toEqual(['ict']);
    expect(explainOrdinaryEligibility(new User(studentFixture()), rules).eligible).toBe(true);
    expect(explainOrdinaryEligibility(new User(studentFixture({ studentProfile: { ...studentFixture().studentProfile, skills: ['JavaScript'] } })), { ...rules, requiredSkills: ['Java'] }).eligible).toBe(false);
  });
  it.each([{ minStudyYear: 0 }, { minStudyYear: 4, maxStudyYear: 2 }, { degrees: ['medicine'] }, { requiredSkills: [''] }, { institutions: Array(21).fill('Campus') }, { approved: true }])('rejects invalid explicit requirements %j', change => { expect(() => eligibilityInput({ ...defaultOpportunityEligibility(), ...change })).toThrow(); });
  it('fails closed for missing profiles, suspension, email gates and incomplete verification', () => {
    expect(explainOrdinaryEligibility(null, defaultOpportunityEligibility()).eligible).toBe(false);
    expect(explainOrdinaryEligibility(new User(studentFixture({ requiresEmailVerification: true })), defaultOpportunityEligibility()).eligible).toBe(false);
    expect(providerCurrentlyVerified(new User(providerFixture()))).toBe(true);
    for (const change of [{ accountStatus: 'suspended' }, { requiresEmailVerification: true }, { providerProfile: { ...providerFixture().providerProfile, verificationStatus: 'NEEDS_INFO' } }]) expect(providerCurrentlyVerified(new User(providerFixture(change)))).toBe(false);
  });
  it('explains incomplete legacy degree/institution data without throwing', () => {
    const student = new User(studentFixture()); student.set('studentProfile.degree', undefined); student.set('studentProfile.institution', undefined);
    const result = explainOrdinaryEligibility(student, { ...defaultOpportunityEligibility(), degrees: ['ict'], institutions: ['Test University'] });
    expect(result.eligible).toBe(false); expect(result.checks.filter(row => !row.passed).map(row => row.code)).toEqual(['degree', 'institution']);
  });
  it('rejects fractional or reversed eligibility rules at the model boundary as well as the API', () => {
    for (const change of [{ minStudyYear: 1.5 }, { minStudyYear: 5, maxStudyYear: 2 }]) expect(listing({ eligibility: { ...defaultOpportunityEligibility(), ...change } }).validateSync()?.errors).toHaveProperty('eligibility');
    expect(listing({ eligibility: defaultOpportunityEligibility() }).validateSync()).toBeUndefined();
  });
  it('permits ordinary review/decision, idempotency and reasoned reopening', () => {
    for (const [from, to] of [['applied', 'reviewed'], ['applied', 'accepted'], ['reviewed', 'rejected'], ['accepted', 'accepted']]) expect(() => ordinaryApplicationTransition(from!, to!)).not.toThrow();
    expect(() => ordinaryApplicationTransition('rejected', 'reviewed', 'New information merits another human review.')).not.toThrow();
  });
  it.each([['reviewed', 'applied'], ['rejected', 'accepted'], ['applied', 'waitlisted'], ['accepted', 'reviewed']])('rejects unsupported or unexplained transition %s to %s', (from, to) => { expect(() => ordinaryApplicationTransition(from, to)).toThrow(); });
});
describe('preserved rule weights with safer skill identity', () => {
  it.each([['React.js', 'React'], ['React JS', 'react'], ['Node.js', 'nodejs'], ['JS', 'JavaScript'], ['TS', 'TypeScript']])('recognizes explicit alias %s / %s', (a, b) => { expect(canonicalSkill(a)).toBe(canonicalSkill(b)); });
  it.each([['Java', 'JavaScript'], ['C', 'C++'], ['C#', 'C'], ['', 'React'], ['SQL', 'NoSQL']])('keeps distinct skills %s / %s', (a, b) => {
    const result = matchScore({ ...studentFixture().studentProfile, skills: [a] } as any, listing({ requiredSkills: [b] })); expect(result.matchedSkills).toEqual([]);
  });
  it('ignores blank legacy requirements and duplicate aliases without inflating score', () => {
    const result = matchScore(new User(studentFixture()).studentProfile, listing({ requiredSkills: ['React', 'React.js', '', 'Python'] }));
    expect(result.matchedSkills).toEqual(['React']); expect(result.missingSkills).toEqual(['Python']); expect(result.skillScore).toBe(50); expect(result.breakdown).toEqual({ skillWeight: 60, careerWeight: 25, locationWeight: 15 });
    expect(result.matchPercentage).toBeGreaterThanOrEqual(0); expect(result.matchPercentage).toBeLessThanOrEqual(100);
  });
  it('keeps exact curated learning references and encodes unknown-skill fallback searches', () => {
    expect(getResourceForSkill('Java').label).toContain('Java Programming'); expect(getResourceForSkill('JavaScript').label).toContain('JavaScript');
    expect(getResourceForSkill('synthetic & new').url).toContain('synthetic%20%26%20new');
  });
});
