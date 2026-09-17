import api from './axios';

export interface Conversation {
  _id: string;
  lastMessageAt?: string;
  otherParticipant?: { _id: string; fullName: string; role: string; providerProfile?: { organizationName?: string; organizationType?: string } };
  lastMessagePreview: string;
  unreadCount: number;
}

export interface ChatMessage { _id: string; conversationId: string; senderId: string; content: string; createdAt: string; readAt?: string; }
export interface CommunityPerson { _id: string; fullName: string; providerProfile?: { organizationName?: string; organizationType?: 'faculty' | 'alumni'; description?: string } }

export const listConversations = async () => (await api.get<{ data: { conversations: Conversation[] } }>('/messages/conversations')).data.data.conversations;
export const getMessages = async (id: string) => (await api.get<{ data: { messages: ChatMessage[] } }>(`/messages/conversations/${id}/messages`)).data.data.messages;
export const sendChatMessage = async (id: string, content: string) => (await api.post<{ data: { message: ChatMessage } }>(`/messages/conversations/${id}/messages`, { content })).data.data.message;
export const markConversationRead = async (id: string) => { await api.patch(`/messages/conversations/${id}/read`); };
export const startConversation = async (recipientId: string) => (await api.post<{ data: { conversation: { _id: string } } }>('/messages/conversations', { recipientId })).data.data.conversation;
export const listCommunityPeople = async () => (await api.get<{ data: { people: CommunityPerson[] } }>('/messages/directory')).data.data.people;
