import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProviderResourceRequests, updateResourceRequestStatus } from '../api/resourceRequestApi';
import type { ResourceRequest, ResourceRequestStatus } from '../types';

const statuses: Array<Exclude<ResourceRequestStatus, 'pending'>> = ['accepted', 'rejected', 'completed'];
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const ProviderResourceRequestsPage = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [filter, setFilter] = useState<ResourceRequestStatus | 'all'>('pending');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<string[]>([]);
  const visible = useMemo(() => filter === 'all' ? requests : requests.filter((item) => item.status === filter), [requests, filter]);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true); setLoadError('');
      void getProviderResourceRequests().then((items) => { if (!cancelled) setRequests(items); })
        .catch(() => { if (!cancelled) setLoadError('Unable to load resource requests.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [retry]);
  const update = async (id: string, status: Exclude<ResourceRequestStatus, 'pending'>) => {
    setError(''); setPending((current) => [...current, id]);
    try {
      const updated = await updateResourceRequestStatus(id, status);
      setRequests((items) => items.map((item) => item._id === id ? {
        ...item, ...updated,
        studentId: typeof updated.studentId === 'object' && updated.studentId ? updated.studentId : item.studentId,
        resourceId: typeof updated.resourceId === 'object' && updated.resourceId ? updated.resourceId : item.resourceId,
      } : item));
    } catch { setError('Unable to update this request.'); }
    finally { setPending((current) => current.filter((item) => item !== id)); }
  };
  return <main className="max-w-6xl mx-auto px-4 sm:px-6 py-9">
    <Link to="/provider" className="text-sm text-primary-700">← Provider dashboard</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-bold text-surface-900">Resource requests</h1>
    <p className="mt-2 text-gray-600">Priority badges explain the fair-allocation score; acceptance remains your decision.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="mt-6 flex flex-wrap gap-2">{(['pending', 'accepted', 'rejected', 'completed', 'all'] as const).map((status) => <button key={status} aria-pressed={filter === status} onClick={() => setFilter(status)} className={`rounded-lg px-3 py-2 text-sm ${filter === status ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{humanize(status)}</button>)}</div>
    {loading ? <p role="status" className="mt-6 text-gray-600">Loading resource requests…</p> : loadError ? <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6"><p role="alert" className="text-red-700">{loadError}</p><button onClick={() => setRetry((current) => current + 1)} className="mt-3 font-semibold text-primary-700">Try again</button></div> : <div className="mt-6 space-y-4">{visible.map((request) => {
      const student = typeof request.studentId === 'string' ? undefined : request.studentId;
      const studentId = typeof request.studentId === 'string' ? request.studentId : student?._id;
      const resource = typeof request.resourceId === 'string' ? undefined : request.resourceId;
      const canMessage = studentId && /^[a-f\d]{24}$/i.test(studentId) && request.status !== 'rejected';
      return <article key={request._id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 md:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-gray-900">{resource?.itemName || 'Resource listing'}</h2><span className="tag">{humanize(request.status)}</span>{request.priorityScore !== undefined && <span title={request.priorityReasons?.join(' • ')} className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.isWaitlisted ? 'bg-amber-100 text-amber-800' : 'bg-primary-100 text-primary-800'}`}>{request.isWaitlisted ? 'Waitlisted' : 'Priority'} {request.priorityScore}/100</span>}</div><p className="mt-2 text-sm text-gray-600">Requested by {student?.fullName || 'Student'}{student?.email ? ` · ${student.email}` : ''}</p><p className="mt-3 max-w-2xl text-sm text-gray-700"><strong>Need statement:</strong> {request.justification}</p></div><div className="flex flex-wrap items-start gap-2 md:shrink-0">{canMessage && <button onClick={() => navigate('/messages', { state: { recipientId: studentId } })} className="min-h-11 rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-700">Message student</button>}<select aria-label={`Request status for ${resource?.itemName || 'resource'}`} disabled={pending.includes(request._id)} className="feed-input md:w-44" value={request.status} onChange={(event) => { const status = event.target.value as ResourceRequestStatus; if (status !== 'pending') void update(request._id, status); }}><option value="pending" disabled>Pending</option>{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div></div></article>;
    })}{!visible.length && <p className="rounded-xl bg-white p-6 text-gray-600">No matching requests.</p>}</div>}
  </main>;
};

export default ProviderResourceRequestsPage;
