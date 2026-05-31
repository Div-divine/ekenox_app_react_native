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
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Platform,
  Clipboard,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';
import feedService, { Feed, Group, Event } from '../services/feedService';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { UrlHelper } from '../utils/urlHelper';

// Cohesive Media URL Resolver leveraging the global UrlHelper utility
const resolveMediaUrl = (url?: string) => {
  return UrlHelper.convertPathToUrl(url);
};


interface GroupDetailScreenProps {
  route: any;
  navigation: any;
}

export const GroupDetailScreen = ({ route, navigation }: GroupDetailScreenProps) => {
  const { groupId } = route.params;
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [groupFeeds, setGroupFeeds] = useState<Feed[]>([]);
  const [groupEvents, setGroupEvents] = useState<Event[]>([]);
  
  const [activeSubTab, setActiveSubTab] = useState(0); // 0=Posts 1=Events 2=Members
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [eventActionLoadingId, setEventActionLoadingId] = useState<string | number | null>(null);

  // Members tab state
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);

  // Invite modal state
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadGroupDetails = async () => {
    try {
      console.log(`🔄 Fetching group details for ID: ${groupId}`);
      const data = await feedService.getGroupDetails(groupId);
      if (data) {
        setGroup(data.group);
        setStats(data.stats);
      }

      // Fetch group feed posts
      const posts = await feedService.getFeeds(1, 20, groupId);
      setGroupFeeds(posts);

      // Fetch group events
      const eventsList = await feedService.getGroupEvents(groupId);
      setGroupEvents(eventsList);

    } catch (error) {
      console.error('❌ Failed to fetch group detail data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadGroupMembers = async () => {
    if (membersLoading) return;
    setMembersLoading(true);
    try {
      const data = await feedService.getGroupMembers(groupId, 1, 50);
      setGroupMembers(data?.members || []);
      setMembersLoaded(true);
    } catch (e) {
      console.error('❌ Failed to load group members:', e);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    loadGroupDetails();
  }, [groupId]);

  // Lazy-load members when that tab is first opened
  useEffect(() => {
    if (activeSubTab === 2 && !membersLoaded) {
      loadGroupMembers();
    }
  }, [activeSubTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setMembersLoaded(false);
    loadGroupDetails();
  }, [groupId]);

  // Debounced user search for invite modal
  const handleInviteSearch = (text: string) => {
    setInviteQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 2) { setInviteResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setInviteSearching(true);
      const users = await feedService.searchUsers(text.trim(), 15);
      setInviteResults(users);
      setInviteSearching(false);
    }, 400);
  };

  const handleSendInvite = async (targetUser: any) => {
    if (invitingId) return;
    setInvitingId(targetUser.id);
    try {
      const res = await feedService.inviteUserToGroup(groupId, targetUser.id);
      if (res?.success) {
        Alert.alert('✅ Invited', res.message || `${targetUser.full_name} was added to the group.`);
        setInviteResults(prev => prev.filter(u => u.id !== targetUser.id));
        loadGroupMembers();
      } else {
        Alert.alert('Error', res?.error || 'Could not invite user.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Invite failed.');
    } finally {
      setInvitingId(null);
    }
  };

  // Toggle group membership state
  const handleToggleJoin = async () => {
    if (!group) return;
    setIsActionLoading(true);

    const isJoined = group.user_membership && group.user_membership.status === 'active';
    try {
      if (isJoined) {
        const result = await feedService.leaveGroup(group.id);
        if (result.success) {
          Alert.alert('Left Group', `You have left "${group.name}".`);
          loadGroupDetails();
        } else {
          Alert.alert('Error', result.message || 'Failed to leave group.');
        }
      } else {
        const result = await feedService.joinGroup(group.id);
        if (result.success) {
          if (result.data?.status === 'pending') {
            Alert.alert('Request Sent', 'Join request sent successfully.');
          } else {
            Alert.alert('Success', `You joined "${group.name}"!`);
          }
          loadGroupDetails();
        } else {
          Alert.alert('Error', result.message || 'Failed to join group.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Toggle reaction (like) on a post
  const handleLikePost = async (postId: string | number) => {
    setGroupFeeds(prevPosts =>
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
      setGroupFeeds(prevPosts =>
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
            setGroupFeeds(prev => prev.filter(p => p.id !== postId));
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
              setGroupFeeds(prev => prev.map(p => p.id === post.id ? { ...p, content: newText.trim(), is_edited: true } : p));
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
      setGroupFeeds(prev =>
        prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              poll_results: result.pollResults,
              user_votes: [optionIndex],
            };
          }
          return post;
        })
      );
    } else {
      Alert.alert('Failed', result.message || 'Failed to submit vote.');
    }
  };

  // Toggle user event registration state
  const handleToggleRegistration = async (event: Event) => {
    const eventId = event.id;
    const isRegistered = event.isRegistered;
    
    setEventActionLoadingId(eventId);

    try {
      if (isRegistered) {
        const result = await feedService.unregisterFromEvent(eventId);
        if (result.success) {
          Alert.alert('Success', `You un-registered from "${event.title}".`);
          setGroupEvents(prev => prev.map(e => e.id === eventId ? { ...e, isRegistered: false, attendeesCount: Math.max(0, (e.attendeesCount || 1) - 1) } : e));
        } else {
          Alert.alert('Error', result.message || 'Failed to unregister.');
        }
      } else {
        const result = await feedService.registerForEvent(eventId);
        if (result.success) {
          Alert.alert('Registered', `Successfully registered for "${event.title}"!`);
          setGroupEvents(prev => prev.map(e => e.id === eventId ? { ...e, isRegistered: true, attendeesCount: (e.attendeesCount || 0) + 1 } : e));
        } else {
          Alert.alert('Error', result.message || 'Failed to register.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setEventActionLoadingId(null);
    }
  };

  // Compute status badge tag for events
  const getEventTag = (event: Event) => {
    const now = new Date().getTime();
    const start = new Date(event.startTime).getTime();
    const end = new Date(event.endTime).getTime();

    if (now >= start && now <= end) {
      return { label: 'Ongoing', color: '#10B981', bg: '#D1FAE5', icon: 'play-circle' };
    } else if (now < start) {
      return { label: 'Upcoming', color: '#0D9488', bg: '#CCFAF6', icon: 'calendar' };
    } else {
      return { label: 'Past', color: '#6B7280', bg: '#F3F4F6', icon: 'checkmark-done-circle' };
    }
  };

  const formatEventDateRange = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    return `${start.toLocaleDateString('en-US', dateOptions)} • ${start.toLocaleTimeString([], timeOptions)} - ${end.toLocaleTimeString([], timeOptions)}`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={AppColors.primary} size="large" />
        <Text style={styles.loadingText}>Loading group detail...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={AppColors.error} />
          <Text style={styles.errorText}>Group details not found or deleted.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isJoined = group.user_membership && group.user_membership.status === 'active';
  const canInvite = !!(group.user_membership?.can_invite);

  // Render Post Item cleanly
  const renderPostItem = (post: Feed) => {
    const authorName = post.user?.full_name || post.author?.full_name || 'Anonymous';
    const authorImage = post.user?.profile_image || post.user?.avatar_url || post.author?.profile_image;
    const isLiked = post.is_liked || post.user_reacted;
    const reactions = post.stats?.reactions ?? post.likes_count ?? 0;
    const comments = post.stats?.comments ?? post.comments_count ?? 0;

    return (
      <View key={post.id} style={styles.postCard}>
        {/* Author Details */}
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

        {/* Content */}
        <Text style={styles.postContent}>{post.content}</Text>

        {/* Multi-images / Single image swiper */}
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

        {/* Poll Card */}
        {post.post_type === 'poll' && post.poll_options && (
          <View style={styles.pollCard}>
            <Text style={styles.pollTitle}>📊 Ekenox Poll</Text>
            {post.poll_options.map((option, idx) => {
              const results = post.poll_results || {};
              const votesCount = results[idx.toString()] ?? results[idx] ?? 0;
              const totalVotes = Object.values(results).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
              const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
              const hasVoted = post.user_votes && post.user_votes.includes(idx);

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.pollOptionBtn, hasVoted ? styles.pollOptionVoted : null]}
                  onPress={() => handleVotePoll(post.id, idx)}
                  disabled={!!(post.user_votes && post.user_votes.length > 0)}
                >
                  <View style={[styles.pollProgressFill, { width: `${percentage}%` }]} />
                  <View style={styles.pollOptionContent}>
                    <Text style={[styles.pollOptionText, hasVoted ? styles.pollOptionTextVoted : null]}>{option}</Text>
                    {post.user_votes && post.user_votes.length > 0 && (
                      <Text style={styles.pollPercentText}>{percentage}% ({votesCount})</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Post actions footer */}
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

          <TouchableOpacity style={styles.postFooterBtn} onPress={() => Alert.alert('Comments', 'Comments are in read-only mode.')}>
            <Ionicons name="chatbubble-outline" size={19} color={AppColors.textMedium} />
            <Text style={styles.postFooterText}>{comments}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />
        }
      >
        {/* Cover Banner */}
        <View style={styles.bannerContainer}>
          <Image source={{ uri: resolveMediaUrl(group.cover_image_url) }} style={styles.bannerImage} />
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Group Info Summary */}
        <View style={styles.detailsHeader}>
          <View style={styles.avatarRow}>
            {group.profile_image_url ? (
              <Image source={{ uri: resolveMediaUrl(group.profile_image_url) }} style={styles.groupAvatar} />
            ) : (
              <View style={styles.groupAvatarPlaceholder}>
                <Ionicons name="people" size={32} color={AppColors.primary} />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.joinActionBtn,
                isJoined ? styles.joinActionBtnJoined : null,
              ]}
              onPress={handleToggleJoin}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator color={isJoined ? AppColors.textDark : 'white'} size="small" />
              ) : (
                <Text style={[styles.joinActionText, isJoined ? styles.joinActionTextJoined : null]}>
                  {isJoined ? 'Joined' : 'Join Group'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Invite button — only for members who can invite */}
          {isJoined && canInvite && (
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={() => { setInviteQuery(''); setInviteResults([]); setInviteVisible(true); }}
            >
              <Ionicons name="person-add" size={15} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.inviteBtnText}>Invite Friends</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {group.privacy_level.toUpperCase()} GROUP • {group.members_count} MEMBERS
          </Text>
          {group.creator && (
            <Text style={styles.groupCreator}>Organized by {group.creator.full_name}</Text>
          )}

          <Text style={styles.groupDescription}>{group.description}</Text>
        </View>

        {/* Sub tabs switcher */}
        <View style={styles.tabSelectorRow}>
          <TouchableOpacity
            style={[styles.subTabBtn, activeSubTab === 0 ? styles.subTabActive : null]}
            onPress={() => setActiveSubTab(0)}
          >
            <Text style={[styles.subTabText, activeSubTab === 0 ? styles.subTabTextActive : null]}>
              Posts ({groupFeeds.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTabBtn, activeSubTab === 1 ? styles.subTabActive : null]}
            onPress={() => setActiveSubTab(1)}
          >
            <Text style={[styles.subTabText, activeSubTab === 1 ? styles.subTabTextActive : null]}>
              Events ({groupEvents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTabBtn, activeSubTab === 2 ? styles.subTabActive : null]}
            onPress={() => setActiveSubTab(2)}
          >
            <Text style={[styles.subTabText, activeSubTab === 2 ? styles.subTabTextActive : null]}>
              Members
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sub tabs list rendering */}
        {activeSubTab === 0 ? (
          <View style={styles.tabContentArea}>
            {groupFeeds.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbox-ellipses-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.emptyText}>No posts shared in this group yet.</Text>
              </View>
            ) : (
              groupFeeds.map(post => renderPostItem(post))
            )}
          </View>
        ) : (
          <View style={styles.tabContentArea}>
            {groupEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.emptyText}>No events scheduled by this group.</Text>
              </View>
            ) : (
              groupEvents.map(event => {
                const status = getEventTag(event);
                const isRegistered = event.isRegistered;
                const isActionLoading = eventActionLoadingId === event.id;

                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.imageWrapper}>
                      <Image source={{ uri: resolveMediaUrl(event.banner_image || event.bannerImage) }} style={styles.eventCardImage} />
                      <View style={[styles.statusTag, { backgroundColor: status.bg }]}>
                        <Ionicons name={status.icon as any} size={12} color={status.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusTagText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>

                    <View style={styles.eventCardContent}>
                      <Text style={styles.eventCardTitle}>{event.title}</Text>
                      <Text style={styles.eventCardDesc} numberOfLines={2}>
                        {event.description || 'Join us for this group environmental action.'}
                      </Text>

                      <View style={styles.eventInfoRow}>
                        <Ionicons name="calendar-outline" size={14} color={AppColors.primary} />
                        <Text style={styles.eventInfoText}>
                          {formatEventDateRange(event.startTime, event.endTime)}
                        </Text>
                      </View>
                      <View style={styles.eventInfoRow}>
                        <Ionicons name="location-outline" size={14} color={AppColors.primary} />
                        <Text style={styles.eventInfoText} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </View>
                      <View style={styles.eventInfoRow}>
                        <Ionicons name="people-outline" size={14} color={AppColors.primary} />
                        <Text style={styles.eventInfoText}>
                          {event.attendeesCount ?? 0} Champion(s) attending
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.eventRegisterBtn,
                          isRegistered ? styles.eventUnregisterBtn : null,
                        ]}
                        onPress={() => handleToggleRegistration(event)}
                        disabled={isActionLoading}
                      >
                        {isActionLoading ? (
                          <ActivityIndicator color={isRegistered ? AppColors.textDark : 'white'} size="small" />
                        ) : (
                          <Text style={[styles.eventRegisterBtnText, isRegistered ? styles.eventUnregisterBtnText : null]}>
                            {isRegistered ? 'Unregister' : 'Register Now'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Members Tab ── */}
        {activeSubTab === 2 && (
          <View style={styles.tabContentArea}>
            {membersLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color={AppColors.primary} size="large" />
                <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading members…</Text>
              </View>
            ) : groupMembers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.emptyText}>No members to show.</Text>
              </View>
            ) : (
              groupMembers.map((m: any) => {
                const u = m.user;
                const isAdmin = m.role === 'ROLE_FEED_GROUP_ADMIN' || m.role === 'ROLE_FEED_GROUP_SUPER_ADMIN';
                const roleLabel = m.role === 'ROLE_FEED_GROUP_SUPER_ADMIN' ? 'Creator' : isAdmin ? 'Admin' : 'Member';
                const avatarUri = u?.profile_image || u?.avatar_url;

                return (
                  <View key={m.id} style={styles.memberCard}>
                    {avatarUri ? (
                      <Image source={{ uri: resolveMediaUrl(avatarUri) }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Text style={styles.memberAvatarInitials}>
                          {(u?.full_name || '?').substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{u?.full_name || 'Unknown'}</Text>
                      <View style={[styles.memberRoleBadge, isAdmin ? styles.memberRoleBadgeAdmin : null]}>
                        <Text style={[styles.memberRoleText, isAdmin ? styles.memberRoleTextAdmin : null]}>
                          {roleLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        style={styles.memberActionBtn}
                        onPress={() => Alert.alert('Coming Soon', 'Follow feature is coming soon!')}
                      >
                        <Ionicons name="person-add-outline" size={14} color={AppColors.primary} />
                        <Text style={styles.memberActionText}>Follow</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.memberActionBtn, { marginLeft: 6 }]}
                        onPress={() => Alert.alert('Coming Soon', 'Direct messages are coming soon!')}
                      >
                        <Ionicons name="chatbubble-outline" size={14} color={AppColors.textMedium} />
                        <Text style={[styles.memberActionText, { color: AppColors.textMedium }]}>Chat</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ──────── Invite Friends Modal ──────── */}
      <Modal
        visible={inviteVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInviteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Friends to Group</Text>
              <TouchableOpacity onPress={() => setInviteVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={styles.inviteSearchRow}>
              <Ionicons name="search" size={18} color={AppColors.textMedium} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.inviteSearchInput}
                placeholder="Search by name…"
                placeholderTextColor={AppColors.textLight}
                value={inviteQuery}
                onChangeText={handleInviteSearch}
                autoFocus
              />
              {inviteSearching && <ActivityIndicator size="small" color={AppColors.primary} />}
            </View>

            {/* Results */}
            <FlatList
              data={inviteResults}
              keyExtractor={u => u.id.toString()}
              ListEmptyComponent={
                inviteQuery.trim().length >= 2 && !inviteSearching ? (
                  <Text style={styles.inviteEmpty}>No users found for "{inviteQuery}"</Text>
                ) : inviteQuery.trim().length < 2 ? (
                  <Text style={styles.inviteEmpty}>Type at least 2 characters to search</Text>
                ) : null
              }
              renderItem={({ item }) => {
                const isInviting = invitingId === item.id;
                return (
                  <View style={styles.inviteUserRow}>
                    {item.profile_image ? (
                      <Image source={{ uri: resolveMediaUrl(item.profile_image) }} style={styles.inviteUserAvatar} />
                    ) : (
                      <View style={[styles.inviteUserAvatar, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: AppColors.primary, fontWeight: 'bold', fontSize: 12 }}>
                          {(item.full_name || '?').substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.inviteUserName}>{item.full_name}</Text>
                      {item.pseudo && <Text style={styles.inviteUserSub}>@{item.pseudo}</Text>}
                    </View>
                    <TouchableOpacity
                      style={[styles.inviteActionBtn, isInviting ? { opacity: 0.6 } : null]}
                      onPress={() => handleSendInvite(item)}
                      disabled={isInviting}
                    >
                      {isInviting
                        ? <ActivityIndicator size="small" color="white" />
                        : <Text style={styles.inviteActionBtnText}>Add</Text>
                      }
                    </TouchableOpacity>
                  </View>
                );
              }}
              style={{ maxHeight: 360 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: AppColors.textMedium,
    textAlign: 'center',
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  bannerContainer: {
    position: 'relative',
    height: 180,
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  headerBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 24,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 8,
    borderRadius: 20,
  },
  detailsHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -40,
    marginBottom: 14,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: '#FAFAFA',
  },
  groupAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinActionBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 110,
    alignItems: 'center',
  },
  joinActionBtnJoined: {
    backgroundColor: '#F3F4F6',
  },
  joinActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  joinActionTextJoined: {
    color: AppColors.textDark,
  },
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  groupMeta: {
    fontSize: 11,
    color: AppColors.textMedium,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  groupCreator: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: AppColors.textMedium,
    lineHeight: 20,
    marginTop: 12,
  },
  tabSelectorRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  subTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: AppColors.primary,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  subTabTextActive: {
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  tabContentArea: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 10,
    color: AppColors.textMedium,
    fontSize: 13,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postAuthorDetails: {
    marginLeft: 10,
    flex: 1,
  },
  postAuthorName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  postTime: {
    fontSize: 11,
    color: AppColors.textLight,
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
    width: SCREEN_WIDTH - 66,
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
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECECEC',
    marginBottom: 16,
  },
  imageWrapper: {
    position: 'relative',
    height: 140,
    width: '100%',
  },
  eventCardImage: {
    width: '100%',
    height: '100%',
  },
  statusTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  eventCardContent: {
    padding: 14,
  },
  eventCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  eventCardDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 12,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventInfoText: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginLeft: 6,
    flex: 1,
  },
  eventRegisterBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  eventUnregisterBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventRegisterBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  eventUnregisterBtnText: {
    color: AppColors.textDark,
  },

  // ── Invite button (shown on group detail header) ──
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  inviteBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // ── Member cards ──
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarInitials: {
    color: AppColors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  memberRoleBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  memberRoleBadgeAdmin: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  memberRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  memberRoleTextAdmin: {
    color: '#C2410C',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.primary + '44',
    backgroundColor: AppColors.primaryLight,
  },
  memberActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.primary,
    marginLeft: 3,
  },

  // ── Invite modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  inviteSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  inviteSearchInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textDark,
    padding: 0,
  },
  inviteEmpty: {
    textAlign: 'center',
    color: AppColors.textMedium,
    fontSize: 13,
    marginTop: 24,
    marginBottom: 12,
  },
  inviteUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  inviteUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECECEC',
  },
  inviteUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  inviteUserSub: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 1,
  },
  inviteActionBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
  },
  inviteActionBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
