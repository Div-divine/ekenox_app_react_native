import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener, useEvent } from 'expo';
import { UrlHelper } from '../utils/urlHelper';
import { CommentsScreen } from './CommentsScreen';
import { FeedPollWidget } from './FeedPollWidget';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  onToggleMute
}: {
  videoUrl: string;
  style: any;
  shouldPlay: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}) => {
  const player = useVideoPlayer(videoUrl, p => {
    p.loop = true;
    p.muted = isMuted;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing }) as any;
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: player.currentTime } as any) as any;
  const { muted: isVideoMuted } = useEvent(player, 'mutedChange', { muted: player.muted }) as any;
  const { volume: currentVolume } = useEvent(player, 'volumeChange', { volume: player.volume }) as any;

  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<any>(null);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, resetControlsTimeout]);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, player]);

  // Sync mute state from props
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setShowControls(true);
    resetControlsTimeout();
  };

  const stopVideo = () => {
    player.pause();
    (player as any).seekTo(0);
    setShowControls(true);
    resetControlsTimeout();
  };

  const seekBackward = () => {
    player.seekBy(-10);
    setShowControls(true);
    resetControlsTimeout();
  };

  const seekForward = () => {
    player.seekBy(10);
    setShowControls(true);
    resetControlsTimeout();
  };

  const increaseVolume = () => {
    const newVolume = Math.min(1.0, player.volume + 0.1);
    player.volume = newVolume;
    if (player.muted && newVolume > 0) {
      player.muted = false;
    }
    setShowControls(true);
    resetControlsTimeout();
  };

  const decreaseVolume = () => {
    const newVolume = Math.max(0.0, player.volume - 0.1);
    player.volume = newVolume;
    if (player.muted && newVolume > 0) {
      player.muted = false;
    }
    setShowControls(true);
    resetControlsTimeout();
  };

  const toggleLocalMute = () => {
    player.muted = !player.muted;
    setShowControls(true);
    resetControlsTimeout();
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const duration = player.duration || 0;
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  const handleProgressBarTouch = (e: any) => {
    if (progressBarWidth > 0 && duration > 0) {
      const clickX = e.nativeEvent.locationX;
      const percentage = clickX / progressBarWidth;
      (player as any).seekTo(percentage * duration);
    }
  };

  return (
    <View style={style}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Tap Overlay to show/hide controls */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
        style={StyleSheet.absoluteFill}
      />

      {/* Modern Controls Overlay */}
      {showControls && (
        <View style={styles.controlsContainer}>
          {/* Big Center Play/Pause Indicator */}
          <View style={styles.centerPlayContainer}>
            <TouchableOpacity onPress={togglePlay}>
              <Ionicons
                name={isPlaying ? "pause-circle" : "play-circle"}
                size={64}
                color="rgba(255,255,255,0.9)"
              />
            </TouchableOpacity>
          </View>

          {/* Bottom Controls Panel */}
          <View style={styles.controlsPanel}>
            {/* 1. Progress Bar */}
            <View
              style={styles.progressBarWrapper}
              onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
              onTouchStart={handleProgressBarTouch}
            >
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
                  ]}
                />
              </View>
            </View>

            {/* 2. Controls Buttons Row */}
            <View style={styles.controlsRow}>
              {/* Left group: Play/Pause, Stop */}
              <View style={styles.controlsGroup}>
                <TouchableOpacity style={styles.controlBtn} onPress={togglePlay}>
                  <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={stopVideo}>
                  <Ionicons name="square" size={16} color="white" />
                </TouchableOpacity>
              </View>

              {/* Center group: Seek -10s, Time, Seek +10s */}
              <View style={styles.controlsGroup}>
                <TouchableOpacity style={styles.controlBtn} onPress={seekBackward}>
                  <Ionicons name="play-back" size={18} color="white" />
                </TouchableOpacity>
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>
                <TouchableOpacity style={styles.controlBtn} onPress={seekForward}>
                  <Ionicons name="play-forward" size={18} color="white" />
                </TouchableOpacity>
              </View>

              {/* Right group: Volume Icon, Volume Down, Volume Up */}
              <View style={styles.controlsGroup}>
                <TouchableOpacity style={styles.controlBtn} onPress={toggleLocalMute}>
                  <Ionicons
                    name={isVideoMuted || currentVolume === 0 ? "volume-mute" : currentVolume < 0.5 ? "volume-low" : "volume-high"}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={decreaseVolume}>
                  <Ionicons name="remove" size={16} color="white" />
                </TouchableOpacity>
                <Text style={styles.volumePercentText}>
                  {isVideoMuted ? '0%' : `${Math.round(currentVolume * 100)}%`}
                </Text>
                <TouchableOpacity style={styles.controlBtn} onPress={increaseVolume}>
                  <Ionicons name="add" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};


export const FeedScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [currentTab, setCurrentTab] = useState(0); // 0 = Feed, 1 = Groups
  const [posts, setPosts] = useState<Feed[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Feed pagination state
  const [feedPage, setFeedPage] = useState(1);
  const [hasMoreFeeds, setHasMoreFeeds] = useState(true);
  const [loadingMoreFeeds, setLoadingMoreFeeds] = useState(false);

  // Background music player
  const bgMusicPlayer = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  // Dynamic Tip of the Day State
  const [dailyTip, setDailyTip] = useState<any>(null);

  // Auto-play and global mute states
  const postLayouts = useRef<{ [postId: string]: { y: number; height: number } }>({});
  const postsListY = useRef(0);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isFeedMuted, setIsFeedMuted] = useState(true);

  const loadMoreFeeds = async () => {
    if (loadingMoreFeeds || !hasMoreFeeds) return;
    setLoadingMoreFeeds(true);
    try {
      const nextPage = feedPage + 1;
      const newFeeds = await feedService.getFeeds(nextPage, 10);
      if (newFeeds && newFeeds.length > 0) {
        setPosts(prev => [...prev, ...newFeeds]);
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

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  // Group Explorer Tab State ('public' | 'user' | 'discover')
  const [groupActiveTab, setGroupActiveTab] = useState<'public' | 'user' | 'discover'>('public');

  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Comments Modal State
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | number | null>(null);
  const [commentsPostCount, setCommentsPostCount] = useState(0);

  // Unread Notification Count State
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Custom Edit Post Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Feed | null>(null);
  const [editingTextState, setEditingTextState] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const HEADER_HEIGHT = 60 + insets.top;
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
          setStories(prev => [...prev, ...list]);
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

      // 6. Fetch Unread Notifications Count
      const count = await feedService.getUnreadNotificationsCount();
      setUnreadNotifCount(count);

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
    } catch (err) {
      console.warn('Failed to load unread count:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

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
        if (post.id === postId) {
          const newIsLiked = !post.is_liked;
          return {
            ...post,
            is_liked: newIsLiked,
            likes_count: newIsLiked ? post.likes_count + 1 : Math.max(0, post.likes_count - 1),
          };
        }
        return post;
      })
    );

    const result = await feedService.toggleReaction(postId);
    if (result.success) {
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              is_liked: result.isLiked,
              likes_count: result.likesCount,
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
      { text: 'Spam or unwanted', reason: 'spam' },
      { text: 'Harassment or abuse', reason: 'harassment' },
      { text: 'Inappropriate content', reason: 'inappropriate' },
      { text: 'Illegal content', reason: 'illigal_content' },
      { text: 'Other reason', reason: 'other' },
    ];

    Alert.alert(
      'Report Post',
      'Select a reason for reporting this post:',
      reasons.map(r => ({
        text: r.text,
        onPress: async () => {
          const success = await feedService.reportFeed(postId, r.reason);
          if (success) {
            Alert.alert('Thank You', 'Post reported successfully. Our moderators will review it.');
          } else {
            Alert.alert('Error', 'Failed to submit report.');
          }
        },
      }))
    );
  };

  // Options Menu sheet triggers
  const handleOpenPostOptions = (post: Feed) => {
    const isMine = (post.user?.id && String(post.user.id) === String(user?.id)) || (post.author?.id && String(post.author.id) === String(user?.id));

    const options: any[] = [];
    if (isMine) {
      options.push({ text: 'Edit Post', onPress: () => handleEditPost(post) });
      options.push({ text: 'Delete Post', style: 'destructive', onPress: () => handleDeletePost(post.id) });
    } else {
      options.push({ text: 'Report Post', onPress: () => handleReportPost(post.id) });
    }
    options.push({ text: 'Copy Link', onPress: () => handleCopyLink(post.id) });
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Post Options', 'Select an action:', options);
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
    bgMusicPlayer.pause();
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



  // Advance to next slide when video plays to the end
  useEventListener(player, 'playToEnd', () => {
    handleNextSlide();
  });

  // Manage loading indicator state on player status changes
  useEventListener(player, 'statusChange', ({ status }) => {
    setStoryVideoLoading(status === 'loading');
  });

  // Sync the player source dynamically with the active slide mediaUrl
  useEffect(() => {
    if (!storyModalVisible || selectedStoryIndex === null || isStoryPaused) {
      player.pause();
      bgMusicPlayer.pause();
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
      bgMusicPlayer.replaceAsync(resolveMediaUrl(musicUrl)).then(() => {
        if (!isStoryPaused) bgMusicPlayer.play();
      });
      player.muted = true;
    } else {
      bgMusicPlayer.pause();
      player.muted = false;
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
        player.replaceAsync(mediaUrl).then(() => {
          if (!isStoryPaused) player.play();
        });
      }
    } else {
      player.pause();
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
    const userAvatar = user?.profileImage ? resolveMediaUrl(user.profileImage) : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    return (
      <TouchableOpacity
        style={styles.storyCard}
        onPress={() => navigation.navigate('CreateStory')}
        activeOpacity={0.85}
      >
        <Image source={{ uri: userAvatar }} style={[styles.storyCardBg, { height: '100%' }]} blurRadius={1} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        
        <View style={styles.storyCardOverlay}>
          <Ionicons name="add" size={14} color="white" />
        </View>

        <View style={styles.createStoryCardCenter}>
          <View style={styles.createStoryIconCircle}>
            <Ionicons name="camera" size={16} color="white" />
          </View>
          <Text style={styles.createStoryCardText}>
            Add Story
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Horizontal Story Cards matching Flutter design
  const renderStoryItem = ({ item, index }: { item: any; index: number }) => {
    const thumbnailUrl = item.thumbnail_url || item.thumbnailUrl || (item.slides?.[0]?.media_url || item.slides?.[0]?.mediaUrl);
    const userAvatar = item.user?.profile_image || item.user?.avatar_url || item.userAvatar || thumbnailUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    const username = item.user?.full_name || item.username || 'Champion';

    return (
      <TouchableOpacity style={styles.storyCard} onPress={() => handleOpenStories(index)} activeOpacity={0.85}>
        {thumbnailUrl ? (
          <Image source={{ uri: resolveMediaUrl(thumbnailUrl) }} style={[styles.storyCardBg, { height: '100%' }]} />
        ) : (
          <View style={[styles.storyCardBg, { height: '100%', backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="play" size={24} color={AppColors.primary} />
          </View>
        )}
        <View style={styles.storyCardOverlay}>
          <Ionicons name="play-outline" size={12} color="white" />
        </View>

        <View style={styles.storyCardUserInfo}>
          <Image source={{ uri: resolveMediaUrl(userAvatar) }} style={styles.storyCardAvatar} />
          <Text style={styles.storyCardName} numberOfLines={1}>
            {username}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPostCard = (post: Feed) => {
    const authorName = post.user?.full_name || post.author?.full_name || 'Anonymous';
    const authorImage = post.user?.profile_image || post.user?.avatar_url || post.author?.profile_image;
    const isLiked = post.is_liked || post.user_reacted;
    const reactions = post.stats?.reactions ?? post.likes_count ?? 0;
    const comments = post.stats?.comments ?? post.comments_count ?? 0;
    const hasMedia = post.media && post.media.length > 0;

    return (
      <View
        key={post.id}
        style={[styles.postCard, hasMedia ? { minHeight: CARD_HEIGHT } : null]}
        onLayout={event => {
          const { y, height } = event.nativeEvent.layout;
          postLayouts.current[post.id.toString()] = { y: y + postsListY.current, height };
        }}
      >
        {/* Author details */}
        <View style={[styles.postAuthorRow, { paddingHorizontal: 16 }]}>
          {authorImage ? (
            <Image source={{ uri: resolveMediaUrl(authorImage) }} style={styles.postAvatar} />
          ) : (
            <View style={[styles.postAvatar, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: AppColors.primary, fontWeight: 'bold', fontSize: 13 }}>
                {authorName.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.postAuthorDetails}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={styles.postAuthorName}>{authorName}</Text>
              {post.feed_group && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#CCFAF6',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 10,
                    marginLeft: 6,
                  }}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: post.feed_group.id })}
                >
                  <Ionicons name="people" size={10} color={AppColors.primary} style={{ marginRight: 3 }} />
                  <Text style={{ fontSize: 10, color: AppColors.primary, fontWeight: '600' }} numberOfLines={1}>
                    {post.feed_group.name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.postTime}>
              {new Date(post.created_at).toLocaleDateString()} {post.is_edited && '• Edited'}
            </Text>
          </View>
          <TouchableOpacity style={styles.postOptionBtn} onPress={() => handleOpenPostOptions(post)}>
            <Ionicons name="ellipsis-horizontal" size={20} color={AppColors.textMedium} />
          </TouchableOpacity>
        </View>

        {/* Content text */}
        <Text style={[styles.postContent, { paddingHorizontal: 16 }]} numberOfLines={hasMedia ? 3 : undefined}>
          {post.content}
        </Text>

        {/* Multi-images / Single image slidable swiper */}
        {hasMedia && post.media && post.media.length > 0 && (
          <View style={{ height: SCREEN_HEIGHT * 0.55, width: '100%', marginBottom: 12 }}>
            {post.media.length === 1 ? (
              post.media[0].type === 'video' || isVideoUrl(post.media[0].url) ? (
                <PostVideoPlayer
                  videoUrl={resolveMediaUrl(post.media[0].url)}
                  style={{ width: '100%', height: '100%' }}
                  shouldPlay={activePostId === post.id.toString()}
                  isMuted={isFeedMuted}
                  onToggleMute={() => setIsFeedMuted(!isFeedMuted)}
                />
              ) : (
                <Image source={{ uri: resolveMediaUrl(post.media[0].url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              )
            ) : (
              <View style={{ flex: 1, width: '100%', position: 'relative' }}>
                <FlatList
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  data={post.media}
                  keyExtractor={m => m.id.toString()}
                  renderItem={({ item }) => (
                    item.type === 'video' || isVideoUrl(item.url) ? (
                      <PostVideoPlayer
                        videoUrl={resolveMediaUrl(item.url)}
                        style={{ width: SCREEN_WIDTH, height: '100%' }}
                        shouldPlay={activePostId === post.id.toString()}
                        isMuted={isFeedMuted}
                        onToggleMute={() => setIsFeedMuted(!isFeedMuted)}
                      />
                    ) : (
                      <Image source={{ uri: resolveMediaUrl(item.url) }} style={{ width: SCREEN_WIDTH, height: '100%' }} resizeMode="cover" />
                    )
                  )}
                />
                <View style={styles.carouselIndicator}>
                  <Ionicons name="images" size={12} color="white" />
                  <Text style={styles.carouselIndicatorText}>Swipe to view ({post.media.length})</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Dynamic Poll Card rendering */}
        {post.post_type === 'poll' && (
          <View style={{ paddingHorizontal: 16 }}>
            <FeedPollWidget feed={post} onVoteSuccess={() => loadData(false)} />
          </View>
        )}

        {/* Buttons footer reactions */}
        <View style={[styles.postFooter, { paddingHorizontal: 16 }]}>
          <TouchableOpacity style={styles.postFooterBtn} onPress={() => handleLikePost(post.id)}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? AppColors.error : AppColors.textMedium}
            />
            <Text style={[styles.postFooterText, isLiked ? styles.likedText : null]}>
              {reactions}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postFooterBtn}
            onPress={() => {
              setCommentsPostId(post.id);
              setCommentsPostCount(comments);
              setCommentsModalVisible(true);
            }}
          >
            <Ionicons name="chatbubble-outline" size={19} color={AppColors.textMedium} />
            <Text style={styles.postFooterText}>{comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.postFooterBtn} onPress={() => handleSharePost(post.id)}>
            <Ionicons name="share-social-outline" size={19} color={AppColors.textMedium} />
          </TouchableOpacity>
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
        <TouchableOpacity style={styles.headerAvatarContainer} onPress={() => navigation.navigate('Profile')}>
          {user?.profileImage ? (
            <Image source={{ uri: resolveMediaUrl(user.profileImage) }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.headerSegmentedControl}>
          <TouchableOpacity
            style={[styles.headerSegmentBtn, currentTab === 0 && styles.headerSegmentBtnActive]}
            onPress={() => setCurrentTab(0)}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerSegmentText, currentTab === 0 && styles.headerSegmentTextActive]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerSegmentBtn, currentTab === 1 && styles.headerSegmentBtnActive]}
            onPress={() => setCurrentTab(1)}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerSegmentText, currentTab === 1 && styles.headerSegmentTextActive]}>Groups</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('Messages')}>
            <Ionicons name="chatbubbles-outline" size={22} color={AppColors.textDark} />
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
      </Animated.View>

      {/* Sticky Create Feed Bar Overlay */}
      {currentTab === 0 && !isLoading && (
        <Animated.View
          style={[
            styles.createBarContainer,
            {
              position: 'absolute',
              top: 60 + insets.top,
              left: 0,
              right: 0,
              zIndex: 99,
              opacity: absoluteBarOpacity,
              transform: [{ translateY: createBarTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.createBarContent}
            onPress={() => navigation.navigate('CreatePost')}
            activeOpacity={0.85}
          >
            {user?.profileImage ? (
              <Image source={{ uri: resolveMediaUrl(user.profileImage) }} style={styles.createBarAvatar} />
            ) : (
              <View style={styles.createBarAvatarPlaceholder}>
                <Text style={styles.createBarAvatarText}>
                  {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
                </Text>
              </View>
            )}
            <Text style={styles.createBarInputPlaceholder}>Share an eco action with the community…</Text>
            <View style={styles.createBarBtn}>
              <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
              <Text style={styles.createBarBtnText}>Create Feed</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}


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
            contentContainerStyle={{ paddingTop: 60 + insets.top }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} progressViewOffset={60 + insets.top} />
            }
          >
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

            {/* Top Create Feed Bar */}
            <View style={styles.createBarContainer}>
              <TouchableOpacity
                style={styles.createBarContent}
                onPress={() => navigation.navigate('CreatePost')}
                activeOpacity={0.85}
              >
                {user?.profileImage ? (
                  <Image source={{ uri: resolveMediaUrl(user.profileImage) }} style={styles.createBarAvatar} />
                ) : (
                  <View style={styles.createBarAvatarPlaceholder}>
                    <Text style={styles.createBarAvatarText}>
                      {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
                    </Text>
                  </View>
                )}
                <Text style={styles.createBarInputPlaceholder}>Share an eco action with the community…</Text>
                <View style={styles.createBarBtn}>
                  <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
                  <Text style={styles.createBarBtnText}>Create Feed</Text>
                </View>
              </TouchableOpacity>
            </View>

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
            contentContainerStyle={{ paddingTop: 60 + insets.top }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollY.setValue(event.nativeEvent.contentOffset.y);
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} progressViewOffset={60 + insets.top} />
            }
          >
            {/* Groups exploration header */}
            <View style={styles.groupsHeaderRow}>
              <Text style={styles.sectionTitle}>Explore Groups</Text>
              <Text style={styles.groupsSubtitle}>Connect with Ekenox eco champions around the world.</Text>

              {/* Top Create Group Bar */}
              <View style={[styles.createBarContainer, { paddingHorizontal: 0, marginTop: 12 }]}>
                <TouchableOpacity
                  style={styles.createBarContent}
                  onPress={() => navigation.navigate('CreateGroup')}
                  activeOpacity={0.85}
                >
                  <View style={[styles.createBarAvatarPlaceholder, { backgroundColor: '#CCFAF6' }]}>
                    <Ionicons name="people" size={18} color={AppColors.primary} />
                  </View>
                  <Text style={styles.createBarInputPlaceholder}>Build a new eco community group…</Text>
                  <View style={styles.createBarBtn}>
                    <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
                    <Text style={styles.createBarBtnText}>Create Group</Text>
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
              ) : (
                groups.map(group => {
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

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={styles.groupCardModernized}
                      activeOpacity={0.92}
                      onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                    >
                      {/* Floating Privacy Badge inside card at top-right */}
                      <View style={styles.groupPrivacyBadgeModernized}>
                        <Ionicons
                          name={group.privacy_level === 'private' ? 'lock-closed' : 'globe-outline'}
                          size={10}
                          color={group.privacy_level === 'private' ? '#EF4444' : AppColors.textMedium}
                        />
                        <Text style={[styles.groupPrivacyTextModernized, group.privacy_level === 'private' && { color: '#EF4444' }]}>
                          {group.privacy_level.toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.groupCardContentModernized}>
                        <View style={styles.groupCardMainRowModernized}>
                          {group.profile_image_url ? (
                            <Image source={{ uri: resolveMediaUrl(group.profile_image_url) }} style={styles.groupCardLogoModernized} />
                          ) : (
                            <View style={styles.groupCardLogoPlaceholderModernized}>
                              <Ionicons name="people" size={18} color={AppColors.primary} />
                            </View>
                          )}

                          <View style={styles.groupCardTitleBlockModernized}>
                            <Text style={styles.groupCardNameModernized} numberOfLines={1}>{group.name}</Text>
                            <Text style={styles.groupCardCategoryTextModernized}>Eco Group</Text>
                            {(group as any).tagline ? (
                              <Text style={styles.groupCardTaglineModernized} numberOfLines={1}>{(group as any).tagline}</Text>
                            ) : null}
                          </View>
                        </View>

                        {/* Member count & role/status row */}
                        <View style={styles.groupCardMetaInfoRowModernized}>
                          <View style={styles.groupCardMembersIndicatorModernized}>
                            <Ionicons name="people-outline" size={14} color={AppColors.textMedium} />
                            <Text style={styles.groupCardMembersIndicatorTextModernized}>
                              {group.members_count || 0} member{group.members_count > 1 ? 's' : ''}
                            </Text>
                          </View>

                          {group.user_membership && (
                            <View style={styles.groupCardRoleLabelPillModernized}>
                              <Text style={styles.groupCardRoleLabelPillTextModernized}>
                                {group.user_membership.role === 'admin' ? 'Admin' : group.user_membership.status === 'pending' ? 'Pending' : 'Member'}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Mutual Friends Avatar Tags Stack */}
                        {group.mutual_friends && group.mutual_friends.length > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {group.mutual_friends.map((friend: any, index: number) => {
                                const friendAvatar = resolveMediaUrl(friend.profile_image || friend.avatar_url);
                                return (
                                  <View
                                    key={friend.id || index}
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: 11,
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
                                      <Ionicons name="person" size={10} color="white" />
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                            <Text style={{ fontSize: 11, color: AppColors.textMedium, marginLeft: 6, fontWeight: '500' }}>
                              Joined by {group.mutual_friends[0]?.full_name || 'mutual friend'}
                              {group.mutual_friends_count > 1 ? ` +${group.mutual_friends_count - 1} more` : ''}
                            </Text>
                          </View>
                        )}

                        <Text style={styles.groupCardDescModernized} numberOfLines={2}>
                          {group.description || 'Join this eco community to coordinate actions, share resources, and offset carbon.'}
                        </Text>

                        <View style={styles.groupCardDividerModernized} />

                        {/* Action buttons */}
                        <View style={styles.groupCardActionButtonsRowModernized}>
                          <TouchableOpacity
                            style={styles.groupCardDetailsActionBtnModernized}
                            onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                          >
                            <Text style={styles.groupCardDetailsActionBtnTextModernized}>Details</Text>
                            <Ionicons name="chevron-forward" size={13} color={AppColors.primary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.groupCardJoinActionBtnModernized,
                              isJoined && styles.groupCardJoinActionBtnMemberModernized,
                              isPending && styles.groupCardJoinActionBtnPendingModernized
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
                                  size={14}
                                  color={isJoined ? AppColors.primary : isPending ? '#D97706' : 'white'}
                                />
                                <Text
                                  style={[
                                    styles.groupCardJoinActionBtnTextModernized,
                                    isJoined && styles.groupCardJoinActionBtnTextMemberModernized,
                                    isPending && styles.groupCardJoinActionBtnTextPendingModernized
                                  ]}
                                >
                                  {isJoined ? 'Joined' : isPending ? 'Pending' : 'Join'}
                                </Text>
                              </>
                            )}
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
                      if (muted) bgMusicPlayer.pause(); else bgMusicPlayer.play();
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
                          {stories[selectedStoryIndex]?.music_title ||stories[selectedStoryIndex]?.selected_music}
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
                      {['❤️','😂','😮','😢','😡','👏'].map(em => (
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
          <TouchableOpacity style={styles.overlayCloseArea} onPress={() => setShowProfilePanel(false)} />
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
              <TouchableOpacity style={styles.panelMenuItem} onPress={() => Alert.alert('My Impact', 'Carbon offset metrics & badges.')}>
                <Ionicons name="ribbon-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>My Impact Badges</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.panelMenuItem} onPress={() => Alert.alert('My Actions', 'Log of eco action initiatives.')}>
                <Ionicons name="checkmark-done-circle-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>Logged Eco Actions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.panelMenuItem} onPress={() => Alert.alert('Settings', 'App configurations & keys.')}>
                <Ionicons name="settings-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>Settings & Privacy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.panelLogoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={AppColors.error} />
              <Text style={styles.panelLogoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Comments modal sheet */}
      {commentsPostId !== null && (
        <CommentsScreen
          visible={commentsModalVisible}
          feedId={commentsPostId}
          commentsCount={commentsPostCount}
          onClose={() => setCommentsModalVisible(false)}
          onCommentAdded={() => {
            // Update comments stats locally
            setPosts(prev => prev.map(p => {
              if (p.id === commentsPostId) {
                const currentComments = p.stats?.comments ?? 0;
                return {
                  ...p,
                  comments_count: currentComments + 1,
                  stats: p.stats ? { ...p.stats, comments: currentComments + 1 } : { reactions: p.likes_count, comments: currentComments + 1, shares: 0, views: 0 }
                };
              }
              return p;
            }));
            setCommentsPostCount(prev => prev + 1);
          }}
        />
      )}

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    height: 60,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
  storyCard: {
    width: 115,
    height: 165,
    borderRadius: 16,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  storyCardBg: {
    width: '100%',
    height: 95,
  },
  storyCardOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  storyCardContent: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 70,
  },
  storyCardAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  storyCardName: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textDark,
    marginLeft: 6,
    flex: 1,
  },
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
  postCard: {
    backgroundColor: 'white',
    borderRadius: 0,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 16,
    borderWidth: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAuthorDetails: {
    marginLeft: 10,
    flex: 1,
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  postTime: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 1,
  },
  postOptionBtn: {
    padding: 4,
  },
  postContent: {
    fontSize: 14,
    color: AppColors.textDark,
    lineHeight: 20,
    marginBottom: 12,
  },
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
  // Modern Video Controls Styles
  controlsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  centerPlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
    paddingHorizontal: 12,
  },
  progressBarWrapper: {
    height: 12,
    justifyContent: 'center',
    width: '100%',
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: AppColors.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlBtn: {
    padding: 6,
  },
  timeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 75,
    textAlign: 'center',
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
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
    justifyContent: 'space-between',
  },
  postFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  postFooterText: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginLeft: 6,
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
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 16,
    position: 'relative',
  },
  groupPrivacyBadgeModernized: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    zIndex: 10,
  },
  groupPrivacyTextModernized: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  groupCardContentModernized: {
    padding: 16,
  },
  groupCardMainRowModernized: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupCardLogoModernized: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  groupCardLogoPlaceholderModernized: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: AppColors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: AppColors.primary + '25',
  },
  groupCardTitleBlockModernized: {
    flex: 1,
    marginLeft: 12,
  },
  groupCardNameModernized: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  groupCardCategoryTextModernized: {
    fontSize: 11,
    color: AppColors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  groupCardTaglineModernized: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
    fontStyle: 'italic',
  },
  groupCardMetaInfoRowModernized: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupCardMembersIndicatorModernized: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupCardMembersIndicatorTextModernized: {
    fontSize: 12,
    color: AppColors.textMedium,
    fontWeight: '500',
  },
  groupCardRoleLabelPillModernized: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  groupCardRoleLabelPillTextModernized: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  groupCardDescModernized: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 12,
  },
  groupCardDividerModernized: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
    marginBottom: 12,
  },
  groupCardActionButtonsRowModernized: {
    flexDirection: 'row',
    gap: 8,
  },
  groupCardDetailsActionBtnModernized: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AppColors.primary + '40',
    gap: 4,
  },
  groupCardDetailsActionBtnTextModernized: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  groupCardJoinActionBtnModernized: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.primary,
    gap: 5,
  },
  groupCardJoinActionBtnMemberModernized: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  groupCardJoinActionBtnPendingModernized: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  groupCardJoinActionBtnTextModernized: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  groupCardJoinActionBtnTextMemberModernized: {
    color: AppColors.primary,
  },
  groupCardJoinActionBtnTextPendingModernized: {
    color: '#D97706',
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
});
