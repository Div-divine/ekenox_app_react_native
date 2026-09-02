import { useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SocialAuthConfig } from '../config/socialAuthConfig';

// Required for web browser redirect completion in Expo AuthSession
WebBrowser.maybeCompleteAuthSession();

/**
 * Custom hook providing OAuth sign-in flows for Google and Facebook.
 * Fully aligned with eco_conscience backend authentication flow:
 *   1. Obtains user access_token from Google/Facebook OAuth provider
 *   2. Sends access_token to Symfony API POST /api/auth/social/{provider}
 *   3. Backend verifies token, creates/links user account, and returns JWT session
 */
export function useSocialAuth() {
  const { socialLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // ─── Google Auth Setup ───
  const [googleRequest, googleResponse, googlePromptAsync] =
    Google.useAuthRequest({
      webClientId: SocialAuthConfig.google.webClientId,
      androidClientId: SocialAuthConfig.google.androidClientId,
      iosClientId: SocialAuthConfig.google.iosClientId,
      responseType: AuthSession.ResponseType.Token,
      scopes: ['profile', 'email'],
    });

  // ─── Facebook Auth Setup ───
  const [facebookRequest, facebookResponse, facebookPromptAsync] =
    Facebook.useAuthRequest({
      clientId: SocialAuthConfig.facebook.appId,
      responseType: AuthSession.ResponseType.Token,
      scopes: ['public_profile', 'email'],
      redirectUri: AuthSession.makeRedirectUri({ scheme: 'ekenox' }),
    });

  // ─── Handle Social Auth Token & Backend Handshake ───
  const handleSocialLoginResult = async (provider: string, token: string) => {
    try {
      console.log(`🔄 Sending ${provider} token to Symfony backend (/api/auth/social/${provider})...`);
      const result = await socialLogin(provider, token);

      if (result.success) {
        console.log(`✅ ${provider} social login successful!`);
      } else {
        console.error(`❌ ${provider} social login rejected by backend:`, result.message);
        Alert.alert(
          `${provider.toUpperCase()} Auth Failed`,
          result.message || 'Authentication failed on server.'
        );
      }
    } catch (error: any) {
      console.error(`❌ ${provider} social login exception:`, error);
      Alert.alert(
        'Authentication Error',
        error.message || 'An unexpected error occurred during social login.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Handle Google Response ───
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const accessToken =
        googleResponse.authentication?.accessToken ||
        googleResponse.params?.access_token ||
        googleResponse.params?.id_token;

      if (accessToken) {
        handleSocialLoginResult('google', accessToken);
      } else {
        setIsLoading(false);
        Alert.alert('Google Sign-In Failed', 'Failed to retrieve Google access token.');
      }
    } else if (googleResponse?.type === 'error') {
      setIsLoading(false);
      console.error('Google Sign-In Error:', googleResponse.error);
      Alert.alert(
        'Google Sign-In Error',
        googleResponse.error?.message || 'An error occurred during Google sign-in.'
      );
    } else if (googleResponse?.type === 'dismiss' || googleResponse?.type === 'cancel') {
      setIsLoading(false);
    }
  }, [googleResponse]);

  // ─── Handle Facebook Response ───
  useEffect(() => {
    if (facebookResponse?.type === 'success') {
      const accessToken =
        facebookResponse.authentication?.accessToken ||
        facebookResponse.params?.access_token;

      if (accessToken) {
        handleSocialLoginResult('facebook', accessToken);
      } else {
        setIsLoading(false);
        Alert.alert('Facebook Sign-In Failed', 'Failed to retrieve Facebook access token.');
      }
    } else if (facebookResponse?.type === 'error') {
      setIsLoading(false);
      console.error('Facebook Sign-In Error:', facebookResponse.error);
      Alert.alert(
        'Facebook Sign-In Error',
        facebookResponse.error?.message || 'An error occurred during Facebook sign-in.'
      );
    } else if (facebookResponse?.type === 'dismiss' || facebookResponse?.type === 'cancel') {
      setIsLoading(false);
    }
  }, [facebookResponse]);

  // ─── Trigger Actions ───

  const googleSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Triggering Google OAuth flow...');
      const res = await googlePromptAsync();
      if (res?.type === 'cancel' || res?.type === 'dismiss') {
        setIsLoading(false);
      }
    } catch (e: any) {
      setIsLoading(false);
      console.error('Google Prompt Exception:', e);
      Alert.alert('Google Sign-In Error', e.message || 'Unable to open Google Sign-In prompt.');
    }
  }, [googlePromptAsync]);

  const facebookSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Triggering Facebook OAuth flow...');
      const res = await facebookPromptAsync();
      if (res?.type === 'cancel' || res?.type === 'dismiss') {
        setIsLoading(false);
      }
    } catch (e: any) {
      setIsLoading(false);
      console.error('Facebook Prompt Exception:', e);
      Alert.alert('Facebook Sign-In Error', e.message || 'Unable to open Facebook Sign-In prompt.');
    }
  }, [facebookPromptAsync]);

  return {
    googleSignIn,
    facebookSignIn,
    isLoading,
    isGoogleReady: !!googleRequest,
    isFacebookReady: !!facebookRequest,
  };
}
