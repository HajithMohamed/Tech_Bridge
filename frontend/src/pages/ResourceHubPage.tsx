import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { getResources } from '../api/resourceApi';
import { useAuth } from '../hooks/useAuth';
import type { ResourceAccessType, ResourceListing } from '../types';
import { createResourceRequest } from '../api/resourceRequestApi';

const freeTypes: ResourceAccessType[] = ['borrow', 'share', 'donation'];
const subsidizedTypes: ResourceAccessType[] = ['installment', 'interest_free', 'sponsorship'];
const marketplaceTypes: ResourceAccessType[] = ['rent'];


const providerArrangedTypes: ResourceAccessType[] = ['rent', 'installment', 'interest_free', 'sponsorship'];
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatMoney = (amount: number, currency = 'LKR') => new Intl.NumberFormat('en-LK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' }).format(new Date(value));
const ownerName = (listing: ResourceListing) => {
  if (typeof listing.listedBy === 'string') return 'TechBridge member';
  return listing.listedBy.providerProfile?.organizationName || listing.listedBy.fullName;
};

const ResourceCard = ({ listing, canRequest }: { listing: ResourceListing; canRequest: boolean }) => {
  const details = listing.accessDetails;
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
    </div>

    <div className="mt-4 space-y-2 text-sm text-gray-600">
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
  const [activeTab, setActiveTab] = useState<'free' | 'subsidized' | 'marketplace'>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  const visibleListings = useMemo(() => {
    if (activeTab === 'free') return resources.filter(r => freeTypes.includes(r.accessType));
    if (activeTab === 'subsidized') return resources.filter(r => subsidizedTypes.includes(r.accessType));
    if (activeTab === 'marketplace') return resources.filter(r => marketplaceTypes.includes(r.accessType));
    return [];
  }, [activeTab, resources]);

  return <div className="min-h-screen bg-surface-50"><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
    <section className="mb-7 flex flex-col md:flex-row md:items-end justify-between gap-5"><div><p className="text-primary-600 text-sm font-semibold mb-2">TECHNICAL RESOURCE ACCESS HUB</p><h1 className="text-3xl font-bold text-surface-900">Get the tools to build your future</h1><p className="text-gray-600 mt-2 max-w-2xl">Explore structured, transparent ways to borrow, share, rent, receive sponsorship, or claim the equipment you need.</p></div><Link to="/resources/list" className="w-fit px-5 py-3 rounded-xl font-semibold text-white bg-primary-600 hover:bg-primary-700">List a resource</Link></section>
    <section className="glass-card p-4 mb-5"><input className="feed-input w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item name, for example: Laptop" /></section>
    <div className="mb-7 flex gap-1 border-b border-gray-200">
      <button onClick={() => setActiveTab('free')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'free' ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>Free Access <span className="opacity-70 text-xs ml-1">(Borrow, Donate)</span></button>
      <button onClick={() => setActiveTab('subsidized')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'subsidized' ? 'text-emerald-600 border-emerald-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>Subsidized <span className="opacity-70 text-xs ml-1">(Installment, 0% Interest)</span></button>
      <button onClick={() => setActiveTab('marketplace')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'marketplace' ? 'text-amber-600 border-amber-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>Marketplace <span className="opacity-70 text-xs ml-1">(Rent)</span></button>
    </div>

    {error && <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">{error}</div>}
    {loading ? <p className="py-14 text-center text-gray-500">Loading resource listings...</p> : visibleListings.length === 0 ? <div className="glass-card p-12 text-center"><p className="font-semibold text-surface-900">No available listings found in this category.</p><p className="mt-2 text-sm text-gray-500">Try searching or checking other tabs.</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{visibleListings.map((listing) => <ResourceCard key={listing._id} listing={listing} canRequest={user?.role === 'student' && (typeof listing.listedBy === 'string' || listing.listedBy._id !== user._id)} />)}</div>}
  </main></div>;
};

export default ResourceHubPage;
