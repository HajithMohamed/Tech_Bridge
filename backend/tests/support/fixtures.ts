import { Types } from 'mongoose';

export const fixedDate = new Date('2026-01-01T12:00:00.000Z');
export const futureDate = new Date('2099-01-01T12:00:00.000Z');
export const testPassword = 'Synthetic-Test-Password-42!';
export const ids = {
  student: new Types.ObjectId('000000000000000000000001'),
  provider: new Types.ObjectId('000000000000000000000002'),
  admin: new Types.ObjectId('000000000000000000000003'),
  lecturer: new Types.ObjectId('000000000000000000000004'),
  alumni: new Types.ObjectId('000000000000000000000005'),
  outsider: new Types.ObjectId('000000000000000000000006'),
  scholarship: new Types.ObjectId('000000000000000000000010'),
  resource: new Types.ObjectId('000000000000000000000011'),
  conversation: new Types.ObjectId('000000000000000000000012'),
};

export const studentFixture = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.student, fullName: 'Synthetic Student', email: 'student@example.test',
  password: testPassword, role: 'student', accountStatus: 'active',
  studentProfile: { institution: 'Test University', degree: 'ICT', studyYear: 2, skills: ['TypeScript', 'React'], careerGoal: 'developer' },
  createdAt: fixedDate, ...overrides,
});

export const providerFixture = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.provider, fullName: 'Synthetic Provider', email: 'provider@example.test',
  password: testPassword, role: 'provider', accountStatus: 'active',
  providerProfile: {
    organizationName: 'Synthetic Support Organization', organizationType: 'ngo',
    contactPerson: 'Test Reviewer', contactEmail: 'provider@example.test', phone: '+94110000000',
    location: 'Test Campus', description: 'Synthetic organization used only in isolated automated tests.',
    opportunityCategories: ['scholarships', 'technical_resources', 'mentorship'],
    resourceAccessMethods: ['donation'], verified: true, verificationStatus: 'VERIFIED',
  },
  createdAt: fixedDate, ...overrides,
});

export const adminFixture = () => ({ _id: ids.admin, fullName: 'Synthetic Admin', email: 'admin@example.test', password: testPassword, role: 'admin', accountStatus: 'active' });
export const lecturerFixture = () => {
  const provider = providerFixture();
  return { ...provider, _id: ids.lecturer, fullName: 'Synthetic Lecturer', email: 'lecturer@example.test', providerProfile: { ...provider.providerProfile, organizationType: 'faculty', opportunityCategories: ['mentorship'] } };
};
export const alumniFixture = () => {
  const provider = providerFixture();
  return { ...provider, _id: ids.alumni, fullName: 'Synthetic Alumni', email: 'alumni@example.test', providerProfile: { ...provider.providerProfile, organizationType: 'alumni', opportunityCategories: ['mentorship'] } };
};
export const scholarshipFixture = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.scholarship, providerId: ids.provider, title: 'Synthetic Scholarship',
  description: 'Scholarship fixture for safe automated application tests.', type: 'scholarship',
  requiredSkills: ['TypeScript'], location: 'Test Campus', workMode: 'remote',
  status: 'open', applicationDeadline: futureDate, amount: 1000, currency: 'LKR',
  numberOfAwards: 1, coverageType: 'partial', eligibilityCriteria: ['Enrolled student'], renewable: false,
  ...overrides,
});
export const applicationFixture = (overrides: Record<string, unknown> = {}) => ({
  studentId: ids.student, providerId: ids.provider, opportunityId: ids.scholarship,
  justification: 'Synthetic justification for isolated automated scholarship testing.',
  selfDeclaredNeed: 'medium', status: 'applied', appliedAt: fixedDate, ...overrides,
});
export const resourceFixture = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.resource, listedBy: ids.provider, itemName: 'Synthetic Test Equipment', category: 'other',
  condition: 'used_good', accessType: 'donation', quantityAvailable: 1, status: 'available', providerOrgVerified: true,
  itemDetails: { other: { description: 'Synthetic equipment for API tests.' } },
  accessDetails: { donation: { itemAgeYears: 1, conditionNotes: 'Test fixture', pickupOrDeliveryMethod: 'Test campus', claimDeadline: futureDate } }, ...overrides,
});
export const resourceRequestFixture = (overrides: Record<string, unknown> = {}) => ({
  studentId: ids.student, providerId: ids.provider, resourceId: ids.resource, resourceCategory: 'other',
  requestedAccessType: 'donation', justification: 'Synthetic justification for an isolated equipment request.',
  selfDeclaredNeed: 'medium', status: 'pending', ...overrides,
});
export const conversationFixture = () => ({
  _id: ids.conversation, participantIds: [ids.student, ids.provider],
  participantKey: [ids.student.toString(), ids.provider.toString()].sort().join(':'),
});
export const messageFixture = () => ({ conversationId: ids.conversation, senderId: ids.student, content: 'Synthetic private message for test participants only.' });
export const campaignFixture = () => ({ studentId: ids.student, providerId: ids.provider, campaignBrief: 'Synthetic campus campaign.', deliverables: 'One test portfolio submission.', compensationType: 'experience', deadline: futureDate });
