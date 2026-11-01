export type MessageSignal = { type: 'refresh' } | { type: 'typing'; conversationId: string; expiresAt: number };
export const MESSAGE_SIGNAL = 'techbridge:messages';

/** Fetch keeps the bearer token in a header; native EventSource cannot set it. */
export async function consumeMessageStream(token: string, signal: AbortSignal, onSignal: (event: MessageSignal) => void) {
  const response = await fetch('/api/messages/events', { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' });
  if (!response.ok || !response.body) throw new Error('Live updates disconnected.');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  try {
    while (!signal.aborted) {
      const next = await reader.read(); if (next.done) return;
      buffer += decoder.decode(next.value, { stream: true });
      if (buffer.length > 8192) throw new Error('Invalid message event.');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        if (!frame.startsWith('data: ')) continue;
        const event = JSON.parse(frame.slice(6)) as MessageSignal;
        if (event.type === 'refresh' || (event.type === 'typing' && /^[a-f\d]{24}$/i.test(event.conversationId) && Number.isFinite(event.expiresAt))) onSignal(event);
      }
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
