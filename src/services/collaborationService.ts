import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';

export interface CollaborationUser {
  id: number;
  full_name: string;
  pseudo?: string;
  email: string;
  profile_image?: string | null;
}

export interface CollaborationChatRoomSummary {
  id: number;
  name: string;
  description?: string | null;
  is_group: boolean;
  created_at?: string | null;
  member_count?: number;
}

export interface CollaborationInquiry {
  id: number;
  sender: CollaborationUser;
  receiver: CollaborationUser;
  collaboration_type: string;
  subject: string;
  message: string;
  compensation_type?: string;
  budget_amount?: string | null;
  currency: string;
  organization_or_brand?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  target_date?: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  response_note?: string | null;
  responded_at?: string | null;
  chat_room?: CollaborationChatRoomSummary | null;
  created_at: string;
  updated_at: string;
}

export interface CollaborationMemberItem {
  user: CollaborationUser;
  is_admin: boolean;
  joined_at?: string | null;
  roles: string[];
}

export interface CollaborationChatDetails {
  inquiry_id: number;
  chat_room: {
    id: number;
    name: string;
    description?: string;
    is_group: boolean;
    created_at?: string;
    member_count: number;
    members: CollaborationMemberItem[];
  };
  inquiry: {
    id: number;
    subject: string;
    collaboration_type: string;
    status: string;
    budget_amount?: string;
    currency: string;
    compensation_type?: string;
    target_date?: string;
    sender: CollaborationUser;
    receiver: CollaborationUser;
  };
}

export interface CreateInquiryData {
  receiver_id: number;
  collaboration_type: string;
  subject: string;
  message: string;
  compensation_type?: string;
  budget_amount?: number | string;
  currency?: string;
  organization_or_brand?: string;
  contact_email?: string;
  contact_phone?: string;
  target_date?: string;
}

export interface CollaborationSummary {
  total_received: number;
  pending_received: number;
  accepted_received: number;
  total_sent: number;
  pending_sent: number;
  pending_invitations?: number;
  total_pending_action?: number;
}

class CollaborationService {
  private async getAuthHeaders() {
    const token =
      (await AsyncStorage.getItem('jwt_token')) ||
      (await AsyncStorage.getItem('token')) ||
      (await AsyncStorage.getItem('authToken'));
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Send a new collaboration inquiry
   */
  async sendInquiry(data: CreateInquiryData): Promise<CollaborationInquiry> {
    if (!data.receiver_id) {
      throw new Error('Receiver ID is required');
    }
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries`,
      data,
      headers
    );
    return response.data.data;
  }

  /**
   * Get inquiries received by current user
   */
  async getReceivedInquiries(status?: string): Promise<CollaborationInquiry[]> {
    const headers = await this.getAuthHeaders();
    const url = status
      ? `${ApiConfig.baseUrl}/api/collaborations/inquiries/received?status=${status}`
      : `${ApiConfig.baseUrl}/api/collaborations/inquiries/received`;
    const response = await axios.get(url, headers);
    return response.data.data;
  }

  /**
   * Get inquiries sent by current user
   */
  async getSentInquiries(status?: string): Promise<CollaborationInquiry[]> {
    const headers = await this.getAuthHeaders();
    const url = status
      ? `${ApiConfig.baseUrl}/api/collaborations/inquiries/sent?status=${status}`
      : `${ApiConfig.baseUrl}/api/collaborations/inquiries/sent`;
    const response = await axios.get(url, headers);
    return response.data.data;
  }

  /**
   * Get summary counts for current user
   */
  async getSummary(): Promise<CollaborationSummary> {
    const headers = await this.getAuthHeaders();
    const response = await axios.get(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/summary`,
      headers
    );
    return response.data.data;
  }

  /**
   * Get specific inquiry details
   */
  async getInquiryDetails(id: number | string): Promise<CollaborationInquiry> {
    const headers = await this.getAuthHeaders();
    const response = await axios.get(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}`,
      headers
    );
    return response.data.data;
  }

  /**
   * Accept an inquiry (Receiver only) and auto-provision dedicated chat workspace
   */
  async acceptInquiry(id: number | string, responseNote?: string): Promise<CollaborationInquiry> {
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/accept`,
      { response_note: responseNote },
      headers
    );
    return response.data.data;
  }

  /**
   * Decline an inquiry (Receiver only)
   */
  async declineInquiry(id: number | string, reason?: string): Promise<CollaborationInquiry> {
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/decline`,
      { reason },
      headers
    );
    return response.data.data;
  }

  /**
   * Mark collaboration as completed
   */
  async completeInquiry(id: number | string, note?: string): Promise<CollaborationInquiry> {
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/complete`,
      { note },
      headers
    );
    return response.data.data;
  }

  /**
   * Cancel inquiry (Sender only)
   */
  async cancelInquiry(id: number | string): Promise<CollaborationInquiry> {
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/cancel`,
      {},
      headers
    );
    return response.data.data;
  }

  /**
   * Get or initialize the dedicated collaboration workspace ChatRoom
   */
  async getCollaborationChat(id: number | string): Promise<CollaborationChatDetails> {
    const headers = await this.getAuthHeaders();
    const response = await axios.get(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/chat`,
      headers
    );
    return response.data.data;
  }

  /**
   * Get mutual followers who can be invited to collaboration
   */
  async getMutualFollowers(
    id: number | string,
    query?: string
  ): Promise<{ inquiry_id: number; total: number; mutual_followers: any[] }> {
    const headers = await this.getAuthHeaders();
    const url = query
      ? `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/invite/mutual-followers?query=${encodeURIComponent(query)}`
      : `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/invite/mutual-followers`;
    const response = await axios.get(url, headers);
    return response.data.data;
  }

  /**
   * Invite member to collaboration workspace chat via Mutual Follower or Email
   */
  async inviteMember(
    id: number | string,
    data: { user_id?: number; userId?: number; email?: string; role?: string; message?: string }
  ): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/invite`,
      data,
      headers
    );
    return response.data.data;
  }

  /**
   * Get all sent invitation logs for a collaboration
   */
  async getInvitations(
    id: number | string
  ): Promise<{ inquiry_id: number; total: number; invitations: any[] }> {
    const headers = await this.getAuthHeaders();
    const response = await axios.get(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/invitations`,
      headers
    );
    return response.data.data;
  }

  /**
   * Get pending collaboration invitations received by current user
   */
  async getMyInvitations(): Promise<{ total: number; invitations: any[] }> {
    const headers = await this.getAuthHeaders();
    const response = await axios.get(
      `${ApiConfig.baseUrl}/api/collaborations/invitations/my`,
      headers
    );
    return response.data.data;
  }

  /**
   * Respond to a received collaboration invitation (accept / decline)
   */
  async respondToInvitation(
    inviteId: number | string,
    action: 'accept' | 'decline'
  ): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/invitations/${inviteId}/respond`,
      { action },
      headers
    );
    return response.data;
  }

  /**
   * Cancel a pending sent invitation with optional reason
   */
  async cancelInvitation(inviteId: number | string, reason?: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await axios.post(
      `${ApiConfig.baseUrl}/api/collaborations/invitations/${inviteId}`,
      { reason },
      headers
    );
    return response.data;
  }

  /**
   * Get all invitation logs (sent & received) with optional status filter
   */
  async getInvitationLogs(status?: string): Promise<{ total: number; invitations: any[] }> {
    const headers = await this.getAuthHeaders();
    const response = await axios.get(
      `${ApiConfig.baseUrl}/api/collaborations/invitations/logs`,
      {
        ...headers,
        params: status && status !== 'all' ? { status } : undefined,
      }
    );
    return response.data.data;
  }

  /**
   * Get all members in collaboration chat
   */
  async getCollaborationMembers(id: number | string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await axios.get(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/chat/members`,
      headers
    );
    return response.data.data;
  }

  /**
   * Update member role in collaboration chat
   */
  async updateMemberRole(
    id: number | string,
    userId: number,
    data: { role: string; is_admin?: boolean }
  ): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await axios.put(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/chat/members/${userId}/role`,
      data,
      headers
    );
    return response.data.data;
  }

  /**
   * Remove member from collaboration chat
   */
  async removeMember(id: number | string, userId: number): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await axios.delete(
      `${ApiConfig.baseUrl}/api/collaborations/inquiries/${id}/chat/members/${userId}`,
      headers
    );
    return response.data.data;
  }
}

export default new CollaborationService();
