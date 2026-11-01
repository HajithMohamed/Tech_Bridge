import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, studentFixture, testPassword } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const auth = (id = ids.admin, version = 0) => `Bearer ${generateToken(id.toString(), 'admin', version)}`;
const mutate = (path: string, payload: object, actor = ids.admin, version = 0) => request(app).patch(`/api/admin/users/${ids.student}/${path}`).set('Authorization', auth(actor, version)).send(payload);
beforeAll(() => database.start()); beforeEach(async () => { await database.clear(); await User.create([adminFixture(), studentFixture(), providerFixture()]); }); afterAll(() => database.stop());

describe('admin user management with real MongoDB', () => {
  it('filters users by role, status and escaped name/email search', async () => {
    await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' });
    const result = await request(app).get('/api/admin/users?role=student&status=suspended&q=Synthetic').set('Authorization', auth());
    expect(result.status).toBe(200); expect(result.body.data.total).toBe(1); expect(result.body.data.users[0]._id).toBe(ids.student.toString());
    expect(JSON.stringify(result.body)).not.toContain('password'); expect(JSON.stringify(result.body)).not.toContain('tokenVersion');
    expect((await request(app).get('/api/admin/users?q=.*').set('Authorization', auth())).body.data.total).toBe(0);
  });
  it('paginates real users without duplicates', async () => {
    await User.insertMany(Array.from({ length: 22 }, (_, index) => ({ ...studentFixture(), _id: new Types.ObjectId(), email: `page-${index}@example.test` })));
    const first = await request(app).get('/api/admin/users?page=1').set('Authorization', auth());
    const second = await request(app).get('/api/admin/users?page=2').set('Authorization', auth());
    expect(first.body.data.users).toHaveLength(20); expect(second.body.data.users).toHaveLength(5); expect(second.body.data.pages).toBe(2);
    expect(new Set([...first.body.data.users, ...second.body.data.users].map((user: { _id: string }) => user._id)).size).toBe(25);
  });
  it('suspends and reinstates with atomic before/after audit and revoked sessions', async () => {
    const oldToken = generateToken(ids.student.toString(), 'student');
    expect((await mutate('suspend', { reason: 'Policy investigation' })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').auth(oldToken, { type: 'bearer' })).status).toBe(401);
    expect((await mutate('reinstate', { reason: 'Investigation resolved' })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').auth(oldToken, { type: 'bearer' })).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'student@example.test', password: testPassword });
    expect(login.status).toBe(200); expect((await request(app).get('/api/auth/me').auth(login.body.data.token, { type: 'bearer' })).status).toBe(200);
    const entries = await AuditLog.find({ targetId: ids.student }).sort({ createdAt: 1 });
    expect(entries).toHaveLength(2); expect(entries[0]).toMatchObject({ adminId: ids.admin, action: 'user_suspended', reason: 'Policy investigation', before: { accountStatus: 'active' }, after: { accountStatus: 'suspended' } });
    expect(entries[1].action).toBe('user_reinstated');
  });
  it('grants admin and restores the recorded role, revoking old tokens', async () => {
    expect((await mutate('role', { role: 'admin', reason: 'Approved admin appointment' })).status).toBe(200);
    expect((await User.findById(ids.student))?.adminBaseRole).toBe('student');
    expect((await request(app).get('/api/admin/users').set('Authorization', auth(ids.student))).status).toBe(401);
    expect((await request(app).get('/api/admin/users').set('Authorization', auth(ids.student, 1))).status).toBe(200);
    expect((await mutate('role', { role: 'student', reason: 'Appointment completed' })).status).toBe(200);
    expect((await User.findById(ids.student))?.role).toBe('student'); expect((await User.findById(ids.student))?.adminBaseRole).toBeUndefined();
    expect((await request(app).get('/api/admin/users').set('Authorization', auth(ids.student, 1))).status).toBe(401);
    expect(await AuditLog.countDocuments({ action: 'user_role_changed' })).toBe(2);
  });
  it('does not convert students/providers or grant admin to pending providers', async () => {
    expect((await mutate('role', { role: 'provider', reason: 'Not a supported conversion' })).status).toBe(409);
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'PENDING' });
    expect((await request(app).patch(`/api/admin/users/${ids.provider}/role`).set('Authorization', auth()).send({ role: 'admin', reason: 'Attempted appointment' })).status).toBe(409);
    expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('grants and restores a verified provider without discarding their profile', async () => {
    const before = (await User.findById(ids.provider))?.providerProfile;
    const change = (role: string) => request(app).patch(`/api/admin/users/${ids.provider}/role`).set('Authorization', auth()).send({ role, reason: 'Approved role appointment' });
    expect((await change('admin')).status).toBe(200); expect((await User.findById(ids.provider))?.adminBaseRole).toBe('provider');
    expect((await change('provider')).status).toBe(200); expect((await User.findById(ids.provider))?.providerProfile).toEqual(before);
  });
  it('rejects self changes, missing/oversized reasons and invalid role/ID', async () => {
    expect((await request(app).patch(`/api/admin/users/${ids.admin}/suspend`).set('Authorization', auth()).send({ reason: 'Self action' })).status).toBe(400);
    for (const path of ['suspend', 'reinstate', 'role']) expect((await mutate(path, { role: 'admin' })).status).toBe(400);
    expect((await mutate('suspend', { reason: 'x'.repeat(1001) })).status).toBe(400);
    expect((await mutate('role', { role: 'owner', reason: 'Invalid role' })).status).toBe(400);
    expect((await request(app).patch('/api/admin/users/bad/suspend').set('Authorization', auth()).send({ reason: 'Valid reason' })).status).toBe(400);
  });
  it('denies non-admin access and ignores forged admin JWT roles', async () => {
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
    expect((await request(app).get('/api/admin/users').set('Authorization', auth(ids.student))).status).toBe(403);
    expect((await mutate('suspend', { reason: 'Unauthorized action' }, ids.provider)).status).toBe(403);
  });
  it('rolls back a user change when audit creation fails', async () => {
    vi.spyOn(AuditLog, 'create').mockImplementationOnce(() => { throw new Error('Private database error'); });
    const result = await mutate('suspend', { reason: 'Valid reason' }); expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('Private');
    expect((await User.findById(ids.student))?.accountStatus).toBe('active'); expect((await User.findById(ids.student).select('+tokenVersion'))?.tokenVersion).toBe(0); expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('keeps an active administrator when administrators try to suspend each other', async () => {
    await User.create({ ...adminFixture(), _id: ids.outsider, email: 'second-admin@example.test' });
    const results = await Promise.all([
      request(app).patch(`/api/admin/users/${ids.outsider}/suspend`).set('Authorization', auth()).send({ reason: 'Concurrent investigation' }),
      request(app).patch(`/api/admin/users/${ids.admin}/suspend`).set('Authorization', auth(ids.outsider)).send({ reason: 'Concurrent investigation' }),
    ]);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(await User.countDocuments({ role: 'admin', accountStatus: 'active' })).toBe(1); expect(await AuditLog.countDocuments()).toBe(1);
  });
  it('does not create duplicate audit events on an identical retry', async () => {
    const results = await Promise.all([mutate('suspend', { reason: 'Policy review' }), mutate('suspend', { reason: 'Policy review' })]);
    expect(results.map((result) => result.status)).toEqual([200, 200]); expect(await AuditLog.countDocuments({ action: 'user_suspended' })).toBe(1);
  });
  it('provides paginated per-user and global history with actor information', async () => {
    await AuditLog.insertMany(Array.from({ length: 35 }, () => ({ adminId: ids.admin, targetType: 'user', targetId: ids.student, action: 'legacy_action', reason: 'Synthetic history' })));
    const result = await request(app).get(`/api/admin/users/${ids.student}/history?page=2`).set('Authorization', auth());
    expect(result.status).toBe(200); expect(result.body.data.entries).toHaveLength(5); expect(result.body.data.total).toBe(35); expect(result.body.data.entries[0].adminId.fullName).toBe('Synthetic Admin');
    expect((await request(app).get(`/api/admin/audit-log?targetId=${ids.provider}`).set('Authorization', auth())).body.data.total).toBe(0);
  });
  it('rejects invalid pagination/filters and missing history targets', async () => {
    for (const query of ['page=0', 'role=owner', 'status=deleted']) expect((await request(app).get(`/api/admin/users?${query}`).set('Authorization', auth())).status).toBe(400);
    expect((await request(app).get(`/api/admin/users/${ids.outsider}/history`).set('Authorization', auth())).status).toBe(404);
  });
});
