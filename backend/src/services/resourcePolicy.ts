import { Types } from 'mongoose';
import type { IResourceListing, ResourceAccessType } from '../models/Resource';
import type { IResourceRequest } from '../models/ResourceRequest';

export class ResourceReservationError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}
export const resourceId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new ResourceReservationError(400, 'Invalid resource or request ID.');
  return new Types.ObjectId(value).toHexString();
};
export function resourceText(value: unknown, label: string, min = 10, max = 1000): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new ResourceReservationError(400, `${label} must be plain text between ${min} and ${max} characters.`);
  return value.trim();
}
export function resourceRevision(value: unknown, current: number, required = false): void {
  if (value === undefined && !required) return;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new ResourceReservationError(400, 'Provide a nonnegative whole revision.');
  if (value !== current) throw new ResourceReservationError(409, 'This record changed. Reload before trying again.');
}
export function resourceDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) throw new ResourceReservationError(400, 'Dates must be UTC ISO timestamps.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== value.slice(0, 19)) throw new ResourceReservationError(400, 'Invalid resource date.');
  return date;
}
export function returnPolicy(resource: Pick<IResourceListing, 'accessType' | 'returnPolicy' | 'returnDurationDays' | 'accessDetails'>) {
  const returnRequired = ['borrow', 'share', 'rent'].includes(resource.accessType) || (resource.accessType === 'sponsorship' && resource.returnPolicy === 'returnable');
  const durationDays = resource.accessType === 'rent' ? (resource.accessDetails.rent?.minRentalMonths ?? 1) * 30 : resource.accessType === 'sponsorship' ? resource.returnDurationDays ?? 30 : resource.accessDetails.borrowShare?.borrowDurationDays ?? 30;
  if (returnRequired && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650)) throw new ResourceReservationError(409, 'The listing needs a valid return duration before allocation.');
  return { returnRequired, durationDays };
}
export function listingReturnPolicy(accessType: ResourceAccessType, value: unknown, duration: unknown) {
  const expected = ['borrow', 'share', 'rent'].includes(accessType) ? 'returnable' : 'transfer';
  const selected = value ?? expected;
  if (!['returnable', 'transfer'].includes(selected as string) || (accessType !== 'sponsorship' && selected !== expected)) throw new ResourceReservationError(400, 'Return policy must match the resource ownership arrangement.');
  if (accessType === 'sponsorship' && selected === 'returnable') {
    if (!Number.isInteger(duration) || (duration as number) < 1 || (duration as number) > 3650) throw new ResourceReservationError(400, 'Returnable sponsorship needs a duration of 1 to 3650 days.');
    return { returnPolicy: 'returnable' as const, returnDurationDays: duration as number };
  }
  if (duration !== undefined) throw new ResourceReservationError(400, 'Use the borrow or rental terms for return duration.');
  return { returnPolicy: selected as 'returnable' | 'transfer' };
}
export function allocationDates(resource: IResourceListing, startValue: unknown, dueValue: unknown, now = new Date()) {
  const policy = returnPolicy(resource);
  if (!policy.returnRequired) {
    if (startValue !== undefined || dueValue !== undefined) throw new ResourceReservationError(400, 'Transfer arrangements do not have borrowing dates.');
    return { returnRequired: false, accessType: resource.accessType, inventoryReserved: true };
  }
  const startAt = startValue === undefined ? now : resourceDate(startValue);
  const dueAt = dueValue === undefined ? new Date(startAt.getTime() + policy.durationDays * 86_400_000) : resourceDate(dueValue);
  if (startAt.getTime() < now.getTime() - 300_000 || startAt.getTime() > now.getTime() + 365 * 86_400_000 || dueAt <= startAt || dueAt.getTime() > startAt.getTime() + 3650 * 86_400_000 || (resource.accessType === 'rent' && dueAt.getTime() < startAt.getTime() + policy.durationDays * 86_400_000)) throw new ResourceReservationError(400, 'Borrowing dates must be ordered, current or future, and within the supported duration.');
  if (resource.accessType !== 'rent' && dueAt.getTime() > startAt.getTime() + policy.durationDays * 86_400_000) throw new ResourceReservationError(400, 'Return deadline exceeds the listed borrowing duration.');
  return { returnRequired: true, accessType: resource.accessType, inventoryReserved: true, startAt, dueAt };
}
export function isResourceOverdue(request: Pick<IResourceRequest, 'status' | 'allocation'>, now = new Date()): boolean {
  return request.status === 'accepted' && request.allocation?.returnRequired === true && Boolean(request.allocation.dueAt && request.allocation.dueAt < now);
}
export function resourcePriority(need: 'low' | 'medium' | 'high', hasProfile: boolean, activeBenefits: number, at: Date, resource: IResourceListing) {
  const start = resource.createdAt?.getTime() ?? at.getTime();
  const deadline = resource.accessDetails.sponsorship?.applicationDeadline ?? resource.accessDetails.donation?.claimDeadline;
  const end = deadline?.getTime() ?? start + 365 * 86_400_000;
  const timing = end > start ? Math.max(0, Math.min(100, 100 - (at.getTime() - start) / (end - start) * 100)) : 50;
  const components = { need: { low: 100 / 3, medium: 200 / 3, high: 100 }[need], fit: hasProfile ? 90 : 70, benefits: Math.max(0, 100 - activeBenefits * 40), timing };
  return { priorityScore: Math.round(components.need * .4 + components.fit * .3 + components.benefits * .2 + timing * .1), priorityReasons: [`${need} self-declared need; not independently verified`, 'Weights: need 40%, profile fit 30%, active benefits 20%, timing 10%', `${activeBenefits} active benefits in this category`, 'Timing uses the original listing window; score is advisory'], components, calculatedAt: at };
}
export function rankResources(a: { prioritySnapshot?: { priorityScore: number }; createdAt: Date; _id: unknown }, b: { prioritySnapshot?: { priorityScore: number }; createdAt: Date; _id: unknown }): number {
  return (b.prioritySnapshot?.priorityScore ?? 0) - (a.prioritySnapshot?.priorityScore ?? 0) || a.createdAt.getTime() - b.createdAt.getTime() || String(a._id).localeCompare(String(b._id));
}
