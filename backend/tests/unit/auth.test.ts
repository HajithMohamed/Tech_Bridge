import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { authorize } from '../../src/middleware/auth';
import { generateToken, verifyToken } from '../../src/utils/jwt';

describe('role authorization', () => {
  it.each(['student', 'provider', undefined])('rejects non-admin role %s', (role) => {
    const req = { user: role ? { role } : undefined } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    authorize('admin')(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it('permits an authorized administrator', () => {
    const next = vi.fn();
    authorize('admin')({ user: { role: 'admin' } } as Request, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });
});
describe('JWT regression', () => {
  it('round-trips a signed identity', () => {
    expect(verifyToken(generateToken('synthetic-user-id', 'student'))).toMatchObject({ userId: 'synthetic-user-id', role: 'student' });
  });
  it('rejects tampered tokens', () => {
    const token = generateToken('synthetic-user-id', 'student');
    const parts = token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ userId: 'other', role: 'admin' })).toString('base64url');
    expect(() => verifyToken(parts.join('.'))).toThrow();
  });
});
