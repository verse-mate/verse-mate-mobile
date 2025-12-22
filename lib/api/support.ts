import { client } from '@/src/api/generated/client.gen';

export interface SupportConversation {
  id: string;
  user_id: string;
  subject: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string | null;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  text: string;
  sender: 'user' | 'support';
  created_at: string | null;
}

/**
 * Get all support conversations for the current user
 */
export const getSupportConversations = async () => {
  return client.get<
    { 200: { conversations: SupportConversation[] } },
    unknown,
    false
  >({
    url: '/support/conversations',
  });
};

/**
 * Start a new support conversation
 */
export const postSupportConversation = async (text: string, subject?: string) => {
  return client.post<
    { 200: { success: boolean; conversationId: string } },
    unknown,
    false
  >({
    url: '/support/conversations',
    body: { text, subject },
  });
};

/**
 * Get all messages for a specific conversation
 */
export const getSupportMessages = async (conversationId: string) => {
  return client.get<
    { 200: { messages: SupportMessage[] } },
    unknown,
    false
  >({
    url: `/support/conversations/${conversationId}/messages`,
  });
};

/**
 * Send a reply in an existing conversation
 */
export const postSupportMessage = async (conversationId: string, text: string) => {
  return client.post<
    { 200: { success: boolean } },
    unknown,
    false
  >({
    url: `/support/conversations/${conversationId}/messages`,
    body: { text },
  });
};
