import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from '../models/User';
import authService, { AuthResult } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string, name?: string) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  resendVerificationEmail: (userId: number) => Promise<AuthResult>;
  updateUser: (user: User) => Promise<void>;
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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        logout,
        resendVerificationEmail,
        updateUser,
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
