import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { assertContactPreferences, escapedSearch, messageId, messagePage, messagePreferences, messageText } from '../../src/services/messagingPolicy';
import { participant } from '../../src/services/messaging';

describe('messaging input and pagination policy', () => {
  it('normalizes ordinary text while preserving newlines and Unicode', () => expect(messageText('  Hello\nලෝකය  ')).toBe('Hello\nලෝකය'));
  it.each([undefined, null, {}, ['hello'], 1, '', '   ', 'a'.repeat(2001), 'hidden\u0000text', 'escape\u001btext'])('rejects invalid content %j', (value) => expect(() => messageText(value)).toThrow());
  it('accepts exactly 2000 characters', () => expect(messageText('a'.repeat(2000))).toHaveLength(2000));
  it.each(['', '123', {}, ['000000000000000000000001'], 'z'.repeat(24)])('rejects invalid IDs %j', (value) => expect(() => messageId(value)).toThrow());
  it('accepts a canonical hexadecimal ID', () => expect(String(messageId('000000000000000000000001'))).toBe('000000000000000000000001'));
  it.each(['0', '-1', '1.5', '1garbage', '10000', {}, ['1']])('rejects invalid pages %j', (value) => expect(() => messagePage(value)).toThrow());
  it('bounds and defaults pagination', () => { expect(messagePage(undefined)).toBe(1); expect(messagePage('9999')).toBe(9999); });
  it.each([null, [], {}, { acceptsMessages: 'false', notifications: true }, { acceptsMessages: true, notifications: true, ownerId: 'another-user' }])('rejects preference mass assignment %j', (value) => expect(() => messagePreferences(value)).toThrow());
  it('requires explicit boolean preferences', () => expect(messagePreferences({ acceptsMessages: false, notifications: true })).toEqual({ acceptsMessages: false, notifications: true }));
  it('escapes regex metacharacters rather than interpreting a search expression', () => { expect(escapedSearch('(.*)')).toBe('\\(\\.\\*\\)'); expect(escapedSearch(undefined)).toBe(''); });
  it('only recognizes exact conversation participants, without an administrative bypass', () => {
    const first = new Types.ObjectId(); const second = new Types.ObjectId(); expect(participant({ participantIds: [first, second] }, first)).toBe(true); expect(participant({ participantIds: [first, second] }, new Types.ObjectId())).toBe(false);
  });
  it.each(['sender', 'recipient'])('applies a %s block in both messaging directions', (blocker) => {
    const first = new Types.ObjectId(); const second = new Types.ObjectId(); const settings = [{ ownerId: blocker === 'sender' ? first : second, acceptsMessages: true, blockedIds: [blocker === 'sender' ? second : first] }]; expect(() => assertContactPreferences(settings, first, second)).toThrow(); expect(() => assertContactPreferences(settings, second, first)).toThrow();
  });
  it('defaults absent preferences to permitted contact and honors receiving-only opt-out', () => {
    const first = new Types.ObjectId(); const second = new Types.ObjectId(); expect(() => assertContactPreferences([], first, second)).not.toThrow(); const settings = [{ ownerId: second, acceptsMessages: false, blockedIds: [] }]; expect(() => assertContactPreferences(settings, first, second)).toThrow(); expect(() => assertContactPreferences(settings, second, first)).not.toThrow();
  });
});
