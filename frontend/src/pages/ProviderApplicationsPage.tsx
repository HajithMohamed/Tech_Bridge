import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getOpportunityApplicants, updateApplicationStatus } from '../api/applicationApi';
import { getMyOpportunities } from '../api/opportunityApi';
import type { ApplicationStatus, Opportunity, OpportunityApplication } from '../types';

const statuses: ApplicationStatus[] = ['applied', 'reviewed', 'accepted', 'rejected'];
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const studentOf = (application: OpportunityApplication) => typeof application.studentId === 'string' ? undefined : application.studentId;

const ProviderApplicationsPage = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getMyOpportunities()
        .then((items) => { setOpportunities(items); if (items[0]) setSelectedOpportunityId(items[0]._id); })
        .catch(() => setError('Unable to load your opportunities.'))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedOpportunityId) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getOpportunityApplicants(selectedOpportunityId)
        .then(setApplications)
        .catch(() => setError('Unable to load applicants for this opportunity.'))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedOpportunityId]);

  const changeStatus = async (id: string, status: ApplicationStatus) => {
    try {
      const updated = await updateApplicationStatus(id, status);
      setApplications((items) => items.map((item) => item._id === id ? updated : item));
    } catch {
      setError('Unable to update application status.');
    }
  };

  return <div className="min-h-screen"><AppHeader /><main className="max-w-6xl mx-auto px-4 sm:px-6 py-9">
    <Link to="/provider" className="text-sm text-primary-300 hover:text-white">← Provider dashboard</Link>
    <section className="mt-5 mb-7"><p className="text-accent-400 text-sm font-semibold mb-2">APPLICATION MANAGEMENT</p><h1 className="text-3xl font-bold text-white">Review applicants</h1><p className="text-gray-400 mt-2">Select one of your opportunities and update each student’s application status.</p></section>
    {error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}
    {opportunities.length > 0 && <div className="glass-card p-4 mb-6"><label className="field-label">Opportunity</label><select className="feed-input" value={selectedOpportunityId} onChange={(event) => setSelectedOpportunityId(event.target.value)}>{opportunities.map((opportunity) => <option key={opportunity._id} value={opportunity._id}>{opportunity.title} ({opportunity.applicationCount || 0} applicants)</option>)}</select></div>}
    {loading ? <p className="text-gray-400">Loading applicants...</p> : opportunities.length === 0 ? <div className="glass-card p-8 text-gray-400">Publish an opportunity before reviewing applications.</div> : applications.length === 0 ? <div className="glass-card p-8 text-gray-400">No applications have been submitted for this opportunity yet.</div> : <div className="space-y-4">{applications.map((application) => { const student = studentOf(application); return <article className="glass-card p-5" key={application._id}><div className="flex flex-col md:flex-row md:justify-between gap-5"><div><div className="flex gap-3 items-center flex-wrap"><h2 className="font-bold text-white">{student?.fullName || 'Student applicant'}</h2><span className="tag">{humanize(application.status)}</span></div><p className="text-xs text-gray-500 mt-2">{student?.email} · {student?.studentProfile?.degree || 'Student'} · Year {student?.studentProfile?.studyYear || '—'}</p>{student?.studentProfile?.skills && <div className="flex flex-wrap gap-1.5 mt-3">{student.studentProfile.skills.map((skill) => <span key={skill} className="tag">{skill}</span>)}</div>}{application.message && <p className="text-sm text-gray-300 mt-4 max-w-2xl">“{application.message}”</p>}</div><div className="min-w-40"><label className="field-label">Application status</label><select className="feed-input" value={application.status} onChange={(event) => void changeStatus(application._id, event.target.value as ApplicationStatus)}>{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select><p className="text-xs text-gray-500 mt-2">Applied {new Date(application.appliedAt).toLocaleDateString('en-LK')}</p></div></div></article>; })}</div>}
  </main></div>;
};

export default ProviderApplicationsPage;
