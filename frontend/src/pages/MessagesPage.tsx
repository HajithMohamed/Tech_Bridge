import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { getMessages, listConversations, markConversationRead, sendChatMessage, startConversation, type ChatMessage, type Conversation } from '../api/messageApi';
import { createReport } from '../api/reportApi';
import { useAuth } from '../hooks/useAuth';

const MessagesPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const refreshConversations = () => listConversations().then(setConversations).catch(() => setError('Unable to load conversations.'));
  useEffect(() => { void refreshConversations(); const timer = window.setInterval(() => void refreshConversations(), 10_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const state = location.state as { recipientId?: string; conversationId?: string } | null;
    if (state?.conversationId) {
      const timer = window.setTimeout(() => { setSelected(state.conversationId!); window.history.replaceState({}, ''); }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!state?.recipientId) return;
    void startConversation(state.recipientId).then((conversation) => { setSelected(conversation._id); window.history.replaceState({}, ''); }).catch(() => setError('You are not permitted to start a conversation with this person.'));
  }, [location.state]);
  useEffect(() => { if (!selected) return; const refresh = () => getMessages(selected).then(setMessages).then(() => markConversationRead(selected)).catch(() => setError('Unable to load messages.')); void refresh(); const timer = window.setInterval(() => void refresh(), 10_000); return () => window.clearInterval(timer); }, [selected]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!selected || !draft.trim()) return; try { const message = await sendChatMessage(selected, draft); setMessages((items) => [...items, message]); setDraft(''); void refreshConversations(); } catch { setError('Unable to send message.'); } };
  const report = async (message: ChatMessage) => { const reason = window.prompt('Briefly describe the issue with this message:'); if (!reason) return; try { await createReport('message', message._id, reason); window.alert('Report submitted for admin review.'); } catch { setError('Unable to submit report.'); } };
  const active = conversations.find((conversation) => conversation._id === selected);
  return <main className="min-h-[calc(100vh-10rem)] max-w-6xl mx-auto px-4 py-8"><h1 className="text-3xl font-bold text-surface-900">Messages</h1><p className="mt-2 text-gray-600">Private, moderated conversations with your TechBridge connections.</p>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}<div className="mt-6 grid overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:grid-cols-[19rem_1fr] min-h-[34rem]"><aside className="border-b border-gray-200 md:border-b-0 md:border-r"><div className="p-4 font-semibold text-gray-900">Conversations</div>{conversations.map((conversation) => <button key={conversation._id} onClick={() => setSelected(conversation._id)} className={`block w-full border-t border-gray-100 p-4 text-left ${selected === conversation._id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}><div className="flex justify-between gap-2"><span className="font-semibold text-sm text-gray-900 truncate">{conversation.otherParticipant?.fullName || 'TechBridge member'}</span>{conversation.unreadCount > 0 && <span className="rounded-full bg-primary-600 px-2 text-xs text-white">{conversation.unreadCount}</span>}</div><p className="mt-1 truncate text-xs text-gray-500">{conversation.lastMessagePreview || 'Start a conversation'}</p></button>)}{!conversations.length && <p className="p-4 text-sm text-gray-500">Use the Community directory to start a permitted conversation.</p>}</aside><section className="flex min-h-96 flex-col"><header className="border-b border-gray-100 p-4 font-semibold text-gray-900">{active?.otherParticipant?.fullName || 'Select a conversation'}</header><div className="flex-1 space-y-3 overflow-y-auto bg-surface-50 p-4">{messages.map((message) => <div key={message._id} className={`group flex ${message.senderId === user?._id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${message.senderId === user?._id ? 'bg-primary-600 text-white' : 'bg-white text-gray-800 shadow-sm'}`}><p>{message.content}</p><div className="mt-1 flex items-center gap-2 text-[10px] opacity-70"><span>{new Date(message.createdAt).toLocaleString('en-LK')}</span>{message.senderId !== user?._id && <button onClick={() => void report(message)} className="hidden underline group-hover:inline">Report</button>}</div></div></div>)}</div>{selected && <form onSubmit={submit} className="flex gap-2 border-t border-gray-100 p-4"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Write a message…" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500" /><button className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white">Send</button></form>}</section></div></main>;
};

export default MessagesPage;
