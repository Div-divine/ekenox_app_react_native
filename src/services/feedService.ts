import axios from 'axios';
import { ApiConfig } from '../config/api';
import authService from './authService';

export interface Feed {
  id: number;
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
  group_id?: number | null;
  user: {
    id: number;
    full_name: string;
    username: string;
    avatar_url?: string;
    profile_image?: string;
  };
  media?: Array<{
    id: number;
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

  // Backwards compatibility mappings for older components
  has_media: boolean;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  author: {
    id: number;
    full_name: string;
    profile_image?: string;
    pseudo?: string;
  };
}

export interface Group {
  id: number;
  name: string;
  description: string;
  members_count: number;
  privacy_level: 'public' | 'private';
  profile_image_url?: string;
  cover_image_url?: string;
  creator?: {
    id: number;
    full_name: string;
  };
  user_membership?: {
    role: string;
    joined_at: string;
    status: string;
  } | null;
  category?: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  bannerImage?: string;
  attendeesCount?: number;
  isRegistered?: boolean;
}

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
  public async getFeeds(page: number = 1, limit: number = 10, groupId?: number): Promise<Feed[]> {
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
  public async createFeed(content: string, groupId?: number): Promise<any> {
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
  public async toggleReaction(feedId: number, reactionType: string = 'like'): Promise<any> {
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
      console.log(`🔄 Fetching groups - type: ${type}, page: ${page}`);
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
        return response.data.data?.groups || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching groups:', error.response?.data || error.message);
      return [];
    }
  }

  // Get single group details
  public async getGroupDetails(groupId: number): Promise<any> {
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
  public async joinGroup(groupId: number): Promise<any> {
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
  public async leaveGroup(groupId: number): Promise<any> {
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
  public async getGroupEvents(groupId: number, limit: number = 20, offset: number = 0): Promise<Event[]> {
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

  // Get all active featured events (for main Feed tab)
  public async getEvents(limit: number = 20, offset: number = 0): Promise<Event[]> {
    try {
      console.log(`🔄 Fetching featured events`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events`, {
        headers,
        params: { limit, offset },
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching featured events:', error.response?.data || error.message);
      return [];
    }
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
  public async updateFeed(feedId: number, content: string): Promise<boolean> {
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
  public async deleteFeed(feedId: number): Promise<boolean> {
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
  public async reportFeed(feedId: number, reason: string): Promise<boolean> {
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
  public async votePoll(feedId: number, optionIndex: number): Promise<any> {
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
  public async registerForEvent(eventId: number): Promise<any> {
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
  public async unregisterFromEvent(eventId: number): Promise<any> {
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

  // Get user registered events list
  public async getMyRegisteredEvents(): Promise<Event[]> {
    try {
      console.log(`🔄 Fetching user's registered events...`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/events/my/registered`, {
        headers,
        timeout: 10000
      });

      if (response.status === 200 && response.data?.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching registered events:', error.response?.data || error.message);
      return [];
    }
  }
}

export default new FeedService();
