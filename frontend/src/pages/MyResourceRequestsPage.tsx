import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getMyResourceRequests, getReceivedResourceRequests, updateResourceRequestStatus } from '../api/resourceRequestApi';
import type { ResourceRequest, ResourceRequestStatus } from '../types';

const styles: Record<ResourceRequestStatus, string> = { pending: 'bg-amber-50 text-amber-900', accepted: 'bg-emerald-50 text-emerald-800', rejected: 'bg-red-50 text-red-800', completed: 'bg-primary-50 text-primary-800' };
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const referenceId = (value: unknown): string | undefined => {
  const id = typeof value === 'string' ? value : value && typeof value === 'object' && '_id' in value ? value._id : undefined;
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) ? id : undefined;
};
const preservePopulation = <T extends { _id: string },>(previous: string | T | null, next: string | T | null) => typeof previous === 'object' && previous && typeof next === 'string' && previous._id === next ? previous : next;
const actionStyle = 'inline-flex items-center rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700';

export default function MyResourceRequestsPage() {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [received, setReceived] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    let cancelled = false; mounted.current = true;
    void Promise.all([getMyResourceRequests(), getReceivedResourceRequests()])
      .then(([outgoing, incoming]) => { if (!cancelled) { setRequests(outgoing); setReceived(incoming); } })
      .catch(() => { if (!cancelled) setError('Unable to load all resource requests.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; mounted.current = false; };
  }, []);
  const updateReceived = async (request: ResourceRequest, status: Exclude<ResourceRequestStatus, 'pending'>) => {
    if (updating) return;
    setError(''); setUpdating(request._id);
    try {
      const updated = await updateResourceRequestStatus(request._id, status);
      if (mounted.current) setReceived((items) => items.map((item) => item._id === request._id ? { ...item, ...updated, resourceId: preservePopulation(item.resourceId, updated.resourceId), studentId: preservePopulation(item.studentId, updated.studentId), providerId: preservePopulation(item.providerId, updated.providerId) } : item));
    } catch { if (mounted.current) setError('Unable to update this request.'); }
    finally { if (mounted.current) setUpdating(''); }
  };

  return <div className="bg-surface-50"><main className="mx-auto max-w-5xl px-4 py-9 sm:px-6">
    <section className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary-700">Student workspace</p><h1 className="mt-2 text-2xl font-bold text-gray-900">Resource requests</h1><p className="mt-2 text-gray-600">Follow up on resources you need and respond to requests for equipment you share.</p></div><Link to="/resources" className={actionStyle}>Browse resources</Link></section>
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p role="status" className="text-gray-600">Loading resource requests...</p> : error && !requests.length && !received.length ? null : <div className="space-y-9">
      <RequestSection title="Requests you sent" empty="No resource requests yet." link="/resources" linkLabel="Explore the Resource Hub" requests={requests} render={(request) => {
        const resource = request.resourceId && typeof request.resourceId === 'object' ? request.resourceId : undefined;
        const providerReference = request.providerId === undefined ? resource?.listedBy : request.providerId;
        const provider = providerReference && typeof providerReference === 'object' ? providerReference : undefined;
        const providerId = referenceId(providerReference);
        const isStudentOwner = provider && 'role' in provider && provider.role === 'student';
        const isUnverifiedProvider = provider?.providerProfile?.verified === false;
        const canViewProvider = providerId && !isStudentOwner && !isUnverifiedProvider && (typeof providerReference === 'string' || provider?.providerProfile || (provider && 'role' in provider && provider.role === 'provider'));
        const canMessage = canViewProvider && ['pending', 'accepted', 'completed'].includes(request.status);
        return <article key={request._id} className="rounded-xl border border-gray-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-lg font-semibold text-gray-900">{resource?.itemName || (request.resourceId === null ? 'Resource no longer available' : 'Resource listing')}</h3><p className="mt-1 text-sm text-gray-600">{humanize(request.requestedAccessType)} · {provider?.providerProfile?.organizationName || provider?.fullName || 'Listing owner'}</p>{request.durationOrTerms && <p className="mt-2 text-sm text-gray-700">Requested: {request.durationOrTerms}</p>}<p className="mt-2 text-sm text-gray-600">Sent {new Date(request.createdAt).toLocaleDateString('en-LK')}</p></div><Status status={request.status} /></div>{(canViewProvider || canMessage) && <div className="mt-4 flex flex-wrap gap-2">{canViewProvider && <Link to={`/providers/${providerId}`} className={actionStyle}>View provider</Link>}{canMessage && <Link to="/messages" state={{ recipientId: providerId }} className={actionStyle}>Message provider</Link>}</div>}</article>;
      }} />
      <RequestSection title="Requests for your shared resources" empty="No one has requested a resource you listed." link="/resources/list" linkLabel="List a resource" requests={received} render={(request) => {
        const resource = request.resourceId && typeof request.resourceId === 'object' ? request.resourceId : undefined;
        const student = request.studentId && typeof request.studentId === 'object' ? request.studentId : undefined;
        return <article key={request._id} className="rounded-xl border border-gray-200 bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-lg font-semibold text-gray-900">{resource?.itemName || 'Resource listing'}</h3><Status status={request.status} /></div><p className="mt-2 text-sm text-gray-600">Requested by {student?.fullName || 'Student no longer available'} · {student?.email || 'No email available'}</p>{request.durationOrTerms && <p className="mt-2 text-sm text-gray-700">Requested terms: {request.durationOrTerms}</p>}{request.message && <p className="mt-2 text-sm text-gray-700">“{request.message}”</p>}</div><RequestActions request={request} update={updateReceived} disabled={Boolean(updating)} /></div></article>;
      }} />
    </div>}
  </main></div>;
}

function RequestSection({ title, empty, link, linkLabel, requests, render }: { title: string; empty: string; link: string; linkLabel: string; requests: ResourceRequest[]; render: (request: ResourceRequest) => ReactNode }) {
  return <section><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h2 className="text-xl font-semibold text-gray-900">{title}</h2><span className="text-sm text-gray-600">{requests.length} request{requests.length === 1 ? '' : 's'}</span></div>{requests.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-6"><p className="text-gray-700">{empty}</p><Link to={link} className="mt-3 inline-block font-semibold text-primary-800 underline underline-offset-4">{linkLabel}</Link></div> : <div className="space-y-4">{requests.map(render)}</div>}</section>;
}
const Status = ({ status }: { status: ResourceRequestStatus }) => <span className={`self-start rounded-full px-3 py-1.5 text-sm font-semibold ${styles[status]}`}>{humanize(status)}</span>;
const RequestActions = ({ request, update, disabled }: { request: ResourceRequest; update: (request: ResourceRequest, status: Exclude<ResourceRequestStatus, 'pending'>) => void; disabled: boolean }) => request.status === 'pending' ? <div className="flex gap-2"><button disabled={disabled} onClick={() => update(request, 'accepted')} className="rounded-lg bg-primary-700 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">Accept</button><button disabled={disabled} onClick={() => update(request, 'rejected')} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">Decline</button></div> : request.status === 'accepted' ? <button disabled={disabled} onClick={() => update(request, 'completed')} className="rounded-lg bg-primary-700 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">Mark completed</button> : null;
