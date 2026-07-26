import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config/api';
import { User, parseUserFromJson } from '../models/User';

export interface AuthResult {
  success: boolean;
  user?: User;
  message: string;
  userId?: number;
}

class AuthService {
  private baseUrl = ApiConfig.apiUrl;

  // Get headers for API requests
  private async getHeaders() {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // Store JWT token
  public async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem('jwt_token', token);
  }

  // Get stored JWT token
  public async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('jwt_token');
  }

  // Clear stored token
  public async clearToken(): Promise<void> {
    await AsyncStorage.removeItem('jwt_token');
  }

  // Store user data
  public async saveUser(user: User): Promise<void> {
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
  }

  // Get stored user data
  public async getStoredUser(): Promise<User | null> {
    const userData = await AsyncStorage.getItem('user_data');
    if (userData) {
      try {
        return JSON.parse(userData) as User;
      } catch (e) {
        console.error('Error parsing stored user data', e);
        return null;
      }
    }
    return null;
  }

  // Clear stored user data
  public async clearUser(): Promise<void> {
    await AsyncStorage.removeItem('user_data');
  }

  // Login with email and password
  public async loginWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('🔄 Requesting Login...');
      // Since fcmToken is optional and requires Firebase, we'll leave it undefined/null for now unless configured
      const response = await axios.post(`${this.baseUrl}${ApiConfig.authLogin}`, {
        email,
        password,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      console.log('=== LOGIN DEBUG INFO ===');
      console.log('Status Code:', response.status);
      console.log('Response Body:', response.data);

      const data = response.data;
      if (response.status === 200 && data.success === true) {
        try {
          const token = data.data?.token;
          if (!token) {
            return {
              success: false,
              message: 'No authentication token received',
            };
          }
          await this.saveToken(token);

          const userData = data.data?.user;
          if (!userData) {
            return {
              success: false,
              message: 'No user data received',
            };
          }

          const user = parseUserFromJson(userData);
          await this.saveUser(user);

          return {
            success: true,
            user,
            message: data.message || 'Login successful',
          };
        } catch (parseError: any) {
          console.error('❌ ERROR parsing response data:', parseError);
          return {
            success: false,
            message: `Error parsing login response: ${parseError.message}`,
          };
        }
      } else {
        return {
          success: false,
          message: data.message || 'Login failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Network/API error in loginWithEmail:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Register user with email and password
  public async signUpWithEmail(email: string, password: string, name?: string): Promise<AuthResult> {
    try {
      console.log('🔄 Requesting Signup...');
      const response = await axios.post(`${this.baseUrl}${ApiConfig.authRegister}`, {
        email,
        password,
        full_name: name,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const data = response.data;
      if ((response.status === 201 || response.status === 200) && data.success === true) {
        const token = data.data?.token;
        if (token) {
          await this.saveToken(token);
        }

        const userData = data.data?.user;
        let user: User | undefined;
        if (userData) {
          user = parseUserFromJson(userData);
          await this.saveUser(user);
        }

        return {
          success: true,
          user,
          message: data.message || 'Registration successful',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Registration failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Network/API error in signUpWithEmail:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Logout
  public async logout(): Promise<AuthResult> {
    try {
      const headers = await this.getHeaders();
      try {
        await axios.post(`${this.baseUrl}/auth/logout`, {}, { headers, timeout: 5000 });
      } catch (e) {
        console.warn('API logout call failed/warned:', e);
      }

      await this.clearToken();
      await this.clearUser();

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (e: any) {
      await this.clearToken();
      await this.clearUser();
      return {
        success: true,
        message: 'Logout completed locally',
      };
    }
  }

  // Resend Verification Email
  public async resendVerification(userId: number): Promise<AuthResult> {
    try {
      console.log(`🔄 Resending verification for user ID: ${userId}`);
      const response = await axios.post(`${this.baseUrl}${ApiConfig.resendVerification(userId)}`, {}, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const data = response.data;
      if (response.status === 200 && data.success === true) {
        return {
          success: true,
          message: data.message || 'Verification email sent successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to send verification email',
        };
      }
    } catch (error: any) {
      console.error('❌ Resend verification error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }
  // Forgot Password
  public async forgotPassword(email: string): Promise<AuthResult> {
    try {
      console.log(`🔄 Requesting password reset for: ${email}`);
      const response = await axios.post(`${this.baseUrl}${ApiConfig.forgotPassword}`, {
        email,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const data = response.data;
      if (response.status === 200 && data.success === true) {
        return {
          success: true,
          message: data.message || 'Password reset email sent successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to send password reset email',
        };
      }
    } catch (error: any) {
      console.error('❌ Forgot password error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Validate reset token
  public async validateResetToken(token: string): Promise<AuthResult> {
    try {
      console.log(`🔄 Validating reset token...`);
      const response = await axios.post(`${this.baseUrl}${ApiConfig.validateResetToken}`, {
        token,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const data = response.data;
      if (response.status === 200 && data.success === true) {
        return {
          success: true,
          message: data.message || 'Token is valid',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Invalid or expired token',
        };
      }
    } catch (error: any) {
      console.error('❌ Token validation error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Reset password with token
  public async resetPasswordWithToken(token: string, newPassword: string): Promise<AuthResult> {
    try {
      console.log(`🔄 Resetting password with token...`);
      const response = await axios.post(`${this.baseUrl}${ApiConfig.resetPassword}`, {
        token,
        password: newPassword,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const data = response.data;
      if (response.status === 200 && data.success === true) {
        return {
          success: true,
          message: data.message || 'Password reset successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Password reset failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Update onboarding status
  public async updateOnboardingStatus(hasSeenOnboarding: boolean): Promise<AuthResult> {
    try {
      console.log(`🔄 Updating onboarding status to: ${hasSeenOnboarding}`);
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}${ApiConfig.updateOnboarding}`, {
        has_seen_onboarding: hasSeenOnboarding,
      }, {
        headers,
        timeout: 10000,
      });

      const data = response.data;
      if (response.status === 200 && data.success === true) {
        // Update stored user data
        const currentUser = await this.getStoredUser();
        if (currentUser) {
          currentUser.hasSeenOnboarding = hasSeenOnboarding;
          await this.saveUser(currentUser);
          console.log('✅ Local user data updated with onboarding status');
        }
        return {
          success: true,
          message: data.message || 'Onboarding status updated',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to update onboarding status',
        };
      }
    } catch (error: any) {
      console.error('❌ Update onboarding error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Get user profile
  public async getUserProfile(): Promise<AuthResult> {
    try {
      console.log(`🔄 Fetching user profile from server...`);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseUrl}${ApiConfig.userInfo}`, {
        headers,
        timeout: 10000,
      });

      const data = response.data;
      if (response.status === 200 && data.data) {
        const user = parseUserFromJson(data.data);
        await this.saveUser(user);
        return {
          success: true,
          user,
          message: data.message || 'Profile retrieved successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to retrieve user profile',
        };
      }
    } catch (error: any) {
      console.error('❌ Get user profile error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Social login/sign up via OAuth accessToken
  public async loginWithSocial(provider: string, accessToken: string, refreshToken?: string): Promise<AuthResult> {
    try {
      console.log(`🔄 Requesting Social SSO Login for provider: ${provider}...`);
      const response = await axios.post(`${this.baseUrl}/auth/social/${provider.toLowerCase()}`, {
        access_token: accessToken,
        refresh_token: refreshToken || null,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      console.log('=== SOCIAL LOGIN DEBUG INFO ===');
      console.log('Status Code:', response.status);
      console.log('Response Body:', response.data);

      const data = response.data;
      if ((response.status === 200 || response.status === 201) && data.success === true) {
        const token = data.data?.token;
        if (!token) {
          return {
            success: false,
            message: 'No authentication token received',
          };
        }
        await this.saveToken(token);

        const userData = data.data?.user;
        if (!userData) {
          return {
            success: false,
            message: 'No user data received',
          };
        }

        const user = parseUserFromJson(userData);
        await this.saveUser(user);

        return {
          success: true,
          user,
          message: data.message || 'Social login successful',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Social login failed',
        };
      }
    } catch (error: any) {
      console.error('❌ Network/API error in loginWithSocial:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Update user profile data
  public async updateProfileData(data: {
    fullName?: string;
    pseudo?: string;
    bio?: string;
    location?: string;
    website?: string;
    birth_date?: string;
  }): Promise<AuthResult> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseUrl}/users/me/update-user`, {
        full_name: data.fullName,
        pseudo: data.pseudo,
        bio: data.bio,
        location: data.location,
        website: data.website,
        birth_date: data.birth_date,
      }, {
        headers,
        timeout: 10000,
      });

      const resData = response.data;
      if (response.status === 200 && resData.data) {
        const user = parseUserFromJson(resData.data);
        await this.saveUser(user);
        return {
          success: true,
          user,
          message: resData.message || 'Profile updated successfully',
        };
      } else {
        return {
          success: false,
          message: resData.message || 'Failed to update profile',
        };
      }
    } catch (error: any) {
      console.error('❌ Update profile data error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }

  // Upload profile image
  public async uploadProfileImage(uri: string): Promise<AuthResult> {
    try {
      const headers = await this.getHeaders();
      
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      
      formData.append('profile_image', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await axios.post(`${this.baseUrl}/users/me/profile-image`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 15000,
      });

      const resData = response.data;
      if (response.status === 200 && resData.data) {
        return {
          success: true,
          message: resData.data.message || 'Profile image uploaded successfully',
        };
      } else {
        return {
          success: false,
          message: resData.message || 'Failed to upload image',
        };
      }
    } catch (error: any) {
      console.error('❌ Upload profile image error:', error);
      const message = error.response?.data?.message || error.message || 'Network error';
      return {
        success: false,
        message,
      };
    }
  }
}

export default new AuthService();
