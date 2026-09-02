import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PermittedAction {
  id: string;
  label: string;
  description: string;
  category: string;
}

export interface Tag {
  id: string | number;
  name: string;
  description?: string | null;
  color: string;
  type: 'association' | 'event';
  is_default?: boolean;
  association_id?: string | number | null;
  event_id?: string | number | null;
  permitted_actions: string[];
  created_by?: {
    id: string | number;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface UserTag {
  id: string | number;
  user: {
    id: string | number;
    name: string;
    email: string;
  };
  tag: Tag;
  is_active: boolean;
  assigned_by?: {
    id: string | number;
    name: string;
  } | null;
  assigned_at: string;
  withdrawn_by?: {
    id: string | number;
    name: string;
  } | null;
  withdrawn_at?: string | null;
  withdrawal_reason?: string | null;
}

export interface UserTagLog {
  id: string | number;
  user: {
    id: string | number;
    name: string;
    email: string;
  };
  tag: Tag;
  action: 'assigned' | 'withdrawn';
  performed_by?: {
    id: string | number;
    name: string;
  } | null;
  reason?: string | null;
  created_at: string;
}

export interface MemberWithTags {
  user: {
    id: string | number;
    full_name: string;
    pseudo?: string | null;
    email: string;
    profile_image?: string | null;
  };
  role?: {
    id: string | number;
    name: string;
    display_name?: string | null;
  } | null;
  joined_at?: string;
  is_creator?: boolean;
  tags: Tag[];
  tag_assignments?: UserTag[];
  withdrawn_tags?: UserTag[];
  permitted_actions: string[];
}

export interface UserPermissions {
  is_admin: boolean;
  is_creator?: boolean;
  permitted_actions: string[];
  tags: Tag[];
}

export interface CreateTagData {
  name: string;
  description?: string;
  color?: string;
  type: 'association' | 'event';
  association_id?: string | number;
  event_id?: string | number;
  permitted_actions: string[];
}

export interface UpdateTagData {
  name?: string;
  description?: string;
  color?: string;
  permitted_actions?: string[];
}

export interface WithdrawTagData {
  user_id: string | number;
  tag_id: string | number;
  reason?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

class TagService {
  private async getHeaders() {
    const token = (await AsyncStorage.getItem('jwt_token')) || (await AsyncStorage.getItem('token'));
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * GET /api/tags/actions
   * List available actions for associations and events
   */
  async getAvailableActions(): Promise<{ association: PermittedAction[]; event: PermittedAction[] }> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/tags/actions`, { headers });
    return res.data?.data || { association: [], event: [] };
  }

  /**
   * POST /api/tags
   * Create a new custom tag
   */
  async createTag(data: CreateTagData): Promise<Tag> {
    const headers = await this.getHeaders();
    const res = await axios.post(`${ApiConfig.baseUrl}/api/tags`, data, { headers });
    return res.data?.data;
  }

  /**
   * PUT /api/tags/{id}
   * Update tag details & actions
   */
  async updateTag(tagId: string | number, data: UpdateTagData): Promise<Tag> {
    const headers = await this.getHeaders();
    const res = await axios.put(`${ApiConfig.baseUrl}/api/tags/${tagId}`, data, { headers });
    return res.data?.data;
  }

  /**
   * DELETE /api/tags/{id}
   * Delete a tag
   */
  async deleteTag(tagId: string | number): Promise<void> {
    const headers = await this.getHeaders();
    await axios.delete(`${ApiConfig.baseUrl}/api/tags/${tagId}`, { headers });
  }

  /**
   * GET /api/tags/association/{associationId}
   * List all tags created for an association
   */
  async getAssociationTags(associationId: string | number): Promise<Tag[]> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/tags/association/${associationId}`, { headers });
    return res.data?.data || [];
  }

  /**
   * GET /api/tags/event/{eventId}
   * List all tags created for an event
   */
  async getEventTags(eventId: string | number): Promise<Tag[]> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/tags/event/${eventId}`, { headers });
    return res.data?.data || [];
  }

  /**
   * POST /api/tags/assign
   * Assign a single tag to a user
   */
  async assignTag(userId: string | number, tagId: string | number): Promise<UserTag> {
    const headers = await this.getHeaders();
    const res = await axios.post(
      `${ApiConfig.baseUrl}/api/tags/assign`,
      { user_id: userId, tag_id: tagId },
      { headers }
    );
    return res.data?.data;
  }

  /**
   * POST /api/tags/withdraw
   * Withdraw a tag from a user with reason and notify the user
   */
  async withdrawTag(userId: string | number, tagId: string | number, reason?: string): Promise<UserTag> {
    const headers = await this.getHeaders();
    const res = await axios.post(
      `${ApiConfig.baseUrl}/api/tags/withdraw`,
      { user_id: userId, tag_id: tagId, reason },
      { headers }
    );
    return res.data?.data;
  }

  /**
   * POST /api/tags/unassign
   * Unassign / withdraw a tag from a user
   */
  async unassignTag(userId: string | number, tagId: string | number, reason?: string): Promise<void> {
    const headers = await this.getHeaders();
    await axios.post(
      `${ApiConfig.baseUrl}/api/tags/unassign`,
      { user_id: userId, tag_id: tagId, reason },
      { headers }
    );
  }

  /**
   * POST /api/tags/batch-assign
   * Sync/replace multiple tags for a user in an association or event
   */
  async batchAssignTags(
    userId: string | number,
    tagIds: (string | number)[],
    target: { associationId?: string | number; eventId?: string | number }
  ): Promise<UserTag[]> {
    const headers = await this.getHeaders();
    const payload: any = {
      user_id: userId,
      tag_ids: tagIds,
    };
    if (target.associationId) payload.association_id = target.associationId;
    if (target.eventId) payload.event_id = target.eventId;

    const res = await axios.post(`${ApiConfig.baseUrl}/api/tags/batch-assign`, payload, { headers });
    return res.data?.data || [];
  }

  /**
   * GET /api/tags/association/{associationId}/members
   * List association members with their assigned tags, history & effective permissions
   */
  async getAssociationMembersWithTags(associationId: string | number): Promise<MemberWithTags[]> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/tags/association/${associationId}/members`, { headers });
    return res.data?.data || [];
  }

  /**
   * GET /api/tags/event/{eventId}/members
   * List event members with their assigned tags, history & effective permissions
   */
  async getEventMembersWithTags(eventId: string | number): Promise<MemberWithTags[]> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/tags/event/${eventId}/members`, { headers });
    return res.data?.data || [];
  }

  /**
   * GET /api/tags/user/{userId}/association/{associationId}/permissions
   * Fetch effective user permissions in an association
   */
  async getUserAssociationPermissions(
    userId: string | number,
    associationId: string | number
  ): Promise<UserPermissions> {
    const headers = await this.getHeaders();
    const res = await axios.get(
      `${ApiConfig.baseUrl}/api/tags/user/${userId}/association/${associationId}/permissions`,
      { headers }
    );
    return res.data?.data || { is_admin: false, permitted_actions: [], tags: [] };
  }

  /**
   * GET /api/tags/user/{userId}/event/{eventId}/permissions
   * Fetch effective user permissions in an event
   */
  async getUserEventPermissions(
    userId: string | number,
    eventId: string | number
  ): Promise<UserPermissions> {
    const headers = await this.getHeaders();
    const res = await axios.get(
      `${ApiConfig.baseUrl}/api/tags/user/${userId}/event/${eventId}/permissions`,
      { headers }
    );
    return res.data?.data || { is_admin: false, permitted_actions: [], tags: [] };
  }

  /**
   * GET /api/tags/user/{userId}/logs
   * Fetch tag activity history for a user
   */
  async getUserTagLogs(userId: string | number): Promise<UserTagLog[]> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/tags/user/${userId}/logs`, { headers });
    return res.data?.data || [];
  }

  /**
   * GET /api/tags/{tagId}/logs
   * Fetch audit logs for a specific tag
   */
  async getTagLogs(tagId: string | number): Promise<UserTagLog[]> {
    const headers = await this.getHeaders();
    const res = await axios.get(`${ApiConfig.baseUrl}/api/tags/${tagId}/logs`, { headers });
    return res.data?.data || [];
  }
}

export const tagService = new TagService();
export default tagService;
