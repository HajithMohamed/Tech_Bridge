import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { createResource, deleteResource, getMyResources, updateResourceStatus } from '../api/resourceApi';
import { useAuth } from '../hooks/useAuth';
import type { ResourceAccessDetails, ResourceAccessType, ResourceCategory, ResourceCondition, ResourceListing, ResourceListingFormData } from '../types';

const categories: Array<{ value: ResourceCategory; label: string }> = [
  { value: 'laptop', label: 'Laptop' }, { value: 'arduino', label: 'Arduino' }, { value: 'raspberry_pi', label: 'Raspberry Pi' },
  { value: 'sensor', label: 'Sensor' }, { value: 'electronic_component', label: 'Electronic component' }, { value: 'dev_board', label: 'Development board' }, { value: 'other', label: 'Other' },
];
const basicTypes: Array<{ value: ResourceAccessType; label: string }> = [{ value: 'borrow', label: 'Borrow' }, { value: 'share', label: 'Share' }, { value: 'donation', label: 'Donation' }];
const providerTypes: Array<{ value: ResourceAccessType; label: string }> = [{ value: 'rent', label: 'Rent' }, { value: 'installment', label: 'Installment' }, { value: 'interest_free', label: 'Interest-Free' }, { value: 'sponsorship', label: 'Sponsorship' }];
const financialTypes: ResourceAccessType[] = ['rent', 'installment', 'interest_free', 'sponsorship'];
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateForInput = (daysFromNow: number) => { const date = new Date(); date.setDate(date.getDate() + daysFromNow); return date.toISOString().slice(0, 10); };

const detailsFor = (accessType: ResourceAccessType): ResourceAccessDetails => {
  switch (accessType) {
    case 'borrow': case 'share': return { borrowShare: { borrowDurationDays: 7, pickupLocation: '', returnCondition: '' } };
    case 'rent': return { rent: { pricePerMonth: 0, currency: 'LKR', minRentalMonths: 1 } };
    case 'installment': return { installment: { totalPrice: 0, downPayment: 0, monthlyInstallmentAmount: 0, numberOfMonths: 1, lateFeePolicy: '' } };
    case 'interest_free': return { interestFree: { totalPrice: 0, monthlyInstallmentAmount: 0, numberOfMonths: 1, eligibilityCriteria: [], repaymentStartDate: dateForInput(30), interestRate: 0 } };
    case 'sponsorship': return { sponsorship: { eligibilityCriteria: [], applicationDeadline: dateForInput(30), numberOfUnitsAvailable: 1, sponsorOrganization: '' } };
    case 'donation': return { donation: { itemAgeYears: 1, conditionNotes: '', pickupOrDeliveryMethod: '', claimDeadline: dateForInput(30) } };
  }
};

const emptyForm = (accessType: ResourceAccessType): ResourceListingFormData => ({
  itemName: '', category: 'laptop', condition: 'used_good', accessType, quantityAvailable: 1, accessDetails: detailsFor(accessType),
});

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block"><span className="field-label">{label}</span>{children}</label>;
const TextInput = ({ value, onChange, type = 'text', required = true, min, placeholder }: { value: string | number; onChange: (value: string) => void; type?: string; required?: boolean; min?: number; placeholder?: string }) => <input required={required} min={min} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="feed-input" placeholder={placeholder} />;

const ResourceListingPage = () => {
  const { user } = useAuth();
  const providerIsEligible = user?.role === 'provider' && (user.providerProfile?.verified === true || ['company', 'ngo', 'training_org'].includes(user.providerProfile?.organizationType || ''));
  const allowedTypes = useMemo(() => user?.role === 'admin' || providerIsEligible ? [...basicTypes, ...providerTypes] : basicTypes, [providerIsEligible, user?.role]);
  const [form, setForm] = useState<ResourceListingFormData>(() => emptyForm(allowedTypes[0].value));
  const [listings, setListings] = useState<ResourceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => { setLoading(true); try { setListings(await getMyResources()); } catch { setError('Unable to load your resource listings.'); } finally { setLoading(false); } };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectType = (accessType: ResourceAccessType) => setForm((previous) => ({ ...emptyForm(accessType), itemName: previous.itemName, category: previous.category, quantityAvailable: previous.quantityAvailable }));
  const patchDetails = (section: keyof ResourceAccessDetails, fields: Record<string, unknown>) => setForm((previous) => ({ ...previous, accessDetails: { [section]: { ...(previous.accessDetails[section] || {}), ...fields } } as ResourceAccessDetails }));
  const criteriaValue = (section: 'interestFree' | 'sponsorship') => form.accessDetails[section]?.eligibilityCriteria.join('\n') || '';
  const setCriteria = (section: 'interestFree' | 'sponsorship', raw: string) => patchDetails(section, { eligibilityCriteria: raw.split('\n').map((line) => line.trim()).filter(Boolean) });
  const isServiceStock = financialTypes.includes(form.accessType);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      await createResource({ ...form, ...(isServiceStock ? { condition: undefined } : {}) });
      setNotice('Resource listing published.');
      setForm(emptyForm(allowedTypes[0].value));
      await load();
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to publish listing.' : 'Unable to publish listing.');
    } finally { setSaving(false); }
  };

  const setStatus = async (listing: ResourceListing, status: 'available' | 'claimed') => {
    try { await updateResourceStatus(listing._id, status); setListings((current) => current.map((item) => item._id === listing._id ? { ...item, status } : item)); setNotice(`Listing marked ${status}.`); }
    catch { setError('Unable to update this listing status.'); }
  };
  const remove = async (id: string) => { if (!window.confirm('Delete this resource listing?')) return; try { await deleteResource(id); setListings((current) => current.filter((listing) => listing._id !== id)); setNotice('Resource listing deleted.'); } catch { setError('Unable to delete this listing.'); } };

  const borrowShare = form.accessDetails.borrowShare;
  const rent = form.accessDetails.rent;
  const installment = form.accessDetails.installment;
  const interestFree = form.accessDetails.interestFree;
  const sponsorship = form.accessDetails.sponsorship;
  const donation = form.accessDetails.donation;

  return <div className="min-h-screen"><AppHeader /><main className="max-w-6xl mx-auto px-4 sm:px-6 py-9">
    <div className="flex items-center justify-between gap-4 mb-7"><div><p className="text-primary-300 text-sm font-semibold mb-2">TECHNICAL RESOURCE ACCESS HUB</p><h1 className="text-3xl font-bold text-white">List a resource</h1><p className="text-gray-400 mt-2">Choose one access pathway and provide the exact terms students need to see.</p></div><Link to="/resources" className="text-sm text-primary-200 hover:text-white">Browse the hub</Link></div>
    {error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}
    {notice && <div className="mb-5 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-100">{notice}</div>}
    <form onSubmit={submit} className="glass-card p-5 sm:p-7 space-y-6">
      <fieldset><legend className="field-label">1. Access type</legend><div className="flex flex-wrap gap-2">{allowedTypes.map((type) => <button key={type.value} type="button" onClick={() => selectType(type.value)} className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${form.accessType === type.value ? 'bg-primary-500/20 border-primary-400/70 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>{type.label}</button>)}</div>{user?.role === 'student' && <p className="mt-3 text-xs text-gray-500">Students can list resources for borrowing, sharing, or donation only.</p>}</fieldset>
      <div className="grid sm:grid-cols-2 gap-4"><Field label="Item name"><TextInput value={form.itemName} onChange={(itemName) => setForm((current) => ({ ...current, itemName }))} placeholder="e.g. Arduino UNO" /></Field><Field label="Category"><select className="feed-input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ResourceCategory }))}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></Field></div>
      <div className="grid sm:grid-cols-2 gap-4"><Field label="Quantity available"><TextInput type="number" min={1} value={form.quantityAvailable} onChange={(quantityAvailable) => setForm((current) => ({ ...current, quantityAvailable: Number(quantityAvailable) }))} /></Field>{!isServiceStock && <Field label="Condition"><select className="feed-input" value={form.condition || ''} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value as ResourceCondition }))}><option value="new">New</option><option value="used_good">Used — good</option><option value="used_fair">Used — fair</option></select></Field>}</div>

      {(form.accessType === 'borrow' || form.accessType === 'share') && borrowShare && <div className="space-y-4"><h2 className="font-semibold text-white">{readable(form.accessType)} terms</h2><div className="grid sm:grid-cols-2 gap-4"><Field label="Maximum duration (days)"><TextInput type="number" min={1} value={borrowShare.borrowDurationDays} onChange={(borrowDurationDays) => patchDetails('borrowShare', { borrowDurationDays: Number(borrowDurationDays) })} /></Field><Field label="Pickup location"><TextInput value={borrowShare.pickupLocation} onChange={(pickupLocation) => patchDetails('borrowShare', { pickupLocation })} placeholder="e.g. Colombo 05" /></Field></div><Field label="Return condition notes"><textarea required className="feed-input min-h-24" value={borrowShare.returnCondition} onChange={(event) => patchDetails('borrowShare', { returnCondition: event.target.value })} placeholder="How and in what condition should this be returned?" /></Field></div>}
      {form.accessType === 'rent' && rent && <div className="space-y-4"><h2 className="font-semibold text-white">Rental terms</h2><div className="grid sm:grid-cols-2 gap-4"><Field label="Price per month"><TextInput type="number" min={0} value={rent.pricePerMonth} onChange={(pricePerMonth) => patchDetails('rent', { pricePerMonth: Number(pricePerMonth) })} /></Field><Field label="Currency"><TextInput value={rent.currency} onChange={(currency) => patchDetails('rent', { currency: currency.toUpperCase() })} /></Field><Field label="Minimum rental months"><TextInput type="number" min={1} value={rent.minRentalMonths} onChange={(minRentalMonths) => patchDetails('rent', { minRentalMonths: Number(minRentalMonths) })} /></Field><Field label="Security deposit (optional)"><TextInput required={false} type="number" min={0} value={rent.securityDeposit ?? ''} onChange={(securityDeposit) => patchDetails('rent', { ...(securityDeposit === '' ? { securityDeposit: undefined } : { securityDeposit: Number(securityDeposit) }) })} /></Field></div></div>}
      {form.accessType === 'installment' && installment && <div className="space-y-4"><h2 className="font-semibold text-white">Installment terms</h2><div className="grid sm:grid-cols-2 gap-4"><Field label="Total price"><TextInput type="number" min={0} value={installment.totalPrice} onChange={(totalPrice) => patchDetails('installment', { totalPrice: Number(totalPrice) })} /></Field><Field label="Down payment"><TextInput type="number" min={0} value={installment.downPayment} onChange={(downPayment) => patchDetails('installment', { downPayment: Number(downPayment) })} /></Field><Field label="Monthly installment"><TextInput type="number" min={0} value={installment.monthlyInstallmentAmount} onChange={(monthlyInstallmentAmount) => patchDetails('installment', { monthlyInstallmentAmount: Number(monthlyInstallmentAmount) })} /></Field><Field label="Number of months"><TextInput type="number" min={1} value={installment.numberOfMonths} onChange={(numberOfMonths) => patchDetails('installment', { numberOfMonths: Number(numberOfMonths) })} /></Field></div><Field label="Late fee policy"><TextInput value={installment.lateFeePolicy} onChange={(lateFeePolicy) => patchDetails('installment', { lateFeePolicy })} placeholder="e.g. No late fee; account reviewed after 7 days" /></Field></div>}
      {form.accessType === 'interest_free' && interestFree && <div className="space-y-4"><div><h2 className="font-semibold text-white">Interest-free terms</h2><p className="text-sm text-emerald-200 mt-1">Interest rate is locked at 0%.</p></div><div className="grid sm:grid-cols-2 gap-4"><Field label="Total price"><TextInput type="number" min={0} value={interestFree.totalPrice} onChange={(totalPrice) => patchDetails('interestFree', { totalPrice: Number(totalPrice) })} /></Field><Field label="Monthly installment"><TextInput type="number" min={0} value={interestFree.monthlyInstallmentAmount} onChange={(monthlyInstallmentAmount) => patchDetails('interestFree', { monthlyInstallmentAmount: Number(monthlyInstallmentAmount) })} /></Field><Field label="Number of months"><TextInput type="number" min={1} value={interestFree.numberOfMonths} onChange={(numberOfMonths) => patchDetails('interestFree', { numberOfMonths: Number(numberOfMonths) })} /></Field><Field label="Repayment start date"><TextInput type="date" value={interestFree.repaymentStartDate} onChange={(repaymentStartDate) => patchDetails('interestFree', { repaymentStartDate })} /></Field></div><Field label="Eligibility criteria (one per line)"><textarea required className="feed-input min-h-24" value={criteriaValue('interestFree')} onChange={(event) => setCriteria('interestFree', event.target.value)} placeholder={'ICT student\nValid student ID'} /></Field></div>}
      {form.accessType === 'sponsorship' && sponsorship && <div className="space-y-4"><h2 className="font-semibold text-white">Sponsorship terms</h2><div className="grid sm:grid-cols-2 gap-4"><Field label="Sponsor organization"><TextInput value={sponsorship.sponsorOrganization} onChange={(sponsorOrganization) => patchDetails('sponsorship', { sponsorOrganization })} /></Field><Field label="Units available"><TextInput type="number" min={1} value={sponsorship.numberOfUnitsAvailable} onChange={(numberOfUnitsAvailable) => patchDetails('sponsorship', { numberOfUnitsAvailable: Number(numberOfUnitsAvailable) })} /></Field><Field label="Application deadline"><TextInput type="date" value={sponsorship.applicationDeadline} onChange={(applicationDeadline) => patchDetails('sponsorship', { applicationDeadline })} /></Field></div><Field label="Eligibility criteria (one per line)"><textarea required className="feed-input min-h-24" value={criteriaValue('sponsorship')} onChange={(event) => setCriteria('sponsorship', event.target.value)} placeholder={'Financial need\nCurrently enrolled student'} /></Field></div>}
      {form.accessType === 'donation' && donation && <div className="space-y-4"><h2 className="font-semibold text-white">Donation details</h2><div className="grid sm:grid-cols-2 gap-4"><Field label="Item age (years)"><TextInput type="number" min={0} value={donation.itemAgeYears} onChange={(itemAgeYears) => patchDetails('donation', { itemAgeYears: Number(itemAgeYears) })} /></Field><Field label="Claim deadline"><TextInput type="date" value={donation.claimDeadline} onChange={(claimDeadline) => patchDetails('donation', { claimDeadline })} /></Field><Field label="Pickup or delivery method"><TextInput value={donation.pickupOrDeliveryMethod} onChange={(pickupOrDeliveryMethod) => patchDetails('donation', { pickupOrDeliveryMethod })} placeholder="Pickup / delivery / both" /></Field></div><Field label="Condition notes"><textarea required className="feed-input min-h-24" value={donation.conditionNotes} onChange={(event) => patchDetails('donation', { conditionNotes: event.target.value })} placeholder="Describe item condition and included accessories." /></Field></div>}
      {financialTypes.includes(form.accessType) && <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">TechBridge does not provide loans or financing. These arrangements are offered directly by verified providers, subject to their own terms.</p>}
      <button disabled={saving} className="px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-500 disabled:opacity-50">{saving ? 'Publishing...' : 'Publish listing'}</button>
    </form>
    <section className="mt-10"><h2 className="text-xl font-bold text-white mb-4">Your listings</h2>{loading ? <p className="text-gray-400">Loading your listings...</p> : listings.length === 0 ? <div className="glass-card p-6 text-gray-400">You have not listed any resources yet.</div> : <div className="grid md:grid-cols-2 gap-4">{listings.map((listing) => <article key={listing._id} className="glass-card p-5"><div className="flex justify-between gap-3"><div><h3 className="font-semibold text-white">{listing.itemName}</h3><p className="mt-1 text-xs text-gray-400">{readable(listing.accessType)} · {listing.quantityAvailable} units</p></div><select value={listing.status} onChange={(event) => void setStatus(listing, event.target.value as 'available' | 'claimed')} className="feed-input !w-auto !py-1.5 text-sm"><option value="available">Available</option><option value="claimed">Claimed</option></select></div><div className="mt-4 flex items-center justify-between"><span className={`text-xs px-2 py-1 rounded ${listing.providerOrgVerified ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'}`}>{listing.providerOrgVerified ? 'Verified provider' : 'Community listing'}</span><button onClick={() => void remove(listing._id)} className="text-sm text-red-200 hover:text-red-100">Delete</button></div></article>)}</div>}</section>
  </main></div>;
};

export default ResourceListingPage;
