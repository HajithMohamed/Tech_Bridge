import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
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
    ['Published opportunities', stats?.totalOpportunities ?? '—', 'Listings across your enabled services'],
    ['Applications received', stats?.applicationsReceived ?? '—', 'Student interest in your opportunities'],
    ...(resourceEnabled ? [['Technical resources', stats?.resourceCount ?? '—', 'Equipment access listings'], ['Pending resource requests', requestCount ?? '—', 'Students awaiting your response']] : []),
    ['Listing views', stats?.views ?? '—', 'Student views across opportunities'],
  ];
  return <div className="min-h-screen"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9"><section className="flex flex-col lg:flex-row justify-between gap-5 mb-8"><div><p className="text-accent-400 text-sm font-semibold mb-2">PROVIDER DASHBOARD</p><h1 className="text-3xl font-bold text-white">Welcome, {user?.providerProfile?.organizationName || user?.fullName}</h1><p className="text-gray-400 mt-2">Manage only the services your organization offers to TechBridge students.</p></div><div className={`self-start px-4 py-2 rounded-full text-sm border ${user?.providerProfile?.verified ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>{user?.providerProfile?.verified ? 'Verified provider' : 'Pending verification'}</div></section>{error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{cards.map(([label, value, description]) => <div className="glass-card p-5" key={label}><p className="text-2xl font-bold text-white">{value}</p><p className="text-sm font-semibold text-gray-200 mt-2">{label}</p><p className="text-xs text-gray-500 mt-1">{description}</p></div>)}</div><section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3 mb-4"><div><h2 className="text-xl font-bold text-white">Your enabled services</h2><p className="text-sm text-gray-400 mt-1">Your portal changes based on the offerings in your provider profile.</p></div><Link to="/provider/profile" className="text-sm text-primary-300 hover:text-white">Update services →</Link></div>{selectedServices.length === 0 ? <div className="glass-card p-5 text-gray-400">Choose the services your organization provides in your profile to activate the right tools.</div> : <><div className="flex flex-wrap gap-2 mb-4">{selectedServices.map((service) => <span key={service.id} className="tag">{service.label}</span>)}</div><div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{enabledTypes.length > 0 && <ServiceCard to="/provider/opportunities" title="Publish opportunity" description="Create a service-specific listing for students." />}{enabledTypes.length > 0 && <ServiceCard to="/provider/applications" title="Review applications" description="Move applicants through your selection process." />}{resourceEnabled && <ServiceCard to="/provider/resources" title="Manage resource access" description="List the approved pathways your organization offers." />}{resourceEnabled && <ServiceCard to="/provider/resource-requests" title="Review resource requests" description="Respond to students needing technical resources." />}</div></>}</section><section className="glass-card mt-8 p-6"><div className="flex justify-between gap-4 items-center"><h2 className="text-lg font-bold text-white">Recent opportunity activity</h2>{(stats?.expiringSoon ?? 0) > 0 && <span className="text-sm text-amber-200">{stats?.expiringSoon} listing(s) expire within 7 days</span>}</div>{!dashboard ? <p className="text-gray-400 mt-5">Loading recent activity…</p> : dashboard.recentOpportunities.length === 0 ? <p className="text-gray-400 mt-5">Publish a listing in one of your enabled services to start building impact.</p> : <div className="mt-4 divide-y divide-white/10">{dashboard.recentOpportunities.map((opportunity) => <div key={opportunity._id} className="py-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{opportunity.title}</p><p className="text-xs text-gray-500">{humanize(opportunity.type)} · {opportunity.views} views</p></div><span className="text-xs rounded-full bg-white/8 px-2 py-1 text-gray-300">{humanize(opportunity.status)}</span></div>)}</div>}</section></main></div>;
};

const ServiceCard = ({ to, title, description }: { to: string; title: string; description: string }) => <Link className="glass-card p-5 hover:border-primary-400/50" to={to}><h2 className="font-semibold text-white">{title}</h2><p className="text-sm text-gray-400 mt-2">{description}</p></Link>;

export default ProviderDashboardPage;
