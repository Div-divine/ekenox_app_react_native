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
import associationService from '../services/associationService';
import { FeedPollWidget } from './FeedPollWidget';
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
  const [inviteRole, setInviteRole] = useState<'ROLE_FEED_GROUP_MEMBER' | 'ROLE_FEED_GROUP_ADMIN'>('ROLE_FEED_GROUP_MEMBER');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Group Settings modal
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'private'>('public');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editAllowMemberPosts, setEditAllowMemberPosts] = useState(true);
  const [editRequirePostApproval, setEditRequirePostApproval] = useState(false);
  const [editAllowMemberInvites, setEditAllowMemberInvites] = useState(true);
  const [editRequireJoinApproval, setEditRequireJoinApproval] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);


  // Delegation states
  const [delegationVisible, setDelegationVisible] = useState(false);
  const [delegationEmail, setDelegationEmail] = useState('');
  const [sentDelegation, setSentDelegation] = useState<any | null>(null);
  const [receivedDelegation, setReceivedDelegation] = useState<any | null>(null);
  const [delegationLoading, setDelegationLoading] = useState(false);

  const loadDelegationStatus = async () => {
    try {
      const sentRes = await feedService.getSentGroupDelegations(groupId);
      if (sentRes.success) {
        setSentDelegation(sentRes.data);
      } else {
        setSentDelegation(null);
      }

      const receivedRes = await feedService.getReceivedGroupDelegations();
      if (receivedRes.success && receivedRes.data) {
        const matching = receivedRes.data.find((d: any) => String(d.group?.id) === String(groupId));
        setReceivedDelegation(matching || null);
      } else {
        setReceivedDelegation(null);
      }
    } catch (e) {
      console.warn('Failed to load group delegations:', e);
    }
  };

  const handleAcceptDelegation = async (delegationId: string | number) => {
    setDelegationLoading(true);
    try {
      const res = await feedService.acceptGroupDelegation(delegationId);
      if (res.success) {
        Alert.alert('Success', 'You have accepted the delegation request and are now the group owner.');
        loadGroupDetails();
        loadGroupMembers();
      } else {
        Alert.alert('Error', res.message || 'Failed to accept delegation.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setDelegationLoading(false);
    }
  };

  const handleRefuseDelegation = async (delegationId: string | number) => {
    setDelegationLoading(true);
    try {
      const res = await feedService.refuseGroupDelegation(delegationId);
      if (res.success) {
        Alert.alert('Refused', 'Delegation request declined.');
        loadGroupDetails();
      } else {
        Alert.alert('Error', res.message || 'Failed to refuse delegation.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setDelegationLoading(false);
    }
  };

  const handleCancelDelegation = async (delegationId: string | number) => {
    setDelegationLoading(true);
    try {
      const res = await feedService.cancelGroupDelegation(delegationId);
      if (res.success) {
        Alert.alert('Cancelled', 'Role delegation request cancelled.');
        loadGroupDetails();
      } else {
        Alert.alert('Error', res.message || 'Failed to cancel delegation.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setDelegationLoading(false);
    }
  };

  const handleSendDelegation = async (receiverUserId?: string | number, receiverEmail?: string) => {
    setDelegationLoading(true);
    try {
      const res = await feedService.delegateGroupRole(groupId, {
        receiver_id: receiverUserId,
        receiver_email: receiverEmail,
        role: 'ROLE_FEED_GROUP_SUPER_ADMIN'
      });
      if (res.success) {
        Alert.alert('Delegation Sent', 'Delegation request sent successfully.');
        setDelegationEmail('');
        setSentDelegation(res.data);
        setDelegationVisible(false);
        loadGroupDetails();
      } else {
        Alert.alert('Error', res.message || 'Failed to delegate role.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setDelegationLoading(false);
    }
  };

  const handleSetMemberRole = async (memberUserId: string | number, currentRole: string) => {
    const isCurrentlyAdmin = currentRole === 'ROLE_FEED_GROUP_ADMIN';
    const targetRole = isCurrentlyAdmin ? 'ROLE_FEED_GROUP_MEMBER' : 'ROLE_FEED_GROUP_ADMIN';
    const targetRoleLabel = isCurrentlyAdmin ? 'Member' : 'Admin';

    Alert.alert(
      'Update Member Role',
      `Are you sure you want to change this member's role to ${targetRoleLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            try {
              const res = await feedService.setGroupMemberRole(groupId, memberUserId, targetRole);
              if (res.success) {
                Alert.alert('Success', `Member role updated to ${targetRoleLabel}.`);
                loadGroupMembers();
              } else {
                Alert.alert('Error', res.message || 'Failed to update member role.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'An error occurred.');
            }
          }
        }
      ]
    );
  };

  const handleOpenMemberSettings = (member: any) => {
    const u = member.user;
    if (!u) return;

    const isCurrentlyAdmin = member.role === 'ROLE_FEED_GROUP_ADMIN';
    const roleLabel = isCurrentlyAdmin ? 'Demote to Member' : 'Promote to Admin';

    Alert.alert(
      `${u.full_name || 'Member'} Settings`,
      'Choose an action for this member:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: roleLabel,
          onPress: () => handleSetMemberRole(u.id, member.role)
        },
        {
          text: 'Delegate Ownership (Transfer Creator)',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delegate Ownership',
              `Are you sure you want to delegate ownership to ${u.full_name}? Once they accept, you will be demoted and deactivated.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delegate', onPress: () => handleSendDelegation(u.id) }
              ]
            );
          }
        }
      ]
    );
  };

  const handleFollowMember = async (member: any) => {
    const targetUserId = member.user?.id;
    if (!targetUserId) return;

    try {
      const isFollowing = member.user?.is_following;
      if (isFollowing) {
        await associationService.unfollowUser(targetUserId);
        Alert.alert('Success', `You have unfollowed ${member.user?.full_name || 'this user'}.`);
      } else {
        await associationService.followUser(targetUserId);
        Alert.alert('Success', `You are now following ${member.user?.full_name || 'this user'}.`);
      }

      setGroupMembers(prev =>
        prev.map(m => {
          if (m.user?.id === targetUserId) {
            return {
              ...m,
              user: {
                ...m.user,
                is_following: !isFollowing,
              },
            };
          }
          return m;
        })
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update follow status.');
    }
  };

  const loadGroupDetails = async () => {
    try {
      console.log(`🔄 Fetching group details for ID: ${groupId}`);
      const data = await feedService.getGroupDetails(groupId);
      if (data) {
        setGroup(data.group);
        setStats(data.stats);
      }

      // Fetch group feed posts
      const posts = await feedService.getFeeds(1, 10, groupId);
      setGroupFeeds(posts);

      // Fetch group events
      const eventsList = await feedService.getGroupEvents(groupId);
      setGroupEvents(eventsList);

      // Load delegations
      await loadDelegationStatus();

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
      const res = await feedService.inviteUserToGroup(groupId, targetUser.id, isSettingsManager ? inviteRole : undefined);
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

    const isJoined = group.user_membership && group.user_membership.status === 'active';

    if (isJoined) {
      // Check if creator
      if (group.user_membership?.role === 'ROLE_FEED_GROUP_SUPER_ADMIN') {
        Alert.alert(
          'Ownership Delegation Required',
          'As the group creator/super-admin, you cannot leave this group without delegating your role to another member first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delegate Role', onPress: () => setDelegationVisible(true) }
          ]
        );
        return;
      }
    }

    setIsActionLoading(true);
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
  const userRole = group.user_membership?.role;
  const isUserGroupAdmin = userRole === 'ROLE_FEED_GROUP_ADMIN' || userRole === 'ROLE_FEED_GROUP_SUPER_ADMIN' || group.creator?.id === user?.id;
  const canInvite = !!(group.user_membership?.can_invite) || isUserGroupAdmin;

  // Settings manager: active creator, or admin if creator is no longer active member
  const creatorId = group.creator?.id;
  const userIsCreator = String(user?.id) === String(creatorId);
  // If the creator is still an active member of the group, only creator has settings access.
  // If creator has left/been deactivated, the senior admin takes over.
  const isSettingsManager = isUserGroupAdmin &&
    (userIsCreator || userRole === 'ROLE_FEED_GROUP_SUPER_ADMIN' || !group.creator?.is_active_member);

  const openSettings = () => {
    setEditName(group.name || '');
    setEditDescription(group.description || '');
    setEditPrivacy((group.privacy_level as any) || 'public');
    setEditLocation(group.location || '');
    setEditWebsite(group.website || '');
    setEditRules(Array.isArray(group.rules) ? group.rules.join('\n') : (group.rules || ''));
    setEditAllowMemberPosts(group.allow_member_posts !== false);
    setEditRequirePostApproval(!!group.require_post_approval);
    setEditAllowMemberInvites(group.allow_member_invites !== false);
    setEditRequireJoinApproval(!!group.require_join_approval);
    setSettingsVisible(true);
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const rulesArray = editRules.trim()
        ? editRules.split('\n').map(r => r.trim()).filter(Boolean)
        : [];
      const result = await feedService.updateGroup(group.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        privacy_level: editPrivacy,
        location: editLocation.trim(),
        website: editWebsite.trim(),
        rules: rulesArray,
        allow_member_posts: editAllowMemberPosts,
        require_post_approval: editRequirePostApproval,
        allow_member_invites: editAllowMemberInvites,
        require_join_approval: editRequireJoinApproval,
      });
      if (result?.success) {
        Alert.alert('✅ Saved', 'Group settings updated successfully.');
        setSettingsVisible(false);
        loadGroupDetails();
      } else {
        Alert.alert('Error', result?.message || 'Failed to save settings.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setSettingsSaving(false);
    }
  };


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
        {post.post_type === 'poll' && (
          <FeedPollWidget feed={post} onVoteSuccess={() => loadGroupDetails()} />
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
          {isSettingsManager && (
            <TouchableOpacity
              style={styles.headerSettingsBtn}
              onPress={openSettings}
            >
              <Ionicons name="settings-outline" size={22} color="white" />
            </TouchableOpacity>
          )}
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

        {/* Received Delegation Banner */}
        {receivedDelegation && (
          <View style={[styles.delegationBanner, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="shield-checkmark" size={20} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.delegationBannerTitle}>Group Ownership Invitation</Text>
              <View style={{ marginLeft: 'auto', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>Pending</Text>
              </View>
            </View>

            <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: AppColors.textDark }}>From:</Text> {receivedDelegation.sender?.full_name || 'Group Admin'} ({receivedDelegation.sender?.email || 'N/A'})
              </Text>
              <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: AppColors.textDark }}>To:</Text> You ({currentUser?.email})
              </Text>
              <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: AppColors.textDark }}>Role:</Text> Group Owner (Super Admin)
              </Text>
              {receivedDelegation.created_at ? (
                <Text style={{ fontSize: 11, color: AppColors.textLight }}>
                  Sent on: {new Date(receivedDelegation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={[styles.delegationBtn, styles.delegationBtnAccept]}
                onPress={() => handleAcceptDelegation(receivedDelegation.id)}
                disabled={delegationLoading}
              >
                <Text style={styles.delegationBtnText}>Accept Ownership</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.delegationBtn, styles.delegationBtnRefuse]}
                onPress={() => handleRefuseDelegation(receivedDelegation.id)}
                disabled={delegationLoading}
              >
                <Text style={[styles.delegationBtnText, { color: AppColors.textMedium }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sent Delegation Banner */}
        {sentDelegation && (
          <View style={[styles.delegationBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="paper-plane" size={18} color="#2563EB" style={{ marginRight: 8 }} />
              <Text style={[styles.delegationBannerTitle, { color: '#1E3A8A' }]}>Pending Ownership Transfer</Text>
              <View style={{ marginLeft: 'auto', backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1E40AF' }}>Waiting Response</Text>
              </View>
            </View>

            <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: AppColors.textDark }}>Sent By:</Text> You ({currentUser?.full_name || currentUser?.email})
              </Text>
              <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: AppColors.textDark }}>Recipient:</Text> {sentDelegation.receiver?.full_name || sentDelegation.receiver_email} {sentDelegation.receiver?.email ? `(${sentDelegation.receiver.email})` : ''}
              </Text>
              <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: AppColors.textDark }}>Designated Role:</Text> Group Owner (Super Admin)
              </Text>
              {sentDelegation.created_at ? (
                <Text style={{ fontSize: 11, color: AppColors.textLight }}>
                  Initiated on: {new Date(sentDelegation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.delegationBtn, { backgroundColor: '#F87171', alignSelf: 'flex-end' }]}
              onPress={() => handleCancelDelegation(sentDelegation.id)}
              disabled={delegationLoading}
            >
              <Text style={styles.delegationBtnText}>Cancel Delegation</Text>
            </TouchableOpacity>
          </View>
        )}

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
        {activeSubTab === 0 && (
          <View style={styles.tabContentArea}>
            {/* Create Feed Button for Group Members */}
            {isJoined && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 12,
                  borderRadius: 12,
                  elevation: 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                }}
                onPress={() => navigation.navigate('CreatePost', {
                  groupId: group.id,
                  groupName: group.name,
                  group: group,
                  onSuccess: loadGroupDetails,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#CCFAF6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="create" size={18} color={AppColors.primary} />
                </View>
                <Text style={{ fontSize: 14, color: AppColors.textMedium, flex: 1, fontWeight: '500' }}>
                  Share an eco action with {group.name}…
                </Text>
                <View
                  style={{
                    backgroundColor: AppColors.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Create Feed</Text>
                </View>
              </TouchableOpacity>
            )}

            {groupFeeds.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbox-ellipses-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.emptyText}>No posts shared in this group yet.</Text>
              </View>
            ) : (
              groupFeeds.map(post => renderPostItem(post))
            )}
          </View>
        )}

        {activeSubTab === 1 && (
          <View style={[styles.tabContentArea, { flex: 1 }]}>
            {/* ── Create Event Bar for Group Admins ── */}
            {isUserGroupAdmin && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('CreateEvent', {
                  groupId: group.id,
                  groupName: group.name,
                  onSuccess: async () => {
                    const eventsList = await feedService.getGroupEvents(group.id);
                    setGroupEvents(eventsList);
                  }
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#CCFAF6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="calendar" size={18} color={AppColors.primary} />
                </View>
                <Text style={{ fontSize: 14, color: AppColors.textMedium, flex: 1, fontWeight: '500' }}>
                  Organize an eco event for {group.name}…
                </Text>
                <View
                  style={{
                    backgroundColor: AppColors.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Create Event</Text>
                </View>
              </TouchableOpacity>
            )}

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
                  <View key={event.id} style={styles.groupEventCard}>
                    {event.bannerImage || event.banner_image ? (
                      <Image
                        source={{ uri: resolveMediaUrl(event.bannerImage || event.banner_image) }}
                        style={styles.groupEventImage}
                      />
                    ) : (
                      <View style={[styles.groupEventImage, styles.eventPlaceholder]}>
                        <Ionicons name="calendar" size={36} color={AppColors.textLight} />
                      </View>
                    )}

                    <View style={[styles.groupEventStatusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.groupEventStatusText, { color: status.color }]}>{status.label}</Text>
                    </View>

                    <View style={styles.groupEventContent}>
                      <Text style={styles.groupEventTitle}>{event.title}</Text>
                      {event.description ? (
                        <Text style={styles.groupEventDesc} numberOfLines={2}>{event.description}</Text>
                      ) : null}

                      <View style={styles.groupEventMetaRow}>
                        <Ionicons name="calendar-outline" size={14} color={AppColors.textMedium} />
                        <Text style={styles.groupEventMetaText}>
                          {formatEventDate(event.startTime || event.start_time)}
                        </Text>
                      </View>

                      <View style={styles.groupEventMetaRow}>
                        <Ionicons name="location-outline" size={14} color={AppColors.textMedium} />
                        <Text style={styles.groupEventMetaText} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </View>

                      <View style={styles.groupEventFooterRow}>
                        <View style={styles.groupEventMetaRow}>
                          <Ionicons name="people-outline" size={14} color={AppColors.textMedium} />
                          <Text style={styles.groupEventMetaText}>
                            {event.registrationCount ?? event.registration_count ?? 0} attending
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.eventRegisterBtn, isRegistered ? styles.eventUnregisterBtn : null]}
                          onPress={() => handleToggleEventRegistration(event)}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.memberName}>{u?.full_name || 'Unknown'}</Text>
                        {group?.user_membership?.role === 'ROLE_FEED_GROUP_SUPER_ADMIN' && u?.id !== user?.id && (
                          <TouchableOpacity onPress={() => handleOpenMemberSettings(m)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="ellipsis-vertical" size={14} color={AppColors.textMedium} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={[styles.memberRoleBadge, isAdmin ? styles.memberRoleBadgeAdmin : null]}>
                        <Text style={[styles.memberRoleText, isAdmin ? styles.memberRoleTextAdmin : null]}>
                          {roleLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.memberActions}>
                      {u?.id !== user?.id ? (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.memberActionBtn,
                              u?.is_following ? { opacity: 0.6, borderColor: '#ccc' } : null
                            ]}
                            onPress={() => handleFollowMember(m)}
                            disabled={u?.is_following}
                          >
                            <Ionicons
                              name={u?.is_following ? "checkmark-circle" : "person-add-outline"}
                              size={14}
                              color={u?.is_following ? AppColors.textMedium : AppColors.primary}
                            />
                            <Text style={[styles.memberActionText, u?.is_following ? { color: AppColors.textMedium } : null]}>
                              {u?.is_following ? 'Following' : 'Follow'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.memberActionBtn, { marginLeft: 6 }]}
                            onPress={() => Alert.alert('Coming Soon', 'Direct messages are coming soon!')}
                          >
                            <Ionicons name="chatbubble-outline" size={14} color={AppColors.textMedium} />
                            <Text style={[styles.memberActionText, { color: AppColors.textMedium }]}>Chat</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={[styles.memberRoleBadge, { backgroundColor: '#EDE9FE' }]}>
                          <Text style={[styles.memberRoleText, { color: '#7C3AED', fontWeight: 'bold' }]}>You</Text>
                        </View>
                      )}
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

            {/* Role picker — only for settings managers */}
            {isSettingsManager && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: AppColors.textMedium, alignSelf: 'center', marginRight: 4 }}>Assign Role:</Text>
                <TouchableOpacity
                  style={[
                    styles.inviteRoleBtn,
                    inviteRole === 'ROLE_FEED_GROUP_MEMBER' && styles.inviteRoleBtnActive
                  ]}
                  onPress={() => setInviteRole('ROLE_FEED_GROUP_MEMBER')}
                >
                  <Text style={[styles.inviteRoleBtnText, inviteRole === 'ROLE_FEED_GROUP_MEMBER' && { color: 'white' }]}>Member</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.inviteRoleBtn,
                    inviteRole === 'ROLE_FEED_GROUP_ADMIN' && styles.inviteRoleBtnActive
                  ]}
                  onPress={() => setInviteRole('ROLE_FEED_GROUP_ADMIN')}
                >
                  <Text style={[styles.inviteRoleBtnText, inviteRole === 'ROLE_FEED_GROUP_ADMIN' && { color: 'white' }]}>Admin</Text>
                </TouchableOpacity>
              </View>
            )}


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

      {/* ──────── Group Settings Modal ──────── */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 0 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Text style={styles.settingsFieldLabel}>Group Name *</Text>
              <TextInput
                style={styles.settingsInput}
                value={editName}
                onChangeText={setEditName}
                maxLength={80}
                placeholder="Group name"
                placeholderTextColor={AppColors.textLight}
              />

              {/* Description */}
              <Text style={styles.settingsFieldLabel}>Description *</Text>
              <TextInput
                style={[styles.settingsInput, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                maxLength={2000}
                placeholder="Describe the group purpose…"
                placeholderTextColor={AppColors.textLight}
              />

              {/* Privacy */}
              <Text style={styles.settingsFieldLabel}>Privacy</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['public', 'private'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.privacyPill, editPrivacy === p && styles.privacyPillActive]}
                    onPress={() => setEditPrivacy(p)}
                  >
                    <Ionicons
                      name={p === 'public' ? 'globe-outline' : 'lock-closed-outline'}
                      size={14}
                      color={editPrivacy === p ? 'white' : AppColors.primary}
                    />
                    <Text style={[styles.privacyPillText, editPrivacy === p && { color: 'white' }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location */}
              <Text style={styles.settingsFieldLabel}>Location</Text>
              <TextInput
                style={styles.settingsInput}
                value={editLocation}
                onChangeText={setEditLocation}
                maxLength={100}
                placeholder="City, Country"
                placeholderTextColor={AppColors.textLight}
              />

              {/* Website */}
              <Text style={styles.settingsFieldLabel}>Website</Text>
              <TextInput
                style={styles.settingsInput}
                value={editWebsite}
                onChangeText={setEditWebsite}
                maxLength={200}
                placeholder="https://…"
                keyboardType="url"
                autoCapitalize="none"
                placeholderTextColor={AppColors.textLight}
              />

              {/* Rules */}
              <Text style={styles.settingsFieldLabel}>Group Rules</Text>
              <Text style={{ fontSize: 11, color: AppColors.textMedium, marginBottom: 6 }}>Enter one rule per line</Text>
              <TextInput
                style={[styles.settingsInput, { minHeight: 100, textAlignVertical: 'top', paddingTop: 10 }]}
                value={editRules}
                onChangeText={setEditRules}
                multiline
                maxLength={2000}
                placeholder={`1. Be respectful\n2. No spam\n3. Stay on topic`}
                placeholderTextColor={AppColors.textLight}
              />

              {/* Toggles */}
              <Text style={[styles.settingsFieldLabel, { marginTop: 8 }]}>Member Settings</Text>
              {([
                { label: 'Members can post', hint: 'Allow members to create posts', value: editAllowMemberPosts, setter: setEditAllowMemberPosts },
                { label: 'Require post approval', hint: 'Admin must approve posts before visible', value: editRequirePostApproval, setter: setEditRequirePostApproval },
                { label: 'Members can invite', hint: 'All members can invite friends', value: editAllowMemberInvites, setter: setEditAllowMemberInvites },
                { label: 'Require join approval', hint: 'Admin must validate join requests', value: editRequireJoinApproval, setter: setEditRequireJoinApproval },
              ] as Array<{ label: string; hint: string; value: boolean; setter: (v: boolean) => void }>).map(item => (
                <View key={item.label} style={styles.settingsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsToggleLabel}>{item.label}</Text>
                    <Text style={styles.settingsToggleHint}>{item.hint}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.togglePill, item.value && styles.togglePillActive]}
                    onPress={() => item.setter(!item.value)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.toggleThumb, item.value && styles.toggleThumbActive]} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Save */}
              <TouchableOpacity
                style={[styles.settingsSaveBtn, settingsSaving && { opacity: 0.7 }]}
                onPress={handleSaveSettings}
                disabled={settingsSaving || !editName.trim() || !editDescription.trim()}
              >
                {settingsSaving
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={styles.settingsSaveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ──────── Ownership Delegation Modal ──────── */}

      <Modal
        visible={delegationVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDelegationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delegate Group Ownership</Text>
              <TouchableOpacity onPress={() => setDelegationVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.delegationModalDesc}>
                As the group creator, you must transfer your ownership (Super Admin role) to another member before leaving the group. Once they accept, you will be demoted and deactivated.
              </Text>

              {/* By Email */}
              <Text style={styles.delegationSectionTitle}>Delegate via Email Invitation</Text>
              <View style={styles.delegationInputRow}>
                <TextInput
                  style={styles.delegationInput}
                  placeholder="Enter email address"
                  placeholderTextColor={AppColors.textLight}
                  value={delegationEmail}
                  onChangeText={setDelegationEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.delegationSubmitBtn, !delegationEmail.trim() ? { opacity: 0.6 } : null]}
                  onPress={() => handleSendDelegation(undefined, delegationEmail.trim())}
                  disabled={!delegationEmail.trim() || delegationLoading}
                >
                  {delegationLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.delegationSubmitBtnText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* By Member List */}
              <Text style={[styles.delegationSectionTitle, { marginTop: 24 }]}>Or select an active member:</Text>
              {groupMembers.filter((m: any) => m.user?.id !== user?.id).length === 0 ? (
                <Text style={styles.noMembersText}>No other members in this group yet.</Text>
              ) : (
                groupMembers
                  .filter((m: any) => m.user?.id !== user?.id)
                  .map((m: any) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.delegateMemberCard}
                      onPress={() => {
                        Alert.alert(
                          'Delegate Ownership',
                          `Are you sure you want to delegate ownership to ${m.user?.full_name}? Once they accept, you will be demoted and deactivated.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delegate', onPress: () => handleSendDelegation(m.user?.id) }
                          ]
                        );
                      }}
                    >
                      {m.user?.profile_image ? (
                        <Image source={{ uri: resolveMediaUrl(m.user.profile_image) }} style={styles.delegateMemberAvatar} />
                      ) : (
                        <View style={styles.delegateMemberAvatarPlaceholder}>
                          <Text style={styles.delegateMemberInitials}>
                            {(m.user?.full_name || '?').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.delegateMemberName}>{m.user?.full_name}</Text>
                      <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>
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
  headerSettingsBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 24,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 8,
    borderRadius: 20,
  },
  // ── Settings modal styles ──
  settingsFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 6,
    marginTop: 14,
  },
  settingsInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textDark,
    marginBottom: 2,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  privacyPillActive: {
    backgroundColor: AppColors.primary,
  },
  privacyPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
  },
  settingsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingsToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  settingsToggleHint: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  togglePill: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  togglePillActive: {
    backgroundColor: AppColors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    transform: [{ translateX: 0 }],
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  settingsSaveBtn: {
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  settingsSaveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  // ── Invite role pills ──
  inviteRoleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  inviteRoleBtnActive: {
    backgroundColor: AppColors.primary,
  },
  inviteRoleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
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
  fabCreateEvent: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 100,
  },

  // ── Group Delegation ──
  delegationBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 14,
    gap: 12,
  },
  delegationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  delegationBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
  },
  delegationBannerText: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  delegationBannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  delegationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  delegationBtnAccept: {
    backgroundColor: AppColors.primary,
  },
  delegationBtnRefuse: {
    backgroundColor: '#E5E7EB',
  },
  delegationBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  delegationModalDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 20,
  },
  delegationSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 10,
  },
  delegationInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  delegationInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: AppColors.textDark,
    backgroundColor: '#FAFAFA',
  },
  delegationSubmitBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  delegationSubmitBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  noMembersText: {
    textAlign: 'center',
    color: AppColors.textLight,
    fontSize: 13,
    marginTop: 16,
  },
  delegateMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  delegateMemberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  delegateMemberAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  delegateMemberInitials: {
    color: AppColors.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  delegateMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
});

