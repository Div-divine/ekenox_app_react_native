import axios from 'axios';
import { ApiConfig } from '../config/api';
import authService from './authService';

export interface Vehicle {
  id: string | number;
  make: string;
  model: string;
  year: string;
  color?: string;
  licensePlate: string;
  registrationNumber?: string;
  registrationExpiry?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
  photoUrls?: string[];
  isVerified?: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
}

class VehicleService {
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
   * Get user's vehicles list
   */
  public async getVehicles(): Promise<Vehicle[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/vehicles`, { headers });
      if (response.data && response.data.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching vehicles list:', error);
      return [];
    }
  }

  /**
   * Get single vehicle details
   */
  public async getVehicleById(id: string | number): Promise<Vehicle | null> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/vehicles/${id}`, { headers });
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching vehicle ${id}:`, error);
      return null;
    }
  }

  /**
   * Register a new vehicle
   */
  public async createVehicle(vehicleData: {
    make: string;
    model: string;
    year: string;
    color?: string;
    license_plate: string;
    registration_number?: string;
    registration_expiry?: string;
    insurance_provider?: string;
    insurance_policy_number?: string;
    insurance_expiry?: string;
  }): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/vehicles`, vehicleData, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error creating vehicle:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to register vehicle' };
    }
  }

  /**
   * Update vehicle details
   */
  public async updateVehicle(id: string | number, vehicleData: any): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}/vehicles/${id}`, vehicleData, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error updating vehicle:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to update vehicle' };
    }
  }

  /**
   * Delete a vehicle
   */
  public async deleteVehicle(id: string | number): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/vehicles/${id}`, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error deleting vehicle:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to delete vehicle' };
    }
  }

  /**
   * Upload vehicle photos
   */
  public async uploadVehiclePhotos(id: string | number, photoUris: string[]): Promise<any> {
    try {
      const headers = await this.getHeaders(true);
      const formData = new FormData();

      photoUris.forEach((uri, index) => {
        const fileType = uri.split('.').pop();
        const filename = `vehicle_${id}_photo_${index}.${fileType}`;
        formData.append('photos[]', {
          uri,
          name: filename,
          type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`,
        } as any);
      });

      const response = await axios.post(`${this.baseUrl}/vehicles/${id}/photos`, formData, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error uploading vehicle photos:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to upload photos' };
    }
  }

  /**
   * Delete vehicle photo
   */
  public async deleteVehiclePhoto(id: string | number, photoUrl: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      // URL encode the photo url parameter to pass in path
      const encodedPhoto = encodeURIComponent(photoUrl);
      const response = await axios.delete(`${this.baseUrl}/vehicles/${id}/photos/${encodedPhoto}`, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error deleting vehicle photo:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to delete photo' };
    }
  }
}

export default new VehicleService();
