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
        // Handle response with or without success wrapping
        const resData = response.data;
        return resData.data ?? resData;
      }
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching admin dashboard data:', error.response?.data || error.message);
      return null;
    }
  }
}

export default new AdminService();
