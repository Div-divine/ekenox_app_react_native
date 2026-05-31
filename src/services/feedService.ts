import axios from 'axios';
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

export interface Group {
  id: string | number;
  name: string;
  description: string;
  members_count: number;
  privacy_level: 'public' | 'private';
  profile_image_url?: string;
  cover_image_url?: string;
  creator?: {
    id: string | number;
    full_name: string;
  };
  user_membership?: {
    role: string;
    joined_at: string;
    status: string;
    can_invite?: boolean;
  } | null;
  category?: string;
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
  attendeesCount: raw.attendees_count ?? raw.attendeesCount ?? 0,
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
        return response.data.data || [];
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
      console.log(`🔄 Fetching stories from backend API...`);
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
        return {
          success: true,
          pollResults: response.data.poll_results
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

  // Invite a user (by ID) to a group
  public async inviteUserToGroup(groupId: string | number, userId: string | number): Promise<any> {
    try {
      console.log(`🔄 Inviting user ${userId} to group ${groupId}`);
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/feeds/groups/${groupId}/invite`,
        { user_id: userId },
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error inviting user to group:', error.response?.data || error.message);
      const msg = error.response?.data?.error || error.message || 'Invite failed';
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
}

export default new FeedService();
