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
  created_at: string;
  updated_at: string;
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
   * Accept an inquiry (Receiver only)
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
}

export default new CollaborationService();
