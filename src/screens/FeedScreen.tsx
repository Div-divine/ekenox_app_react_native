import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Alert,
  FlatList,
  TextInput,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Clipboard,
  Dimensions,
  Share,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';
import feedService, { Feed, Group, Event } from '../services/feedService';
import chatService from '../services/chatService';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeVideoPlayer } from '../hooks/useSafeVideoPlayer';
import { useEventListener, useEvent } from 'expo';
import { UrlHelper } from '../utils/urlHelper';
import { FeedPollWidget } from './FeedPollWidget';
import associationService from '../services/associationService';
import collaborationService from '../services/collaborationService';
import { CustomActionSheetModal, ActionSheetOption } from '../components/CustomActionSheetModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Feed media preview height (~65% of the screen, like a 65vh layout)
const FEED_MEDIA_HEIGHT = SCREEN_HEIGHT * 0.65;

const MUSIC_LIBRARY = [
  { id: '1', title: 'Nature Whispers', singer: 'Green Harmony', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', title: 'Eco Beats', singer: 'DJ Earth', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', title: 'Rainforest Ambient', singer: 'Forest Soundscape', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: '4', title: 'Ocean Waves', singer: 'Sea Breeze', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: '5', title: 'Solar Wind', singer: 'Future Sound', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
];

// Cohesive Media URL Resolver leveraging the global UrlHelper utility
const resolveMediaUrl = (url?: string) => {
  return UrlHelper.convertPathToUrl(url);
};

const isVideoUrl = (url?: string) => {
  if (!url) return false;
  const lowercase = url.toLowerCase();
  return (
    lowercase.endsWith('.mp4') ||
    lowercase.endsWith('.mov') ||
    lowercase.endsWith('.avi') ||
    lowercase.endsWith('.mkv') ||
    lowercase.endsWith('.webm') ||
    lowercase.endsWith('.3gp') ||
    lowercase.includes('/videos/')
  );
};

const CARD_HEIGHT = SCREEN_HEIGHT * 0.78; // around 80vh

const PostVideoPlayer = ({
  videoUrl,
  style,
  shouldPlay,
  isMuted,
  onToggleMute,
  onFullscreen
}: {
  videoUrl: string;
  style: any;
  shouldPlay: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onFullscreen?: () => void;
}) => {
  const player = useSafeVideoPlayer(videoUrl, p => {
    p.loop = true;
    p.muted = isMuted;
  });

  const dummyObj = useRef({ playing: false, currentTime: 0, muted: isMuted, volume: 1 }).current;
  const targetPlayer = player || (dummyObj as any);

  const { isPlaying } = useEvent(targetPlayer, 'playingChange', { isPlaying: targetPlayer.playing }) as any;
  const { currentTime } = useEvent(targetPlayer, 'timeUpdate', { currentTime: targetPlayer.currentTime } as any) as any;
  const { muted: isVideoMuted } = useEvent(targetPlayer, 'mutedChange', { muted: targetPlayer.muted }) as any;
  const { volume: currentVolume } = useEvent(targetPlayer, 'volumeChange', { volume: targetPlayer.volume }) as any;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPlaying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!player) return;
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, player]);

  // Sync mute state from props
  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const toggleLocalMute = () => {
    onToggleMute();
  };

  const showSpeedOptions = () => {
    Alert.alert(
      'Playback Speed',
      'Select speed:',
      [
        { text: '0.75x', onPress: () => { if (player) player.playbackRate = 0.75; } },
        { text: 'Normal (1.0x)', onPress: () => { if (player) player.playbackRate = 1.0; } },
        { text: '1.25x', onPress: () => { if (player) player.playbackRate = 1.25; } },
        { text: '1.5x', onPress: () => { if (player) player.playbackRate = 1.5; } },
        { text: '2.0x', onPress: () => { if (player) player.playbackRate = 2.0; } },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleSettingsPress = () => {
    Alert.alert(
      'Video Settings',
      'Adjust playback settings:',
      [
        {
          text: `Playback Speed (Current: ${player?.playbackRate || 1}x)`,
          onPress: showSpeedOptions
        },
        {
          text: isMuted ? 'Unmute Video' : 'Mute Video',
          onPress: onToggleMute
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const duration = player?.duration || 0;
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  const handleProgressBarTouch = (e: any) => {
    if (progressBarWidth > 0 && duration > 0 && player) {
      const clickX = e.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, clickX / progressBarWidth));
      player.currentTime = percentage * duration;
    }
  };

  return (
    <View style={[style, { position: 'relative' }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Tap Overlay to play/pause */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={togglePlay}
        style={StyleSheet.absoluteFill}
      />

      {/* Pulse green playing badge */}
      {isPlaying && (
        <View style={styles.playingBadge}>
          <Animated.View style={[styles.playingDot, { opacity: pulseAnim }]} />
          <Text style={styles.playingText}>PLAYING</Text>
        </View>
      )}

      {/* Settings gear icon when playing */}
      {isPlaying && (
        <TouchableOpacity style={styles.videoSettingsBtn} activeOpacity={0.7} onPress={handleSettingsPress}>
          <Ionicons name="settings-sharp" size={18} color="white" />
        </TouchableOpacity>
      )}

      {/* Translucent center play overlay circle when paused */}
      {!isPlaying && (
        <View style={styles.pausedCenterOverlay}>
          <TouchableOpacity
            style={styles.pausedCenterClickArea}
            onPress={togglePlay}
            activeOpacity={1}
          >
            <View style={styles.pausedPlayCircle}>
              <Ionicons name="play" size={28} color="white" style={{ marginLeft: 3 }} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom controls panel */}
      <View style={styles.videoBottomPanel}>
        <View style={styles.videoBottomInfoRow}>
          <Text style={styles.videoTimeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
          <View style={styles.videoRightIcons}>
            <TouchableOpacity onPress={toggleLocalMute} style={styles.videoIconBtn}>
              <Ionicons
                name={isVideoMuted || currentVolume === 0 ? "volume-mute" : currentVolume < 0.5 ? "volume-low" : "volume-high"}
                size={20}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onFullscreen} style={styles.videoIconBtn}>
              <Ionicons name="expand" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom Progress Bar */}
        <View
          style={styles.progressBarWrapper}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
          onTouchStart={handleProgressBarTouch}
          onTouchMove={handleProgressBarTouch}
        >
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
              ]}
            />
            <View
              style={[
                styles.progressBarThumb,
                { left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
};


// Fullscreen media carousel viewer — same UX as the Profile screen gallery:
// tap an item to open, swipe between slides, videos play in-line, images are
// shown in full with "contain" so nothing gets cropped.
const FeedMediaCarouselViewer = ({
  visible,
  items,
  startIndex,
  onClose,
}: {
  visible: boolean;
  items: { url: string; type: 'image' | 'video' }[];
  startIndex: number;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const flatRef = useRef<FlatList<any>>(null);

  useEffect(() => {
    setCurrentIndex(startIndex);
    if (flatRef.current && visible) {
      setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: startIndex, animated: false });
      }, 80);
    }
  }, [startIndex, visible]);

  const onMomentumScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(newIndex);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.feedMediaViewerOverlay}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View style={[styles.feedMediaViewerHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.feedMediaViewerClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={26} color="white" />
          </TouchableOpacity>
          <Text style={styles.feedMediaViewerCounter}>{currentIndex + 1} / {items.length}</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Swipeable slides */}
        <FlatList
          ref={flatRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <FeedMediaCarouselSlide item={item} isActive={index === currentIndex} />
          )}
        />

        {/* Dots indicator */}
        {items.length > 1 && (
          <View style={[styles.feedMediaDotsRow, { paddingBottom: insets.bottom + 16 }]}>
            {items.map((_, i) => (
              <View key={i} style={[styles.feedMediaDot, i === currentIndex && styles.feedMediaDotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
};

function FeedMediaCarouselSlide({ item, isActive }: { item: { url: string; type: 'image' | 'video' }; isActive: boolean }) {
  const player = useSafeVideoPlayer(item.type === 'video' ? item.url : null, p => {
    if (p) {
      p.loop = false;
      p.muted = false;
    }
  });

  const dummyObj = useRef({ playing: false }).current;
  const targetPlayer = player || (dummyObj as any);
  const { isPlaying } = useEvent(targetPlayer, 'playingChange', { isPlaying: targetPlayer.playing }) as any;

  useEffect(() => {
    if (!player) return;
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  if (item.type === 'video') {
    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        {player ? (
          <VideoView
            player={player}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 }}
            contentFit="contain"
            nativeControls={true}
          />
        ) : (
          <ActivityIndicator color="white" size="large" />
        )}
        {!isPlaying && isActive && (
          <View pointerEvents="none">
            <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={{ uri: item.url }}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 }}
        resizeMode="contain"
      />
    </View>
  );
}


export const FeedScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [currentTab, setCurrentTab] = useState(0); // 0 = Feed, 1 = Groups
  const [posts, setPosts] = useState<Feed[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Feed pagination state
  const [feedPage, setFeedPage] = useState(1);
  const [hasMoreFeeds, setHasMoreFeeds] = useState(true);
  const [loadingMoreFeeds, setLoadingMoreFeeds] = useState(false);
  const [showFab, setShowFab] = useState(false);

  // Background music player
  const bgMusicPlayer = useSafeVideoPlayer(null, (p) => {
    if (p) p.loop = true;
  });

  // Dynamic Tip of the Day State
  const [dailyTip, setDailyTip] = useState<any>(null);

  // Auto-play and global mute states
  const postLayouts = useRef<{ [postId: string]: { y: number; height: number } }>({});
  const postsListY = useRef(0);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isFeedMuted, setIsFeedMuted] = useState(true);

  // Fullscreen media viewer (like the Profile screen gallery)
  const [feedMediaViewerVisible, setFeedMediaViewerVisible] = useState(false);
  const [feedMediaViewerItems, setFeedMediaViewerItems] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [feedMediaViewerIndex, setFeedMediaViewerIndex] = useState(0);

  const openFeedMedia = (post: Feed, startIndex = 0) => {
    const media = (post.media || []) as any[];
    if (!media.length) return;
    setFeedMediaViewerItems(
      media.map(m => ({
        url: resolveMediaUrl(m.url),
        type: m.type === 'video' || isVideoUrl(m.url) ? 'video' : 'image',
      }))
    );
    setFeedMediaViewerIndex(startIndex);
    setFeedMediaViewerVisible(true);
  };

  const loadMoreFeeds = async () => {
    if (loadingMoreFeeds || !hasMoreFeeds) return;
    setLoadingMoreFeeds(true);
    try {
      const nextPage = feedPage + 1;
      const newFeeds = await feedService.getFeeds(nextPage, 10);
      if (newFeeds && newFeeds.length > 0) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewFeeds = newFeeds.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNewFeeds];
        });
        setFeedPage(nextPage);
        setHasMoreFeeds(newFeeds.length === 10);
      } else {
        setHasMoreFeeds(false);
      }
    } catch (err) {
      console.error('Failed to load more feeds:', err);
    } finally {
      setLoadingMoreFeeds(false);
    }
  };

  const handleScroll = (event: any) => {
    const scrollOffset = event.nativeEvent.contentOffset.y;
    scrollY.setValue(scrollOffset);

    // Toggle FAB visibility based on scroll
    setShowFab(scrollOffset > 150);

    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;

    // Check if close to bottom
    if (contentHeight - layoutHeight - scrollOffset < 300) {
      loadMoreFeeds();
    }

    const centerY = scrollOffset + SCREEN_HEIGHT / 2.5; // Trigger play when post center reaches upper-middle of screen

    let closestPostId = null;
    let minDistance = Infinity;

    Object.entries(postLayouts.current).forEach(([postId, layout]) => {
      const postCenter = layout.y + layout.height / 2;
      const distance = Math.abs(centerY - postCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestPostId = postId;
      }
    });

    if (closestPostId && closestPostId !== activePostId) {
      setActivePostId(closestPostId);
    }
  };
  const [tipExpanded, setTipExpanded] = useState(false);
  const [showTip, setShowTip] = useState(true);

  // Stories State
  const [stories, setStories] = useState<any[]>([]);
  const [storyPage, setStoryPage] = useState(1);
  const [hasMoreStories, setHasMoreStories] = useState(true);
  const [loadingMoreStories, setLoadingMoreStories] = useState(false);
  const [storyModalVisible, setStoryModalVisible] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [storyVideoLoading, setStoryVideoLoading] = useState(false);
  const storyTimer = useRef<any | null>(null);
  const isFirstMount = useRef(true);

  // Story interaction state
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [storyLiked, setStoryLiked] = useState(false);
  const [storyLikeCount, setStoryLikeCount] = useState(0);
  const [storyReactions, setStoryReactions] = useState<Record<string, number>>({});
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [showStoryComments, setShowStoryComments] = useState(false);
  const [storyComments, setStoryComments] = useState<any[]>([]);
  const [storyCommentInput, setStoryCommentInput] = useState('');
  const [storyCommentSending, setStoryCommentSending] = useState(false);
  const [expandedReplyCommentId, setExpandedReplyCommentId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const storyViewRecorded = useRef<Record<string, boolean>>({});

  const [storyLikesList, setStoryLikesList] = useState<any[]>([]);
  const [storySharesList, setStorySharesList] = useState<any[]>([]);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showSharesModal, setShowSharesModal] = useState(false);
  const [storyLikesLoading, setStoryLikesLoading] = useState(false);
  const [storySharesLoading, setStorySharesLoading] = useState(false);

  const player = useSafeVideoPlayer(null, (p) => {
    if (p) p.loop = false;
  });

  // Group Explorer Tab State ('public' | 'user' | 'discover')
  const [groupActiveTab, setGroupActiveTab] = useState<'public' | 'user' | 'discover'>('public');

  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Unread Notification & Chat & Collaboration Count State
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pendingCollabCount, setPendingCollabCount] = useState(0);

  // Custom Edit Post Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Feed | null>(null);
  const [editingTextState, setEditingTextState] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Custom Action Sheet Modal State
  const [actionSheetConfig, setActionSheetConfig] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    options: ActionSheetOption[];
  }>({
    visible: false,
    title: 'Select an Action',
    options: [],
  });

  const scrollY = useRef(new Animated.Value(0)).current;

  const BRAND_BAR_HEIGHT = 0; // Brand bar removed; kept as 0 for scroll offset compat
  const HEADER_HEIGHT = 60 + BRAND_BAR_HEIGHT + insets.top;
  const headerTranslateY = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT).interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
  });

  const createBarTranslateY = Animated.diffClamp(scrollY, 0, 60).interpolate({
    inputRange: [0, 60],
    outputRange: [0, -60],
  });

  const START_Y = 197 + (showTip && dailyTip ? 150 : 0);
  const absoluteBarOpacity = scrollY.interpolate({
    inputRange: [START_Y - 20, START_Y],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    scrollY.setValue(0);
  }, [currentTab]);



  const loadStories = async (page: number, isRefresh: boolean = false) => {
    if (page === 1) {
      try {
        const list = await feedService.getStoryList(1, 6);
        setStories(list);
        setStoryPage(1);
        setHasMoreStories(list.length === 6);
      } catch (e) {
        console.error('Error loading page 1 stories:', e);
      }
    } else {
      if (loadingMoreStories || !hasMoreStories) return;
      setLoadingMoreStories(true);
      try {
        const list = await feedService.getStoryList(page, 6);
        if (list.length > 0) {
          setStories(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNewStories = list.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNewStories];
          });
          setStoryPage(page);
          setHasMoreStories(list.length === 6);
        } else {
          setHasMoreStories(false);
        }
      } catch (e) {
        console.error(`Error loading page ${page} stories:`, e);
      } finally {
        setLoadingMoreStories(false);
      }
    }
  };

  // Fetch all live data from Symphony backend
  const loadData = async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) setIsLoading(true);
      console.log('🔄 Fetching live data from Symfony backend...');

      // 1. Fetch Feeds
      const feedPosts = await feedService.getFeeds(1, 10);
      setPosts(feedPosts);
      setFeedPage(1);
      setHasMoreFeeds(feedPosts.length === 10);

      // 2. Fetch Stories
      await loadStories(1, true);

      // 3. Fetch Tips
      const tipData = await feedService.getDailyTipToday();
      setDailyTip(tipData);

      // 4. Fetch Featured Ongoing Events (using the dedicated /events/ongoing endpoint)
      const ongoingResult = await feedService.getOngoingEvents(5, 0);
      setEvents(ongoingResult.events);

      // 5. Fetch Groups based on current filter
      await fetchGroupsData(groupActiveTab);

      // 6. Fetch Unread Notifications, Chat Count & Pending Collaboration Count
      const count = await feedService.getUnreadNotificationsCount();
      setUnreadNotifCount(count);
      const chatCount = await chatService.getTotalUnreadCount();
      setUnreadChatCount(chatCount);
      const collabSummary = await collaborationService.getSummary().catch(() => null);
      setPendingCollabCount(collabSummary?.pending_received || 0);

    } catch (error) {
      console.error('❌ Failed to fetch feed/groups/events data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchGroupsData = async (filter: 'public' | 'user' | 'discover') => {
    try {
      const groupsList = await feedService.getGroups(filter, 1, 20);
      setGroups(groupsList);
    } catch (err) {
      console.error('❌ Failed to fetch groups:', err);
    }
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await feedService.getUnreadNotificationsCount();
      setUnreadNotifCount(count);
      const chatCount = await chatService.getTotalUnreadCount();
      setUnreadChatCount(chatCount);
      const collabSummary = await collaborationService.getSummary().catch(() => null);
      setPendingCollabCount(collabSummary?.pending_received || 0);
    } catch (err) {
      console.warn('Failed to load unread count:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 8000);
      return () => clearInterval(interval);
    }, [fetchUnreadCount])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      loadData(false);
    });
    return unsubscribe;
  }, [navigation, groupActiveTab]);

  // Update groups list when group tabs change
  useEffect(() => {
    if (currentTab === 1) {
      fetchGroupsData(groupActiveTab);
    }
  }, [groupActiveTab, currentTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [groupActiveTab, currentTab]);

  const handleLogout = async () => {
    setShowProfilePanel(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  // Toggle reaction (like) on a post
  const handleLikePost = async (postId: string | number) => {
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post && post.id === postId) {
          const newIsLiked = !post.is_liked;
          const currentCount = post.likes_count ?? post.stats?.reactions ?? 0;
          return {
            ...post,
            is_liked: newIsLiked,
            user_reacted: newIsLiked,
            likes_count: newIsLiked ? currentCount + 1 : Math.max(0, currentCount - 1),
          };
        }
        return post;
      })
    );

    const result = await feedService.toggleReaction(postId);
    if (result && result.success) {
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post && post.id === postId) {
            return {
              ...post,
              is_liked: result.isLiked,
              user_reacted: result.isLiked,
              likes_count: result.likesCount ?? post.likes_count,
            };
          }
          return post;
        })
      );
    }
  };

  // Join or leave groups
  const handleToggleGroupJoin = async (group: Group) => {
    const groupId = group.id;
    const isJoined = group.user_membership && group.user_membership.status === 'active';

    setActionLoadingId(groupId);

    try {
      if (isJoined) {
        const result = await feedService.leaveGroup(groupId);
        if (result.success) {
          Alert.alert('Left Group', `You have left "${group.name}".`);
          loadData();
        } else {
          Alert.alert('Error', result.message || 'Failed to leave group.');
        }
      } else {
        const result = await feedService.joinGroup(groupId);
        if (result.success) {
          if (result.data?.status === 'pending') {
            Alert.alert('Request Sent', `Join request sent to private group "${group.name}".`);
          } else {
            Alert.alert('Success', `You joined "${group.name}"!`);
          }
          loadData();
        } else {
          Alert.alert('Error', result.message || 'Failed to join group.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create post prompt (FAB)
  const handleCreateCTA = () => {
    if (currentTab === 0) {
      navigation.navigate('CreatePost');
    } else {
      navigation.navigate('CreateGroup');
    }
  };

  // Copy shareable link to Clipboard
  const handleCopyLink = (postId: string | number) => {
    const link = `${ApiConfig.baseUrl}/feeds/${postId}`;
    Clipboard.setString(link);
    Alert.alert('Copied!', 'Link copied to clipboard successfully.');
  };

  // Share post (native share sheet)
  const handleSharePost = async (postId: string | number) => {
    const link = `${ApiConfig.baseUrl}/feeds/${postId}`;
    try {
      const result = await Share.share({
        message: `Check out this eco initiative on Ekenox: ${link}`,
        url: link,
      });
      if (result.action === Share.sharedAction) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const currentShares = p.stats?.shares ?? 0;
            return {
              ...p,
              stats: p.stats ? { ...p.stats, shares: currentShares + 1 } : { reactions: p.likes_count, comments: p.comments_count, shares: currentShares + 1, views: 0 }
            };
          }
          return p;
        }));
        await feedService.sharePost(postId);
      }
    } catch (e) {
      console.log('Native share error, falling back to copy link:', e);
      handleCopyLink(postId);
    }
  };

  // Open comments as a full page
  const handleOpenComments = (postId: string | number, count: number, feedAuthorId?: string | number) => {
    navigation.navigate('Comments', { feedId: postId, commentsCount: count, feedAuthorId });
  };

  // Delete feed post
  const handleDeletePost = (postId: string | number) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await feedService.deleteFeed(postId);
          if (success) {
            Alert.alert('Deleted', 'Post deleted successfully.');
            setPosts(prev => prev.filter(p => p.id !== postId));
          } else {
            Alert.alert('Error', 'Failed to delete post.');
          }
        },
      },
    ]);
  };

  // Edit feed post - custom cross-platform modal
  const handleEditPost = (post: Feed) => {
    setEditingPost(post);
    setEditingTextState(post.content);
    setIsEditModalVisible(true);
  };

  // Save edit post
  const handleSaveEdit = async () => {
    if (!editingPost || !editingTextState.trim()) return;
    setEditSubmitting(true);
    try {
      const success = await feedService.updateFeed(editingPost.id, editingTextState.trim());
      if (success) {
        Alert.alert('Updated', 'Post updated successfully!');
        setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editingTextState.trim(), is_edited: true } : p));
        setIsEditModalVisible(false);
        setEditingPost(null);
      } else {
        Alert.alert('Error', 'Failed to update post.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred while updating.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Report feed post
  const handleReportPost = (postId: string | number) => {
    const reasons = [
      { text: 'Spam or unwanted promotion', reason: 'spam', icon: 'mail-unread-outline' as const },
      { text: 'Harassment, bullying or abuse', reason: 'harassment', icon: 'hand-left-outline' as const },
      { text: 'Inappropriate or offensive content', reason: 'inappropriate', icon: 'warning-outline' as const },
      { text: 'Illegal content or counterfeit', reason: 'illigal_content', icon: 'shield-outline' as const },
      { text: 'Other violation', reason: 'other', icon: 'alert-circle-outline' as const },
    ];

    setActionSheetConfig({
      visible: true,
      title: 'Report Post',
      subtitle: 'Select a reason for reporting this post:',
      options: reasons.map(r => ({
        title: r.text,
        icon: r.icon,
        isDestructive: true,
        onPress: async () => {
          const success = await feedService.reportFeed(postId, r.reason);
          if (success) {
            Alert.alert('Thank You', 'Post reported successfully. Our moderators will review it.');
          } else {
            Alert.alert('Error', 'Failed to submit report.');
          }
        },
      })),
    });
  };

  // Options Menu sheet triggers
  const handleOpenPostOptions = (post: Feed) => {
    if (!post) return;
    const authorId = post.user?.id || post.author?.id;
    const isMine = authorId && user?.id && String(authorId) === String(user.id);

    const options: ActionSheetOption[] = [];

    // Copy Link
    options.push({
      title: 'Copy Link',
      subtitle: 'Copy link to this post to clipboard',
      icon: 'link-outline',
      iconColor: '#0284C7',
      onPress: () => handleCopyLink(post.id),
    });

    // Share
    options.push({
      title: 'Share Post',
      subtitle: 'Share with friends or social apps',
      icon: 'share-social-outline',
      iconColor: '#059669',
      onPress: () => handleSharePost(post),
    });

    if (isMine) {
      options.push({
        title: 'Edit Post',
        subtitle: 'Edit post text and content',
        icon: 'create-outline',
        iconColor: '#D97706',
        onPress: () => handleEditPost(post),
      });
      options.push({
        title: 'Delete Post',
        subtitle: 'Permanently remove this post',
        icon: 'trash-outline',
        isDestructive: true,
        onPress: () => handleDeletePost(post.id),
      });
    } else {
      options.push({
        title: 'Report Post',
        subtitle: 'Flag inappropriate content to moderators',
        icon: 'flag-outline',
        isDestructive: true,
        onPress: () => handleReportPost(post.id),
      });
    }

    setActionSheetConfig({
      visible: true,
      title: 'Post Options',
      subtitle: 'Select an action to perform',
      options,
    });
  };

  // Vote on poll post
  const handleVotePoll = async (postId: string | number, optionIndex: number) => {
    const result = await feedService.votePoll(postId, optionIndex);
    if (result.success) {
      Alert.alert('Success', 'Vote registered successfully.');

      // Update state with new results
      setPosts(prev =>
        prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              poll_results: result.pollResults,
              user_votes: [optionIndex], // local user voted choice
            };
          }
          return post;
        })
      );
    } else {
      Alert.alert('Failed', result.message || 'Failed to submit vote.');
    }
  };

  // Compute Ongoing status tags for Events
  const getEventTag = (event: Event) => {
    const now = new Date().getTime();
    const start = new Date(event.startTime).getTime();
    const end = new Date(event.endTime).getTime();

    if (now >= start && now <= end) {
      return { label: 'Ongoing', color: '#10B981', bg: '#D1FAE5' };
    } else if (now < start) {
      return { label: 'Upcoming', color: '#0D9488', bg: '#CCFAF6' };
    } else {
      return { label: 'Past', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const formatEventDates = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  // Stories Slideshow Auto-advance logic
  const handleOpenStories = (index: number) => {
    setSelectedStoryIndex(index);
    setCurrentSlideIndex(0);
    setStoryModalVisible(true);
    setShowStoryComments(false);
    setStoryCommentInput('');
    setStoryLiked(false);
    setStoryLikeCount(stories[index]?.stats?.likes ?? 0);
    setStoryReactions({});
    setUserReaction(null);
    setIsMusicMuted(false);
    setIsStoryPaused(false);
    setStoryLikesList([]);
    setStorySharesList([]);
    // Record view (once per story session)
    const storyId = stories[index]?.id;
    if (storyId && !storyViewRecorded.current[storyId]) {
      storyViewRecorded.current[storyId] = true;
      feedService.recordStoryView(storyId);
    }
    // Load reactions, likes, and shares lists
    if (storyId) {
      feedService.getStoryReactions(storyId).then(data => setStoryReactions(data || {}));
      feedService.getStoryLikesList(storyId).then(data => setStoryLikesList(data || []));
      feedService.getStorySharesList(storyId).then(data => setStorySharesList(data || []));
    }
  };

  const closeStories = () => {
    if (storyTimer.current) clearTimeout(storyTimer.current);
    bgMusicPlayer?.pause();
    setStoryModalVisible(false);
    setSelectedStoryIndex(null);
    setCurrentSlideIndex(0);
    setShowStoryComments(false);
    setIsStoryPaused(false);
    setStoryLikesList([]);
    setStorySharesList([]);
  };

  const handleNextSlide = () => {
    if (selectedStoryIndex === null) return;
    const slides = stories[selectedStoryIndex]?.slides || [];
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      if (selectedStoryIndex < stories.length - 1) {
        setSelectedStoryIndex(prev => prev! + 1);
        setCurrentSlideIndex(0);
      } else {
        closeStories();
      }
    }
  };

  // Story interaction handlers
  const handleStoryLike = async () => {
    if (selectedStoryIndex === null) return;
    const story = stories[selectedStoryIndex];
    const result = await feedService.toggleStoryLike(story.id);
    setStoryLiked(result.liked);
    setStoryLikeCount(result.like_count);
    // Refresh likes list
    const updatedLikes = await feedService.getStoryLikesList(story.id);
    setStoryLikesList(updatedLikes || []);
  };

  const handleStoryReact = async (emoji: string) => {
    if (selectedStoryIndex === null) return;
    const story = stories[selectedStoryIndex];
    await feedService.reactToStory(story.id, emoji);
    setUserReaction(prev => prev === emoji ? null : emoji);
    setShowReactionPicker(false);
    // Refresh reaction counts
    const updated = await feedService.getStoryReactions(story.id);
    setStoryReactions(updated || {});
  };

  const handleStoryShare = async () => {
    if (selectedStoryIndex === null) return;
    const story = stories[selectedStoryIndex];
    setIsStoryPaused(true);
    try {
      await feedService.shareStoryPost(story.id);
      await Share.share({
        title: story.title || 'Ekenox Story',
        message: `Check out this Ekenox story: ${story.title || ''}\n${story.description || ''}`,
      });
      // Refresh story stats to show updated share count
      story.stats.shares = (story.stats.shares || 0) + 1;
    } catch (e) {
      console.log('Error sharing story:', e);
    } finally {
      setIsStoryPaused(false);
    }
  };

  const handleLoadStoryComments = async () => {
    if (selectedStoryIndex === null) return;
    const story = stories[selectedStoryIndex];
    setIsStoryPaused(true);
    const data = await feedService.getStoryComments(story.id);
    setStoryComments(data?.comments ?? []);
    setShowStoryComments(true);
  };

  const handleLoadLikesList = async () => {
    if (selectedStoryIndex === null) return;
    const story = stories[selectedStoryIndex];
    setIsStoryPaused(true);
    setStoryLikesLoading(true);
    setShowLikesModal(true);
    try {
      const data = await feedService.getStoryLikesList(story.id);
      setStoryLikesList(data || []);
    } catch (e) {
      console.log('Error loading likes list:', e);
    } finally {
      setStoryLikesLoading(false);
    }
  };

  const handleLoadSharesList = async () => {
    if (selectedStoryIndex === null) return;
    const story = stories[selectedStoryIndex];
    setIsStoryPaused(true);
    setStorySharesLoading(true);
    setShowSharesModal(true);
    try {
      const data = await feedService.getStorySharesList(story.id);
      setStorySharesList(data || []);
    } catch (e) {
      console.log('Error loading shares list:', e);
    } finally {
      setStorySharesLoading(false);
    }
  };

  const handleSendStoryComment = async () => {
    if (selectedStoryIndex === null || storyCommentInput.trim() === '') return;
    setStoryCommentSending(true);
    const story = stories[selectedStoryIndex];
    const newComment = await feedService.addStoryComment(story.id, storyCommentInput.trim());
    if (newComment) {
      setStoryComments(prev => [...prev, newComment]);
      setStoryCommentInput('');
    }
    setStoryCommentSending(false);
  };

  const handleSendReply = async (commentId: string) => {
    if (selectedStoryIndex === null) return;
    const text = replyInputs[commentId]?.trim();
    if (!text) return;
    const story = stories[selectedStoryIndex];
    const newReply = await feedService.addStoryCommentReply(story.id, commentId, text);
    if (newReply) {
      setStoryComments(prev => prev.map(c =>
        String(c.id) === commentId
          ? { ...c, replies: [...(c.replies || []), newReply] }
          : c
      ));
      setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
    }
  };



  const dummyPlayerObj = useRef({}).current;
  const targetStoryPlayer = player || (dummyPlayerObj as any);

  // Advance to next slide when video plays to the end
  useEventListener(targetStoryPlayer, 'playToEnd', () => {
    handleNextSlide();
  });

  // Manage loading indicator state on player status changes
  useEventListener(targetStoryPlayer, 'statusChange', ({ status }) => {
    setStoryVideoLoading(status === 'loading');
  });

  // Sync the player source dynamically with the active slide mediaUrl
  useEffect(() => {
    if (!storyModalVisible || selectedStoryIndex === null || isStoryPaused) {
      player?.pause();
      bgMusicPlayer?.pause();
      return;
    }

    const activeStory = stories[selectedStoryIndex];
    if (!activeStory) return;

    const slides = activeStory.slides || [];
    const activeSlide = slides[currentSlideIndex];

    const isVideo = activeSlide
      ? activeSlide.media_type === 'video' || isVideoUrl(activeSlide.media_url || activeSlide.mediaUrl)
      : isVideoUrl(activeStory.video_url || activeStory.videoUrl);

    // Dynamic background music sync — prefer real uploaded music_url, fallback to preset library
    const musicUrl = activeStory.music_url ||
      (activeStory.selected_music
        ? MUSIC_LIBRARY.find((t) => t.title === activeStory.selected_music)?.url
        : null);

    if (musicUrl && !isMusicMuted) {
      bgMusicPlayer?.replaceAsync(resolveMediaUrl(musicUrl)).then(() => {
        if (!isStoryPaused) bgMusicPlayer?.play();
      });
      if (player) player.muted = true;
    } else {
      bgMusicPlayer?.pause();
      if (player) player.muted = false;
    }

    if (isVideo) {
      const mediaUrl = resolveMediaUrl(
        activeSlide?.media_url ||
        activeSlide?.mediaUrl ||
        activeSlide?.url ||
        activeStory?.video_url ||
        activeStory?.videoUrl ||
        activeStory?.thumbnail_url ||
        activeStory?.thumbnailUrl
      );

      if (mediaUrl) {
        player?.replaceAsync(mediaUrl).then(() => {
          if (!isStoryPaused) player?.play();
        });
      }
    } else {
      player?.pause();
    }
  }, [storyModalVisible, selectedStoryIndex, currentSlideIndex, isMusicMuted, isStoryPaused]);

  const handlePrevSlide = () => {
    if (selectedStoryIndex === null) return;
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    } else {
      if (selectedStoryIndex > 0) {
        const prevStoryIdx = selectedStoryIndex - 1;
        setSelectedStoryIndex(prevStoryIdx);
        const prevSlidesCount = stories[prevStoryIdx]?.slides?.length || 1;
        setCurrentSlideIndex(prevSlidesCount - 1);
      }
    }
  };

  // Reactive Stories slideshow controller
  useEffect(() => {
    if (!storyModalVisible || selectedStoryIndex === null || isStoryPaused) {
      if (storyTimer.current) clearTimeout(storyTimer.current);
      return;
    }

    const activeStory = stories[selectedStoryIndex];
    if (!activeStory) return;

    const slides = activeStory.slides || [];
    const activeSlide = slides[currentSlideIndex];
    const isVideo = activeSlide
      ? activeSlide.media_type === 'video' || isVideoUrl(activeSlide.media_url || activeSlide.mediaUrl)
      : isVideoUrl(activeStory.video_url || activeStory.videoUrl);

    if (storyTimer.current) clearTimeout(storyTimer.current);

    if (!isVideo) {
      // Image slide auto-advance after 4 seconds
      storyTimer.current = setTimeout(() => {
        handleNextSlide();
      }, 4000);
    } else {
      // Safe video safety fallback of 35 seconds to prevent cuts on longer videos
      storyTimer.current = setTimeout(() => {
        handleNextSlide();
      }, 35000);
    }

    return () => {
      if (storyTimer.current) clearTimeout(storyTimer.current);
    };
  }, [storyModalVisible, selectedStoryIndex, currentSlideIndex, isStoryPaused]);



  const renderStorySkeleton = () => {
    if (!loadingMoreStories) return null;
    return (
      <View style={{ flexDirection: 'row' }}>
        {[1, 2].map((i) => (
          <View key={i} style={[styles.storyCard, { opacity: 0.6, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="small" color={AppColors.primary} />
          </View>
        ))}
      </View>
    );
  };

  const renderCreateStoryHeader = () => {
    const userAvatar = user?.profileImage ? resolveMediaUrl(user.profileImage) : null;
    return (
      <TouchableOpacity
        style={styles.storyBubbleWrap}
        onPress={() => navigation.navigate('CreateStory')}
        activeOpacity={0.85}
      >
        <View style={styles.storyBubbleCircleCreate}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.storyBubbleInnerImg} blurRadius={2} />
          ) : (
            <View style={[styles.storyBubbleInnerImg, { backgroundColor: AppColors.primaryLight }]} />
          )}
          <View style={styles.storyBubblePlusBtn}>
            <Ionicons name="add" size={16} color="white" />
          </View>
        </View>
        <Text style={styles.storyBubbleTitle} numberOfLines={1}>Create Story</Text>
      </TouchableOpacity>
    );
  };

  // Render Horizontal Story Bubble Cards (circular, title under)
  const renderStoryItem = ({ item, index }: { item: any; index: number }) => {
    const thumbnailUrl = item.thumbnail_url || item.thumbnailUrl || item.slides?.[0]?.media_url || item.slides?.[0]?.mediaUrl;
    const storyTitle = item.title || item.user?.full_name || item.username || 'Story';

    return (
      <TouchableOpacity style={styles.storyBubbleWrap} onPress={() => handleOpenStories(index)} activeOpacity={0.85}>
        {/* Gradient ring */}
        <View style={styles.storyBubbleRing}>
          <View style={styles.storyBubbleCircle}>
            {thumbnailUrl ? (
              <Image source={{ uri: resolveMediaUrl(thumbnailUrl) }} style={styles.storyBubbleInnerImg} />
            ) : (
              <View style={[styles.storyBubbleInnerImg, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="play" size={18} color={AppColors.primary} />
              </View>
            )}
          </View>
        </View>
        <Text style={styles.storyBubbleTitle} numberOfLines={1}>{storyTitle}</Text>
      </TouchableOpacity>
    );
  };

  const handleToggleFollowUser = async (userId: string | number, currentFollowState: boolean, postId: string | number) => {
    // Optimistically update all posts from this author in the list
    setPosts(prev => prev.map(p => {
      const authorId = p.user?.id || p.author?.id;
      if (authorId && String(authorId) === String(userId)) {
        return {
          ...p,
          is_following: !currentFollowState,
          user: p.user ? { ...p.user, is_following: !currentFollowState } : p.user
        };
      }
      return p;
    }));

    try {
      if (currentFollowState) {
        await associationService.unfollowUser(userId);
      } else {
        await associationService.followUser(userId);
      }
    } catch (err) {
      console.error('Failed to toggle follow status:', err);
      // Rollback on error
      setPosts(prev => prev.map(p => {
        const authorId = p.user?.id || p.author?.id;
        if (authorId && String(authorId) === String(userId)) {
          return {
            ...p,
            is_following: currentFollowState,
            user: p.user ? { ...p.user, is_following: currentFollowState } : p.user
          };
        }
        return p;
      }));
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  const renderPostCard = (post: any) => {
    const authorName = post.user?.full_name || post.author?.full_name || 'Anonymous';
    const authorImage = post.user?.profile_image || post.user?.avatar_url || post.author?.profile_image;
    const isLiked = post.is_liked || post.user_reacted;
    const reactions = post.stats?.reactions ?? post.likes_count ?? 0;
    const comments = post.stats?.comments ?? post.comments_count ?? 0;
    const shares = post.stats?.shares ?? post.shares_count ?? 0;
    const hasMedia = post.media && post.media.length > 0;
    const postMedia = (post.media || []) as any[];

    // Author tagline / bio
    const authorTagline = post.user?.bio || post.user?.tagline || post.user?.profession || '';

    // Relative time
    const getRelTime = (dt: string) => {
      try {
        const diff = (Date.now() - new Date(dt).getTime()) / 1000;
        if (diff < 60) return 'now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
      } catch { return ''; }
    };
    const relTime = post.created_at ? getRelTime(post.created_at) : '';
    const subtitle = [authorTagline, relTime].filter(Boolean).join(' • ');

    // Render post content with inline hashtags highlighted in green
    const renderPostContentText = (text: string) => {
      if (!text) return null;
      const parts = text.split(/(\s|#[\w\u00C0-\u017F]+)/g);
      return (
        <Text style={styles.postContent}>
          {parts.map((part, index) => {
            if (part.startsWith('#')) {
              return (
                <Text key={index} style={{ color: '#006d40', fontWeight: '700' }}>
                  {part}
                </Text>
              );
            }
            return part;
          })}
        </Text>
      );
    };

    return (
      <View
        key={post.id}
        style={styles.postCard}
        onLayout={event => {
          const { y, height } = event.nativeEvent.layout;
          postLayouts.current[post.id.toString()] = { y: y + postsListY.current, height };
        }}
      >
        {/* Challenge banner */}
        {post.post_type === 'challenge' && post.challenge && (
          <TouchableOpacity
            style={styles.postBannerChallenge}
            onPress={() => navigation.navigate('ChallengeDetail', { challengeId: post.challenge.id })}
          >
            <View style={styles.postBannerIconWrap}>
              <Ionicons name="leaf" size={14} color="#4CAF50" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.postBannerLabel}>Eco Challenge Progress</Text>
              <Text style={styles.postBannerTitle} numberOfLines={1}>{post.challenge.title}</Text>
            </View>
            <View style={styles.postBannerLvlBadge}>
              <Text style={styles.postBannerLvlText}>Lvl {post.challenge.level || 1}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#4CAF50" />
          </TouchableOpacity>
        )}

        {/* Group banner */}
        {post.feed_group && (
          <TouchableOpacity
            style={styles.postBannerGroup}
            onPress={() => navigation.navigate('GroupDetail', { groupId: post.feed_group.id })}
          >
            <View style={[styles.postBannerIconWrap, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="people" size={14} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.postBannerLabel, { color: '#3B82F6' }]}>Eco Community Group</Text>
              <Text style={styles.postBannerTitle} numberOfLines={1}>{post.feed_group.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
          </TouchableOpacity>
        )}

        {/* Event banner */}
        {(post.event || (post.post_type === 'event' && post.event_id)) && (
          <TouchableOpacity
            style={styles.postBannerEvent}
            onPress={() => navigation.navigate('EventDetail' as never, { eventId: post.event?.id || post.event_id } as never)}
          >
            <View style={[styles.postBannerIconWrap, { backgroundColor: '#05966920' }]}>
              <Ionicons name="calendar" size={14} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.postBannerLabel, { color: '#059669' }]}>Event Discussion & Updates</Text>
              <Text style={styles.postBannerTitle} numberOfLines={1}>
                {post.event?.title || 'Eco Event'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#059669" />
          </TouchableOpacity>
        )}

        {/* Post header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => navigation.navigate('Profile', { userId: post.user?.id })}
            activeOpacity={0.7}
          >
            {authorImage ? (
              <Image source={{ uri: resolveMediaUrl(authorImage) }} style={styles.postAvatar} />
            ) : (
              <View style={[styles.postAvatar, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                  {authorName.substring(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.postAuthorDetails}>
              <Text style={styles.postAuthorName}>{authorName}</Text>
              {subtitle ? (
                <Text style={styles.postTime} numberOfLines={1}>{subtitle}</Text>
              ) : null}
            </View>
          </TouchableOpacity>

          {/* Follow Button */}
          {user && post.user && String(post.user.id) !== String(user.id) && (
            <TouchableOpacity
              style={[styles.postFollowBtn, post.is_following && styles.postFollowingBtn]}
              onPress={() => handleToggleFollowUser(post.user.id, post.is_following, post.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={post.is_following ? "checkmark-circle" : "add-circle"}
                size={12}
                color={post.is_following ? AppColors.textMedium : AppColors.primary}
              />
              <Text style={[styles.postFollowBtnText, post.is_following && styles.postFollowingBtnText]}>
                {post.is_following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.postOptionBtn} onPress={() => handleOpenPostOptions(post)}>
            <Ionicons name="ellipsis-horizontal" size={20} color={AppColors.textMedium} />
          </TouchableOpacity>
        </View>

        {/* Content text (with inline highlighted hashtags) */}
        {!!post.content && renderPostContentText(post.content)}

        {/* Media preview */}
        {hasMedia && postMedia.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openFeedMedia(post, 0)}
            style={styles.postMediaWrapper}
          >
            {postMedia[0].type === 'video' || isVideoUrl(postMedia[0].url) ? (
              <View style={styles.postVideoBox}>
                <PostVideoPlayer
                  videoUrl={resolveMediaUrl(postMedia[0].url)}
                  style={styles.postVideoSource}
                  shouldPlay={activePostId === post.id.toString()}
                  isMuted={isFeedMuted}
                  onToggleMute={() => setIsFeedMuted(!isFeedMuted)}
                  onFullscreen={() => openFeedMedia(post, 0)}
                />
              </View>
            ) : (
              <Image
                source={{ uri: resolveMediaUrl(postMedia[0].url) }}
                style={styles.postMediaImage}
                resizeMode="cover"
              />
            )}
            {/* Multiple media badge */}
            {postMedia.length > 1 && (
              <View style={styles.mediaCountBadge}>
                <Ionicons name="images" size={12} color="white" />
                <Text style={styles.mediaCountText}>{postMedia.length}</Text>
              </View>
            )}
            {/* Tap to view hint */}
            {!(postMedia[0].type === 'video' || isVideoUrl(postMedia[0].url)) && (
              <View style={styles.tapToViewBanner}>
                <Ionicons
                  name="expand"
                  size={13}
                  color="white"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.tapToViewText}>
                  {`View ${postMedia.length > 1 ? `${postMedia.length} photos` : 'full photo'}`}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Poll widget */}
        {post.post_type === 'poll' && (
          <View style={{ paddingHorizontal: 14 }}>
            <FeedPollWidget feed={post} onVoteSuccess={() => loadData(false)} />
          </View>
        )}

        {/* Stats / Engagement row */}
        <View style={styles.postStatsRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <TouchableOpacity style={styles.postStat} onPress={() => handleLikePost(post.id)}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isLiked ? AppColors.error : '#3d4a40'}
              />
              <Text style={[styles.postStatText, isLiked && { color: AppColors.error }]}>{reactions}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.postStat}
              onPress={() => handleOpenComments(post.id, comments, post.user?.id)}
            >
              <Ionicons name="chatbubble-outline" size={19} color="#3d4a40" />
              <Text style={styles.postStatText}>{comments}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <TouchableOpacity style={styles.postStat} onPress={() => handleSharePost(post.id)}>
              <Ionicons name="share-social-outline" size={20} color="#3d4a40" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.postStat}>
              <Ionicons name="bookmark-outline" size={20} color="#3d4a40" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header Navbar */}
      <Animated.View
        style={[
          styles.header,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            paddingTop: insets.top,
            height: 60 + insets.top,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >

        {/* Header Main Row — Facebook-style: menu + Ekenox left, icons right */}
        <View style={styles.headerMainRow}>
          {/* Hamburger menu + brand name on left */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={styles.headerMenuBtn}
              onPress={() => setShowProfilePanel(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="menu" size={26} color={AppColors.textDark} />
            </TouchableOpacity>
            <Text style={styles.headerBrandTitle}>Ekenox</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => navigation.navigate('Collaboration')}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons name="briefcase-outline" size={22} color={AppColors.textDark} />
                {pendingCollabCount > 0 && (
                  <View style={[styles.notifBadge, { backgroundColor: '#4F46E5' }]}>
                    <Text style={styles.notifBadgeText}>
                      {pendingCollabCount > 99 ? '99+' : pendingCollabCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('Messages')}>
              <View style={{ position: 'relative' }}>
                <Ionicons name="chatbubbles-outline" size={22} color={AppColors.textDark} />
                {unreadChatCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('Notifications')}>
              <View style={{ position: 'relative' }}>
                <Ionicons name="notifications-outline" size={22} color={AppColors.textDark} />
                {unreadNotifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dedicated Top Tab Bar — left-aligned like reference */}
        <View style={styles.topTabBar}>
          <TouchableOpacity
            style={styles.topTabBtn}
            onPress={() => setCurrentTab(0)}
            activeOpacity={0.8}
          >
            <Text style={[styles.topTabText, currentTab === 0 && styles.topTabTextActive]}>Feed</Text>
            {currentTab === 0 && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topTabBtn}
            onPress={() => setCurrentTab(1)}
            activeOpacity={0.8}
          >
            <Text style={[styles.topTabText, currentTab === 1 && styles.topTabTextActive]}>Groups</Text>
            {currentTab === 1 && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          {/* Spacer so tabs are left-aligned */}
          <View style={{ flex: 1 }} />
        </View>
      </Animated.View>


      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={AppColors.primary} size="large" />
          <Text style={styles.loadingText}>Loading Ekenox ecosystems...</Text>
        </View>
      ) : (
        /* Main tabs content list scroll */
        currentTab === 0 ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingTop: 60 + BRAND_BAR_HEIGHT + 48 + insets.top }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} progressViewOffset={60 + BRAND_BAR_HEIGHT + 48 + insets.top} />
            }
          >
            {/* Static Create Feed Card */}
            <View style={styles.createBarContainer}>
              <TouchableOpacity
                style={styles.createBarContent}
                onPress={() => navigation.navigate('CreatePost')}
                activeOpacity={0.85}
              >
                {user?.profileImage ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      navigation.navigate('Profile', { userId: user?.id });
                    }}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: resolveMediaUrl(user.profileImage) }} style={styles.createBarAvatar} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      navigation.navigate('Profile', { userId: user?.id });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.createBarAvatarPlaceholder}>
                      <Text style={styles.createBarAvatarText}>
                        {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                <Text style={styles.createBarInputPlaceholder}>Share an eco action with the community…</Text>
                <View style={styles.createBarBtn}>
                  <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
                  {/* <Text style={styles.createBarBtnText}>Create Feed</Text> */}
                </View>
              </TouchableOpacity>
            </View>
            {/* Horizontal Stories list sequence */}
            {/* Horizontal Stories list sequence */}
            <View style={styles.storiesContainer}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={stories}
                renderItem={renderStoryItem}
                ListHeaderComponent={renderCreateStoryHeader}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                onEndReached={() => {
                  if (hasMoreStories && !loadingMoreStories) {
                    loadStories(storyPage + 1);
                  }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderStorySkeleton}
              />
            </View>

            {/* Expandable Daily Tip Card */}
            {showTip && dailyTip && (
              <View style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <View style={styles.tipTitleRow}>
                    <Ionicons name="bulb" size={20} color="#0D9488" />
                    <Text style={styles.tipTitle}>{dailyTip.title || 'Daily Green Tip'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowTip(false)}>
                    <Ionicons name="close" size={20} color={AppColors.textMedium} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.tipText}>{dailyTip.fun_text}</Text>

                {tipExpanded && (
                  <View style={styles.tipExpandContent}>
                    <View style={styles.tipInfoRow}>
                      <Ionicons name="leaf-outline" size={14} color="#0D9488" />
                      <Text style={styles.tipInfoText}><Text style={{ fontWeight: 'bold' }}>Action: </Text>{dailyTip.action}</Text>
                    </View>
                    <View style={styles.tipInfoRow}>
                      <Ionicons name="analytics-outline" size={14} color="#0D9488" />
                      <Text style={styles.tipInfoText}><Text style={{ fontWeight: 'bold' }}>Impact: </Text>{dailyTip.impact}</Text>
                    </View>
                    {dailyTip.estimated_savings && (
                      <View style={styles.tipInfoRow}>
                        <Ionicons name="wallet-outline" size={14} color="#0D9488" />
                        <Text style={styles.tipInfoText}>
                          <Text style={{ fontWeight: 'bold' }}>Savings: </Text>
                          {typeof dailyTip.estimated_savings === 'object'
                            ? `${dailyTip.estimated_savings.value} ${dailyTip.estimated_savings.unit}`
                            : dailyTip.estimated_savings}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity style={styles.learnMoreBtn} onPress={() => setTipExpanded(!tipExpanded)}>
                  <Text style={styles.learnMoreText}>{tipExpanded ? 'Show less' : 'Learn more...'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Featured Events Carousel - Limited to 5 items */}
            {events.length > 0 && (
              <View style={styles.eventsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Featured Events</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Events')}>
                    <Text style={styles.sectionAction}>See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsScroll}>
                  {events.slice(0, 5).map(event => {
                    const status = getEventTag(event);
                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={styles.eventCard}
                        onPress={() => navigation.navigate('EventDetail' as never, { eventId: event.id } as never)}
                      >
                        <Image source={{ uri: resolveMediaUrl(event.banner_image || event.bannerImage) }} style={styles.eventImage} />
                        <View style={[styles.eventTagBadge, { backgroundColor: status.bg }]}>
                          <Text style={[styles.eventTagText, { color: status.color }]}>{status.label}</Text>
                        </View>
                        <View style={styles.eventContent}>
                          <Text style={styles.eventCardTitle} numberOfLines={1}>{event.title}</Text>
                          {event.description ? (
                            <Text style={styles.eventCardDesc} numberOfLines={2}>{event.description}</Text>
                          ) : null}
                          <View style={styles.eventInfoRow}>
                            <Ionicons name="calendar-outline" size={13} color={AppColors.textMedium} />
                            <Text style={styles.eventInfoText}>{formatEventDates(event.startTime, event.endTime)}</Text>
                          </View>
                          <View style={styles.eventInfoRow}>
                            <Ionicons
                              name={event.privacy_level === 'private' || event.privacyLevel === 'private' ? "lock-closed-outline" : "location-outline"}
                              size={13}
                              color={AppColors.textMedium}
                            />
                            <Text style={styles.eventInfoText} numberOfLines={1}>
                              {event.privacy_level === 'private' || event.privacyLevel === 'private'
                                ? '🔒 Private Location'
                                : event.location}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Recent Feeds List Title */}
            {/* <View style={styles.feedHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Eco Actions</Text>
            </View> */}

            {/* Support/Coffee Donation Banner */}
            <TouchableOpacity
              style={styles.coffeeBanner}
              onPress={() => Linking.openURL('https://buymeacoffee.com/dosuu')}
              activeOpacity={0.8}
            >
              <View style={styles.coffeeIconBg}>
                <Ionicons name="cafe" size={18} color="#000000" />
              </View>
              <View style={styles.coffeeTextContainer}>
                <Text style={styles.coffeeTitle}>Support Ekenox development</Text>
                <Text style={styles.coffeeSubtitle}>I survive by donations, buy me a coffee! ☕</Text>
              </View>
              <View style={styles.coffeeBadge}>
                <Text style={styles.coffeeBadgeText}>Donate</Text>
                <Ionicons name="heart" size={10} color="#EF4444" style={{ marginLeft: 2 }} />
              </View>
            </TouchableOpacity>

            {/* Posts Cards list */}
            <View
              style={styles.postsList}
              onLayout={event => {
                postsListY.current = event.nativeEvent.layout.y;
              }}
            >
              {posts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="leaf-outline" size={48} color={AppColors.textLight} />
                  <Text style={styles.emptyText}>No live posts yet. Share your first eco action!</Text>
                </View>
              ) : (
                posts.map(post => renderPostCard(post))
              )}
              {loadingMoreFeeds && (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={AppColors.primary} />
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 6 }}>Loading more eco actions...</Text>
                </View>
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        ) : (
          /* Groups tab explorer with Public, My Groups, Discover pills */
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingTop: 60 + BRAND_BAR_HEIGHT + 48 + insets.top }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              const scrollOffset = event.nativeEvent.contentOffset.y;
              scrollY.setValue(scrollOffset);
              setShowFab(scrollOffset > 150);
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} progressViewOffset={60 + BRAND_BAR_HEIGHT + 48 + insets.top} />
            }
          >
            {/* Groups exploration header */}
            <View style={styles.groupsHeaderRow}>
              {/* <Text style={styles.sectionTitle}>Explore Groups</Text>
              <Text style={styles.groupsSubtitle}>Connect with Ekenox eco champions around the world.</Text> */}

              {/* Card search and create group block */}
              <View style={styles.searchCardContainer}>
                {/* Center group icon */}
                <View style={styles.searchCardIconContainer}>
                  <Ionicons name="people" size={24} color="#006d40" />
                </View>

                {/* Search TextInput bar */}
                <View style={styles.searchCardBar}>
                  <Ionicons name="search" size={18} color={AppColors.textMedium} />
                  <TextInput
                    style={styles.searchCardInput}
                    placeholder="Find eco communities..."
                    placeholderTextColor={AppColors.textMedium}
                    value={groupSearchQuery}
                    onChangeText={setGroupSearchQuery}
                  />
                </View>

                {/* Create Group Button styled like Create Feed Bar */}
                <TouchableOpacity
                  style={styles.createBarContent}
                  onPress={() => navigation.navigate('CreateGroup')}
                  activeOpacity={0.85}
                >
                  {user?.profileImage ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        navigation.navigate('Profile', { userId: user?.id });
                      }}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: resolveMediaUrl(user.profileImage) }} style={styles.createBarAvatar} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        navigation.navigate('Profile', { userId: user?.id });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.createBarAvatarPlaceholder}>
                        <Text style={styles.createBarAvatarText}>
                          {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.createBarInputPlaceholder}>Build a new eco community group…</Text>
                  <View style={styles.createBarBtn}>
                    <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pill-filters Tab switcher */}
            <View style={styles.pillsRow}>
              <TouchableOpacity
                style={[styles.pillBtn, groupActiveTab === 'public' ? styles.pillBtnActive : null]}
                onPress={() => setGroupActiveTab('public')}
              >
                <Ionicons
                  name="earth-outline"
                  size={14}
                  color={groupActiveTab === 'public' ? AppColors.primary : AppColors.textMedium}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.pillText, groupActiveTab === 'public' ? styles.pillTextActive : null]}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, groupActiveTab === 'user' ? styles.pillBtnActive : null]}
                onPress={() => setGroupActiveTab('user')}
              >
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={groupActiveTab === 'user' ? AppColors.primary : AppColors.textMedium}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.pillText, groupActiveTab === 'user' ? styles.pillTextActive : null]}>My Groups</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, groupActiveTab === 'discover' ? styles.pillBtnActive : null]}
                onPress={() => setGroupActiveTab('discover')}
              >
                <Ionicons
                  name="compass-outline"
                  size={14}
                  color={groupActiveTab === 'discover' ? AppColors.primary : AppColors.textMedium}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.pillText, groupActiveTab === 'discover' ? styles.pillTextActive : null]}>Discover</Text>
              </TouchableOpacity>
            </View>

            {/* Groups list */}
            <View style={styles.groupsList}>
              {groups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color={AppColors.textLight} />
                  <Text style={styles.emptyText}>No groups available under this filter.</Text>
                </View>
              ) : groups.filter((group: any) =>
                group.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                (group.description && group.description.toLowerCase().includes(groupSearchQuery.toLowerCase()))
              ).length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={AppColors.textLight} />
                  <Text style={styles.emptyText}>No groups match your search.</Text>
                </View>
              ) : (
                groups
                  .filter((group: any) =>
                    group.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                    (group.description && group.description.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                  )
                  .map((group: any) => {
                    const isJoined = !!(group.user_membership && group.user_membership.status === 'active');
                    const isPending = !!(group.user_membership && group.user_membership.status === 'pending');
                    const isActionLoading = actionLoadingId === group.id;

                    // Get max 3 random mutual friends
                    const getMutualFriendsSelection = (friendsList: any[]) => {
                      if (!friendsList || friendsList.length === 0) return [];
                      const shuffled = [...friendsList].sort(() => 0.5 - Math.random());
                      return shuffled.slice(0, 3);
                    };
                    const mutualSelection = getMutualFriendsSelection(group.mutual_friends || []);

                    // Cover image resolver with fallbacks
                    const coverImageUri = group.cover_image_url
                      ? resolveMediaUrl(group.cover_image_url)
                      : group.profile_image_url
                        ? resolveMediaUrl(group.profile_image_url)
                        : null;

                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={styles.card}
                        activeOpacity={0.92}
                        onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                      >
                        {/* Cover Image with Overlays */}
                        <View style={styles.cardImageWrap}>
                          {coverImageUri ? (
                            <Image
                              source={{ uri: coverImageUri }}
                              style={styles.cardImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.cardImage, styles.cardImageFallback]}>
                              <View style={styles.groupCoverFallbackCircle}>
                                <Text style={styles.groupCoverFallbackText}>
                                  {group.name ? group.name.substring(0, 2).toUpperCase() : 'EC'}
                                </Text>
                              </View>
                            </View>
                          )}

                          {/* Privacy Badge */}
                          <View style={styles.verifiedBadge}>
                            <Ionicons
                              name={group.privacy_level === 'private' ? 'lock-closed' : 'globe-outline'}
                              size={11}
                              color="white"
                            />
                            <Text style={styles.verifiedText}>
                              {group.privacy_level.toUpperCase()}
                            </Text>
                          </View>

                          {/* Member Badge */}
                          {isJoined && (
                            <View style={[styles.privateBadge, { backgroundColor: '#10B981', right: 12, left: undefined }]}>
                              <Ionicons name="checkmark-circle" size={11} color="white" />
                              <Text style={styles.privateText}>MEMBER</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle} numberOfLines={2}>{group.name}</Text>

                          {/* Organizer Header */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: AppColors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                              <Ionicons name="people" size={12} color="white" />
                            </View>
                            <Text style={styles.cardOrganizer} numberOfLines={1}>
                              Eco Community Group
                            </Text>
                          </View>

                          <Text style={styles.cardDescription} numberOfLines={2}>
                            {group.description || 'Join this eco community to coordinate actions, share resources, and offset carbon.'}
                          </Text>

                          {/* Info Rows */}
                          <View style={styles.cardInfoRow}>
                            <Ionicons
                              name={group.privacy_level === 'private' ? "lock-closed-outline" : "globe-outline"}
                              size={13}
                              color={AppColors.primary}
                            />
                            <Text style={styles.cardInfoText} numberOfLines={1}>
                              {group.privacy_level === 'private' ? 'Private Community' : 'Public Community'}
                            </Text>
                          </View>

                          <View style={styles.cardInfoRow}>
                            <Ionicons name="people-outline" size={13} color={AppColors.primary} />
                            <Text style={styles.cardInfoText}>
                              {group.members_count || 0} member{group.members_count !== 1 ? 's' : ''}
                            </Text>

                            {/* Mutual followers profile stack */}
                            {group.mutual_friends && group.mutual_friends.length > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                                {group.mutual_friends.slice(0, 3).map((friend: any, index: number) => {
                                  const friendAvatar = resolveMediaUrl(friend.profile_image || friend.avatar_url);
                                  return (
                                    <View
                                      key={friend.id || index}
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        borderWidth: 1.5,
                                        borderColor: 'white',
                                        marginLeft: index > 0 ? -8 : 0,
                                        backgroundColor: AppColors.primary,
                                        overflow: 'hidden',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                      }}
                                    >
                                      {friendAvatar ? (
                                        <Image source={{ uri: friendAvatar }} style={{ width: '100%', height: '100%' }} />
                                      ) : (
                                        <Ionicons name="person" size={8} color="white" />
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>

                          <View style={styles.cardDivider} />

                          <View style={styles.cardFooter}>
                            <TouchableOpacity
                              style={[
                                styles.regBtn,
                                isJoined && styles.regBtnActive,
                                isPending && styles.regBtnPending
                              ]}
                              onPress={() => handleToggleGroupJoin(group)}
                              disabled={isActionLoading || isPending}
                            >
                              {isActionLoading ? (
                                <ActivityIndicator size="small" color={isJoined ? AppColors.primary : 'white'} />
                              ) : (
                                <>
                                  <Ionicons
                                    name={isJoined ? 'checkmark-circle' : isPending ? 'hourglass-outline' : 'add-circle-outline'}
                                    size={15}
                                    color={isJoined ? AppColors.primary : isPending ? '#D97706' : 'white'}
                                  />
                                  <Text
                                    style={[
                                      styles.regBtnText,
                                      isJoined && styles.regBtnTextActive,
                                      isPending && styles.regBtnTextPending
                                    ]}
                                  >
                                    {isJoined ? 'Joined' : isPending ? 'Pending' : 'Join Group'}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.detailBtn}
                              onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                            >
                              <Text style={styles.detailBtnText}>View Details</Text>
                              <Ionicons name="chevron-forward" size={13} color={AppColors.primary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )
      )}

      {/* Stories Slideshow Modal Viewer */}
      {storyModalVisible && selectedStoryIndex !== null && stories[selectedStoryIndex] && (
        <Modal
          visible={storyModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={closeStories}
        >
          <View style={styles.storyModalOverlay}>
            <TouchableOpacity style={styles.storyModalBackdrop} activeOpacity={1} onPress={closeStories} />

            <View style={styles.storyViewerContainer}>
              <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />

              {/* Inner card content wrapper */}
              <View style={styles.storyInnerWrapper}>

                {/* Story Image / Video Background */}
                <View style={styles.storyViewerImageWrapper}>
                  {(() => {
                    const activeStory = stories[selectedStoryIndex];
                    const slides = activeStory?.slides || [];
                    const slide = slides[currentSlideIndex];
                    const mediaUrl = resolveMediaUrl(
                      slide?.media_url ||
                      slide?.mediaUrl ||
                      slide?.url ||
                      activeStory?.video_url ||
                      activeStory?.videoUrl ||
                      activeStory?.thumbnail_url ||
                      activeStory?.thumbnailUrl
                    );
                    const isVideo = slide
                      ? slide.media_type === 'video' || isVideoUrl(slide.media_url || slide.mediaUrl)
                      : isVideoUrl(activeStory?.video_url || activeStory?.videoUrl);

                    if (isVideo) {
                      return (
                        <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                          <VideoView
                            player={player}
                            style={styles.storyViewerImage}
                            contentFit="cover"
                            nativeControls={false}
                          />
                          {storyVideoLoading && (
                            <ActivityIndicator style={{ position: 'absolute' }} color="white" size="large" />
                          )}
                        </View>
                      );
                    } else {
                      return (
                        <Image
                          source={{ uri: mediaUrl }}
                          style={styles.storyViewerImage}
                          resizeMode="cover"
                        />
                      );
                    }
                  })()}

                  {/* Touch split navigation controls */}
                  <View style={styles.storyViewerGestureOverlay}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={handlePrevSlide} />
                    <TouchableOpacity style={{ flex: 1 }} onPress={handleNextSlide} />
                  </View>
                </View>

                {/* Slides Progress Indicators at the Top */}
                <View style={[styles.storyProgressContainer, { top: insets.top + 12 }]}>
                  {(stories[selectedStoryIndex]?.slides || [1]).map((_: any, idx: number) => (
                    <View
                      key={idx}
                      style={[
                        styles.storyProgressBar,
                        {
                          backgroundColor: idx === currentSlideIndex
                            ? 'white'
                            : idx < currentSlideIndex
                              ? AppColors.primary
                              : 'rgba(255, 255, 255, 0.3)'
                        }
                      ]}
                    />
                  ))}
                </View>

                {/* Story Viewer Header: User details, mute & Close */}
                <View style={[styles.storyViewerHeader, { top: insets.top + 22 }]}>
                  <Image
                    source={{
                      uri: resolveMediaUrl(
                        stories[selectedStoryIndex]?.userAvatar ||
                        stories[selectedStoryIndex]?.user?.profile_image ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                      )
                    }}
                    style={styles.storyViewerAvatar}
                  />
                  <Text style={styles.storyViewerName} numberOfLines={1}>
                    {stories[selectedStoryIndex]?.username || stories[selectedStoryIndex]?.user?.full_name || 'Champion'}
                  </Text>
                  {/* Mute / Unmute */}
                  <TouchableOpacity
                    style={styles.storyMuteBtn}
                    onPress={() => {
                      const muted = !isMusicMuted;
                      setIsMusicMuted(muted);
                      if (muted) bgMusicPlayer?.pause(); else bgMusicPlayer?.play();
                    }}
                  >
                    <Ionicons name={isMusicMuted ? 'volume-mute' : 'volume-high'} size={20} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.storyViewerCloseBtn} onPress={closeStories}>
                    <Ionicons name="close-circle" size={28} color="white" />
                  </TouchableOpacity>
                </View>

                {/* Slide title / description caption at the bottom */}
                <View style={[styles.storyViewerFooter, { bottom: insets.bottom + 8 }]}>
                  {stories[selectedStoryIndex]?.title && (
                    <Text style={styles.storyViewerTitle}>
                      {stories[selectedStoryIndex]?.title}
                    </Text>
                  )}
                  {stories[selectedStoryIndex]?.description && (
                    <Text style={styles.storyViewerDesc}>
                      {stories[selectedStoryIndex]?.description}
                    </Text>
                  )}

                  {/* Metadata labels row */}
                  <View style={styles.storyMetaOverlayRow}>
                    {stories[selectedStoryIndex]?.location && (
                      <View style={styles.storyMetaBadge}>
                        <Ionicons name="location" size={10} color="white" />
                        <Text style={styles.storyMetaBadgeText}>
                          {stories[selectedStoryIndex]?.location}
                        </Text>
                      </View>
                    )}

                    {/* Music chip — show real title or preset name */}
                    {(stories[selectedStoryIndex]?.music_title || stories[selectedStoryIndex]?.selected_music) && (
                      <View style={styles.storyMetaBadge}>
                        <Ionicons name="musical-notes" size={10} color="white" />
                        <Text style={styles.storyMetaBadgeText} numberOfLines={1}>
                          {stories[selectedStoryIndex]?.music_title || stories[selectedStoryIndex]?.selected_music}
                          {stories[selectedStoryIndex]?.music_singer ? ` · ${stories[selectedStoryIndex].music_singer}` : ''}
                        </Text>
                      </View>
                    )}

                    {stories[selectedStoryIndex]?.tagged_users && (
                      <View style={styles.storyMetaBadge}>
                        <Ionicons name="people" size={10} color="white" />
                        <Text style={styles.storyMetaBadgeText}>
                          {Array.isArray(stories[selectedStoryIndex].tagged_users)
                            ? stories[selectedStoryIndex].tagged_users.map((u: string) => `@${u}`).join(' ')
                            : stories[selectedStoryIndex].tagged_users}
                        </Text>
                      </View>
                    )}

                    {stories[selectedStoryIndex]?.hashtags && (
                      <View style={styles.storyMetaBadge}>
                        <Ionicons name="pricetag" size={10} color="white" />
                        <Text style={styles.storyMetaBadgeText}>
                          {Array.isArray(stories[selectedStoryIndex].hashtags)
                            ? stories[selectedStoryIndex].hashtags.map((h: string) => `#${h}`).join(' ')
                            : stories[selectedStoryIndex].hashtags}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Swipe Up link button */}
                  {stories[selectedStoryIndex]?.link_url && (
                    <TouchableOpacity
                      style={styles.storySwipeUpBtn}
                      onPress={() => {
                        const url = stories[selectedStoryIndex].link_url;
                        Linking.openURL(url).catch(err => console.error("Couldn't open URL", err));
                      }}
                    >
                      <Ionicons name="chevron-up" size={16} color="white" />
                      <Text style={styles.storySwipeUpText}>View Link</Text>
                    </TouchableOpacity>
                  )}

                  {/* Likes / Shares Bubble Row */}
                  {(storyLikesList.length > 0 || storySharesList.length > 0) && (
                    <View style={styles.storyBubbleRow}>
                      {storyLikesList.length > 0 && (
                        <TouchableOpacity style={styles.storyBubbleTag} onPress={handleLoadLikesList}>
                          <View style={styles.storyAvatarOverlap}>
                            {storyLikesList.slice(0, 3).map((item, idx) => (
                              <Image
                                key={item.id || idx}
                                source={{ uri: resolveMediaUrl(item.user?.profile_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100') }}
                                style={[styles.storyOverlapAvatar, { marginLeft: idx > 0 ? -10 : 0 }]}
                              />
                            ))}
                          </View>
                          <Text style={styles.storyBubbleText}>
                            Liked by {storyLikesList[0]?.user?.full_name || 'someone'}
                            {storyLikesList.length > 1 ? ` and ${storyLikesList.length - 1} others` : ''}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {storySharesList.length > 0 && (
                        <TouchableOpacity style={styles.storyBubbleTag} onPress={handleLoadSharesList}>
                          <View style={styles.storyAvatarOverlap}>
                            {storySharesList.slice(0, 3).map((item, idx) => (
                              <Image
                                key={item.id || idx}
                                source={{ uri: resolveMediaUrl(item.user?.profile_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100') }}
                                style={[styles.storyOverlapAvatar, { marginLeft: idx > 0 ? -10 : 0 }]}
                              />
                            ))}
                          </View>
                          <Text style={styles.storyBubbleText}>
                            Shared by {storySharesList[0]?.user?.full_name || 'someone'}
                            {storySharesList.length > 1 ? ` and ${storySharesList.length - 1} others` : ''}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* ── Action Bar ── */}
                  <View style={styles.storyActionBar}>
                    {/* Like */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity onPress={handleStoryLike}>
                        <Ionicons name={storyLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={26} color={storyLiked ? '#3B82F6' : 'white'} />
                      </TouchableOpacity>
                      {storyLikeCount > 0 && (
                        <TouchableOpacity onPress={handleLoadLikesList}>
                          <Text style={styles.storyActionCount}>{storyLikeCount}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Emoji Reaction */}
                    <TouchableOpacity style={styles.storyActionBtn} onPress={() => setShowReactionPicker(p => !p)}>
                      <Text style={{ fontSize: 22 }}>{userReaction || '😊'}</Text>
                    </TouchableOpacity>

                    {/* Comment */}
                    <TouchableOpacity style={styles.storyActionBtn} onPress={handleLoadStoryComments}>
                      <Ionicons name="chatbubble-outline" size={24} color="white" />
                      {(stories[selectedStoryIndex]?.stats?.comments ?? 0) > 0 && (
                        <Text style={styles.storyActionCount}>{stories[selectedStoryIndex]?.stats?.comments}</Text>
                      )}
                    </TouchableOpacity>

                    {/* Share */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity onPress={handleStoryShare}>
                        <Ionicons name="share-social-outline" size={24} color="white" />
                      </TouchableOpacity>
                      {(stories[selectedStoryIndex]?.stats?.shares ?? 0) > 0 && (
                        <TouchableOpacity onPress={handleLoadSharesList}>
                          <Text style={styles.storyActionCount}>{stories[selectedStoryIndex]?.stats?.shares}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* View count */}
                    <View style={styles.storyActionBtn}>
                      <Ionicons name="eye-outline" size={22} color="rgba(255,255,255,0.7)" />
                      <Text style={[styles.storyActionCount, { color: 'rgba(255,255,255,0.7)' }]}>
                        {stories[selectedStoryIndex]?.stats?.views ?? 0}
                      </Text>
                    </View>
                  </View>

                  {/* Reaction picker row */}
                  {showReactionPicker && (
                    <View style={styles.storyReactionPicker}>
                      {['❤️', '😂', '😮', '😢', '😡', '👏'].map(em => (
                        <TouchableOpacity key={em} onPress={() => handleStoryReact(em)} style={styles.storyReactionEmoji}>
                          <Text style={{ fontSize: 26 }}>{em}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Reaction summary */}
                  {Object.keys(storyReactions).length > 0 && (
                    <View style={styles.storyReactionSummary}>
                      {Object.entries(storyReactions).slice(0, 5).map(([emoji, count]) => (
                        <Text key={emoji} style={styles.storyReactionSummaryItem}>{emoji} {count as number}</Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* Comment Bottom Sheet */}
                {showStoryComments && (
                  <View style={[styles.storyCommentSheet, { paddingBottom: insets.bottom + 8 }]}>
                    <View style={styles.storyCommentSheetHeader}>
                      <Text style={styles.storyCommentSheetTitle}>Comments</Text>
                      <TouchableOpacity onPress={() => setShowStoryComments(false)}>
                        <Ionicons name="chevron-down" size={22} color="#aaa" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
                      {storyComments.length === 0 ? (
                        <Text style={styles.storyCommentEmpty}>No comments yet. Be the first!</Text>
                      ) : storyComments.map((comment: any) => (
                        <View key={comment.id} style={styles.storyCommentItem}>
                          <View style={styles.storyCommentRow}>
                            <Text style={styles.storyCommentUser}>{comment.user?.full_name || 'User'}</Text>
                            <Text style={styles.storyCommentContent}>{comment.content}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setExpandedReplyCommentId(
                              expandedReplyCommentId === String(comment.id) ? null : String(comment.id)
                            )}
                          >
                            <Text style={styles.storyCommentReplyToggle}>
                              {comment.reply_count > 0 ? `${comment.reply_count} replies` : 'Reply'}
                            </Text>
                          </TouchableOpacity>
                          {expandedReplyCommentId === String(comment.id) && (
                            <View style={styles.storyRepliesBlock}>
                              {(comment.replies || []).map((reply: any) => (
                                <View key={reply.id} style={styles.storyReplyItem}>
                                  <Text style={styles.storyCommentUser}>{reply.user?.full_name || 'User'}</Text>
                                  <Text style={styles.storyCommentContent}>{reply.content}</Text>
                                </View>
                              ))}
                              <View style={styles.storyReplyInputRow}>
                                <TextInput
                                  style={styles.storyReplyInput}
                                  placeholder="Write a reply..."
                                  placeholderTextColor="#888"
                                  value={replyInputs[comment.id] || ''}
                                  onChangeText={t => setReplyInputs(prev => ({ ...prev, [comment.id]: t }))}
                                />
                                <TouchableOpacity onPress={() => handleSendReply(String(comment.id))}>
                                  <Ionicons name="send" size={18} color={AppColors.primary} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                    {/* Comment input */}
                    <View style={styles.storyCommentInputRow}>
                      <TextInput
                        style={styles.storyCommentInput}
                        placeholder="Add a comment..."
                        placeholderTextColor="#888"
                        value={storyCommentInput}
                        onChangeText={setStoryCommentInput}
                        onSubmitEditing={handleSendStoryComment}
                        returnKeyType="send"
                      />
                      <TouchableOpacity onPress={handleSendStoryComment} disabled={storyCommentSending}>
                        {storyCommentSending
                          ? <ActivityIndicator size={18} color={AppColors.primary} />
                          : <Ionicons name="send" size={20} color={AppColors.primary} />
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Fullscreen feed media viewer (mirrors Profile screen gallery) */}
      <FeedMediaCarouselViewer
        visible={feedMediaViewerVisible}
        items={feedMediaViewerItems}
        startIndex={feedMediaViewerIndex}
        onClose={() => setFeedMediaViewerVisible(false)}
      />

      {/* Story Likes Modal */}
      <Modal
        visible={showLikesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { setShowLikesModal(false); setIsStoryPaused(false); }}
      >
        <View style={styles.storyListModalOverlay}>
          <View style={styles.storyListModalContent}>
            <View style={styles.storyListModalHeader}>
              <Text style={styles.storyListModalTitle}>Liked By</Text>
              <TouchableOpacity onPress={() => { setShowLikesModal(false); setIsStoryPaused(false); }}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {storyLikesLoading ? (
              <ActivityIndicator size="large" color={AppColors.primary} style={{ marginVertical: 30 }} />
            ) : storyLikesList.length === 0 ? (
              <Text style={styles.storyListModalEmpty}>No likes yet.</Text>
            ) : (
              <FlatList
                data={storyLikesList}
                keyExtractor={(item) => (item.id || item.user?.id || Math.random()).toString()}
                renderItem={({ item }) => (
                  <View style={styles.storyListUserItem}>
                    <Image
                      source={{ uri: resolveMediaUrl(item.user?.profile_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100') }}
                      style={styles.storyListUserAvatar}
                    />
                    <View>
                      <Text style={styles.storyListUserName}>{item.user?.full_name || 'Champion'}</Text>
                      {item.user?.first_name && <Text style={styles.storyListUserDisplay}>@{item.user.first_name}</Text>}
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Story Shares Modal */}
      <Modal
        visible={showSharesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { setShowSharesModal(false); setIsStoryPaused(false); }}
      >
        <View style={styles.storyListModalOverlay}>
          <View style={styles.storyListModalContent}>
            <View style={styles.storyListModalHeader}>
              <Text style={styles.storyListModalTitle}>Shared By</Text>
              <TouchableOpacity onPress={() => { setShowSharesModal(false); setIsStoryPaused(false); }}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {storySharesLoading ? (
              <ActivityIndicator size="large" color={AppColors.primary} style={{ marginVertical: 30 }} />
            ) : storySharesList.length === 0 ? (
              <Text style={styles.storyListModalEmpty}>No shares yet.</Text>
            ) : (
              <FlatList
                data={storySharesList}
                keyExtractor={(item) => (item.id || item.user?.id || Math.random()).toString()}
                renderItem={({ item }) => (
                  <View style={styles.storyListUserItem}>
                    <Image
                      source={{ uri: resolveMediaUrl(item.user?.profile_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100') }}
                      style={styles.storyListUserAvatar}
                    />
                    <View>
                      <Text style={styles.storyListUserName}>{item.user?.full_name || 'Champion'}</Text>
                      {item.user?.first_name && <Text style={styles.storyListUserDisplay}>@{item.user.first_name}</Text>}
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>


      {/* Profile Panel drawer overlay */}
      {showProfilePanel && (
        <View style={styles.overlay}>
          <View style={styles.profilePanel}>
            <View style={styles.profilePanelHeader}>
              <Text style={styles.profilePanelTitle}>My Profile</Text>
              <TouchableOpacity onPress={() => setShowProfilePanel(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePanelCard}>
              {user?.profileImage ? (
                <Image source={{ uri: resolveMediaUrl(user.profileImage) }} style={styles.panelAvatar} />
              ) : (
                <View style={styles.panelAvatarPlaceholder}>
                  <Text style={styles.panelAvatarText}>
                    {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
                  </Text>
                </View>
              )}
              <Text style={styles.panelName}>{user?.fullName || 'Eco Champion'}</Text>
              <Text style={styles.panelEmail}>{user?.email}</Text>

              {/* Level & stats metrics */}
              <View style={styles.panelStatsContainer}>
                <View style={styles.panelStatBox}>
                  <Text style={styles.panelStatVal}>{user?.level ?? 1}</Text>
                  <Text style={styles.panelStatLabel}>Level</Text>
                </View>
                <View style={styles.panelStatBox}>
                  <Text style={styles.panelStatVal}>{user?.points ?? 0}</Text>
                  <Text style={styles.panelStatLabel}>Points</Text>
                </View>
                <View style={styles.panelStatBox}>
                  <Text style={styles.panelStatVal}>{user?.xp ?? 0}</Text>
                  <Text style={styles.panelStatLabel}>XP</Text>
                </View>
              </View>
            </View>

            <View style={styles.panelMenuItems}>
              {/* Admin Dashboard button rendered for Admin users */}
              {((user?.roles && (user.roles.includes('ROLE_ADMIN') || user.roles.includes('ROLE_SUPER_ADMIN'))) ||
                (user as any)?.user_roles?.some((r: any) => r.name === 'ROLE_ADMIN' || r === 'ROLE_ADMIN') ||
                (user as any)?.userRoles?.some((r: any) => r.name === 'ROLE_ADMIN' || r === 'ROLE_ADMIN') ||
                (user as any)?.is_admin ||
                (user as any)?.isAdmin) && (
                <TouchableOpacity
                  style={[styles.panelMenuItem, { backgroundColor: '#FEF2F2', borderRadius: 10, paddingVertical: 12, marginBottom: 4 }]}
                  onPress={() => {
                    setShowProfilePanel(false);
                    navigation.navigate('AdminDashboard');
                  }}
                >
                  <Ionicons name="shield-half-outline" size={20} color="#DC2626" />
                  <Text style={[styles.panelMenuText, { color: '#DC2626', fontWeight: '800' }]}>
                    Admin Dashboard
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.panelMenuItem}
                onPress={() => {
                  setShowProfilePanel(false);
                  navigation.navigate('MyCarShares');
                }}
              >
                <Ionicons name="car-sport-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>My Car Shares</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.panelMenuItem}
                onPress={() => {
                  setShowProfilePanel(false);
                  navigation.navigate('Badges');
                }}
              >
                <Ionicons name="ribbon-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>My Impact Badges</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.panelMenuItem}
                onPress={() => {
                  setShowProfilePanel(false);
                  navigation.navigate('ActivityHistory');
                }}
              >
                <Ionicons name="checkmark-done-circle-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>Logged Eco Actions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.panelMenuItem}
                onPress={() => {
                  setShowProfilePanel(false);
                  navigation.navigate('Settings');
                }}
              >
                <Ionicons name="settings-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>Settings & Privacy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.panelLogoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={AppColors.error} />
              <Text style={styles.panelLogoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.overlayCloseArea} onPress={() => setShowProfilePanel(false)} />
        </View>
      )}

      {/* Comments modal sheet — comments now open as a full page via handleOpenComments */}

      {/* Custom Edit Post Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
            <Text style={styles.editModalTitle}>Edit Post</Text>
            <TextInput
              style={styles.editTextInput}
              value={editingTextState}
              onChangeText={setEditingTextState}
              multiline
              maxLength={2000}
              placeholder="Update your eco action..."
            />
            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.editModalBtn, styles.editCancelBtn]}
                onPress={() => {
                  setIsEditModalVisible(false);
                  setEditingPost(null);
                }}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editModalBtn, styles.editSaveBtn]}
                onPress={handleSaveEdit}
                disabled={editSubmitting || !editingTextState.trim()}
              >
                {editSubmitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.editSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Floating Action Button (FAB) for Creating Post/Group */}
      {showFab && !isLoading && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            if (currentTab === 0) {
              navigation.navigate('CreatePost');
            } else {
              navigation.navigate('CreateGroup');
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name={currentTab === 0 ? "create" : "add"} size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Custom Action Sheet Modal */}
      <CustomActionSheetModal
        visible={actionSheetConfig.visible}
        title={actionSheetConfig.title}
        subtitle={actionSheetConfig.subtitle}
        options={actionSheetConfig.options}
        onClose={() => setActionSheetConfig(prev => ({ ...prev, visible: false }))}
        cancelButtonText="Back"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    backgroundColor: 'white',
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    height: 36,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerMainRow: {
    height: 60,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerMenuBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerBrandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: AppColors.primary,
    letterSpacing: 0.3,
  },
  headerAvatarContainer: {
    padding: 2,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: AppColors.primary,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionBtn: {
    marginLeft: 14,
    padding: 4,
  },
  headerSegmentedControl: {
    position: 'absolute',
    left: '50%',
    marginLeft: -70,
    bottom: 12,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 2,
    width: 140,
  },
  headerSegmentBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSegmentBtnActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    elevation: 2,
  },
  headerSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  headerSegmentTextActive: {
    color: AppColors.primary,
  },
  content: {
    flex: 1,
  },
  storiesContainer: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  // Circular story bubble styles (matching reference design)
  storyBubbleWrap: {
    alignItems: 'center',
    marginRight: 14,
    width: 68,
  },
  storyBubbleRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 2.5,
    backgroundColor: AppColors.primary,
    marginBottom: 6,
  },
  storyBubbleCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'white',
    overflow: 'hidden',
  },
  storyBubbleCircleCreate: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 6,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  storyBubbleInnerImg: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  storyBubblePlusBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  storyBubbleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textDark,
    textAlign: 'center',
    maxWidth: 66,
  },
  // Legacy story card styles kept for skeleton loader
  storyCard: {
    width: 66,
    height: 66,
    borderRadius: 33,
    marginRight: 14,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  storyCardBg: { width: '100%', height: '100%' },
  storyCardOverlay: { display: 'none' },
  storyCardContent: { display: 'none' },
  storyCardAvatar: { width: 28, height: 28, borderRadius: 14 },
  storyCardName: { fontSize: 10, fontWeight: '700', color: AppColors.textDark },
  tipCard: {
    backgroundColor: '#EEFDFC',
    borderRadius: 14,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#CCFAF6',
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0D9488',
    marginLeft: 6,
  },
  tipText: {
    fontSize: 13,
    color: '#0F766E',
    lineHeight: 18,
  },
  tipExpandContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#CCFAF6',
  },
  tipInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipInfoText: {
    fontSize: 12,
    color: '#0F766E',
    marginLeft: 8,
    flex: 1,
  },
  learnMoreBtn: {
    marginTop: 10,
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  eventsSection: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  sectionAction: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
  },
  eventsScroll: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  eventCard: {
    width: 200,
    backgroundColor: 'white',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECECEC',
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: 100,
  },
  eventTagBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  eventTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  eventContent: {
    padding: 10,
  },
  eventCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  eventCardDesc: {
    fontSize: 12,
    color: AppColors.textLight,
    lineHeight: 17,
    marginBottom: 4,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  eventInfoText: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginLeft: 4,
    flex: 1,
  },
  feedHeaderRow: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  postsList: {
    paddingHorizontal: 0,
  },
  // ─── Post card — matches ProfileScreen style ───
  postCard: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e2e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  postBannerChallenge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F5E9', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#EBEBEB', gap: 8,
  },
  postBannerGroup: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#EBEBEB', gap: 8,
  },
  postBannerEvent: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#EBEBEB', gap: 8,
  },
  postBannerIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#4CAF5020', justifyContent: 'center', alignItems: 'center',
  },
  postBannerLabel: { fontSize: 10, color: '#4CAF50', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 } as any,
  postBannerTitle: { fontSize: 13, color: AppColors.textDark, fontWeight: '700' },
  postBannerLvlBadge: { backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  postBannerLvlText: { fontSize: 10, color: '#0284C7', fontWeight: '700' },
  // Post header
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  postAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  postAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: '#e2e2e5',
  },
  postAuthorDetails: { marginLeft: 10, flex: 1 },
  postAuthorName: { fontSize: 14, fontWeight: '700', color: '#1a1c1e' },
  postTime: { fontSize: 12, color: '#3d4a40', marginTop: 2 },
  postOptionBtn: { padding: 4, marginLeft: 8 },
  postContent: { fontSize: 14, color: '#1a1c1e', lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
  hashtagsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 8, marginBottom: 10 },
  hashtagPill: { backgroundColor: '#E8F5E9', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  hashtagPillText: { color: AppColors.primary, fontSize: 13, fontWeight: '600' },
  postMediaWrapper: { position: 'relative', marginHorizontal: 0 },
  postVideoBox: {
    width: '100%',
    height: FEED_MEDIA_HEIGHT,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  postVideoSource: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  postMediaImage: { width: '100%', height: FEED_MEDIA_HEIGHT },
  postMediaBlock: { width: '100%', height: FEED_MEDIA_HEIGHT },
  postStatsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e2e5' },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postStatText: { fontSize: 12, color: '#3d4a40', fontWeight: '600' },
  mediaCountBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  mediaCountText: { color: 'white', fontSize: 12, fontWeight: '700' },
  tapToViewBanner: {
    position: 'absolute', left: 8, bottom: 8,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  tapToViewText: { color: 'white', fontSize: 11, fontWeight: '600' },
  feedMediaViewerOverlay: { flex: 1, backgroundColor: '#000' },
  feedMediaViewerHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  feedMediaViewerClose: { padding: 8 },
  feedMediaViewerCounter: { color: 'white', fontSize: 15, fontWeight: '700' },
  feedMediaDotsRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', bottom: 20 },
  feedMediaDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 4 },
  feedMediaDotActive: { backgroundColor: 'white' },
  postImage: {
    width: '100%',
    height: '100%',
  },
  carouselContainer: {
    position: 'relative',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  postCarouselImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  muteIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 14,
    padding: 6,
    zIndex: 10,
  },
  carouselIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  carouselIndicatorText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  // Upgraded Video Player Styles
  playingBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 20,
    gap: 6,
  },
  playingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#006d40',
  },
  playingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  videoSettingsBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    zIndex: 20,
  },
  pausedCenterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  pausedCenterClickArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pausedPlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  videoBottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    zIndex: 18,
  },
  videoBottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  videoTimeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  videoRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  videoIconBtn: {
    padding: 4,
  },
  progressBarWrapper: {
    height: 16,
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#006d40',
    borderRadius: 2,
  },
  progressBarThumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#006d40',
  },
  volumePercentText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    minWidth: 26,
    textAlign: 'center',
  },
  pollCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  pollTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 10,
  },
  pollOptionBtn: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: 'white',
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pollOptionVoted: {
    borderColor: AppColors.primary,
  },
  pollProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#E6F4EA',
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pollOptionText: {
    fontSize: 13,
    color: AppColors.textDark,
    fontWeight: '500',
  },
  pollOptionTextVoted: {
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  pollPercentText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginTop: 4,
  },
  postFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  postFooterText: {
    fontSize: 14,
    color: AppColors.textMedium,
    marginLeft: 5,
    fontWeight: '500',
  },
  likedText: {
    color: AppColors.error,
    fontWeight: 'bold',
  },
  pillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillBtnActive: {
    backgroundColor: AppColors.primaryLight,
    borderColor: AppColors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  pillTextActive: {
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  createBarContainer: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  createBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  createBarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
  createBarAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBarAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  createBarInputPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: AppColors.textMedium,
    marginLeft: 10,
    marginRight: 8,
  },
  createBarBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createBarBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: AppColors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  groupsHeaderRow: {
    padding: 16,
  },
  groupsSubtitle: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 4,
  },
  groupsList: {
    paddingHorizontal: 16,
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  groupCardBannerContainer: {
    height: 120,
    width: '100%',
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  groupCardBanner: {
    width: '100%',
    height: '100%',
  },
  groupPrivacyBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  groupPrivacyText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  groupProfileOverlayRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -28, // Overlap cover banner
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  groupAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'white',
    backgroundColor: 'white',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  groupCardModernized: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#bccabd', // matched outline-variant
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
    position: 'relative',
  },
  groupHeroImageContainer: {
    height: 190,
    width: '100%',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  groupHeroImage: {
    width: '100%',
    height: '100%',
  },
  groupCoverFallbackContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF', // milk white
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCoverFallbackCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E6F4EA', // perfect light circle
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCoverFallbackText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#006d40', // matched primary
  },
  groupPrivacyBadgeOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  groupPrivacyTextOverlay: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  groupMemberBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#d9e6da', // matched secondary-container
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  groupMemberBadgeTextOverlay: {
    color: '#006d40', // matched primary
    fontSize: 12,
    fontWeight: '600',
  },
  groupCardContentModernized: {
    padding: 16,
  },
  groupCardNameModernized: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1c1e', // matched on-surface
  },
  groupCardMembersIndicatorTextModernized: {
    fontSize: 14,
    color: '#3d4a40', // matched on-surface-variant
    fontWeight: '500',
  },
  groupCardDescModernized: {
    fontSize: 14,
    color: '#3d4a40', // matched on-surface-variant
    lineHeight: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  activitySnippetContainer: {
    backgroundColor: '#f3f3f6', // matched surface-container-low
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(188, 202, 189, 0.3)', // matched outline-variant/30
    marginVertical: 10,
    marginBottom: 12,
  },
  activitySnippetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  activitySnippetAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  activitySnippetUser: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1c1e', // matched on-surface
  },
  activitySnippetTime: {
    fontSize: 10,
    color: '#3d4a40', // matched on-surface-variant
    marginLeft: 4,
  },
  activitySnippetText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#3d4a40', // matched on-surface-variant
  },
  groupCardActionButtonsRowModernized: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  groupCardDetailsActionBtnModernized: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#006d40', // matched primary
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  groupCardDetailsActionBtnTextModernized: {
    fontSize: 13,
    fontWeight: '600',
    color: '#006d40', // matched primary
  },
  groupCardJoinActionBtnModernized: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#006d40', // matched primary
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  groupCardJoinActionBtnMemberModernized: {
    backgroundColor: '#eeeef0', // matched surface-container
    borderWidth: 0,
    opacity: 0.7,
  },
  groupCardJoinActionBtnPendingModernized: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  groupCardJoinActionBtnTextModernized: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  groupCardJoinActionBtnTextMemberModernized: {
    color: '#1a1c1e', // matched on-surface
    fontSize: 13,
    fontWeight: '600',
  },
  groupCardJoinActionBtnTextPendingModernized: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '600',
  },
  searchCardContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bccabd', // matched outline-variant
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d9e6da', // matched secondary-container
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchCardBar: {
    flexDirection: 'row',
    backgroundColor: '#f3f3f6', // matched surface-container-low
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchCardInput: {
    flex: 1,
    color: '#1a1c1e', // matched on-surface
    fontSize: 14,
    marginLeft: 8,
    height: '100%',
    padding: 0,
  },
  searchCardBtn: {
    backgroundColor: '#006d40', // matched primary
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  searchCardBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  groupAvatar: {
    width: '100%',
    height: '100%',
  },
  groupTitleContainer: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 2,
  },
  groupNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  groupMetaText: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  groupCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  groupDescText: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 14,
  },
  groupStatsRowModern: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  groupStatBoxModern: {
    flex: 1,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValModern: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  statLabelModern: {
    fontSize: 9,
    color: AppColors.textLight,
    marginTop: 1,
  },
  groupCardFooterModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mutualFriendsContainerModern: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mutualAvatarModern: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  mutualFriendsTextModern: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginLeft: 6,
  },
  ecoInitiativeText: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '600',
  },
  groupActionBtnModern: {
    backgroundColor: AppColors.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  groupActionBtnJoinedModern: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  groupActionBtnPendingModern: {
    backgroundColor: '#F3F4F6',
  },
  groupActionTextModern: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  groupActionTextJoinedModern: {
    color: AppColors.primary,
  },
  groupActionTextPendingModern: {
    color: AppColors.textMedium,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: 'row',
    zIndex: 999,
  },
  overlayCloseArea: {
    flex: 1,
  },
  profilePanel: {
    width: '78%',
    backgroundColor: 'white',
    height: '100%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  profilePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: Platform.OS === 'ios' ? 40 : 10,
  },
  profilePanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  profilePanelCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  panelAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  panelAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  panelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  panelEmail: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
    marginBottom: 16,
  },
  panelStatsContainer: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
    paddingTop: 12,
  },
  panelStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  panelStatVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  panelStatLabel: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 2,
  },
  panelMenuItems: {
    flex: 1,
  },
  panelMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  panelMenuText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.textDark,
    marginLeft: 12,
  },
  panelLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  panelLogoutText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: AppColors.error,
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    marginTop: 12,
    color: AppColors.textMedium,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
    color: AppColors.textMedium,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 24,
  },

  // Stories Pop-up Glass Modal styles - REDESIGNED FULL SCREEN EXPERIENCE
  storyModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  storyViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyInnerWrapper: {
    flex: 1,
    position: 'relative',
  },
  storyViewerImageWrapper: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  storyViewerImage: {
    width: '100%',
    height: '100%',
  },
  storyViewerGestureOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  storyProgressContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    height: 3,
    zIndex: 20,
  },
  storyProgressBar: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  storyViewerHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  storyViewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  storyViewerName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  storyViewerCloseBtn: {
    padding: 4,
  },
  storyViewerFooter: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'flex-start',
    zIndex: 20,
  },
  storyMuteBtn: {
    padding: 6,
    marginRight: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
  },
  storyActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 14,
    flexWrap: 'wrap',
  },
  storyActionBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  storyActionCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  storyReactionPicker: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  storyReactionEmoji: {
    padding: 2,
  },
  storyReactionSummary: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  storyReactionSummaryItem: {
    color: 'white',
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  storyBubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  storyBubbleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  storyAvatarOverlap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyOverlapAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'white',
  },
  storyBubbleText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  storyListModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  storyListModalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  storyListModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
    paddingBottom: 10,
    marginBottom: 10,
  },
  storyListModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  storyListModalEmpty: {
    textAlign: 'center',
    color: AppColors.textLight,
    marginVertical: 20,
  },
  storyListUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#CFD8DC',
  },
  storyListUserAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
  },
  storyListUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  storyListUserDisplay: {
    fontSize: 12,
    color: AppColors.textLight,
  },
  storyCommentSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    zIndex: 30,
    maxHeight: '65%',
  },
  storyCommentSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  storyCommentSheetTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  storyCommentEmpty: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 16,
    fontSize: 13,
  },
  storyCommentItem: {
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 8,
  },
  storyCommentRow: {
    flexDirection: 'column',
  },
  storyCommentUser: {
    color: '#A78BFA',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  storyCommentContent: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  storyCommentReplyToggle: {
    color: '#60A5FA',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  storyRepliesBlock: {
    marginLeft: 12,
    marginTop: 6,
  },
  storyReplyItem: {
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(167,139,250,0.4)',
  },
  storyReplyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  storyReplyInput: {
    flex: 1,
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
  },
  storyCommentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
  },
  storyCommentInput: {
    flex: 1,
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },

  storyViewerTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  groupStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 10,
  },
  groupStatItem: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'column',
  },
  groupStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginTop: 2,
  },
  groupStatLabel: {
    fontSize: 10,
    color: AppColors.textLight,
  },
  groupDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  mutualFriendsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  avatarOverlapContainer: {
    flexDirection: 'row',
    marginRight: 6,
  },
  mutualAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  mutualFriendsText: {
    fontSize: 11,
    color: AppColors.textMedium,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: AppColors.error,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  notifBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 12,
  },
  editTextInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: AppColors.textDark,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  editCancelText: {
    color: AppColors.textMedium,
    fontWeight: '600',
    fontSize: 14,
  },
  editSaveBtn: {
    backgroundColor: AppColors.primary,
  },
  editSaveText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  coffeeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFDD00',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  coffeeIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coffeeTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  coffeeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  coffeeSubtitle: {
    fontSize: 10,
    color: '#374151',
    marginTop: 1,
    fontWeight: '500',
  },
  coffeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  coffeeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
  },
  createStoryCardCenter: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  createStoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  createStoryCardText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  storyCardUserInfo: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    maxWidth: '90%',
  },
  storyViewerDesc: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  storyMetaOverlayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  storyMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  storyMetaBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  storySwipeUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  storySwipeUpText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },

  // ── Tab bar — matches reference: left-aligned tabs ──
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    height: 46,
    paddingHorizontal: 4,
  },
  topTabBtn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.textMedium,
    paddingBottom: 2,
  },
  topTabTextActive: {
    color: AppColors.primary,
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: AppColors.primary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  postFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.primary,
    backgroundColor: 'rgba(11, 110, 79, 0.05)',
    marginRight: 8,
  },
  postFollowingBtn: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  postFollowBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
  },
  postFollowingBtnText: {
    color: AppColors.textMedium,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageWrap: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    backgroundColor: AppColors.primary + 'C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6', // Blue for verified
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    gap: 4,
  },
  verifiedText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  privateBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  privateText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    marginBottom: 4,
    lineHeight: 22,
  },
  cardOrganizer: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  cardInfoText: {
    fontSize: 12,
    color: AppColors.textMedium,
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 6,
    minWidth: 100,
  },
  regBtnActive: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  regBtnPending: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  regBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  regBtnTextActive: {
    color: AppColors.primary,
  },
  regBtnTextPending: {
    color: '#D97706',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  detailBtnText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 18,
  },
});
