import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getProviderDashboard } from '../api/providerApi';
import { getProviderResourceRequests } from '../api/resourceRequestApi';
import { useAuth } from '../hooks/useAuth';
import type { ProviderDashboard } from '../types';
import { canManageResources, enabledOpportunityTypes, providerOfferings } from '../utils/providerCapabilities';

const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const ProviderDashboardPage = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(null);
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const enabledTypes = enabledOpportunityTypes(user?.providerProfile);
  const resourceEnabled = canManageResources(user?.providerProfile);
  const selectedServices = useMemo(() => providerOfferings.filter((offering) => user?.providerProfile?.opportunityCategories?.includes(offering.id)), [user?.providerProfile?.opportunityCategories]);

  useEffect(() => {
    void getProviderDashboard().then(setDashboard).catch(() => setError('Unable to load dashboard data.'));
    if (resourceEnabled) void getProviderResourceRequests().then((items) => setRequestCount(items.filter((item) => item.status === 'pending').length)).catch(() => undefined);
  }, [resourceEnabled]);

  const stats = dashboard?.stats;
  const cards = [
    ['Active listings', stats?.activeListings ?? '—', 'Open opportunities and resources'],
    ['Applications', stats?.applicationsReceived ?? '—', 'Opportunity applications'],
    ['Resource requests', stats?.resourceRequestsReceived ?? '—', 'Requests for technical access'],
    ['Pending requests', stats?.pendingRequests ?? '—', 'Awaiting your response'],
    ['Accepted access', stats?.acceptedRequests ?? '—', 'Students connected to resources'],
    ['Technical resources', stats?.resourceCount ?? '—', 'Equipment access pathways'],
  ];

  const categories = user?.providerProfile?.opportunityCategories || [];
  const offersJobs = categories.includes('jobs');
  const offersInternships = categories.includes('internships');
  const offersScholarships = categories.includes('scholarships');
  const offersTraining = categories.includes('training');
  const offersMentorship = categories.includes('mentorship');
  const offersResources = categories.includes('technical_resources');

  return <div className="min-h-screen"><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <section className="flex flex-col lg:flex-row justify-between gap-5 mb-8"><div><p className="text-blue-600 text-sm font-semibold mb-2">PROVIDER DASHBOARD</p><h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.providerProfile?.organizationName || user?.fullName}</h1><p className="text-gray-600 mt-2">Turn opportunities and resources into practical access for TechBridge students.</p></div><div className={`self-start px-4 py-2 rounded-full text-sm border ${user?.providerProfile?.verified ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{user?.providerProfile?.verified ? '✓ Verified provider' : 'Pending verification'}</div></section>
    {user?.providerVerificationStatus !== 'verified' && <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-800">Verification pending</h2><p className="mt-1 text-sm text-amber-700">Your provider account is currently under review by TechBridge administrators. You can build your profile and draft opportunities, but they won't be visible to students until verified.</p></div>}
    {error && <div className="mb-5 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{cards.map(([label, value, description]) => <div className="border border-gray-200 bg-white p-5 rounded-2xl" key={label as string}><p className="text-2xl font-bold text-gray-900">{value as React.ReactNode}</p><p className="text-sm font-semibold text-gray-600 mt-2">{label as React.ReactNode}</p><p className="text-xs text-gray-500 mt-1">{description as React.ReactNode}</p></div>)}</div>
    <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      {offersJobs && <ModuleCard to="/provider/opportunities" icon="💼" title="Jobs / Freelance" description="Post roles and projects." />}
      {offersInternships && <ModuleCard to="/provider/opportunities" icon="🎓" title="Internships" description="Hire student interns." />}
      {offersTraining && <ModuleCard to="/provider/opportunities" icon="🏫" title="Training / Workshops" description="Publish courses and workshops." />}
      {offersMentorship && <ModuleCard to="/provider/opportunities" icon="💡" title="Mentorship" description="Offer professional guidance." />}
      {offersScholarships && <ModuleCard to="/provider/opportunities" icon="💰" title="Scholarships" description="Publish financial aid." />}
      {offersResources && <ModuleCard to="/provider/resources" icon="▣" title="Manage resources" description="List laptops, Arduino and access options." tone="emerald" />}
      {offersResources && <ModuleCard to="/provider/applications" icon="↳" title="Resource requests" description="Accept or reject access requests." tone="emerald" />}
      <ModuleCard to="/provider/applications" icon="✓" title="Review applications" description="Update student application status." tone="amber" />
    </section>
    <section className="glass-card mt-8 p-6"><div className="flex justify-between gap-4 items-center"><h2 className="text-lg font-bold text-surface-900">Recent activity</h2>{(stats?.expiringSoon ?? 0) > 0 && <span className="text-sm text-amber-700">{stats?.expiringSoon} listing(s) expire within 7 days</span>}</div>{!dashboard ? <p className="text-gray-500 mt-5">Loading your recent activity...</p> : dashboard.recentActivity.length === 0 ? <p className="text-gray-500 mt-5">Publish your first opportunity or resource to start building impact.</p> : <div className="mt-4 divide-y divide-gray-100">{dashboard.recentActivity.map((activity) => <div key={`${activity.kind}-${activity.id}`} className="py-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-surface-900">{activity.title}</p><p className="text-xs text-gray-500">{activity.detail} · {new Date(activity.occurredAt).toLocaleDateString('en-LK')}</p></div><span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-600">{humanize(activity.status)}</span></div>)}</div>}</section>
  </main></div>;
};

const ModuleCard = ({ to, icon, title, description, tone = 'primary' }: { to: string; icon: string; title: string; description: string; tone?: 'primary' | 'emerald' | 'amber' }) => <Link className={`glass-card p-5 hover:border-${tone}-200`} to={to}><p className={`text-lg text-${tone}-600`}>{icon}</p><h2 className="font-semibold text-surface-900 mt-2">{title}</h2><p className="text-sm text-gray-600 mt-1">{description}</p></Link>;

export default ProviderDashboardPage;

