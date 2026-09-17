import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOpportunityApplicants, updateApplicationStatus } from '../api/applicationApi';
import { getMyOpportunities } from '../api/opportunityApi';
import { getProviderResourceRequests, updateResourceRequestStatus } from '../api/resourceRequestApi';
import type { ApplicationStatus, Opportunity, OpportunityApplication, ResourceRequest, ResourceRequestStatus } from '../types';

const applicationStatuses: ApplicationStatus[] = ['applied', 'reviewed', 'accepted', 'rejected'];
const resourceStatuses: ResourceRequestStatus[] = ['pending', 'accepted', 'rejected', 'completed'];
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const Priority = ({ item }: { item: { priorityScore?: number; priorityReasons?: string[]; isWaitlisted?: boolean } }) => item.priorityScore === undefined ? null : <span title={item.priorityReasons?.join(' • ')} className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isWaitlisted ? 'bg-amber-500/20 text-amber-200' : 'bg-primary-500/20 text-primary-200'}`}>{item.isWaitlisted ? 'Waitlisted' : 'Priority'} {item.priorityScore}/100</span>;

const ProviderApplicationsPage = () => {
  const [tab, setTab] = useState<'opportunities' | 'resources'>('opportunities');
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selected, setSelected] = useState('');
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (tab !== 'opportunities') return; void getMyOpportunities().then((items) => { setOpportunities(items); setSelected((current) => current || items[0]?._id || ''); }).catch(() => setError('Unable to load your opportunities.')); }, [tab]);
  useEffect(() => {
    if (tab !== 'opportunities' || !selected) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getOpportunityApplicants(selected).then(setApplications).catch(() => setError('Unable to load applicants.')).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, selected]);
  useEffect(() => {
    if (tab !== 'resources') return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getProviderResourceRequests().then(setRequests).catch(() => setError('Unable to load resource requests.')).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab]);

  const updateApplication = async (id: string, status: ApplicationStatus) => { try { const updated = await updateApplicationStatus(id, status); setApplications((items) => items.map((item) => item._id === id ? { ...item, ...updated } : item)); } catch { setError('Unable to update application status.'); } };
  const updateRequest = async (id: string, status: ResourceRequestStatus) => { try { const updated = await updateResourceRequestStatus(id, status); setRequests((items) => items.map((item) => item._id === id ? { ...item, ...updated } : item)); } catch { setError('Unable to update request status.'); } };

  return <main className="min-h-screen max-w-6xl mx-auto px-4 sm:px-6 py-9"><Link to="/provider" className="text-sm text-primary-300 hover:text-white">← Provider dashboard</Link><section className="mt-5 mb-7"><p className="text-accent-400 text-sm font-semibold mb-2">FAIR ALLOCATION</p><h1 className="text-3xl font-bold text-white">Review requests</h1><p className="text-gray-400 mt-2">Priority is decision support, not an automatic outcome. Hover a score for its reasons.</p></section>
    <div className="flex border-b border-white/10 mb-6"><button onClick={() => setTab('opportunities')} className={`px-5 py-3 text-sm ${tab === 'opportunities' ? 'text-primary-300 border-b-2 border-primary-500' : 'text-gray-400'}`}>Opportunity applications</button><button onClick={() => setTab('resources')} className={`px-5 py-3 text-sm ${tab === 'resources' ? 'text-primary-300 border-b-2 border-primary-500' : 'text-gray-400'}`}>Resource requests</button></div>
    {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-100">{error}</p>}
    {tab === 'opportunities' && <>{opportunities.length > 0 && <select className="feed-input mb-5" value={selected} onChange={(event) => setSelected(event.target.value)}>{opportunities.map((opportunity) => <option key={opportunity._id} value={opportunity._id}>{opportunity.title}</option>)}</select>}{loading ? <p className="text-gray-400">Loading applicants…</p> : applications.length === 0 ? <div className="glass-card p-8 text-gray-400">No applications for this opportunity.</div> : <div className="space-y-4">{applications.map((application) => { const student = typeof application.studentId === 'string' ? undefined : application.studentId; return <article className="glass-card p-5" key={application._id}><div className="flex flex-col gap-5 md:flex-row md:justify-between"><div><div className="flex flex-wrap gap-2 items-center"><h2 className="font-bold text-white">{student?.fullName || 'Student applicant'}</h2><span className="tag">{humanize(application.status)}</span><Priority item={application} /></div><p className="mt-2 text-xs text-gray-500">{student?.email} · {student?.studentProfile?.degree || 'Student'} · Year {student?.studentProfile?.studyYear || '—'}</p><p className="mt-4 max-w-2xl text-sm text-gray-300"><span className="font-semibold text-gray-400">Need statement:</span> {application.justification}</p>{application.message && <p className="mt-2 text-sm text-gray-300">“{application.message}”</p>}</div><div className="flex gap-2"><button disabled={!student} onClick={() => student && navigate('/messages', { state: { recipientId: student._id } })} className="rounded-lg border border-primary-400/40 px-3 py-2 text-sm font-semibold text-primary-200 disabled:opacity-40">Message</button><select className="feed-input md:w-44" value={application.status} onChange={(event) => void updateApplication(application._id, event.target.value as ApplicationStatus)}>{applicationStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div></div></article>; })}</div>}</>}
    {tab === 'resources' && <>{loading ? <p className="text-gray-400">Loading requests…</p> : requests.length === 0 ? <div className="glass-card p-8 text-gray-400">No resource requests received.</div> : <div className="space-y-4">{requests.map((request) => { const student = typeof request.studentId === 'string' ? undefined : request.studentId; const resource = typeof request.resourceId === 'string' ? undefined : request.resourceId; return <article className="glass-card p-5" key={request._id}><div className="flex flex-col gap-5 md:flex-row md:justify-between"><div><div className="flex flex-wrap gap-2 items-center"><h2 className="font-bold text-white">{student?.fullName || 'Student applicant'}</h2><span className="tag">{resource?.itemName || 'Resource'}</span><Priority item={request} /></div><p className="mt-4 max-w-2xl text-sm text-gray-300"><span className="font-semibold text-gray-400">Need statement:</span> {request.justification}</p></div><div className="flex gap-2"><button disabled={!student} onClick={() => student && navigate('/messages', { state: { recipientId: student._id } })} className="rounded-lg border border-primary-400/40 px-3 py-2 text-sm font-semibold text-primary-200 disabled:opacity-40">Message</button><select className="feed-input md:w-44" value={request.status} onChange={(event) => void updateRequest(request._id, event.target.value as ResourceRequestStatus)}>{resourceStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div></div></article>; })}</div>}</>}
  </main>;
};

export default ProviderApplicationsPage;
