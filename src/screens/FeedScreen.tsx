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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';
import feedService, { Feed, Group, Event } from '../services/feedService';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { UrlHelper } from '../utils/urlHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Cohesive Media URL Resolver leveraging the global UrlHelper utility
const resolveMediaUrl = (url?: string) => {
  return UrlHelper.convertPathToUrl(url);
};


export const FeedScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [currentTab, setCurrentTab] = useState(0); // 0 = Feed, 1 = Groups
  const [posts, setPosts] = useState<Feed[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Dynamic Tip of the Day State
  const [dailyTip, setDailyTip] = useState<any>(null);
  const [tipExpanded, setTipExpanded] = useState(false);
  const [showTip, setShowTip] = useState(true);

  // Stories State
  const [stories, setStories] = useState<any[]>([]);
  const [storyModalVisible, setStoryModalVisible] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [storyVideoLoading, setStoryVideoLoading] = useState(false);
  const storyTimer = useRef<any | null>(null);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  // Group Explorer Tab State ('public' | 'user' | 'discover')
  const [groupActiveTab, setGroupActiveTab] = useState<'public' | 'user' | 'discover'>('public');

  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Fetch all live data from Symphony backend
  const loadData = async () => {
    try {
      console.log('🔄 Fetching live data from Symfony backend...');

      // 1. Fetch Feeds
      const feedPosts = await feedService.getFeeds(1, 20);
      setPosts(feedPosts);

      // 2. Fetch Stories
      const storiesList = await feedService.getStoryList(1, 15);
      setStories(storiesList);

      // 3. Fetch Tips
      const tipData = await feedService.getDailyTipToday();
      setDailyTip(tipData);

      // 4. Fetch Featured Ongoing Events (using the dedicated /events/ongoing endpoint)
      const ongoingResult = await feedService.getOngoingEvents(5, 0);
      setEvents(ongoingResult.events);

      // 5. Fetch Groups based on current filter
      await fetchGroupsData(groupActiveTab);

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

  useEffect(() => {
    loadData();
  }, []);

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

  // Create post prompt
  const handleCreateCTA = () => {
    Alert.prompt(
      'New Post',
      'Share your eco initiative with Ekenox! 🌱',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Post',
          onPress: async (content?: string) => {
            if (!content || !content.trim()) return;
            const result = await feedService.createFeed(content.trim());
            if (result.success) {
              Alert.alert('Success', 'Posted successfully!');
              loadData();
            } else {
              Alert.alert('Error', result.message || 'Failed to post.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Copy shareable link to Clipboard
  const handleCopyLink = (postId: string | number) => {
    const link = `${ApiConfig.baseUrl}/feeds/${postId}`;
    Clipboard.setString(link);
    Alert.alert('Copied!', 'Link copied to clipboard successfully.');
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

  // Edit feed post
  const handleEditPost = (post: Feed) => {
    Alert.prompt(
      'Edit Post',
      'Update your eco action text:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async (newText?: string) => {
            if (!newText || !newText.trim()) return;
            const success = await feedService.updateFeed(post.id, newText.trim());
            if (success) {
              Alert.alert('Updated', 'Post updated successfully!');
              setPosts(prev => prev.map(p => p.id === post.id ? { ...p, content: newText.trim(), is_edited: true } : p));
            } else {
              Alert.alert('Error', 'Failed to update post.');
            }
          },
        },
      ],
      'plain-text',
      post.content
    );
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
    const isMine = post.user?.id === user?.id || post.author?.id === user?.id;

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
  };

  const closeStories = () => {
    if (storyTimer.current) clearTimeout(storyTimer.current);
    setStoryModalVisible(false);
    setSelectedStoryIndex(null);
    setCurrentSlideIndex(0);
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
    if (!storyModalVisible || selectedStoryIndex === null) {
      player.pause();
      return;
    }

    const activeStory = stories[selectedStoryIndex];
    if (!activeStory) return;

    const slides = activeStory.slides || [];
    const activeSlide = slides[currentSlideIndex];

    const isVideo = activeSlide
      ? activeSlide.media_type === 'video' || isVideoUrl(activeSlide.media_url || activeSlide.mediaUrl)
      : isVideoUrl(activeStory.video_url || activeStory.videoUrl);

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
          player.play();
        });
      }
    } else {
      player.pause();
    }
  }, [storyModalVisible, selectedStoryIndex, currentSlideIndex]);

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

  // Reactive Stories slideshow controller
  useEffect(() => {
    if (!storyModalVisible || selectedStoryIndex === null) {
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
  }, [storyModalVisible, selectedStoryIndex, currentSlideIndex]);



  // Render Horizontal Story Cards matching Flutter design
  const renderStoryItem = ({ item, index }: { item: any; index: number }) => {
    const userAvatar = item.user?.profile_image || item.user?.avatar_url || item.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    const thumbnailUrl = item.thumbnail_url || item.thumbnailUrl || (item.slides?.[0]?.media_url || item.slides?.[0]?.mediaUrl);
    const username = item.user?.full_name || item.username || 'Champion';

    return (
      <TouchableOpacity style={styles.storyCard} onPress={() => handleOpenStories(index)} activeOpacity={0.85}>
        {thumbnailUrl ? (
          <Image source={{ uri: resolveMediaUrl(thumbnailUrl) }} style={styles.storyCardBg} />
        ) : (
          <View style={[styles.storyCardBg, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="play-circle" size={40} color={AppColors.primary} />
          </View>
        )}
        <View style={styles.storyCardOverlay} />

        <View style={styles.storyCardAvatarRing}>
          <Image source={{ uri: resolveMediaUrl(userAvatar) }} style={styles.storyCardAvatar} />
        </View>

        <Text style={styles.storyCardName} numberOfLines={2}>
          {username}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render single post item
  const renderPostCard = (post: Feed) => {
    const authorName = post.user?.full_name || post.author?.full_name || 'Anonymous';
    const authorImage = post.user?.profile_image || post.user?.avatar_url || post.author?.profile_image;
    const isLiked = post.is_liked || post.user_reacted;
    const reactions = post.stats?.reactions ?? post.likes_count ?? 0;
    const comments = post.stats?.comments ?? post.comments_count ?? 0;

    return (
      <View key={post.id} style={styles.postCard}>
        {/* Author details */}
        <View style={styles.postAuthorRow}>
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
            <Text style={styles.postAuthorName}>{authorName}</Text>
            <Text style={styles.postTime}>
              {new Date(post.created_at).toLocaleDateString()} {post.is_edited && '• Edited'}
            </Text>
          </View>
          <TouchableOpacity style={styles.postOptionBtn} onPress={() => handleOpenPostOptions(post)}>
            <Ionicons name="ellipsis-horizontal" size={20} color={AppColors.textMedium} />
          </TouchableOpacity>
        </View>

        {/* Content text */}
        <Text style={styles.postContent}>{post.content}</Text>

        {/* Multi-images / Single image slidable swiper */}
        {post.media && post.media.length > 0 && (
          post.media.length === 1 ? (
            <Image source={{ uri: resolveMediaUrl(post.media[0].url) }} style={styles.postImage} />
          ) : (
            <View style={styles.carouselContainer}>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={post.media}
                keyExtractor={m => m.id.toString()}
                renderItem={({ item }) => (
                  <Image source={{ uri: resolveMediaUrl(item.url) }} style={styles.postCarouselImage} />
                )}
              />
              <View style={styles.carouselIndicator}>
                <Ionicons name="images" size={12} color="white" />
                <Text style={styles.carouselIndicatorText}>Swipe to view ({post.media.length})</Text>
              </View>
            </View>
          )
        )}

        {/* Dynamic Poll Card rendering */}
        {post.post_type === 'poll' && post.poll_options && (
          <View style={styles.pollCard}>
            <Text style={styles.pollTitle}>📊 Ekenox Poll</Text>

            {post.poll_options.map((option, idx) => {
              // Calculate votes statistics
              const results = post.poll_results || {};
              const votesCount = results[idx.toString()] ?? results[idx] ?? 0;

              // Sum all options
              const totalVotes = Object.values(results).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
              const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
              const hasVoted = post.user_votes && post.user_votes.includes(idx);

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.pollOptionBtn,
                    hasVoted ? styles.pollOptionVoted : null,
                  ]}
                  onPress={() => handleVotePoll(post.id, idx)}
                  disabled={!!(post.user_votes && post.user_votes.length > 0)}
                >
                  <View style={[styles.pollProgressFill, { width: `${percentage}%` }]} />
                  <View style={styles.pollOptionContent}>
                    <Text style={[styles.pollOptionText, hasVoted ? styles.pollOptionTextVoted : null]}>
                      {option}
                    </Text>
                    {post.user_votes && post.user_votes.length > 0 && (
                      <Text style={styles.pollPercentText}>{percentage}% ({votesCount})</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Buttons footer reactions */}
        <View style={styles.postFooter}>
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
            onPress={() => Alert.alert('Comments', 'Comments are available inside group or event details screens.')}
          >
            <Ionicons name="chatbubble-outline" size={19} color={AppColors.textMedium} />
            <Text style={styles.postFooterText}>{comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.postFooterBtn} onPress={() => handleCopyLink(post.id)}>
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
      <View style={[styles.header, { paddingTop: insets.top, height: 60 + insets.top }]}>
        <TouchableOpacity style={styles.headerAvatarContainer} onPress={() => setShowProfilePanel(true)}>
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

        <Text style={styles.headerTitle}>eKeNox</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => Alert.alert('Messages', 'Secure chat rooms are synced in Ekenox Chat.')}>
            <Ionicons name="chatbubbles-outline" size={22} color={AppColors.textDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => Alert.alert('Notifications', 'Notification logs synced in profile metrics.')}>
            <Ionicons name="notifications-outline" size={22} color={AppColors.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Main Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, currentTab === 0 ? styles.tabBtnActive : null]}
          onPress={() => setCurrentTab(0)}
        >
          <Text style={[styles.tabText, currentTab === 0 ? styles.tabTextActive : null]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, currentTab === 1 ? styles.tabBtnActive : null]}
          onPress={() => setCurrentTab(1)}
        >
          <Text style={[styles.tabText, currentTab === 1 ? styles.tabTextActive : null]}>Groups</Text>
        </TouchableOpacity>
      </View>

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
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />
            }
          >
            {/* Horizontal Stories list sequence */}
            {stories.length > 0 && (
              <View style={styles.storiesContainer}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={stories}
                  renderItem={renderStoryItem}
                  keyExtractor={item => item.id.toString()}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                />
              </View>
            )}

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
                          <View style={styles.eventInfoRow}>
                            <Ionicons name="calendar-outline" size={13} color={AppColors.textMedium} />
                            <Text style={styles.eventInfoText}>{formatEventDates(event.startTime, event.endTime)}</Text>
                          </View>
                          <View style={styles.eventInfoRow}>
                            <Ionicons name="location-outline" size={13} color={AppColors.textMedium} />
                            <Text style={styles.eventInfoText} numberOfLines={1}>{event.location}</Text>
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

            {/* Posts Cards list */}
            <View style={styles.postsList}>
              {posts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="leaf-outline" size={48} color={AppColors.textLight} />
                  <Text style={styles.emptyText}>No live posts yet. Share your first eco action!</Text>
                </View>
              ) : (
                posts.map(post => renderPostCard(post))
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        ) : (
          /* Groups tab explorer with Public, My Groups, Discover pills */
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />
            }
          >
            {/* Groups exploration header */}
            <View style={styles.groupsHeaderRow}>
              <Text style={styles.sectionTitle}>Explore Groups</Text>
              <Text style={styles.groupsSubtitle}>Connect with Ekenox eco champions around the world.</Text>
            </View>

            {/* Pill-filters Tab switcher */}
            <View style={styles.pillsRow}>
              <TouchableOpacity
                style={[styles.pillBtn, groupActiveTab === 'public' ? styles.pillBtnActive : null]}
                onPress={() => setGroupActiveTab('public')}
              >
                <Text style={[styles.pillText, groupActiveTab === 'public' ? styles.pillTextActive : null]}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, groupActiveTab === 'user' ? styles.pillBtnActive : null]}
                onPress={() => setGroupActiveTab('user')}
              >
                <Text style={[styles.pillText, groupActiveTab === 'user' ? styles.pillTextActive : null]}>My Groups</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, groupActiveTab === 'discover' ? styles.pillBtnActive : null]}
                onPress={() => setGroupActiveTab('discover')}
              >
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

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={styles.groupCard}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                    >
                      <View style={styles.groupHeader}>
                        <View style={styles.groupIconContainer}>
                          <Ionicons name="people" size={24} color={AppColors.primary} />
                        </View>
                        <View style={styles.groupDetails}>
                          <Text style={styles.groupName}>{group.name}</Text>
                          <Text style={styles.groupMeta}>
                            {group.privacy_level.toUpperCase()} • {group.members_count} members
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.groupDesc} numberOfLines={2}>{group.description}</Text>

                      <TouchableOpacity
                        style={[
                          styles.groupActionBtn,
                          isJoined ? styles.groupActionBtnJoined : null,
                        ]}
                        onPress={() => handleToggleGroupJoin(group)}
                        disabled={isActionLoading || isPending}
                      >
                        {isActionLoading ? (
                          <ActivityIndicator color={isJoined ? AppColors.textDark : 'white'} size="small" />
                        ) : (
                          <Text
                            style={[
                              styles.groupActionText,
                              isJoined ? styles.groupActionTextJoined : null,
                            ]}
                          >
                            {isJoined ? 'Joined' : isPending ? 'Pending' : 'Join Group'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )
      )}

      {/* Floating Action Button for post creation */}
      <TouchableOpacity style={styles.fab} onPress={handleCreateCTA}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* Stories Slideshow Fullscreen Modal Viewer */}
      {storyModalVisible && selectedStoryIndex !== null && stories[selectedStoryIndex] && (
        <Modal
          visible={storyModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={closeStories}
        >
          <SafeAreaView style={styles.storyViewerContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

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
                        contentFit="contain"
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
                      resizeMode="contain"
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
            <View style={styles.storyProgressContainer}>
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

            {/* Story Viewer Header: User details & Close Button */}
            <View style={styles.storyViewerHeader}>
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
              <Text style={styles.storyViewerName}>
                {stories[selectedStoryIndex]?.username || stories[selectedStoryIndex]?.user?.full_name || 'Champion'}
              </Text>
              <TouchableOpacity style={styles.storyViewerCloseBtn} onPress={closeStories}>
                <Ionicons name="close" size={26} color="white" />
              </TouchableOpacity>
            </View>

            {/* Slide title / description caption at the bottom */}
            <View style={styles.storyViewerFooter}>
              <Text style={styles.storyViewerTitle}>
                {stories[selectedStoryIndex]?.slides?.[currentSlideIndex]?.alt_text ||
                  stories[selectedStoryIndex]?.slides?.[currentSlideIndex]?.altText ||
                  stories[selectedStoryIndex]?.title || 'Shared an Eco Initiative'}
              </Text>
            </View>
          </SafeAreaView>
        </Modal>
      )}

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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: AppColors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  tabTextActive: {
    color: AppColors.primary,
    fontWeight: 'bold',
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
    width: 110,
    height: 170,
    borderRadius: 14,
    marginRight: 12,
    overflow: 'hidden',
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  storyCardBg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  storyCardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  storyCardAvatarRing: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AppColors.primary,
    padding: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyCardAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  storyCardName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    paddingHorizontal: 16,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
    elevation: 1,
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
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
  },
  carouselContainer: {
    position: 'relative',
    height: 180,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  postCarouselImage: {
    width: SCREEN_WIDTH - 66, // matching post padding
    height: 180,
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
  },
  carouselIndicatorText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
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
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupDetails: {
    marginLeft: 12,
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  groupMeta: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  groupDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 14,
  },
  groupActionBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  groupActionBtnJoined: {
    backgroundColor: '#F3F4F6',
  },
  groupActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  groupActionTextJoined: {
    color: AppColors.textDark,
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

  // Stories Fullscreen Slideshow styles
  storyViewerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  storyViewerImageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  storyViewerImage: {
    width: '100%',
    height: '100%',
  },
  storyViewerGestureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  storyProgressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    height: 3,
  },
  storyProgressBar: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  storyViewerHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  storyViewerCloseBtn: {
    padding: 4,
  },
  storyViewerFooter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 24,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  storyViewerTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
