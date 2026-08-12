import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { getProviderApplications, updateApplicationStatus } from '../api/applicationApi';
import type { ApplicationStatus, OpportunityApplication } from '../types';

const statuses: ApplicationStatus[] = ['submitted', 'reviewing', 'accepted', 'rejected'];
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const applicant = (item: OpportunityApplication) => typeof item.applicantId === 'string' ? undefined : item.applicantId;
const opportunity = (item: OpportunityApplication) => typeof item.opportunityId === 'string' ? undefined : item.opportunityId;

const ProviderApplicationsPage = () => {
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async (status?: ApplicationStatus) => { setLoading(true); try { setApplications(await getProviderApplications(status)); } catch { setError('Unable to load applications.'); } finally { setLoading(false); } };
  useEffect(() => { void load(filter || undefined); }, [filter]);
  const changeStatus = async (id: string, status: ApplicationStatus) => {
    try { const updated = await updateApplicationStatus(id, status); setApplications((items) => items.map((item) => item._id === id ? updated : item)); } catch { setError('Unable to update application status.'); }
  };
  return <div className="min-h-screen"><AppHeader /><main className="max-w-6xl mx-auto px-4 sm:px-6 py-9"><a href="/provider" className="text-sm text-primary-300 hover:text-white">← Provider dashboard</a><section className="mt-5 mb-7"><p className="text-accent-400 text-sm font-semibold mb-2">APPLICATION MANAGEMENT</p><h1 className="text-3xl font-bold text-white">Review student applications</h1><p className="text-gray-400 mt-2">Move applicants through submitted, reviewing, accepted or rejected stages.</p></section>{error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}<select className="feed-input max-w-xs mb-5" value={filter} onChange={(e) => setFilter(e.target.value as ApplicationStatus | '')}><option value="">All application statuses</option>{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>{loading ? <p className="text-gray-400">Loading applications...</p> : applications.length === 0 ? <div className="glass-card p-8 text-gray-400">No applications match this filter yet.</div> : <div className="space-y-4">{applications.map((application) => { const student = applicant(application); const listing = opportunity(application); return <article className="glass-card p-5" key={application._id}><div className="flex flex-col md:flex-row md:justify-between gap-5"><div><div className="flex gap-3 items-center flex-wrap"><h2 className="font-bold text-white">{student?.fullName || 'Student applicant'}</h2><span className="tag">{humanize(application.status)}</span></div><p className="text-sm text-primary-300 mt-1">Applied for: {listing?.title || 'Opportunity'}</p><p className="text-xs text-gray-500 mt-1">{student?.email} · {student?.studentProfile?.degree || 'Student'} · Year {student?.studentProfile?.studyYear || '—'}</p>{student?.studentProfile?.skills && <div className="flex flex-wrap gap-1.5 mt-3">{student.studentProfile.skills.map((skill) => <span key={skill} className="tag">{skill}</span>)}</div>}{application.message && <p className="text-sm text-gray-300 mt-4 max-w-2xl">“{application.message}”</p>}</div><div className="min-w-40"><label className="field-label">Decision</label><select className="feed-input" value={application.status} onChange={(e) => void changeStatus(application._id, e.target.value as ApplicationStatus)}>{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select><p className="text-xs text-gray-500 mt-2">Applied {new Date(application.createdAt).toLocaleDateString('en-LK')}</p></div></div></article>; })}</div>}</main></div>;
};

export default ProviderApplicationsPage;
