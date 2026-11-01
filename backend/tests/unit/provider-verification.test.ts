import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { validateVerificationDocument, verificationTransition, maxDocumentBytes } from '../../src/services/verificationPolicy';
import { verificationSessionLimit } from '../../src/middleware/verificationRateLimit';
import { generateVerificationToken, verifyToken } from '../../src/utils/jwt';
import { verificationPng, verificationPdf, verificationUpload } from '../support/verification-document';
import { currentResourceOwnerVerified } from '../../src/utils/publicProvider';

it.each([
  [{ role: 'provider', providerProfile: { verified: true } }, true],
  [{ role: 'provider', providerProfile: { verified: false } }, false],
  [{ role: 'student', providerProfile: { verified: true } }, false],
  [null, false],
])('derives resource credibility from the current owner %j', (owner, expected) => expect(currentResourceOwnerVerified(owner)).toBe(expected));

describe('verification upload policy', () => {
  it('accepts a bounded PNG and trims the note without trusting a client MIME type', () => {
    const result = validateVerificationDocument({ ...verificationUpload(), note: '  Organization evidence  ', contentType: 'text/html' });
    expect(result.data).toEqual(verificationPng); expect(result.contentType).toBe('image/png'); expect(result.note).toBe('Organization evidence');
  });
  it('accepts a passive PDF and uses the default submission note', () => {
    expect(validateVerificationDocument({ fileName: 'registration.pdf', content: verificationPdf().toString('base64') }).contentType).toBe('application/pdf');
    expect(validateVerificationDocument({ ...verificationUpload(), note: ' ' }).note).toBe('Supporting evidence submitted.');
  });
  it.each(['../evidence.png', 'proof..png', 'evidence.exe', 'evidence.png.exe', 'bad\r\n.png', 'x'.repeat(121) + '.png', '/evidence.png'])('rejects unsafe names %j', (fileName) => expect(() => validateVerificationDocument(verificationUpload(fileName))).toThrow());
  it.each(['', 'not-base64!', 'iVBORw', 'AAAA====', 'AAAA\n', 'AB=='])('rejects malformed or noncanonical base64 %j', (content) => expect(() => validateVerificationDocument({ ...verificationUpload(), content })).toThrow());
  it('rejects oversized decoded content before storage', () => expect(() => validateVerificationDocument({ ...verificationUpload(), content: Buffer.alloc(maxDocumentBytes + 1).toString('base64') })).toThrow(/2 MiB/));
  it('rejects extension spoofing and truncated PNGs', () => {
    expect(() => validateVerificationDocument(verificationUpload('evidence.pdf'))).toThrow();
    expect(() => validateVerificationDocument({ ...verificationUpload(), content: verificationPng.subarray(0, 48).toString('base64') })).toThrow();
  });
  it('rejects excessive image dimensions and trailing payloads', () => {
    const large = Buffer.from(verificationPng); large.writeUInt32BE(9000, 16);
    for (const data of [large, Buffer.concat([verificationPng, Buffer.from('payload')])]) expect(() => validateVerificationDocument({ ...verificationUpload(), content: data.toString('base64') })).toThrow();
  });
  it.each(['/JavaScript (alert)', '/J#53 (alert)', '/Launch <<>>', '/OpenAction 2 0 R', '/EmbeddedFile <<>>', '/Encrypt <<>>', '/ObjStm <<>>', '/AcroForm <<>>'])('rejects restricted PDF features %s', (feature) => expect(() => validateVerificationDocument({ fileName: 'evidence.pdf', content: verificationPdf(feature).toString('base64') })).toThrow());
  it('rejects missing fields and oversized or invalid notes', () => {
    for (const body of [null, {}, { ...verificationUpload(), note: {} }, { ...verificationUpload(), note: 'x'.repeat(1001) }]) expect(() => validateVerificationDocument(body)).toThrow();
  });
  it('rejects fake JPEG headers without a frame and scan', () => expect(() => validateVerificationDocument({ fileName: 'evidence.jpg', content: Buffer.from('ffd8ffd900000000000000000000ffd9', 'hex').toString('base64') })).toThrow());
  it('accepts a bounded baseline JPEG frame and scan', () => {
    const content = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAAr/2Q==';
    expect(validateVerificationDocument({ fileName: 'evidence.jpg', content }).contentType).toBe('image/jpeg');
  });
});
describe('verification decisions', () => {
  it('supports review decisions and withdrawal for additional information', () => {
    expect(verificationTransition('PENDING', 'verified')).toBe('VERIFIED'); expect(verificationTransition('PENDING', 'rejected')).toBe('REJECTED');
    expect(verificationTransition('PENDING', 'more_info')).toBe('NEEDS_INFO'); expect(verificationTransition('VERIFIED', 'more_info')).toBe('NEEDS_INFO'); expect(verificationTransition('NEEDS_INFO', 'rejected')).toBe('REJECTED');
  });
  it.each([['NEEDS_INFO', 'verified'], ['REJECTED', 'verified'], ['VERIFIED', 'verified'], ['REJECTED', 'rejected'], ['PENDING', 'owner']])('rejects invalid transition %s/%s', (status, action) => expect(() => verificationTransition(status as 'PENDING', action)).toThrow());
  it('issues a short-lived token explicitly scoped to verification', () => {
    const decoded = verifyToken(generateVerificationToken('000000000000000000000002', 3));
    expect(decoded.scope).toBe('verification'); expect(decoded.version).toBe(3); expect(decoded.exp! - decoded.iat!).toBe(900);
  });
});
describe('bounded verification sign-in attempts', () => {
  const response = () => { const res = { set: vi.fn(), status: vi.fn(), json: vi.fn() }; res.set.mockReturnValue(res); res.status.mockReturnValue(res); return res; };
  it('limits one normalized email across IP addresses and expires its window', () => {
    let time = 0; const limit = verificationSessionLimit(() => time); const res = response(); const next = vi.fn();
    for (let index = 0; index < 11; index++) limit({ ip: `127.0.0.${index}`, body: { email: ' Provider@Example.Test ' } } as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(10); expect(res.status).toHaveBeenLastCalledWith(429); expect(res.set).toHaveBeenCalledWith('Retry-After', '900');
    time = 900001; limit({ ip: '127.0.0.1', body: { email: 'provider@example.test' } } as Request, res as unknown as Response, next); expect(next).toHaveBeenCalledTimes(11);
  });
  it('also bounds attempts per IP across varying email addresses', () => {
    const limit = verificationSessionLimit(() => 0); const next = vi.fn(); const res = response();
    for (let index = 0; index < 61; index++) limit({ ip: '127.0.0.1', body: { email: `test-${index}@example.test` } } as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(60); expect(res.status).toHaveBeenLastCalledWith(429);
  });
});
