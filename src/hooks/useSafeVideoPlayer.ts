import { useVideoPlayer as useExpoVideoPlayer, VideoPlayer, VideoSource } from 'expo-video';

/**
 * Safe wrapper around expo-video's useVideoPlayer.
 * Catches native "The current activity is no longer available" errors during 
 * navigation, unmounting, fast refresh, or app backgrounding.
 */
export function useSafeVideoPlayer(
  source: VideoSource | string | null,
  setup?: (player: VideoPlayer) => void
): VideoPlayer | null {
  try {
    // If source is null or empty string, pass null safely
    const validSource = source ? source : null;
    const player = useExpoVideoPlayer(validSource, (p) => {
      if (setup && p) {
        try {
          setup(p);
        } catch (e) {
          console.warn('Error in VideoPlayer setup callback:', e);
        }
      }
    });
    return player;
  } catch (err: any) {
    console.warn('Expo VideoPlayer initialization deferred (Activity transient):', err?.message || err);
    return null;
  }
}
