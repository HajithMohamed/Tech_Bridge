import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getOpportunities, getScholarships } from '../api/opportunityApi';
import type { Opportunity, OpportunityType, WorkMode } from '../types';

const typeLabels: Record<OpportunityType, string> = {
  job: 'Job', internship: 'Internship', scholarship: 'Scholarship', course: 'Course', freelance: 'Freelance', workshop: 'Workshop',
};
const coverageLabels: Record<string, string> = {
  full: 'Full coverage', partial: 'Partial coverage', tuition_only: 'Tuition only', equipment_only: 'Equipment only', stipend: 'Stipend',
};
const providerName = (opportunity: Opportunity) => typeof opportunity.providerId === 'string'
  ? 'Verified provider'
  : opportunity.providerId.providerProfile?.organizationName || opportunity.providerId.fullName;
const formatAmount = (opportunity: Opportunity) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: opportunity.currency || 'LKR', maximumFractionDigits: 0 }).format(opportunity.amount || 0);
const date = (value: string) => new Date(value).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });

const OpportunityFeedPage = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'scholarships'>('all');
  const [type, setType] = useState<OpportunityType | ''>('');
  const [skill, setSkill] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const filters = { ...(activeTab === 'scholarships' ? { type: 'scholarship' as OpportunityType } : type ? { type } : {}), ...(skill.trim() ? { skill: skill.trim() } : {}), ...(workMode ? { workMode } : {}) };
        const results = activeTab === 'scholarships' && !skill.trim() && !workMode
          ? await getScholarships()
          : await getOpportunities(filters);
        setOpportunities(results);
      } catch {
        setError('We could not load opportunities right now. Please try again.');
      } finally { setLoading(false); }
    };
    void load();
  }, [activeTab, type, skill, workMode]);

  const switchTab = (tab: 'all' | 'scholarships') => {
    setActiveTab(tab);
    if (tab === 'scholarships') setType('');
  };

  return <div className="min-h-screen"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <section className="mb-8"><p className="text-primary-300 text-sm font-semibold mb-2">OPPORTUNITY HUB</p><h1 className="text-3xl font-bold text-white">Find your next practical pathway</h1><p className="text-gray-400 mt-2">Jobs, internships, learning and dedicated scholarship support in one place.</p></section>
    <div className="flex gap-2 border-b border-white/10 mb-6"><button onClick={() => switchTab('all')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'all' ? 'border-primary-400 text-primary-200' : 'border-transparent text-gray-400'}`}>All opportunities</button><button onClick={() => switchTab('scholarships')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'scholarships' ? 'border-primary-400 text-primary-200' : 'border-transparent text-gray-400'}`}>Scholarships</button></div>
    <section className="glass-card p-4 mb-7 grid grid-cols-1 sm:grid-cols-3 gap-3"><select value={activeTab === 'scholarships' ? 'scholarship' : type} disabled={activeTab === 'scholarships'} onChange={e => setType(e.target.value as OpportunityType | '')} className="feed-input disabled:opacity-60"><option value="">All types</option>{(Object.entries(typeLabels) as [OpportunityType, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={skill} onChange={e => setSkill(e.target.value)} className="feed-input" placeholder="Filter by skill, e.g. React" /><select value={workMode} onChange={e => setWorkMode(e.target.value as WorkMode | '')} className="feed-input"><option value="">All work modes</option><option value="remote">Remote</option><option value="on-site">On-site</option><option value="hybrid">Hybrid</option></select></section>
    {error && <div className="mb-5 rounded-xl p-4 text-red-200 bg-red-500/10 border border-red-500/25">{error}</div>}
    {loading ? <p className="text-gray-400 py-12 text-center">Loading opportunities...</p> : opportunities.length === 0 ? <div className="glass-card py-14 text-center"><p className="text-white font-semibold">No opportunities match these filters.</p><p className="text-gray-400 text-sm mt-2">Try removing a filter or check again soon.</p></div> : <div className="grid lg:grid-cols-2 gap-5">{opportunities.map(opportunity => <article key={opportunity._id} className={`glass-card p-6 flex flex-col ${opportunity.type === 'scholarship' ? 'border-primary-500/35 bg-primary-500/[0.06]' : ''}`}><div className="flex justify-between gap-4 mb-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${opportunity.type === 'scholarship' ? 'bg-primary-500/25 text-primary-200' : 'bg-white/10 text-gray-300'}`}>{typeLabels[opportunity.type]}</span><span className="text-xs text-gray-500">{opportunity.workMode.replace('-', ' ')}</span></div><h2 className="text-xl font-bold text-white">{opportunity.title}</h2><p className="text-sm text-primary-300 mt-1">{providerName(opportunity)}</p>{opportunity.type === 'scholarship' ? <div className="my-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-surface-950/40 p-3"><p className="text-xs text-gray-500">Award amount</p><p className="text-lg font-bold text-white">{formatAmount(opportunity)}</p></div><div className="rounded-xl bg-surface-950/40 p-3"><p className="text-xs text-gray-500">Coverage</p><p className="text-sm font-bold text-white mt-1">{coverageLabels[opportunity.coverageType || '']}</p></div><div className="col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">Deadline: <strong>{date(opportunity.applicationDeadline)}</strong></div></div> : <p className="text-sm text-gray-300 mt-4 line-clamp-3">{opportunity.description}</p>}<div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5">{opportunity.requiredSkills.slice(0, 4).map(skillName => <span key={skillName} className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-300">{skillName}</span>)}</div><Link to={`/opportunities/${opportunity._id}`} className="text-sm font-semibold text-primary-300 hover:text-white">View details →</Link></div></article>)}</div>}
  </main></div>;
};

export default OpportunityFeedPage;
