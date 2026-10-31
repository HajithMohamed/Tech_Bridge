import type { Request, Response } from 'express';
import User from '../models/User';
import { CampusEvent, CampusEventAudit, CampusOrganizer, EventRegistration } from '../models/CampusEvent';
import { cancelEventRegistration, campusEventView, campusOrganizerContext, changeCampusEvent, createCampusEvent, decideCampusOrganizer, discoverCampusEvents, ownedCampusEvent, privateRegistration, publicCampusEvent, recordEventAttendance, registerForEvent, registrationView } from '../services/campusEvents';
import { CampusEventError, eventId, eventObject, eventPage, eventPublicationActive } from '../services/campusEventPolicy';

const fail = (res: Response, error: unknown) => res.status(error instanceof CampusEventError ? error.statusCode : 503).json({ success: false, message: error instanceof CampusEventError ? error.message : 'Campus event services are temporarily unavailable.' });
const run = (work: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response) => { try { res.status(status).json({ success: true, data: await work(req) }); } catch (error) { fail(res, error); } };
const pageInput = (query: unknown, extra: string[] = []) => { const values = eventObject(query, ['page', 'limit', ...extra]); return { values, page: eventPage(values.page), limit: eventPage(values.limit, 20, 100) }; };
const pagination = (total: number, page: number, limit: number) => ({ total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
export const browseCampusEvents = run(req => discoverCampusEvents(req.query));
export const getCampusEvent = run(async req => { eventObject(req.query, []); return { event: await publicCampusEvent(req.params.id) }; });
export const createEvent = run(async req => { const event = await createCampusEvent(req.user!._id, req.body); return { event: { ...campusEventView(event), joinInstructions: event.joinInstructions ?? '' } }; }, 201);
export const eventAction = (action: 'edit' | 'publish' | 'cancel' | 'complete', admin = false) => run(async req => { const event = await changeCampusEvent(req.user!._id, req.params.id, action, req.body, admin); return { event: { ...campusEventView(event), ...(!admin ? { joinInstructions: event.joinInstructions ?? '' } : {}) } }; });
export const ownOrganizer = run(async req => {
  eventObject(req.query, []); const current = await campusOrganizerContext(req.user!._id);
  return { organizer: current.grant ? { _id: current.grant._id, status: current.grant.status, institution: current.grant.institution, revision: current.grant.revision, reason: current.grant.reason } : null, eligible: current.eligible };
});
export const organizerDecision = run(async req => ({ organizer: await decideCampusOrganizer(req.user!._id, req.params.id, req.body) }));
export const organizerQueue = run(async req => {
  const { values, page, limit } = pageInput(req.query, ['status']);
  if (values.status !== undefined && !['approved', 'revoked'].includes(values.status as string)) throw new CampusEventError(400, 'Choose approved or revoked organizer status.');
  const filter = values.status ? { status: values.status } : {};
  const [organizers, total] = await Promise.all([CampusOrganizer.find(filter).select('+affiliationReference').populate('ownerId', 'fullName email role accountStatus').sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), CampusOrganizer.countDocuments(filter)]);
  return { organizers, ...pagination(total, page, limit) };
});
export const organizerHistory = run(async req => {
  const ownerId = eventId(req.params.id); const { page, limit } = pageInput(req.query);
  const grant = await CampusOrganizer.findOne({ ownerId }); if (!grant) throw new CampusEventError(404, 'Organizer approval not found.');
  const filter = { scope: 'organizer', targetId: grant._id };
  const [events, total] = await Promise.all([CampusEventAudit.find(filter).select('+affiliationReference -__v').sort({ revision: -1 }).skip((page - 1) * limit).limit(limit), CampusEventAudit.countDocuments(filter)]);
  return { events, ...pagination(total, page, limit) };
});
export const ownedEvents = (admin = false) => run(async req => {
  const { values, page, limit } = pageInput(req.query, ['status']);
  if (values.status !== undefined && !['draft', 'published', 'cancelled', 'completed'].includes(values.status as string)) throw new CampusEventError(400, 'Choose a valid event status.');
  const filter = { ...(!admin ? { organizerId: req.user!._id } : {}), ...(values.status ? { status: values.status } : {}) };
  const [rows, total] = await Promise.all([CampusEvent.find(filter).select(admin ? '' : '+joinInstructions').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), CampusEvent.countDocuments(filter)]);
  return { events: rows.map(row => ({ ...campusEventView(row), ...(!admin ? { joinInstructions: row.joinInstructions ?? '' } : {}) })), ...pagination(total, page, limit) };
});
export const getOwnedEvent = run(async req => { eventObject(req.query, []); const event = await ownedCampusEvent(req.user!._id, req.params.id); return { event: { ...campusEventView(event), joinInstructions: event.joinInstructions ?? '' } }; });
export const ownedEventHistory = run(async req => {
  const event = await ownedCampusEvent(req.user!._id, req.params.id); const { page, limit } = pageInput(req.query); const filter = { scope: 'event', targetId: event._id };
  const [events, total] = await Promise.all([CampusEventAudit.find(filter).select('-__v').sort({ revision: -1 }).skip((page - 1) * limit).limit(limit), CampusEventAudit.countDocuments(filter)]); return { events, ...pagination(total, page, limit) };
});
export const registerStudent = run(async req => ({ registration: registrationView(await registerForEvent(req.user!._id, req.params.id, req.body ?? {})) }), 201);
export const cancelStudentRegistration = run(async req => ({ registration: registrationView(await cancelEventRegistration(req.user!._id, req.params.id, req.body)) }));
export const markAttendance = run(async req => ({ registration: registrationView(await recordEventAttendance(req.user!._id, req.params.id, req.body)) }));
export const getRegistration = run(async req => { eventObject(req.query, []); return privateRegistration(req.user!._id, req.params.id); });
export const registrationHistory = run(async req => {
  const context = await privateRegistration(req.user!._id, req.params.id); const { page, limit } = pageInput(req.query); const filter = { scope: 'registration', targetId: context.registration._id };
  const [events, total] = await Promise.all([CampusEventAudit.find(filter).select('-__v').sort({ revision: -1 }).skip((page - 1) * limit).limit(limit), CampusEventAudit.countDocuments(filter)]); return { events, ...pagination(total, page, limit) };
});
export const studentRegistrations = run(async req => {
  const { values, page, limit } = pageInput(req.query, ['status']);
  if (values.status !== undefined && !['registered', 'cancelled'].includes(values.status as string)) throw new CampusEventError(400, 'Choose a valid registration status.');
  const filter = { studentId: req.user!._id, ...(values.status ? { status: values.status } : {}) };
  const [rows, total] = await Promise.all([EventRegistration.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), EventRegistration.countDocuments(filter)]);
  const events = await CampusEvent.find({ _id: { $in: rows.map(row => row.eventId) } }).select('+joinInstructions'); const ids = events.map(event => event.organizerId);
  const [users, grants] = await Promise.all([User.find({ _id: { $in: ids } }), CampusOrganizer.find({ ownerId: { $in: ids } }).select('+identity')]);
  const byEvent = new Map(events.map(event => [String(event._id), event])); const byUser = new Map(users.map(user => [String(user._id), user])); const byGrant = new Map(grants.map(grant => [String(grant.ownerId), grant]));
  return { registrations: rows.map(row => { const event = byEvent.get(String(row.eventId)); const active = Boolean(event && event.status === 'published' && eventPublicationActive(event, byUser.get(String(event.organizerId)) ?? null, byGrant.get(String(event.organizerId)) ?? null)); return { registration: registrationView(row), event: event ? campusEventView(event) : null, eventAvailable: active, effectiveStatus: event?.status === 'cancelled' ? 'event_cancelled' : event ? row.status : 'unavailable', ...(active && row.status === 'registered' ? { joinInstructions: event!.joinInstructions ?? '' } : {}) }; }), ...pagination(total, page, limit) };
});
export const eventRoster = run(async req => {
  const event = await ownedCampusEvent(req.user!._id, req.params.id); const context = await campusOrganizerContext(req.user!._id);
  if (!context.eligible || context.grant!.institution !== event.institution) throw new CampusEventError(403, 'Current organizer approval is required.');
  const { values, page, limit } = pageInput(req.query, ['status', 'attendance']);
  const status = values.status ?? 'registered'; if (!['registered', 'cancelled'].includes(status as string)) throw new CampusEventError(400, 'Choose a valid registration status.');
  if (values.attendance !== undefined && !['unmarked', 'attended', 'absent'].includes(values.attendance as string)) throw new CampusEventError(400, 'Choose a valid attendance state.');
  const filter = { eventId: event._id, status, ...(values.attendance ? { attendance: values.attendance } : {}) };
  const [rows, total] = await Promise.all([EventRegistration.find(filter).populate('studentId', 'fullName studentProfile.institution').sort({ registeredAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit), EventRegistration.countDocuments(filter)]);
  return { registrations: rows.map(registrationView), ...pagination(total, page, limit) };
});
