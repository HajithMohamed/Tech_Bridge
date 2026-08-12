import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getResources } from '../api/resourceApi';
import type { ResourceAccessType, ResourceListing } from '../types';

const accessTypes: Array<{ value: ResourceAccessType; label: string }> = [
  { value: 'borrow', label: 'Borrow' },
  { value: 'share', label: 'Share' },
  { value: 'rent', label: 'Rent' },
  { value: 'installment', label: 'Installment' },
  { value: 'interest_free', label: 'Interest-Free' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'donation', label: 'Donation' },
];

const providerArrangedTypes: ResourceAccessType[] = ['rent', 'installment', 'interest_free', 'sponsorship'];
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatMoney = (amount: number, currency = 'LKR') => new Intl.NumberFormat('en-LK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' }).format(new Date(value));
const ownerName = (listing: ResourceListing) => {
  if (typeof listing.listedBy === 'string') return 'TechBridge member';
  return listing.listedBy.providerProfile?.organizationName || listing.listedBy.fullName;
};

const ResourceCard = ({ listing }: { listing: ResourceListing }) => {
  const unverifiedProvider = typeof listing.listedBy !== 'string' && listing.listedBy.role === 'provider' && !listing.providerOrgVerified;
  const verifiedProvider = typeof listing.listedBy !== 'string' && listing.listedBy.role === 'provider' && listing.providerOrgVerified;
  const details = listing.accessDetails;

  return <article className="glass-card p-5 flex flex-col h-full">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="tag">{readable(listing.category)}</span>
      <span className="text-xs text-primary-200 font-semibold">{readable(listing.accessType)}</span>
    </div>
    <h3 className="mt-4 text-lg font-bold text-white">{listing.itemName}</h3>
    {listing.condition && <p className="mt-1 text-sm text-gray-400">Condition: {readable(listing.condition)}</p>}
    <p className="mt-3 text-sm text-primary-200">Listed by {ownerName(listing)}</p>
    {verifiedProvider && <span className="mt-2 w-fit text-xs rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 text-emerald-200">Verified provider</span>}
    {unverifiedProvider && <span className="mt-2 w-fit text-xs rounded-full bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 text-amber-100">Unverified — proceed with caution</span>}

    <div className="mt-4 space-y-2 text-sm text-gray-200">
      {(listing.accessType === 'borrow' || listing.accessType === 'share') && details.borrowShare && <>
        <p><span className="text-gray-400">Duration:</span> Up to {details.borrowShare.borrowDurationDays} days</p>
        <p><span className="text-gray-400">Pickup:</span> {details.borrowShare.pickupLocation}</p>
        <p><span className="text-gray-400">Return:</span> {details.borrowShare.returnCondition}</p>
      </>}
      {listing.accessType === 'rent' && details.rent && <>
        <p className="font-semibold text-amber-100">{formatMoney(details.rent.pricePerMonth, details.rent.currency)} / month</p>
        <p><span className="text-gray-400">Minimum period:</span> {details.rent.minRentalMonths} month{details.rent.minRentalMonths === 1 ? '' : 's'}</p>
        {details.rent.securityDeposit !== undefined && <p><span className="text-gray-400">Security deposit:</span> {formatMoney(details.rent.securityDeposit, details.rent.currency)}</p>}
      </>}
      {listing.accessType === 'installment' && details.installment && <>
        <p className="font-semibold text-amber-100">{formatMoney(details.installment.monthlyInstallmentAmount)} / month for {details.installment.numberOfMonths} months</p>
        <p><span className="text-gray-400">Down payment:</span> {formatMoney(details.installment.downPayment)}</p>
        <p><span className="text-gray-400">Total price:</span> {formatMoney(details.installment.totalPrice)}</p>
        <p className="text-xs text-gray-400">Late fee: {details.installment.lateFeePolicy}</p>
      </>}
      {listing.accessType === 'interest_free' && details.interestFree && <>
        <p className="font-bold text-emerald-200">0% interest</p>
        <p><span className="text-gray-400">Plan:</span> {formatMoney(details.interestFree.monthlyInstallmentAmount)} / month for {details.interestFree.numberOfMonths} months</p>
        <p><span className="text-gray-400">Repayment starts:</span> {formatDate(details.interestFree.repaymentStartDate)}</p>
        <Criteria criteria={details.interestFree.eligibilityCriteria} />
      </>}
      {listing.accessType === 'sponsorship' && details.sponsorship && <>
        <p><span className="text-gray-400">Sponsor:</span> {details.sponsorship.sponsorOrganization}</p>
        <p><span className="text-gray-400">Units available:</span> {details.sponsorship.numberOfUnitsAvailable}</p>
        <p><span className="text-gray-400">Apply by:</span> {formatDate(details.sponsorship.applicationDeadline)}</p>
        <Criteria criteria={details.sponsorship.eligibilityCriteria} />
      </>}
      {listing.accessType === 'donation' && details.donation && <>
        <p><span className="text-gray-400">Item age:</span> {details.donation.itemAgeYears} year{details.donation.itemAgeYears === 1 ? '' : 's'}</p>
        <p><span className="text-gray-400">Condition:</span> {details.donation.conditionNotes}</p>
        <p><span className="text-gray-400">Collection:</span> {details.donation.pickupOrDeliveryMethod}</p>
        <p><span className="text-gray-400">Claim by:</span> {formatDate(details.donation.claimDeadline)}</p>
      </>}
    </div>
    <p className="mt-auto pt-5 text-xs text-gray-500">{listing.quantityAvailable} unit{listing.quantityAvailable === 1 ? '' : 's'} available</p>
    {providerArrangedTypes.includes(listing.accessType) && <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-amber-100/80">TechBridge does not provide loans or financing. These arrangements are offered directly by verified providers, subject to their own terms.</p>}
  </article>;
};

const Criteria = ({ criteria }: { criteria: string[] }) => <div><p className="text-gray-400">Eligibility:</p><ul className="mt-1 space-y-1 text-xs text-gray-300">{criteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}</ul></div>;

const ResourceHubPage = () => {
  const [resources, setResources] = useState<ResourceListing[]>([]);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<ResourceAccessType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void getResources(search.trim() ? { item: search.trim() } : undefined)
        .then(setResources)
        .catch(() => setError('Unable to load resource listings right now.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const grouped = useMemo(() => accessTypes.map((type) => ({ ...type, listings: resources.filter((listing) => listing.accessType === type.value) })), [resources]);
  const visibleGroups = activeType === 'all' ? grouped : grouped.filter((group) => group.value === activeType);

  return <div className="min-h-screen"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <section className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-5"><div><p className="text-primary-300 text-sm font-semibold mb-2">TECHNICAL RESOURCE ACCESS HUB</p><h1 className="text-3xl font-bold text-white">Get the tools to build your future</h1><p className="text-gray-400 mt-2 max-w-2xl">Explore structured, transparent ways to borrow, share, rent, receive sponsorship, or claim the equipment you need.</p></div><Link to="/resources/list" className="w-fit px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-500">List a resource</Link></section>
    <section className="glass-card p-4 mb-5"><input className="feed-input w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item name, for example: Laptop" /></section>
    <div className="mb-7 flex gap-2 overflow-x-auto pb-2">{([{ value: 'all', label: 'All' } as const, ...accessTypes]).map((type) => <button key={type.value} onClick={() => setActiveType(type.value)} className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${activeType === type.value ? 'bg-primary-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>{type.label}{type.value !== 'all' && <span className="ml-1.5 text-xs opacity-75">{resources.filter((listing) => listing.accessType === type.value).length}</span>}</button>)}</div>
    {error && <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-100">{error}</div>}
    {loading ? <p className="py-14 text-center text-gray-400">Loading resource listings...</p> : visibleGroups.every((group) => group.listings.length === 0) ? <div className="glass-card p-12 text-center"><p className="font-semibold text-white">No available listings found.</p><p className="mt-2 text-sm text-gray-400">Try another item name or list the resource you can share.</p></div> : <div className="space-y-10">{visibleGroups.filter((group) => group.listings.length > 0).map((group) => <section key={group.value}><div className="mb-4 flex items-center gap-3"><h2 className="text-xl font-bold text-white">{group.label}</h2><span className="text-sm text-gray-500">{group.listings.length} listing{group.listings.length === 1 ? '' : 's'}</span></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{group.listings.map((listing) => <ResourceCard key={listing._id} listing={listing} />)}</div></section>)}</div>}
  </main></div>;
};

export default ResourceHubPage;
