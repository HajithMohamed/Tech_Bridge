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
  if (!listing.listedBy) return 'Member unavailable';
  if (typeof listing.listedBy === 'string') return 'TechBridge member';
  return listing.listedBy.providerProfile?.organizationName || listing.listedBy.fullName;
};

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
  const specifications = itemSpecifications(listing);
  const owner = typeof listing.listedBy === 'object' ? listing.listedBy : null;

  return <article aria-labelledby={`resource-${listing._id}`} className="glass-card p-5 flex flex-col h-full min-w-0">
    {listing.imageDataUrl && <img src={listing.imageDataUrl} alt="" className="mb-4 h-44 w-full rounded-xl border border-gray-100 object-cover" />}
    <h2 id={`resource-${listing._id}`} className="text-lg font-bold leading-snug text-gray-900 break-words">{listing.itemName}</h2>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {owner?.role === 'provider' ? <Link to={`/providers/${owner._id}`} className="font-semibold text-primary-700 hover:underline">By {ownerName(listing)}</Link> : <p className="text-gray-600">By {ownerName(listing)}</p>}
      {owner?.role === 'provider' && listing.providerOrgVerified && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Verified provider</span>}
      {owner?.role === 'student' && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">Student shared</span>}
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <span className="tag">{readable(listing.category)}</span>
      <span className="text-sm text-primary-700 font-semibold">{readable(listing.accessType)}</span>
    </div>

    {specifications.length > 0 && <div className="mt-4 rounded-xl bg-gray-50 p-3"><h3 className="text-sm font-semibold text-gray-900">Specifications</h3><ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-700">{specifications.map((specification) => <li key={specification}>{specification}</li>)}</ul></div>}

    <div className="mt-4 space-y-2 text-sm text-gray-700">
      {listing.condition && <p><span className="text-gray-600">Condition:</span> {readable(listing.condition)}</p>}
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
    <p className="mt-auto pt-5 text-sm text-gray-600">{listing.quantityAvailable} unit{listing.quantityAvailable === 1 ? '' : 's'} available</p>
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
  const [reload, setReload] = useState(0);

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
  }, [search, category, reload]);

  const visibleListings = useMemo(() => {
    if (activeTab === 'all') return resources;
    if (activeTab === 'free') return resources.filter(r => freeTypes.includes(r.accessType));
    if (activeTab === 'subsidized') return resources.filter(r => subsidizedTypes.includes(r.accessType));
    if (activeTab === 'marketplace') return resources.filter(r => marketplaceTypes.includes(r.accessType));
    return [];
  }, [activeTab, resources]);

  return <div className="bg-surface-50"><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <section className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-5"><div><h1 className="text-2xl sm:text-3xl font-bold text-surface-900">Technical resources</h1><p className="text-gray-600 mt-2 max-w-2xl">Explore structured, transparent ways to borrow, share, rent, receive sponsorship, or claim the equipment you need.</p></div><Link to="/resources/list" className="w-fit px-5 py-3 rounded-xl font-semibold text-white bg-primary-600 hover:bg-primary-700">List a resource</Link></section>
    <section aria-label="Find resources" className="glass-card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_260px]"><input aria-label="Search resources" className="feed-input w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item name, for example: Laptop" /><select aria-label="Resource category" value={category} onChange={(event) => setCategory(event.target.value as ResourceCategory | '')} className="feed-input w-full"><option value="">All resource categories</option>{categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></section>
    <div aria-label="Resource access options" className="mb-7 flex gap-1 overflow-x-auto border-b border-gray-200 [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button]:min-h-11">
      <button aria-pressed={activeTab === 'all'} onClick={() => setActiveTab('all')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'all' ? 'text-primary-700 border-primary-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}>All available <span className="text-xs ml-1">({resources.length})</span></button>
      <button aria-pressed={activeTab === 'free'} onClick={() => setActiveTab('free')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'free' ? 'text-primary-700 border-primary-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}>Free Access <span className="text-xs ml-1">(Borrow, Donate)</span></button>
      <button aria-pressed={activeTab === 'subsidized'} onClick={() => setActiveTab('subsidized')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'subsidized' ? 'text-primary-700 border-primary-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}>Subsidized <span className="text-xs ml-1">(Installment, 0% Interest)</span></button>
      <button aria-pressed={activeTab === 'marketplace'} onClick={() => setActiveTab('marketplace')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'marketplace' ? 'text-primary-700 border-primary-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}>Marketplace <span className="text-xs ml-1">(Rent)</span></button>
    </div>

    {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700"><p>{error}</p><button onClick={() => setReload((value) => value + 1)} className="min-h-11 font-semibold underline">Retry resources</button></div>}
    {loading ? <p role="status" className="py-14 text-center text-gray-600">Loading resource listings...</p> : error ? null : visibleListings.length === 0 ? <div className="glass-card p-12 text-center"><p className="font-semibold text-surface-900">No available resources match these filters.</p><p className="mt-2 text-sm text-gray-600">Clear a filter or choose another access option.</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{visibleListings.map((listing) => {
      const ownerId = typeof listing.listedBy === 'string' ? listing.listedBy : listing.listedBy?._id;
      return <ResourceCard key={listing._id} listing={listing} canRequest={user?.role === 'student' && Boolean(ownerId) && ownerId !== user._id && listing.status === 'available' && listing.quantityAvailable > 0} />;
    })}</div>}
  </main></div>;
};

export default ResourceHubPage;
