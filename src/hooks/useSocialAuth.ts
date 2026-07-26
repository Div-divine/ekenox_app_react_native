import { useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SocialAuthConfig } from '../config/socialAuthConfig';

// Required for web browser redirect to complete properly
WebBrowser.maybeCompleteAuthSession();

/**
 * Custom hook that provides real OAuth sign-in flows for Google and Facebook.
 * Mirrors the eco_conscience Flutter implementation:
 *   1. Opens provider's OAuth consent screen
 *   2. Gets a real access_token
 *   3. Sends it to the Symfony API backend via AuthContext.socialLogin()
 */
export function useSocialAuth() {
  const { socialLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // ─── Google Auth Setup ───
  // Note: For native Google OAuth, do not pass custom redirectUri because
  // Google requires the reverse client ID scheme which is handled automatically.
  const [googleRequest, googleResponse, googlePromptAsync] =
    Google.useAuthRequest({
      webClientId: SocialAuthConfig.google.webClientId,
      androidClientId: SocialAuthConfig.google.androidClientId,
      iosClientId: SocialAuthConfig.google.iosClientId,
    });

  // ─── Facebook Auth Setup ───
  const [facebookRequest, facebookResponse, facebookPromptAsync] =
    Facebook.useAuthRequest({
      clientId: SocialAuthConfig.facebook.appId,
      redirectUri: AuthSession.makeRedirectUri({ scheme: 'ekenox' }),
    });

  // ─── Handle Google Response ───
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      if (authentication?.accessToken) {
        handleSocialLoginResult('google', authentication.accessToken);
      } else {
        setIsLoading(false);
        Alert.alert('Google Sign-In Failed', 'Failed to get Google access token.');
      }
    } else if (googleResponse?.type === 'error') {
      setIsLoading(false);
      Alert.alert(
        'Google Sign-In Error',
        googleResponse.error?.message || 'An error occurred during Google sign-in.'
      );
    } else if (googleResponse?.type === 'dismiss') {
      setIsLoading(false);
    }
  }, [googleResponse]);

  // ─── Handle Facebook Response ───
  useEffect(() => {
    if (facebookResponse?.type === 'success') {
      const { authentication } = facebookResponse;
      if (authentication?.accessToken) {
        handleSocialLoginResult('facebook', authentication.accessToken);
      } else {
        setIsLoading(false);
        Alert.alert('Facebook Sign-In Failed', 'Failed to get Facebook access token.');
      }
    } else if (facebookResponse?.type === 'error') {
      setIsLoading(false);
      Alert.alert(
        'Facebook Sign-In Error',
        facebookResponse.error?.message || 'An error occurred during Facebook sign-in.'
      );
    } else if (facebookResponse?.type === 'dismiss') {
      setIsLoading(false);
    }
  }, [facebookResponse]);

  /**
   * Send the access_token to the Symfony backend via AuthContext.
   * This mirrors the eco_conscience pattern where:
   *   - Flutter gets the token from the native SDK
   *   - Sends it to POST /auth/social/{provider}
   *   - Backend validates it, creates/links user, returns JWT
   */
  const handleSocialLoginResult = async (provider: string, accessToken: string) => {
    try {
      console.log(`🔄 Sending ${provider} access_token to backend...`);
      const result = await socialLogin(provider, accessToken);

      if (result.success) {
        console.log(`✅ ${provider} authentication successful`);
        // AuthContext handles navigation via state update
      } else {
        Alert.alert(
          `${provider.charAt(0).toUpperCase() + provider.slice(1)} Auth Failed`,
          result.message || 'Authentication failed on the backend.'
        );
      }
    } catch (error: any) {
      console.error(`❌ ${provider} backend auth error:`, error);
      Alert.alert(
        'Authentication Error',
        error.message || 'An unexpected error occurred.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Public Methods ───

  const googleSignIn = useCallback(async () => {
    if (!googleRequest) {
      Alert.alert(
        'Google Sign-In',
        'Google Sign-In is not configured. Please add your Google Client IDs in socialAuthConfig.ts.'
      );
      return;
    }
    setIsLoading(true);
    console.log('🔄 Starting Google Sign-In...');
    // Log generated redirect URI to help user verify with Google Console configuration
    try {
      const googleRedirect = AuthSession.makeRedirectUri({
        scheme: 'ekenox',
      });
      console.log('🔗 Expected Google Redirect URI:', googleRedirect);
    } catch (e) {
      console.warn('⚠️ Could not generate debug Google redirect URI:', e);
    }
    await googlePromptAsync();
  }, [googleRequest, googlePromptAsync]);

  const facebookSignIn = useCallback(async () => {
    if (!facebookRequest) {
      Alert.alert(
        'Facebook Sign-In',
        'Facebook Sign-In is not configured. Please add your Facebook App ID in socialAuthConfig.ts.'
      );
      return;
    }
    setIsLoading(true);
    console.log('🔄 Starting Facebook Sign-In...');
    try {
      const facebookRedirect = AuthSession.makeRedirectUri({
        scheme: 'ekenox',
      });
      console.log('🔗 Facebook Redirect URI (register in Facebook Console):', facebookRedirect);
    } catch (e) {
      console.warn('⚠️ Could not generate debug Facebook redirect URI:', e);
    }
    await facebookPromptAsync();
  }, [facebookRequest, facebookPromptAsync]);

  return {
    googleSignIn,
    facebookSignIn,
    isLoading,
    /** Whether Google auth request is ready */
    isGoogleReady: !!googleRequest,
    /** Whether Facebook auth request is ready */
    isFacebookReady: !!facebookRequest,
  };
}
