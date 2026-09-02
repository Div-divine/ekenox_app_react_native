import axios from 'axios';
import { ApiConfig } from '../config/api';
import authService from './authService';

export interface UserVerificationStatus {
  id: string;
  user_id: string;
  id_verification: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  phone_verification: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  email_verification: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  driver_license_verification: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  vehicle_documents_verification: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  face_match_verification: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  verification_progress: number;
  is_fully_verified: boolean;
  pending_verifications: string[];
  last_updated: string;
  created_at: string;
}

class UserVerificationService {
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
   * Get user verification status
   */
  public async getVerificationStatus(): Promise<UserVerificationStatus | null> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/user-verification`, { headers });
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching verification status:', error);
      return null;
    }
  }

  /**
   * Submit ID verification documents
   */
  public async submitIdVerification(documentUris: string[]): Promise<any> {
    try {
      const headers = await this.getHeaders(true);
      const formData = new FormData();

      documentUris.forEach((uri, index) => {
        const fileType = uri.split('.').pop();
        const filename = `id_doc_${index}.${fileType}`;
        formData.append('documents[]', {
          uri,
          name: filename,
          type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`,
        } as any);
      });

      const response = await axios.post(`${this.baseUrl}/user-verification/id-verification`, formData, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error submitting ID verification:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to submit documents' };
    }
  }

  /**
   * Submit phone verification
   */
  public async submitPhoneVerification(phone: string, countryInfo: any): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/user-verification/phone-verification`, {
        phone,
        country_code: countryInfo.code,
        country_name: countryInfo.name,
        dial_code: countryInfo.dialCode,
        region: countryInfo.region || 'US',
      }, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error submitting phone verification:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to send SMS' };
    }
  }

  /**
   * Verify SMS Code
   */
  public async verifyPhoneCode(code: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/user-verification/phone-verification/verify`, {
        code,
      }, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error verifying SMS code:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Invalid verification code' };
    }
  }

  /**
   * Resend Verification Code via Email
   */
  public async resendPhoneVerificationEmail(): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/user-verification/phone-verification/resend-email`, {}, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error resending code via email:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to send code via email' };
    }
  }

  /**
   * Submit Face Match Selfie
   */
  public async submitFaceMatch(selfieUri: string): Promise<any> {
    try {
      const headers = await this.getHeaders(true);
      const formData = new FormData();
      const fileType = selfieUri.split('.').pop();
      const filename = `selfie.${fileType}`;

      formData.append('selfie', {
        uri: selfieUri,
        name: filename,
        type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`,
      } as any);

      const response = await axios.post(`${this.baseUrl}/user-verification/face-match`, formData, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error submitting face match selfie:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to upload selfie' };
    }
  }
}

export default new UserVerificationService();
