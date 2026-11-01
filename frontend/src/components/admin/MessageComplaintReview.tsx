import { useState, type FormEvent } from 'react';
import { readMessageEvidence, resolveReport, type Report } from '../../api/adminApi';

export default function MessageComplaintReview({ report, onResolved }: { report: Report; onResolved: () => void }) {
  const [reason, setReason] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [message, setMessage] = useState<Awaited<ReturnType<typeof readMessageEvidence>> | null>(null);
  const access = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { setMessage(await readMessageEvidence(report._id, reason)); } catch { setMessage(null); setError('Unable to access complaint evidence. The complaint must be open and independently reviewed.'); } finally { setBusy(false); }
  };
  const resolve = async (status: 'reviewed' | 'dismissed') => {
    setBusy(true); setError('');
    try { await resolveReport(report._id, status, note); setMessage(null); onResolved(); } catch { setError('Unable to resolve this complaint. Refresh the queue and review the evidence.'); } finally { setBusy(false); }
  };
  return <div className="mt-3 space-y-3 text-sm">
    <p className="text-gray-500">Access is recorded. Review is limited to the single reported message; private conversation history is unavailable.</p>
    <form onSubmit={access} className="space-y-2"><label className="block font-semibold">Reason for accessing complaint evidence<input value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} required className="mt-1 block w-full rounded-lg border border-gray-200 p-2" /></label><button disabled={busy} className="font-semibold text-primary-700">Record access and view reported message</button></form>
    {message && <blockquote className="whitespace-pre-wrap break-words rounded-lg bg-surface-50 p-3 [overflow-wrap:anywhere]">{message.content}<time className="mt-2 block text-xs text-gray-500" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></blockquote>}
    <label className="block font-semibold">Message complaint resolution note<textarea value={note} onChange={(event) => setNote(event.target.value)} minLength={10} maxLength={500} className="mt-1 block w-full rounded-lg border border-gray-200 p-2" /></label>
    <div className="flex flex-wrap gap-4"><button disabled={busy || !message || note.trim().length < 10} onClick={() => void resolve('reviewed')} className="font-semibold text-primary-700 disabled:opacity-40">Resolve message complaint</button><button disabled={busy || note.trim().length < 10} onClick={() => void resolve('dismissed')} className="font-semibold text-gray-600 disabled:opacity-40">Dismiss message complaint</button></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
