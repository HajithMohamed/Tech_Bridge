import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import AppHeader from '../components/AppHeader';
import { getResource } from '../api/resourceApi';
import { createResourceRequest } from '../api/resourceRequestApi';
import type { ResourceListing } from '../types';

const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const ResourceRequestPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resource, setResource] = useState<ResourceListing | null>(null);
  const [durationOrTerms, setDurationOrTerms] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (id) void getResource(id).then(setResource).catch(() => setError('This resource is no longer available.')); }, [id]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!resource) return; setSaving(true); setError('');
    try { await createResourceRequest(resource._id, resource.accessType, durationOrTerms, message); navigate('/my-resource-requests'); }
    catch (requestError) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to send the request.' : 'Unable to send the request.'); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-surface-50"><AppHeader /><main className="max-w-2xl mx-auto px-4 sm:px-6 py-9"><Link to="/resources" className="text-sm font-semibold text-primary-600">← Back to Resource Hub</Link>{error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">{error}</div>}{!resource ? <p className="py-16 text-center text-gray-400">Loading resource details…</p> : <><section className="mt-6"><p className="text-primary-600 text-sm font-semibold uppercase tracking-wider">Resource request</p><h1 className="text-3xl font-bold text-gray-900 mt-2">Request {resource.itemName}</h1><p className="text-gray-500 mt-2">You are requesting this item through the <strong>{humanize(resource.accessType)}</strong> pathway. The provider will review your request and contact you directly.</p></section><form onSubmit={submit} className="mt-7 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"><div className="rounded-xl bg-surface-50 border border-gray-100 p-4"><p className="font-semibold text-gray-900">{resource.itemName}</p><p className="text-sm text-gray-500 mt-1">{resource.quantityAvailable} unit{resource.quantityAvailable === 1 ? '' : 's'} available · {humanize(resource.category)}</p></div><label className="block text-sm font-semibold text-gray-700">Requested duration or preferred terms <span className="font-normal text-gray-400">(optional)</span><input maxLength={200} value={durationOrTerms} onChange={(e) => setDurationOrTerms(e.target.value)} className="profile-input mt-1.5" placeholder={resource.accessType === 'borrow' || resource.accessType === 'rent' ? 'e.g. 2 months' : 'e.g. I can provide my student ID'} /></label><label className="block text-sm font-semibold text-gray-700">Message to provider <span className="font-normal text-gray-400">(optional)</span><textarea maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="profile-input mt-1.5 min-h-28" placeholder="Explain how this resource will support your studies." /></label><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">TechBridge only connects you with the provider. Financial, rental, or ownership terms are agreed directly with that provider.</p><button disabled={saving} className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? 'Sending request...' : 'Send request'}</button></form></>}</main></div>;
};

export default ResourceRequestPage;
