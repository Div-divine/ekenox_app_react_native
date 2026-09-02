import { ApiConfig } from '../config/api';

export class UrlHelper {
  /**
   * Convert relative or absolute server path to full HTTP URL
   */
  static convertPathToUrl(relativePath?: string): string {
    if (!relativePath || typeof relativePath !== 'string' || relativePath.trim() === '') {
      return 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=500'; // Fallback
    }

    let p = relativePath.trim().replace(/\\/g, '/');

    // If it's already a full HTTP/HTTPS URL
    if (p.startsWith('http://') || p.startsWith('https://')) {
      if (p.includes('localhost') || p.includes('127.0.0.1')) {
        return p.replace(/http:\/\/localhost:8000|http:\/\/127.0.0.1:8000/g, ApiConfig.baseUrl);
      }
      return p;
    }

    // Strip absolute server path prefix if present (e.g. .../public/uploads/... or .../api_ekenox_dev/public/...)
    const uploadsIndex = p.indexOf('uploads/');
    if (uploadsIndex !== -1) {
      p = p.substring(uploadsIndex);
    } else {
      // Auto-detect filename prefixes
      const filename = p.split('/').pop() || p;
      if (filename.startsWith('id_verification_')) {
        p = `uploads/verification/id_verification/${filename}`;
      } else if (filename.startsWith('face_match_')) {
        p = `uploads/verification/face_match/${filename}`;
      } else if (filename.startsWith('driver_license_')) {
        p = `uploads/verification/driver_license/${filename}`;
      } else if (filename.startsWith('vehicle_')) {
        p = `uploads/vehicles/${filename}`;
      }
    }

    // Remove leading slash if present
    const cleanPath = p.startsWith('/') ? p.substring(1) : p;

    return `${ApiConfig.baseUrl}/${cleanPath}`;
  }

  /**
   * Get story avatar URL with fallback logic
   */
  static getStoryAvatarUrl(userAvatar?: string, thumbnailUrl?: string): string {
    if (userAvatar && userAvatar.trim() !== '') {
      return this.convertPathToUrl(userAvatar);
    }
    if (thumbnailUrl && thumbnailUrl.trim() !== '') {
      return this.convertPathToUrl(thumbnailUrl);
    }
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
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
