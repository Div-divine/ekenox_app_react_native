import axios from 'axios';
import { ApiConfig } from '../config/api';
import authService from './authService';

export interface DashboardData {
  total_users: number;
  active_events: number;
  pending_reports: number;
  car_shares: number;
  new_users_today: number;
  pending_vehicles: number;
  active_challenges: number;
  system_health?: string;
  recent_activities?: Array<{
    id: number | string;
    type: string;
    description: string;
    timestamp: string;
  }>;
  system_status?: {
    database?: string;
    api_server?: string;
    file_storage?: string;
    email_service?: string;
  };
}

class AdminService {
  private baseUrl = ApiConfig.apiUrl;

  private async getHeaders() {
    const token = await authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // Get administrative dashboard statistics
  public async getDashboardData(): Promise<DashboardData | null> {
    try {
      console.log('🔄 Fetching admin dashboard data...');
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/admin/car-shares/dashboard`, {
        headers,
        timeout: 15000,
      });

      if (response.status === 200) {
        const resData = response.data;
        return resData.data ?? resData;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching admin dashboard data:', error.response?.data || error.message);
      return null;
    }
  }

  // Verifications
  public async getVerifications(status?: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/admin/verifications`, { headers, params: { status } });
      return response.data;
    } catch (e: any) {
      return { success: false, driver_licenses: [], vehicles: [] };
    }
  }

  public async getVerificationAuditLog(userId: number): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/admin/verifications/audit-log/${userId}`, { headers });
      return response.data?.data || [];
    } catch (e: any) {
      return [];
    }
  }

  public async verifyDriverLicense(id: number, approved: boolean, notes?: string): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.put(`${this.baseUrl}/admin/driver-licenses/${id}/verify`, { approved, notes }, { headers });
    return response.data;
  }

  public async verifyVehicle(id: number, approved: boolean, notes?: string): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.put(`${this.baseUrl}/admin/vehicles/${id}/verify`, { approved, notes }, { headers });
    return response.data;
  }

  public async verifyIdDocument(userId: number, approved: boolean, notes?: string): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.put(`${this.baseUrl}/admin/verifications/id/${userId}`, { approved, notes }, { headers });
    return response.data;
  }

  public async verifyFaceMatch(userId: number, approved: boolean, notes?: string): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.put(`${this.baseUrl}/admin/verifications/face/${userId}`, { approved, notes }, { headers });
    return response.data;
  }

  public async verifyPhone(userId: number, approved: boolean, notes?: string): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.put(`${this.baseUrl}/admin/verifications/phone/${userId}`, { approved, notes }, { headers });
    return response.data;
  }

  // Car Shares
  public async getCarShares(): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/admin/car-shares`, { headers });
      return response.data?.data || [];
    } catch (e: any) {
      return [];
    }
  }

  public async deleteCarShare(id: number): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.delete(`${this.baseUrl}/admin/car-shares/${id}`, { headers });
    return response.data;
  }

  // Eco Challenges
  public async getChallenges(): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/admin/challenges`, { headers });
      return response.data?.data || [];
    } catch (e: any) {
      return [];
    }
  }

  public async createChallenge(data: any): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.post(`${this.baseUrl}/admin/challenges`, data, { headers });
    return response.data;
  }

  public async deleteChallenge(id: number): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.delete(`${this.baseUrl}/admin/challenges/${id}`, { headers });
    return response.data;
  }

  // User Management
  public async getUsers(q?: string): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/admin/users`, { headers, params: { q } });
      return response.data?.data || [];
    } catch (e: any) {
      return [];
    }
  }

  public async toggleUserBlock(userId: number): Promise<any> {
    const headers = await this.getHeaders();
    const response = await axios.post(`${this.baseUrl}/admin/users/${userId}/toggle-block`, {}, { headers });
    return response.data;
  }
}

export default new AdminService();
