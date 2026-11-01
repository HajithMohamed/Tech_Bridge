import type { IUser } from '../models/User';
import { canonicalSkill } from '../utils/matchEngine';
import { opportunityObject, opportunityText, opportunityTypes } from './opportunityPolicy';
import { ScholarshipError } from './scholarshipPolicy';

export const departments = ['ICT', 'ET', 'BST'] as const;
export const arrangements = ['full-time', 'part-time', 'contract', 'freelance', 'volunteer'] as const;
export const stages = ['internship', 'entry', 'graduate', 'experienced'] as const;
export interface RecommendationMetadata {
  departments?: string[]; interests?: string[]; activities?: string[]; studyYears?: number[];
  careerStage?: typeof stages[number]; employmentArrangement?: typeof arrangements[number];
}
export interface RecommendationPreferences {
  personalizationEnabled?: boolean; preferredOpportunityTypes?: string[]; preferredWorkArrangements?: string[];
  preferredEmploymentArrangements?: string[]; preferredLocations?: string[];
  careerStagePreference?: 'internship' | 'graduate' | 'either'; revision?: number;
}
export const defaultRecommendationWeights = { interests: 35, department: 25, skills: 20, level: 10, preferences: 5, freshness: 5 };
export type RecommendationWeights = typeof defaultRecommendationWeights;
type Factor = keyof RecommendationWeights;

export function recommendationWeights(environment: NodeJS.ProcessEnv = process.env): RecommendationWeights {
  if (!environment.OPPORTUNITY_RECOMMENDATION_WEIGHTS) return { ...defaultRecommendationWeights };
  let value: unknown;
  try { value = JSON.parse(environment.OPPORTUNITY_RECOMMENDATION_WEIGHTS); } catch { throw new Error('Invalid recommendation weight configuration.'); }
  try {
    const keys = Object.keys(defaultRecommendationWeights);
    const body = opportunityObject(value, keys);
    if (keys.some(key => typeof body[key] !== 'number' || !Number.isFinite(body[key]) || Number(body[key]) < 0 || Number(body[key]) > 100) || Math.abs(keys.reduce((sum, key) => sum + Number(body[key]), 0) - 100) > 0.000001) throw new Error();
    return body as RecommendationWeights;
  } catch { throw new Error('Recommendation weights must specify all six nonnegative factors totaling 100.'); }
}

const normalize = (value: string) => value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
const aliases: Record<string, string[]> = {
  'content writing': ['content writing', 'content writer', 'copywriting', 'copywriter', 'creative writing', 'blog writing'],
  'video editing': ['video editing', 'video editor', 'videography', 'videographer'],
  photography: ['photography', 'photographer'],
  'graphic design': ['graphic design', 'graphic designer'],
  'social media': ['social media', 'social media management'],
  'event organizing': ['event organizing', 'event management', 'event coordinator'],
  music: ['music', 'musician'], sports: ['sports', 'sport coaching'],
  programming: ['programming', 'software development', 'software developer', 'software engineering', 'programmer'],
  'data science': ['data science', 'data scientist', 'data analytics'],
  robotics: ['robotics', 'robotic systems'], 'renewable energy': ['renewable energy', 'solar energy'],
  'food science': ['food science', 'food technology'], agriculture: ['agriculture', 'agricultural', 'agronomy'],
  environment: ['environment', 'environmental', 'sustainability'],
};
export function canonicalInterest(value: string) {
  const normalized = normalize(value);
  return Object.entries(aliases).find(([, values]) => values.includes(normalized))?.[0] ?? normalized;
}
function containsPhrase(text: string, phrase: string) {
  const escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(normalize(text));
}
function detectedInterests(text: string) {
  return Object.entries(aliases).filter(([, values]) => values.some(value => containsPhrase(text, value))).map(([key]) => key);
}
function explainMatches(values: string[]) {
  const summary = values.slice(0, 5).join(', ');
  return values.length > 5 ? `${summary} (+${values.length - 5} more)` : summary;
}
export function recommendationTags(value: unknown, max = 20, length = 80): string[] {
  if (!Array.isArray(value) || value.length > max) throw new ScholarshipError(400, `Provide at most ${max} recommendation values.`);
  const result = new Map<string, string>();
  for (const item of value) {
    const text = opportunityText(item, 1, length);
    // These labels are plain text, not markup or executable content.
    if (/[<>]/.test(text)) throw new ScholarshipError(400, 'Recommendation labels must be plain text.');
    if (!result.has(normalize(text))) result.set(normalize(text), text);
  }
  return [...result.values()];
}
function choices(value: unknown, allowed: readonly string[]) {
  const result = recommendationTags(value, allowed.length);
  if (result.some(item => !allowed.includes(item))) throw new ScholarshipError(400, 'Select supported recommendation choices.');
  return result;
}
export function recommendationMetadataInput(value: unknown): RecommendationMetadata {
  const input = opportunityObject(value, ['departments', 'interests', 'activities', 'studyYears', 'careerStage', 'employmentArrangement']);
  const result: RecommendationMetadata = {};
  if (input.departments !== undefined) result.departments = choices(input.departments, departments);
  for (const field of ['interests', 'activities'] as const) if (input[field] !== undefined) result[field] = recommendationTags(input[field]);
  if (input.studyYears !== undefined) {
    if (!Array.isArray(input.studyYears) || input.studyYears.length > 6 || input.studyYears.some(year => !Number.isInteger(year) || year < 1 || year > 6)) throw new ScholarshipError(400, 'Select study years from 1 to 6.');
    result.studyYears = [...new Set(input.studyYears)];
  }
  if (input.careerStage !== undefined) result.careerStage = choices([input.careerStage], stages)[0] as RecommendationMetadata['careerStage'];
  if (input.employmentArrangement !== undefined) result.employmentArrangement = choices([input.employmentArrangement], arrangements)[0] as RecommendationMetadata['employmentArrangement'];
  return result;
}

export const privateRecommendationFields = ['specialization', 'careerInterests', 'extracurricularActivities', 'recommendationPreferences'] as const;
export const recommendationProfileSelection = privateRecommendationFields.map(key => `+studentProfile.${key}`).join(' ');
export function recommendationProfilePatch(value: unknown) {
  const input = opportunityObject(value, ['revision', 'degree', 'studyYear', 'skills', 'location', 'careerGoal', 'specialization', 'careerInterests', 'extracurricularActivities', 'personalizationEnabled', 'preferredOpportunityTypes', 'preferredWorkArrangements', 'preferredEmploymentArrangements', 'preferredLocations', 'careerStagePreference']);
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0 || Number(input.revision) >= Number.MAX_SAFE_INTEGER) throw new ScholarshipError(400, 'Provide the current recommendation revision.');
  if (Object.keys(input).length < 2) throw new ScholarshipError(400, 'Provide at least one preference change.');
  const fields: Record<string, unknown> = {};
  for (const key of ['careerGoal', 'location', 'specialization'] as const) if (input[key] !== undefined) fields[`studentProfile.${key}`] = opportunityText(input[key], 0, key === 'location' ? 100 : 150);
  for (const key of ['careerInterests', 'extracurricularActivities', 'skills'] as const) if (input[key] !== undefined) fields[`studentProfile.${key}`] = recommendationTags(input[key], key === 'skills' ? 25 : 20, key === 'skills' ? 50 : 80);
  if (input.degree !== undefined) fields['studentProfile.degree'] = choices([input.degree], [...departments, 'other'])[0];
  if (input.studyYear !== undefined) {
    if (!Number.isInteger(input.studyYear) || Number(input.studyYear) < 1 || Number(input.studyYear) > 6) throw new ScholarshipError(400, 'Study year must be between 1 and 6.');
    fields['studentProfile.studyYear'] = input.studyYear;
  }
  const preference = (key: string, value: unknown) => { fields[`studentProfile.recommendationPreferences.${key}`] = value; };
  if (input.personalizationEnabled !== undefined) {
    if (typeof input.personalizationEnabled !== 'boolean') throw new ScholarshipError(400, 'Choose whether personalization is enabled.');
    preference('personalizationEnabled', input.personalizationEnabled);
  }
  if (input.preferredOpportunityTypes !== undefined) preference('preferredOpportunityTypes', choices(input.preferredOpportunityTypes, opportunityTypes));
  if (input.preferredWorkArrangements !== undefined) preference('preferredWorkArrangements', choices(input.preferredWorkArrangements, ['remote', 'on-site', 'hybrid']));
  if (input.preferredEmploymentArrangements !== undefined) preference('preferredEmploymentArrangements', choices(input.preferredEmploymentArrangements, arrangements));
  if (input.preferredLocations !== undefined) preference('preferredLocations', recommendationTags(input.preferredLocations, 10, 100));
  if (input.careerStagePreference !== undefined) preference('careerStagePreference', choices([input.careerStagePreference], ['internship', 'graduate', 'either'])[0]);
  return { revision: Number(input.revision), fields };
}

export interface RecommendationListing {
  _id: unknown; title: string; description: string; type: string; requiredSkills?: string[];
  location?: string; workMode?: string; createdAt: Date | string; applicationDeadline: Date | string;
  preferredAcademicBackground?: string; recommendationMetadata?: RecommendationMetadata;
}
export function opportunityClassification(row: RecommendationListing) {
  const metadata = row.recommendationMetadata;
  const text = `${row.title} ${row.description} ${(row.requiredSkills ?? []).join(' ')} ${row.preferredAcademicBackground ?? ''}`;
  const inferred: string[] = [];
  const terms: Record<string, string[]> = {
    ICT: ['ICT', 'software', 'programming', 'developer', 'data science', 'data analytics', 'cybersecurity', 'information technology'],
    ET: ['engineering technology', 'mechanical', 'electrical', 'industrial', 'manufacturing', 'robotics', 'renewable energy', 'embedded systems'],
    BST: ['biosystems', 'agriculture', 'agricultural', 'food science', 'food technology', 'laboratory', 'environmental', 'biotechnology'],
  };
  for (const [department, words] of Object.entries(terms)) if (words.some(word => containsPhrase(text, word))) inferred.push(department);
  const relevantDepartments = metadata?.departments?.length ? metadata.departments : inferred;
  return {
    departments: relevantDepartments, interdisciplinary: relevantDepartments.length > 1,
    interests: [...new Set([...(metadata?.interests ?? []), ...(metadata?.activities ?? []), ...detectedInterests(text)].map(canonicalInterest))],
    method: metadata?.departments?.length ? 'provider_metadata' : inferred.length ? 'keyword_rules' : 'unclassified',
  };
}

/** Missing facts remain null. Recommendation relevance never determines eligibility. */
export function personalizedScore(profile: IUser['studentProfile'], row: RecommendationListing, now: Date, weights = defaultRecommendationWeights) {
  const classification = opportunityClassification(row);
  const preferences = profile?.recommendationPreferences;
  const selectedInterests = [...(profile?.careerInterests ?? []), ...(profile?.extracurricularActivities ?? [])];
  const interests = [...new Set((selectedInterests.length ? selectedInterests : detectedInterests(`${profile?.careerGoal ?? ''} ${profile?.specialization ?? ''}`)).map(canonicalInterest))];
  const matchedInterests = interests.filter(value => classification.interests.includes(value));
  const requiredSkills = [...new Map((row.requiredSkills ?? []).map(skill => [canonicalSkill(skill), skill])).values()];
  const studentSkills = new Set((profile?.skills ?? []).map(canonicalSkill));
  const matchedSkills = requiredSkills.filter(value => studentSkills.has(canonicalSkill(value)));
  const factors: Record<Factor, number | null> = { interests: null, department: null, skills: null, level: null, preferences: null, freshness: null };
  if (interests.length && classification.interests.length) factors.interests = matchedInterests.length / interests.length * 100;
  if (profile?.degree && departments.includes(profile.degree as typeof departments[number]) && classification.departments.length) factors.department = classification.departments.includes(profile.degree) ? 100 : 0;
  if (studentSkills.size && requiredSkills.length) factors.skills = matchedSkills.length / requiredSkills.length * 100;
  const level: number[] = [];
  const stage = row.recommendationMetadata?.careerStage ?? (row.type === 'internship' ? 'internship' : containsPhrase(row.title, 'graduate') ? 'graduate' : containsPhrase(row.title, 'entry level') || containsPhrase(row.title, 'entry-level') || containsPhrase(row.title, 'junior') ? 'entry' : undefined);
  if (preferences?.careerStagePreference && stage) level.push((preferences.careerStagePreference === 'either' && ['internship', 'entry', 'graduate'].includes(stage)) || preferences.careerStagePreference === stage || (preferences.careerStagePreference === 'graduate' && stage === 'entry') ? 100 : 0);
  if (profile?.studyYear && row.recommendationMetadata?.studyYears?.length) level.push(row.recommendationMetadata.studyYears.includes(profile.studyYear) ? 100 : 0);
  if (level.length) factors.level = level.reduce((a, b) => a + b, 0) / level.length;
  const preferenceScores: number[] = [];
  if (preferences?.preferredOpportunityTypes?.length) preferenceScores.push(preferences.preferredOpportunityTypes.includes(row.type) ? 100 : 0);
  const work = preferences?.preferredWorkArrangements !== undefined ? preferences.preferredWorkArrangements : profile?.preferredWorkType && profile.preferredWorkType !== 'flexible' ? [profile.preferredWorkType] : [];
  if (work.length && row.workMode) preferenceScores.push(work.includes(row.workMode) ? 100 : 0);
  const locations = preferences?.preferredLocations !== undefined ? preferences.preferredLocations : profile?.location ? [profile.location] : [];
  if (locations.length && row.location && row.workMode !== 'remote') preferenceScores.push(locations.some(value => normalize(value) === normalize(row.location!)) ? 100 : 0);
  if (preferences?.preferredEmploymentArrangements?.length && row.recommendationMetadata?.employmentArrangement) preferenceScores.push(preferences.preferredEmploymentArrangements.includes(row.recommendationMetadata.employmentArrangement) ? 100 : 0);
  if (preferenceScores.length) factors.preferences = preferenceScores.reduce((a, b) => a + b, 0) / preferenceScores.length;
  const created = new Date(row.createdAt).getTime();
  if (Number.isFinite(created)) factors.freshness = Math.max(0, Math.min(100, 100 * (1 - (now.getTime() - created) / (30 * 86400_000))));
  const keys = Object.keys(weights) as Factor[];
  const observedWeight = keys.reduce((sum, key) => sum + (factors[key] === null ? 0 : weights[key]), 0);
  const observedSemanticFactors = keys.filter(key => !['freshness', 'preferences'].includes(key) && factors[key] !== null && weights[key] > 0).length;
  const raw = observedWeight ? keys.reduce((sum, key) => sum + (factors[key] ?? 0) * weights[key], 0) / observedWeight : 0;
  const sufficient = observedSemanticFactors >= 2 && observedWeight >= 40;
  const ownDepartment = weights.department > 0 && factors.department === 100;
  const hasInterest = weights.interests > 0 && matchedInterests.length > 0;
  const hasSkill = weights.skills > 0 && matchedSkills.length > 0;
  // Explicit interests/activities outrank department-only defaults.
  const tier = hasInterest && ownDepartment ? 1 : hasInterest || hasSkill ? 2 : ownDepartment ? 3 : classification.interdisciplinary ? 4 : 5;
  const coldStart = !interests.length && !studentSkills.size;
  const explanations: string[] = [];
  if (hasInterest) explanations.push(`Relevant to your selected interests or activities: ${explainMatches(matchedInterests)}.`);
  if (ownDepartment) explanations.push(`Relevant to your ${profile!.degree} programme; this is not an eligibility check.`);
  if (hasSkill) explanations.push(`Matches your skills: ${explainMatches(matchedSkills)}.`);
  if (stage === 'internship' || stage === 'entry' || stage === 'graduate') explanations.push(`Listed for ${stage === 'entry' ? 'entry-level' : stage} opportunities, subject to the provider's requirements.`);
  if (!explanations.length) explanations.push('Available for discovery; add interests, activities and skills to improve recommendations.');
  return {
    score: sufficient ? Math.round(Math.max(0, Math.min(100, raw))) : null,
    scoreStatus: sufficient ? 'available' : 'insufficient_information', observedWeight,
    factors, weights, tier, explanations, classification,
    coldStart, entryLevel: stage === 'internship' || stage === 'entry' || stage === 'graduate',
    // Used only by the server; never serialize an insufficient-information percentage.
    orderingScore: raw,
  };
}
