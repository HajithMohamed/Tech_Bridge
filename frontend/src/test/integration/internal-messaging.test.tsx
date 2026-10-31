import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import MessagesPage from '../../pages/MessagesPage';
import MessageComplaintReview from '../../components/admin/MessageComplaintReview';
import { MESSAGE_SIGNAL } from '../../api/messageStream';
import * as streamApi from '../../api/messageStream';
import MessageUpdates from '../../components/MessageUpdates';
import { apiUrl, server } from '../mocks/server';
import type { ChatMessage, MessagingSettings } from '../../api/messageApi';
import type { Report } from '../../api/adminApi';

const id = '000000000000000000000012'; const otherId = '000000000000000000000002';
const incoming = (suffix = '1', content = 'Private incoming message'): ChatMessage => ({ _id: `10000000000000000000000${suffix}`, conversationId: id, senderId: otherId, content, createdAt: '2026-01-01T12:00:00.000Z' });
const conversation = { _id: id, otherParticipant: { _id: otherId, fullName: 'Synthetic Provider', role: 'provider' }, lastMessagePreview: 'Private incoming message', unreadCount: 1 };
function handlers() {
  let settings: MessagingSettings = { acceptsMessages: true, notifications: true, blockedUsers: [] };
  server.use(
    http.get(apiUrl('/messages/conversations'), () => HttpResponse.json({ data: { conversations: [conversation], page: 1, pages: 1, total: 1 } })),
    http.get(apiUrl(`/messages/conversations/${id}/messages`), () => HttpResponse.json({ data: { messages: [incoming()], hasMore: false, nextBefore: null } })),
    http.patch(apiUrl(`/messages/conversations/${id}/read`), () => HttpResponse.json({ success: true })),
    http.post(apiUrl(`/messages/conversations/${id}/typing`), () => HttpResponse.json({ success: true })),
    http.get(apiUrl('/messages/settings'), () => HttpResponse.json({ data: settings })),
    http.put(apiUrl('/messages/settings'), async ({ request }) => { settings = { ...settings, ...await request.json() as object }; return HttpResponse.json({ success: true }); }),
    http.put(apiUrl(`/messages/blocks/${otherId}`), () => { settings.blockedUsers = [{ _id: otherId, fullName: 'Synthetic Provider' }]; return HttpResponse.json({ success: true }); }),
    http.delete(apiUrl(`/messages/blocks/${otherId}`), () => { settings.blockedUsers = []; return HttpResponse.json({ success: true }); }),
  );
}
function mount() {
  localStorage.setItem('techbridge_token', 'synthetic-session-token');
  return render(<MemoryRouter initialEntries={[{ pathname: '/messages', state: { conversationId: id } }]}><AuthProvider><MessagesPage /></AuthProvider></MemoryRouter>);
}
const signal = (detail: object = { type: 'refresh' }) => act(() => window.dispatchEvent(new CustomEvent(MESSAGE_SIGNAL, { detail })));

describe('messaging UI using real HTTP clients', () => {
  it('refreshes a read receipt signaled while history is still loading', async () => {
    handlers(); let release!: () => void; let requests = 0;
    const sent = { ...incoming(), senderId: '000000000000000000000001' };
    server.use(http.get(apiUrl(`/messages/conversations/${id}/messages`), async () => {
      const first = ++requests === 1;
      if (first) await new Promise<void>((resolve) => { release = resolve; });
      return HttpResponse.json({ data: { messages: [{ ...sent, ...(first ? {} : { readAt: '2026-01-01T12:01:00Z' }) }], hasMore: false, nextBefore: null } });
    }));
    mount(); await waitFor(() => expect(requests).toBe(1));
    signal(); signal(); release();
    expect(await screen.findByText('Read', { exact: true })).toBeVisible();
    expect(requests).toBe(2);
  });
  it('refreshes unread conversation counts signaled while the list is loading', async () => {
    handlers(); let release!: () => void; let requests = 0;
    server.use(http.get(apiUrl('/messages/conversations'), async () => {
      const first = ++requests === 1;
      if (first) await new Promise<void>((resolve) => { release = resolve; });
      return HttpResponse.json({ data: { conversations: [{ ...conversation, unreadCount: first ? 1 : 0 }], page: 1, pages: 1, total: 1 } });
    }));
    mount(); await waitFor(() => expect(requests).toBe(1));
    signal(); signal(); release();
    await screen.findByRole('button', { name: /Synthetic Provider/ });
    await waitFor(() => expect(requests).toBe(2));
    await waitFor(() => expect(screen.queryByLabelText('1 unread messages')).not.toBeInTheDocument());
  });
  it('loads older history, preserves it during live refresh and displays read receipts', async () => {
    handlers(); let live = false;
    server.use(http.get(apiUrl(`/messages/conversations/${id}/messages`), ({ request }) => {
      const older = new URL(request.url).searchParams.get('before');
      return HttpResponse.json({ data: older ? { messages: [incoming('0', 'Older history')], hasMore: false, nextBefore: null } : { messages: [incoming(), ...(live ? [{ ...incoming('2', 'New live reply'), senderId: '000000000000000000000001', readAt: '2026-01-01T12:01:00Z' }] : [])], hasMore: true, nextBefore: incoming()._id } });
    }));
    const user = userEvent.setup(); mount(); await screen.findByText('Private incoming message', { selector: 'p' }); await user.click(screen.getByRole('button', { name: 'Load older messages' })); await screen.findByText('Older history');
    live = true; signal(); await screen.findByText('New live reply'); expect(screen.getByText('Older history')).toBeVisible(); expect(screen.getByText('Read', { exact: true })).toBeVisible(); expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
  });
  it('prevents duplicate submissions while a send is pending and preserves the draft on failure', async () => {
    handlers(); let finish!: () => void; let calls = 0;
    server.use(http.post(apiUrl(`/messages/conversations/${id}/messages`), async () => { calls++; await new Promise<void>((resolve) => { finish = resolve; }); return HttpResponse.json({ message: 'Blocked connection.' }, { status: 403 }); }));
    const user = userEvent.setup(); mount(); const input = await screen.findByLabelText('Message'); await user.type(input, 'Keep my unsent draft'); await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(calls).toBe(1)); expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled(); finish(); expect(await screen.findByRole('alert')).toHaveTextContent('Unable to send message.'); expect(input).toHaveValue('Keep my unsent draft');
  });
  it('blocks and unblocks the active member without removing private history', async () => {
    handlers(); const user = userEvent.setup(); mount(); await screen.findByText('Private incoming message', { selector: 'p' }); await user.click(await screen.findByRole('button', { name: 'Block member' }));
    await screen.findByText('Member blocked. Existing history is retained.'); expect(screen.getByLabelText('Message')).toBeDisabled(); expect(screen.getByText('Private incoming message', { selector: 'p' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Unblock member' })); await waitFor(() => expect(screen.getByLabelText('Message')).toBeEnabled());
  });
  it('saves only explicit preferences and does not overwrite unsaved choices during live refresh', async () => {
    handlers(); let payload: unknown;
    server.use(http.put(apiUrl('/messages/settings'), async ({ request }) => { payload = await request.json(); return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); mount(); await user.click(screen.getByText('Communication preferences')); const checkbox = await screen.findByLabelText('Accept messages from permitted connections'); await user.click(checkbox); signal();
    await waitFor(() => expect(checkbox).not.toBeChecked()); await user.click(screen.getByRole('button', { name: 'Save messaging preferences' })); await screen.findByText('Messaging preferences saved.'); expect(payload).toEqual({ acceptsMessages: false, notifications: true });
  });
  it('submits only the selected incoming message and explains the evidence boundary', async () => {
    handlers(); let payload: unknown; server.use(http.post(apiUrl('/reports'), async ({ request }) => { payload = await request.json(); return HttpResponse.json({ success: true }, { status: 201 }); }));
    const user = userEvent.setup(); mount(); await user.click(await screen.findByRole('button', { name: 'Report message' })); expect(screen.getByText(/Only this message will be available/)).toBeVisible(); await user.type(screen.getByLabelText('Report reason'), 'Synthetic harmful message complaint.'); await user.click(screen.getByRole('button', { name: 'Submit message report' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Report submitted.'); expect(payload).toEqual({ targetType: 'message', targetId: incoming()._id, reason: 'Synthetic harmful message complaint.' });
  });
  it('searches names using a bounded explicit query', async () => {
    handlers(); let query = '';
    server.use(http.get(apiUrl('/messages/conversations'), ({ request }) => { query = new URL(request.url).searchParams.get('q') || ''; return HttpResponse.json({ data: { conversations: query ? [] : [conversation], page: 1, total: query ? 0 : 1, pages: 1 } }); }));
    const user = userEvent.setup(); mount(); await user.type(screen.getByLabelText('Search conversations'), 'Absent provider'); await user.click(screen.getByRole('button', { name: 'Search' })); await screen.findByText(/No conversations found/); expect(query).toBe('Absent provider');
  });
  it('shows typing only for the selected conversation', async () => {
    handlers(); mount(); await screen.findByLabelText('Message'); signal({ type: 'typing', conversationId: 'other', expiresAt: Date.now() + 4000 }); expect(screen.queryByText('Your connection is typing…')).not.toBeInTheDocument(); signal({ type: 'typing', conversationId: id, expiresAt: Date.now() + 4000 }); expect(screen.getByText('Your connection is typing…')).toBeVisible();
  });
  it('ignores an old history response after the user selects a different conversation', async () => {
    handlers(); const nextId = '000000000000000000000013'; let release!: () => void; let started = false;
    server.use(http.get(apiUrl('/messages/conversations'), () => HttpResponse.json({ data: { conversations: [conversation, { ...conversation, _id: nextId, otherParticipant: { ...conversation.otherParticipant, fullName: 'Another permitted connection' } }], page: 1, pages: 1, total: 2 } })),
      http.get(apiUrl(`/messages/conversations/${id}/messages`), async () => { started = true; await new Promise<void>((resolve) => { release = resolve; }); return HttpResponse.json({ data: { messages: [incoming('1', 'Stale private response')], hasMore: false, nextBefore: null } }); }),
      http.get(apiUrl(`/messages/conversations/${nextId}/messages`), () => HttpResponse.json({ data: { messages: [{ ...incoming('2', 'Current selected history'), conversationId: nextId }], hasMore: false, nextBefore: null } })),
      http.patch(apiUrl(`/messages/conversations/${nextId}/read`), () => HttpResponse.json({ success: true })));
    const user = userEvent.setup(); mount(); await waitFor(() => expect(started).toBe(true)); await user.click(await screen.findByRole('button', { name: /Another permitted connection/ })); await screen.findByText('Current selected history'); release(); await act(async () => { await Promise.resolve(); }); expect(screen.queryByText('Stale private response')).not.toBeInTheDocument(); expect(screen.getByText('Current selected history')).toBeVisible();
  });
});

describe('administrator complaint review UI', () => {
  it('requires an access reason, displays the exact evidence and gates resolution', async () => {
    let payload: unknown; let resolved = false;
    const report: Report = { _id: '000000000000000000000099', targetType: 'message', targetId: incoming()._id, reason: 'Synthetic complaint', reporterId: 'student', status: 'open', createdAt: '2026-01-01' };
    server.use(http.post(apiUrl(`/admin/reports/${report._id}/message-evidence`), async ({ request }) => { payload = await request.json(); return HttpResponse.json({ data: { message: incoming() } }); }), http.patch(apiUrl(`/admin/reports/${report._id}`), () => { resolved = true; return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); render(<MessageComplaintReview report={report} onResolved={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Resolve message complaint' })).toBeDisabled(); await user.type(screen.getByLabelText('Reason for accessing complaint evidence'), 'Investigating the exact reported message.'); await user.click(screen.getByRole('button', { name: 'Record access and view reported message' })); await screen.findByText('Private incoming message'); expect(payload).toEqual({ reason: 'Investigating the exact reported message.' });
    await user.type(screen.getByLabelText('Message complaint resolution note'), 'Reviewed the disclosed evidence and recorded a decision.'); await user.click(screen.getByRole('button', { name: 'Resolve message complaint' })); await waitFor(() => expect(resolved).toBe(true)); expect(within(screen.getByRole('button', { name: 'Dismiss message complaint' })).queryByText('Private incoming message')).not.toBeInTheDocument();
  });
});

describe('in-app messaging notices', () => {
  it('refreshes the unread notice when a signal arrives during the initial summary request', async () => {
    let notify!: (signal: streamApi.MessageSignal) => void; let release!: () => void; let requests = 0;
    vi.spyOn(streamApi, 'consumeMessageStream').mockImplementation(async (_token, signal, callback) => { notify = callback; await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })); });
    server.use(http.get(apiUrl('/messages/summary'), async () => {
      const first = ++requests === 1;
      if (first) await new Promise<void>((resolve) => { release = resolve; });
      return HttpResponse.json({ data: { unread: first ? 3 : 1, notifications: true } });
    }));
    localStorage.setItem('techbridge_token', 'synthetic-session-token'); render(<MemoryRouter><AuthProvider><MessageUpdates /></AuthProvider></MemoryRouter>);
    await waitFor(() => expect(requests).toBe(1));
    act(() => { notify({ type: 'refresh' }); notify({ type: 'refresh' }); }); release();
    expect(await screen.findByRole('link', { name: 'New messages: 1' })).toBeVisible();
    expect(requests).toBe(2);
  });
  it('shows an unread link and respects an updated notification preference', async () => {
    let notify!: (signal: streamApi.MessageSignal) => void; let notifications = true;
    vi.spyOn(streamApi, 'consumeMessageStream').mockImplementation(async (_token, signal, callback) => { notify = callback; await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })); });
    server.use(http.get(apiUrl('/messages/summary'), () => HttpResponse.json({ data: { unread: 3, notifications } })));
    localStorage.setItem('techbridge_token', 'synthetic-session-token'); render(<MemoryRouter><AuthProvider><MessageUpdates /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'New messages: 3' })).toHaveAttribute('href', '/messages'); notifications = false; act(() => notify({ type: 'refresh' })); await waitFor(() => expect(screen.queryByRole('link', { name: 'New messages: 3' })).not.toBeInTheDocument());
  });
});
