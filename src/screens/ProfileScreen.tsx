import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
  StatusBar,
  Modal,
  FlatList,
  Animated,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';
import AdminAccessButton from '../components/AdminAccessButton';
import { UrlHelper } from '../utils/urlHelper';
import { CustomActionSheetModal, ActionSheetOption } from '../components/CustomActionSheetModal';
import { CollaborationInquiryModal } from '../components/CollaborationInquiryModal';
import { CollaborationInquiriesListModal } from '../components/CollaborationInquiriesListModal';
import associationService from '../services/associationService';
import feedService, { Feed } from '../services/feedService';
import authService from '../services/authService';
import { useSafeVideoPlayer } from '../hooks/useSafeVideoPlayer';
import { VideoView } from 'expo-video';
import { useEvent } from 'expo';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 32 - 12) / 3;

const resolveUrl = (url?: string) => UrlHelper.convertPathToUrl(url);

const isVideoUrl = (url?: string) => {
  if (!url) return false;
  const lo = url.toLowerCase();
  return lo.endsWith('.mp4') || lo.endsWith('.mov') || lo.endsWith('.avi')
    || lo.endsWith('.mkv') || lo.endsWith('.webm') || lo.endsWith('.3gp')
    || lo.includes('/videos/');
};

// ── Media Carousel Viewer ────────────────────────────────────────────────────

function MediaCarouselViewer({
  visible,
  mediaItems,
  startIndex,
  onClose,
}: {
  visible: boolean;
  mediaItems: { url: string; type: 'image' | 'video' }[];
  startIndex: number;
  onClose: () => void;
}) {
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

  const current = mediaItems[currentIndex];
  const isCurrentVideo = current ? isVideoUrl(current.url) : false;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={mediaStyles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View style={[mediaStyles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={mediaStyles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={26} color="white" />
          </TouchableOpacity>
          <Text style={mediaStyles.headerCounter}>{currentIndex + 1} / {mediaItems.length}</Text>
          <View style={mediaStyles.typeTag}>
            <Ionicons name={isCurrentVideo ? 'videocam' : 'image'} size={14} color="white" />
            <Text style={mediaStyles.typeTagText}>{isCurrentVideo ? 'Video' : 'Image'}</Text>
          </View>
        </View>

        {/* Swipeable List */}
        <FlatList
          ref={flatRef}
          data={mediaItems}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <MediaCarouselSlide item={item} isActive={index === currentIndex} />
          )}
        />

        {/* Dots Indicator */}
        {mediaItems.length > 1 && (
          <View style={[mediaStyles.dotsRow, { paddingBottom: insets.bottom + 16 }]}>
            {mediaItems.map((_, i) => (
              <View
                key={i}
                style={[mediaStyles.dot, i === currentIndex && mediaStyles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

function MediaCarouselSlide({ item, isActive }: { item: { url: string; type: 'image' | 'video' }; isActive: boolean }) {
  const player = useSafeVideoPlayer(item.type === 'video' ? item.url : null, p => {
    p.loop = false;
    p.muted = false;
  });

  const dummyObj = useRef({ playing: false }).current;
  const targetPlayer = player || (dummyObj as any);
  const { isPlaying } = useEvent(targetPlayer, 'playingChange', { isPlaying: targetPlayer.playing }) as any;

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
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
          <View style={mediaStyles.playIconOverlay} pointerEvents="none">
            <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={{ uri: resolveUrl(item.url) }}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 }}
        resizeMode="contain"
      />
    </View>
  );
}

const mediaStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: { padding: 4 },
  headerCounter: { color: 'white', fontSize: 15, fontWeight: '600' },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeTagText: { color: 'white', fontSize: 12, fontWeight: '600' },
  dotsRow: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: 'white', width: 16 },
  playIconOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
});

// ── Story Viewer Modal (single-story, multi-slide) ────────────────────────────

function ProfileStoryViewer({
  visible,
  story,
  onClose,
}: {
  visible: boolean;
  story: any;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [slideIndex, setSlideIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);

  const slides: any[] = story?.slides || [];
  const totalSlides = Math.max(slides.length, 1);

  useEffect(() => {
    if (!visible) return;
    setSlideIndex(0);
    startProgress();
    return () => { progressRef.current?.stop(); };
  }, [visible, story]);

  useEffect(() => {
    if (!visible) return;
    progressAnim.setValue(0);
    startProgress();
  }, [slideIndex]);

  const startProgress = () => {
    progressRef.current?.stop();
    progressAnim.setValue(0);
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    });
    progressRef.current.start(({ finished }) => {
      if (finished) handleNextSlide();
    });
  };

  const handleNextSlide = () => {
    if (slideIndex < totalSlides - 1) {
      setSlideIndex(i => i + 1);
    } else {
      onClose();
    }
  };

  const handlePrevSlide = () => {
    if (slideIndex > 0) setSlideIndex(i => i - 1);
  };

  if (!story) return null;

  const slide = slides[slideIndex];
  const mediaUrl = resolveUrl(
    slide?.media_url || slide?.mediaUrl ||
    story?.thumbnail_url || story?.thumbnailUrl
  );
  const isVideo = slide
    ? isVideoUrl(slide.media_url || slide.mediaUrl)
    : isVideoUrl(story?.video_url || story?.videoUrl);
  const username = story?.user?.full_name || story?.username || 'User';
  const avatar = resolveUrl(story?.user?.profile_image || story?.user?.avatar_url);
  const storyTitle = story?.title || 'Story';

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={storyViewStyles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />

        {/* Background media */}
        <View style={storyViewStyles.bg}>
          {isVideo ? (
            <View style={{ flex: 1, backgroundColor: '#000' }} />
          ) : (
            <Image source={{ uri: mediaUrl }} style={{ flex: 1 }} resizeMode="cover" />
          )}
          <View style={storyViewStyles.bgDim} />
        </View>

        {/* Progress bars */}
        <View style={[storyViewStyles.progressRow, { top: insets.top + 8 }]}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <View key={i} style={[storyViewStyles.progressTrack, { flex: 1 }]}>
              {i < slideIndex ? (
                <View style={[storyViewStyles.progressFill, { width: '100%' }]} />
              ) : i === slideIndex ? (
                <Animated.View style={[storyViewStyles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              ) : null}
            </View>
          ))}
        </View>

        {/* Header row */}
        <View style={[storyViewStyles.storyHeader, { top: insets.top + 28 }]}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={storyViewStyles.storyAvatar} />
          ) : (
            <View style={[storyViewStyles.storyAvatar, { backgroundColor: AppColors.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>{username.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={storyViewStyles.storyUsername}>{username}</Text>
            <Text style={storyViewStyles.storyTitle} numberOfLines={1}>{storyTitle}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Touch zones */}
        <View style={storyViewStyles.touchRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={handlePrevSlide} />
          <TouchableOpacity style={{ flex: 1 }} onPress={handleNextSlide} />
        </View>

        {/* Caption / description */}
        {(slide?.caption || story?.description) ? (
          <View style={[storyViewStyles.captionBox, { bottom: insets.bottom + 32 }]}>
            <Text style={storyViewStyles.captionText}>{slide?.caption || story?.description}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const storyViewStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bgDim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  progressRow: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', gap: 4,
  },
  progressTrack: {
    height: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden', marginHorizontal: 1,
  },
  progressFill: { height: '100%', backgroundColor: 'white', borderRadius: 1 },
  storyHeader: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  storyAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: AppColors.primary },
  storyUsername: { color: 'white', fontSize: 13, fontWeight: '700' },
  storyTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  touchRow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  captionBox: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  captionText: { color: 'white', fontSize: 14, lineHeight: 20 },
});

// ── Main ProfileScreen ────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const route = useRoute<any>();
  const { user: currentUser, refreshProfile, logout } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const userId = route?.params?.userId;
  const isMe = !userId || String(userId) === String(currentUser?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileUser, setProfileUser] = useState<any>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Feeds
  const [userFeeds, setUserFeeds] = useState<Feed[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);

  // Stories
  const [userStories, setUserStories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'feed' | 'media' | 'stories' | 'contact'>('feed');

  // Media gallery viewer
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerItems, setMediaViewerItems] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [mediaViewerStartIndex, setMediaViewerStartIndex] = useState(0);

  // Story viewer
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [selectedStory, setSelectedStory] = useState<any>(null);

  // Collaboration Inquiries Modals State
  const [collabModalVisible, setCollabModalVisible] = useState(false);
  const [inquiriesListModalVisible, setInquiriesListModalVisible] = useState(false);

  // Custom Action Sheet Modal State
  const [actionSheetConfig, setActionSheetConfig] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    options: ActionSheetOption[];
  }>({
    visible: false,
    title: 'Profile Options',
    options: [],
  });

  // ── Data Fetchers ──────────────────────────────────────────────────────────

  const fetchProfileUser = useCallback(async () => {
    if (isMe) return;
    setLoading(true);
    try {
      const res = await authService.getUserById(Number(userId));
      if (res.success && res.user) {
        setProfileUser(res.user);
        setIsFollowing(!!res.user.is_following);
      } else {
        Alert.alert('Error', res.message || 'Failed to fetch user profile.');
      }
    } catch (e: any) {
      console.error('Error fetching target profile:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, isMe]);

  const fetchUserFeeds = useCallback(async () => {
    const targetId = isMe ? currentUser?.id : userId;
    if (!targetId) return;
    setLoadingFeeds(true);
    try {
      const feeds = await feedService.getFeeds(1, 30, undefined, targetId);
      setUserFeeds(feeds);
    } catch (e) {
      console.error('Error fetching user feeds:', e);
    } finally {
      setLoadingFeeds(false);
    }
  }, [userId, isMe, currentUser]);

  const fetchUserStories = useCallback(async () => {
    const targetId = isMe ? currentUser?.id : userId;
    if (!targetId) return;
    setLoadingStories(true);
    try {
      const stories = await feedService.getStoryList(1, 50, targetId);
      setUserStories(stories);
    } catch (e) {
      console.error('Error fetching user stories:', e);
    } finally {
      setLoadingStories(false);
    }
  }, [userId, isMe, currentUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isMe) {
        await refreshProfile();
      } else {
        const res = await authService.getUserById(Number(userId));
        if (res.success && res.user) {
          setProfileUser(res.user);
          setIsFollowing(!!res.user.is_following);
        }
      }
      await Promise.all([fetchUserFeeds(), fetchUserStories()]);
    } catch (e: any) {
      console.warn('Failed to refresh:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, isMe, userId, fetchUserFeeds, fetchUserStories]);

  useEffect(() => {
    if (!isMe) fetchProfileUser();
    fetchUserFeeds();
    fetchUserStories();
  }, [userId, isMe, fetchProfileUser, fetchUserFeeds, fetchUserStories]);

  // Refresh feeds on focus so comment/reaction counts stay in sync (e.g. after returning from Comments)
  useFocusEffect(
    useCallback(() => {
      fetchUserFeeds();
    }, [fetchUserFeeds])
  );

  // Toggle like on a post (matches main Feed behaviour)
  const handleLikePost = async (post: Feed) => {
    setUserFeeds(prev =>
      prev.map(p =>
        p.id === post.id
          ? {
              ...p,
              user_reacted: !p.user_reacted,
              likes_count: (p.likes_count ?? p.stats?.reactions ?? 0) + (p.user_reacted ? -1 : 1),
              stats: p.stats
                ? { ...p.stats, reactions: (p.stats.reactions ?? 0) + (p.user_reacted ? -1 : 1) }
                : p.stats,
            }
          : p
      )
    );
    try {
      const result = await feedService.toggleReaction(post.id);
      if (result && result.success) {
        setUserFeeds(prev =>
          prev.map(f =>
            f.id === post.id
              ? {
                  ...f,
                  is_liked: result.isLiked,
                  user_reacted: result.isLiked,
                  likes_count: result.likesCount ?? f.likes_count,
                  stats: result.likesCount != null && f.stats
                    ? { ...f.stats, reactions: result.likesCount }
                    : f.stats,
                }
              : f
          )
        );
      }
    } catch (e) {
      console.error('Error toggling reaction:', e);
    }
  };

  const handleOpenComments = (post: Feed) => {
    navigation.navigate('Comments', {
      feedId: post.id,
      commentsCount: (post.stats?.comments ?? post.comments_count) || 0,
      feedAuthorId: post.user?.id,
    });
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleToggleFollow = async () => {
    if (!displayedUser || actionLoading) return;
    setActionLoading(true);
    try {
      if (isFollowing) {
        await associationService.unfollowUser(displayedUser.id);
        setIsFollowing(false);
        setProfileUser((prev: any) => prev ? {
          ...prev,
          followers: Math.max(0, (prev.followers || 1) - 1),
          followers_count: Math.max(0, (prev.followers_count || 1) - 1),
        } : null);
      } else {
        await associationService.followUser(displayedUser.id);
        setIsFollowing(true);
        setProfileUser((prev: any) => prev ? {
          ...prev,
          followers: (prev.followers || 0) + 1,
          followers_count: (prev.followers_count || 0) + 1,
        } : null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update follow status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessageUser = async () => {
    if (!displayedUser || actionLoading) return;
    setActionLoading(true);
    try {
      const room = await associationService.getOrCreateDirectChat(displayedUser.id);
      const chatRoom = room.chatRoom || room;
      if (chatRoom?.id) {
        navigation.navigate('ChatRoom', {
          chatRoomId: chatRoom.id,
          name: displayedUser.fullName || displayedUser.pseudo || 'Chat',
          logo: displayedUser.profileImage,
          type: 'direct',
        });
      } else {
        Alert.alert('Error', 'Failed to initialize chat room.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start message room.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Ekenox?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try { await logout(); } catch (e: any) {
            Alert.alert('Error', e.message || 'Logout failed.');
          } finally { setLoading(false); }
        },
      },
    ]);
  };

  // ── Open media gallery ─────────────────────────────────────────────────────

  const openMediaGallery = (post: Feed, mediaIndex: number = 0) => {
    if (!post.media || post.media.length === 0) return;
    const items = post.media.map((m: any) => ({
      url: m.url || m.media_url || '',
      type: isVideoUrl(m.url || m.media_url || '') ? 'video' as const : 'image' as const,
    }));
    setMediaViewerItems(items);
    setMediaViewerStartIndex(mediaIndex);
    setMediaViewerVisible(true);
  };

  // ── Open story viewer ──────────────────────────────────────────────────────

  const openStory = (story: any) => {
    setSelectedStory(story);
    setStoryViewerVisible(true);
  };

  const handleOpenProfileMenu = () => {
    const targetName = displayedUser?.fullName || displayedUser?.pseudo || 'this user';
    const isSelfProfile = isMe || Boolean(currentUser?.id && displayedUser?.id && String(currentUser.id) === String(displayedUser.id));
    const options: ActionSheetOption[] = [
      isSelfProfile
        ? {
            title: 'Collaboration Hub & Inquiries',
            subtitle: 'Manage received and sent collaboration proposals',
            icon: 'briefcase-outline',
            iconColor: '#4F46E5',
            onPress: () => {
              navigation.navigate('Collaboration');
            },
          }
        : {
            title: 'Send Collaboration Inquiry',
            subtitle: `Propose a collaboration with ${targetName}`,
            icon: 'briefcase-outline',
            iconColor: '#4F46E5',
            onPress: () => {
              setCollabModalVisible(true);
            },
          },
      {
        title: 'Share Profile',
        subtitle: `Share ${targetName}'s profile link`,
        icon: 'share-social-outline',
        iconColor: '#059669',
        onPress: () => {
          Share.share({
            message: `Check out ${targetName}'s profile on Ekenox!`,
          });
        },
      },
      {
        title: 'Report User',
        subtitle: 'Flag inappropriate profile to safety team',
        icon: 'flag-outline',
        isDestructive: true,
        onPress: () => {
          Alert.alert('Report Submitted', 'Thank you. Our safety and moderation team will review this profile.');
        },
      },
      {
        title: 'Block User',
        subtitle: 'Block this user from contacting you',
        icon: 'ban-outline',
        isDestructive: true,
        onPress: () => {
          Alert.alert('User Blocked', `You have blocked ${targetName}.`);
        },
      },
    ];

    setActionSheetConfig({
      visible: true,
      title: 'Profile Options',
      subtitle: `Options for ${targetName}`,
      options,
    });
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const displayedUser = isMe ? currentUser : profileUser;
  const isSelf = isMe || Boolean(currentUser?.id && displayedUser?.id && String(currentUser.id) === String(displayedUser.id));

  if (!displayedUser && (loading || !isMe)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!displayedUser) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const formatCount = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(num);
  };

  const mediaPosts = userFeeds.filter(f => f.media && f.media.length > 0);

  // All media items across all posts for a flat grid
  const allMediaItems: { url: string; type: 'image' | 'video'; postIndex: number; mediaIndex: number; post: Feed }[] = [];
  mediaPosts.forEach((post, pi) => {
    (post.media || []).forEach((m: any, mi: number) => {
      allMediaItems.push({
        url: m.url || m.media_url || '',
        type: isVideoUrl(m.url || m.media_url || '') ? 'video' : 'image',
        postIndex: pi,
        mediaIndex: mi,
        post,
      });
    });
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* ── Header Bar ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isMe ? 'My Profile' : (displayedUser.fullName || displayedUser.pseudo || 'Profile')}</Text>
        {isMe ? (
          <TouchableOpacity style={styles.headerRightBtn} onPress={() => navigation.navigate('EditProfile')} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="settings-outline" size={22} color={AppColors.textDark} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerRightBtn} onPress={handleOpenProfileMenu} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="ellipsis-vertical" size={22} color={AppColors.textDark} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
      >
        {/* ── Profile Hero Section ── */}
        <View style={styles.heroSection}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {displayedUser.profileImage ? (
              <Image source={{ uri: resolveUrl(displayedUser.profileImage) }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>
                  {(displayedUser.fullName || displayedUser.email || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {(displayedUser.isVerified || displayedUser.is_verified || (displayedUser.level && displayedUser.level > 5)) && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="white" />
              </View>
            )}
          </View>

          {/* Name & handle */}
          <Text style={styles.profileName}>{displayedUser.fullName || displayedUser.full_name || 'Ekenox Member'}</Text>
          <Text style={styles.profilePseudo}>
            @{displayedUser.pseudo || (displayedUser.fullName || displayedUser.full_name || 'ekenox_member').toLowerCase().replace(/\s+/g, '_')}
          </Text>

          {/* Bio — real data only */}
          {(displayedUser.bio || displayedUser.description) ? (
            <Text style={styles.profileBio}>{displayedUser.bio || displayedUser.description}</Text>
          ) : null}

          {/* Level + Eco Points pills */}
          <View style={styles.levelTagRow}>
            {displayedUser.level ? (
              <View style={styles.levelPill}>
                <Ionicons name="leaf" size={12} color={AppColors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.levelPillText}>Level {displayedUser.level}</Text>
              </View>
            ) : null}
            {(displayedUser.points || displayedUser.eco_points) ? (
              <View style={styles.pointsPill}>
                <Ionicons name="star" size={12} color="#D97706" style={{ marginRight: 4 }} />
                <Text style={styles.pointsPillText}>{formatCount(displayedUser.points || displayedUser.eco_points)} pts</Text>
              </View>
            ) : null}
            {displayedUser.role && displayedUser.role !== 'ROLE_USER' ? (
              <View style={[styles.levelPill, { backgroundColor: '#FDE68A' }]}>
                <Text style={[styles.levelPillText, { color: '#92400E' }]}>{displayedUser.role.replace('ROLE_', '')}</Text>
              </View>
            ) : null}
          </View>

          {/* Stats row */}
          <View style={styles.statsCountRow}>
            <View style={styles.statCountItem}>
              <Text style={styles.statCountVal}>{formatCount(displayedUser.postsCount ?? userFeeds.length)}</Text>
              <Text style={styles.statCountLabel}>Posts</Text>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.statCountItem}>
              <Text style={styles.statCountVal}>{formatCount(displayedUser.followersCount ?? displayedUser.followers_count ?? displayedUser.followers ?? 0)}</Text>
              <Text style={styles.statCountLabel}>Followers</Text>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.statCountItem}>
              <Text style={styles.statCountVal}>{formatCount(displayedUser.followingCount ?? displayedUser.following_count ?? displayedUser.following ?? 0)}</Text>
              <Text style={styles.statCountLabel}>Following</Text>
            </View>
            {userStories.length > 0 && (
              <>
                <View style={styles.statSeparator} />
                <View style={styles.statCountItem}>
                  <Text style={styles.statCountVal}>{userStories.length}</Text>
                  <Text style={styles.statCountLabel}>Stories</Text>
                </View>
              </>
            )}
          </View>

          {/* Action buttons */}
          {isMe ? (
            <View style={styles.profileActionRow}>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.7}>
                <Ionicons name="create-outline" size={15} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnPrimaryText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => navigation.navigate('MyCarShares')} activeOpacity={0.7}>
                <Ionicons name="car-outline" size={15} color={AppColors.textDark} style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnSecondaryText}>Car Shares</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileActionRow}>
              <TouchableOpacity style={[styles.actionBtnPrimary, isFollowing && styles.followingBtn]} onPress={handleToggleFollow} activeOpacity={0.7} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator size="small" color={isFollowing ? AppColors.textMedium : 'white'} />
                ) : (
                  <>
                    <Ionicons name={isFollowing ? 'checkmark' : 'person-add-outline'} size={15} color={isFollowing ? AppColors.textMedium : 'white'} style={{ marginRight: 6 }} />
                    <Text style={[styles.actionBtnPrimaryText, isFollowing && { color: AppColors.textMedium }]}>{isFollowing ? 'Following' : 'Follow'}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleMessageUser} activeOpacity={0.7} disabled={actionLoading}>
                <Ionicons name="chatbubble-outline" size={15} color={AppColors.textDark} style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnSecondaryText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Admin Access Shield Button ── */}
        <AdminAccessButton />

        {/* ── Stories Highlights Row ── */}
        {(userStories.length > 0 || isMe) && (
          <View style={styles.highlightsSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsScroll}>
              {isMe && (
                <TouchableOpacity style={styles.highlightItem} onPress={() => navigation.navigate('CreateStory')}>
                  <View style={[styles.highlightCircle, styles.highlightNewCircle]}>
                    <Ionicons name="add" size={26} color={AppColors.primary} />
                  </View>
                  <Text style={styles.highlightTitle}>New Story</Text>
                </TouchableOpacity>
              )}
              {userStories.map((story) => {
                const thumb = resolveUrl(
                  story.thumbnail_url || story.thumbnailUrl ||
                  story.slides?.[0]?.media_url || story.slides?.[0]?.mediaUrl
                );
                return (
                  <TouchableOpacity
                    key={story.id}
                    style={styles.highlightItem}
                    onPress={() => openStory(story)}
                  >
                    <View style={styles.highlightCircle}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.highlightImage} />
                      ) : (
                        <View style={[styles.highlightImage, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="play" size={20} color={AppColors.primary} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.highlightTitle} numberOfLines={1}>{story.title || 'Story'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Inner Tabs Bar ── */}
        <View style={styles.innerTabsBar}>
          {(['feed', 'media', 'stories', 'contact'] as const).map(tab => {
            const isTabActive = activeTab === tab;
            const icons: Record<string, string> = { feed: 'grid-outline', media: 'images-outline', stories: 'play-circle-outline', contact: 'call-outline' };
            return (
              <TouchableOpacity key={tab} style={[styles.innerTabItem, isTabActive && styles.innerTabItemActive]} onPress={() => setActiveTab(tab)}>
                <Ionicons name={icons[tab] as any} size={16} color={isTabActive ? AppColors.primary : AppColors.textMedium} />
                <Text style={[styles.innerTabText, isTabActive && styles.innerTabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab Content ── */}
        <View style={styles.tabContentContainer}>

          {/* FEED TAB */}
          {activeTab === 'feed' && (
            <View style={styles.feedTabContainer}>
              {loadingFeeds && userFeeds.length === 0 ? (
                <ActivityIndicator size="small" color={AppColors.primary} style={{ marginVertical: 30 }} />
              ) : userFeeds.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubble-ellipses-outline" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No posts yet.</Text>
                </View>
              ) : (
                userFeeds.map(post => {
                  const hasMedia = post.media && post.media.length > 0;
                  const postMedia = (post.media || []) as any[];
                  return (
                    <View key={post.id} style={styles.postCard}>
                      {/* Post header */}
                      <View style={styles.postHeader}>
                        <TouchableOpacity
                          onPress={() => post.user?.id && navigation.navigate('Profile', { userId: post.user.id })}
                          activeOpacity={0.7}
                        >
                          {post.user?.profile_image || post.user?.avatar_url ? (
                            <Image source={{ uri: resolveUrl(post.user.profile_image || post.user.avatar_url) }} style={styles.postAvatar} />
                          ) : (
                            <View style={[styles.postAvatar, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                                {(post.user?.full_name || 'U')[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.postAuthorName}>{post.user?.full_name || displayedUser.fullName || 'Member'}</Text>
                          <Text style={styles.postDate}>{post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</Text>
                        </View>
                      </View>

                      {/* Post content */}
                      {!!post.content && <Text style={styles.postContent}>{post.content}</Text>}

                      {/* Media preview - click to open gallery */}
                      {hasMedia && postMedia.length > 0 && (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => openMediaGallery(post, 0)}
                          style={styles.postMediaWrapper}
                        >
                          <Image
                            source={{ uri: resolveUrl(postMedia[0].url || postMedia[0].media_url) }}
                            style={styles.postMediaImage}
                            resizeMode="cover"
                          />
                          {/* Video indicator */}
                          {isVideoUrl(postMedia[0].url || postMedia[0].media_url) && (
                            <View style={styles.videoIndicator}>
                              <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
                            </View>
                          )}
                          {/* Multiple media count badge */}
                          {postMedia.length > 1 && (
                            <View style={styles.mediaCountBadge}>
                              <Ionicons name="images" size={12} color="white" />
                              <Text style={styles.mediaCountText}>{postMedia.length}</Text>
                            </View>
                          )}
                          {/* Tap to view label */}
                          <View style={styles.tapToViewBanner}>
                            <Ionicons name={isVideoUrl(postMedia[0].url || postMedia[0].media_url) ? 'videocam' : 'expand'} size={13} color="white" style={{ marginRight: 4 }} />
                            <Text style={styles.tapToViewText}>{isVideoUrl(postMedia[0].url || postMedia[0].media_url) ? 'Tap to play video' : `View ${postMedia.length > 1 ? `${postMedia.length} photos` : 'full photo'}`}</Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* Stats / action row */}
                      <View style={styles.postStatsRow}>
                        <TouchableOpacity style={styles.postStat} onPress={() => handleLikePost(post)} activeOpacity={0.7}>
                          <Ionicons name={post.user_reacted ? 'heart' : 'heart-outline'} size={17} color={post.user_reacted ? '#EF4444' : AppColors.textMedium} />
                          <Text style={[styles.postStatText, post.user_reacted && { color: '#EF4444' }]}>{post.stats?.reactions ?? post.likes_count ?? 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.postStat} onPress={() => handleOpenComments(post)} activeOpacity={0.7}>
                          <Ionicons name="chatbubble-outline" size={17} color={AppColors.textMedium} />
                          <Text style={styles.postStatText}>{post.stats?.comments ?? post.comments_count ?? 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.postStat} onPress={() => Share.share({ message: `Check out this eco initiative on Ekenox from ${(post.user?.full_name || 'User')}.` })} activeOpacity={0.7}>
                          <Ionicons name="arrow-redo-outline" size={17} color={AppColors.textMedium} />
                          <Text style={styles.postStatText}>{post.stats?.shares ?? 0}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* MEDIA TAB */}
          {activeTab === 'media' && (
            <View style={styles.mediaTabContainer}>
              {loadingFeeds && allMediaItems.length === 0 ? (
                <ActivityIndicator size="small" color={AppColors.primary} style={{ marginVertical: 30 }} />
              ) : allMediaItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="image-outline" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No media uploaded yet.</Text>
                </View>
              ) : (
                <>
                  {/* Filter hint */}
                  <View style={styles.mediaFilterRow}>
                    <Ionicons name="information-circle-outline" size={14} color={AppColors.textLight} />
                    <Text style={styles.mediaFilterText}>Tap any item to view fullscreen · Swipe for more</Text>
                  </View>
                  <View style={styles.mediaGrid}>
                    {allMediaItems.map((item, flatIdx) => (
                      <TouchableOpacity
                        key={`${item.postIndex}-${item.mediaIndex}`}
                        style={styles.mediaGridItem}
                        onPress={() => {
                          const items = allMediaItems.map(m => ({ url: m.url, type: m.type }));
                          setMediaViewerItems(items);
                          setMediaViewerStartIndex(flatIdx);
                          setMediaViewerVisible(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri: resolveUrl(item.url) }} style={styles.mediaGridImage} resizeMode="cover" />
                        {item.type === 'video' && (
                          <View style={styles.gridVideoOverlay}>
                            <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* STORIES TAB */}
          {activeTab === 'stories' && (
            <View style={styles.storiesTabContainer}>
              {loadingStories && userStories.length === 0 ? (
                <ActivityIndicator size="small" color={AppColors.primary} style={{ marginVertical: 30 }} />
              ) : userStories.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="play-circle-outline" size={44} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No stories posted yet.</Text>
                  {isMe && (
                    <TouchableOpacity style={styles.createStoryBtn} onPress={() => navigation.navigate('CreateStory')}>
                      <Ionicons name="add-circle-outline" size={16} color="white" style={{ marginRight: 6 }} />
                      <Text style={styles.createStoryBtnText}>Create Your First Story</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                userStories.map(story => {
                  const thumb = resolveUrl(
                    story.thumbnail_url || story.thumbnailUrl ||
                    story.slides?.[0]?.media_url || story.slides?.[0]?.mediaUrl
                  );
                  const totalSlides = story.slides?.length || 1;
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={styles.storyListCard}
                      onPress={() => openStory(story)}
                      activeOpacity={0.8}
                    >
                      {/* Thumbnail */}
                      <View style={styles.storyListThumb}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.storyListThumbImg} resizeMode="cover" />
                        ) : (
                          <View style={[styles.storyListThumbImg, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="play" size={22} color={AppColors.primary} />
                          </View>
                        )}
                        <View style={styles.storySlideCount}>
                          <Text style={styles.storySlideCountText}>{totalSlides}</Text>
                        </View>
                      </View>

                      {/* Info */}
                      <View style={styles.storyListInfo}>
                        <Text style={styles.storyListTitle}>{story.title || 'Untitled Story'}</Text>
                        {story.description ? (
                          <Text style={styles.storyListDesc} numberOfLines={2}>{story.description}</Text>
                        ) : null}
                        <Text style={styles.storyListDate}>
                          {story.created_at ? new Date(story.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          {totalSlides > 1 ? ` · ${totalSlides} slides` : ''}
                        </Text>
                      </View>

                      {/* Chevron */}
                      <Ionicons name="play-circle" size={28} color={AppColors.primary} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* CONTACT TAB */}
          {activeTab === 'contact' && (
            <View style={styles.contactTabContainer}>
              {/* Email */}
              {displayedUser.email && (
                <TouchableOpacity style={styles.contactItemCard} onPress={() => Linking.openURL(`mailto:${displayedUser.email}`)} activeOpacity={0.7}>
                  <View style={[styles.contactIconBg, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="mail-outline" size={18} color="#0284C7" />
                  </View>
                  <View style={styles.contactCardTextBlock}>
                    <Text style={styles.contactCardLabel}>EMAIL</Text>
                    <Text style={styles.contactCardVal}>{displayedUser.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
                </TouchableOpacity>
              )}

              {/* Website */}
              {displayedUser.website ? (
                <TouchableOpacity style={styles.contactItemCard} onPress={() => Linking.openURL(displayedUser.website!.startsWith('http') ? displayedUser.website! : `https://${displayedUser.website}`)} activeOpacity={0.7}>
                  <View style={[styles.contactIconBg, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="globe-outline" size={18} color="#10B981" />
                  </View>
                  <View style={styles.contactCardTextBlock}>
                    <Text style={styles.contactCardLabel}>WEBSITE</Text>
                    <Text style={styles.contactCardVal}>{displayedUser.website}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
                </TouchableOpacity>
              ) : null}

              {/* Phone */}
              {displayedUser.phone ? (
                <TouchableOpacity style={styles.contactItemCard} onPress={() => Linking.openURL(`tel:${displayedUser.phone}`)} activeOpacity={0.7}>
                  <View style={[styles.contactIconBg, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="call-outline" size={18} color="#16A34A" />
                  </View>
                  <View style={styles.contactCardTextBlock}>
                    <Text style={styles.contactCardLabel}>PHONE</Text>
                    <Text style={styles.contactCardVal}>{displayedUser.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
                </TouchableOpacity>
              ) : null}

              {/* Location */}
              {(displayedUser.location || displayedUser.city || displayedUser.country) && (
                <View style={styles.contactItemCard}>
                  <View style={[styles.contactIconBg, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="location-outline" size={18} color="#D97706" />
                  </View>
                  <View style={styles.contactCardTextBlock}>
                    <Text style={styles.contactCardLabel}>BASED IN</Text>
                    <Text style={styles.contactCardVal}>{[displayedUser.city, displayedUser.location, displayedUser.country].filter(Boolean).join(', ')}</Text>
                  </View>
                </View>
              )}

              {/* Member since */}
              {(displayedUser.createdAt || displayedUser.created_at) && (
                <View style={styles.contactItemCard}>
                  <View style={[styles.contactIconBg, { backgroundColor: '#EDE9FE' }]}>
                    <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                  </View>
                  <View style={styles.contactCardTextBlock}>
                    <Text style={styles.contactCardLabel}>MEMBER SINCE</Text>
                    <Text style={styles.contactCardVal}>
                      {new Date(displayedUser.createdAt || displayedUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Social links if any */}
              {(displayedUser.linkedinUrl || displayedUser.linkedin) && (
                <TouchableOpacity style={styles.contactItemCard} onPress={() => Linking.openURL(displayedUser.linkedinUrl || displayedUser.linkedin)}>
                  <View style={[styles.contactIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                  </View>
                  <View style={styles.contactCardTextBlock}>
                    <Text style={styles.contactCardLabel}>LINKEDIN</Text>
                    <Text style={styles.contactCardVal}>{displayedUser.linkedinUrl || displayedUser.linkedin}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
                </TouchableOpacity>
              )}

              {/* Collaboration Inquiry & Hub */}
              {isSelf ? (
                <TouchableOpacity
                  style={[styles.inquiryBtn, { backgroundColor: '#4F46E5', marginBottom: 10 }]}
                  onPress={() => navigation.navigate('Collaboration')}
                >
                  <Ionicons name="briefcase-outline" size={18} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.inquiryBtnText}>Collaboration Inquiries & Hub</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.inquiryBtn}
                  onPress={() => setCollabModalVisible(true)}
                >
                  <Ionicons name="briefcase-outline" size={16} color="white" style={{ marginRight: 6 }} />
                  <Text style={styles.inquiryBtnText}>Send Collaboration Inquiry</Text>
                </TouchableOpacity>
              )}

              {/* Logout button (owner only) */}
              {isMe && (
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={16} color={AppColors.error} style={{ marginRight: 6 }} />
                  <Text style={styles.logoutBtnText}>Sign Out of Ekenox</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Loading overlay ── */}
      {loading && (
        <View style={styles.overlayLoading}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}

      {/* ── Media Gallery Viewer ── */}
      <MediaCarouselViewer
        visible={mediaViewerVisible}
        mediaItems={mediaViewerItems}
        startIndex={mediaViewerStartIndex}
        onClose={() => setMediaViewerVisible(false)}
      />

      {/* ── Story Viewer ── */}
      <ProfileStoryViewer
        visible={storyViewerVisible}
        story={selectedStory}
        onClose={() => { setStoryViewerVisible(false); setSelectedStory(null); }}
      />

      {/* ── Custom Action Sheet Modal ── */}
      <CustomActionSheetModal
        visible={actionSheetConfig.visible}
        title={actionSheetConfig.title}
        subtitle={actionSheetConfig.subtitle}
        options={actionSheetConfig.options}
        onClose={() => setActionSheetConfig(prev => ({ ...prev, visible: false }))}
        cancelButtonText="Back"
      />

      {/* ── Collaboration Inquiry Form Modal (for other users) ── */}
      {!isSelf && displayedUser && (
        <CollaborationInquiryModal
          visible={collabModalVisible}
          onClose={() => setCollabModalVisible(false)}
          targetUserId={Number(displayedUser.id)}
          targetUserName={displayedUser.fullName || displayedUser.pseudo || 'this user'}
          onSuccess={() => {
            setCollabModalVisible(false);
          }}
        />
      )}

      {/* ── Collaboration Inquiries List / Management Modal ── */}
      <CollaborationInquiriesListModal
        visible={inquiriesListModalVisible}
        onClose={() => setInquiriesListModalVisible(false)}
        onOpenChatWithUser={(targetId, targetName) => {
          setInquiriesListModalVisible(false);
          navigation.navigate('Messages');
        }}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: AppColors.textMedium, fontSize: 14 },

  // Header
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', height: 60,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    paddingHorizontal: 8,
  },
  headerBackBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerRightBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: AppColors.textDark, flex: 1, textAlign: 'center' },

  // Hero section
  heroSection: {
    backgroundColor: 'white', alignItems: 'center',
    paddingVertical: 28, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: AppColors.primary },
  avatarPlaceholder: { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 36, fontWeight: '800', color: 'white' },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: AppColors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'white',
  },

  profileName: { fontSize: 22, fontWeight: '800', color: AppColors.textDark, marginBottom: 4, textAlign: 'center' },
  profilePseudo: { fontSize: 14, color: AppColors.textMedium, marginBottom: 10, textAlign: 'center' },
  profileBio: { fontSize: 14, color: AppColors.textDark, textAlign: 'center', lineHeight: 20, marginBottom: 12, paddingHorizontal: 10 },

  levelTagRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
  levelPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  levelPillText: { fontSize: 12, fontWeight: '700', color: AppColors.primary },
  pointsPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFBEB', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  pointsPillText: { fontSize: 12, fontWeight: '700', color: '#D97706' },

  statsCountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 8,
    marginBottom: 18, width: '100%',
    borderWidth: 1, borderColor: '#EEF2FF',
  },
  statCountItem: { flex: 1, alignItems: 'center' },
  statCountVal: { fontSize: 20, fontWeight: '800', color: AppColors.textDark },
  statCountLabel: { fontSize: 11, color: AppColors.textMedium, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statSeparator: { width: 1, height: 36, backgroundColor: '#E5E7EB' },

  profileActionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  actionBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: AppColors.primary, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 16,
  },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: 'white' },
  actionBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9', borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: AppColors.textDark },
  followingBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },

  // Highlights row
  highlightsSection: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 16 },
  highlightsScroll: { paddingHorizontal: 16, gap: 16 },
  highlightItem: { alignItems: 'center', width: 68 },
  highlightCircle: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 2.5, borderColor: AppColors.primary,
    overflow: 'hidden', marginBottom: 6,
    padding: 2,
  },
  highlightNewCircle: {
    backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center',
    borderStyle: 'dashed',
  },
  highlightImage: { width: '100%', height: '100%', borderRadius: 28 },
  highlightTitle: { fontSize: 11, color: AppColors.textDark, textAlign: 'center', fontWeight: '600' },

  // Inner tabs
  innerTabsBar: {
    flexDirection: 'row', backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  innerTabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 4,
    paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  innerTabItemActive: { borderBottomColor: AppColors.primary },
  innerTabText: { fontSize: 11, color: AppColors.textMedium, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  innerTabTextActive: { color: AppColors.primary },

  // Tab Content
  tabContentContainer: { flex: 1 },

  // Feed tab
  feedTabContainer: { paddingTop: 12 },
  postCard: {
    backgroundColor: 'white', marginHorizontal: 12, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  postAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: AppColors.primaryLight },
  postAuthorName: { fontSize: 14, fontWeight: '700', color: AppColors.textDark },
  postDate: { fontSize: 11, color: AppColors.textLight, marginTop: 1 },
  postContent: { fontSize: 14, color: AppColors.textDark, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 10 },
  postMediaWrapper: { position: 'relative', marginHorizontal: 0 },
  postMediaImage: { width: '100%', height: 200 },
  videoIndicator: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  mediaCountBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  mediaCountText: { color: 'white', fontSize: 12, fontWeight: '700' },
  tapToViewBanner: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 7,
  },
  tapToViewText: { color: 'white', fontSize: 12, fontWeight: '600' },
  postStatsRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postStatText: { fontSize: 13, color: AppColors.textMedium, fontWeight: '600' },

  // Media tab
  mediaTabContainer: { paddingTop: 4 },
  mediaFilterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  mediaFilterText: { fontSize: 12, color: AppColors.textLight, fontStyle: 'italic' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 4 },
  mediaGridItem: {
    width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE,
    borderRadius: 8, overflow: 'hidden', position: 'relative',
  },
  mediaGridImage: { width: '100%', height: '100%' },
  gridVideoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // Stories tab
  storiesTabContainer: { paddingTop: 12, paddingHorizontal: 12 },
  storyListCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 14, padding: 12,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  storyListThumb: { position: 'relative', marginRight: 12 },
  storyListThumbImg: { width: 70, height: 70, borderRadius: 12, borderWidth: 2, borderColor: AppColors.primary },
  storySlideCount: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: AppColors.primary, borderRadius: 10,
    width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  storySlideCountText: { color: 'white', fontSize: 10, fontWeight: '800' },
  storyListInfo: { flex: 1 },
  storyListTitle: { fontSize: 15, fontWeight: '700', color: AppColors.textDark, marginBottom: 4 },
  storyListDesc: { fontSize: 13, color: AppColors.textMedium, lineHeight: 18, marginBottom: 4 },
  storyListDate: { fontSize: 11, color: AppColors.textLight },

  createStoryBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: AppColors.primary, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 16,
  },
  createStoryBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },

  // Contact tab
  contactTabContainer: { paddingHorizontal: 12, paddingTop: 12 },
  contactItemCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 14,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  contactIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  contactCardTextBlock: { flex: 1 },
  contactCardLabel: { fontSize: 10, fontWeight: '700', color: AppColors.textLight, letterSpacing: 0.8, marginBottom: 2 },
  contactCardVal: { fontSize: 14, color: AppColors.textDark, fontWeight: '500' },
  inquiryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: AppColors.primary, borderRadius: 12,
    paddingVertical: 14, marginTop: 8, marginBottom: 10,
  },
  inquiryBtnText: { fontSize: 14, fontWeight: '700', color: 'white' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA',
    paddingVertical: 14, marginBottom: 10,
  },
  logoutBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.error },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: AppColors.textMedium, textAlign: 'center' },

  // Loading overlay
  overlayLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
});
