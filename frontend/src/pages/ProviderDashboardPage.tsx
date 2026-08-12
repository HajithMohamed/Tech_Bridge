import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getProviderDashboard } from '../api/providerApi';
import { useAuth } from '../hooks/useAuth';
import type { ProviderDashboard } from '../types';

const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const ProviderDashboardPage = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { void getProviderDashboard().then(setDashboard).catch(() => setError('Unable to load dashboard data.')); }, []);
  const stats = dashboard?.stats;
  const cards = [
    ['Published opportunities', stats?.totalOpportunities ?? '—', 'Manage your listings'],
    ['Scholarships', stats?.scholarships ?? '—', 'Dedicated funding opportunities'],
    ['Applications received', stats?.applicationsReceived ?? '—', 'Student interest and submissions'],
    ['Active listings', stats?.activeListings ?? '—', 'Open to student applications'],
    ['Technical resources', stats?.resourceCount ?? '—', 'Equipment access pathways'],
    ['Listing views', stats?.views ?? '—', 'Student views across opportunities'],
  ];

  return <div className="min-h-screen"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <section className="flex flex-col lg:flex-row justify-between gap-5 mb-8"><div><p className="text-accent-400 text-sm font-semibold mb-2">PROVIDER DASHBOARD</p><h1 className="text-3xl font-bold text-white">Welcome, {user?.providerProfile?.organizationName || user?.fullName}</h1><p className="text-gray-400 mt-2">Turn opportunities and resources into practical access for TechBridge students.</p></div><div className={`self-start px-4 py-2 rounded-full text-sm border ${user?.providerProfile?.verified ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>{user?.providerProfile?.verified ? '✓ Verified provider' : 'Pending verification'}</div></section>
    {error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{cards.map(([label, value, description]) => <div className="glass-card p-5" key={label}><p className="text-2xl font-bold text-white">{value}</p><p className="text-sm font-semibold text-gray-200 mt-2">{label}</p><p className="text-xs text-gray-500 mt-1">{description}</p></div>)}</div>
    <section className="grid md:grid-cols-3 gap-4 mt-8"><Link className="glass-card p-5 hover:border-primary-400/50" to="/provider/opportunities"><p className="text-lg">＋</p><h2 className="font-semibold text-white mt-2">Post opportunity</h2><p className="text-sm text-gray-400 mt-1">Jobs, internships, workshops or scholarships.</p></Link><Link className="glass-card p-5 hover:border-primary-400/50" to="/provider/resources"><p className="text-lg">▣</p><h2 className="font-semibold text-white mt-2">Manage resources</h2><p className="text-sm text-gray-400 mt-1">Laptops, Arduino and affordable access options.</p></Link><Link className="glass-card p-5 hover:border-primary-400/50" to="/provider/applications"><p className="text-lg">✓</p><h2 className="font-semibold text-white mt-2">Review applications</h2><p className="text-sm text-gray-400 mt-1">Accept, reject or keep students under review.</p></Link></section>
    <section className="glass-card mt-8 p-6"><div className="flex justify-between gap-4 items-center"><h2 className="text-lg font-bold text-white">Recent activity</h2>{(stats?.expiringSoon ?? 0) > 0 && <span className="text-sm text-amber-200">{stats?.expiringSoon} listing(s) expire within 7 days</span>}</div>{!dashboard ? <p className="text-gray-400 mt-5">Loading your recent activity...</p> : dashboard.recentOpportunities.length === 0 ? <p className="text-gray-400 mt-5">Publish your first opportunity to start building impact.</p> : <div className="mt-4 divide-y divide-white/10">{dashboard.recentOpportunities.map((opportunity) => <div key={opportunity._id} className="py-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{opportunity.title}</p><p className="text-xs text-gray-500">{humanize(opportunity.type)} · {opportunity.views} views</p></div><span className="text-xs rounded-full bg-white/8 px-2 py-1 text-gray-300">{humanize(opportunity.status)}</span></div>)}</div>}</section>
  </main></div>;
};

export default ProviderDashboardPage;
