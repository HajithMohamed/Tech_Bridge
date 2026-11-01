import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import User from '../../src/models/User';
import { CampusEvent, CampusOrganizer, EventRegistration } from '../../src/models/CampusEvent';
import { canRecordAttendance, eventCapacity, eventDate, eventId, eventInput, eventObject, eventPage, eventPublicationActive, eventRevision, eventText, organizerEligible, organizerIdentity } from '../../src/services/campusEventPolicy';
import { defaultNotificationPreferences, notificationPreferencesInput, notificationTemplate } from '../../src/services/notificationPolicy';
import { ids, providerFixture, studentFixture } from '../support/fixtures';

const now = new Date('2026-10-31T12:00:00.000Z');
const payload = () => ({ title: 'Campus workshop', description: 'A synthetic workshop for isolated tests.', category: 'workshop', mode: 'campus', venue: 'Test University Hall', startsAt: '2026-11-01T12:00:00.000Z', endsAt: '2026-11-01T14:00:00.000Z', registrationClosesAt: '2026-11-01T11:00:00.000Z', capacity: 2 });
const student = () => new User(studentFixture());
const grantFor = (user = student()) => new CampusOrganizer({ ownerId: user._id, revision: 1, status: 'approved', institution: 'Test University', identity: organizerIdentity(user), actorId: ids.admin, reason: 'Independent test review.', affiliationReference: 'Synthetic reviewed campus evidence.' });

describe('campus event validation and scheduling policy', () => {
  it('accepts and normalizes bounded UTC metadata without inventing ownership or publication', () => {
    const value = eventInput({ ...payload(), title: '  Campus workshop  ', joinInstructions: '  Private ticket instructions  ' }, now, true);
    expect(value.title).toBe('Campus workshop'); expect(value.joinInstructions).toBe('Private ticket instructions'); expect(value.startsAt).toEqual(new Date(payload().startsAt)); expect(value).not.toHaveProperty('organizerId'); expect(value).not.toHaveProperty('status');
  });
  it.each(['university', 'hackathon', 'workshop', 'seminar', 'career_fair', 'networking', 'other'])('supports %s events', category => expect(eventInput({ ...payload(), category }, now).category).toBe(category));
  it.each(['campus', 'online', 'hybrid'])('supports %s events', mode => expect(eventInput({ ...payload(), mode }, now).mode).toBe(mode));
  it.each([
    { title: 'ab' }, { title: 'x'.repeat(161) }, { description: 'short' }, { description: 'x'.repeat(5001) }, { venue: '' }, { venue: 'x'.repeat(201) }, { joinInstructions: 'x'.repeat(1501) }, { mode: 'private' }, { category: 'invalid' }, { organizerId: String(ids.admin) }, { status: 'published' }, { registeredCount: 0 }, { title: { $ne: null } }, { description: 'Hidden\u0000 control character.' },
  ])('rejects invalid or privileged event fields %j', changes => expect(() => eventInput({ ...payload(), ...changes }, now)).toThrow());
  it.each([
    { startsAt: now.toISOString() }, { startsAt: '2028-01-01T12:00:00.000Z' }, { endsAt: payload().startsAt }, { endsAt: '2026-11-16T12:00:00.001Z' }, { registrationClosesAt: '2026-11-01T12:00:00.001Z' }, { registrationClosesAt: now.toISOString() },
  ])('rejects invalid schedule boundaries %j', changes => expect(() => eventInput({ ...payload(), ...changes }, now, true)).toThrow());
  it('allows organizers to close registration through an edit and clear private instructions', () => {
    expect(eventInput({ ...payload(), registrationClosesAt: now.toISOString(), joinInstructions: '' }, now).joinInstructions).toBe('');
    expect(eventInput({ ...payload(), registrationClosesAt: payload().startsAt }, now, true).capacity).toBe(2);
  });
  it.each(['2026-02-30T12:00:00.000Z', '2026-11-01', '2026-11-01T12:00:00Z', '2026-11-01T12:00:00.000+00:00', '', {}, [], new Date('invalid')])('rejects ambiguous or invalid dates %j', value => expect(() => eventDate(value)).toThrow());
  it.each([0, -1, 10001, 1.5, '2', NaN, Infinity, null, {}])('rejects invalid capacity %j', value => expect(() => eventCapacity(value)).toThrow());
  it('bounds capacity by actual committed registrations', () => { expect(eventCapacity(10000, 10000)).toBe(10000); expect(eventCapacity(1, 1)).toBe(1); expect(() => eventCapacity(1, 2)).toThrow(); });
  it.each([undefined, null, -1, 0.5, '0', {}, Number.MAX_SAFE_INTEGER + 1])('rejects invalid revisions %j', value => expect(() => eventRevision(value)).toThrow());
  it.each(['0', '-1', '1.1', '10001', {}, [], 'Infinity'])('rejects unbounded or injected pagination %j', value => expect(() => eventPage(value)).toThrow());
  it('rejects MongoDB operators and arrays as IDs, objects and text', () => {
    for (const value of [{ $ne: null }, [], 'not-an-id']) expect(() => eventId(value)).toThrow();
    expect(String(eventId(String(ids.student)))).toBe(String(ids.student)); expect(eventRevision(0)).toBe(0); expect(eventPage(undefined)).toBe(1); expect(eventPage('10000')).toBe(10000);
    expect(() => eventObject([], [])).toThrow(); expect(() => eventObject({ revision: 0, ownerId: ids.admin }, ['revision'])).toThrow(); expect(() => eventText({ $regex: '.' })).toThrow();
  });
});
describe('independent organizer permission and explicit attendance', () => {
  it('requires an active approved grant bound to the current identity and campus', () => {
    const user = student(); const grant = grantFor(user); expect(organizerEligible(user, grant)).toBe(true);
    expect(organizerEligible(user, null)).toBe(false); expect(organizerEligible(null, grant)).toBe(false);
    for (const changes of [{ fullName: 'Changed identity' }, { email: 'changed@example.test' }, { accountStatus: 'suspended' }, { requiresEmailVerification: true }, { role: 'admin' }, { studentProfile: { institution: 'Other University' } }]) expect(organizerEligible(new User({ ...studentFixture(), ...changes }), grant)).toBe(false);
    expect(organizerEligible(user, new CampusOrganizer({ ...grant.toObject(), status: 'revoked' }))).toBe(false);
    expect(organizerEligible(user, new CampusOrganizer({ ...grant.toObject(), ownerId: ids.outsider }))).toBe(false);
    expect(organizerEligible(user, new CampusOrganizer({ ...grant.toObject(), institution: 'Other University' }))).toBe(false);
  });
  it('binds providers to actual verified evidence and reviewed organization details', () => {
    const documentId = new Types.ObjectId(); const fixture = providerFixture(); const user = new User({ ...fixture, providerProfile: { ...fixture.providerProfile, verificationDocumentId: documentId } });
    const grant = new CampusOrganizer({ ...grantFor().toObject(), ownerId: user._id, identity: organizerIdentity(user) }); expect(organizerEligible(user, grant)).toBe(true);
    for (const changes of [{ verified: false }, { verificationStatus: 'PENDING' }, { verificationDocumentId: new Types.ObjectId() }, { organizationName: 'Unreviewed organization' }, { organizationType: 'individual' }]) expect(organizerEligible(new User({ ...user.toObject(), providerProfile: { ...user.providerProfile, ...changes } }), grant)).toBe(false);
  });
  it('requires explicit republication under a renewed grant revision', () => {
    const user = student(); const grant = grantFor(user); const event = new CampusEvent({ ...payload(), organizerId: user._id, grantRevision: 1, institution: grant.institution });
    expect(eventPublicationActive(event, user, grant)).toBe(true); grant.revision = 2; expect(eventPublicationActive(event, user, grant)).toBe(false);
  });
  it('permits explicit attendance only after start and through seven days after the end', () => {
    const event = new CampusEvent({ ...payload(), status: 'published' }); const end = new Date(event.endsAt.getTime() + 7 * 86400000);
    expect(canRecordAttendance(event, now)).toBe(false); expect(canRecordAttendance(event, event.startsAt)).toBe(true); expect(canRecordAttendance(event, end)).toBe(true); expect(canRecordAttendance(event, new Date(end.getTime() + 1))).toBe(false);
    event.status = 'completed'; expect(canRecordAttendance(event, end)).toBe(true); event.status = 'cancelled'; expect(canRecordAttendance(event, end)).toBe(false); event.status = 'draft'; expect(canRecordAttendance(event, end)).toBe(false);
  });
  it('enforces unique tickets and required model inventory constraints', () => {
    const row = new EventRegistration({ eventId: new Types.ObjectId(), studentId: ids.student, registeredAt: now }); expect(row.validateSync()).toBeUndefined(); expect(row.attendance).toBe('unmarked');
    expect(EventRegistration.schema.indexes()).toContainEqual([{ eventId: 1, studentId: 1 }, expect.objectContaining({ unique: true })]);
    expect(new CampusEvent({ ...payload(), organizerId: ids.student, organizerName: 'Test', grantRevision: 1, institution: 'Test University', registeredCount: -1 }).validateSync()).toBeDefined();
  });
});
describe('event notifications and older client compatibility', () => {
  it('accepts seven-category clients while validating the eighth category', () => {
    const { event: _event, ...legacy } = defaultNotificationPreferences().categories;
    expect(notificationPreferencesInput({ revision: 0, inApp: true, categories: legacy }).categories).not.toHaveProperty('event');
    expect(() => notificationPreferencesInput({ revision: 0, inApp: true, categories: { ...legacy, event: 'true' } })).toThrow();
    const { message: _message, ...incomplete } = legacy; expect(() => notificationPreferencesInput({ revision: 0, inApp: true, categories: incomplete })).toThrow();
  });
  it('uses generic templates without event, roster or private joining details', () => {
    expect(notificationTemplate('event', 'student', 'due')).toEqual({ title: 'Campus event reminder', body: 'Your campus event activity has an update.', href: '/impact' });
    expect(notificationTemplate('event', 'student', 'decision', 'event_organizer').title).toBe('Campus organizer approval update');
  });
});
