import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getResources } from '../api/resourceApi';
import { useAuth } from '../hooks/useAuth';
import type { ResourceAccessType, ResourceCategory, ResourceListing } from '../types';

const freeTypes: ResourceAccessType[] = ['borrow', 'share', 'donation'];
const subsidizedTypes: ResourceAccessType[] = ['installment', 'interest_free', 'sponsorship'];
const marketplaceTypes: ResourceAccessType[] = ['rent'];
const categories: Array<{ value: ResourceCategory; label: string }> = [
  { value: 'laptop', label: 'Laptops' },
  { value: 'arduino', label: 'Arduino' },
  { value: 'raspberry_pi', label: 'Raspberry Pi' },
  { value: 'sensor', label: 'Sensors' },
  { value: 'electronic_component', label: 'Electronic components' },
  { value: 'dev_board', label: 'Development boards' },
  { value: 'other', label: 'Other resources' },
];


const providerArrangedTypes: ResourceAccessType[] = ['rent', 'installment', 'interest_free', 'sponsorship'];
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatMoney = (amount: number, currency = 'LKR') => new Intl.NumberFormat('en-LK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' }).format(new Date(value));
const ownerName = (listing: ResourceListing) => {
  if (typeof listing.listedBy === 'string') return 'TechBridge member';
  return listing.listedBy.providerProfile?.organizationName || listing.listedBy.fullName;
};
void ownerName;

const itemSpecifications = (listing: ResourceListing): string[] => {
  const { laptop, arduino, raspberryPi, sensor, electronicComponent, devBoard, other } = listing.itemDetails || {};
  if (laptop) return [`${laptop.brand} ${laptop.model}`.trim(), `${laptop.processor} (${laptop.processorGeneration})`, `${laptop.ramGb} GB RAM · ${laptop.storageGb} GB ${laptop.storageType.toUpperCase()}`];
  if (arduino) return [`${arduino.model} · ${arduino.microcontroller}`, `${arduino.operatingVoltage} · ${arduino.digitalPins} digital / ${arduino.analogPins} analog pins`];
  if (raspberryPi) return [`${raspberryPi.model} · ${raspberryPi.processor}`, `${raspberryPi.ramGb} GB RAM · ${raspberryPi.storageSupport}`];
  if (sensor) return [`${sensor.sensorType} · ${sensor.measuredParameter}`, `${sensor.operatingVoltage} · ${sensor.interface}`];
  if (electronicComponent) return [`${electronicComponent.componentType} · ${electronicComponent.valueOrRating}`, electronicComponent.packageType];
  if (devBoard) return [`${devBoard.boardModel} · ${devBoard.microcontrollerOrProcessor}`, `${devBoard.memory} · ${devBoard.connectivity}`];
  if (other) return [other.brand, other.model, other.description].filter((value): value is string => Boolean(value));
  return [];
};

const ResourceCard = ({ listing, canRequest }: { listing: ResourceListing; canRequest: boolean }) => {
  const details = listing.accessDetails;
/* Legacy card layout:
  return <article className="glass-card p-5 flex flex-col h-full">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="font-bold text-surface-900 text-lg leading-tight">{listing.itemName}</h3>
        <span className="inline-block mt-2 tag">{readable(listing.category)}</span>
      </div>
      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold whitespace-nowrap text-right">
        {readable(listing.accessType)}
      </span>
    </div>
    
    <div className="flex gap-2 items-center">
      {typeof listing.listedBy !== 'string' && (
        <span className={`text-xs px-2 py-1 rounded-md ${listing.providerOrgVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
          {listing.providerOrgVerified ? 'Verified Provider' : 'Community'}
        </span>
      )}
      {typeof listing.listedBy === 'string' ? <p className="text-sm text-gray-500">By {ownerName(listing)}</p> : <Link to={`/providers/${listing.listedBy._id}`} className="text-sm text-primary-600 hover:text-primary-700">By {ownerName(listing)}</Link>}
*/
  const specifications = itemSpecifications(listing);

  return <article className="glass-card p-5 flex flex-col h-full">
    {listing.imageDataUrl && <img src={listing.imageDataUrl} alt={listing.itemName} className="mb-4 h-44 w-full rounded-xl border border-white/10 object-cover" />}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="tag">{readable(listing.category)}</span>
      <span className="text-xs text-primary-200 font-semibold">{readable(listing.accessType)}</span>
    </div>

    {specifications.length > 0 && <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Specifications</p><ul className="mt-2 space-y-1 text-sm text-gray-200">{specifications.map((specification) => <li key={specification}>• {specification}</li>)}</ul></div>}

    <div className="mt-4 space-y-2 text-sm text-gray-200">
      {(listing.accessType === 'borrow' || listing.accessType === 'share') && details.borrowShare && <>
        <p><span className="text-gray-500">Duration:</span> Up to {details.borrowShare.borrowDurationDays} days</p>
        <p><span className="text-gray-500">Pickup:</span> {details.borrowShare.pickupLocation}</p>
        <p><span className="text-gray-500">Return:</span> {details.borrowShare.returnCondition}</p>
      </>}
      {listing.accessType === 'rent' && details.rent && <>
        <p className="font-semibold text-primary-700">{formatMoney(details.rent.pricePerMonth, details.rent.currency)} / month</p>
        <p><span className="text-gray-500">Minimum period:</span> {details.rent.minRentalMonths} month{details.rent.minRentalMonths === 1 ? '' : 's'}</p>
        {details.rent.securityDeposit !== undefined && <p><span className="text-gray-500">Security deposit:</span> {formatMoney(details.rent.securityDeposit, details.rent.currency)}</p>}
      </>}
      {listing.accessType === 'installment' && details.installment && <>
        <p className="font-semibold text-primary-700">{formatMoney(details.installment.monthlyInstallmentAmount)} / month for {details.installment.numberOfMonths} months</p>
        <p><span className="text-gray-500">Down payment:</span> {formatMoney(details.installment.downPayment)}</p>
        <p><span className="text-gray-500">Total price:</span> {formatMoney(details.installment.totalPrice)}</p>
        <p className="text-xs text-gray-500">Late fee: {details.installment.lateFeePolicy}</p>
      </>}
      {listing.accessType === 'interest_free' && details.interestFree && <>
        <p className="font-bold text-emerald-600">0% interest</p>
        <p><span className="text-gray-500">Plan:</span> {formatMoney(details.interestFree.monthlyInstallmentAmount)} / month for {details.interestFree.numberOfMonths} months</p>
        <p><span className="text-gray-500">Repayment starts:</span> {formatDate(details.interestFree.repaymentStartDate)}</p>
        <Criteria criteria={details.interestFree.eligibilityCriteria} />
      </>}
      {listing.accessType === 'sponsorship' && details.sponsorship && <>
        <p><span className="text-gray-500">Sponsor:</span> {details.sponsorship.sponsorOrganization}</p>
        <p><span className="text-gray-500">Units available:</span> {details.sponsorship.numberOfUnitsAvailable}</p>
        <p><span className="text-gray-500">Apply by:</span> {formatDate(details.sponsorship.applicationDeadline)}</p>
        <Criteria criteria={details.sponsorship.eligibilityCriteria} />
      </>}
      {listing.accessType === 'donation' && details.donation && <>
        <p><span className="text-gray-500">Item age:</span> {details.donation.itemAgeYears} year{details.donation.itemAgeYears === 1 ? '' : 's'}</p>
        <p><span className="text-gray-500">Condition:</span> {details.donation.conditionNotes}</p>
        <p><span className="text-gray-500">Collection:</span> {details.donation.pickupOrDeliveryMethod}</p>
        <p><span className="text-gray-500">Claim by:</span> {formatDate(details.donation.claimDeadline)}</p>
      </>}
    </div>
    <p className="mt-auto pt-5 text-xs text-gray-400">{listing.quantityAvailable} unit{listing.quantityAvailable === 1 ? '' : 's'} available</p>
    {providerArrangedTypes.includes(listing.accessType) && <p className="mt-4 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500">TechBridge does not provide loans or financing. These arrangements are offered directly by verified providers, subject to their own terms.</p>}
    {canRequest && <Link to={`/resources/${listing._id}/request`} className="mt-5 inline-flex w-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Request this resource</Link>}
  </article>;
};

const Criteria = ({ criteria }: { criteria: string[] }) => <div><p className="text-gray-500">Eligibility:</p><ul className="mt-1 space-y-1 text-xs text-gray-600">{criteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}</ul></div>;

const ResourceHubPage = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState<ResourceListing[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ResourceCategory | ''>('');
  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'subsidized' | 'marketplace'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void getResources({ ...(search.trim() ? { item: search.trim() } : {}), ...(category ? { category } : {}) })
        .then((result) => { if (!cancelled) setResources(result); })
        .catch(() => { if (!cancelled) setError('Unable to load resource listings right now.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, search ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, category]);

  const visibleListings = useMemo(() => {
    if (activeTab === 'all') return resources;
    if (activeTab === 'free') return resources.filter(r => freeTypes.includes(r.accessType));
    if (activeTab === 'subsidized') return resources.filter(r => subsidizedTypes.includes(r.accessType));
    if (activeTab === 'marketplace') return resources.filter(r => marketplaceTypes.includes(r.accessType));
    return [];
  }, [activeTab, resources]);

  return <div className="min-h-screen bg-surface-50"><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <section className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-5"><div><p className="text-primary-600 text-sm font-semibold mb-2">TECHNICAL RESOURCE ACCESS HUB</p><h1 className="text-3xl font-bold text-surface-900">Get the tools to build your future</h1><p className="text-gray-600 mt-2 max-w-2xl">Explore structured, transparent ways to borrow, share, rent, receive sponsorship, or claim the equipment you need.</p></div><Link to="/resources/list" className="w-fit px-5 py-3 rounded-xl font-semibold text-white bg-primary-600 hover:bg-primary-700">List a resource</Link></section>
    <section className="glass-card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_260px]"><input className="feed-input w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item name, for example: Laptop" /><select value={category} onChange={(event) => setCategory(event.target.value as ResourceCategory | '')} className="feed-input w-full"><option value="">All resource categories</option>{categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></section>
    <div className="mb-7 flex gap-1 border-b border-gray-200">
      <button onClick={() => setActiveTab('all')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'all' ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>All available <span className="opacity-70 text-xs ml-1">({resources.length})</span></button>
      <button onClick={() => setActiveTab('free')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'free' ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>Free Access <span className="opacity-70 text-xs ml-1">(Borrow, Donate)</span></button>
      <button onClick={() => setActiveTab('subsidized')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'subsidized' ? 'text-emerald-600 border-emerald-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>Subsidized <span className="opacity-70 text-xs ml-1">(Installment, 0% Interest)</span></button>
      <button onClick={() => setActiveTab('marketplace')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'marketplace' ? 'text-amber-600 border-amber-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>Marketplace <span className="opacity-70 text-xs ml-1">(Rent)</span></button>
    </div>

    {error && <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">{error}</div>}
    {loading ? <p className="py-14 text-center text-gray-500">Loading resource listings...</p> : visibleListings.length === 0 ? <div className="glass-card p-12 text-center"><p className="font-semibold text-surface-900">No available resources match these filters.</p><p className="mt-2 text-sm text-gray-500">Clear a filter or choose another access option.</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{visibleListings.map((listing) => <ResourceCard key={listing._id} listing={listing} canRequest={user?.role === 'student' && (typeof listing.listedBy === 'string' || listing.listedBy._id !== user._id)} />)}</div>}
  </main></div>;
};

export default ResourceHubPage;
