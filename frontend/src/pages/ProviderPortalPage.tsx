import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const asDateInput = (value: string) => value ? new Date(value).toISOString().slice(0, 10) : '';

const ProviderPortalPage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState<OpportunityFormData>(emptyForm());
  const [skillEntry, setSkillEntry] = useState('');
  const [criteriaEntry, setCriteriaEntry] = useState('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canOfferScholarships = user?.providerProfile?.organizationType === 'scholarship_org' || user?.providerProfile?.organizationType === 'ngo';
  const isScholarship = form.type === 'scholarship';
  const filtered = useMemo(() => opportunities.filter((opportunity) => `${opportunity.title} ${opportunity.type}`.toLowerCase().includes(search.toLowerCase())), [opportunities, search]);

  const load = async () => {
    setLoading(true);
    try { setOpportunities(await getMyOpportunities()); } catch { setError('Unable to load your opportunities.'); } finally { setLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const change = <K extends keyof OpportunityFormData>(key: K, value: OpportunityFormData[K]) => { setForm((previous) => ({ ...previous, [key]: value })); setError(''); };
  const addTag = (kind: 'skill' | 'criteria') => {
    const entry = (kind === 'skill' ? skillEntry : criteriaEntry).trim();
    const field = kind === 'skill' ? 'requiredSkills' : 'eligibilityCriteria';
    if (!entry || form[field]?.includes(entry)) return;
    change(field, [...(form[field] || []), entry]);
    if (kind === 'skill') setSkillEntry('');
    else setCriteriaEntry('');
  };
  const removeTag = (kind: 'skill' | 'criteria', value: string) => {
    const field = kind === 'skill' ? 'requiredSkills' : 'eligibilityCriteria';
    change(field, (form[field] || []).filter((item) => item !== value));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    if (isScholarship && !canOfferScholarships) { setError('Only scholarship organizations and NGOs can publish scholarships.'); return; }
    if (form.status === 'expired') { setError('Expired is set automatically once a deadline has passed.'); return; }
    setSaving(true);
    try {
      const data: OpportunityFormData = isScholarship ? form : { ...form, amount: undefined, currency: undefined, coverageType: undefined, eligibilityCriteria: undefined, numberOfAwards: undefined, renewable: undefined };
      if (editingId) await updateOpportunity(editingId, data); else await createOpportunity(data);
      setNotice(editingId ? 'Opportunity updated.' : form.status === 'draft' ? 'Draft saved.' : 'Opportunity published.');
      setForm(emptyForm()); setSkillEntry(''); setCriteriaEntry(''); setEditingId(null); await load();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to save opportunity.' : 'Unable to save opportunity.');
    } finally { setSaving(false); }
  };
  const edit = (opportunity: Opportunity) => {
    setEditingId(opportunity._id);
    setForm({ title: opportunity.title, description: opportunity.description, type: opportunity.type, requiredSkills: opportunity.requiredSkills, location: opportunity.location, workMode: opportunity.workMode, status: opportunity.status, applicationDeadline: asDateInput(opportunity.applicationDeadline), amount: opportunity.amount, currency: opportunity.currency || 'LKR', coverageType: opportunity.coverageType, eligibilityCriteria: opportunity.eligibilityCriteria || [], numberOfAwards: opportunity.numberOfAwards, renewable: opportunity.renewable });
    setSkillEntry(''); setCriteriaEntry(''); setError(''); setNotice('Editing selected opportunity.'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const remove = async (id: string) => {
    if (!window.confirm('Remove this opportunity? This cannot be undone.')) return;
    try { await deleteOpportunity(id); setNotice('Opportunity removed.'); await load(); } catch { setError('Unable to remove opportunity.'); }
  };

  return <div className="min-h-screen"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <Link to="/provider" className="text-sm text-primary-300 hover:text-white">← Provider dashboard</Link>
    <section className="my-5"><p className="text-accent-400 font-semibold text-sm mb-2">OPPORTUNITY MANAGEMENT</p><div className="flex flex-col md:flex-row md:items-end justify-between gap-3"><div><h1 className="text-3xl font-bold text-white">Create an opportunity</h1><p className="text-gray-400 mt-2">Post jobs, internships, scholarships, workshops or projects for TechBridge students.</p></div><span className={`self-start px-3 py-1.5 rounded-full border text-sm ${user?.providerProfile?.verified ? 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10' : 'border-amber-400/30 text-amber-200 bg-amber-500/10'}`}>{user?.providerProfile?.verified ? '✓ Verified provider' : 'Pending verification'}</span></div></section>
    {isScholarship && <Message color="primary" text="Scholarship listings require award amount, coverage, eligibility criteria, awards available and renewal terms." />}
    {!canOfferScholarships && <Message color="amber" text="Scholarships are reserved for verified scholarship organizations and NGOs. You can still publish other opportunity types." />}
    {error && <Message color="red" text={error} />}{notice && <Message color="green" text={notice} />}
    <form onSubmit={submit} className="glass-card p-5 sm:p-7 space-y-5">
      <div className="grid md:grid-cols-2 gap-4"><Field label="Opportunity type"><select className="feed-input" value={form.type} onChange={(event) => change('type', event.target.value as OpportunityType)}>{opportunityTypes.map((type) => <option key={type.value} value={type.value} disabled={type.value === 'scholarship' && !canOfferScholarships}>{type.label}{type.value === 'scholarship' && !canOfferScholarships ? ' (not available)' : ''}</option>)}</select></Field><Field label="Application deadline"><input required className="feed-input" type="date" min={new Date().toISOString().slice(0, 10)} value={form.applicationDeadline} onChange={(event) => change('applicationDeadline', event.target.value)} /></Field></div>
      <div className="grid md:grid-cols-2 gap-4"><Field label="Title"><input required className="feed-input" value={form.title} onChange={(event) => change('title', event.target.value)} placeholder="e.g. Frontend Developer Intern" /></Field><Field label="Location"><input required className="feed-input" value={form.location} onChange={(event) => change('location', event.target.value)} placeholder="Colombo or Sri Lanka" /></Field></div>
      <Field label="Description"><textarea required minLength={20} className="feed-input min-h-32" value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="Explain expectations and student benefits." /></Field>
      <div className="grid md:grid-cols-2 gap-4"><Field label="Work mode"><select className="feed-input" value={form.workMode} onChange={(event) => change('workMode', event.target.value as WorkMode)}><option value="remote">Remote</option><option value="on-site">On-site</option><option value="hybrid">Hybrid</option></select></Field><Field label="Listing status"><select className="feed-input" value={form.status} onChange={(event) => change('status', event.target.value as OpportunityStatus)}><option value="draft">Draft</option><option value="open">Open</option><option value="closed">Closed</option>{editingId && form.status === 'expired' && <option value="expired">Expired (automatic)</option>}</select></Field></div>
      <TagEditor label="Required skills" tags={form.requiredSkills} entry={skillEntry} setEntry={setSkillEntry} add={() => addTag('skill')} remove={(tag) => removeTag('skill', tag)} placeholder="Type a skill and press Enter" />
      {isScholarship && <section className="rounded-2xl border border-primary-500/25 bg-primary-500/[0.04] p-5 space-y-5"><h2 className="font-bold text-white">Scholarship details</h2><div className="grid md:grid-cols-3 gap-4"><Field label="Amount"><input required min="0" type="number" className="feed-input" value={form.amount ?? ''} onChange={(event) => change('amount', Number(event.target.value))} /></Field><Field label="Currency"><input required className="feed-input" value={form.currency || 'LKR'} onChange={(event) => change('currency', event.target.value.toUpperCase())} /></Field><Field label="Coverage type"><select required className="feed-input" value={form.coverageType || ''} onChange={(event) => change('coverageType', event.target.value as CoverageType)}><option value="">Select coverage</option>{coverageTypes.map((coverage) => <option key={coverage.value} value={coverage.value}>{coverage.label}</option>)}</select></Field></div><div className="grid md:grid-cols-2 gap-4"><Field label="Number of awards"><input required min="1" type="number" className="feed-input" value={form.numberOfAwards ?? ''} onChange={(event) => change('numberOfAwards', Number(event.target.value))} /></Field><label className="flex gap-3 items-center mt-7 text-sm text-gray-200"><input type="checkbox" checked={form.renewable || false} onChange={(event) => change('renewable', event.target.checked)} />This scholarship is renewable</label></div><TagEditor label="Eligibility criteria" tags={form.eligibilityCriteria || []} entry={criteriaEntry} setEntry={setCriteriaEntry} add={() => addTag('criteria')} remove={(tag) => removeTag('criteria', tag)} placeholder="e.g. GPA above 3.0" /></section>}
      <div className="flex gap-3"><button disabled={saving} className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update opportunity' : form.status === 'draft' ? 'Save draft' : 'Publish opportunity'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm()); setNotice(''); }} className="px-5 py-3 rounded-xl bg-white/5 text-gray-200">Cancel edit</button>}</div>
    </form>
    <section className="mt-10"><div className="flex flex-col sm:flex-row justify-between gap-3 mb-4"><h2 className="text-xl font-bold text-white">Your opportunities</h2><input className="feed-input sm:w-72" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your opportunities" /></div>{loading ? <p className="text-gray-400">Loading listings...</p> : filtered.length === 0 ? <div className="glass-card p-7 text-gray-400">No opportunities found.</div> : <div className="grid gap-3">{filtered.map((opportunity) => <article key={opportunity._id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="flex gap-2 items-center flex-wrap"><h3 className="font-semibold text-white">{opportunity.title}</h3><Status status={opportunity.status} /></div><p className="text-sm text-gray-400 mt-1">{readable(opportunity.type)} · {opportunity.applicationCount || 0} applications · {opportunity.views || 0} views · Deadline {new Date(opportunity.applicationDeadline).toLocaleDateString('en-LK')}</p></div><div className="flex gap-2"><button onClick={() => edit(opportunity)} className="px-3 py-2 text-sm rounded-lg bg-white/5 text-primary-200">Edit</button><button onClick={() => void remove(opportunity._id)} className="px-3 py-2 text-sm rounded-lg bg-red-500/10 text-red-200">Delete</button></div></article>)}</div>}</section>
  </main></div>;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div><label className="field-label">{label}</label>{children}</div>;
const TagEditor = ({ label, tags, entry, setEntry, add, remove, placeholder }: { label: string; tags: string[]; entry: string; setEntry: (value: string) => void; add: () => void; remove: (tag: string) => void; placeholder: string }) => <div><label className="field-label">{label}</label><div className="tag-input"><div className="flex flex-wrap gap-2 mb-2">{tags.map((tag) => <button type="button" onClick={() => remove(tag)} key={tag} className="tag">{tag} ×</button>)}</div><div className="flex gap-2"><input className="bg-transparent flex-1 outline-none text-sm text-white min-w-30" value={entry} onChange={(event) => setEntry(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder={placeholder} /><button type="button" onClick={add} className="text-primary-300 text-sm font-semibold">Add</button></div></div></div>;
const Status = ({ status }: { status: OpportunityStatus }) => <span className={`text-xs px-2 py-1 rounded ${status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : status === 'draft' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-gray-400'}`}>{readable(status)}</span>;
const Message = ({ color, text }: { color: 'red' | 'green' | 'amber' | 'primary'; text: string }) => <div className={`mb-5 rounded-xl border p-4 text-sm ${color === 'red' ? 'border-red-500/30 bg-red-500/10 text-red-200' : color === 'green' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : color === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-primary-500/30 bg-primary-500/10 text-primary-100'}`}>{text}</div>;

export default ProviderPortalPage;
