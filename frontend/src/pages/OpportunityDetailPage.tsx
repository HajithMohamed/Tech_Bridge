import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getOpportunity } from '../api/opportunityApi';
import type { Opportunity } from '../types';

const coverageLabels: Record<string, string> = { full: 'Full coverage', partial: 'Partial coverage', tuition_only: 'Tuition only', equipment_only: 'Equipment only', stipend: 'Stipend' };
const typeLabels: Record<string, string> = { job: 'Job', internship: 'Internship', scholarship: 'Scholarship', course: 'Course', freelance: 'Freelance project', workshop: 'Workshop' };
const providerName = (opportunity: Opportunity) => typeof opportunity.providerId === 'string' ? 'Verified provider' : opportunity.providerId.providerProfile?.organizationName || opportunity.providerId.fullName;
const deadlineCountdown = (deadline: string, currentTime = Date.now()) => {
  const milliseconds = new Date(deadline).getTime() - currentTime;
  if (milliseconds <= 0) return 'Deadline passed';
  const days = Math.floor(milliseconds / 86_400_000);
  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
  return days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : `${hours} hour${hours === 1 ? '' : 's'} left`;
};

const OpportunityDetailPage = () => {
  const { id } = useParams();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { if (id) void getOpportunity(id).then(setOpportunity).catch(() => setError('This opportunity is unavailable or has closed.')); }, [id]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (error) return <div className="min-h-screen"><AppHeader /><main className="max-w-3xl mx-auto px-4 py-12 text-center"><p className="text-red-200">{error}</p><Link className="inline-block mt-5 text-primary-300" to="/opportunities">Back to opportunities</Link></main></div>;
  if (!opportunity) return <div className="min-h-screen"><AppHeader /><p className="text-center text-gray-400 py-20">Loading opportunity...</p></div>;
  const isScholarship = opportunity.type === 'scholarship';
  const deadline = new Date(opportunity.applicationDeadline).toLocaleDateString('en-LK', { dateStyle: 'long' });
  const amount = new Intl.NumberFormat('en-LK', { style: 'currency', currency: opportunity.currency || 'LKR', maximumFractionDigits: 0 }).format(opportunity.amount || 0);

  return <div className="min-h-screen"><AppHeader /><main className="max-w-4xl mx-auto px-4 sm:px-6 py-9"><Link to="/opportunities" className="text-sm text-primary-300 hover:text-white">← Back to opportunities</Link><article className="glass-card p-6 sm:p-8 mt-5"><div className="flex flex-wrap justify-between gap-3"><span className={`text-sm px-3 py-1 rounded-full font-semibold ${isScholarship ? 'bg-primary-500/20 text-primary-200' : 'bg-white/10 text-gray-300'}`}>{typeLabels[opportunity.type]}</span><span className="text-sm text-gray-400">{opportunity.workMode.replace('-', ' ')} · {opportunity.location}</span></div><h1 className="text-3xl font-bold text-white mt-5">{opportunity.title}</h1><p className="text-primary-300 mt-2">Provided by {providerName(opportunity)}</p>{isScholarship ? <section className="mt-8 space-y-6"><div className="grid sm:grid-cols-3 gap-3"><div className="rounded-xl bg-primary-500/10 p-4"><p className="text-xs text-gray-400">Award amount</p><p className="font-bold text-white text-lg mt-1">{amount}</p></div><div className="rounded-xl bg-primary-500/10 p-4"><p className="text-xs text-gray-400">Coverage</p><p className="font-bold text-white mt-1">{coverageLabels[opportunity.coverageType || '']}</p></div><div className="rounded-xl bg-primary-500/10 p-4"><p className="text-xs text-gray-400">Awards available</p><p className="font-bold text-white text-lg mt-1">{opportunity.numberOfAwards}</p></div></div><div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4"><p className="font-semibold text-amber-100">Application deadline: {deadline}</p><p className="text-amber-200/80 text-sm mt-1">{deadlineCountdown(opportunity.applicationDeadline, now)} · {opportunity.renewable ? 'Renewable award' : 'One-time award'}</p></div><div><h2 className="text-lg font-bold text-white">Eligibility checklist</h2><ul className="mt-3 space-y-3">{opportunity.eligibilityCriteria?.map(criteria => <li key={criteria} className="flex items-start gap-3 text-gray-200"><span className="shrink-0 w-5 h-5 rounded-full border border-primary-400 text-primary-300 text-xs grid place-items-center">✓</span>{criteria}</li>)}</ul></div><div><h2 className="text-lg font-bold text-white">About this scholarship</h2><p className="text-gray-300 leading-7 mt-2 whitespace-pre-wrap">{opportunity.description}</p></div></section> : <section className="mt-7"><h2 className="text-lg font-bold text-white">About this opportunity</h2><p className="text-gray-300 leading-7 mt-2 whitespace-pre-wrap">{opportunity.description}</p><div className="mt-6"><h3 className="text-sm font-semibold text-gray-300 mb-2">Required skills</h3><div className="flex flex-wrap gap-2">{opportunity.requiredSkills.map(skill => <span key={skill} className="tag">{skill}</span>)}</div></div><p className="text-sm text-gray-400 mt-7">Application deadline: {deadline}</p></section>}<button onClick={() => setApplying(true)} className="mt-8 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-500">Apply / express interest</button>{applying && <p className="mt-3 text-sm text-primary-200">Application submission will be available in Phase 5. Your interest action is ready to connect here.</p>}</article></main></div>;
};

export default OpportunityDetailPage;
