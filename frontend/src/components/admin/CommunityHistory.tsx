import { useEffect, useState } from 'react';
import { getCommunityHistory, claimStatusLabel, type CommunityEntry } from '../../api/communityApi';
import { verificationError } from '../../api/verificationApi';

export default function CommunityHistory({ token, claimId, revision }: { token?: string; claimId?: string; revision: number }) {
  const [entries, setEntries] = useState<CommunityEntry[]>([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [error, setError] = useState(''); const [completedKey, setCompletedKey] = useState('');
  const requestKey = [token, claimId, page, revision].join(':'); const busy = completedKey !== requestKey;
  useEffect(() => {
    let live = true;
    void getCommunityHistory(token ? { token } : { claimId: claimId! }, page).then((data) => { if (live) { setEntries(data.entries); setPages(data.pages); setError(''); } }).catch((failure) => { if (live) setError(verificationError(failure)); }).finally(() => { if (live) setCompletedKey(requestKey); });
    return () => { live = false; };
  }, [token, claimId, page, requestKey]);
  return <section aria-label="Community claim history" className="space-y-3"><h2 className="text-lg font-bold">Claim history</h2>{error && <p role="alert">{error}</p>}{entries.map((entry) => <article key={entry._id} className="rounded-xl border border-gray-200 p-4"><p className="font-semibold">{entry.action.replaceAll('_', ' ')} · {claimStatusLabel[entry.toStatus]}</p><p className="mt-1 whitespace-pre-wrap text-sm">{entry.reason}</p><p className="mt-2 text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()} · revision {entry.revision} · {typeof entry.actorId === 'object' ? entry.actorId?.fullName || 'Former account' : 'Account'}</p>{entry.affiliationMethod && <p className="mt-1 text-sm">Affiliation check: {entry.affiliationMethod.replaceAll('_', ' ')}</p>}{entry.affiliationReference && <p className="text-sm">Private review reference: {entry.affiliationReference}</p>}</article>)}{!entries.length && !busy && <p className="text-gray-500">No claim history yet.</p>}<div className="flex items-center gap-4"><button disabled={busy || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous claim history page</button><span>Page {page} of {pages}</span><button disabled={busy || page >= pages} onClick={() => setPage((value) => value + 1)}>Next claim history page</button></div></section>;
}
