import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { blockMessagingUser, fetchConversations, fetchMessages, fetchMessagingSettings, markConversationRead, saveMessagingSettings, sendChatMessage, sendTyping, startConversation, type ChatMessage, type ConversationPage, type MessagingSettings } from '../api/messageApi';
import { MESSAGE_SIGNAL, type MessageSignal } from '../api/messageStream';
import { createReport } from '../api/reportApi';
import { useAuth } from '../hooks/useAuth';

const mergeMessages = (older: ChatMessage[], newer: ChatMessage[]) => [...new Map([...older, ...newer].map((item) => [item._id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id));
type History = { id: string; messages: ChatMessage[]; nextBefore: string | null; hasMore: boolean };
export default function MessagesPage() {
  const { user } = useAuth(); const location = useLocation();
  const [page, setPage] = useState(1); const [query, setQuery] = useState(''); const [search, setSearch] = useState('');
  const [list, setList] = useState<ConversationPage>({ conversations: [], page: 1, pages: 1, total: 0 });
  const [selected, setSelected] = useState(''); const [history, setHistory] = useState<History>({ id: '', messages: [], nextBefore: null, hasMore: false });
  const [draft, setDraft] = useState({ id: '', value: '' }); const [sending, setSending] = useState(''); const [olderLoading, setOlderLoading] = useState(false);
  const [settings, setSettings] = useState<MessagingSettings | null>(null); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [report, setReport] = useState<ChatMessage | null>(null); const [reason, setReason] = useState(''); const [reporting, setReporting] = useState(false);
  const [typingFor, setTypingFor] = useState(''); const lastTyping = useRef(0); const preferencesDirty = useRef(false);
  const select = (id: string) => { setSelected(id); setError(''); setReport(null); setReason(''); };

  useEffect(() => {
    let cancelled = false; let busy = false; let refreshPending = false;
    const refresh = async () => {
      if (cancelled) return;
      if (busy) { refreshPending = true; return; } busy = true;
      try { const result = await fetchConversations(page, query); if (!cancelled) setList(result); }
      catch { if (!cancelled) setError('Unable to load conversations.'); } finally {
        busy = false;
        if (refreshPending) { refreshPending = false; void refresh(); }
      }
    };
    void refresh(); const changed = (event?: Event) => { if ((event as CustomEvent<MessageSignal> | undefined)?.detail?.type !== 'typing') void refresh(); }; window.addEventListener(MESSAGE_SIGNAL, changed);
    const timer = setInterval(changed, 30_000);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener(MESSAGE_SIGNAL, changed); };
  }, [page, query]);
  useEffect(() => {
    let cancelled = false;
    const refresh = (event?: Event) => { if ((event as CustomEvent<MessageSignal> | undefined)?.detail?.type === 'typing') return; void fetchMessagingSettings().then((value) => { if (!cancelled) setSettings((current) => preferencesDirty.current && current ? { ...current, blockedUsers: value.blockedUsers } : value); }).catch(() => { if (!cancelled) setError('Unable to load messaging preferences.'); }); };
    refresh(); window.addEventListener(MESSAGE_SIGNAL, refresh);
    return () => { cancelled = true; window.removeEventListener(MESSAGE_SIGNAL, refresh); };
  }, []);
  useEffect(() => {
    const state = location.state as { recipientId?: string; conversationId?: string } | null;
    let cancelled = false;
    if (state?.conversationId) { const timer = setTimeout(() => { select(state.conversationId!); window.history.replaceState({}, ''); }, 0); return () => clearTimeout(timer); }
    if (!state?.recipientId) return;
    void startConversation(state.recipientId).then((conversation) => { if (!cancelled) { select(conversation._id); window.history.replaceState({}, ''); window.dispatchEvent(new CustomEvent(MESSAGE_SIGNAL, { detail: { type: 'refresh' } })); } }).catch(() => { if (!cancelled) setError('You are not permitted to start a conversation with this person.'); });
    return () => { cancelled = true; };
  }, [location.state]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false; let busy = false; let refreshPending = false; let typingTimer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (cancelled) return;
      if (busy) { refreshPending = true; return; } busy = true;
      try {
        const result = await fetchMessages(selected); if (cancelled) return;
        setHistory((current) => {
          const shared = current.messages.some((item) => result.messages.some((next) => next._id === item._id));
          if (current.id !== selected || !shared) return { id: selected, ...result };
          return { ...current, messages: mergeMessages(current.messages, result.messages) };
        });
        if (document.visibilityState === 'visible' && result.messages.length) await markConversationRead(selected, result.messages.at(-1)!._id);
      } catch { if (!cancelled) setError('Unable to load messages.'); } finally {
        busy = false;
        if (refreshPending) { refreshPending = false; void refresh(); }
      }
    };
    const changed = (event: Event) => {
      const signal = (event as CustomEvent<MessageSignal>).detail;
      if (signal?.type === 'typing') {
        if (signal.conversationId === selected && signal.expiresAt > Date.now()) { setTypingFor(selected); clearTimeout(typingTimer); typingTimer = setTimeout(() => setTypingFor(''), Math.min(4000, signal.expiresAt - Date.now())); }
      } else void refresh();
    };
    void refresh(); window.addEventListener(MESSAGE_SIGNAL, changed);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible); const timer = setInterval(() => void refresh(), 30_000);
    return () => { cancelled = true; clearTimeout(typingTimer); clearInterval(timer); window.removeEventListener(MESSAGE_SIGNAL, changed); document.removeEventListener('visibilitychange', visible); };
  }, [selected]);
  const messages = history.id === selected ? history.messages : [];
  const active = list.conversations.find((item) => item._id === selected);
  const blocked = settings?.blockedUsers.some((item) => item._id === active?.otherParticipant?._id) || false;
  const text = draft.id === selected ? draft.value : '';
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || !text.trim() || sending) return; const id = selected; setSending(id); setError('');
    try {
      const message = await sendChatMessage(id, text);
      setHistory((current) => current.id === id ? { ...current, messages: mergeMessages(current.messages, [message]) } : current);
      setDraft((current) => current.id === id ? { id, value: '' } : current);
      window.dispatchEvent(new CustomEvent(MESSAGE_SIGNAL, { detail: { type: 'refresh' } }));
    } catch { setError('Unable to send message.'); } finally { setSending(''); }
  };
  const older = async () => {
    if (olderLoading || history.id !== selected || !history.nextBefore) return;
    const id = selected; const before = history.nextBefore; setOlderLoading(true);
    try { const result = await fetchMessages(id, before); setHistory((current) => current.id === id ? { ...current, messages: mergeMessages(result.messages, current.messages), nextBefore: result.nextBefore, hasMore: result.hasMore } : current); }
    catch { setError('Unable to load older messages.'); } finally { setOlderLoading(false); }
  };
  const toggleBlock = async (id: string, block: boolean) => {
    setSaving(true); setError('');
    try { await blockMessagingUser(id, block); setSettings(await fetchMessagingSettings()); setNotice(block ? 'Member blocked. Existing history is retained.' : 'Member unblocked. Current messaging permissions still apply.'); }
    catch { setError('Unable to update blocking preferences.'); } finally { setSaving(false); }
  };
  const preferences = async (event: FormEvent) => {
    event.preventDefault(); if (!settings) return; setSaving(true); setError('');
    try { await saveMessagingSettings({ acceptsMessages: settings.acceptsMessages, notifications: settings.notifications }); preferencesDirty.current = false; setNotice('Messaging preferences saved.'); window.dispatchEvent(new CustomEvent(MESSAGE_SIGNAL, { detail: { type: 'refresh' } })); }
    catch { setError('Unable to save messaging preferences.'); } finally { setSaving(false); }
  };
  const submitReport = async (event: FormEvent) => {
    event.preventDefault(); if (!report || reporting) return; setReporting(true);
    try { await createReport('message', report._id, reason); setReport(null); setReason(''); setNotice('Report submitted. An authorized reviewer may access only the reported message.'); }
    catch { setError('Unable to submit report.'); } finally { setReporting(false); }
  };
  return <main className="mx-auto max-w-6xl px-4 py-8">
    <h1 className="text-3xl font-bold text-surface-900">Messages</h1><p className="mt-2 text-gray-600">Private conversations with your permitted TechBridge connections.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-primary-50 p-3 text-primary-800">{notice}</p>}
    <details className="mt-5 rounded-xl border border-gray-200 bg-white p-4"><summary className="cursor-pointer font-semibold">Communication preferences</summary>{settings && <form onSubmit={preferences} className="mt-3 space-y-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.acceptsMessages} onChange={(event) => { preferencesDirty.current = true; setSettings({ ...settings, acceptsMessages: event.target.checked }); }} />Accept messages from permitted connections</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.notifications} onChange={(event) => { preferencesDirty.current = true; setSettings({ ...settings, notifications: event.target.checked }); }} />Show in-app unread message notices</label><button disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Save messaging preferences</button><p className="text-gray-500">Community members also control student messaging through their verified profile.</p></form>}{settings?.blockedUsers.map((member) => <div key={member._id} className="mt-3 flex items-center justify-between gap-3 text-sm"><span>{member.fullName}</span><button disabled={saving} onClick={() => void toggleBlock(member._id, false)} className="font-semibold text-primary-700">Unblock {member.fullName}</button></div>)}</details>
    <div className="mt-6 grid min-h-[34rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="border-b border-gray-200 md:border-b-0 md:border-r"><form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(1); }} className="flex gap-2 p-4"><input aria-label="Search conversations" placeholder="Search connections" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={80} className="min-w-0 flex-1 rounded-lg border border-gray-200 p-2 text-sm" /><button className="text-sm font-semibold text-primary-700">Search</button></form>
        {list.conversations.map((item) => <button key={item._id} onClick={() => select(item._id)} aria-pressed={selected === item._id} className={`block w-full border-t border-gray-100 p-4 text-left ${selected === item._id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}><span className="flex justify-between gap-2"><span className="truncate text-sm font-semibold text-gray-900">{item.otherParticipant?.fullName || 'Unavailable member'}</span>{item.unreadCount > 0 && <span aria-label={`${item.unreadCount} unread messages`} className="rounded-full bg-primary-600 px-2 text-xs text-white">{item.unreadCount}</span>}</span><span className="mt-1 block truncate text-xs text-gray-500">{item.lastMessagePreview || 'Start a conversation'}</span></button>)}
        {!list.conversations.length && <p className="p-4 text-sm text-gray-500">No conversations found. Start from a permitted connection.</p>}
        <nav aria-label="Conversation pages" className="flex items-center justify-between gap-2 p-4 text-sm"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Previous</button><span>{list.page} / {list.pages}</span><button disabled={page >= list.pages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next</button></nav>
      </aside>
      <section aria-label="Conversation" className="flex min-h-96 min-w-0 flex-col"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 font-semibold text-gray-900"><span>{active?.otherParticipant?.fullName || (selected ? 'Your conversation' : 'Select a conversation')}</span>{active?.otherParticipant && <button disabled={saving} onClick={() => void toggleBlock(active.otherParticipant!._id, !blocked)} className="text-sm font-semibold text-primary-700">{blocked ? 'Unblock member' : 'Block member'}</button>}</header>
        <div className="max-h-[32rem] min-h-60 flex-1 space-y-3 overflow-y-auto bg-surface-50 p-4">{history.id === selected && history.hasMore && <button onClick={() => void older()} disabled={olderLoading} className="w-full text-sm font-semibold text-primary-700 disabled:opacity-40">{olderLoading ? 'Loading older messages…' : 'Load older messages'}</button>}
          {messages.map((message) => <div key={message._id} className={`flex ${message.senderId === user?._id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] break-words rounded-2xl px-4 py-2 text-sm sm:max-w-[80%] ${message.senderId === user?._id ? 'bg-primary-600 text-white' : 'bg-white text-gray-800 shadow-sm'}`}><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-80"><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('en-LK')}</time>{message.senderId === user?._id ? <span>{message.readAt ? 'Read' : 'Sent'}</span> : <button onClick={() => { setReport(message); setReason(''); }} className="underline">Report message</button>}</div></div></div>)}
        </div>{typingFor === selected && selected && <p role="status" className="px-4 py-2 text-xs text-gray-500">Your connection is typing…</p>}
        {report && <form onSubmit={submitReport} className="space-y-2 border-t border-gray-200 p-4"><p className="text-sm text-gray-600">Only this message will be available to an authorized reviewer. Your conversation history stays private.</p><label className="block text-sm font-semibold">Report reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={1000} required className="mt-1 block w-full rounded-lg border border-gray-200 p-2" /></label><div className="flex gap-4"><button disabled={reporting} className="text-sm font-semibold text-primary-700">Submit message report</button><button type="button" onClick={() => setReport(null)} className="text-sm text-gray-600">Cancel report</button></div></form>}
        {selected && <form onSubmit={submit} className="flex gap-2 border-t border-gray-100 p-4"><input aria-label="Message" value={text} disabled={blocked || sending === selected} onChange={(event) => { setDraft({ id: selected, value: event.target.value }); if (event.target.value.trim() && Date.now() - lastTyping.current > 2500) { lastTyping.current = Date.now(); void sendTyping(selected).catch(() => undefined); } }} maxLength={2000} placeholder={blocked ? 'Unblock this member to send' : 'Write a message…'} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500" /><button disabled={blocked || Boolean(sending) || !text.trim()} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending === selected ? 'Sending…' : 'Send'}</button></form>}
      </section>
    </div>
  </main>;
}
