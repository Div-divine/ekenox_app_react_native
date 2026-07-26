import axios from 'axios';
import { Platform } from 'react-native';
import { ApiConfig } from '../config/api';
import authService from './authService';

// Global preprocessor for large integers (Snowflake IDs) to prevent JS number precision loss.
// This matches integers of 16 or more digits outside of quoted strings and turns them into string quotes,
// so that when JSON.parse is run by axios, it parses them as strings instead of floating-point numbers.
const bigIntInterceptor = (data: any) => {
  if (typeof data === 'string') {
    try {
      return data.replace(/"(?:[^"\\]|\\.)*"|\b\d{16,}\b/g, (match, offset) => {
        if (match.startsWith('"')) {
          return match; // Keep string content exactly as is
        }

        // Check character before the matched digits (to skip decimals)
        if (offset > 0 && data[offset - 1] === '.') {
          return match; // Keep decimal fraction as is
        }

        return `"${match}"`; // Wrap large integer in quotes
      });
    } catch (e) {
      console.error('Error preprocessing big integers in JSON response:', e);
      return data;
    }
  }
  return data;
};

// Insert at the beginning of axios transformResponse array
if (Array.isArray(axios.defaults.transformResponse)) {
  axios.defaults.transformResponse.unshift(bigIntInterceptor);
} else if (axios.defaults.transformResponse) {
  axios.defaults.transformResponse = [bigIntInterceptor, axios.defaults.transformResponse as any];
} else {
  axios.defaults.transformResponse = [bigIntInterceptor];
}

export interface Feed {
  id: string | number;
  content: string;
  post_type: string;
  is_draft?: boolean;
  poll_options?: string[] | null;
  poll_expires_at?: string | null;
  allow_multiple_votes?: boolean;
  privacy_level?: string;
  is_edited?: boolean;
  created_at: string;
  updated_at?: string;
  group_id?: string | number | null;
  user: {
    id: string | number;
    full_name: string;
    username: string;
    avatar_url?: string;
    profile_image?: string;
  };
  media?: Array<{
    id: string | number;
    type: 'image' | 'video';
    url: string;
    alt_text?: string;
    caption?: string;
  }>;
  stats?: {
    reactions: number;
    comments: number;
    shares: number;
    views: number;
  };
  user_reacted?: boolean;
  user_reaction_types?: string[];
  poll_results?: Record<string, number> | null;
  user_votes?: number[] | null;

  // Backwards compatibility mappings for older components
  has_media: boolean;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  author: {
    id: string | number;
    full_name: string;
    profile_image?: string;
    pseudo?: string;
  };
}

export interface FeedComment {
  id: number;
  feed_id: string | number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  user: {
    id: number;
    full_name: string;
    username?: string;
    profile_image?: string;
    avatar_url?: string;
  };
  likes_count?: number;
  user_liked?: boolean;
  replies_count?: number;
}

export interface FeedCommentReply {
  id: number;
  comment_id: number;
  parent_reply_id?: number | null;
  user_id: number;
  content: string;
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  user: {
    id: number;
    full_name: string;
    username?: string;
    profile_image?: string;
    pseudo?: string;
  };
  nested_replies?: FeedCommentReply[];
  reactions_count?: number;
}

export interface AppNotification {
  id: string | number;
  type: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  is_read: boolean;
  related_user?: {
    id: string | number;
    full_name: string;
    profile_picture?: string;
  } | null;
  image_url?: string;
  action_url?: string;
  created_at: string;
  read_at?: string | null;
}



export interface Group {
  id: string | number;
  name: string;
  description: string;
  members_count: number;
  privacy_level: 'public' | 'private';
  profile_image_url?: string;
  cover_image_url?: string;
  location?: string;
  website?: string;
  rules?: string[] | string;
  tags?: string[];
  allow_member_posts?: boolean;
  require_post_approval?: boolean;
  allow_member_invites?: boolean;
  require_join_approval?: boolean;
  creator?: {
    id: string | number;
    full_name: string;
    is_active_member?: boolean;
  };
  user_membership?: {
    role: string;
    joined_at: string;
    status: string;
    can_invite?: boolean;
  } | null;
  category?: string;
  posts_count?: number;
  events_count?: number;
  mutual_friends?: Array<{
    id: string | number;
    full_name: string;
    profile_image?: string;
  }>;
}

// Full rich Event type matching the API serialization groups
export interface EventOrganizer {
  type?: string;
  id: string;
  name: string;
  email: string;
}

export interface EventCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface EventAttendee {
  id: string;
  full_name: string;
  email?: string;
  profile_image?: string;
  is_verified?: boolean;
}

export interface Event {
  id: string | number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  // legacy aliases kept for FeedScreen compatibility
  startTime: string;
  endTime: string;
  location: string;
  banner_image?: string;
  bannerImage?: string;
  website?: string;
  email?: string;
  phone?: string;
  event_type?: string;
  is_active?: boolean;
  event_status?: string;
  eventStatus?: string;
  allowed_users?: string[];
  hasAccess?: boolean;
  has_access?: boolean;
  is_featured?: boolean;
  is_registered?: boolean;
  isRegistered?: boolean;
  is_past?: boolean;
  share_count?: number;
  registration_count?: number;
  attendees_count?: number;
  attendeesCount?: number;
  max_attendees?: number;
  report_count?: number;
  comment_count?: number;
  car_share_count?: number;
  tags?: string[];
  organizer?: EventOrganizer;
  organizer_group_id?: string | number;
  categories?: EventCategory[];
  registrations?: EventAttendee[];
  created_at?: string;
  updated_at?: string;
  // geographic
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  privacy_level?: 'public' | 'private';
  privacyLevel?: 'public' | 'private';
  allowed_roles?: string[];
  allowedRoles?: string[];
  creator_user_id?: string | number;
  creator_user?: any;
}

// Pagination helper
export interface PaginatedEvents {
  events: Event[];
  total: number;
  hasMore: boolean;
}

// Map raw API data → normalized Event
const normalizeEvent = (raw: any): Event => ({
  ...raw,
  // ensure both startTime and start_time are set
  startTime: raw.start_time || raw.startTime || '',
  endTime: raw.end_time || raw.endTime || '',
  start_time: raw.start_time || raw.startTime || '',
  end_time: raw.end_time || raw.endTime || '',
  bannerImage: raw.banner_image || raw.bannerImage,
  isRegistered: raw.is_registered ?? raw.isRegistered ?? false,
  attendeesCount: raw.attendees_count ?? raw.attendeesCount ?? raw.registration_count ?? raw.registrationCount ?? 0,
  privacyLevel: raw.privacy_level || raw.privacyLevel || 'public',
  privacy_level: raw.privacy_level || raw.privacyLevel || 'public',
  allowedRoles: raw.allowed_roles || raw.allowedRoles,
  allowed_roles: raw.allowed_roles || raw.allowedRoles,
  allowed_users: raw.allowed_users || raw.allowedUsers,
  event_status: raw.event_status || raw.eventStatus || 'active',
  eventStatus: raw.event_status || raw.eventStatus || 'active',
  hasAccess: raw.hasAccess ?? raw.has_access ?? true,
  has_access: raw.hasAccess ?? raw.has_access ?? true,
});

class FeedService {
  private baseUrl = ApiConfig.apiUrl;

  private async getHeaders() {
    const token = await authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // Get live feed list (optionally filtered by groupId)
  public async getFeeds(page: number = 1, limit: number = 10, groupId?: string | number): Promise<Feed[]> {
    try {
      console.log(`🔄 Fetching feeds - page: ${page}, limit: ${limit}, groupId: ${groupId || 'none'}`);
      const headers = await this.getHeaders();

      let url = `${this.baseUrl}/feeds`;
      if (groupId) {
        url = `${this.baseUrl}/feeds/groups/${groupId}/feeds`;
      }

      const response = await axios.get(url, {
        headers,
        params: {
          page,
          limit,
          ...(groupId ? {} : { exclude_groups: false }) // Allow posts from groups if requested globally
        },
        timeout: 10000,
      });

      if (response.status === 200 && response.data?.success) {
        const feeds = response.data.data?.feeds || [];
        return feeds.map((feed: any) => ({
          ...feed,
          // Backwards compatibility mappings for legacy UI components
          likes_count: feed.stats?.reactions ?? feed.likes_count ?? 0,
          comments_count: feed.stats?.comments ?? feed.comments_count ?? 0,
          is_liked: feed.user_reacted ?? feed.is_liked ?? false,
          has_media: (feed.media && feed.media.length > 0) ?? feed.has_media ?? false,
          author: feed.user ? {
            id: feed.user.id,
            full_name: feed.user.full_name,
            profile_image: feed.user.profile_image || feed.user.avatar_url,
          } : feed.author,
        }));
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching feeds:', error.response?.data || error.message);
      return [];
    }
  }

  // Create a new post in the feed (optional groupId)
  public async createFeed(content: string, groupId?: string | number): Promise<any> {
    try {
      console.log(`🔄 Creating feed post... GroupId: ${groupId || 'global'}`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/feeds`, {
        content,
        post_type: 'general',
        ...(groupId ? { group_id: groupId } : {})
      }, {
        headers,
        timeout: 10000
      });

      if (response.status === 201 && response.data?.success) {
        return { success: true, feed: response.data.data?.feed, message: 'Posted successfully' };
      }
      return { success: false, message: response.data?.message || 'Failed to create post' };
    } catch (error: any) {
      console.error('❌ Error creating feed:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // Toggle reaction (like) on a post
  public async toggleReaction(feedId: string | number, reactionType: string = 'like'): Promise<any> {
    try {
      console.log(`🔄 Toggling reaction on feed: ${feedId}, type: ${reactionType}`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/${feedId}/react`, {
        reaction_type: reactionType
      }, {
        headers,
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        return {
          success: true,
          isLiked: response.data.data?.is_liked,
          likesCount: response.data.data?.reaction_count
        };
      }
      return { success: false };
    } catch (error: any) {
      console.error('❌ Error toggling reaction:', error.response?.data || error.message);
      return { success: false };
    }
  }

  // Get groups (type can be 'public', 'user', or 'discover')
  public async getGroups(type: 'public' | 'user' | 'discover' = 'public', page: number = 1, limit: number = 20): Promise<Group[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/groups`, {
        headers,
        params: {
          type,
          page,
          limit
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        console.log(`🔄 Fetching groups - type: ${type}, page: ${page}`);
        return response.data.data?.groups || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching groups:', error.response?.data || error.message);
      return [];
    }
  }

  // Get single group details
  public async getGroupDetails(groupId: string | number): Promise<any> {
    try {
      console.log(`🔄 Fetching group details for ID: ${groupId}`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/groups/${groupId}`, {
        headers,
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching group details:', error.response?.data || error.message);
      return null;
    }
  }

  // Join a group
  public async joinGroup(groupId: string | number): Promise<any> {
    try {
      console.log(`🔄 Joining group: ${groupId}`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/groups/${groupId}/join`, {}, {
        headers,
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        return { success: true, data: response.data.data, message: response.data.message };
      }
      return { success: false, message: response.data?.message || 'Failed to join group' };
    } catch (error: any) {
      console.error('❌ Error joining group:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // Leave a group
  public async leaveGroup(groupId: string | number): Promise<any> {
    try {
      console.log(`🔄 Leaving group: ${groupId}`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/groups/${groupId}/leave`, {}, {
        headers,
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data?.message || 'Failed to leave group' };
    } catch (error: any) {
      console.error('❌ Error leaving group:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // Get events organized by a specific group
  public async getGroupEvents(groupId: string | number, limit: number = 20, offset: number = 0): Promise<Event[]> {
    try {
      console.log(`🔄 Fetching events for group: ${groupId}`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/group/${groupId}`, {
        headers,
        params: { limit, offset },
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        return (response.data.data || []).map(normalizeEvent);
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching group events:', error.response?.data || error.message);
      return [];
    }
  }

  // ── EVENTS ──────────────────────────────────────────────────────────────

  /** GET /api/events/ongoing */
  public async getOngoingEvents(limit = 20, offset = 0): Promise<PaginatedEvents> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/ongoing`, {
        headers,
        params: { limit, offset },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        const raw = response.data.data || [];
        return {
          events: raw.map(normalizeEvent),
          total: response.data.pagination?.total ?? raw.length,
          hasMore: response.data.pagination?.has_more ?? false,
        };
      }
      return { events: [], total: 0, hasMore: false };
    } catch (error: any) {
      console.error('❌ Error fetching ongoing events:', error.response?.data || error.message);
      return { events: [], total: 0, hasMore: false };
    }
  }

  /** GET /api/events/upcoming */
  public async getUpcomingEvents(limit = 20, offset = 0): Promise<PaginatedEvents> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/upcoming`, {
        headers,
        params: { limit, offset },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        const raw = response.data.data || [];
        return {
          events: raw.map(normalizeEvent),
          total: response.data.pagination?.total ?? raw.length,
          hasMore: response.data.pagination?.has_more ?? false,
        };
      }
      return { events: [], total: 0, hasMore: false };
    } catch (error: any) {
      console.error('❌ Error fetching upcoming events:', error.response?.data || error.message);
      return { events: [], total: 0, hasMore: false };
    }
  }

  /** GET /api/events/nearby */
  public async getNearbyEvents(
    latitude: number,
    longitude: number,
    radius = 50.0,
    limit = 20,
    offset = 0,
  ): Promise<PaginatedEvents> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/nearby`, {
        headers,
        params: { latitude, longitude, radius, limit, offset },
        timeout: 15000,
      });
      if (response.status === 200 && response.data?.success) {
        const raw = response.data.data || [];
        return {
          events: raw.map(normalizeEvent),
          total: response.data.pagination?.total ?? raw.length,
          hasMore: response.data.pagination?.has_more ?? false,
        };
      }
      return { events: [], total: 0, hasMore: false };
    } catch (error: any) {
      console.error('❌ Error fetching nearby events:', error.response?.data || error.message);
      return { events: [], total: 0, hasMore: false };
    }
  }

  /** GET /api/events/my/registered */
  public async getMyRegisteredEvents(): Promise<Event[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/my/registered`, {
        headers,
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return (response.data.data || []).map(normalizeEvent);
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching registered events:', error.response?.data || error.message);
      return [];
    }
  }

  /** GET /api/events/:id  (full detail) */
  public async getEventById(eventId: string | number): Promise<Event | null> {
    try {
      console.log(`🔍 [getEventById] Requesting ID: ${eventId}`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/${eventId}`, {
        headers,
        timeout: 10000,
      });
      console.log(`🔍 [getEventById] Response status: ${response.status}`);
      console.log(`🔍 [getEventById] Type of response.data: ${typeof response.data}`);
      console.log(`🔍 [getEventById] Response data preview:`, typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200));

      let resData = response.data;
      if (typeof resData === 'string') {
        try {
          resData = JSON.parse(resData);
          console.log(`🔍 [getEventById] Parsed string data successfully!`);
        } catch (e: any) {
          console.error(`❌ [getEventById] Failed to parse string data:`, e.message);
        }
      }

      if (response.status === 200 && resData?.success) {
        return normalizeEvent(resData.data);
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching event detail:', error.response?.data || error.message);
      return null;
    }
  }

  /** GET /api/events/search */
  public async searchEvents(query: string, limit = 20, offset = 0): Promise<Event[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/search`, {
        headers,
        params: { search: query, limit, offset },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return (response.data.data || []).map(normalizeEvent);
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error searching events:', error.response?.data || error.message);
      return [];
    }
  }

  /** GET /api/events/categories */
  public async getEventCategories(): Promise<EventCategory[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/categories`, {
        headers,
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching event categories:', error.response?.data || error.message);
      return [];
    }
  }

  // Legacy method – kept so FeedScreen still compiles (points to ongoing)
  public async getEvents(limit = 20, offset = 0): Promise<Event[]> {
    const result = await this.getOngoingEvents(limit, offset);
    return result.events;
  }

  // Get live stories list
  public async getStoryList(page: number = 1, limit: number = 10): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/stories`, {
        headers,
        params: { page, limit },
        timeout: 10000
      });
      if (response.status === 200 && response.data?.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching stories:', error.response?.data || error.message);
      return [];
    }
  }

  // ─── Story Interactions ────────────────────────────────────────────────────

  public async recordStoryView(storyId: string | number): Promise<void> {
    try {
      const headers = await this.getHeaders();
      await axios.post(`${this.baseUrl}/stories/${storyId}/view`, {}, { headers, timeout: 8000 });
    } catch (_) {}
  }

  public async toggleStoryLike(storyId: string | number): Promise<{ liked: boolean; like_count: number }> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.post(`${this.baseUrl}/stories/${storyId}/like`, {}, { headers, timeout: 8000 });
      return res.data?.data ?? { liked: false, like_count: 0 };
    } catch (_) { return { liked: false, like_count: 0 }; }
  }

  public async reactToStory(storyId: string | number, emoji: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const formData = new FormData();
      formData.append('emoji', emoji);
      const res = await axios.post(`${this.baseUrl}/stories/${storyId}/react`, formData, { headers, timeout: 8000 });
      return res.data?.data;
    } catch (_) { return null; }
  }

  public async getStoryReactions(storyId: string | number): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.get(`${this.baseUrl}/stories/${storyId}/reactions`, { headers, timeout: 8000 });
      return res.data?.data ?? {};
    } catch (_) { return {}; }
  }

  public async shareStoryPost(storyId: string | number): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.post(`${this.baseUrl}/stories/${storyId}/share`, {}, { headers, timeout: 8000 });
      return res.data?.success ?? false;
    } catch (_) { return false; }
  }

  public async getStoryLikesList(storyId: string | number): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.get(`${this.baseUrl}/stories/${storyId}/likes`, { headers, timeout: 8000 });
      return res.data?.data ?? [];
    } catch (_) { return []; }
  }

  public async getStorySharesList(storyId: string | number): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.get(`${this.baseUrl}/stories/${storyId}/shares`, { headers, timeout: 8000 });
      return res.data?.data ?? [];
    } catch (_) { return []; }
  }

  public async getStoryComments(storyId: string | number, page = 1, limit = 20): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.get(`${this.baseUrl}/stories/${storyId}/comments`, {
        headers, params: { page, limit }, timeout: 10000
      });
      return res.data?.data ?? { comments: [], total: 0 };
    } catch (_) { return { comments: [], total: 0 }; }
  }

  public async addStoryComment(storyId: string | number, content: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const formData = new FormData();
      formData.append('content', content);
      const res = await axios.post(`${this.baseUrl}/stories/${storyId}/comments`, formData, { headers, timeout: 10000 });
      return res.data?.data ?? null;
    } catch (_) { return null; }
  }

  public async deleteStoryComment(storyId: string | number, commentId: string | number): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.delete(`${this.baseUrl}/stories/${storyId}/comments/${commentId}`, { headers, timeout: 8000 });
      return res.data?.success ?? false;
    } catch (_) { return false; }
  }

  public async getStoryCommentReplies(storyId: string | number, commentId: string | number): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const res = await axios.get(`${this.baseUrl}/stories/${storyId}/comments/${commentId}/replies`, { headers, timeout: 8000 });
      return res.data?.data ?? [];
    } catch (_) { return []; }
  }

  public async addStoryCommentReply(storyId: string | number, commentId: string | number, content: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const formData = new FormData();
      formData.append('content', content);
      const res = await axios.post(`${this.baseUrl}/stories/${storyId}/comments/${commentId}/replies`, formData, { headers, timeout: 10000 });
      return res.data?.data ?? null;
    } catch (_) { return null; }
  }

  public async uploadStoryMusic(audioUri: string, mimeType: string, musicTitle: string, musicSinger: string): Promise<{ music_url?: string; music_title?: string; music_singer?: string } | null> {
    try {
      const headers = await this.getHeaders();
      const formData = new FormData();
      formData.append('audio', { uri: audioUri, type: mimeType, name: 'music.mp3' } as any);
      formData.append('music_title', musicTitle);
      formData.append('music_singer', musicSinger);
      const res = await axios.post(`${this.baseUrl}/stories/music`, formData, { headers, timeout: 30000 });
      if (res.data?.success) return res.data;
      return null;
    } catch (error: any) {
      console.error('❌ Error uploading story music:', error.response?.data || error.message);
      return null;
    }
  }

  // Get dynamic daily green tip of the day
  public async getDailyTipToday(): Promise<any> {
    try {
      console.log(`🔄 Fetching tip of the day from backend API...`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/daily-tips/today`, {
        headers,
        timeout: 10000
      });

      if (response.status === 200) {
        return response.data;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching daily tip:', error.response?.data || error.message);
      return null;
    }
  }

  // Update feed post content
  public async updateFeed(feedId: string | number, content: string): Promise<boolean> {
    try {
      console.log(`🔄 Updating feed post ${feedId} with new content...`);
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}/feeds/${feedId}`, {
        content
      }, {
        headers,
        timeout: 10000
      });

      return response.status === 200 && response.data?.success;
    } catch (error: any) {
      console.error('❌ Error updating feed post:', error.response?.data || error.message);
      return false;
    }
  }

  // Delete feed post
  public async deleteFeed(feedId: string | number): Promise<boolean> {
    try {
      console.log(`🔄 Deleting feed post ${feedId}...`);
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/feeds/${feedId}`, {
        headers,
        timeout: 10000
      });

      return response.status === 200 && response.data?.success;
    } catch (error: any) {
      console.error('❌ Error deleting feed post:', error.response?.data || error.message);
      return false;
    }
  }

  // Report feed post
  public async reportFeed(feedId: string | number, reason: string): Promise<boolean> {
    try {
      console.log(`🔄 Reporting feed post ${feedId} for reason: ${reason}...`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/report/feed/report/${feedId}`, {
        reason
      }, {
        headers,
        timeout: 10000
      });

      return response.status === 201 && response.data?.success;
    } catch (error: any) {
      console.error('❌ Error reporting feed post:', error.response?.data || error.message);
      return false;
    }
  }

  // Vote on a feed poll post
  public async votePoll(feedId: string | number, optionIndex: number): Promise<any> {
    try {
      console.log(`🔄 Submitting vote for feed poll ${feedId}, option index: ${optionIndex}...`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/${feedId}/poll/vote`, {
        option_indices: [optionIndex]
      }, {
        headers,
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        const data = response.data.data || response.data;
        return {
          success: true,
          pollResults: data.poll_results,
          userVotes: data.user_votes
        };
      }
      return { success: false, message: response.data?.message || 'Vote failed' };
    } catch (error: any) {
      console.error('❌ Error voting in poll:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // Register for an event
  public async registerForEvent(eventId: string | number): Promise<any> {
    try {
      console.log(`🔄 Registering for event: ${eventId}...`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/events/${eventId}/register`, {}, {
        headers,
        timeout: 10000
      });

      if (response.status === 200 || response.status === 201) {
        return { success: true, message: response.data?.message || 'Registered successfully' };
      }
      return { success: false, message: response.data?.message || 'Registration failed' };
    } catch (error: any) {
      console.error('❌ Error registering for event:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // Unregister from an event
  public async unregisterFromEvent(eventId: string | number): Promise<any> {
    try {
      console.log(`🔄 Unregistering from event: ${eventId}...`);
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/events/${eventId}/unregister`, {
        headers,
        timeout: 10000
      });

      if (response.status === 200) {
        return { success: true, message: response.data?.message || 'Unregistered successfully' };
      }
      return { success: false, message: response.data?.message || 'Unregistration failed' };
    } catch (error: any) {
      console.error('❌ Error unregistering from event:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }


  // Get paginated list of active members for a group
  public async getGroupMembers(groupId: string | number, page: number = 1, limit: number = 20): Promise<any> {
    try {
      console.log(`🔄 Fetching members for group: ${groupId}`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/groups/${groupId}/members`, {
        headers,
        params: { page, limit },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return response.data.data;
      }
      return { members: [], pagination: {} };
    } catch (error: any) {
      console.error('❌ Error fetching group members:', error.response?.data || error.message);
      return { members: [], pagination: {} };
    }
  }

  // Invite a user (by ID or email) to a group, with optional role assignment
  public async inviteUserToGroup(
    groupId: string | number,
    userId: string | number,
    role?: string
  ): Promise<any> {
    try {
      console.log(`🔄 Inviting user ${userId} to group ${groupId} with role ${role || 'default'}`);
      const headers = await this.getHeaders();
      const body: Record<string, any> = { user_id: String(userId) };
      if (role) body.role = role;
      const response = await axios.post(
        `${this.baseUrl}/feeds/groups/${groupId}/invite`,
        body,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error inviting user to group:', error.response?.data || error.message);
      const msg = error.response?.data?.error || error.response?.data?.message || error.message || 'Invite failed';
      return { success: false, error: msg };
    }
  }


  // Search global users by name/username query (used in invite modal)
  public async searchUsers(query: string, limit: number = 20): Promise<any[]> {
    try {
      if (!query || query.trim().length < 2) return [];
      console.log(`🔄 Searching users: "${query}"`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/users`, {
        headers,
        params: { q: query, limit },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.data) {
        return response.data.data;
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error searching users:', error.response?.data || error.message);
      return [];
    }
  }

  // Get mutual followers (friends list)
  public async getFriends(query?: string, page: number = 1, limit: number = 20): Promise<any[]> {
    try {
      console.log(`🔄 Fetching mutual followers - page: ${page}, limit: ${limit}`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/users/mutual-followers`, {
        headers,
        params: { q: query, page, limit },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.data) {
        return response.data.data;
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching mutual followers:', error.response?.data || error.message);
      return [];
    }
  }
  // ── COMMENTS ────────────────────────────────────────────────────────────

  public async getComments(feedId: string | number, page: number = 1, limit: number = 20): Promise<FeedComment[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/${feedId}/comments`, {
        headers,
        params: { page, limit },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return response.data.data?.comments || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching comments:', error.response?.data || error.message);
      return [];
    }
  }

  public async addComment(feedId: string | number, content: string): Promise<{ success: boolean; comment?: FeedComment; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/${feedId}/comments`, { content }, { headers, timeout: 10000 });
      if (response.status === 201 && response.data?.success) {
        return { success: true, comment: response.data.data?.comment };
      }
      return { success: false, message: response.data?.message || 'Failed to add comment' };
    } catch (error: any) {
      console.error('❌ Error adding comment:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async updateComment(feedId: string | number, commentId: string | number, content: string): Promise<FeedComment | null> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}/feeds/${feedId}/comments/${commentId}`, { content }, { headers, timeout: 10000 });
      if (response.status === 200 && response.data?.success) {
        return response.data.data?.comment || null;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error updating comment:', error.response?.data || error.message);
      return null;
    }
  }

  public async deleteComment(feedId: string | number, commentId: string | number): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/feeds/${feedId}/comments/${commentId}`, { headers, timeout: 10000 });
      return response.status === 200 && response.data?.success;
    } catch (error: any) {
      console.error('❌ Error deleting comment:', error.response?.data || error.message);
      return false;
    }
  }

  public async reportComment(commentId: string | number, reason: string): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/report/comment/report/${commentId}`, { reason }, { headers, timeout: 10000 });
      return response.status === 201 || response.status === 200;
    } catch (error: any) {
      console.error('❌ Error reporting comment:', error.response?.data || error.message);
      return false;
    }
  }

  // ── COMMENT REPLIES ──────────────────────────────────────────────────────

  public async getCommentReplies(commentId: string | number): Promise<FeedCommentReply[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/api/comments/${commentId}/replies`, { headers, timeout: 10000 });
      if (response.data?.success) {
        return response.data.data?.replies || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching replies:', error.response?.data || error.message);
      return [];
    }
  }

  public async addCommentReply(commentId: string | number, content: string, parentReplyId?: string | number): Promise<FeedCommentReply | null> {
    try {
      const headers = await this.getHeaders();
      const body: any = { content };
      if (parentReplyId) body.parentReplyId = parentReplyId;
      const response = await axios.post(`${this.baseUrl}/feeds/api/comments/${commentId}/replies`, body, { headers, timeout: 10000 });
      if (response.status === 200 || response.status === 201) {
        return response.data || null;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error adding reply:', error.response?.data || error.message);
      return null;
    }
  }

  public async updateCommentReply(replyId: string | number, content: string): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}/feeds/api/replies/${replyId}`, { content }, { headers, timeout: 10000 });
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Error updating reply:', error.response?.data || error.message);
      return false;
    }
  }

  public async deleteCommentReply(replyId: string | number): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/feeds/api/replies/${replyId}`, { headers, timeout: 10000 });
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Error deleting reply:', error.response?.data || error.message);
      return false;
    }
  }

  // ── CREATE FEED (full multipart with media, poll, location, schedule) ────

  public async createFeedFull(params: {
    content: string;
    postType?: string;
    isDraft?: boolean;
    scheduledAt?: Date | null;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    mediaFiles?: { uri: string; type: string; name: string }[];
    pollOptions?: string[];
    allowMultipleVotes?: boolean;
    pollExpiresAt?: Date | null;
    groupId?: string | number | null;
    privacyLevel?: string;
  }): Promise<{ success: boolean; feed?: Feed; message?: string }> {
    try {
      console.log('🔄 Creating feed post (full)...');
      const token = await authService.getToken();
      const formData = new FormData();

      formData.append('content', params.content);
      formData.append('post_type', params.postType || 'general');
      formData.append('is_draft', params.isDraft ? '1' : '0');
      if (params.privacyLevel) formData.append('privacy_level', params.privacyLevel);
      if (params.groupId) formData.append('group_id', String(params.groupId));
      if (params.location) formData.append('location', params.location);
      if (params.latitude != null) formData.append('latitude', String(params.latitude));
      if (params.longitude != null) formData.append('longitude', String(params.longitude));
      if (params.scheduledAt) formData.append('scheduled_at', params.scheduledAt.toISOString());
      if (params.pollOptions && params.pollOptions.length > 0) {
        formData.append('poll_options', JSON.stringify(params.pollOptions));
        formData.append('allow_multiple_votes', params.allowMultipleVotes ? '1' : '0');
        if (params.pollExpiresAt) formData.append('poll_expires_at', params.pollExpiresAt.toISOString());
      }

      if (params.mediaFiles && params.mediaFiles.length > 0) {
        params.mediaFiles.forEach((file, index) => {
          formData.append(`media_files[${index}]`, {
            uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
            name: file.name || `media_${index}_${Date.now()}.jpg`,
            type: file.type === 'video' ? 'video/mp4' : 'image/jpeg',
          } as any);
        });
      }

      const response = await axios.post(`${this.baseUrl}/feeds/feeds`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 30000,
      });

      if ((response.status === 201 || response.status === 200) && response.data?.success) {
        return { success: true, feed: response.data.data?.feed, message: 'Posted successfully' };
      }
      return { success: false, message: response.data?.message || 'Failed to create post' };
    } catch (error: any) {
      console.error('Error creating feed (full):', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // ── CREATE GROUP ────────────────────────────────────────────────────────

  public async createGroup(params: {
    name: string;
    description: string;
    privacyLevel: 'public' | 'private';
    category?: string;
    tags?: string[];
    rules?: string;
    location?: string;
    website?: string;
    allowMemberPosts?: boolean;
    requirePostApproval?: boolean;
    allowMemberInvites?: boolean;
    coverImage?: { uri: string; type: string; name: string } | null;
    profileImage?: { uri: string; type: string; name: string } | null;
  }): Promise<{ success: boolean; group?: Group; message?: string }> {
    try {
      console.log('🔄 Creating group:', params.name);
      const token = await authService.getToken();
      const formData = new FormData();

      formData.append('name', params.name);
      formData.append('description', params.description);
      formData.append('privacy_level', params.privacyLevel);
      formData.append('allow_member_posts', params.allowMemberPosts !== false ? '1' : '0');
      formData.append('require_post_approval', params.requirePostApproval ? '1' : '0');
      formData.append('allow_member_invites', params.allowMemberInvites !== false ? '1' : '0');
      if (params.category) formData.append('category', params.category);
      if (params.tags && params.tags.length > 0) formData.append('tags', JSON.stringify(params.tags));
      if (params.rules) formData.append('rules', params.rules);
      if (params.location) formData.append('location', params.location);
      if (params.website) formData.append('website', params.website);
      if (params.coverImage) formData.append('cover_image', { uri: params.coverImage.uri, type: params.coverImage.type, name: params.coverImage.name } as any);
      if (params.profileImage) formData.append('profile_image', { uri: params.profileImage.uri, type: params.profileImage.type, name: params.profileImage.name } as any);

      const response = await axios.post(`${this.baseUrl}/feeds/groups`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 30000,
      });

      if ((response.status === 201 || response.status === 200) && response.data?.success) {
        return { success: true, group: response.data.data?.group, message: 'Group created successfully' };
      }
      return { success: false, message: response.data?.message || 'Failed to create group' };
    } catch (error: any) {
      console.error('❌ Error creating group:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // ── UPDATE GROUP ────────────────────────────────────────────────────────
  public async updateGroup(
    groupId: string | number,
    params: {
      name?: string;
      description?: string;
      privacy_level?: 'public' | 'private';
      location?: string;
      website?: string;
      rules?: string[];
      tags?: string[];
      allow_member_posts?: boolean;
      require_post_approval?: boolean;
      allow_member_invites?: boolean;
      require_join_approval?: boolean;
    }
  ): Promise<{ success: boolean; group?: Group; message?: string }> {
    try {
      console.log('🔄 Updating group:', groupId);
      const headers = await this.getHeaders();
      const response = await axios.patch(
        `${this.baseUrl}/feeds/groups/${groupId}`,
        params,
        { headers, timeout: 15000 }
      );
      if (response.data?.success) {
        return { success: true, group: response.data.data?.group, message: 'Group updated' };
      }
      return { success: false, message: response.data?.message || 'Failed to update group' };
    } catch (error: any) {
      console.error('❌ Error updating group:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // ── USER GROUPS (for CreatePostScreen group selector) ───────────────────

  public async getUserGroups(userId: string | number): Promise<Group[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/user/${userId}/groups`, {
        headers,
        params: { page: 1, limit: 50 },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return response.data.data?.groups || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching user groups:', error.response?.data || error.message);
      return [];
    }
  }

  // ── SHARE FEED ──────────────────────────────────────────────────────────

  public async sharePost(feedId: string | number): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/${feedId}/share`, {}, { headers, timeout: 10000 });
      return response.status === 200 || response.status === 201;
    } catch (error: any) {
      console.error('❌ Error sharing post:', error.response?.data || error.message);
      return false;
    }
  }

  // ── NOTIFICATIONS ───────────────────────────────────────────────────────

  public async getNotifications(limit: number = 50, offset: number = 0): Promise<AppNotification[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/notifications`, {
        headers,
        params: { limit, offset },
        timeout: 10000,
      });
      if (response.status === 200) {
        return response.data?.notifications || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching notifications:', error.response?.data || error.message);
      return [];
    }
  }

  public async getUnreadNotificationsCount(): Promise<number> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/notifications/unseen/count`, {
        headers,
        timeout: 10000,
      });
      if (response.status === 200) {
        return response.data?.unseen_count ?? 0;
      }
      return 0;
    } catch (error: any) {
      console.error('❌ Error fetching unseen count:', error.response?.data || error.message);
      return 0;
    }
  }

  public async markNotificationRead(notificationId: string | number): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/notifications/${notificationId}/read`, {}, { headers, timeout: 10000 });
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Error marking notification read:', error.response?.data || error.message);
      return false;
    }
  }

  public async markAllNotificationsRead(): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/notifications/read-all`, {}, { headers, timeout: 10000 });
      return response.status === 200;
    } catch (error: any) {
      console.error('Error marking all notifications read:', error.response?.data || error.message);
      return false;
    }
  }

  public async deleteNotification(notificationId: string | number): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/notifications/${notificationId}`, { headers, timeout: 10000 });
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Error deleting notification:', error.response?.data || error.message);
      return false;
    }
  }

  // ── POLL RESULTS ─────────────────────────────────────────────────────────

  public async getPollResults(feedId: string | number): Promise<any> {
    try {
      console.log(`🔄 Fetching poll results for feed: ${feedId}...`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/${feedId}/poll/results`, {
        headers,
        timeout: 10000
      });
      if (response.status === 200 && response.data?.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching poll results:', error.response?.data || error.message);
      return null;
    }
  }

  // ── EDIT MEDIA ───────────────────────────────────────────────────────────

  public async deleteFeedMedia(feedId: string | number, mediaId: string | number): Promise<boolean> {
    try {
      console.log(`🔄 Deleting media ${mediaId} from feed post ${feedId}...`);
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/feeds/${feedId}/media/${mediaId}`, {
        headers,
        timeout: 10000
      });
      return response.status === 200 && response.data?.success;
    } catch (error: any) {
      console.error('❌ Error deleting feed media:', error.response?.data || error.message);
      return false;
    }
  }

  public async addFeedMedia(feedId: string | number, mediaFiles: any[]): Promise<boolean> {
    try {
      console.log(`🔄 Adding ${mediaFiles.length} media files to feed post ${feedId}...`);
      const headers = await this.getHeaders();
      const formData = new FormData();

      mediaFiles.forEach((file) => {
        formData.append('media[]', {
          uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
          name: file.name || `image_${Date.now()}.jpg`,
          type: file.type === 'video' ? 'video/mp4' : 'image/jpeg',
        } as any);
      });

      const response = await axios.post(`${this.baseUrl}/feeds/${feedId}/media`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 20000
      });
      return response.status === 200 && response.data?.success;
    } catch (error: any) {
      console.error('❌ Error adding feed media:', error.response?.data || error.message);
      return false;
    }
  }

  // ── DRAFTS ───────────────────────────────────────────────────────────────

  public async getDrafts(page: number = 1, limit: number = 20): Promise<Feed[]> {
    try {
      console.log(`🔄 Fetching draft feeds - page: ${page}, limit: ${limit}`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/drafts`, {
        headers,
        params: { page, limit },
        timeout: 10000
      });
      if (response.status === 200 && response.data?.success) {
        return response.data.data?.drafts || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching drafts:', error.response?.data || error.message);
      return [];
    }
  }

  public async publishDraft(feedId: string | number, scheduledAt?: Date | null): Promise<boolean> {
    try {
      console.log(`🔄 Publishing draft feed: ${feedId}...`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/${feedId}/publish`, {
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : null
      }, {
        headers,
        timeout: 10000
      });
      return response.status === 200 && response.data?.success;
    } catch (error: any) {
      console.error('❌ Error publishing draft:', error.response?.data || error.message);
      return false;
    }
  }

  // Get groups managed by the user
  public async getManagedGroups(): Promise<Group[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/groups/managed`, {
        headers,
        timeout: 10000
      });
      if (response.status === 200 && response.data?.success) {
        console.log(`🔄 Fetching managed groups success`);
        return response.data.data?.groups || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching managed groups:', error.response?.data || error.message);
      return [];
    }
  }

  /** GET /api/events/my/organized */
  public async getMyOrganizedEvents(limit = 20, offset = 0): Promise<PaginatedEvents> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/my/organized`, {
        headers,
        params: { limit, offset },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        const raw = response.data.data || [];
        return {
          events: raw.map(normalizeEvent),
          total: response.data.pagination?.total ?? raw.length,
          hasMore: response.data.pagination?.has_more ?? false,
        };
      }
      return { events: [], total: 0, hasMore: false };
    } catch (error: any) {
      console.error('❌ Error fetching organized events:', error.response?.data || error.message);
      return { events: [], total: 0, hasMore: false };
    }
  }

  // Cancel/delete an event
  public async cancelEvent(eventId: string | number): Promise<any> {
    try {
      console.log(`🔄 Cancelling event: ${eventId}...`);
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/events/${eventId}/cancel`, {}, {
        headers,
        timeout: 10000
      });

      if (response.status === 200) {
        return { success: true, message: response.data?.message || 'Event cancelled successfully' };
      }
      return { success: false, message: response.data?.message || 'Cancellation failed' };
    } catch (error: any) {
      console.error('❌ Error cancelling event:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  /** POST /api/events */
  public async createEvent(params: {
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    location: string;
    max_attendees?: number | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    event_type?: string;
    organizer_type: 'user' | 'association' | 'group';
    organizer_association_id?: string | number | null;
    organizer_group_id?: string | number | null;
    privacy_level?: 'public' | 'private';
    allowed_roles?: string[];
    allowed_users?: string[];
    tags?: string[];
    category_ids?: string[] | number[];
    banner_image?: { uri: string; type: string; name: string } | null;
  }): Promise<{ success: boolean; event?: Event; message?: string }> {
    try {
      console.log('🔄 Creating event:', params.title);
      const token = await authService.getToken();
      const formData = new FormData();

      formData.append('title', params.title);
      formData.append('description', params.description);
      formData.append('start_time', params.start_time);
      formData.append('end_time', params.end_time);
      formData.append('location', params.location);
      formData.append('organizer_type', params.organizer_type);

      if (params.max_attendees != null) formData.append('max_attendees', String(params.max_attendees));
      if (params.email) formData.append('email', params.email);
      if (params.phone) formData.append('phone', params.phone);
      if (params.website) formData.append('website', params.website);
      if (params.event_type) formData.append('event_type', params.event_type);
      if (params.organizer_association_id != null) formData.append('organizer_association_id', String(params.organizer_association_id));
      if (params.organizer_group_id != null) formData.append('organizer_group_id', String(params.organizer_group_id));
      if (params.privacy_level) formData.append('privacy_level', params.privacy_level);
      if (params.allowed_roles && params.allowed_roles.length > 0) {
        formData.append('allowed_roles', JSON.stringify(params.allowed_roles));
      }
      if (params.allowed_users && params.allowed_users.length > 0) {
        formData.append('allowed_users', JSON.stringify(params.allowed_users));
      }
      if (params.tags && params.tags.length > 0) {
        formData.append('tags', JSON.stringify(params.tags));
      }
      if (params.category_ids && params.category_ids.length > 0) {
        formData.append('category_ids', JSON.stringify(params.category_ids));
      }

      if (params.banner_image) {
        formData.append('banner_image', {
          uri: Platform.OS === 'ios' ? params.banner_image.uri.replace('file://', '') : params.banner_image.uri,
          type: params.banner_image.type || 'image/jpeg',
          name: params.banner_image.name || `event_${Date.now()}.jpg`
        } as any);
      }

      const response = await axios.post(`${this.baseUrl}/events`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 30000,
      });

      if ((response.status === 201 || response.status === 200) && response.data?.success) {
        return { success: true, event: normalizeEvent(response.data.data), message: 'Event created successfully' };
      }
      return { success: false, message: response.data?.message || 'Failed to create event' };
    } catch (error: any) {
      console.error('❌ Error creating event:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  /** GET /api/events/:id/members */
  public async getEventMembers(eventId: string | number, limit = 50, offset = 0): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/${eventId}/members`, {
        headers,
        params: { limit, offset },
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return {
          success: true,
          members: response.data.data || [],
          total: response.data.total ?? 0,
          is_admin: response.data.is_admin ?? false,
          pagination: response.data.pagination,
        };
      }
      return { success: false, members: [], total: 0, is_admin: false };
    } catch (error: any) {
      console.error('❌ Error fetching event members:', error.response?.data || error.message);
      return { success: false, members: [], total: 0, is_admin: false };
    }
  }

  /** DELETE /api/events/:id/members/:userId */
  public async removeEventMember(eventId: string | number, userId: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/events/${eventId}/members/${userId}`, {
        headers,
        timeout: 10000,
      });
      if (response.status === 200 && response.data?.success) {
        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data?.message || 'Failed to remove member' };
    } catch (error: any) {
      console.error('❌ Error removing event member:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  // ── GROUP DELEGATION & ROLE MANAGEMENT ───────────────────────────────────

  public async delegateGroupRole(
    groupId: string | number,
    data: { receiver_id?: string | number; receiver_email?: string; role?: string }
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/groups/${groupId}/delegate`, data, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        message: response.data?.message,
        data: response.data?.data
      };
    } catch (error: any) {
      console.error('❌ Error delegating group role:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async cancelGroupDelegation(delegationId: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/groups/delegations/${delegationId}/cancel`, {}, { headers, timeout: 10000 });
      return { success: response.data?.success ?? false, message: response.data?.message };
    } catch (error: any) {
      console.error('❌ Error cancelling group delegation:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async acceptGroupDelegation(delegationId: string | number): Promise<{ success: boolean; message?: string; group?: any }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/groups/delegations/${delegationId}/accept`, {}, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        message: response.data?.message,
        group: response.data?.group
      };
    } catch (error: any) {
      console.error('❌ Error accepting group delegation:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async refuseGroupDelegation(delegationId: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/feeds/groups/delegations/${delegationId}/refuse`, {}, { headers, timeout: 10000 });
      return { success: response.data?.success ?? false, message: response.data?.message };
    } catch (error: any) {
      console.error('❌ Error refusing group delegation:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async getSentGroupDelegations(groupId: string | number): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/groups/${groupId}/delegations/sent`, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        data: response.data?.data,
        message: response.data?.message
      };
    } catch (error: any) {
      console.error('❌ Error fetching sent group delegations:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async getReceivedGroupDelegations(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/feeds/groups/delegations/received`, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        data: response.data?.data ?? [],
        message: response.data?.message
      };
    } catch (error: any) {
      console.error('❌ Error fetching received group delegations:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async setGroupMemberRole(
    groupId: string | number,
    memberUserId: string | number,
    role: string
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/feeds/groups/${groupId}/members/${memberUserId}/role`,
        { role },
        { headers, timeout: 10000 }
      );
      return {
        success: response.data?.success ?? false,
        message: response.data?.message,
        data: response.data?.data
      };
    } catch (error: any) {
      console.error('❌ Error setting group member role:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async addEventMember(
    eventId: string | number,
    payload: { user_id?: number | string; email?: string }
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/events/${eventId}/members`,
        payload,
        { headers, timeout: 10000 }
      );
      return {
        success: response.data?.success ?? false,
        message: response.data?.message,
        data: response.data?.data
      };
    } catch (error: any) {
      console.error('❌ Error adding event member:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async delegateEventAdmin(
    eventId: string | number,
    payload: { user_id?: number | string; email?: string }
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/events/${eventId}/delegations`,
        payload,
        { headers, timeout: 10000 }
      );
      return {
        success: response.data?.success ?? false,
        message: response.data?.message,
        data: response.data?.data
      };
    } catch (error: any) {
      console.error('❌ Error delegating event admin:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async getEventDelegations(eventId: string | number): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/${eventId}/delegations`, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        data: response.data?.data ?? [],
        message: response.data?.message
      };
    } catch (error: any) {
      console.error('❌ Error fetching event delegations:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async cancelEventDelegation(delegationId: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/events/delegations/${delegationId}`, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        message: response.data?.message
      };
    } catch (error: any) {
      console.error('❌ Error cancelling event delegation:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async acceptEventDelegation(delegationId: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/events/delegations/${delegationId}/accept`, {}, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        message: response.data?.message
      };
    } catch (error: any) {
      console.error('❌ Error accepting event delegation:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async declineEventDelegation(delegationId: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/events/delegations/${delegationId}/decline`, {}, { headers, timeout: 10000 });
      return {
        success: response.data?.success ?? false,
        message: response.data?.message
      };
    } catch (error: any) {
      console.error('❌ Error declining event delegation:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async sendEventInvitations(
    eventId: string | number,
    invitees: any[],
    assignedRole: string = 'PARTICIPANT'
  ): Promise<{ success: boolean; message?: string; data?: any; errors?: any[] }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/events/invitations/event/${eventId}`,
        { invitees, assigned_role: assignedRole },
        { headers, timeout: 15000 }
      );
      return {
        success: response.data?.success ?? false,
        message: response.data?.message,
        data: response.data?.data,
        errors: response.data?.errors,
      };
    } catch (error: any) {
      console.error('❌ Error sending event invitations:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  public async getMyEventInvitations(): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/invitations/my`, { headers, timeout: 10000 });
      if (response.data?.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching user event invitations:', error.response?.data || error.message);
      return [];
    }
  }

  public async respondToEventInvitation(
    invitationId: string | number,
    action: 'accept' | 'decline'
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/events/invitations/${invitationId}/respond`,
        { action },
        { headers, timeout: 10000 }
      );
      return {
        success: response.data?.success ?? false,
        message: response.data?.message,
      };
    } catch (error: any) {
      console.error('❌ Error responding to event invitation:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }
}

export default new FeedService();
