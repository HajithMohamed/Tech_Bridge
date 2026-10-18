import type { RegisterData, User } from '../types';

export const testPassword = 'Synthetic-Test-Password-42!';
export const studentFixture = (overrides: Partial<User> = {}): User => ({
  _id: '000000000000000000000001', fullName: 'Synthetic Student', email: 'student@example.test', role: 'student', accountStatus: 'active',
  createdAt: '2026-01-01T12:00:00.000Z',
  studentProfile: { institution: 'Test University', degree: 'ICT', studyYear: 2, skills: ['TypeScript', 'React'] }, ...overrides,
});
export const providerFixture = (): User => ({
  _id: '000000000000000000000002', fullName: 'Synthetic Provider', email: 'provider@example.test', role: 'provider',
  createdAt: '2026-01-01T12:00:00.000Z',
  providerProfile: {
    organizationName: 'Synthetic Organization', organizationType: 'ngo', verified: false, verificationStatus: 'PENDING',
    contactEmail: 'provider@example.test', contactPerson: 'Synthetic Reviewer', phone: '+94110000000', location: 'Test Campus',
    description: 'Synthetic organization for isolated automated tests.', opportunityCategories: ['scholarships'],
  },
});
export const providerRegistration = (): RegisterData => {
  const provider = providerFixture();
  return { fullName: provider.fullName, email: provider.email, role: 'provider', password: testPassword, confirmPassword: testPassword, providerProfile: provider.providerProfile };
};
