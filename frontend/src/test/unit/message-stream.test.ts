import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeMessageStream } from '../../api/messageStream';

afterEach(() => vi.unstubAllGlobals());
describe('authenticated message stream framing', () => {
  it('reads split frames and sends the bearer token only in a header', async () => {
    const encoder = new TextEncoder(); const received: unknown[] = [];
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(controller) {
      for (const chunk of ['data: {"type":', '"refresh"}\n\ndata: {"type":"typing","conversationId":"000000000000000000000012",', '"expiresAt":123}\n\n']) controller.enqueue(encoder.encode(chunk)); controller.close();
    } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock); await consumeMessageStream('private-session', new AbortController().signal, (event) => received.push(event));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/messages/events'); expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer private-session'); expect(received).toEqual([{ type: 'refresh' }, { type: 'typing', conversationId: '000000000000000000000012', expiresAt: 123 }]);
  });
  it('fails a rejected session instead of processing an error as events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))); await expect(consumeMessageStream('invalid', new AbortController().signal, () => undefined)).rejects.toThrow('disconnected');
  });
  it('ignores arbitrary room/event data and bounds frame buffers', async () => {
    const encoder = new TextEncoder(); const received: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode('data: {"type":"typing","conversationId":"bad","expiresAt":1}\n\n')); controller.enqueue(encoder.encode('x'.repeat(8193))); controller.close(); } }))));
    await expect(consumeMessageStream('token', new AbortController().signal, (event) => received.push(event))).rejects.toThrow('Invalid'); expect(received).toEqual([]);
  });
});
