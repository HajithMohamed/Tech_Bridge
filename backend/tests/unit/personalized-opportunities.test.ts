import { describe, expect, it } from 'vitest';
import type { IUser } from '../../src/models/User';
import { canonicalInterest, defaultRecommendationWeights, opportunityClassification, personalizedScore, recommendationMetadataInput, recommendationProfilePatch, recommendationWeights, type RecommendationListing } from '../../src/services/recommendationPolicy';

const now = new Date('2026-11-01T12:00:00.000Z');
const profile = (changes = {}): NonNullable<IUser['studentProfile']> => ({ institution: 'Synthetic Campus', degree: 'ICT', studyYear: 2, skills: ['Java'], careerInterests: ['programming'], ...changes });
const listing = (changes = {}): RecommendationListing => ({ _id: '000000000000000000000010', title: 'Synthetic software developer', description: 'Synthetic work for a rule-based recommendation test.', type: 'job', requiredSkills: ['Java'], location: 'Synthetic Campus', workMode: 'remote', createdAt: now, applicationDeadline: new Date('2099-01-01'), recommendationMetadata: { departments: ['ICT'], interests: ['programming'] }, ...changes });
const score = (p = profile(), row = listing()) => personalizedScore(p, row, now);

describe('recommendation relevance and missing-information policy', () => {
  it.each(['ICT', 'ET', 'BST'])('recognizes explicit %s relevance independently of eligibility', department => {
    const value = score(profile({ degree: department }), listing({ recommendationMetadata: { departments: [department], interests: ['programming'] } }));
    expect(value.factors.department).toBe(100); expect(value.tier).toBe(1); expect(value.explanations.join(' ')).toContain('not an eligibility check');
  });
  it.each(['content writing', 'video editing', 'photography'])('prioritizes the extracurricular activity %s over a department-only job', activity => {
    const student = profile({ careerInterests: [], extracurricularActivities: [activity], skills: [] });
    const relevant = score(student, listing({ title: `Synthetic ${activity} role`, requiredSkills: [], recommendationMetadata: { departments: ['BST'], activities: [activity] } }));
    const academic = score(student, listing({ recommendationMetadata: { departments: ['ICT'] }, requiredSkills: [] }));
    expect(relevant.tier).toBeLessThan(academic.tier); expect(relevant.explanations[0]).toContain(activity);
  });
  it.each([['ICT', 'robotics', 'ET'], ['ET', 'programming', 'ICT'], ['BST', 'data science', 'ICT']])('allows %s interests in %s to override a %s department default', (degree, interest, other) => {
    const value = score(profile({ degree, careerInterests: [interest], skills: [] }), listing({ recommendationMetadata: { departments: [other], interests: [interest] } }));
    expect(value.tier).toBe(2); expect(value.factors.interests).toBe(100); expect(value.factors.department).toBe(0);
  });
  it('recognizes multiple relevant departments without duplicating interest labels', () => {
    const value = score(profile(), listing({ recommendationMetadata: { departments: ['ICT', 'ET'], interests: ['programming', 'software development'] } }));
    expect(value.classification.interdisciplinary).toBe(true); expect(value.classification.interests.filter(item => item === 'programming')).toHaveLength(1); expect(value.tier).toBe(1);
  });
  it('keeps Java distinct from JavaScript and supports canonical skill aliases', () => {
    expect(score(profile({ skills: ['JavaScript'] })).factors.skills).toBe(0);
    expect(score(profile({ skills: ['React JS'] }), listing({ requiredSkills: ['React.js', 'React.js'] })).factors.skills).toBe(100);
  });
  it('calculates the default six-factor weighted score', () => {
    const value = score(profile({ recommendationPreferences: { careerStagePreference: 'graduate', preferredWorkArrangements: ['remote'] } }), listing({ recommendationMetadata: { departments: ['ICT'], interests: ['programming'], careerStage: 'graduate' } }));
    expect(value.score).toBe(100); expect(value.observedWeight).toBe(100); expect(value.weights).toEqual(defaultRecommendationWeights);
  });
  it('normalizes over observed weights rather than marking unknown level/preferences as failures', () => {
    const value = score(profile(), listing({ recommendationMetadata: { departments: ['BST'], interests: ['programming'] } }));
    expect(value.factors.level).toBeNull(); expect(value.factors.preferences).toBeNull(); expect(value.observedWeight).toBe(85); expect(value.score).toBe(71);
  });
  it('does not manufacture a percentage from freshness or an empty profile', () => {
    const value = personalizedScore(undefined, listing(), now);
    expect(value.score).toBeNull(); expect(value.scoreStatus).toBe('insufficient_information'); expect(value.factors.skills).toBeNull(); expect(value.coldStart).toBe(true);
  });
  it('does not interpret missing job metadata or absent required skills as a perfect match', () => {
    const value = score(profile(), listing({ title: 'Synthetic vacancy', description: 'An available opportunity with incomplete metadata.', recommendationMetadata: undefined, requiredSkills: [] }));
    expect(value.factors.interests).toBeNull(); expect(value.factors.department).toBeNull(); expect(value.factors.skills).toBeNull(); expect(value.score).toBeNull();
  });
  it('uses exact locations, explicit work arrangements and opportunity-type preferences', () => {
    const p = profile({ recommendationPreferences: { preferredLocations: ['Galle'], preferredWorkArrangements: ['hybrid'], preferredOpportunityTypes: ['internship'] } });
    const value = score(p, listing({ type: 'internship', location: 'Galle', workMode: 'hybrid' }));
    expect(value.factors.preferences).toBe(100);
    expect(score(p, listing({ location: 'Galle District', workMode: 'on-site' })).factors.preferences).toBe(0);
  });
  it('does not penalize remote roles for a different physical location', () => {
    expect(score(profile({ recommendationPreferences: { preferredLocations: ['Galle'] } })).factors.preferences).toBeNull();
  });
  it('uses preferred employment arrangements and internship/graduate preferences separately', () => {
    const p = profile({ recommendationPreferences: { careerStagePreference: 'graduate', preferredEmploymentArrangements: ['part-time'] } });
    const value = score(p, listing({ recommendationMetadata: { careerStage: 'entry', employmentArrangement: 'part-time', studyYears: [1] } }));
    expect(value.factors.level).toBe(50); expect(value.factors.preferences).toBe(100);
  });
  it('recognizes recent internship and entry-level opportunities for cold starts', () => {
    for (const row of [listing({ type: 'internship' }), listing({ title: 'Junior software developer' }), listing({ title: 'Graduate trainee' })]) expect(personalizedScore(undefined, row, now).entryLevel).toBe(true);
  });
  it('uses bounded freshness with deterministic time', () => {
    expect(score(profile(), listing({ createdAt: new Date(now.getTime() - 15 * 86400_000) })).factors.freshness).toBe(50);
    expect(score(profile(), listing({ createdAt: new Date(0) })).factors.freshness).toBe(0);
  });
  it('changes interest relevance immediately when explicit preferences change', () => {
    const row = listing({ recommendationMetadata: { activities: ['photography'] } });
    expect(score(profile({ careerInterests: [], extracurricularActivities: ['photography'] }), row).factors.interests).toBe(100);
    expect(score(profile({ careerInterests: [], extracurricularActivities: ['video editing'] }), row).factors.interests).toBe(0);
  });
  it('prioritizes explicit activity selections over an old academic career goal', () => {
    const student = profile({ careerGoal: 'software development', careerInterests: [], extracurricularActivities: ['photography'] });
    expect(score(student, listing()).factors.interests).toBe(0);
    expect(score(student, listing({ recommendationMetadata: { activities: ['photography'] } })).factors.interests).toBe(100);
  });
  it('honors explicit clearing of legacy location and work preferences', () => {
    const student = profile({ location: 'Galle', preferredWorkType: 'hybrid', recommendationPreferences: { preferredWorkArrangements: [], preferredLocations: [] } });
    expect(score(student, listing({ workMode: 'on-site', location: 'Colombo' })).factors.preferences).toBeNull();
  });
  it('has safe explanations without eligibility or acceptance promises', () => {
    const value = score(); expect(value.explanations.join(' ')).not.toMatch(/guaranteed|you are eligible|will be accepted/i); expect(value.explanations.some(item => item.includes('Java'))).toBe(true);
  });
  it('uses only explicit non-sensitive profile signals', () => {
    const regular = score(); const modified = score(profile({ gender: 'private', religion: 'private', ethnicity: 'private', fullName: 'Different person' }));
    expect(modified).toEqual(regular);
  });
  it('does not mutate the input profile or listing', () => {
    const p = profile(); const row = listing(); const before = JSON.stringify({ p, row }); score(p, row); expect(JSON.stringify({ p, row })).toBe(before);
  });
});

describe('classification, configuration and bounded preference input', () => {
  it.each([['copywriter', 'content writing'], ['video editor', 'video editing'], ['photographer', 'photography']])('maps %s to %s', (input, output) => expect(canonicalInterest(input)).toBe(output));
  it('detects activity phrases in legacy listing titles without matching substrings', () => {
    expect(opportunityClassification(listing({ title: 'Campus Photographer', recommendationMetadata: undefined })).interests).toContain('photography');
    expect(opportunityClassification(listing({ title: 'Musicology position', description: 'Synthetic vacancy with unknown metadata.', requiredSkills: [], recommendationMetadata: undefined })).interests).not.toContain('music');
  });
  it('labels provided, keyword and unclassified department evidence', () => {
    expect(opportunityClassification(listing()).method).toBe('provider_metadata');
    expect(opportunityClassification(listing({ recommendationMetadata: undefined })).method).toBe('keyword_rules');
    expect(opportunityClassification(listing({ title: 'Synthetic vacancy', description: 'Available position for students.', requiredSkills: [], recommendationMetadata: undefined })).method).toBe('unclassified');
  });
  it('validates server-owned configurable weights', () => {
    expect(recommendationWeights({})).toEqual(defaultRecommendationWeights);
    const weights = { interests: 50, department: 10, skills: 20, level: 10, preferences: 5, freshness: 5 };
    expect(recommendationWeights({ OPPORTUNITY_RECOMMENDATION_WEIGHTS: JSON.stringify(weights) })).toEqual(weights);
  });
  it.each(['not-json', '{}', '[]', '{"interests":100}', JSON.stringify({ ...defaultRecommendationWeights, skills: -1 }), JSON.stringify({ ...defaultRecommendationWeights, interests: 34 }), JSON.stringify({ ...defaultRecommendationWeights, sensitive: 0 })])('rejects unsafe weight configuration %s', value => expect(() => recommendationWeights({ OPPORTUNITY_RECOMMENDATION_WEIGHTS: value })).toThrow());
  it('accepts bounded metadata and clears arrays explicitly', () => expect(recommendationMetadataInput({ departments: ['ICT', 'ET'], interests: [], activities: ['Photography'], studyYears: [2, 2] })).toEqual({ departments: ['ICT', 'ET'], interests: [], activities: ['Photography'], studyYears: [2] }));
  it.each([{ activities: Array(21).fill('photography') }, { studyYears: [0] }, { careerStage: 'unknown' }, { departments: ['unknown'] }, { employmentArrangement: 'unknown' }, { gender: 'private' }, { activities: ['<script>'] }, { interests: { $ne: null } }])('rejects invalid metadata %j', value => expect(() => recommendationMetadataInput(value)).toThrow());
  it('creates a dot-path patch without replacing creator settings', () => {
    const result = recommendationProfilePatch({ revision: 0, extracurricularActivities: ['photography', 'Photography'], personalizationEnabled: false, skills: [] });
    expect(result.fields).toEqual({ 'studentProfile.extracurricularActivities': ['photography'], 'studentProfile.skills': [], 'studentProfile.recommendationPreferences.personalizationEnabled': false });
  });
  it.each([{ revision: -1, careerInterests: [] }, { revision: 0 }, { revision: 0, studentId: 'peer' }, { revision: 0, role: 'admin' }, { revision: 0, personalizationEnabled: 'false' }, { revision: 0, careerInterests: ['x'.repeat(81)] }, { revision: 0, extracurricularActivities: ['\u0000'] }, { revision: 0, preferredLocations: Array(11).fill('a') }, { revision: 0, preferredWorkArrangements: ['flexible'] }, { revision: 0, preferredOpportunityTypes: ['unknown'] }, { revision: 0, studyYear: 2.5 }])('rejects invalid profile changes %j', value => expect(() => recommendationProfilePatch(value)).toThrow());
});
