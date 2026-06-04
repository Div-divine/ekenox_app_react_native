import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';

export interface ChatSender {
  id: string | number;
  full_name: string;
  avatar?: string;
  profile_image?: string;
}

export interface ChatReaction {
  id: string | number;
  emoji: string;
  user: {
    id: string | number;
    full_name: string;
  };
}

export interface ChatMessage {
  id: string | number;
  content: string;
  created_at: string;
  sender: ChatSender;
  reply_to?: ChatMessage | null;
  reactions?: ChatReaction[];
  metadata?: any;
}

const BASE = ApiConfig.apiUrl;

async function getHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

class ChatService {
  /** Get messages for a specific chat room */
  async getMessages(chatRoomId: string | number, page = 1, limit = 50): Promise<ChatMessage[]> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/messages/chat/${chatRoomId}`, {
        headers,
        params: { page, limit },
      });
      // The backend returns messages in chronological order (oldest to newest) via array_reverse.
      return res.data.data ?? [];
    } catch (e: any) {
      console.error('Failed to get messages:', e.message);
      throw e;
    }
  }

  /** Send a new message to a chat room */
  async sendMessage(
    chatRoomId: string | number,
    content: string,
    replyToId?: string | number | null,
    metadata?: any
  ): Promise<ChatMessage> {
    try {
      const headers = await getHeaders();
      const res = await axios.post(
        `${BASE}/messages/send`,
        {
          chat_room_id: chatRoomId,
          content,
          reply_to_id: replyToId || undefined,
          metadata
        },
        { headers }
      );
      return res.data.data;
    } catch (e: any) {
      console.error('Failed to send message:', e.message);
      throw e;
    }
  }

  /** Mark all messages in a chat room as read */
  async markChatAsRead(chatRoomId: string | number): Promise<boolean> {
    try {
      const headers = await getHeaders();
      await axios.post(`${BASE}/messages/chat/${chatRoomId}/mark-all-read`, {}, { headers });
      return true;
    } catch (e: any) {
      console.error('Failed to mark chat as read:', e.message);
      return false;
    }
  }

  /** Add an emoji reaction to a message */
  async addReaction(messageId: string | number, emoji: string): Promise<any> {
    try {
      const headers = await getHeaders();
      const res = await axios.post(
        `${BASE}/messages/${messageId}/reactions`,
        { emoji },
        { headers }
      );
      return res.data.data;
    } catch (e: any) {
      console.error('Failed to add reaction:', e.message);
      throw e;
    }
  }

  /** Remove reaction from a message */
  async removeReaction(messageId: string | number): Promise<boolean> {
    try {
      const headers = await getHeaders();
      await axios.delete(`${BASE}/messages/${messageId}/reactions`, { headers });
      return true;
    } catch (e: any) {
      console.error('Failed to remove reaction:', e.message);
      return false;
    }
  }

  /** Delete message (soft delete) */
  async deleteMessage(messageId: string | number, deleteForEveryone = false): Promise<boolean> {
    try {
      const headers = await getHeaders();
      await axios.delete(`${BASE}/messages/${messageId}/delete`, {
        headers,
        data: { delete_for_everyone: deleteForEveryone }
      });
      return true;
    } catch (e: any) {
      console.error('Failed to delete message:', e.message);
      throw e;
    }
  }

  /** Get list of active conversations for the current user */
  async getConversations(): Promise<any> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/chat/conversations`, { headers });
      return res.data.data ?? { conversations: [], totalUnreadCount: 0 };
    } catch (e: any) {
      console.error('Failed to get conversations:', e.message);
      throw e;
    }
  }
}

export default new ChatService();
