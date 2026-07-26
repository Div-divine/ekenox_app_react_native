/**
 * Social Auth Configuration
 *
 * ============================================================
 * CONSTANTS YOU NEED TO FILL IN:
 * ============================================================
 *
 * 1. GOOGLE_WEB_CLIENT_ID
 *    - Go to: https://console.cloud.google.com/apis/credentials
 *    - Create an OAuth 2.0 Client ID of type "Web application"
 *    - In a development build, Google requires the redirect URI to match your app's custom scheme.
 *      Add authorized redirect URI: ekenox://oauth2redirect
 *    - Copy the Client ID (looks like: 123456789-abc...xyz.apps.googleusercontent.com)
 *
 * 2. GOOGLE_ANDROID_CLIENT_ID
 *    - Same Google Cloud Console → Create OAuth 2.0 Client ID of type "Android"
 *    - Package name: com.ekenox.app (must match app.json android.package)
 *    - SHA-1 fingerprint: run `npx expo credentials:manager` or use your keystore
 *    - Copy the Client ID (e.g. 123456789-android-client-id.apps.googleusercontent.com)
 *
 * 3. GOOGLE_IOS_CLIENT_ID
 *    - Same Google Cloud Console → Create OAuth 2.0 Client ID of type "iOS"
 *    - Bundle ID: com.ekenox.app
 *    - Copy the Client ID
 *
 * 4. FACEBOOK_APP_ID
 *    - Go to: https://developers.facebook.com/apps/
 *    - Create or select your app
 *    - Copy the App ID from the dashboard (a numeric string like: 1234567890)
 *    - Under Facebook Login → Settings → Client OAuth Settings, ensure you configure
 *      Valid OAuth Redirect URIs to include your custom scheme:
 *      ekenox://
 *      ekenox://authorize
 *    - Under Settings → Basic, add platform "Android" with:
 *      - Package Name: com.ekenox.app
 *      - Key Hashes: your development key hashes (from expo credentials or your local keystore)
 *
 * ============================================================
 */

export const SocialAuthConfig = {
  google: {
    /**
     * Google OAuth 2.0 Web Client ID
     * Used for Expo Go and web builds
     */
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,

    /**
     * Google OAuth 2.0 Android Client ID
     * Used for standalone Android builds
     */
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,

    /**
     * Google OAuth 2.0 iOS Client ID
     * Used for standalone iOS builds
     */
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  },

  facebook: {
    /**
     * Facebook App ID (numeric string)
     * From developers.facebook.com dashboard
     */
    appId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
  },
};
