import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getResource } from '../api/resourceApi';
import { createResourceRequest } from '../api/resourceRequestApi';
import type { ResourceListing } from '../types';
import { Box, ArrowLeft, Info } from 'lucide-react';

const humanize = (value: string) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';

const ResourceRequestPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resource, setResource] = useState<ResourceListing | null>(null);
  const [durationOrTerms, setDurationOrTerms] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { 
    if (id) {
      void getResource(id).then(setResource).catch(() => setError('This resource is no longer available.')); 
    }
  }, [id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); 
    if (!resource) return; 
    setSaving(true); 
    setError('');
    
    try { 
      await createResourceRequest(
        resource._id, 
        resource.accessType, 
        durationOrTerms, 
        message 
      ); 
      navigate('/my-resource-requests'); 
    }
    catch (requestError) { 
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to send the request.' : 'Unable to send the request.'); 
    }
    finally { 
      setSaving(false); 
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/resources" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Resource Hub
      </Link>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 flex items-start gap-3 shadow-sm">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {!resource && !error ? (
        <div className="py-20 text-center text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p>Loading resource details…</p>
        </div>
      ) : resource ? (
        <>
          <section className="mb-8 text-center sm:text-left">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 text-primary-500 mb-6 shadow-sm border border-primary-100">
              <Box className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-surface-900 tracking-tight">Request Access</h1>
            <p className="text-gray-500 mt-2 text-lg">
              You are requesting access to this resource through the <strong className="text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">{humanize(resource.accessType)}</strong> pathway.
            </p>
          </section>

          <form onSubmit={submit} className="bg-primary-50/50 rounded-3xl border border-primary-100 shadow-xl shadow-primary-500/5 p-6 sm:p-8 space-y-6">
            
            {/* Resource Summary Card */}
            <div className="rounded-2xl bg-white border border-primary-100 p-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-sm font-bold text-primary-500 uppercase tracking-wider mb-1">Resource</p>
                <p className="text-xl font-bold text-surface-900">{resource.itemName}</p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center justify-center px-3 py-1 bg-primary-50 border border-primary-200 rounded-full shadow-sm text-sm font-semibold text-primary-700">
                  {resource.quantityAvailable} available
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <label className="block">
                <span className="text-sm font-bold text-gray-700 mb-2 block">
                  Requested duration or preferred terms <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <input 
                  maxLength={200} 
                  value={durationOrTerms} 
                  onChange={(e) => setDurationOrTerms(e.target.value)} 
                  className="w-full border border-gray-200 rounded-xl bg-white p-3.5 text-surface-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none" 
                  placeholder={resource.accessType === 'borrow' || resource.accessType === 'rent' ? 'e.g. 2 months' : 'e.g. I can provide my student ID'} 
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-700 mb-2 block">
                  Message to provider <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <textarea 
                  maxLength={1000} 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  className="w-full border border-gray-200 rounded-xl bg-white p-3.5 text-surface-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none min-h-[120px] resize-y" 
                  placeholder="Explain how this resource will support your studies or projects." 
                />
              </label>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <p>TechBridge only connects you with the provider. Financial, rental, or ownership terms are agreed directly with that provider.</p>
            </div>

            <button 
              disabled={saving} 
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-8 py-3.5 font-bold text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-primary-500/20"
            >
              {saving ? 'Sending Request...' : 'Send Request'}
            </button>
          </form>
        </>
      ) : null}
    </main>
  );
};

export default ResourceRequestPage;

