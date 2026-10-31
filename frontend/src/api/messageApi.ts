import api from './axios';

export interface Conversation {
  _id: string;
  lastMessageAt?: string;
  otherParticipant?: { _id: string; fullName: string; role: string; providerProfile?: { organizationName?: string; organizationType?: string } };
  lastMessagePreview: string;
  unreadCount: number;
  blockedByMe?: boolean;
}

export interface ChatMessage { _id: string; conversationId: string; senderId: string; content: string; createdAt: string; readAt?: string; }
export interface ConversationPage { conversations: Conversation[]; page: number; total: number; pages: number }
export interface MessagePage { messages: ChatMessage[]; hasMore: boolean; nextBefore: string | null }
export interface MessagingSettings { acceptsMessages: boolean; notifications: boolean; blockedUsers: { _id: string; fullName: string }[] }
export interface CommunityPerson { _id: string; fullName: string; providerProfile?: { organizationName?: string; organizationType?: 'faculty' | 'alumni'; description?: string } }

export const listConversations = async () => (await api.get<{ data: { conversations: Conversation[] } }>('/messages/conversations')).data.data.conversations;
export const fetchConversations = async (page = 1, q = '') => (await api.get<{ data: ConversationPage }>('/messages/conversations', { params: { page, q } })).data.data;
export const fetchMessages = async (id: string, before?: string) => (await api.get<{ data: MessagePage }>(`/messages/conversations/${id}/messages`, { params: { before } })).data.data;
export const getMessages = async (id: string) => (await api.get<{ data: { messages: ChatMessage[] } }>(`/messages/conversations/${id}/messages`)).data.data.messages;
export const sendChatMessage = async (id: string, content: string) => (await api.post<{ data: { message: ChatMessage } }>(`/messages/conversations/${id}/messages`, { content })).data.data.message;
export const markConversationRead = async (id: string, throughId?: string) => { await api.patch(`/messages/conversations/${id}/read`, { throughId }); };
export const fetchMessagingSettings = async () => (await api.get<{ data: MessagingSettings }>('/messages/settings')).data.data;
export const saveMessagingSettings = async (values: Pick<MessagingSettings, 'acceptsMessages' | 'notifications'>) => { await api.put('/messages/settings', values); };
export const blockMessagingUser = async (id: string, block: boolean) => { if (block) await api.put(`/messages/blocks/${id}`); else await api.delete(`/messages/blocks/${id}`); };
export const sendTyping = async (id: string) => { await api.post(`/messages/conversations/${id}/typing`); };
export const fetchMessagingSummary = async () => (await api.get<{ data: { unread: number; notifications: boolean } }>('/messages/summary')).data.data;
export const startConversation = async (recipientId: string) => (await api.post<{ data: { conversation: { _id: string } } }>('/messages/conversations', { recipientId })).data.data.conversation;
export const listCommunityPeople = async () => (await api.get<{ data: { people: CommunityPerson[] } }>('/messages/directory')).data.data.people;
