import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AppHeader from '../components/AppHeader';
import { updateProviderProfile } from '../api/providerApi';
import { useAuth } from '../hooks/useAuth';

const services = [
  { value: 'jobs', label: 'Jobs / freelance projects' },
  { value: 'internships', label: 'Internships / hiring' },
  { value: 'scholarships', label: 'Scholarships / financial assistance' },
  { value: 'training', label: 'Training / workshops' },
  { value: 'mentorship', label: 'Mentorship / guidance' },
  { value: 'technical_resources', label: 'Technical resources' },
];

const ProviderProfilePage = () => {
  const { user, updateStoredUser } = useAuth();
  const profile = user?.providerProfile;
  const [form, setForm] = useState({
    organizationName: profile?.organizationName || '', contactPerson: profile?.contactPerson || '', contactEmail: profile?.contactEmail || '',
    phone: profile?.phone || '', location: profile?.location || '', website: profile?.website || '', logoUrl: profile?.logoUrl || '',
    description: profile?.description || '', opportunityCategories: profile?.opportunityCategories || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => { setForm((previous) => ({ ...previous, [key]: value })); setError(''); };
  const toggleService = (service: string) => update('opportunityCategories', form.opportunityCategories.includes(service) ? form.opportunityCategories.filter((item) => item !== service) : [...form.opportunityCategories, service]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.opportunityCategories.length) { setError('Select at least one service offering.'); return; }
    setSaving(true); setError('');
    try { const updated = await updateProviderProfile(form); updateStoredUser(updated); setNotice('Provider profile saved.'); }
    catch (requestError) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to update profile.' : 'Unable to update profile.'); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen"><AppHeader /><main className="max-w-3xl mx-auto px-4 sm:px-6 py-9">
    <Link to="/provider" className="text-sm text-primary-300 hover:text-white">← Provider dashboard</Link>
    <section className="mt-5 mb-7"><p className="text-accent-400 text-sm font-semibold mb-2">PROVIDER PROFILE</p><h1 className="text-3xl font-bold text-white">Organization details</h1><p className="text-gray-400 mt-2">Keep your public profile and services accurate for TechBridge students.</p></section>
    {error && <Message color="red" text={error} />}{notice && <Message color="green" text={notice} />}
    <form className="glass-card p-6 space-y-6" onSubmit={submit}>
      <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-xl overflow-hidden bg-primary-500/15 border border-white/10 grid place-items-center text-primary-200 font-bold">{form.logoUrl ? <img src={form.logoUrl} alt="Organization logo" className="w-full h-full object-cover" /> : form.organizationName.charAt(0).toUpperCase()}</div><div><p className="font-semibold text-white">{profile?.verified ? '✓ Verified provider' : 'Pending verification'}</p><p className="text-sm text-gray-400">Provider type: {profile?.organizationType?.replace('_', ' ')}</p></div></div>
      <Grid><Field label="Organization / professional name"><input required className="feed-input" value={form.organizationName} onChange={(event) => update('organizationName', event.target.value)} /></Field><Field label="Contact person"><input required className="feed-input" value={form.contactPerson} onChange={(event) => update('contactPerson', event.target.value)} /></Field><Field label="Contact email"><input required type="email" className="feed-input" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} /></Field><Field label="Phone"><input required className="feed-input" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></Field><Field label="Address / location"><input required className="feed-input" value={form.location} onChange={(event) => update('location', event.target.value)} /></Field><Field label="Website"><input type="url" className="feed-input" value={form.website} onChange={(event) => update('website', event.target.value)} placeholder="https://" /></Field></Grid>
      <Field label="Organization logo URL"><input type="url" className="feed-input" value={form.logoUrl} onChange={(event) => update('logoUrl', event.target.value)} placeholder="https://example.com/logo.png" /></Field>
      <Field label="About your organization"><textarea className="feed-input min-h-32" maxLength={1000} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe your organization, services and the support offered to students." /></Field>
      <fieldset><legend className="field-label">Services offered</legend><p className="mb-3 text-sm text-gray-400">Choose every pathway your organization can offer. Your dashboard adapts to these selections.</p><div className="grid sm:grid-cols-2 gap-3">{services.map((service) => <label key={service.value} className={`flex gap-3 items-center rounded-xl border p-3 cursor-pointer ${form.opportunityCategories.includes(service.value) ? 'border-primary-400/60 bg-primary-500/10 text-primary-100' : 'border-white/10 bg-white/5 text-gray-300'}`}><input type="checkbox" checked={form.opportunityCategories.includes(service.value)} onChange={() => toggleService(service.value)} />{service.label}</label>)}</div></fieldset>
      <button disabled={saving} className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save profile'}</button>
    </form>
  </main></div>;
};

const Grid = ({ children }: { children: ReactNode }) => <div className="grid md:grid-cols-2 gap-4">{children}</div>;
const Field = ({ label, children }: { label: string; children: ReactNode }) => <div><label className="field-label">{label}</label>{children}</div>;
const Message = ({ color, text }: { color: 'red' | 'green'; text: string }) => <div className={`mb-5 p-4 rounded-xl border text-sm ${color === 'red' ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}>{text}</div>;

export default ProviderProfilePage;
