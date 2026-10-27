import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchMessagingSummary } from '../api/messageApi';
import { consumeMessageStream, MESSAGE_SIGNAL } from '../api/messageStream';

export default function MessageUpdates() {
  const { token, user } = useAuth(); const [notice, setNotice] = useState({ owner: '', count: 0 });
  useEffect(() => {
    if (!token || !user) return;
    let stopped = false; let reconnect: ReturnType<typeof setTimeout>; let loading = false; let refreshPending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (stopped) return;
      if (loading) { refreshPending = true; return; } loading = true;
      try { const summary = await fetchMessagingSummary(); if (!stopped) setNotice({ owner: user._id, count: summary.notifications ? summary.unread : 0 }); }
      catch { if (!stopped) setNotice({ owner: user._id, count: 0 }); } finally {
        loading = false;
        if (refreshPending) { refreshPending = false; void refresh(); }
      }
    };
    const connect = async () => {
      try { await consumeMessageStream(token, controller.signal, (event) => {
        if (stopped) return;
        window.dispatchEvent(new CustomEvent(MESSAGE_SIGNAL, { detail: event }));
        if (event.type === 'refresh') void refresh();
      }); } catch { /* Periodic API refresh remains available during disconnects. */ }
      if (!stopped) reconnect = setTimeout(() => void connect(), 5000);
    };
    void connect(); void refresh();
    const timer = setInterval(() => { void refresh(); window.dispatchEvent(new CustomEvent(MESSAGE_SIGNAL, { detail: { type: 'refresh' } })); }, 30_000);
    return () => { stopped = true; controller.abort(); clearTimeout(reconnect); clearInterval(timer); };
  }, [token, user]);
  return token && user && notice.owner === user._id && notice.count > 0 ? <Link to="/messages" className="fixed bottom-4 right-4 z-40 rounded-full bg-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-lg"><span role="status">New messages: {notice.count}</span></Link> : null;
}
