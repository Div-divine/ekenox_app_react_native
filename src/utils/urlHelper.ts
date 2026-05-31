import { ApiConfig } from '../config/api';

export class UrlHelper {
  /**
   * Convert relative path to full URL
   */
  static convertPathToUrl(relativePath?: string): string {
    if (!relativePath || relativePath.trim() === '') {
      return 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=500'; // Sleek green eco default
    }
    
    // If it's already a full URL, return as is (handling localhost mappings)
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      if (relativePath.includes('localhost') || relativePath.includes('127.0.0.1')) {
        return relativePath.replace(/http:\/\/localhost:8000|http:\/\/127.0.0.1:8000/g, ApiConfig.baseUrl);
      }
      return relativePath;
    }
    
    // Remove leading slash if present to avoid double slashes
    const cleanPath = relativePath.startsWith('/') 
        ? relativePath.substring(1) 
        : relativePath;
    
    return `${ApiConfig.baseUrl}/${cleanPath}`;
  }
  
  /**
   * Get story avatar URL with fallback logic
   */
  static getStoryAvatarUrl(userAvatar?: string, thumbnailUrl?: string): string {
    // Priority: user avatar -> thumbnail -> default
    if (userAvatar && userAvatar.trim() !== '') {
      return this.convertPathToUrl(userAvatar);
    }
    
    if (thumbnailUrl && thumbnailUrl.trim() !== '') {
      return this.convertPathToUrl(thumbnailUrl);
    }
    
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'; // Default premium avatar
  }
  
  /**
   * Get full video URL
   */
  static getVideoUrl(videoPath?: string): string {
    return this.convertPathToUrl(videoPath);
  }
  
  /**
   * Get full thumbnail URL
   */
  static getThumbnailUrl(thumbnailPath?: string): string {
    return this.convertPathToUrl(thumbnailPath);
  }
  
  /**
   * Get full profile image URL
   */
  static getProfileImageUrl(profileImagePath?: string): string {
    return this.convertPathToUrl(profileImagePath);
  }

  /**
   * Get full event banner URL
   */
  static getEventImageUrl(bannerPath?: string): string {
    return this.convertPathToUrl(bannerPath);
  }
}
