import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { updateCreatorProfile } from '../api/creatorApi';
import { useAuth } from '../hooks/useAuth';
import type { CreatorCompensationPreference, CreatorPlatform, CreatorProfile } from '../types';

type PlatformForm = { platform: CreatorPlatform; handle: string; profileUrl: string; followerCount: string };
const blankPlatform = (): PlatformForm => ({ platform: 'instagram', handle: '', profileUrl: '', followerCount: '' });
const splitList = (value: string) => value.split(/,|\n/).map((item) => item.trim()).filter(Boolean);
const labels: Record<CreatorCompensationPreference, string> = { paid: 'Paid', product_exchange: 'Product exchange', experience: 'Experience', affiliate: 'Affiliate' };

const CreatorProfilePage = () => {
  const { user, updateStoredUser } = useAuth();
  const saved = user?.studentProfile?.creatorProfile;
  const [discoverable, setDiscoverable] = useState(saved?.isDiscoverable ?? false);
  const [platformRows, setPlatformRows] = useState<PlatformForm[]>(() => saved?.platforms.map((platform) => ({ ...platform, followerCount: platform.followerCount?.toString() || '' })) || [blankPlatform()]);
  const [niches, setNiches] = useState(saved?.niches.join(', ') || '');
  const [contentTypes, setContentTypes] = useState(saved?.contentTypes.join(', ') || '');
  const [preferences, setPreferences] = useState<CreatorCompensationPreference[]>(saved?.compensationPreference || []);
  const [sampleWorkLinks, setSampleWorkLinks] = useState(saved?.sampleWorkLinks?.join('\n') || '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const updatePlatform = (index: number, field: keyof PlatformForm, value: string) => setPlatformRows((rows) => rows.map((row, rowIndex) => {
    if (rowIndex !== index) return row;
    if (field === 'platform') return { ...row, platform: value as CreatorPlatform };
    if (field === 'handle') return { ...row, handle: value };
    if (field === 'profileUrl') return { ...row, profileUrl: value };
    return { ...row, followerCount: value };
  }));
  const togglePreference = (preference: CreatorCompensationPreference) => setPreferences((items) => items.includes(preference) ? items.filter((item) => item !== preference) : [...items, preference]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const profile: CreatorProfile = {
        isDiscoverable: discoverable,
        platforms: platformRows.filter((row) => row.handle.trim() || row.profileUrl.trim()).map((row) => ({
          platform: row.platform, handle: row.handle.trim(), profileUrl: row.profileUrl.trim(),
          ...(row.followerCount.trim() ? { followerCount: Number(row.followerCount) } : {}),
        })),
        niches: splitList(niches),
        contentTypes: splitList(contentTypes),
        compensationPreference: preferences,
        sampleWorkLinks: splitList(sampleWorkLinks),
      };
      const updated = await updateCreatorProfile(profile);
      updateStoredUser(updated);
      setNotice(discoverable ? 'Your creator profile is now visible to verified businesses.' : 'Your creator profile is hidden from businesses.');
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to save creator profile.' : 'Unable to save creator profile.');
    } finally { setSaving(false); }
  };

  return <main className="min-h-screen max-w-4xl mx-auto px-4 sm:px-6 py-9"><Link to="/student-profile" className="text-sm font-semibold text-primary-600">← Student profile</Link><section className="mt-5 mb-7"><p className="text-sm font-semibold tracking-wider text-primary-600">STUDENT CREATOR MARKETPLACE</p><h1 className="mt-2 text-3xl font-bold text-surface-900">Your creator profile</h1><p className="mt-2 text-gray-600">Share only the public work details you choose. Follower counts are self-reported; TechBridge does not connect to or scrape social accounts.</p></section>{error && <Notice color="red" text={error} />}{notice && <Notice color="green" text={notice} />}<form onSubmit={submit} className="space-y-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7"><section className="rounded-xl border border-primary-100 bg-primary-50 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold text-primary-900">Discoverable creator profile</h2><p className="mt-1 text-sm text-primary-700">Only verified businesses can see your creator profile and send a campaign request.</p></div><button type="button" onClick={() => setDiscoverable((value) => !value)} aria-pressed={discoverable} className={`rounded-full px-4 py-2 text-sm font-bold ${discoverable ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'}`}>{discoverable ? 'Visible to verified businesses' : 'Hidden'}</button></div></section><section><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-surface-900">Platforms</h2><p className="text-sm text-gray-500">Use public profile links only.</p></div><button type="button" onClick={() => setPlatformRows((rows) => [...rows, blankPlatform()])} disabled={platformRows.length >= 6} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-primary-700 disabled:opacity-50">Add platform</button></div><div className="mt-4 space-y-3">{platformRows.map((row, index) => <div key={`${index}-${row.platform}`} className="grid gap-3 rounded-xl border border-gray-100 bg-surface-50 p-4 sm:grid-cols-[9rem_1fr_1.5fr_8rem_auto]"><select className="feed-input" value={row.platform} onChange={(event) => updatePlatform(index, 'platform', event.target.value)}>{(['instagram', 'tiktok', 'youtube', 'facebook', 'other'] as CreatorPlatform[]).map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select><input className="feed-input" value={row.handle} maxLength={100} onChange={(event) => updatePlatform(index, 'handle', event.target.value)} placeholder="@yourhandle" /><input className="feed-input" type="url" value={row.profileUrl} maxLength={500} onChange={(event) => updatePlatform(index, 'profileUrl', event.target.value)} placeholder="https://..." /><input className="feed-input" type="number" min="0" value={row.followerCount} onChange={(event) => updatePlatform(index, 'followerCount', event.target.value)} placeholder="Followers" />{platformRows.length > 1 && <button type="button" onClick={() => setPlatformRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="px-2 text-sm font-semibold text-red-600">Remove</button>}</div>)}</div></section><div className="grid gap-5 sm:grid-cols-2"><Field label="Niches"><input className="feed-input" value={niches} onChange={(event) => setNiches(event.target.value)} placeholder="Food, campus life, beauty" /><Help>Separate ideas with commas.</Help></Field><Field label="Content types"><input className="feed-input" value={contentTypes} onChange={(event) => setContentTypes(event.target.value)} placeholder="Reels, short video, reviews" /><Help>Separate ideas with commas.</Help></Field></div><section><h2 className="text-lg font-bold text-surface-900">Compensation preferences</h2><p className="mt-1 text-sm text-gray-500">Businesses will see the types of collaboration you are open to.</p><div className="mt-3 flex flex-wrap gap-2">{(Object.keys(labels) as CreatorCompensationPreference[]).map((preference) => <button type="button" key={preference} onClick={() => togglePreference(preference)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${preferences.includes(preference) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{labels[preference]}</button>)}</div></section><Field label="Sample-work links (optional)"><textarea className="feed-input min-h-24" value={sampleWorkLinks} onChange={(event) => setSampleWorkLinks(event.target.value)} placeholder={'One public URL per line\nhttps://...'} /><Help>Do not add private account credentials, payment, tax, or banking information.</Help></Field><button disabled={saving} className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save creator profile'}</button></form></main>;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-sm font-semibold text-gray-700">{label}<div className="mt-1.5">{children}</div></label>;
const Help = ({ children }: { children: React.ReactNode }) => <p className="mt-1 text-xs font-normal text-gray-500">{children}</p>;
const Notice = ({ color, text }: { color: 'red' | 'green'; text: string }) => <p className={`mb-5 rounded-xl border p-4 text-sm ${color === 'red' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{text}</p>;

export default CreatorProfilePage;
