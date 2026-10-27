import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOpportunityApplicants, updateApplicationStatus } from '../api/applicationApi';
import { getMyOpportunities } from '../api/opportunityApi';
import { getProviderResourceRequests, updateResourceRequestStatus } from '../api/resourceRequestApi';
import type { ApplicationStatus, Opportunity, OpportunityApplication, ResourceRequest, ResourceRequestStatus } from '../types';

const applicationStatuses: ApplicationStatus[] = ['applied', 'reviewed', 'accepted', 'rejected'];
const resourceStatuses: ResourceRequestStatus[] = ['pending', 'accepted', 'rejected', 'completed'];
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const Priority = ({ item }: { item: { priorityScore?: number; priorityReasons?: string[]; isWaitlisted?: boolean } }) => item.priorityScore === undefined ? null : <span title={item.priorityReasons?.join(' • ')} className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isWaitlisted ? 'bg-amber-100 text-amber-800' : 'bg-primary-100 text-primary-800'}`}>{item.isWaitlisted ? 'Waitlisted' : 'Priority'} {item.priorityScore}/100</span>;
type LoadState<T> = { items: T[]; loading: boolean; error: string };

const ProviderApplicationsPage = () => {
  const [tab, setTab] = useState<'opportunities' | 'resources'>('opportunities');
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<LoadState<Opportunity>>({ items: [], loading: true, error: '' });
  const [selected, setSelected] = useState('');
  const [applications, setApplications] = useState<LoadState<OpportunityApplication> & { opportunityId: string }>({ opportunityId: '', items: [], loading: false, error: '' });
  const [requests, setRequests] = useState<LoadState<ResourceRequest>>({ items: [], loading: true, error: '' });
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tab !== 'opportunities') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setOpportunities((current) => ({ ...current, loading: true, error: '' }));
      void getMyOpportunities().then((items) => {
        if (cancelled) return;
        setOpportunities({ items, loading: false, error: '' });
        setSelected((current) => items.some((item) => item._id === current) ? current : items[0]?._id || '');
      }).catch(() => { if (!cancelled) setOpportunities({ items: [], loading: false, error: 'Unable to load your opportunities.' }); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [tab, retry]);
  useEffect(() => {
    if (tab !== 'opportunities' || !selected) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setApplications({ opportunityId: selected, items: [], loading: true, error: '' });
      void getOpportunityApplicants(selected).then((items) => {
        if (!cancelled) setApplications({ opportunityId: selected, items, loading: false, error: '' });
      }).catch(() => { if (!cancelled) setApplications({ opportunityId: selected, items: [], loading: false, error: 'Unable to load applicants.' }); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [tab, selected, retry]);
  useEffect(() => {
    if (tab !== 'resources') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRequests({ items: [], loading: true, error: '' });
      void getProviderResourceRequests().then((items) => { if (!cancelled) setRequests({ items, loading: false, error: '' }); })
        .catch(() => { if (!cancelled) setRequests({ items: [], loading: false, error: 'Unable to load resource requests.' }); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [tab, retry]);

  const updateApplication = async (id: string, status: ApplicationStatus) => {
    setError(''); setPending((current) => [...current, id]);
    try {
      const updated = await updateApplicationStatus(id, status);
      setApplications((current) => ({ ...current, items: current.items.map((item) => item._id === id ? {
        ...item, ...updated,
        studentId: typeof updated.studentId === 'object' && updated.studentId ? updated.studentId : item.studentId,
        opportunityId: typeof updated.opportunityId === 'object' && updated.opportunityId ? updated.opportunityId : item.opportunityId,
      } : item) }));
    } catch { setError('Unable to update application status.'); }
    finally { setPending((current) => current.filter((item) => item !== id)); }
  };
  const updateRequest = async (id: string, status: ResourceRequestStatus) => {
    setError(''); setPending((current) => [...current, id]);
    try {
      const updated = await updateResourceRequestStatus(id, status);
      setRequests((current) => ({ ...current, items: current.items.map((item) => item._id === id ? {
        ...item, ...updated,
        studentId: typeof updated.studentId === 'object' && updated.studentId ? updated.studentId : item.studentId,
        resourceId: typeof updated.resourceId === 'object' && updated.resourceId ? updated.resourceId : item.resourceId,
      } : item) }));
    } catch { setError('Unable to update request status.'); }
    finally { setPending((current) => current.filter((item) => item !== id)); }
  };
  const loadError = opportunities.error || (selected && applications.opportunityId === selected ? applications.error : '');
  const applicantsLoading = opportunities.loading || Boolean(selected && (applications.opportunityId !== selected || applications.loading));

  return <main className="max-w-6xl mx-auto px-4 sm:px-6 py-9">
    <Link to="/provider" className="text-sm text-primary-700 hover:text-primary-800">← Provider dashboard</Link>
    <section className="mt-5 mb-7"><p className="text-primary-700 text-sm font-semibold mb-2">Fair allocation</p><h1 className="text-2xl sm:text-3xl font-bold text-surface-900">Review requests</h1><p className="text-gray-600 mt-2">Priority is decision support, not an automatic outcome. Hover a score for its reasons.</p></section>
    <div className="flex border-b border-gray-200 mb-6">
      <button onClick={() => { setTab('opportunities'); setError(''); }} className={`px-5 py-3 text-sm ${tab === 'opportunities' ? 'text-primary-700 border-b-2 border-primary-600' : 'text-gray-600'}`}>Opportunity applications</button>
      <button onClick={() => { setTab('resources'); setError(''); }} className={`px-5 py-3 text-sm ${tab === 'resources' ? 'text-primary-700 border-b-2 border-primary-600' : 'text-gray-600'}`}>Resource requests</button>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-red-700">{error}</p>}
    {tab === 'opportunities' && <>
      {opportunities.items.length > 0 && <select aria-label="Opportunity to review" className="feed-input mb-5" value={selected} onChange={(event) => { setSelected(event.target.value); setError(''); }}>{opportunities.items.map((opportunity) => <option key={opportunity._id} value={opportunity._id}>{opportunity.title}</option>)}</select>}
      {applicantsLoading ? <p role="status" className="text-gray-600">Loading applicants…</p> : loadError ? <LoadError message={loadError} retry={() => setRetry((current) => current + 1)} /> : opportunities.items.length === 0 ? <div className="glass-card p-8"><h2 className="font-semibold text-gray-900">No opportunities to review yet</h2><p className="mt-2 text-gray-600">Create an opportunity to start receiving student applications.</p><Link to="/provider/opportunities" className="mt-4 inline-block font-semibold text-primary-700">Create an opportunity</Link></div> : applications.items.length === 0 ? <div className="glass-card p-8 text-gray-600">No applications for this opportunity.</div> : <div className="space-y-4">{applications.items.map((application) => {
        const student = typeof application.studentId === 'string' ? undefined : application.studentId;
        const studentId = typeof application.studentId === 'string' ? application.studentId : student?._id;
        return <article className="glass-card p-5" key={application._id}><div className="flex flex-col gap-5 md:flex-row md:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2 items-center"><h2 className="font-bold text-gray-900">{student?.fullName || 'Student applicant'}</h2><span className="tag">{humanize(application.status)}</span><Priority item={application} /></div><p className="mt-2 text-xs text-gray-600">{student?.email}{student?.email ? ' · ' : ''}{student?.studentProfile?.degree || 'Student'} · Year {student?.studentProfile?.studyYear || '—'}</p><p className="mt-4 max-w-2xl text-sm text-gray-700"><span className="font-semibold">Need statement:</span> {application.justification}</p>{application.message && <p className="mt-2 text-sm text-gray-700">“{application.message}”</p>}</div><div className="flex flex-wrap items-start gap-2 md:shrink-0">{studentId && /^[a-f\d]{24}$/i.test(studentId) && application.status !== 'rejected' && <button onClick={() => navigate('/messages', { state: { recipientId: studentId } })} className="rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-700">Message student</button>}<select aria-label={`Application status for ${student?.fullName || 'student applicant'}`} disabled={pending.includes(application._id)} className="feed-input md:w-44" value={application.status} onChange={(event) => void updateApplication(application._id, event.target.value as ApplicationStatus)}>{applicationStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div></div></article>;
      })}</div>}
    </>}
    {tab === 'resources' && <>
      {requests.loading ? <p role="status" className="text-gray-600">Loading requests…</p> : requests.error ? <LoadError message={requests.error} retry={() => setRetry((current) => current + 1)} /> : requests.items.length === 0 ? <div className="glass-card p-8 text-gray-600">No resource requests received.</div> : <div className="space-y-4">{requests.items.map((request) => {
        const student = typeof request.studentId === 'string' ? undefined : request.studentId;
        const studentId = typeof request.studentId === 'string' ? request.studentId : student?._id;
        const resource = typeof request.resourceId === 'string' ? undefined : request.resourceId;
        return <article className="glass-card p-5" key={request._id}><div className="flex flex-col gap-5 md:flex-row md:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2 items-center"><h2 className="font-bold text-gray-900">{student?.fullName || 'Student applicant'}</h2><span className="tag">{resource?.itemName || 'Resource'}</span><Priority item={request} /></div><p className="mt-4 max-w-2xl text-sm text-gray-700"><span className="font-semibold">Need statement:</span> {request.justification}</p></div><div className="flex flex-wrap items-start gap-2 md:shrink-0">{studentId && /^[a-f\d]{24}$/i.test(studentId) && request.status !== 'rejected' && <button onClick={() => navigate('/messages', { state: { recipientId: studentId } })} className="rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-700">Message student</button>}<select aria-label={`Request status for ${resource?.itemName || 'resource'}`} disabled={pending.includes(request._id)} className="feed-input md:w-44" value={request.status} onChange={(event) => void updateRequest(request._id, event.target.value as ResourceRequestStatus)}>{resourceStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div></div></article>;
      })}</div>}
    </>}
  </main>;
};

const LoadError = ({ message, retry }: { message: string; retry: () => void }) => <div className="glass-card p-6"><p role="alert" className="text-red-700">{message}</p><button onClick={retry} className="mt-3 font-semibold text-primary-700">Try again</button></div>;

export default ProviderApplicationsPage;
