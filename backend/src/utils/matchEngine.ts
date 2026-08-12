import { IUser } from '../models/User';
import { IOpportunity } from '../models/Opportunity';

/* ──────────────────────────────────────────────────────────
   Rule-based Opportunity Matching Engine
   No AI/ML — plain scoring logic as specified in MVP scope
   ────────────────────────────────────────────────────────── */

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

// Weights — skill match is weighted highest per spec
const WEIGHTS = {
  skills: 0.60,
  careerRelevance: 0.25,
  location: 0.15,
} as const;

// Career-goal keyword → opportunity type mapping
const CAREER_TYPE_MAP: Record<string, string[]> = {
  developer: ['job', 'internship', 'freelance'],
  engineer: ['job', 'internship', 'freelance'],
  programmer: ['job', 'internship', 'freelance'],
  designer: ['job', 'internship', 'freelance'],
  researcher: ['scholarship', 'course', 'workshop'],
  scientist: ['scholarship', 'course', 'workshop'],
  analyst: ['job', 'internship', 'course'],
  consultant: ['job', 'freelance'],
  trainer: ['workshop', 'course'],
  teacher: ['workshop', 'course'],
  lecturer: ['workshop', 'course'],
  entrepreneur: ['freelance', 'workshop'],
};

/**
 * Normalise a skill/keyword string for fuzzy comparison.
 * Lowercases, trims, removes dots/hyphens so that
 * "React.js", "react", "React JS" all compare equally.
 */
const normalise = (s: string): string =>
  s.toLowerCase().replace(/[.\-_]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Check if two skill strings are a "fuzzy match".
 * Returns true when one string contains the other after normalisation.
 */
const fuzzyMatch = (studentSkill: string, requiredSkill: string): boolean => {
  const a = normalise(studentSkill);
  const b = normalise(requiredSkill);
  return a === b || a.includes(b) || b.includes(a);
};

/**
 * Core matching function.
 * Compares a student profile against an opportunity and returns a 0-100 score
 * plus a full breakdown of matched / missing skills.
 */
export function matchScore(
  studentProfile: IUser['studentProfile'],
  opportunity: IOpportunity
): MatchBreakdown {
  const studentSkills = studentProfile?.skills ?? [];
  const requiredSkills = opportunity.requiredSkills ?? [];

  // ── 1. SKILL MATCH (60 % weight) ──────────────────────
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const required of requiredSkills) {
    const found = studentSkills.some((s) => fuzzyMatch(s, required));
    if (found) {
      matchedSkills.push(required);
    } else {
      missingSkills.push(required);
    }
  }

  const skillScore =
    requiredSkills.length > 0
      ? (matchedSkills.length / requiredSkills.length) * 100
      : 100; // No skills required → perfect skill score

  // ── 2. CAREER-GOAL RELEVANCE (25 % weight) ───────────
  let careerRelevanceScore = 50; // neutral default

  if (studentProfile?.careerGoal) {
    const goalNorm = normalise(studentProfile.careerGoal);
    const titleNorm = normalise(opportunity.title);
    const descNorm = normalise(opportunity.description);

    // Direct keyword match in title / description
    const goalWords = goalNorm.split(' ').filter((w) => w.length > 2);
    const titleHits = goalWords.filter(
      (w) => titleNorm.includes(w) || descNorm.includes(w)
    );

    if (titleHits.length > 0) {
      careerRelevanceScore = Math.min(
        100,
        50 + (titleHits.length / goalWords.length) * 50
      );
    }

    // Opportunity type alignment via CAREER_TYPE_MAP
    for (const [keyword, types] of Object.entries(CAREER_TYPE_MAP)) {
      if (goalNorm.includes(keyword) && types.includes(opportunity.type)) {
        careerRelevanceScore = Math.min(100, careerRelevanceScore + 20);
        break;
      }
    }
  }

  // ── 3. LOCATION / WORK-MODE PREFERENCE (15 % weight) ─
  let locationScore = 50; // neutral default

  if (opportunity.workMode === 'remote') {
    // Remote opportunities are universally accessible
    locationScore = 90;
  } else if (studentProfile?.location && opportunity.location) {
    const studentLoc = normalise(studentProfile.location);
    const oppLoc = normalise(opportunity.location);

    if (studentLoc === oppLoc || studentLoc.includes(oppLoc) || oppLoc.includes(studentLoc)) {
      locationScore = 100;
    } else {
      locationScore = 30; // Location mismatch penalty
    }

    if (opportunity.workMode === 'hybrid') {
      // Hybrid is more flexible, bump score
      locationScore = Math.min(100, locationScore + 15);
    }
  }

  // ── WEIGHTED TOTAL ────────────────────────────────────
  const raw =
    skillScore * WEIGHTS.skills +
    careerRelevanceScore * WEIGHTS.careerRelevance +
    locationScore * WEIGHTS.location;

  const matchPercentage = Math.round(Math.max(0, Math.min(100, raw)));

  return {
    matchPercentage,
    matchedSkills,
    missingSkills,
    skillScore: Math.round(skillScore),
    careerRelevanceScore: Math.round(careerRelevanceScore),
    locationScore: Math.round(locationScore),
    breakdown: {
      skillWeight: WEIGHTS.skills * 100,
      careerWeight: WEIGHTS.careerRelevance * 100,
      locationWeight: WEIGHTS.location * 100,
    },
  };
}

/**
 * Static learning resource suggestions for missing skills.
 * Used on the frontend detail page to show "Recommended resource" hints.
 */
export const SKILL_RESOURCES: Record<string, { label: string; url: string }> = {
  react: { label: 'Free React Course — freeCodeCamp', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/#react' },
  javascript: { label: 'JavaScript — MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript' },
  typescript: { label: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/' },
  python: { label: 'Python for Everybody — Coursera', url: 'https://www.coursera.org/specializations/python' },
  nodejs: { label: 'Node.js — freeCodeCamp', url: 'https://www.freecodecamp.org/learn/back-end-development-and-apis/' },
  html: { label: 'HTML Basics — MDN', url: 'https://developer.mozilla.org/en-US/docs/Learn/HTML' },
  css: { label: 'CSS — MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn/CSS' },
  java: { label: 'Java Programming — Codecademy', url: 'https://www.codecademy.com/learn/learn-java' },
  sql: { label: 'SQL Tutorial — W3Schools', url: 'https://www.w3schools.com/sql/' },
  git: { label: 'Git & GitHub — freeCodeCamp', url: 'https://www.freecodecamp.org/news/git-and-github-for-beginners/' },
  docker: { label: 'Docker Getting Started', url: 'https://docs.docker.com/get-started/' },
  mongodb: { label: 'MongoDB University (Free)', url: 'https://university.mongodb.com/' },
  figma: { label: 'Figma for Beginners — YouTube', url: 'https://www.youtube.com/results?search_query=figma+for+beginners' },
  aws: { label: 'AWS Cloud Practitioner — Free', url: 'https://aws.amazon.com/training/digital/' },
  linux: { label: 'Linux Basics — edX', url: 'https://www.edx.org/learn/linux' },
  'c++': { label: 'C++ Tutorial — W3Schools', url: 'https://www.w3schools.com/cpp/' },
  angular: { label: 'Angular — Official Tutorial', url: 'https://angular.io/tutorial' },
  vue: { label: 'Vue.js — Official Guide', url: 'https://vuejs.org/guide/introduction.html' },
  flutter: { label: 'Flutter — Get Started', url: 'https://flutter.dev/docs/get-started' },
  kotlin: { label: 'Kotlin — JetBrains Academy', url: 'https://kotlinlang.org/docs/getting-started.html' },
  swift: { label: 'Swift — Apple Tutorials', url: 'https://developer.apple.com/tutorials/swiftui' },
  php: { label: 'PHP Tutorial — W3Schools', url: 'https://www.w3schools.com/php/' },
  laravel: { label: 'Laravel — Official Docs', url: 'https://laravel.com/docs' },
  express: { label: 'Express.js — MDN Guide', url: 'https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs' },
  graphql: { label: 'GraphQL — Official Docs', url: 'https://graphql.org/learn/' },
  tailwind: { label: 'Tailwind CSS — Docs', url: 'https://tailwindcss.com/docs' },
};

/**
 * Find a resource suggestion for a given missing skill.
 * Falls back to a Google search if no curated entry exists.
 */
export function getResourceForSkill(skill: string): { label: string; url: string } {
  const key = normalise(skill);
  for (const [mapKey, resource] of Object.entries(SKILL_RESOURCES)) {
    if (key === normalise(mapKey) || key.includes(normalise(mapKey)) || normalise(mapKey).includes(key)) {
      return resource;
    }
  }
  // Fallback to a Google search for a free course
  return {
    label: `Search free ${skill} courses`,
    url: `https://www.google.com/search?q=free+${encodeURIComponent(skill)}+course`,
  };
}
