import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getPublicProviderProfile } from '../api/providerApi';
import type { PublicProviderResponse } from '../types';

const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const serviceLabels: Record<string, string> = { jobs: 'Jobs & freelance projects', internships: 'Internships & hiring', scholarships: 'Scholarships & financial assistance', training: 'Training & workshops', mentorship: 'Mentorship & guidance', technical_resources: 'Technical resources' };

const PublicProviderProfilePage = () => {
  const { id } = useParams();
  const [data, setData] = useState<PublicProviderResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const timer = window.setTimeout(() => {
      void getPublicProviderProfile(id).then(setData).catch(() => setError('This provider profile could not be found.'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (error) return <div className="min-h-screen"><main className="max-w-5xl mx-auto px-4 sm:px-6 py-9"><div className="glass-card p-10 text-center"><p className="text-surface-900 font-semibold">{error}</p><Link to="/opportunities" className="inline-block mt-4 text-primary-600">Browse opportunities</Link></div></main></div>;
  if (!data) return <div className="min-h-screen"><main className="max-w-5xl mx-auto px-4 sm:px-6 py-9"><p className="text-center text-gray-400">Loading provider profile...</p></main></div>;

  const { provider, opportunities, resources } = data;
  const profile = provider.providerProfile;
  return <div className="min-h-screen"><main className="max-w-5xl mx-auto px-4 sm:px-6 py-9">
    <Link to="/opportunities" className="text-sm text-primary-300 hover:text-white">← Back to opportunities</Link>
    <section className="glass-card mt-5 p-6 sm:p-8"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5"><div className="flex gap-4"><div className="w-16 h-16 rounded-2xl overflow-hidden bg-primary-100 grid place-items-center text-xl font-bold text-primary-600">{profile.logoUrl ? <img src={profile.logoUrl} alt="Provider logo" className="w-full h-full object-cover" /> : profile.organizationName.charAt(0).toUpperCase()}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-surface-900">{profile.organizationName}</h1>{profile.verified && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">✓ Verified provider</span>}</div><p className="text-sm text-primary-600 mt-2">{readable(profile.organizationType)}</p><p className="text-sm text-gray-500 mt-1">{profile.location}</p></div></div>{profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:text-primary-700">Visit website ↗</a>}</div>{profile.description && <p className="mt-6 max-w-3xl whitespace-pre-wrap text-gray-600">{profile.description}</p>}<div className="mt-6"><p className="text-sm font-semibold text-gray-700 mb-2">Services offered</p><div className="flex flex-wrap gap-2">{profile.opportunityCategories.map((service) => <span key={service} className="tag">{serviceLabels[service] || readable(service)}</span>)}</div></div><div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm text-gray-600"><p>Contact: {profile.contactEmail}</p><p>Phone: {profile.phone}</p></div></section>
    <section className="mt-9"><div className="flex items-baseline justify-between gap-4 mb-4"><h2 className="text-xl font-bold text-surface-900">Published opportunities</h2><span className="text-sm text-gray-500">{opportunities.length}</span></div>{opportunities.length === 0 ? <div className="glass-card p-6 text-gray-500">No open opportunities at the moment.</div> : <div className="grid md:grid-cols-2 gap-4">{opportunities.map((opportunity) => <Link key={opportunity._id} to={`/opportunities/${opportunity._id}`} className="glass-card p-5 hover:border-primary-400/50"><div className="flex justify-between gap-3"><span className="tag">{readable(opportunity.type)}</span><span className="text-xs text-gray-500">{readable(opportunity.workMode)}</span></div><h3 className="mt-4 font-semibold text-surface-900">{opportunity.title}</h3><p className="mt-2 text-sm text-gray-500 line-clamp-2">{opportunity.description}</p></Link>)}</div>}</section>
    <section className="mt-9"><div className="flex items-baseline justify-between gap-4 mb-4"><h2 className="text-xl font-bold text-surface-900">Available technical resources</h2><span className="text-sm text-gray-500">{resources.length}</span></div>{resources.length === 0 ? <div className="glass-card p-6 text-gray-500">No available resources at the moment.</div> : <div className="grid md:grid-cols-2 gap-4">{resources.map((resource) => <Link key={resource._id} to="/resources" className="glass-card p-5 hover:border-emerald-400/50"><div className="flex justify-between gap-3"><span className="tag">{readable(resource.category)}</span><span className="text-xs text-emerald-700 font-semibold">{readable(resource.accessType)}</span></div><h3 className="mt-4 font-semibold text-surface-900">{resource.itemName}</h3><p className="mt-2 text-sm text-gray-500">{resource.quantityAvailable} unit{resource.quantityAvailable === 1 ? '' : 's'} available</p></Link>)}</div>}</section>
  </main></div>;
};

export default PublicProviderProfilePage;

