import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import AppHeader from '../components/AppHeader';
import { createOpportunity, deleteOpportunity, getMyOpportunities, updateOpportunity } from '../api/opportunityApi';
import { useAuth } from '../hooks/useAuth';
import type { CoverageType, Opportunity, OpportunityFormData, OpportunityStatus, OpportunityType, WorkMode } from '../types';

const opportunityTypes: Array<{ value: OpportunityType; label: string }> = [
  { value: 'job', label: 'Job' }, { value: 'internship', label: 'Internship' }, { value: 'course', label: 'Course' }, { value: 'freelance', label: 'Freelance project' }, { value: 'workshop', label: 'Workshop' }, { value: 'scholarship', label: 'Scholarship' },
];
const coverageTypes: Array<{ value: CoverageType; label: string }> = [
  { value: 'full', label: 'Full coverage' }, { value: 'partial', label: 'Partial coverage' }, { value: 'tuition_only', label: 'Tuition only' }, { value: 'equipment_only', label: 'Equipment only' }, { value: 'stipend', label: 'Stipend' },
];
const emptyForm = (): OpportunityFormData => ({ title: '', description: '', type: 'job', requiredSkills: [], location: '', workMode: 'remote', status: 'open', applicationDeadline: '', currency: 'LKR' });
const input = 'feed-input';
const toDateInput = (date: string) => date ? new Date(date).toISOString().slice(0, 10) : '';
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const ProviderPortalPage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState<OpportunityFormData>(emptyForm());
  const [skillEntry, setSkillEntry] = useState('');
  const [criteriaEntry, setCriteriaEntry] = useState('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canOfferScholarships = user?.providerProfile?.organizationType === 'scholarship_org' || user?.providerProfile?.organizationType === 'ngo';
  const isScholarship = form.type === 'scholarship';

  const load = async () => {
    setLoading(true);
    try { setOpportunities(await getMyOpportunities()); } catch { setError('Unable to load your listings.'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const change = <K extends keyof OpportunityFormData>(key: K, value: OpportunityFormData[K]) => { setForm(previous => ({ ...previous, [key]: value })); setError(''); setNotice(''); };
  const addTag = (kind: 'skill' | 'criteria') => {
    const entry = (kind === 'skill' ? skillEntry : criteriaEntry).trim();
    const field = kind === 'skill' ? 'requiredSkills' : 'eligibilityCriteria';
    if (!entry || form[field]?.includes(entry)) return;
    change(field, [...(form[field] || []), entry]);
    kind === 'skill' ? setSkillEntry('') : setCriteriaEntry('');
  };
  const removeTag = (kind: 'skill' | 'criteria', value: string) => {
    const field = kind === 'skill' ? 'requiredSkills' : 'eligibilityCriteria';
    change(field, (form[field] || []).filter(item => item !== value));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    if (isScholarship && !canOfferScholarships) { setError('Only scholarship organizations and NGOs can publish scholarships.'); return; }
    setSaving(true);
    try {
      const data: OpportunityFormData = isScholarship ? form : { ...form, amount: undefined, currency: undefined, coverageType: undefined, eligibilityCriteria: undefined, numberOfAwards: undefined, renewable: undefined };
      if (editingId) await updateOpportunity(editingId, data); else await createOpportunity(data);
      setNotice(editingId ? 'Opportunity updated.' : 'Opportunity published.');
      setForm(emptyForm()); setSkillEntry(''); setCriteriaEntry(''); setEditingId(null); await load();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to save opportunity.' : 'Unable to save opportunity.');
    } finally { setSaving(false); }
  };
  const edit = (opportunity: Opportunity) => {
    setEditingId(opportunity._id);
    setForm({ title: opportunity.title, description: opportunity.description, type: opportunity.type, requiredSkills: opportunity.requiredSkills, location: opportunity.location, workMode: opportunity.workMode, status: opportunity.status, applicationDeadline: toDateInput(opportunity.applicationDeadline), amount: opportunity.amount, currency: opportunity.currency || 'LKR', coverageType: opportunity.coverageType, eligibilityCriteria: opportunity.eligibilityCriteria || [], numberOfAwards: opportunity.numberOfAwards, renewable: opportunity.renewable });
    setError(''); setNotice('Editing the selected opportunity.'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const remove = async (id: string) => {
    if (!window.confirm('Remove this opportunity? This cannot be undone.')) return;
    try { await deleteOpportunity(id); setNotice('Opportunity removed.'); await load(); } catch { setError('Unable to remove opportunity.'); }
  };

  return <div className="min-h-screen"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9"><section className="mb-8"><p className="text-accent-400 font-semibold text-sm mb-2">PROVIDER PORTAL</p><div className="flex flex-col md:flex-row md:items-end justify-between gap-3"><div><h1 className="text-3xl font-bold text-white">Create an opportunity</h1><p className="text-gray-400 mt-2">Post opportunities for TechBridge students and manage your active listings.</p></div>{user?.providerProfile?.verified && <span className="self-start px-3 py-1.5 rounded-full border border-emerald-400/30 text-emerald-300 bg-emerald-500/10 text-sm">✓ Verified provider</span>}</div></section>
    {isScholarship && <div className="mb-5 rounded-xl border border-primary-500/30 bg-primary-500/10 p-4 text-sm text-primary-100">Scholarship posts must clearly state the award amount, coverage, eligibility criteria, number of awards and renewal terms.</div>}
    {!canOfferScholarships && <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">Your organization type can publish jobs, internships, courses, freelance projects and workshops. Scholarship posts are reserved for verified scholarship organizations and NGOs.</div>}
    {error && <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}{notice && <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm">{notice}</div>}
    <form onSubmit={submit} className="glass-card p-5 sm:p-7 space-y-5"><div className="grid md:grid-cols-2 gap-4"><div><label className="field-label">Opportunity type</label><select className={input} value={form.type} onChange={e => change('type', e.target.value as OpportunityType)}>{opportunityTypes.map(type => <option key={type.value} value={type.value} disabled={type.value === 'scholarship' && !canOfferScholarships}>{type.label}{type.value === 'scholarship' && !canOfferScholarships ? ' (not available)' : ''}</option>)}</select></div><div><label className="field-label">Application deadline</label><input required className={input} type="date" min={new Date().toISOString().slice(0, 10)} value={form.applicationDeadline} onChange={e => change('applicationDeadline', e.target.value)} /></div></div><div className="grid md:grid-cols-2 gap-4"><div><label className="field-label">Title</label><input required className={input} value={form.title} onChange={e => change('title', e.target.value)} placeholder="e.g. Frontend Developer Intern" /></div><div><label className="field-label">Location</label><input required className={input} value={form.location} onChange={e => change('location', e.target.value)} placeholder="Colombo or Sri Lanka" /></div></div><div><label className="field-label">Description</label><textarea required minLength={20} className={`${input} min-h-32 resize-y`} value={form.description} onChange={e => change('description', e.target.value)} placeholder="Explain the opportunity, expectations and what students will gain." /></div><div className="grid md:grid-cols-2 gap-4"><div><label className="field-label">Work mode</label><select className={input} value={form.workMode} onChange={e => change('workMode', e.target.value as WorkMode)}><option value="remote">Remote</option><option value="on-site">On-site</option><option value="hybrid">Hybrid</option></select></div><div><label className="field-label">Listing status</label><select className={input} value={form.status} onChange={e => change('status', e.target.value as OpportunityStatus)}><option value="open">Open</option><option value="closed">Closed</option></select></div></div><div><label className="field-label">Required skills</label><div className="tag-input"><div className="flex flex-wrap gap-2 mb-2">{form.requiredSkills.map(skill => <button type="button" onClick={() => removeTag('skill', skill)} key={skill} className="tag">{skill} ×</button>)}</div><div className="flex gap-2"><input className="bg-transparent flex-1 outline-none text-sm text-white min-w-30" value={skillEntry} onChange={e => setSkillEntry(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('skill'); } }} placeholder="Type a skill and press Enter" /><button type="button" onClick={() => addTag('skill')} className="text-primary-300 text-sm font-semibold">Add</button></div></div></div>
      {isScholarship && <section className="rounded-2xl border border-primary-500/25 bg-primary-500/[0.04] p-5 space-y-5"><h2 className="font-bold text-white">Scholarship details</h2><div className="grid md:grid-cols-3 gap-4"><div><label className="field-label">Amount</label><input required min="0" className={input} type="number" value={form.amount ?? ''} onChange={e => change('amount', Number(e.target.value))} /></div><div><label className="field-label">Currency</label><input required className={input} value={form.currency || 'LKR'} onChange={e => change('currency', e.target.value.toUpperCase())} /></div><div><label className="field-label">Coverage type</label><select required className={input} value={form.coverageType || ''} onChange={e => change('coverageType', e.target.value as CoverageType)}><option value="">Select coverage</option>{coverageTypes.map(coverage => <option key={coverage.value} value={coverage.value}>{coverage.label}</option>)}</select></div></div><div className="grid md:grid-cols-2 gap-4"><div><label className="field-label">Number of awards</label><input required min="1" className={input} type="number" value={form.numberOfAwards ?? ''} onChange={e => change('numberOfAwards', Number(e.target.value))} /></div><label className="flex gap-3 items-center mt-7 text-sm text-gray-200"><input type="checkbox" checked={form.renewable || false} onChange={e => change('renewable', e.target.checked)} />This scholarship is renewable</label></div><div><label className="field-label">Eligibility criteria</label><div className="tag-input"><div className="flex flex-wrap gap-2 mb-2">{(form.eligibilityCriteria || []).map(criteria => <button type="button" onClick={() => removeTag('criteria', criteria)} key={criteria} className="tag">{criteria} ×</button>)}</div><div className="flex gap-2"><input className="bg-transparent flex-1 outline-none text-sm text-white min-w-30" value={criteriaEntry} onChange={e => setCriteriaEntry(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('criteria'); } }} placeholder="e.g. GPA above 3.0" /><button type="button" onClick={() => addTag('criteria')} className="text-primary-300 text-sm font-semibold">Add</button></div></div></div></section>}
      <div className="flex flex-wrap gap-3"><button disabled={saving} className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update opportunity' : 'Publish opportunity'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm()); setNotice(''); }} className="px-5 py-3 rounded-xl bg-white/5 text-gray-300">Cancel edit</button>}</div>
    </form>
    <section className="mt-10"><h2 className="text-xl font-bold text-white mb-4">Your posted opportunities</h2>{loading ? <p className="text-gray-400">Loading listings...</p> : opportunities.length === 0 ? <div className="glass-card p-7 text-gray-400">You have not published any opportunities yet.</div> : <div className="grid gap-3">{opportunities.map(opportunity => <article key={opportunity._id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="flex gap-2 items-center"><h3 className="font-semibold text-white">{opportunity.title}</h3><span className={`text-xs px-2 py-1 rounded ${opportunity.status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-gray-400'}`}>{readable(opportunity.status)}</span></div><p className="text-sm text-gray-400 mt-1">{readable(opportunity.type)} · Deadline {new Date(opportunity.applicationDeadline).toLocaleDateString('en-LK')}</p></div><div className="flex gap-2"><button onClick={() => edit(opportunity)} className="px-3 py-2 text-sm rounded-lg bg-white/5 text-primary-200">Edit</button><button onClick={() => void remove(opportunity._id)} className="px-3 py-2 text-sm rounded-lg bg-red-500/10 text-red-200">Delete</button></div></article>)}</div>}</section>
  </main></div>;
};

export default ProviderPortalPage;
