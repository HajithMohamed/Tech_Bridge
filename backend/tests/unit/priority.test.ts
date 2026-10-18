import { describe, expect, it } from 'vitest';
import User from '../../src/models/User';
import Opportunity from '../../src/models/Opportunity';
import Application from '../../src/models/Application';
import { applicationPriority } from '../../src/utils/priorityEngine';
import { matchScore } from '../../src/utils/matchEngine';
import { applicationFixture, fixedDate, scholarshipFixture, studentFixture } from '../support/fixtures';

describe('existing explainable priority behavior', () => {
  it('increases priority for greater declared need with all other factors held constant', () => {
    const student = new User(studentFixture());
    const opportunity = new Opportunity(scholarshipFixture());
    const score = (need: string) => applicationPriority(new Application(applicationFixture({ selfDeclaredNeed: need })), opportunity, student, 0, fixedDate, fixedDate, 0);
    expect(score('high').priorityScore).toBeGreaterThan(score('low').priorityScore);
    expect(score('high').priorityReasons).toContain('High declared need');
  });
  it('marks a pending applicant waitlisted when capacity is filled without changing their decision status', () => {
    const application = new Application(applicationFixture());
    const result = applicationPriority(application, new Opportunity(scholarshipFixture()), undefined, 0, fixedDate, fixedDate, 1);
    expect(result.isWaitlisted).toBe(true);
    expect(application.status).toBe('applied');
  });
  it('explains matched and missing skills for a partially matching student', () => {
    const opportunity = new Opportunity(scholarshipFixture({ requiredSkills: ['typescript', 'Python'] }));
    const result = matchScore(new User(studentFixture()).studentProfile, opportunity);
    expect(result.matchedSkills).toEqual(['typescript']);
    expect(result.missingSkills).toEqual(['Python']);
    expect(result.matchPercentage).toBeGreaterThanOrEqual(0);
    expect(result.matchPercentage).toBeLessThanOrEqual(100);
  });
});
