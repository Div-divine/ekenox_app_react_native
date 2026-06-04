import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';
import { UrlHelper } from '../utils/urlHelper';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AssociationMember {
  id: string | number;
  user: {
    id: string | number;
    email: string;
    pseudo?: string | null;
    full_name: string;
    profile_image?: string | null;
  };
  role: {
    name: string;
  };
  joined_at: string;
  is_following?: boolean;
  is_muted?: boolean;
}

export interface AssociationEvent {
  id: string | number;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  banner_image?: string;
  is_past: boolean;
  registration_count: number;
  max_attendees?: number;
  can_accept_registrations: boolean;
  event_type?: string;
  organizer?: {
    type: 'association' | 'user';
    id: string | number;
    name: string;
    email: string;
  };
}

export interface Association {
  id: string | number;
  name: string;
  category: string;
  description: string;
  mission: string;
  what_they_do: string;
  focus_areas: string[];
  achievements: string[];
  email: string;
  phone_number: string;
  website: string;
  address: string;
  latitude?: string | number;
  longitude?: string | number;
  social_media?: Record<string, string>;
  profile_image?: string;
  logo_image?: string;
  is_private: boolean;
  is_verified: boolean;
  short_tagline?: string;
  member_count: number;
  event_count: number;
  average_rating: number;
  share_count: number;
  established_date?: string;
  creator?: { id: string | number; full_name: string; email: string };
  chat_room?: { id: string | number } | null;
  current_user_role?: string | null;
  has_pending_join_request: boolean;
  has_pending_invitation: boolean;
  is_favorited?: boolean;
  is_muted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PendingInvitation {
  id: string | number;
  association: {
    id: string | number;
    name: string;
    logo?: string;
  };
  role: { id: string | number; name: string };
  inviter: { id: string | number; full_name: string };
  message?: string;
  created_at: string;
  expires_at?: string;
  total_invitations?: number;
}

export interface JoinRequest {
  id: string | number;
  status: string;
  association?: { id: string | number; name: string };
  user?: { id: string | number; full_name: string; profile_image?: string };
  message?: string;
  created_at: string;
}

export interface AdminTransferUser {
  id: string | number;
  full_name: string;
  email: string;
  profile_image?: string;
}

export interface AdminTransferDemand {
  id: string | number;
  association: {
    id: string | number;
    name: string;
    logo?: string;
  };
  sender: AdminTransferUser;
  receiver?: AdminTransferUser | null;
  email: string;
  status: 'pending_response' | 'accepted_pending_validation' | 'refused' | 'cancelled' | 'validated';
  accepted_by?: AdminTransferUser | null;
  refused_by?: AdminTransferUser | null;
  cancelled_by?: AdminTransferUser | null;
  validated_by?: AdminTransferUser | null;
  latest: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string | number;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const BASE = ApiConfig.apiUrl;

// ─── Service ─────────────────────────────────────────────────────────────────

class AssociationService {
  /** List associations with optional search / category / page */
  async getAssociations(params?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Association[]; pagination: any }> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations`, { headers, params });
    return { data: res.data.data ?? [], pagination: res.data.pagination ?? {} };
  }

  /** My associations only */
  async getMyAssociations(page = 1, limit = 20): Promise<Association[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/my-associations`, {
      headers,
      params: { page, limit },
    });
    return res.data.data ?? [];
  }

  /** Single association detail */
  async getAssociationById(id: string | number): Promise<Association | null> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}`, { headers });
    return res.data.data ?? null;
  }

  /** Toggle favorite (follow) */
  async toggleFavorite(id: string | number): Promise<boolean> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/associations/${id}/favorites`, {}, { headers });
    return res.data.is_favorited ?? false;
  }

  /** Check if association is favorited */
  async isFavorite(id: string | number): Promise<boolean> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/is-favorite`, { headers });
    return res.data.is_favorite ?? false;
  }

  /** Request to join association */
  async requestJoin(id: string | number, message?: string, payload?: any): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(
      `${BASE}/associations/${id}/join`,
      {
        message,
        ...payload
      },
      { headers }
    );
    return true;
  }

  /** Cancel my pending join request */
  async cancelJoinRequest(id: string | number): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(`${BASE}/associations/${id}/cancel-join-request`, {}, { headers });
    return true;
  }

  /** Leave association */
  async leaveAssociation(id: string | number): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(`${BASE}/associations/${id}/leave`, {}, { headers });
    return true;
  }

  /** Get association members */
  async getMembers(
    id: string | number,
    page = 1,
    limit = 20
  ): Promise<AssociationMember[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/members`, {
      headers,
      params: { page, limit },
    });
    return res.data.data ?? [];
  }

  /** Get join requests for an association (admin/mod only) */
  async getJoinRequests(id: string | number): Promise<JoinRequest[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/join-requests`, {
      headers,
    });
    return res.data.data ?? [];
  }

  /** Count pending join requests for association */
  async countPendingRequests(id: string | number): Promise<number> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/pending-requests/count`, {
      headers,
    });
    return res.data.data?.pending_requests_count ?? 0;
  }

  /** My pending join requests count */
  async getMyPendingRequestsCount(): Promise<number> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/my-pending-requests/count`, {
      headers,
    });
    return res.data.data?.pending_requests_count ?? 0;
  }

  /** Get all associations where current user is admin and has pending join requests */
  async getAdminPendingRequests(): Promise<Array<{ association: Association; pending_requests_count: number; role: string }>> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/admin/pending-requests`, { headers });
    return res.data.data ?? [];
  }

  /** Get user favorite associations */
  async getFavorites(page = 1, limit = 20): Promise<Association[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/favorites`, {
      headers,
      params: { page, limit },
    });
    return res.data.data ?? [];
  }

  /** My all join requests (all statuses) */
  async getMyJoinRequests(): Promise<JoinRequest[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/my-join-requests`, { headers });
    return res.data.data ?? [];
  }

  /** Get join form configuration settings (e.g. require_motif) for association */
  async getJoinFormConfig(id: string | number): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/join-form-config`, { headers });
    return res.data.data ?? {};
  }

  /** Ongoing events for an association */
  async getOngoingEvents(
    id: string | number,
    page = 1,
    limit = 20
  ): Promise<AssociationEvent[]> {
    const headers = await getHeaders();
    const res = await axios.get(
      `${BASE}/associations/${id}/events/ongoing`,
      { headers, params: { limit, offset: (page - 1) * limit } }
    );
    return res.data.data ?? [];
  }

  /** Upcoming events for an association */
  async getUpcomingEvents(
    id: string | number,
    page = 1,
    limit = 20
  ): Promise<AssociationEvent[]> {
    const headers = await getHeaders();
    const res = await axios.get(
      `${BASE}/associations/${id}/events/upcoming`,
      { headers, params: { limit, offset: (page - 1) * limit } }
    );
    return res.data.data ?? [];
  }

  /** All events for association */
  async getAllEvents(id: string | number): Promise<AssociationEvent[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/events`, { headers });
    return res.data.data ?? [];
  }

  /** My pending invitations */
  async getMyPendingInvitations(): Promise<PendingInvitation[]> {
    const headers = await getHeaders();
    const res = await axios.get(
      `${BASE}/associations/invitations/my-pending-invitations`,
      { headers }
    );
    return res.data.data ?? [];
  }

  /** Accept invitation */
  async acceptInvitation(invitationId: string | number): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(
      `${BASE}/associations/invitations/${invitationId}/accept`,
      {},
      { headers }
    );
    return true;
  }

  /** Reject invitation */
  async rejectInvitation(invitationId: string | number): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(
      `${BASE}/associations/invitations/${invitationId}/reject`,
      {},
      { headers }
    );
    return true;
  }

  /** Get invitations for association (admin only) */
  async getAssociationInvitations(id: string | number): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/invitations`, { headers });
    return res.data.data ?? [];
  }

  /** Send invitations to users */
  async sendInvitations(
    associationId: string | number,
    invitations: Array<{ user_id?: string | number; email?: string; role_id: string | number }>,
    message?: string
  ): Promise<{ created: number; errors: string[] }> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/associations/${associationId}/invitations/send`,
      { invitations, message },
      { headers }
    );
    return res.data.data ?? { created: 0, errors: [] };
  }

  /** Get all available roles */
  async getRoles(): Promise<Role[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/roles`, { headers });
    return res.data.data ?? [];
  }

  /** Report association */
  async reportAssociation(
    id: string | number,
    reason: string,
    description?: string
  ): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(
      `${BASE}/associations/${id}/report`,
      { reason, description },
      { headers }
    );
    return true;
  }

  /** Approve a join request */
  async approveJoinRequest(
    associationId: string | number,
    requestId: string | number,
    roleId?: string | number
  ): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(
      `${BASE}/associations/${associationId}/members/join-requests/${requestId}/approve`,
      { role_id: roleId },
      { headers }
    );
    return true;
  }

  /** Reject a join request */
  async rejectJoinRequest(
    associationId: string | number,
    requestId: string | number
  ): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(
      `${BASE}/associations/${associationId}/members/join-requests/${requestId}/reject`,
      {},
      { headers }
    );
    return true;
  }

  /** Remove a member from association */
  async removeMember(
    associationId: string | number,
    userId: string | number
  ): Promise<boolean> {
    const headers = await getHeaders();
    await axios.delete(
      `${BASE}/associations/${associationId}/members/${userId}`,
      { headers }
    );
    return true;
  }

  /** Change member role */
  async changeMemberRole(
    associationId: string | number,
    userId: string | number,
    roleId: string | number
  ): Promise<boolean> {
    const headers = await getHeaders();
    await axios.put(
      `${BASE}/associations/${associationId}/members/${userId}/role`,
      { role_id: roleId },
      { headers }
    );
    return true;
  }

  /** Add a member directly to association */
  async addMemberDirectly(
    associationId: string | number,
    data: { user_id: string | number; role_id: string | number }
  ): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(
      `${BASE}/associations/${associationId}/members/add`,
      data,
      { headers }
    );
    return true;
  }

  /** Toggle notifications muting for association */
  async toggleMuteNotifications(
    associationId: string | number
  ): Promise<boolean> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/associations/${associationId}/notifications/toggle-mute`,
      {},
      { headers }
    );
    return res.data.is_muted ?? false;
  }

  /** Get paginated users for user selection */
  async getPaginatedUsers(params?: {
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; pagination: any }> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/users`, { headers, params });
    return {
      data: res.data.data ?? [],
      pagination: res.data.pagination ?? {},
    };
  }

  /** Follow a user */
  async followUser(userId: string | number): Promise<boolean> {
    const headers = await getHeaders();
    await axios.post(`${BASE}/users/${userId}/follow`, {}, { headers });
    return true;
  }

  /** Unfollow a user */
  async unfollowUser(userId: string | number): Promise<boolean> {
    const headers = await getHeaders();
    await axios.delete(`${BASE}/users/${userId}/unfollow`, { headers });
    return true;
  }

  /** Get or create a direct chat room with a user */
  async getOrCreateDirectChat(userId: string | number): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/chat/rooms/direct/${userId}`,
      {},
      { headers }
    );
    return res.data.data ?? res.data;
  }

  /** Create a new association */
  async createAssociation(data: any): Promise<Association> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/associations`, data, { headers });
    return res.data.data;
  }

  /** Update an existing association */
  async updateAssociation(id: string | number, data: any): Promise<Association> {
    const headers = await getHeaders();
    const res = await axios.put(`${BASE}/associations/${id}`, data, { headers });
    return res.data.data;
  }

  /** Resolve media paths to absolute URLs */
  resolveUrl(url?: string): string {
    return UrlHelper.convertPathToUrl(url);
  }

  /** Upload profile image (used as cover) and logo image for association */
  async uploadAssociationImages(
    id: string | number,
    profileImageUri?: string,
    logoImageUri?: string
  ): Promise<any> {
    const token = await AsyncStorage.getItem('jwt_token');
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const formData = new FormData();

    if (profileImageUri) {
      const filename = profileImageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('profile_image', {
        uri: profileImageUri,
        name: filename,
        type,
      } as any);
    }

    if (logoImageUri) {
      const filename = logoImageUri.split('/').pop() || 'logo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('logo_image', {
        uri: logoImageUri,
        name: filename,
        type,
      } as any);
    }

    const res = await axios.post(
      `${BASE}/associations/${id}/upload-image`,
      formData,
      { headers }
    );
    return res.data;
  }

  /** Get request settings for an association */
  async getRequestSettings(id: string | number): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/request-settings`, { headers });
    return res.data.data ?? {};
  }

  /** Update request settings for an association */
  async updateRequestSettings(id: string | number, data: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.put(`${BASE}/associations/${id}/request-settings`, data, { headers });
    return res.data;
  }

  /** Get auto-response templates for an association */
  async getAutoResponses(id: string | number): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/auto-responses`, { headers });
    return res.data.data ?? [];
  }

  /** Update an auto-response template */
  async updateAutoResponse(id: string | number, triggerType: string, data: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.put(`${BASE}/associations/${id}/auto-responses/${triggerType}`, data, { headers });
    return res.data;
  }

  /** Reset an auto-response template to default */
  async resetAutoResponse(id: string | number, triggerType: string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/associations/${id}/auto-responses/${triggerType}/reset`, {}, { headers });
    return res.data;
  }

  /** Get personalization placeholders for auto-responses */
  async getPlaceholders(id: string | number): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${id}/auto-responses/placeholders`, { headers });
    return res.data.data ?? [];
  }

  /** Create an event associated with this association */
  async createEvent(associationId: string | number, data: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/events`,
      { ...data, organizer_association_id: associationId },
      { headers }
    );
    return res.data;
  }

  /** Initiate admin transfer */
  async initiateAdminTransfer(
    associationId: string | number,
    email: string,
    userId?: string | number
  ): Promise<AdminTransferDemand> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/associations/${associationId}/admin-transfer/initiate`,
      { email, user_id: userId },
      { headers }
    );
    return res.data.data;
  }

  /** Accept admin transfer request */
  async acceptAdminTransfer(demandId: string | number): Promise<AdminTransferDemand> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/associations/admin-transfer/${demandId}/accept`,
      {},
      { headers }
    );
    return res.data.data;
  }

  /** Refuse admin transfer request */
  async refuseAdminTransfer(demandId: string | number): Promise<AdminTransferDemand> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/associations/admin-transfer/${demandId}/refuse`,
      {},
      { headers }
    );
    return res.data.data;
  }

  /** Cancel admin transfer request */
  async cancelAdminTransfer(demandId: string | number): Promise<AdminTransferDemand> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/associations/admin-transfer/${demandId}/cancel`,
      {},
      { headers }
    );
    return res.data.data;
  }

  /** Validate and finalize admin transfer */
  async validateAdminTransfer(demandId: string | number): Promise<AdminTransferDemand> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/associations/admin-transfer/${demandId}/validate`,
      {},
      { headers }
    );
    return res.data.data;
  }

  /** Get active/pending admin transfers for current user */
  async getPendingAdminTransfers(): Promise<AdminTransferDemand[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/admin-transfer/pending`, { headers });
    return res.data.data ?? [];
  }

  /** Get admin transfer history for an association */
  async getAdminTransferHistory(associationId: string | number): Promise<AdminTransferDemand[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/associations/${associationId}/admin-transfer/history`, { headers });
    return res.data.data ?? [];
  }
}

export default new AssociationService();
