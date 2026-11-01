import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyApplications } from '../api/applicationApi';
import type { ApplicationStatus, OpportunityApplication } from '../types';

const statusStyle: Record<ApplicationStatus, string> = {
  applied: 'bg-primary-50 text-primary-800',
  reviewed: 'bg-amber-50 text-amber-900',
  accepted: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
};
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const referenceId = (value: unknown): string | undefined => {
  const id = typeof value === 'string' ? value : value && typeof value === 'object' && '_id' in value ? value._id : undefined;
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) ? id : undefined;
};
const actionStyle = 'inline-flex items-center rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700';

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void getMyApplications()
      .then((items) => { if (!cancelled) setApplications(items); })
      .catch(() => { if (!cancelled) setError('Unable to load your applications.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return <div className="bg-surface-50"><main className="mx-auto max-w-5xl px-4 py-9 sm:px-6">
    <section className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-primary-700">Student workspace</p><h1 className="mt-2 text-2xl font-bold text-gray-900">My applications</h1><p className="mt-2 text-gray-600">Track your applications and follow up with opportunity providers.</p></div>
      <Link to="/opportunities" className={actionStyle}>Browse opportunities</Link>
    </section>
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p role="status" className="text-gray-600">Loading your applications...</p> : error ? null : applications.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-8"><p className="font-semibold text-gray-900">You have not applied to an opportunity yet.</p><p className="mt-2 text-sm text-gray-600">Find an opportunity that fits your goals to start tracking applications here.</p></div> : <div className="space-y-4">
      {applications.map((application) => {
        const opportunity = application.opportunityId && typeof application.opportunityId === 'object' ? application.opportunityId : undefined;
        const opportunityId = referenceId(application.opportunityId);
        const providerReference = opportunity?.providerId === undefined ? application.providerId : opportunity.providerId;
        const providerId = referenceId(providerReference);
        const provider = providerReference && typeof providerReference === 'object' ? providerReference : undefined;
        const isStudentOwner = provider && 'role' in provider && provider.role === 'student';
        const canMessage = providerId && !isStudentOwner && provider?.providerProfile?.verified !== false && ['applied', 'reviewed', 'accepted'].includes(application.status);
        return <article key={application._id} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold text-gray-900">{opportunity?.title || (application.opportunityId === null ? 'Opportunity no longer available' : 'Opportunity application')}</h2><p className="mt-1 text-sm text-gray-600">{opportunity?.type ? humanize(opportunity.type) : 'Opportunity'} · {opportunity?.location || 'Location not available'}</p><p className="mt-2 text-sm text-gray-600">Applied {new Date(application.appliedAt).toLocaleDateString('en-LK')}</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusStyle[application.status]}`}>{humanize(application.status)}</span></div>
          {(opportunityId || canMessage) && <div className="mt-4 flex flex-wrap gap-2">{opportunityId && <Link to={`/opportunities/${opportunityId}`} className={actionStyle}>View opportunity</Link>}{canMessage && <Link to="/messages" state={{ recipientId: providerId }} className={actionStyle}>Message provider</Link>}</div>}
        </article>;
      })}
    </div>}
  </main></div>;
}
