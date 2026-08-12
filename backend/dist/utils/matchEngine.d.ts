import { IUser } from '../models/User';
import { IOpportunity } from '../models/Opportunity';
export interface MatchBreakdown {
    matchPercentage: number;
    matchedSkills: string[];
    missingSkills: string[];
    skillScore: number;
    careerRelevanceScore: number;
    locationScore: number;
    breakdown: {
        skillWeight: number;
        careerWeight: number;
        locationWeight: number;
    };
}
/**
 * Core matching function.
 * Compares a student profile against an opportunity and returns a 0-100 score
 * plus a full breakdown of matched / missing skills.
 */
export declare function matchScore(studentProfile: IUser['studentProfile'], opportunity: IOpportunity): MatchBreakdown;
/**
 * Static learning resource suggestions for missing skills.
 * Used on the frontend detail page to show "Recommended resource" hints.
 */
export declare const SKILL_RESOURCES: Record<string, {
    label: string;
    url: string;
}>;
/**
 * Find a resource suggestion for a given missing skill.
 * Falls back to a Google search if no curated entry exists.
 */
export declare function getResourceForSkill(skill: string): {
    label: string;
    url: string;
};
