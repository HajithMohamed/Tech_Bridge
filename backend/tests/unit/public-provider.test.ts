import { describe, expect, it } from 'vitest';
import type { IUser } from '../../src/models/User';
import { toPublicProviderDetails } from '../../src/utils/publicProvider';

describe('public provider contract', () => {
  it('excludes private and future fields even when passed an unprojected profile', () => {
    const details = toPublicProviderDetails({
      organizationName: 'Synthetic Organization', organizationType: 'ngo', verified: true,
      location: 'Test Campus', website: 'https://organization.example.test', logoUrl: '/logo.svg',
      description: 'Public description', opportunityCategories: ['scholarships'], resourceAccessMethods: ['donation'],
      contactPerson: 'Private Reviewer', contactEmail: 'private@example.test', phone: 'private-phone',
      verificationStatus: 'VERIFIED', rejectionReason: 'private decision', verificationDocumentName: 'private.pdf',
      futureSensitiveField: 'never public',
    } as NonNullable<IUser['providerProfile']>);
    expect(details).toEqual({
      organizationName: 'Synthetic Organization', organizationType: 'ngo', verified: true,
      location: 'Test Campus', website: 'https://organization.example.test', logoUrl: '/logo.svg',
      description: 'Public description', opportunityCategories: ['scholarships'], resourceAccessMethods: ['donation'],
    });
  });

  it('does not invent optional data or turn an unverified profile into a verified one', () => {
    const details = JSON.parse(JSON.stringify(toPublicProviderDetails({
      organizationName: 'Synthetic Organization', organizationType: 'ngo', verified: false,
      location: 'Test Campus', opportunityCategories: [],
    })));
    expect(details).toEqual({ organizationName: 'Synthetic Organization', organizationType: 'ngo', verified: false, location: 'Test Campus', opportunityCategories: [] });
  });
});
