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
      return res.data?.data ?? res.data;
    } catch (e: any) {
      console.error('Failed to get conversations:', e.message);
      throw e;
    }
  }

  /** Get or create a direct chat room with a user */
  async getOrCreateDirectChat(userId: string | number): Promise<any> {
    try {
      const headers = await getHeaders();
      const res = await axios.post(`${BASE}/chat/rooms/direct/${userId}`, {}, { headers });
      return res.data.data;
    } catch (e: any) {
      console.error('Failed to get or create direct chat:', e.message);
      throw e;
    }
  }

  /** Create a group chat room */
  async createGroupChat(name: string, memberIds: (number | string)[], description?: string): Promise<any> {
    try {
      const headers = await getHeaders();
      delete headers['Content-Type']; // Allow RN/Axios to set multipart boundary automatically

      const formData = new FormData();
      formData.append('name', name);
      formData.append('member_ids', JSON.stringify(memberIds));
      if (description) formData.append('description', description);

      const res = await axios.post(`${BASE}/chat/rooms/group`, formData, {
        headers,
        transformRequest: [(data) => data],
      });
      return res.data.data;
    } catch (e: any) {
      console.error('Failed to create group chat:', e.message);
      throw e;
    }
  }

  /** Send group invite */
  async sendGroupInvite(chatRoomId: string | number, userId: string | number): Promise<any> {
    try {
      const headers = await getHeaders();
      const res = await axios.post(`${BASE}/chat/rooms/groups/${chatRoomId}/invite/send`, { user_id: userId }, { headers });
      return res.data;
    } catch (e: any) {
      console.error('Failed to send group invite:', e.message);
      throw e;
    }
  }

  /** Respond to group invite (accept/decline) */
  async respondToInvite(inviteId: string | number, accept: boolean): Promise<any> {
    try {
      const headers = await getHeaders();
      const res = await axios.post(`${BASE}/chat/rooms/groups/invites/${inviteId}/respond`, { accept }, { headers });
      return res.data;
    } catch (e: any) {
      console.error('Failed to respond to invite:', e.message);
      throw e;
    }
  }

  /** Get detailed info for a single group invite */
  async getInviteDetails(inviteId: string | number): Promise<any> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/chat/rooms/groups/invites/${inviteId}`, { headers });
      return res.data.invite ?? res.data.data ?? res.data;
    } catch (e: any) {
      console.error('Failed to get invite details:', e.message);
      throw e;
    }
  }

  /** Cancel a sent group invite */
  async cancelGroupInvite(inviteId: string | number): Promise<any> {
    try {
      const headers = await getHeaders();
      const res = await axios.delete(`${BASE}/chat/rooms/groups/invites/${inviteId}`, { headers });
      return res.data;
    } catch (e: any) {
      console.error('Failed to cancel group invite:', e.message);
      throw e;
    }
  }

  /** Search users by query for direct chats or group invites */
  async searchUsers(query: string): Promise<any[]> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/users/search`, {
        headers,
        params: { q: query, limit: 20 },
      });
      return res.data.data ?? [];
    } catch (e: any) {
      console.error('Failed to search users:', e.message);
      return [];
    }
  }

  /** Get all user invites (both pending and historical) */
  async getAllUserInvites(): Promise<any[]> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/chat/rooms/groups/all-user-invites`, { headers });
      return res.data.invites ?? [];
    } catch (e: any) {
      console.error('Failed to get all user invites:', e.message);
      return [];
    }
  }

  /** Get user pending group invites */
  async getPendingInvites(): Promise<any[]> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/chat/rooms/groups/invites`, { headers });
      return res.data.invites ?? [];
    } catch (e: any) {
      console.error('Failed to get invites:', e.message);
      return [];
    }
  }

  /** Get user followers and following contacts (mutual connections first) */
  async getUserContacts(): Promise<any[]> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/users/user-followers`, { headers });
      return res.data.data ?? [];
    } catch (e: any) {
      console.error('Failed to get user contacts:', e.message);
      return [];
    }
  }

  /** Search users in followers/following or all users */
  async searchContacts(query: string): Promise<any[]> {
    try {
      const headers = await getHeaders();
      const res = await axios.get(`${BASE}/users/search-followers`, {
        headers,
        params: { q: query, limit: 20 },
      });
      const data = res.data.data ?? [];
      if (data.length > 0) return data;
      // Fallback to general search if search-followers returned no matches
      return this.searchUsers(query);
    } catch (e: any) {
      return this.searchUsers(query);
    }
  }
}

export default new ChatService();
