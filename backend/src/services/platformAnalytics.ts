import mongoose, { Types, type ClientSession } from 'mongoose';
import User, { type IUser } from '../models/User';
import Opportunity from '../models/Opportunity';
import Application from '../models/Application';
import ResourceRequest from '../models/ResourceRequest';
import Report from '../models/Report';
import AuditLog from '../models/AuditLog';
import { CommunityClaim } from '../models/CommunityClaim';
import { ScholarshipAppeal } from '../models/Scholarship';
import { ResourceDispute } from '../models/ResourceActivity';
import { accessKinds, AnalyticsError, analyticsWindow, applicationStates, assertAnalyticsAccount, campaignStates, cohortMatch, countBuckets, countTotal, mentorshipStates, opportunityKinds, opportunityStates, resourceStates, sumCounts, withinCohort, type AnalyticsRole, type AnalyticsWindow } from './analyticsPolicy';
import { aggregateAnalytics, applicationMetrics, applicationStages, campaignMetrics, counted, discoveryMetrics, grouped, mentorshipMetrics, numeric, opportunityMetrics, opportunityStatusExpression, resourceListingMetrics, resourceRequestMetrics, resourceRequestStages, type Facets } from './analyticsQueries';

export const analyticsTransactions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
export type AnalyticsSession = { id: Types.ObjectId; role: AnalyticsRole; version: number };

async function adminMetrics(window: AnalyticsWindow, session: ClientSession) {
  const [users] = await aggregateAnalytics<Facets>(User, [
    { $match: cohortMatch(window) },
    { $facet: {
      roles: grouped('role'), active: counted({ accountStatus: { $ne: 'suspended' } }), suspended: counted({ accountStatus: 'suspended' }),
      verifiedProviders: counted({ role: 'provider', accountStatus: { $ne: 'suspended' }, 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED', $or: [{ requiresEmailVerification: { $ne: true } }, { emailVerifiedAt: { $type: 'date' } }] }),
      providersAwaitingVerification: counted({ role: 'provider', accountStatus: { $ne: 'suspended' }, 'providerProfile.verificationStatus': { $in: ['PENDING', 'NEEDS_INFO'] } }),
    } },
  ], session);
  const [reports] = await aggregateAnalytics<Facets>(Report, [{ $match: cohortMatch(window) }, { $facet: { statuses: grouped('status'), targets: grouped('targetType') } }], session);
  const [actions] = await aggregateAnalytics<{ count: number }>(AuditLog, [{ $match: cohortMatch(window) }, { $count: 'count' }], session);
  const [claims] = await aggregateAnalytics<{ count: number }>(CommunityClaim, [{ $match: { ...cohortMatch(window), status: { $in: ['PENDING', 'NEEDS_INFO'] } } }, { $count: 'count' }], session);
  const [appeals] = await aggregateAnalytics<{ count: number }>(ScholarshipAppeal, [{ $match: { ...cohortMatch(window), status: 'pending' } }, { $count: 'count' }], session);
  const [disputes] = await aggregateAnalytics<{ count: number }>(ResourceDispute, [{ $match: { ...cohortMatch(window), status: 'open' } }, { $count: 'count' }], session);
  const byRole = countBuckets(users.roles, ['student', 'provider', 'admin']);
  const reportsByStatus = countBuckets(reports.statuses, ['open', 'reviewed', 'dismissed']);
  return {
    accounts: { total: countTotal(byRole), byRole, activeAccounts: numeric(users, 'active'), suspendedAccounts: numeric(users, 'suspended'), verifiedProviders: numeric(users, 'verifiedProviders'), providersAwaitingVerification: numeric(users, 'providersAwaitingVerification') },
    pendingReviews: { communityClaims: claims?.count ?? 0, scholarshipAppeals: appeals?.count ?? 0, resourceDisputes: disputes?.count ?? 0 },
    moderation: { reports: countTotal(reportsByStatus), byStatus: reportsByStatus, byTarget: countBuckets(reports.targets, ['opportunity', 'resource', 'user', 'message', 'promotion_request']), administrativeActions: actions?.count ?? 0 },
  };
}

async function buildSummary(actor: AnalyticsSession, window: AnalyticsWindow, now: Date, session: ClientSession, current: IUser) {
  // Operations on one snapshot transaction session are deliberately sequential.
  const apps = await applicationMetrics(actor.role, actor.id, window, now, session);
  const requests = await resourceRequestMetrics(actor.role, actor.id, window, now, session);
  const mentoring = await mentorshipMetrics(actor.role, actor.id, window, now, session);
  const campaigns = await campaignMetrics(actor.role, actor.id, window, session);
  const appStatus = countBuckets(apps.statuses, applicationStates);
  const scholarshipStatus = countBuckets(apps.scholarships, applicationStates);
  const requestStatus = countBuckets(requests.statuses, resourceStates);
  const mentorStatus = countBuckets(mentoring.statuses, mentorshipStates);
  const campaignStage = countBuckets(campaigns.stages, campaignStates);
  const listings = actor.role === 'student' ? null : await opportunityMetrics(actor.role, actor.id, window, now, session);
  const resources = actor.role === 'student' ? null : await resourceListingMetrics(actor.role, actor.id, window, now, session);
  const discovery = actor.role === 'student' ? await discoveryMetrics(window, now, session) : null;
  const admin = actor.role === 'admin' ? await adminMetrics(window, session) : null;
  const opportunityStatus = listings ? countBuckets(listings.statuses, opportunityStates) : null;
  const resourceTypes = resources ? countBuckets(resources.accessTypes, accessKinds) : null;
  const discoveryTypes = discovery ? countBuckets(discovery.resources, accessKinds) : null;
  return {
    schemaVersion: 1, role: actor.role, scope: actor.role === 'admin' ? 'platform' : actor.role === 'provider' ? 'owned' : 'self', generatedAt: now,
    filter: { from: window.from ?? null, to: window.to ?? null, basis: 'record_creation', endExclusive: true },
    applications: { total: countTotal(appStatus), byStatus: appStatus, accepted: appStatus.accepted, unavailableSources: numeric(apps, 'unavailableSources'), ...(actor.role !== 'student' ? { acceptedStudents: numeric(apps, 'acceptedStudents') } : {}) },
    scholarships: { applications: countTotal(scholarshipStatus), byStatus: scholarshipStatus, confirmedAwards: numeric(apps, 'confirmedAwards'), acceptedWithoutAwardRecord: numeric(apps, 'legacyAwards') },
    resourceRequests: { total: countTotal(requestStatus), byStatus: requestStatus, active: sumCounts(requestStatus, ['pending', 'waitlisted', 'accepted']), confirmedAllocations: numeric(requests, 'allocations'), currentAllocations: numeric(requests, 'currentAllocations'), returnsConfirmed: numeric(requests, 'returnsConfirmed'), overdue: numeric(requests, 'overdue'), acceptedWithoutAllocationRecord: numeric(requests, 'legacyAllocations'), unavailableSources: numeric(requests, 'unavailableSources'), ...(actor.role !== 'student' ? { acceptedStudents: numeric(requests, 'acceptedStudents'), allocatedStudents: numeric(requests, 'allocatedStudents') } : {}) },
    mentorship: { total: countTotal(mentorStatus), byStatus: mentorStatus, active: sumCounts(mentorStatus, ['pending', 'approved', 'scheduled']), upcomingAppointments: numeric(mentoring, 'upcoming') },
    campaigns: { total: countTotal(campaignStage), byStage: campaignStage, active: sumCounts(campaignStage, ['pending', 'accepted', 'in_progress', 'submitted', 'changes_requested', 'reviewed']) },
    ...(listings && opportunityStatus ? { opportunities: { total: countTotal(opportunityStatus), byStatus: opportunityStatus, byType: countBuckets(listings.kinds, opportunityKinds), open: opportunityStatus.open, discoverableOpen: numeric(listings, 'discoverable'), expiringSoon: numeric(listings, 'expiringSoon'), views: numeric(listings, 'views') } } : {}),
    ...(resources && resourceTypes ? { resources: { totalListings: countTotal(resourceTypes), byAccessType: resourceTypes, availableListings: numeric(resources, 'available'), availableUnits: numeric(resources, 'available', 'units') } } : {}),
    ...(discovery && discoveryTypes ? { discovery: { openOpportunities: discovery.openOpportunities, availableResourceListings: countTotal(discoveryTypes), resourceListingsByAccessType: discoveryTypes } } : {}),
    ...(actor.role === 'student' ? { selfAccount: { registeredInCohort: Number(!window.from || withinCohort(current.createdAt, window)) } } : {}),
    ...(admin ?? {}),
    ...(admin ? { pendingRequests: { applications: sumCounts(appStatus, ['applied', 'reviewed', 'waitlisted']), resourceRequests: sumCounts(requestStatus, ['pending', 'waitlisted']), mentorshipRequests: mentorStatus.pending, creatorInvitations: campaignStage.pending, providerVerifications: admin.accounts.providersAwaitingVerification, ...admin.pendingReviews } } : {}),
  };
}
type Summary = Awaited<ReturnType<typeof buildSummary>>;

/** Preserve existing fields while scoping private distributions to the actor. */
function impactView(summary: Summary) {
  const nonzero = (values: Record<string, number>) => Object.fromEntries(Object.entries(values).filter(([, count]) => count > 0));
  return {
    totalStudents: summary.accounts?.byRole.student ?? summary.selfAccount?.registeredInCohort ?? summary.applications.acceptedStudents ?? 0,
    totalOpenOpportunities: summary.discovery?.openOpportunities ?? summary.opportunities?.discoverableOpen ?? 0,
    totalApplications: summary.applications.total,
    totalResourceListings: summary.discovery?.availableResourceListings ?? summary.resources?.totalListings ?? 0,
    applicationsByStatus: nonzero(summary.applications.byStatus),
    resourceListingsByAccessType: nonzero(summary.discovery?.resourceListingsByAccessType ?? summary.resources?.byAccessType ?? {}),
    scope: summary.scope, role: summary.role, filter: summary.filter,
  };
}

async function providerView(summary: Summary, actor: AnalyticsSession, window: AnalyticsWindow, now: Date, session: ClientSession) {
  const recentOpportunities = await aggregateAnalytics<{ _id: Types.ObjectId; title: string; type: string; status: string; applicationDeadline: Date; createdAt: Date; views: number }>(Opportunity, [
    { $match: { providerId: actor.id, ...cohortMatch(window) } }, { $sort: { createdAt: -1, _id: -1 } }, { $limit: 4 },
    { $project: { title: 1, type: 1, status: opportunityStatusExpression(now), applicationDeadline: 1, createdAt: 1, views: { $ifNull: ['$views', 0] } } },
  ], session);
  type Activity = { id: string; kind: string; title: string; detail: string; status: string; occurredAt: Date };
  const activities: Activity[] = recentOpportunities.map(row => ({ id: String(row._id), kind: 'opportunity', title: row.status === 'draft' ? 'Opportunity draft created' : 'Opportunity listing activity', detail: row.title, status: row.status, occurredAt: row.createdAt }));
  const recentApps = await aggregateAnalytics<{ _id: Types.ObjectId; status: string; appliedAt: Date; title: string }>(Application, [
    ...applicationStages('provider', actor.id, window), { $sort: { appliedAt: -1, _id: -1 } }, { $limit: 3 }, { $project: { status: 1, appliedAt: 1, title: '$source.title' } },
  ], session);
  const recentRequests = await aggregateAnalytics<{ _id: Types.ObjectId; status: string; createdAt: Date; title: string }>(ResourceRequest, [
    ...resourceRequestStages('provider', actor.id, window), { $sort: { createdAt: -1, _id: -1 } }, { $limit: 3 }, { $project: { status: 1, createdAt: 1, title: '$source.itemName' } },
  ], session);
  activities.push(...recentApps.map(row => ({ id: String(row._id), kind: 'application', title: 'New opportunity application', detail: row.title, status: row.status, occurredAt: row.appliedAt })));
  activities.push(...recentRequests.map(row => ({ id: String(row._id), kind: 'resource_request', title: 'New resource request', detail: row.title, status: row.status, occurredAt: row.createdAt })));
  const kinds = summary.opportunities!.byType;
  return {
    stats: {
      totalOpportunities: summary.opportunities!.total, scholarships: kinds.scholarship, paidProjects: sumCounts(kinds, ['job', 'freelance', 'promotion']), internships: kinds.internship, trainingPrograms: sumCounts(kinds, ['course', 'workshop']), mentorshipListings: kinds.mentorship,
      applicationsReceived: summary.applications.total, acceptedApplications: summary.applications.accepted, studentsConnected: summary.applications.acceptedStudents ?? 0,
      resourceRequestsReceived: summary.resourceRequests.total, pendingRequests: summary.resourceRequests.byStatus.pending, acceptedRequests: summary.resourceRequests.byStatus.accepted,
      activeListings: summary.opportunities!.open + summary.resources!.availableListings, resourceCount: summary.resources!.totalListings,
      resourceRequestsAccepted: sumCounts(summary.resourceRequests.byStatus, ['accepted', 'completed']), resourceStudentsConnected: summary.resourceRequests.acceptedStudents ?? 0,
      expiringSoon: summary.opportunities!.expiringSoon, views: summary.opportunities!.views,
      confirmedResourceAllocations: summary.resourceRequests.confirmedAllocations, confirmedScholarshipAwards: summary.scholarships.confirmedAwards, creatorCampaigns: summary.campaigns.total, activeCreatorCampaigns: summary.campaigns.active,
    },
    recentOpportunities,
    recentActivity: activities.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || a.id.localeCompare(b.id)).slice(0, 6),
    scope: summary.scope, filter: summary.filter,
  };
}

/** Read-only snapshot; no counters, actors, source records or credentials are changed. */
export async function readPlatformAnalytics(actor: AnalyticsSession, query: unknown, view: 'summary' | 'impact' | 'provider' = 'summary', now = new Date()) {
  const window = analyticsWindow(query);
  if (view === 'provider' && actor.role !== 'provider') throw new AnalyticsError(403, 'A provider account is required.');
  return mongoose.connection.transaction(async session => {
    const current = await User.findById(actor.id).select('+tokenVersion').session(session);
    assertAnalyticsAccount(current, actor.role, actor.version);
    const summary = await buildSummary(actor, window, now, session, current!);
    if (view === 'impact') return impactView(summary);
    if (view === 'provider') return providerView(summary, actor, window, now, session);
    return summary;
  }, analyticsTransactions);
}
