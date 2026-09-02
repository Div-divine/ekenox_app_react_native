import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';

const BASE = `${ApiConfig.apiUrl}`;

async function getHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface ChallengeCategory {
  id: number;
  name: string;
  display_name: string;
}

export interface Challenge {
  id: string | number;
  title: string;
  description: string;
  category: ChallengeCategory;
  co2_reduction_per_day: number;
  water_saving_per_day: number;
  energy_saving_per_day: number;
  level: number;
  participants_count: number;
  posts_count?: number;
  comments_count?: number;
  is_active: boolean;
  active_start_date?: string | null;
  availability: {
    can_join: boolean;
    reason: string;
  };
  image?: string;
  image_url?: string;
  tips?: Array<{ id: number; tip: string }>;
  created_at?: string;
  updated_at?: string | null;
}

class ChallengeService {
  /** Get all challenge categories */
  async getCategories(): Promise<any[]> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/categories`, { headers });
    return res.data?.data?.categories || [];
  }

  /** Get single challenge details with tips */
  async getChallenge(id: string | number): Promise<Challenge> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/challenges/${id}`, { headers, params: { include_tips: 'true' } });
    return res.data?.data?.challenge;
  }

  /** Get all challenges with optional page, limit, category_id, level, include_tips */
  async getChallenges(params?: {
    page?: number;
    limit?: number;
    category_id?: number | string;
    level?: number;
    include_tips?: boolean;
  }): Promise<{
    success: boolean;
    data: {
      challenges: Challenge[];
      pagination: any;
      user_limits: any;
    };
  }> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/challenges`, { headers, params });
    return res.data;
  }

  /** Get active user challenges */
  async getActiveChallenges(): Promise<{
    success: boolean;
    data: {
      active_challenges: any[];
      challenge_limits: any;
    };
  }> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/user/challenges/active`, { headers });
    return res.data;
  }

  /** Get user challenge stats and environmental impact */
  async getStats(): Promise<{
    success: boolean;
    data: {
      challenge_stats: any;
      environmental_impact: any;
    };
  }> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/user/challenges/stats`, { headers });
    return res.data;
  }

  /** Join a challenge with planned duration. Supports restart and resume action if conflict occurs */
  async joinChallenge(id: string | number, plannedDurationDays: number, action = 'start', kickOffDate?: string): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/challenges/${id}/join`,
      { planned_duration_days: plannedDurationDays, action, kick_off_date: kickOffDate },
      { headers }
    );
    return res.data;
  }

  /** Get expired user challenges */
  async getExpiredChallenges(): Promise<{
    success: boolean;
    data: {
      expired_challenges: any[];
    };
  }> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/user/challenges/expired`, { headers });
    return res.data;
  }

  /** Mark progress for specific day */
  async markProgress(challengeId: string | number, date: string, completed = true): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(
      `${BASE}/user/challenges/${challengeId}/progress/mark`,
      { date, completed },
      { headers }
    );
    return res.data;
  }

  /** Complete an active challenge */
  async completeChallenge(challengeId: string | number): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/user/challenges/${challengeId}/complete`, {}, { headers });
    return res.data;
  }

  /** Quit/abort an active challenge */
  async quitChallenge(challengeId: string | number): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE}/user/challenges/${challengeId}/quit`, {}, { headers });
    return res.data;
  }

  /** Get detailed user challenge progress check-ins */
  async getChallengeProgress(challengeId: string | number, params?: { start_date?: string; end_date?: string }): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/user/challenges/${challengeId}/progress`, { headers, params });
    return res.data;
  }

  /** Get today's progress check-ins */
  async getTodayProgress(): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/user/challenges/today`, { headers });
    return res.data;
  }

  /** Get global leaderboard */
  async getLeaderboard(params?: { limit?: number; period?: string }): Promise<any> {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE}/leaderboard`, { headers, params });
    return res.data;
  }
}

export default new ChallengeService();
