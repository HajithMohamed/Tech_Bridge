import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BriefcaseBusiness, FileText, Package, Users } from 'lucide-react';

import { getImpactStats } from '../api/dashboardApi';
import type { ImpactStats } from '../types';

const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const Distribution = ({ title, values, emptyText }: { title: string; values: Record<string, number>; emptyText: string }) => {
  const entries = useMemo(() => Object.entries(values).sort(([, first], [, second]) => second - first), [values]);
  const maximum = Math.max(...entries.map(([, count]) => count), 1);
  return <section className="glass-card p-6"><h2 className="text-lg font-bold text-surface-900">{title}</h2>{entries.length === 0 ? <p className="mt-5 text-sm text-gray-500">{emptyText}</p> : <div className="mt-5 space-y-4">{entries.map(([label, count]) => <div key={label}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="text-gray-600">{readable(label)}</span><span className="font-semibold text-surface-900">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${(count / maximum) * 100}%` }} /></div></div>)}</div>}</section>;
};

const ImpactDashboardPage = () => {
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => { void getImpactStats().then(setStats).catch(() => setError('Unable to load platform impact right now.')); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const cards = [
    { label: 'Students connected', value: stats?.totalStudents, description: 'Students registered on TechBridge', icon: Users, color: 'text-primary-500', background: 'bg-primary-500/15' },
    { label: 'Opportunities available', value: stats?.totalOpenOpportunities, description: 'Open opportunities accepting applications', icon: BriefcaseBusiness, color: 'text-primary-500', background: 'bg-emerald-500/15' },
    { label: 'Applications submitted', value: stats?.totalApplications, description: 'Students pursuing practical opportunities', icon: FileText, color: 'text-primary-500', background: 'bg-amber-500/15' },
    { label: 'Resources accessed', value: stats?.totalResourceListings, description: 'Technical resource access pathways listed', icon: Package, color: 'text-primary-500', background: 'bg-accent-500/15' },
  ];

  return <div className="min-h-screen bg-surface-50"><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9"><section className="mb-8"><div className="flex items-center gap-2 text-primary-600 text-sm font-semibold"><BarChart3 className="w-4 h-4" /> TECHBRIDGE IMPACT</div><h1 className="mt-2 text-3xl font-bold text-surface-900">Opportunity access at a glance</h1><p className="mt-2 max-w-2xl text-gray-600">A simple overview of the students, opportunities, applications, and technical resources connected through TechBridge.</p></section>{error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{cards.map((card) => { const Icon = card.icon; return <article key={card.label} className="glass-card p-5"><div className={`w-11 h-11 rounded-xl grid place-items-center ${card.background}`}><Icon className={`w-5 h-5 ${card.color}`} /></div><p className="mt-5 text-3xl font-bold text-surface-900">{stats ? card.value : '—'}</p><h2 className="mt-1 text-sm font-semibold text-primary-700">{card.label}</h2><p className="mt-1 text-xs leading-relaxed text-gray-500">{card.description}</p></article>; })}</div>{stats ? <div className="mt-8 grid lg:grid-cols-2 gap-5"><Distribution title="Applications by status" values={stats.applicationsByStatus} emptyText="Applications will appear here once students begin applying." /><Distribution title="Resource access pathways" values={stats.resourceListingsByAccessType} emptyText="Resource listings will appear here once providers add them." /></div> : !error && <p className="py-10 text-center text-gray-500">Loading impact statistics...</p>}<p className="mt-8 text-xs text-gray-500">Impact counts refresh from the current platform data. TechBridge connects students with opportunities and access—it does not provide loans or financing.</p></main></div>;
};

export default ImpactDashboardPage;

