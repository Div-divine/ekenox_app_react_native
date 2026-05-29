import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from '../models/User';
import authService, { AuthResult } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string, name?: string) => Promise<AuthResult>;
  socialLogin: (provider: string, token: string) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  resendVerificationEmail: (userId: number) => Promise<AuthResult>;
  updateUser: (user: User) => Promise<void>;
  completeOnboarding: () => Promise<AuthResult>;
  refreshProfile: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and load stored credentials
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const storedToken = await authService.getToken();
        const storedUser = await authService.getStoredUser();
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          
          // Verify session and load latest profile status
          const profileResult = await authService.getUserProfile();
          if (profileResult.success && profileResult.user) {
            setUser(profileResult.user);
          } else {
            console.warn('Session invalid or expired, clearing credentials');
            await authService.clearToken();
            await authService.clearUser();
            setToken(null);
            setUser(null);
          }
        }
      } catch (e) {
        console.warn('Failed to load local auth credentials', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    setIsLoading(true);
    const result = await authService.loginWithEmail(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      const tokenVal = await authService.getToken();
      setToken(tokenVal);
    }
    setIsLoading(false);
    return result;
  };

  const signup = async (email: string, password: string, name?: string): Promise<AuthResult> => {
    setIsLoading(true);
    const result = await authService.signUpWithEmail(email, password, name);
    if (result.success && result.user) {
      setUser(result.user);
      const tokenVal = await authService.getToken();
      setToken(tokenVal);
    }
    setIsLoading(false);
    return result;
  };

  const socialLogin = async (provider: string, accessToken: string): Promise<AuthResult> => {
    setIsLoading(true);
    const result = await authService.loginWithSocial(provider, accessToken);
    if (result.success && result.user) {
      setUser(result.user);
      const tokenVal = await authService.getToken();
      setToken(tokenVal);
    }
    setIsLoading(false);
    return result;
  };

  const logout = async (): Promise<AuthResult> => {
    setIsLoading(true);
    const result = await authService.logout();
    setUser(null);
    setToken(null);
    setIsLoading(false);
    return result;
  };

  const resendVerificationEmail = async (userId: number): Promise<AuthResult> => {
    return await authService.resendVerification(userId);
  };

  const updateUser = async (updatedUser: User): Promise<void> => {
    await authService.saveUser(updatedUser);
    setUser(updatedUser);
  };

  const completeOnboarding = async (): Promise<AuthResult> => {
    setIsLoading(true);
    const result = await authService.updateOnboardingStatus(true);
    if (result.success) {
      const freshUser = await authService.getStoredUser();
      if (freshUser) {
        setUser(freshUser);
      }
    }
    setIsLoading(false);
    return result;
  };

  const refreshProfile = async (): Promise<AuthResult> => {
    const result = await authService.getUserProfile();
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        socialLogin,
        logout,
        resendVerificationEmail,
        updateUser,
        completeOnboarding,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
