import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getMyResourceRequests } from '../api/resourceRequestApi';
import type { ResourceRequest, ResourceRequestStatus } from '../types';

const statusStyle: Record<ResourceRequestStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-100',
  accepted: 'bg-emerald-500/15 text-emerald-200',
  rejected: 'bg-red-500/15 text-red-200',
  completed: 'bg-primary-500/15 text-primary-200',
};
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const resourceOf = (request: ResourceRequest) => typeof request.resourceId === 'string' ? undefined : request.resourceId;
const providerOf = (request: ResourceRequest) => typeof request.providerId === 'string' ? undefined : request.providerId;

const MyResourceRequestsPage = () => {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getMyResourceRequests()
        .then(setRequests)
        .catch(() => setError('Unable to load your resource requests.'))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <div className="min-h-screen"><AppHeader /><main className="max-w-5xl mx-auto px-4 sm:px-6 py-9">
    <section className="mb-8"><p className="text-primary-300 text-sm font-semibold mb-2">STUDENT DASHBOARD</p><h1 className="text-3xl font-bold text-white">My resource requests</h1><p className="text-gray-400 mt-2">Track each request from submission to access.</p></section>
    {error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}
    {loading ? <p className="text-gray-400">Loading your resource requests...</p> : requests.length === 0 ? <div className="glass-card p-10 text-center"><p className="font-semibold text-white">You have not requested a resource yet.</p><Link to="/resources" className="inline-block mt-4 text-primary-300 font-semibold">Browse the Resource Hub →</Link></div> : <div className="space-y-4">{requests.map((request) => { const resource = resourceOf(request); const provider = providerOf(request); return <article key={request._id} className="glass-card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="text-lg font-bold text-white">{resource?.itemName || 'Technical resource'}</p><p className="text-sm text-gray-400 mt-1">{readable(request.requestedAccessType)} access{provider ? ` · ${provider.fullName}` : ''}</p>{request.durationOrTerms && <p className="text-sm text-gray-300 mt-3">Requested terms: {request.durationOrTerms}</p>}{request.message && <p className="text-sm text-gray-400 mt-2 line-clamp-2">“{request.message}”</p>}<p className="text-xs text-gray-500 mt-3">Requested {new Date(request.createdAt).toLocaleDateString('en-LK')}</p></div><span className={`self-start px-3 py-1.5 rounded-full text-sm font-semibold ${statusStyle[request.status]}`}>{readable(request.status)}</span></article>; })}</div>}
  </main></div>;
};

export default MyResourceRequestsPage;
