import { describe, expect, it } from 'vitest';
import { canManageResources, enabledOpportunityTypes } from '../../utils/providerCapabilities';
import { providerFixture } from '../fixtures';

describe('provider capability boundaries', () => {
  it('limits enabled opportunities to the organization capability matrix', () => {
    const profile = providerFixture().providerProfile!;
    expect(enabledOpportunityTypes({ ...profile, organizationType: 'company', opportunityCategories: ['scholarships', 'jobs'] })).toEqual(['job', 'freelance', 'promotion']);
  });
  it('does not enable resource management from a selected offering alone', () => {
    const profile = providerFixture().providerProfile!;
    expect(canManageResources({ ...profile, organizationType: 'company', opportunityCategories: ['technical_resources'] })).toBe(false);
  });
  it('requires an explicit enabled resource offering for eligible organizations', () => {
    const profile = providerFixture().providerProfile!;
    expect(canManageResources(profile)).toBe(false);
    expect(canManageResources({ ...profile, opportunityCategories: ['technical_resources'] })).toBe(true);
  });
});
