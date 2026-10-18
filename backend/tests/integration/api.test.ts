import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import Opportunity from '../../src/models/Opportunity';
import Application from '../../src/models/Application';
import Resource from '../../src/models/Resource';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import PromotionRequest from '../../src/models/PromotionRequest';
import ResourceRequest from '../../src/models/ResourceRequest';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, alumniFixture, applicationFixture, campaignFixture, conversationFixture, ids, lecturerFixture, messageFixture, providerFixture, resourceFixture, resourceRequestFixture, scholarshipFixture, studentFixture, testPassword } from '../support/fixtures';

const app = createApp();
const database = new TestDatabase();
const bearer = (id: string, role = 'student') => `Bearer ${generateToken(id, role)}`;
beforeAll(() => database.start());
beforeEach(() => database.clear());
afterAll(() => database.stop());

describe('real API + isolated MongoDB', () => {
  it('preserves health and JSON not-found behavior', async () => {
    expect((await request(app).get('/api/health')).body.success).toBe(true);
    expect((await request(app).get('/api/does-not-exist')).status).toBe(404);
  });
  it('authenticates a hashed fixture password and keeps it out of API responses', async () => {
    await User.create(studentFixture());
    const login = await request(app).post('/api/auth/login').send({ email: 'student@example.test', password: testPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.user).not.toHaveProperty('password');
    const me = await request(app).get('/api/auth/me').auth(login.body.data.token, { type: 'bearer' });
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('student@example.test');
    expect(me.body.data.user).not.toHaveProperty('password');
    const stored = await User.findById(ids.student).select('+password');
    expect(stored?.password).not.toBe(testPassword);
  });
  it('rejects missing/invalid tokens and login credentials', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'missing@example.test', password: testPassword })).status).toBe(401);
  });
  it('rejects administrative role escalation during registration', async () => {
    const student = studentFixture();
    const response = await request(app).post('/api/auth/register').send({ ...student, role: 'admin', confirmPassword: testPassword });
    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });
  it('ignores supplied provider verification and withholds a pending-provider token', async () => {
    const provider = providerFixture();
    const response = await request(app).post('/api/auth/register').send({ ...provider, confirmPassword: testPassword });
    expect(response.status).toBe(201);
    expect(response.body.data).not.toHaveProperty('token');
    expect(response.body.data.user.providerProfile).toMatchObject({ verified: false, verificationStatus: 'PENDING' });
    expect((await request(app).post('/api/auth/login').send({ email: provider.email, password: testPassword })).status).toBe(403);
  });
  it('enforces current suspension and persisted roles even for previously issued tokens', async () => {
    await User.create(studentFixture());
    const token = bearer(ids.student.toString(), 'admin');
    expect((await request(app).get('/api/admin/users').set('Authorization', token)).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' });
    expect((await request(app).get('/api/auth/me').set('Authorization', token)).status).toBe(403);
  });
  it('allows an admin to verify a provider and records the existing audit event', async () => {
    await User.create(adminFixture());
    const provider = providerFixture();
    await User.create({ ...provider, providerProfile: { ...provider.providerProfile, verified: false, verificationStatus: 'PENDING' } });
    const response = await request(app).patch(`/api/admin/providers/${ids.provider}/verify`).set('Authorization', bearer(ids.admin.toString(), 'admin'));
    expect(response.status).toBe(200);
    expect((await User.findById(ids.provider))?.providerProfile?.verified).toBe(true);
    expect(await AuditLog.countDocuments({ action: 'provider_verified', targetId: ids.provider })).toBe(1);
  });
  it('submits an application and enforces the real unique application index', async () => {
    await User.create([studentFixture(), providerFixture()]);
    await Opportunity.create(scholarshipFixture());
    const payload = applicationFixture();
    const response = await request(app).post('/api/applications').set('Authorization', bearer(ids.student.toString())).send(payload);
    expect(response.status).toBe(201);
    expect((await request(app).post('/api/applications').set('Authorization', bearer(ids.student.toString())).send(payload)).status).toBe(409);
    expect(await Application.countDocuments()).toBe(1);
  });
  it('denies nonparticipants access to private history and sends', async () => {
    await User.create([studentFixture(), providerFixture(), studentFixture({ _id: ids.outsider, email: 'outsider@example.test' })]);
    await Conversation.create(conversationFixture());
    await Message.create(messageFixture());
    const auth = bearer(ids.outsider.toString());
    const history = await request(app).get(`/api/messages/conversations/${ids.conversation}/messages`).set('Authorization', auth);
    expect(history.status).toBe(404);
    expect(JSON.stringify(history.body)).not.toContain(messageFixture().content);
    expect((await request(app).post(`/api/messages/conversations/${ids.conversation}/messages`).set('Authorization', auth).send({ content: 'Unauthorized message' })).status).toBe(404);
    expect(await Message.countDocuments()).toBe(1);
  });
  it('does not grant administrators a nonparticipant private-history bypass', async () => {
    await User.create(adminFixture());
    await Conversation.create(conversationFixture());
    expect((await request(app).get(`/api/messages/conversations/${ids.conversation}/messages`).set('Authorization', bearer(ids.admin.toString(), 'admin'))).status).toBe(404);
  });
  it('preserves resource-owner authorization', async () => {
    await User.create(studentFixture());
    await Resource.create(resourceFixture());
    expect((await request(app).patch(`/api/resources/${ids.resource}/inventory`).set('Authorization', bearer(ids.student.toString())).send({ quantityAvailable: 100 })).status).toBe(404);
    expect((await Resource.findById(ids.resource))?.quantityAvailable).toBe(1);
  });
  it('provides valid synthetic fixtures for every planned feature family', async () => {
    await User.create([studentFixture(), providerFixture(), adminFixture(), lecturerFixture(), alumniFixture()]);
    await Opportunity.create(scholarshipFixture());
    await Application.create(applicationFixture());
    await Resource.create(resourceFixture());
    await ResourceRequest.create(resourceRequestFixture());
    await Conversation.create(conversationFixture());
    await Message.create(messageFixture());
    await PromotionRequest.create(campaignFixture());
    expect(await User.countDocuments()).toBe(5);
    expect(await PromotionRequest.countDocuments()).toBe(1);
  });
});
