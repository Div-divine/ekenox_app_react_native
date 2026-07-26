import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';

const BASE = `${ApiConfig.apiUrl}/marketplace`;

async function getHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface ProductFilterParams {
  listing_type?: string;
  category_id?: number;
  quality_id?: number;
  status?: string;
  search?: string;
  latitude?: number;
  longitude?: number;
  max_distance?: number;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  limit?: number;
}

class MarketplaceService {
  // ── Products ──
  async getProducts(params?: ProductFilterParams): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/products`, { headers, params });
    return res.data;
  }

  async getProduct(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/products/${id}`, { headers });
    return res.data;
  }

  async createProduct(data: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/products`, data, { headers });
    return res.data;
  }

  async updateProduct(id: number | string, data: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.put(`${BASE}/products/${id}`, data, { headers });
    return res.data;
  }

  async deleteProduct(id: number | string): Promise<boolean> {
    const headers = await getHeaders();
    await axios.delete(`${BASE}/products/${id}`, { headers });
    return true;
  }

  async toggleFavorite(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/products/${id}/favorite`, {}, { headers });
    return res.data;
  }

  async getMyProducts(page = 1, limit = 20): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/products/my-products`, { headers, params: { page, limit } });
    return res.data;
  }

  async getFavorites(page = 1, limit = 20): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/products/user/favorites`, { headers, params: { page, limit } });
    return res.data;
  }

  async renewProduct(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/products/${id}/renew`, {}, { headers });
    return res.data;
  }

  async updateProductStatus(id: number | string, status: string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.patch(`${BASE}/products/${id}/status`, { status }, { headers });
    return res.data;
  }

  async shareProduct(id: number | string, shareData: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/products/${id}/share`, shareData, { headers });
    return res.data;
  }

  // ── Categories ──
  async getCategories(parentId?: number): Promise<any[]> {
    const headers = await getHeaders();
    const params = parentId ? { parent_id: parentId } : {};
    const res = await axios.get(`${BASE}/categories`, { headers, params });
    return res.data.data ?? res.data ?? [];
  }

  async getCategoryTree(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/categories/tree`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  // ── Qualities ──
  async getQualities(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/qualities`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  // ── Reviews ──
  async getProductReviews(productId: number | string): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/products/${productId}/reviews`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  async addReview(productId: number | string, rating: number, comment: string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/products/${productId}/reviews`, { rating, comment }, { headers });
    return res.data;
  }

  // ── Swap Offers ──
  async getSwapOffers(): Promise<any[]> {
    try {
      const res = await this.getSentSwapOffers();
      return res;
    } catch (e) {
      return [];
    }
  }

  async createSwapOffer(productId: number | string, offeredProductId: number | string, message?: string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/swap-offers`, { product_id: productId, offered_product_id: offeredProductId, message }, { headers });
    return res.data;
  }

  async getSentSwapOffers(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/swap-offers/sent`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  async getReceivedSwapOffers(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/swap-offers/received`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  async acceptSwapOffer(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.put(`${BASE}/swap-offers/${id}/accept`, {}, { headers });
    return res.data;
  }

  async rejectSwapOffer(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.put(`${BASE}/swap-offers/${id}/reject`, {}, { headers });
    return res.data;
  }

  async cancelSwapOffer(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.delete(`${BASE}/swap-offers/${id}`, { headers });
    return res.data;
  }

  // ── Workshops ──
  async getWorkshops(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/workshops`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  async registerForWorkshop(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/workshops/${id}/register`, {}, { headers });
    return res.data;
  }

  async unregisterFromWorkshop(id: number | string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/workshops/${id}/unregister`, {}, { headers });
    return res.data;
  }

  async createWorkshop(data: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/workshops`, data, { headers });
    return res.data;
  }

  async getMyWorkshopRegistrations(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/workshops/my-registrations`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  // ── Affiliate ──
  async getAffiliatePartners(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/affiliates/partners`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  async getAffiliateProducts(params?: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/affiliates/products`, { headers, params });
    return res.data;
  }

  async trackAffiliateClick(productId: number | string): Promise<void> {
    const headers = await getHeaders();
    await axios.post(`${BASE}/affiliates/products/${productId}/click`, {}, { headers });
  }

  // ── Reports & Activity ──
  async reportListing(productId: number | string, reason: string, details?: string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/reports`, { product_id: productId, reason, additional_details: details }, { headers });
    return res.data;
  }

  async getActivityFeed(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/activity`, { headers });
    return res.data.data ?? res.data ?? [];
  }

  // ── Availability & Booking ──
  async getProductAvailability(productId: number | string, date?: string): Promise<any> {
    const headers = await getHeaders();
    const params = date ? { date } : {};
    const res = await axios.get(`${BASE}/products/${productId}/availability`, { headers, params });
    return res.data;
  }

  async bookSlot(slotId: number | string, data: any): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/products/slots/${slotId}/book`, data, { headers });
    return res.data;
  }
}

export default new MarketplaceService();
