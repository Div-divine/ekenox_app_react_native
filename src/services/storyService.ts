import axios from 'axios';
import { ApiConfig } from '../config/api';
import authService from './authService';

class StoryService {
  private baseUrl = ApiConfig.apiUrl;

  private async getHeaders(isMultipart = false) {
    const token = await authService.getToken();
    return {
      ...(isMultipart ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Create a single-media story (image or video)
   */
  public async createSingleStory(formData: FormData): Promise<any> {
    try {
      const headers = await this.getHeaders(true);
      const response = await axios.post(`${this.baseUrl}/stories`, formData, {
        headers,
        transformRequest: (data) => data, // prevent Axios from converting FormData to string
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating single story:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to create story');
    }
  }

  /**
   * Create a carousel story with multiple slides
   */
  public async createCarouselStory(formData: FormData): Promise<any> {
    try {
      const headers = await this.getHeaders(true);
      const response = await axios.post(`${this.baseUrl}/stories/sequence`, formData, {
        headers,
        transformRequest: (data) => data, // prevent Axios from converting FormData to string
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating carousel story:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to create carousel story');
    }
  }

  /**
   * Fetch active stories
   */
  public async getStories(page = 1, limit = 20): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/stories`, {
        headers,
        params: { page, limit },
      });
      if (response.data?.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      console.error('Error fetching stories:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Toggle like on a story
   */
  public async toggleLike(storyId: string | number): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/stories/${storyId}/like`, {}, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error toggling like:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to toggle like');
    }
  }

  /**
   * Share a story
   */
  public async shareStory(storyId: string | number): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/stories/${storyId}/share`, {}, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error sharing story:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to share story');
    }
  }
}

export const storyService = new StoryService();
