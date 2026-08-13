import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, ClipboardList, Package, Send } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { getMyApplications } from '../api/applicationApi';
import { getMyResourceRequests } from '../api/resourceRequestApi';
import type { ApplicationStatus, OpportunityApplication, ResourceRequest, ResourceRequestStatus } from '../types';

type ActivityFilter = 'all' | 'applications' | 'resources';
type Activity = { id: string; kind: 'application' | 'resource'; title: string; detail: string; status: string; occurredAt: string; href: string };

const applicationStyle: Record<ApplicationStatus, string> = { applied: 'bg-primary-100 text-primary-700', reviewed: 'bg-amber-100 text-amber-800', accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };
const resourceStyle: Record<ResourceRequestStatus, string> = { pending: 'bg-amber-100 text-amber-800', accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700', completed: 'bg-primary-100 text-primary-700' };
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const applicationToActivity = (application: OpportunityApplication): Activity => {
  const opportunity = typeof application.opportunityId === 'string' ? undefined : application.opportunityId;
  return { id: `application-${application._id}`, kind: 'application', title: opportunity?.title || 'Opportunity application', detail: `${opportunity?.type ? humanize(opportunity.type) : 'Opportunity'} · ${opportunity?.location || 'Location not available'}`, status: application.status, occurredAt: application.appliedAt, href: opportunity ? `/opportunities/${opportunity._id}` : '/my-applications' };
};

const requestToActivity = (request: ResourceRequest): Activity => {
  const resource = typeof request.resourceId === 'string' ? undefined : request.resourceId;
  return { id: `resource-${request._id}`, kind: 'resource', title: resource?.itemName || 'Resource request', detail: `${humanize(request.requestedAccessType)} · ${resource?.category ? humanize(resource.category) : 'Resource listing'}`, status: request.status, occurredAt: request.createdAt, href: '/my-resource-requests' };
};

const MyActivityPage = () => {
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ActivityFilter>('all');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getMyApplications(), getMyResourceRequests()])
      .then(([applicationItems, requestItems]) => { if (!cancelled) { setApplications(applicationItems); setRequests(requestItems); } })
      .catch(() => { if (!cancelled) setError('Unable to load all of your activity right now.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const activities = useMemo(() => [...applications.map(applicationToActivity), ...requests.map(requestToActivity)].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()), [applications, requests]);
  const visible = activities.filter((activity) => filter === 'all' || (filter === 'applications' ? activity.kind === 'application' : activity.kind === 'resource'));
  const accepted = applications.filter((application) => application.status === 'accepted').length;
  const activeResources = requests.filter((request) => request.status === 'pending' || request.status === 'accepted').length;

  return <div className="min-h-screen bg-surface-50"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-9 sm:px-6"><section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Student workspace</p><h1 className="mt-2 text-3xl font-bold text-gray-900">My activity</h1><p className="mt-2 text-gray-500">One view of every opportunity application and technical-resource request you have sent.</p></div><div className="flex gap-2"><Link to="/opportunities" className="rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50">Find opportunities</Link><Link to="/resources" className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Find resources</Link></div></section>
    {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">{error}</div>}
    <section className="mt-7 grid gap-4 sm:grid-cols-3"><Metric icon={BriefcaseBusiness} value={applications.length} label="Applications sent" /><Metric icon={Send} value={accepted} label="Applications accepted" /><Metric icon={Package} value={activeResources} label="Active resource requests" /></section>
    <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Activity type">{([{ value: 'all', label: 'All activity' }, { value: 'applications', label: `Applications (${applications.length})` }, { value: 'resources', label: `Resource requests (${requests.length})` }] as Array<{ value: ActivityFilter; label: string }>).map((option) => <button key={option.value} type="button" role="tab" aria-selected={filter === option.value} onClick={() => setFilter(option.value)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${filter === option.value ? 'bg-primary-600 text-white' : 'bg-surface-50 text-gray-600 hover:bg-primary-50'}`}>{option.label}</button>)}</div></section>
    {loading ? <p className="py-14 text-center text-gray-400">Loading your activity…</p> : visible.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center"><ClipboardList className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-semibold text-gray-800">Nothing here yet</p><p className="mt-1 text-sm text-gray-500">Apply to an opportunity or send a resource request to begin tracking it here.</p></div> : <section className="mt-6 space-y-3">{visible.map((activity) => <Link key={activity.id} to={activity.href} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${activity.kind === 'application' ? 'bg-primary-100 text-primary-700' : 'bg-emerald-100 text-emerald-700'}`}>{activity.kind === 'application' ? <BriefcaseBusiness className="h-5 w-5" /> : <Package className="h-5 w-5" />}</div><div><p className="font-bold text-gray-900">{activity.title}</p><p className="mt-1 text-sm text-gray-500">{activity.detail}</p><p className="mt-2 text-xs text-gray-400">{activity.kind === 'application' ? 'Applied' : 'Requested'} {new Date(activity.occurredAt).toLocaleDateString('en-LK')}</p></div></div><span className={`w-fit rounded-full px-3 py-1.5 text-sm font-semibold ${activity.kind === 'application' ? applicationStyle[activity.status as ApplicationStatus] : resourceStyle[activity.status as ResourceRequestStatus]}`}>{humanize(activity.status)}</span></Link>)}</section>}
  </main></div>;
};

const Metric = ({ icon: Icon, value, label }: { icon: typeof BriefcaseBusiness; value: number; label: string }) => <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-primary-600" /><p className="mt-4 text-2xl font-bold text-gray-900">{value}</p><p className="mt-1 text-sm text-gray-500">{label}</p></article>;

export default MyActivityPage;
