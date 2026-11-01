import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, studentFixture, testPassword } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
beforeAll(() => database.start()); beforeEach(async () => { await database.clear(); await User.create([studentFixture(), providerFixture(), adminFixture()]); }); afterAll(() => database.stop());
async function parserRequest(payload: Buffer, encoding = 'gzip', contentType = 'application/json') {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = (server.address() as { port: number }).port;
  try {
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port, method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': contentType, 'Content-Encoding': encoding, 'Content-Length': payload.length, Connection: 'close' } }, (res) => {
        let body = ''; res.setEncoding('utf8'); res.on('data', (chunk) => body += chunk); res.on('end', () => resolve({ status: res.statusCode!, body })); res.on('error', reject);
      }); req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Synthetic parser request timed out'))); req.end(payload);
    });
    // A subsequent real request proves the process survived trailing decoder errors.
    const health = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(5000) }); expect(health.status).toBe(200); return response;
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}
describe('backend security regression API', () => {
  it('requires a real bearer scheme, retaining case-insensitive valid sessions', async () => {
    const token = generateToken(String(ids.student), 'student');
    expect((await request(app).get('/api/auth/me').set('Authorization', `BearerExtra ${token}`)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', `bearer ${token}`)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token} extra`)).status).toBe(401);
  });
  it('keeps persisted roles, token revocation and restricted scopes authoritative', async () => {
    const claimedAdmin = generateToken(String(ids.student), 'admin'); expect((await request(app).get('/api/admin/users').auth(claimedAdmin, { type: 'bearer' })).status).toBe(403);
    const token = generateToken(String(ids.student), 'student'); await User.updateOne({ _id: ids.student }, { $inc: { tokenVersion: 1 } }); expect((await request(app).get('/api/auth/me').auth(token, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).get('/api/messages/conversations').auth(generateVerificationToken(String(ids.provider)), { type: 'bearer' })).status).toBe(401);
  });
  it('rejects unsupported/non-expiring signed tokens at the actual API', async () => {
    const payload = { userId: String(ids.student), role: 'student' };
    for (const token of [jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS384', expiresIn: '1m' }), jwt.sign(payload, process.env.JWT_SECRET!)]) expect((await request(app).get('/api/auth/me').auth(token, { type: 'bearer' })).status).toBe(401);
  });
  it('retains allowed CORS clients, withholds unknown origins and disables proxy trust', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173'); expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await request(app).get('/api/health').set('Origin', 'https://untrusted.example.test'); expect(denied.headers['access-control-allow-origin']).toBeUndefined(); expect(app.get('trust proxy')).toBe(false);
    expect((await request(app).get('/api/admin/users').set('X-Forwarded-For', '127.0.0.1')).status).toBe(401);
  });
  it('does not cache private authentication failures or advertise the framework', async () => {
    const response = await request(app).get('/api/auth/me'); expect(response.status).toBe(401); expect(response.headers['cache-control']).toBe('no-store'); expect(response.headers['x-powered-by']).toBeUndefined(); expect(response.headers['x-content-type-options']).toBe('nosniff'); expect(response.headers['referrer-policy']).toBe('no-referrer');
    const dashboard = await request(app).get('/api/dashboard/stats').auth(generateToken(String(ids.student), 'student'), { type: 'bearer' }); expect(dashboard.status).toBe(200); expect(dashboard.headers['cache-control']).toBe('no-store');
  });
  it('rejects malformed JSON and object-valued credentials without reflecting input', async () => {
    const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"password":"synthetic-private-input",'); expect(malformed.status).toBe(400); expect(JSON.stringify(malformed.body)).not.toContain('synthetic-private-input');
    expect((await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: 'synthetic-private-input' })).status).toBe(400);
  });
  it('preserves valid compressed JSON requests and survives trailing compressed bytes', async () => {
    const valid = await parserRequest(gzipSync(JSON.stringify({ email: studentFixture().email, password: testPassword })));
    expect(valid.status).toBe(200); expect(JSON.parse(valid.body).success).toBe(true);
    const response = await parserRequest(Buffer.concat([gzipSync('{}'), Buffer.from('synthetic-trailing-bytes')])); expect(response.status).toBe(400); expect(response.body).not.toContain('synthetic-trailing-bytes');
  });
  it('handles invalid/unsupported encodings and decompression limits with sanitized errors', async () => {
    const malformed = await parserRequest(Buffer.from('synthetic-private-input')); expect(malformed.status).toBe(400); expect(malformed.body).not.toContain('synthetic-private-input');
    const unsupported = await parserRequest(Buffer.from('{}'), 'compress'); expect(unsupported.status).toBe(415); expect(JSON.parse(unsupported.body).message).toBe('Unsupported request encoding.');
    const oversized = await parserRequest(gzipSync(JSON.stringify({ password: 'x'.repeat(6 * 1024 * 1024) }))); expect(oversized.status).toBe(413);
  });
  it('retains extended form parsing without prototype/array input crashes', async () => {
    const response = await parserRequest(gzipSync('email[isBuffer]=true&email[buffer]=synthetic-private-input&password=x'), 'gzip', 'application/x-www-form-urlencoded'); expect(response.status).toBe(400); expect(response.body).not.toContain('synthetic-private-input');
  });
});
