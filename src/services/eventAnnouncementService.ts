import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface EventAnnouncement {
  id: string | number;
  event_id: string | number;
  title: string;
  content: string;
  is_pinned: boolean;
  pinned_at?: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    id: string | number;
    full_name: string;
    pseudo?: string | null;
    email: string;
    profile_image?: string | null;
  } | null;
}

export interface CreateAnnouncementData {
  title: string;
  content: string;
  is_pinned?: boolean;
}

export interface UpdateAnnouncementData {
  title?: string;
  content?: string;
  is_pinned?: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

class EventAnnouncementService {
  private async getHeaders() {
    const token = (await AsyncStorage.getItem('jwt_token')) || (await AsyncStorage.getItem('token'));
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * GET /api/events/{eventId}/announcements
   * Get all announcements for an event (pinned first)
   */
  async getAnnouncements(eventId: string | number): Promise<EventAnnouncement[]> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/events/${eventId}/announcements`, { headers });
    return res.data?.data || [];
  }

  /**
   * POST /api/events/{eventId}/announcements
   * Create an announcement
   */
  async createAnnouncement(eventId: string | number, data: CreateAnnouncementData): Promise<EventAnnouncement> {
    const headers = await this.getHeaders();
    const res = await axios.post(`${ApiConfig.baseUrl}/api/events/${eventId}/announcements`, data, { headers });
    return res.data?.data;
  }

  /**
   * PUT /api/events/announcements/{id}
   * Update an announcement
   */
  async updateAnnouncement(
    announcementId: string | number,
    data: UpdateAnnouncementData
  ): Promise<EventAnnouncement> {
    const headers = await this.getHeaders();
    const res = await axios.put(
      `${ApiConfig.baseUrl}/api/events/announcements/${announcementId}`,
      data,
      { headers }
    );
    return res.data?.data;
  }

  /**
   * DELETE /api/events/announcements/{id}
   * Delete an announcement
   */
  async deleteAnnouncement(announcementId: string | number): Promise<void> {
    const headers = await this.getHeaders();
    await axios.delete(`${ApiConfig.baseUrl}/api/events/announcements/${announcementId}`, { headers });
  }

  /**
   * PATCH /api/events/announcements/{id}/pin
   * Toggle pin status
   */
  async togglePin(announcementId: string | number): Promise<EventAnnouncement> {
    const headers = await this.getHeaders();
    const res = await axios.patch(
      `${ApiConfig.baseUrl}/api/events/announcements/${announcementId}/pin`,
      {},
      { headers }
    );
    return res.data?.data;
  }
}

export const eventAnnouncementService = new EventAnnouncementService();
export default eventAnnouncementService;
