import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMyApplications } from '../api/applicationApi';
import type { ApplicationStatus, OpportunityApplication } from '../types';

const statusStyle: Record<ApplicationStatus, string> = {
  applied: 'bg-primary-500/15 text-primary-200',
  reviewed: 'bg-amber-500/15 text-amber-100',
  accepted: 'bg-emerald-500/15 text-emerald-200',
  rejected: 'bg-red-500/15 text-red-200',
};
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const opportunityOf = (application: OpportunityApplication) => typeof application.opportunityId === 'string' ? undefined : application.opportunityId;

const MyApplicationsPage = () => {
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getMyApplications().then(setApplications).catch(() => setError('Unable to load your applications.')).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <div className="min-h-screen"><main className="max-w-5xl mx-auto px-4 sm:px-6 py-9"><section className="mb-8"><p className="text-primary-300 text-sm font-semibold mb-2">STUDENT DASHBOARD</p><h1 className="text-3xl font-bold text-white">My applications</h1><p className="text-gray-400 mt-2">Track the status of every opportunity you applied to.</p></section>{error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}{loading ? <p className="text-gray-400">Loading your applications...</p> : applications.length === 0 ? <div className="glass-card p-10 text-center"><p className="font-semibold text-white">You have not applied to an opportunity yet.</p><Link to="/opportunities" className="inline-block mt-4 text-primary-300 font-semibold">Browse opportunities →</Link></div> : <div className="space-y-4">{applications.map((application) => { const opportunity = opportunityOf(application); return <article key={application._id} className="glass-card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="text-lg font-bold text-white">{opportunity?.title || 'Opportunity'}</p><p className="text-sm text-gray-400 mt-1">{opportunity?.type ? humanize(opportunity.type) : 'Opportunity'} · {opportunity?.location || 'Location not available'}</p><p className="text-xs text-gray-500 mt-2">Applied {new Date(application.appliedAt).toLocaleDateString('en-LK')}</p></div><span className={`self-start px-3 py-1.5 rounded-full text-sm font-semibold ${statusStyle[application.status]}`}>{humanize(application.status)}</span></article>; })}</div>}</main></div>;
};

export default MyApplicationsPage;

