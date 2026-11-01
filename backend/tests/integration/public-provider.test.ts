import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import Opportunity from '../../src/models/Opportunity';
import Resource from '../../src/models/Resource';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, resourceFixture, scholarshipFixture, studentFixture } from '../support/fixtures';

const app = createApp();
const database = new TestDatabase();
const privateValues = ['private-login@example.test', 'private-contact@example.test', 'Private Contact Person', 'PRIVATE-PHONE', 'PRIVATE-DECISION', 'PRIVATE-DOCUMENT.pdf', 'PRIVATE-FUTURE-FIELD'];
const auth = (id: typeof ids.student, role = 'student') => `Bearer ${generateToken(id.toString(), role)}`;
beforeAll(() => database.start());
beforeEach(async () => {
  await database.clear();
  const fixture = providerFixture();
  await User.create([studentFixture(), adminFixture(), {
    ...fixture, email: privateValues[0], providerProfile: {
      ...fixture.providerProfile, contactEmail: privateValues[1], contactPerson: privateValues[2],
      phone: privateValues[3], rejectionReason: privateValues[4], verificationDocumentName: privateValues[5],
      website: 'https://organization.example.test',
    },
  }]);
  // Simulate an unknown field already present in MongoDB, bypassing schema stripping.
  await User.collection.updateOne({ _id: ids.provider }, { $set: { 'providerProfile.futureSensitiveField': privateValues[6] } });
  await Opportunity.create(scholarshipFixture());
  await Resource.create(resourceFixture());
});
afterAll(() => database.stop());

function expectPrivateDataAbsent(body: unknown) {
  const serialized = JSON.stringify(body);
  for (const value of privateValues) expect(serialized).not.toContain(value);
  for (const key of ['password', 'contactEmail', 'contactPerson', 'phone', 'rejectionReason', 'verificationDocumentName', 'verificationStatus', 'accountStatus', 'futureSensitiveField']) {
    expect(serialized).not.toContain(`"${key}":`);
  }
}

describe('public provider privacy through real API serialization', () => {
  it('serves a useful anonymous profile and published listings without private fields', async () => {
    const response = await request(app).get(`/api/providers/${ids.provider}`);
    expect(response.status).toBe(200);
    expectPrivateDataAbsent(response.body);
    expect(Object.keys(response.body.data.provider).sort()).toEqual(['_id', 'createdAt', 'fullName', 'providerProfile']);
    expect(response.body.data.provider.providerProfile).toEqual({
      organizationName: 'Synthetic Support Organization', organizationType: 'ngo', verified: true,
      location: 'Test Campus', description: providerFixture().providerProfile.description,
      website: 'https://organization.example.test', opportunityCategories: ['scholarships', 'technical_resources', 'mentorship'], resourceAccessMethods: ['donation'],
    });
    expect(response.body.data.opportunities[0]._id).toBe(ids.scholarship.toString());
    expect(response.body.data.resources[0]._id).toBe(ids.resource.toString());
  });

  it.each([
    ['/api/opportunities', 'opportunities', 'providerId'],
    ['/api/opportunities/scholarships', 'opportunities', 'providerId'],
    [`/api/opportunities/${ids.scholarship}`, 'opportunity', 'providerId'],
    ['/api/resources', 'resources', 'listedBy'],
    [`/api/resources/${ids.resource}`, 'resource', 'listedBy'],
  ])('restricts populated provider data on anonymous %s', async (path, key, ownerKey) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(200);
    expectPrivateDataAbsent(response.body);
    const data = response.body.data[key];
    const owner = (Array.isArray(data) ? data[0] : data)[ownerKey];
    expect(owner._id).toBe(ids.provider.toString());
    expect(owner).not.toHaveProperty('email');
    expect(owner.providerProfile).toEqual({ organizationName: 'Synthetic Support Organization', organizationType: 'ngo', verified: true });
  });

  it('applies the same restriction to student opportunity matches', async () => {
    const response = await request(app).get('/api/opportunities/matched').set('Authorization', auth(ids.student));
    expect(response.status).toBe(200);
    expectPrivateDataAbsent(response.body);
    expect(response.body.data.opportunities[0].providerId).not.toHaveProperty('email');
    expect(response.body.data.opportunities[0].matchPercentage).toEqual(expect.any(Number));
  });

  it('does not disclose peer resource owners\' login email', async () => {
    await Resource.updateOne({ _id: ids.resource }, { listedBy: ids.student, providerOrgVerified: false });
    const response = await request(app).get(`/api/resources/${ids.resource}`);
    expect(response.status).toBe(200);
    expect(response.body.data.resource.listedBy).toMatchObject({ _id: ids.student.toString(), fullName: 'Synthetic Student', role: 'student' });
    expect(response.body.data.resource.listedBy).not.toHaveProperty('email');
    expect(JSON.stringify(response.body)).not.toContain('student@example.test');
  });

  it('preserves the owner\'s private profile and editable contact fields', async () => {
    const authorization = auth(ids.provider, 'provider');
    const me = await request(app).get('/api/auth/me').set('Authorization', authorization);
    expect(me.status).toBe(200);
    expect(me.body.data.user.providerProfile.verificationDocumentName).toBe(privateValues[5]);
    expect(me.body.data.user.email).toBe(privateValues[0]);
    const edited = await request(app).put('/api/provider/profile').set('Authorization', authorization).send({ contactEmail: 'updated-private@example.test' });
    expect(edited.status).toBe(200);
    expect(edited.body.data.user.providerProfile.contactEmail).toBe('updated-private@example.test');
    const publicProfile = await request(app).get(`/api/providers/${ids.provider}`);
    expectPrivateDataAbsent(publicProfile.body);
    expect(JSON.stringify(publicProfile.body)).not.toContain('updated-private@example.test');
    expect(me.body.data.user).not.toHaveProperty('password');
  });

  it('keeps verification documents available only through the existing authorized admin review', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'PENDING' });
    const response = await request(app).get('/api/admin/providers').set('Authorization', auth(ids.admin, 'admin'));
    expect(response.status).toBe(200);
    expect(response.body.data.providers[0].providerProfile.verificationDocumentName).toBe(privateValues[5]);
    expect((await request(app).get('/api/admin/providers')).status).toBe(401);
    expect((await request(app).get('/api/admin/providers').set('Authorization', auth(ids.student))).status).toBe(403);
  });

  it('preserves not-found and invalid-ID responses without private data', async () => {
    for (const [id, status] of [[ids.outsider.toString(), 404], [ids.student.toString(), 404], ['invalid-id', 400]] as const) {
      const response = await request(app).get(`/api/providers/${id}`);
      expect(response.status).toBe(status);
      expectPrivateDataAbsent(response.body);
    }
  });
});
