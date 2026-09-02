import axios from 'axios';
import { ApiConfig } from '../config/api';
import authService from './authService';

export interface CarShareOffer {
  id: string | number;
  eventId: string | number;
  description: string;
  departureDate: string;
  departureTime: string;
  departureLocation: string;
  destinationLocation: string;
  availableSeats: number;
  bookedSeats: number;
  remainingSeats?: number;
  pricePerSeat?: string | number;
  notes?: string;
  vehicleType?: string;
  vehicleColor?: string;
  licensePlate?: string;
  contactPhone?: string;
  allowSmoking: boolean;
  allowPets: boolean;
  allowMusic: boolean;
  preferences?: {
    smoking?: boolean;
    pets?: boolean;
    music?: boolean;
  };
  status: 'active' | 'full' | 'cancelled';
  user: {
    id: string | number;
    fullName: string;
    profileImage?: string;
  };
  requests?: CarShareRequest[];
  approvedUserIds?: string[];
  bookedUserIds?: string[];
  isActive?: boolean;
  isCurrentUserOffer?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarShareRequest {
  id: string | number;
  carShareId: string | number;
  userId: string | number;
  userName: string;
  userImageUrl?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestTime: string;
  responseMessage?: string;
  responseTime?: string;
  user?: {
    id: string | number;
    full_name: string;
    profile_image?: string;
  };
  car_share?: any;
}

function mapCarShareOffer(data: any): CarShareOffer {
  if (!data) return data;
  
  // Extract user details
  const user = data.user ? {
    id: data.user.id,
    fullName: data.user.fullName || data.user.full_name || 'Driver',
    profileImage: data.user.profileImage || data.user.profile_image || undefined
  } : {
    id: '',
    fullName: 'Driver'
  };

  // Map requests
  const requests = data.requests ? data.requests.map((r: any) => mapCarShareRequest(r)) : [];

  // Map preferences
  const allowSmoking = data.allowSmoking !== undefined ? data.allowSmoking : (data.allow_smoking !== undefined ? data.allow_smoking : (data.preferences?.smoking ?? false));
  const allowPets = data.allowPets !== undefined ? data.allowPets : (data.allow_pets !== undefined ? data.allow_pets : (data.preferences?.pets ?? false));
  const allowMusic = data.allowMusic !== undefined ? data.allowMusic : (data.allow_music !== undefined ? data.allow_music : (data.preferences?.music ?? false));

  const availableSeats = data.availableSeats !== undefined ? data.availableSeats : (data.available_seats !== undefined ? data.available_seats : 0);
  const bookedSeats = data.bookedSeats !== undefined ? data.bookedSeats : (data.booked_seats !== undefined ? data.booked_seats : 0);

  return {
    id: data.id,
    eventId: data.eventId || data.event_id,
    description: data.description || '',
    departureDate: data.departureDate || data.departure_date || '',
    departureTime: data.departureTime || data.departure_time || '',
    departureLocation: data.departureLocation || data.departure_location || '',
    destinationLocation: data.destinationLocation || data.destination_location || '',
    availableSeats,
    bookedSeats,
    remainingSeats: availableSeats - bookedSeats,
    pricePerSeat: data.pricePerSeat !== undefined ? data.pricePerSeat : data.price_per_seat,
    notes: data.notes || '',
    vehicleType: data.vehicleType !== undefined ? data.vehicleType : data.vehicle_type,
    vehicleColor: data.vehicleColor !== undefined ? data.vehicleColor : data.vehicle_color,
    licensePlate: data.licensePlate !== undefined ? data.licensePlate : data.license_plate,
    contactPhone: data.contactPhone !== undefined ? data.contactPhone : data.contact_phone,
    allowSmoking: !!allowSmoking,
    allowPets: !!allowPets,
    allowMusic: !!allowMusic,
    preferences: data.preferences || { smoking: !!allowSmoking, pets: !!allowPets, music: !!allowMusic },
    status: data.status || 'active',
    user,
    requests,
    createdAt: data.createdAt || data.created_at || '',
    updatedAt: data.updatedAt || data.updated_at || ''
  };
}

function mapCarShareRequest(r: any): CarShareRequest {
  if (!r) return r;
  return {
    id: r.id,
    carShareId: r.carShareId || r.car_share_id,
    userId: r.userId || r.user_id || (r.user ? r.user.id : ''),
    userName: r.userName || r.user_name || (r.user ? (r.user.fullName || r.user.full_name) : 'User'),
    userImageUrl: r.userImageUrl || r.user_image_url || (r.user ? (r.user.profileImage || r.user.profile_image) : undefined),
    message: r.message,
    status: r.status,
    requestTime: r.requestTime || r.request_time || r.created_at || '',
    responseMessage: r.responseMessage || r.response_message || undefined,
    responseTime: r.responseTime || r.response_time || r.responded_at || undefined,
    user: r.user ? {
      id: r.user.id,
      full_name: r.user.fullName || r.user.full_name,
      profile_image: r.user.profileImage || r.user.profile_image
    } : undefined,
    car_share: r.car_share ? mapCarShareOffer(r.car_share) : undefined
  };
}

class CarShareService {
  private baseUrl = ApiConfig.apiUrl;

  private async getHeaders() {
    const token = await authService.getToken();
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Get car share offers with filters
   */
  public async getCarShares(filters: {
    event_id?: string | number;
    departure_location?: string;
    destination_location?: string;
    departure_date_from?: string;
    departure_date_to?: string;
    min_seats?: number;
    max_price?: number;
    vehicle_type?: string;
    allow_smoking?: boolean;
    allow_pets?: boolean;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/car-shares`, {
        headers,
        params: filters,
      });
      if (response.data && response.data.success) {
        response.data.data = (response.data.data || []).map(mapCarShareOffer);
      }
      return response.data;
    } catch (error) {
      console.error('Error fetching car shares:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get car share offers for a specific event
   */
  public async getEventCarShares(eventId: string | number): Promise<CarShareOffer[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/car-shares/events/${eventId}`, { headers });
      if (response.data && response.data.success) {
        return (response.data.data || []).map(mapCarShareOffer);
      }
      return [];
    } catch (error) {
      console.error(`Error fetching car shares for event ${eventId}:`, error);
      return [];
    }
  }

  /**
   * Get single car share offer details
   */
  public async getCarShareById(id: string | number): Promise<CarShareOffer | null> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/car-shares/${id}`, { headers });
      if (response.data && response.data.success) {
        return mapCarShareOffer(response.data.data);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching car share offer ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new car share offer
   */
  public async createCarShare(offerData: {
    event_id: string | number;
    description: string;
    departure_date: string;
    departure_time: string;
    departure_location: string;
    destination_location: string;
    available_seats: number;
    price_per_seat?: number;
    notes?: string;
    vehicle_type?: string;
    vehicle_color?: string;
    license_plate?: string;
    contact_phone?: string;
    allow_smoking: boolean;
    allow_pets: boolean;
    allow_music: boolean;
  }): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/car-shares`, offerData, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error creating car share offer:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to create offer' };
    }
  }

  /**
   * Update a car share offer
   */
  public async updateCarShare(id: string | number, offerData: any): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}/car-shares/${id}`, offerData, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error updating car share offer:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to update offer' };
    }
  }

  /**
   * Delete a car share offer
   */
  public async deleteCarShare(id: string | number): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/car-shares/${id}`, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error deleting car share offer:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to delete offer' };
    }
  }

  /**
   * Request to join a car share
   */
  public async requestToJoin(offerId: string | number, message?: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/car-shares/${offerId}/requests`, { message }, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error requesting to join car share:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to send request' };
    }
  }

  /**
   * Approve a car share request
   */
  public async approveRequest(offerId: string | number, requestId: string | number, responseMessage?: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(
        `${this.baseUrl}/car-shares/${offerId}/requests/${requestId}/approve`,
        { response_message: responseMessage },
        { headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error approving request:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to approve request' };
    }
  }

  /**
   * Reject a car share request
   */
  public async rejectRequest(offerId: string | number, requestId: string | number, responseMessage?: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(
        `${this.baseUrl}/car-shares/${offerId}/requests/${requestId}/reject`,
        { response_message: responseMessage },
        { headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error rejecting request:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to reject request' };
    }
  }

  /**
   * Cancel a car share request
   */
  public async cancelRequest(offerId: string | number, requestId: string | number): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.delete(`${this.baseUrl}/car-shares/${offerId}/requests/${requestId}/cancel`, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error cancelling request:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to cancel request' };
    }
  }

  /**
   * Leave a car share (for passengers already approved)
   */
  public async leaveCarShare(offerId: string | number): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseUrl}/car-shares/${offerId}/leave`, {}, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error leaving car share:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to leave car share' };
    }
  }

  /**
   * Report a car share ride
   */
  public async reportCarShare(offerId: string | number, reportType: string, description: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/car-shares/${offerId}/report`,
        { report_type: reportType, description },
        { headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error reporting car share:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Failed to submit report' };
    }
  }

  /**
   * Get user's offered rides
   */
  public async getUserOffers(): Promise<CarShareOffer[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/car-shares/me/offers`, { headers });
      if (response.data && response.data.success) {
        return (response.data.data || []).map(mapCarShareOffer);
      }
      return [];
    } catch (error) {
      console.error('Error fetching user offers:', error);
      return [];
    }
  }

  /**
   * Get user's join requests
   */
  public async getUserRequests(): Promise<CarShareRequest[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/car-shares/me/requests`, { headers });
      if (response.data && response.data.success) {
        return (response.data.data || []).map(mapCarShareRequest);
      }
      return [];
    } catch (error) {
      console.error('Error fetching user requests:', error);
      return [];
    }
  }

  /**
   * Get requests for user's offered rides
   */
  public async getIncomingRequests(): Promise<CarShareRequest[]> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}/car-shares/me/incoming-requests`, { headers });
      if (response.data && response.data.success) {
        return (response.data.data || []).map(mapCarShareRequest);
      }
      return [];
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
      return [];
    }
  }
}

export default new CarShareService();
