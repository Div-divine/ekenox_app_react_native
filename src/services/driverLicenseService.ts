import axios from 'axios';
import { ApiConfig } from '../config/api';
import authService from './authService';

export interface DriverLicense {
  id: string;
  licenseNumber: string;
  expiryDate: string;
  licenseClass: string;
  issuingAuthority: string;
  imagePath?: string;
  verified?: boolean;
}

class DriverLicenseService {
  private baseUrl = ApiConfig.apiUrl;

  private async getHeaders(isMultipart = false) {
    const token = await authService.getToken();
    return {
      'Content-Type': isMultipart ? 'multipart/form-data' : 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Get user's driver license
   */
  public async getDriverLicense(): Promise<DriverLicense | null> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/driver-license`, { headers });
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching driver license:', error);
      return null;
    }
  }

  /**
   * Create or Register Driver License details
   */
  public async createDriverLicense(licenseData: {
    licenseNumber: string;
    expiryDate: string;
    licenseClass: string;
    issuingAuthority: string;
  }): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/driver-license`, licenseData, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error creating driver license:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to save details' };
    }
  }

  /**
   * Update Driver License details
   */
  public async updateDriverLicense(licenseData: {
    licenseNumber?: string;
    expiryDate?: string;
    licenseClass?: string;
    issuingAuthority?: string;
  }): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}/driver-license`, licenseData, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error updating driver license:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to update details' };
    }
  }

  /**
   * Upload Driver License image
   */
  public async uploadLicenseImage(imageUri: string): Promise<any> {
    try {
      const headers = await this.getHeaders(true);
      const formData = new FormData();
      const fileType = imageUri.split('.').pop();
      const filename = `license_${Date.now()}.${fileType}`;

      formData.append('image', {
        uri: imageUri,
        name: filename,
        type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`,
      } as any);

      const response = await axios.post(`${this.baseUrl}/driver-license/upload-image`, formData, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error uploading license image:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to upload photo' };
    }
  }
}

export default new DriverLicenseService();
