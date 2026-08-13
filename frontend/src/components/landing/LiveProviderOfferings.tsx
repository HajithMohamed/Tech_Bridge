import { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CalendarDays, Cpu, GraduationCap, MapPin, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getOpportunities } from '../../api/opportunityApi';
import { getResources } from '../../api/resourceApi';
import type { Opportunity, ResourceListing } from '../../types';

const typeLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const providerName = (opportunity: Opportunity) => typeof opportunity.providerId === 'string' ? 'Verified provider' : opportunity.providerId.providerProfile?.organizationName || opportunity.providerId.fullName;
const resourceOwner = (resource: ResourceListing) => typeof resource.listedBy === 'string' ? 'TechBridge member' : resource.listedBy.providerProfile?.organizationName || resource.listedBy.fullName;

const LiveProviderOfferings = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [resources, setResources] = useState<ResourceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getOpportunities(), getResources()])
      .then(([latestOpportunities, latestResources]) => {
        if (cancelled) return;
        setOpportunities(latestOpportunities.slice(0, 3));
        setResources(latestResources.filter((resource) => typeof resource.listedBy !== 'string' && resource.listedBy.role === 'provider').slice(0, 3));
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return <section className="border-y border-gray-100 bg-surface-50 py-20" id="live-offerings"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Live from providers</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-surface-900">New opportunities and resources</h2><p className="mt-2 max-w-2xl text-gray-500">When a verified provider publishes a job, scholarship, training, mentorship, or resource, it appears here and in the full hubs.</p></div><div className="flex flex-wrap gap-3"><Link to="/opportunities" className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50">All opportunities <ArrowRight className="h-4 w-4" /></Link><Link to="/resources" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Resource Hub <ArrowRight className="h-4 w-4" /></Link></div></div>
    {loading ? <p className="py-12 text-center text-gray-400">Loading the latest provider offerings…</p> : <div className="mt-9 grid gap-8 lg:grid-cols-2"><section><div className="mb-4 flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary-600" /><h3 className="font-bold text-gray-900">Latest opportunities</h3></div>{opportunities.length === 0 ? <Empty text="No open opportunities yet. Check back soon." /> : <div className="space-y-3">{opportunities.map((opportunity) => <Link key={opportunity._id} to={`/opportunities/${opportunity._id}`} className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700">{typeLabel(opportunity.type)}</span><h4 className="mt-3 font-bold text-gray-900">{opportunity.title}</h4><p className="mt-1 text-sm text-gray-500">{providerName(opportunity)}</p></div><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary-500" /></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{opportunity.location}</span><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Deadline {new Date(opportunity.applicationDeadline).toLocaleDateString('en-LK')}</span></div></Link>)}</div>}</section><section><div className="mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-emerald-600" /><h3 className="font-bold text-gray-900">Latest technical resources</h3></div>{resources.length === 0 ? <Empty text="No provider resources are available yet." /> : <div className="space-y-3">{resources.map((resource) => <Link key={resource._id} to="/resources" className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"><div className="flex gap-4">{resource.imageDataUrl ? <img src={resource.imageDataUrl} alt="" className="h-16 w-16 rounded-xl border border-gray-100 object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Cpu className="h-6 w-6" /></div>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{typeLabel(resource.accessType)}</span><h4 className="mt-2 truncate font-bold text-gray-900">{resource.itemName}</h4></div><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /></div><p className="mt-1 text-sm text-gray-500">{resourceOwner(resource)} · {resource.quantityAvailable} available</p></div></div></Link>)}</div>}</section></div>}
    <div className="mt-8 rounded-2xl border border-primary-100 bg-white p-4 text-sm text-gray-600"><GraduationCap className="mr-2 inline h-4 w-4 text-primary-600" />Students can browse publicly; sign in to apply for opportunities or request a resource.</div>
  </div></section>;
};

const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-7 text-sm text-gray-500">{text}</div>;

export default LiveProviderOfferings;
