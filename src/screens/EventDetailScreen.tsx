import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Share,
  Animated,
  Platform,
  Linking,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AppColors } from '../theme/colors';
import feedService, { Event } from '../services/feedService';
import { UrlHelper } from '../utils/urlHelper';
import { useAuth } from '../context/AuthContext';
import { TagManagementModal } from '../components/TagManagementModal';
import { EventAnnouncementsWidget } from '../components/EventAnnouncementsWidget';
import tagService from '../services/tagService';


// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveMediaUrl = (url?: string) => UrlHelper.convertPathToUrl(url);

const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateRange = (startStr: string, endStr: string) => {
  if (!startStr) return 'Date TBD';
  const start = new Date(startStr);
  const end = new Date(endStr);
  const sDate = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const eDate = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (sDate === eDate) {
    return `${sDate}  •  ${formatTime(startStr)} – ${formatTime(endStr)}`;
  }
  return `${sDate}  ${formatTime(startStr)}  →  ${eDate}  ${formatTime(endStr)}`;
};

const getStatusInfo = (event: Event) => {
  const now = Date.now();
  const start = new Date(event.startTime || event.start_time || '').getTime();
  const end = new Date(event.endTime || event.end_time || '').getTime();
  if (now >= start && now <= end)
    return { label: 'Ongoing', color: '#10B981', bg: '#D1FAE5', icon: 'play-circle' as const };
  if (now < start)
    return { label: 'Upcoming', color: '#0D9488', bg: '#CCFAF6', icon: 'calendar' as const };
  return { label: 'Past', color: '#6B7280', bg: '#F3F4F6', icon: 'checkmark-done-circle' as const };
};

const HEADER_HEIGHT = 280;

// ─── Component ────────────────────────────────────────────────────────────────

type RouteParams = { eventId: string | number; initialTab?: 'info' | 'community' | 'feed' };

export const EventDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ EventDetail: RouteParams }, 'EventDetail'>>();
  const insets = useSafeAreaInsets();
  const { eventId } = route.params;

  // Tab & Community Feeds state
  const initialTab = (route.params?.initialTab === 'community' || route.params?.initialTab === 'feed') ? 'community' : 'info';
  const [activeTab, setActiveTab] = useState<'info' | 'community'>(initialTab);
  const [eventFeeds, setEventFeeds] = useState<any[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [feedsPage, setFeedsPage] = useState(1);
  const [hasMoreFeeds, setHasMoreFeeds] = useState(true);

  // Creation State
  const [postContent, setPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'image' | 'video'; name: string } | null>(null);
  const [posting, setPosting] = useState(false);

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [attendeesVisible, setAttendeesVisible] = useState(false);

  // Event member management states
  const [members, setMembers] = useState<any[]>([]);
  const [isEventAdmin, setIsEventAdmin] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [tagsModalVisible, setTagsModalVisible] = useState(false);
  const [canPostAnnouncements, setCanPostAnnouncements] = useState(false);
  const [canManageTags, setCanManageTags] = useState(false);

  // New Admin Panel States
  const [emailOrName, setEmailOrName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [isDelegationsLoading, setIsDelegationsLoading] = useState(false);
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);

  const { user: currentUser } = useAuth();

  // ── Comments ─────────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingComment, setEditingComment] = useState<any | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [repliesMap, setRepliesMap] = useState<Record<number, any[]>>({});
  const [loadingRepliesId, setLoadingRepliesId] = useState<number | null>(null);
  const [commentPage, setCommentPage] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
  const REACTION_EMOJIS: Record<string, string> = {
    like: '👍', love: '❤️', haha: '😂', wow: '😮', sad: '😢', angry: '😠',
  };
  const REPORT_REASONS = [
    'Spam or misleading', 'Harassment or bullying', 'Hate speech',
    'Violence or dangerous content', 'Misinformation', 'Other',
  ];

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [HEADER_HEIGHT - 80, HEADER_HEIGHT - 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.4, 1],
    extrapolate: 'clamp',
  });

  // ── Community Feeds Logic ───────────────────────────────────────────────────
  const loadFeeds = useCallback(async (page = 1, isRefresh = false) => {
    if (feedsLoading) return;
    setFeedsLoading(true);
    try {
      const list = await feedService.getEventFeeds(eventId, page, 10);
      if (isRefresh || page === 1) {
        setEventFeeds(list);
        setFeedsPage(1);
        setHasMoreFeeds(list.length === 10);
      } else {
        if (list.length > 0) {
          setEventFeeds(prev => [...prev, ...list]);
          setFeedsPage(page);
          setHasMoreFeeds(list.length === 10);
        } else {
          setHasMoreFeeds(false);
        }
      }
    } catch (err) {
      console.error('Failed to load event feeds:', err);
    } finally {
      setFeedsLoading(false);
    }
  }, [eventId, feedsLoading]);

  useEffect(() => {
    if (activeTab === 'community' && eventId) {
      loadFeeds(1, true);
    }
  }, [activeTab, eventId]);

  const pickProofMedia = async (type: 'image' | 'video') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow media library access to attach photos or videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type,
        name: asset.fileName || `${type}_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`,
      });
    }
  };

  const captureProofMedia = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow camera access to take a photo or video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setSelectedMedia({
        uri: asset.uri,
        type: isVideo ? 'video' : 'image',
        name: asset.fileName || `capture_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      });
    }
  };

  const handleCreateFeedPost = async () => {
    if (!postContent.trim() && !selectedMedia) {
      Alert.alert('Empty Post', 'Please write something or attach a photo/video.');
      return;
    }
    setPosting(true);
    try {
      const result = await feedService.createFeedFull({
        content: postContent.trim() || ' ',
        postType: 'event',
        mediaFiles: selectedMedia ? [selectedMedia] : undefined,
        eventId: event?.id || eventId,
        privacyLevel: 'public',
      });

      if (result.success) {
        Alert.alert('Posted!', 'Your post has been shared to the event community feed!');
        setPostContent('');
        setSelectedMedia(null);
        loadFeeds(1, true);
      } else {
        Alert.alert('Error', result.message || 'Failed to share post.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setPosting(false);
    }
  };

  const handleLikePost = async (postId: string | number) => {
    setEventFeeds(prev => prev.map(p => {
      if (p.id === postId) {
        const newIsLiked = !p.is_liked;
        return {
          ...p,
          is_liked: newIsLiked,
          likes_count: newIsLiked ? (p.likes_count + 1) : Math.max(0, p.likes_count - 1),
        };
      }
      return p;
    }));
    await feedService.toggleReaction(postId);
  };

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadEvent = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await feedService.getEventById(eventId);
      if (data) setEvent(data);
      else Alert.alert('Error', 'Event not found.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load event details.');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  const loadMembers = useCallback(async () => {
    if (!event) return;
    setMembersLoading(true);
    try {
      const res = await feedService.getEventMembers(event.id);
      if (res.success) {
        setMembers(res.members || []);
        setIsEventAdmin(res.is_admin || false);
      }

      if (currentUser?.id) {
        try {
          const perms = await tagService.getUserEventPermissions(currentUser.id, event.id);
          if (perms) {
            const hasManageTags = perms.is_admin || perms.is_creator || perms.permitted_actions?.includes('manage_tags');
            const hasPostUpdates = perms.is_admin || perms.is_creator || perms.permitted_actions?.includes('post_updates');
            setCanManageTags(Boolean(hasManageTags));
            setCanPostAnnouncements(Boolean(hasPostUpdates));
            if (hasManageTags) {
              setIsEventAdmin(true);
            }
          }
        } catch (tagErr) {
          console.warn('Failed to load event tag permissions:', tagErr);
        }
      }
    } catch (e) {
      console.warn('Failed to load event members:', e);
    } finally {
      setMembersLoading(false);
    }
  }, [event, currentUser]);

  const loadDelegations = useCallback(async () => {
    if (!event) return;
    setIsDelegationsLoading(true);
    try {
      const res = await feedService.getEventDelegations(event.id);
      if (res.success) {
        setDelegations(res.data || []);
      }
    } catch (e) {
      console.warn('Failed to load event delegations:', e);
    } finally {
      setIsDelegationsLoading(false);
    }
  }, [event]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (event) {
      loadMembers();
    }
  }, [event, loadMembers]);

  useEffect(() => {
    if (event && isEventAdmin) {
      loadDelegations();
    }
  }, [event, isEventAdmin, loadDelegations]);

  const handleUserSearch = async (text: string) => {
    setEmailOrName(text);
    setSelectedUser(null);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const results = await feedService.searchUsers(text);
      setSearchResults(results || []);
    } catch (e) {
      console.warn('Failed to search users:', e);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleAddMember = async () => {
    if (!event) return;
    if (!selectedUser && !emailOrName.trim()) {
      Alert.alert('Error', 'Please select a user or enter an email address.');
      return;
    }
    setIsAdminActionLoading(true);
    try {
      const payload: any = {};
      if (selectedUser) {
        payload.user_id = selectedUser.id;
      } else {
        payload.email = emailOrName.trim();
      }

      const res = await feedService.addEventMember(event.id, payload);
      if (res.success) {
        Alert.alert('Success', res.message || 'User added successfully.');
        setEmailOrName('');
        setSelectedUser(null);
        setSearchResults([]);
        loadMembers();
      } else {
        Alert.alert('Error', res.message || 'Failed to add member.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleDelegateAdmin = async () => {
    if (!event) return;
    if (!selectedUser && !emailOrName.trim()) {
      Alert.alert('Error', 'Please select a user or enter an email address.');
      return;
    }
    setIsAdminActionLoading(true);
    try {
      const payload: any = {};
      if (selectedUser) {
        payload.user_id = selectedUser.id;
      } else {
        payload.email = emailOrName.trim();
      }

      const res = await feedService.delegateEventAdmin(event.id, payload);
      if (res.success) {
        Alert.alert('Success', res.message || 'Delegation request sent.');
        setEmailOrName('');
        setSelectedUser(null);
        setSearchResults([]);
        loadDelegations();
      } else {
        Alert.alert('Error', res.message || 'Failed to delegate role.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleCancelDelegation = async (delegationId: number | string) => {
    Alert.alert(
      'Cancel Delegation',
      'Are you sure you want to cancel this admin delegation request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const res = await feedService.cancelEventDelegation(delegationId);
              if (res.success) {
                Alert.alert('Cancelled', 'Delegation request has been cancelled.');
                loadDelegations();
              } else {
                Alert.alert('Error', res.message || 'Failed to cancel.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An error occurred.');
            }
          }
        }
      ]
    );
  };

  // ── Member Removal ──────────────────────────────────────────────────────────
  const handleRemoveMember = async (userId: string | number, fullName: string) => {
    if (!event) return;
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${fullName} from this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await feedService.removeEventMember(event.id, userId);
              if (res.success) {
                Alert.alert('Success', `${fullName} has been removed.`);
                loadMembers();
                // Update event attendees count locally
                setEvent(prev =>
                  prev
                    ? {
                      ...prev,
                      attendeesCount: Math.max(0, (prev.attendeesCount ?? 1) - 1),
                      attendees_count: Math.max(0, (prev.attendees_count ?? 1) - 1),
                    }
                    : prev
                );
              } else {
                Alert.alert('Error', res.message || 'Failed to remove member.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  // ── Registration ────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!event) return;
    const isRegistered = event.isRegistered || event.is_registered;
    setIsRegistering(true);
    try {
      if (isRegistered) {
        const result = await feedService.unregisterFromEvent(event.id);
        if (result.success) {
          setEvent(prev =>
            prev
              ? {
                ...prev,
                isRegistered: false,
                is_registered: false,
                attendeesCount: Math.max(0, (prev.attendeesCount ?? 1) - 1),
                attendees_count: Math.max(0, (prev.attendees_count ?? 1) - 1),
              }
              : prev,
          );
          Alert.alert('Done', `You've unregistered from "${event.title}".`);
        } else {
          Alert.alert('Error', result.message || 'Failed to unregister.');
        }
      } else {
        const result = await feedService.registerForEvent(event.id);
        if (result.success) {
          setEvent(prev =>
            prev
              ? {
                ...prev,
                isRegistered: true,
                is_registered: true,
                attendeesCount: (prev.attendeesCount ?? 0) + 1,
                attendees_count: (prev.attendees_count ?? 0) + 1,
              }
              : prev,
          );
          Alert.alert('🎉 Registered!', `You're in for "${event.title}"!`);
        } else {
          Alert.alert('Error', result.message || 'Failed to register.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        title: event.title,
        message: `Check out this eco event: ${event.title}\n📍 ${event.location}\n🗓 ${formatDateRange(
          event.startTime,
          event.endTime,
        )}`,
      });
    } catch { }
  };

  // ── Event Comment Handlers ──────────────────────────────────────────────────
  const loadComments = useCallback(async (reset = false) => {
    if (!event) return;
    setCommentsLoading(true);
    const offset = reset ? 0 : commentPage;
    const { data, pagination } = await feedService.getEventComments(event.id, {
      sort_by: 'newest', limit: 20, offset,
    });
    setComments(prev => reset ? data : [...prev, ...data]);
    setHasMoreComments(pagination.has_more || false);
    setCommentPage(reset ? data.length : offset + data.length);
    setCommentsLoading(false);
  }, [event, commentPage]);

  const handleOpenComments = () => {
    setCommentsVisible(true);
    if (comments.length === 0) loadComments(true);
  };

  const handleSubmitComment = async () => {
    const text = commentInput.trim();
    if (!text || !event) return;
    setCommentSubmitting(true);
    try {
      if (editingComment) {
        const res = await feedService.updateEventComment(event.id, editingComment.id, text);
        if (res.success) {
          setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, content: text, is_edited: true } : c));
          setEditingComment(null);
        } else Alert.alert('Error', res.message || 'Failed to update comment');
      } else {
        const res = await feedService.createEventComment(event.id, text, replyingTo?.id);
        if (res.success && res.data) {
          if (replyingTo) {
            setRepliesMap(prev => ({ ...prev, [replyingTo.id]: [res.data, ...(prev[replyingTo.id] || [])] }));
            setComments(prev => prev.map(c => c.id === replyingTo.id ? { ...c, reply_count: (c.reply_count || 0) + 1 } : c));
          } else {
            setComments(prev => [res.data, ...prev]);
            setEvent(prev => prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev);
          }
          setReplyingTo(null);
        } else Alert.alert('Error', res.message || 'Failed to post comment');
      }
    } finally {
      setCommentInput('');
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    if (!event) return;
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const ok = await feedService.deleteEventComment(event.id, commentId);
          if (ok) {
            setComments(prev => prev.filter(c => c.id !== commentId));
            setEvent(prev => prev ? { ...prev, comment_count: Math.max(0, (prev.comment_count || 1) - 1) } : prev);
          } else Alert.alert('Error', 'Failed to delete comment');
        },
      },
    ]);
  };

  const handleReactToComment = async (comment: any, reactionType: string) => {
    if (!event) return;
    const res = await feedService.reactToEventComment(event.id, comment.id, reactionType);
    if (res.success) {
      setComments(prev => prev.map(c => {
        if (c.id !== comment.id) return c;
        const alreadyReacted = c.has_liked && c.user_reaction === reactionType;
        return {
          ...c,
          has_liked: !alreadyReacted,
          user_reaction: alreadyReacted ? null : reactionType,
          like_count: alreadyReacted ? Math.max(0, c.like_count - 1) : c.like_count + 1,
        };
      }));
    }
  };

  const handleToggleReplies = async (comment: any) => {
    const id = comment.id;
    if (expandedReplies.has(id)) {
      setExpandedReplies(prev => { const s = new Set(prev); s.delete(id); return s; });
      return;
    }
    setLoadingRepliesId(id);
    if (!repliesMap[id]) {
      const { data } = await feedService.getEventCommentReplies(event!.id, id);
      setRepliesMap(prev => ({ ...prev, [id]: data }));
    }
    setExpandedReplies(prev => new Set([...prev, id]));
    setLoadingRepliesId(null);
  };

  const handleReportEvent = () => {
    if (!event) return;
    Alert.alert('Report Event', 'Select a reason', [
      ...REPORT_REASONS.map(r => ({
        text: r, onPress: async () => {
          const ok = await feedService.reportEvent(event.id, r);
          Alert.alert(ok ? 'Reported' : 'Error', ok ? 'Event has been reported. Thank you.' : 'Failed to report event.');
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleReportComment = (commentId: number) => {
    if (!event) return;
    Alert.alert('Report Comment', 'Select a reason', [
      ...REPORT_REASONS.map(r => ({
        text: r, onPress: async () => {
          const ok = await feedService.reportEventComment(event.id, commentId, r);
          Alert.alert(ok ? 'Reported' : 'Error', ok ? 'Comment reported. Thank you.' : 'Failed to report comment.');
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading event details…</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={60} color={AppColors.textLight} />
        <Text style={styles.emptyTitle}>Event not found</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = getStatusInfo(event);
  const isRegistered = event.isRegistered || event.is_registered;
  const attendeesCount = event.attendees_count ?? event.attendeesCount ?? 0;
  const maxAttendees = event.max_attendees;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* ── Sticky Translucent Header ── */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top, opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.stickyBackBtn}>
          <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.stickyTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <TouchableOpacity onPress={handleShare} style={styles.stickyShareBtn}>
          <Ionicons name="share-outline" size={22} color={AppColors.textDark} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Scrollable Body ── */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Banner image with overlay buttons */}
        <View style={styles.bannerWrapper}>
          <Animated.Image
            source={{ uri: resolveMediaUrl(event.banner_image || event.bannerImage) }}
            style={[styles.bannerImage, { transform: [{ scale: imageScale }] }]}
            resizeMode="cover"
          />
          {/* Gradient overlay */}
          <View style={styles.bannerOverlay} />

          {/* Floating action row */}
          <View style={[styles.floatingRow, { top: insets.top + 10 }]}>
            <TouchableOpacity style={styles.floatBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.floatBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={13} color={status.color} />
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>

          {/* Attendees pill on banner */}
          <View style={styles.attendeesPill}>
            <Ionicons name="people" size={14} color="white" />
            <Text style={styles.attendeesPillText}>
              {attendeesCount}
              {maxAttendees ? ` / ${maxAttendees}` : ''} attending
            </Text>
          </View>
        </View>

        {/* ── Content Card ── */}
        <View style={styles.contentCard}>
          {/* Title & organizer */}
          <Text style={styles.title}>{event.title}</Text>

          {event.organizer && (
            <TouchableOpacity
              style={styles.organizerRow}
              onPress={() => {
                const organizerId = (event.organizer as any)?.user_id || (event.organizer as any)?.id || (event as any).creator_id || (event as any).creator?.id || (event as any).user?.id;
                if (organizerId) {
                  (navigation as any).navigate('Profile', { userId: organizerId });
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.organizerAvatar}>
                <Ionicons name="person" size={14} color={AppColors.primary} />
              </View>
              <Text style={styles.organizerText}>
                Organized by <Text style={styles.organizerName}>{event.organizer.name}</Text>
              </Text>
            </TouchableOpacity>
          )}

          {/* Categories */}
          {event.categories && event.categories.length > 0 && (
            <View style={styles.tagsRow}>
              {event.categories.map((cat, idx) => (
                <View key={cat.id || cat.name || idx.toString()} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{cat.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {event.tags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Segmented Tab Switcher ── */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'info' && styles.tabButtonActive]}
              onPress={() => setActiveTab('info')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={activeTab === 'info' ? AppColors.primary : AppColors.textMedium}
              />
              <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
                Event Info
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'community' && styles.tabButtonActive]}
              onPress={() => setActiveTab('community')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={16}
                color={activeTab === 'community' ? AppColors.primary : AppColors.textMedium}
              />
              <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>
                Community Feed
              </Text>
              {eventFeeds.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{eventFeeds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {activeTab === 'info' ? (
            <>
              {/* Info rows */}
              <InfoRow icon="calendar-outline" label={formatDateRange(event.startTime, event.endTime)} />

              {/* Location: API returns a locked string when display_location=false or private event non-member */}
              {event.location && event.location.startsWith('🔒') ? (
                <View>
                  <InfoRow icon="lock-closed" label={event.location} labelColor="#EF4444" />
                  <Text style={{ fontSize: 11, color: AppColors.textMedium, marginLeft: 38, marginTop: -6, marginBottom: 8 }}>
                    {(event.privacyLevel || event.privacy_level) === 'private'
                      ? 'Location is only visible to authorised members of this private event.'
                      : 'Location is hidden by the event organiser.'}
                  </Text>
                </View>
              ) : (
                <InfoRow icon="location-outline" label={event.location || 'Location TBD'} />
              )}

              {event.event_type && <InfoRow icon="pricetag-outline" label={event.event_type} />}
              {event.website && (
                <InfoRow
                  icon="globe-outline"
                  label={event.website}
                  onPress={() => Linking.openURL(event.website!)}
                  labelColor={AppColors.primary}
                />
              )}
              {event.email && (
                <InfoRow
                  icon="mail-outline"
                  label={event.email}
                  onPress={() => Linking.openURL(`mailto:${event.email}`)}
                  labelColor={AppColors.primary}
                />
              )}
              {event.phone && (
                <InfoRow
                  icon="call-outline"
                  label={event.phone}
                  onPress={() => Linking.openURL(`tel:${event.phone}`)}
                  labelColor={AppColors.primary}
                />
              )}

              <View style={styles.divider} />

              {/* Description */}
              <Text style={styles.sectionTitle}>About this Event</Text>
              <Text style={[styles.description, !event.hasAccess && { opacity: 0.5 }]}>
                {!event.hasAccess
                  ? 'This event is restricted. Full details are visible to authorised members only.'
                  : event.description || 'No description available.'}
              </Text>

              {/* Event Attendees Management Section (Replaces or complements simple registrations) */}
              {event.hasAccess !== false && isEventAdmin && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Admin Event Panel</Text>

                  <View style={styles.adminCard}>
                    <Text style={styles.adminCardSub}>Add Member or Delegate Admin</Text>

                    <View style={styles.searchContainer}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search name or type email..."
                        placeholderTextColor={AppColors.textLight}
                        value={selectedUser ? selectedUser.full_name : emailOrName}
                        onChangeText={handleUserSearch}
                        editable={!selectedUser}
                      />
                      {selectedUser && (
                        <TouchableOpacity
                          style={styles.clearSearchBtn}
                          onPress={() => {
                            setSelectedUser(null);
                            setEmailOrName('');
                            setSearchResults([]);
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color={AppColors.textLight} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {isSearchingUsers && <ActivityIndicator size="small" color={AppColors.primary} style={{ marginTop: 8 }} />}

                    {searchResults.length > 0 && !selectedUser && (
                      <View style={styles.searchResultsContainer}>
                        {searchResults.map(user => (
                          <TouchableOpacity
                            key={user.id}
                            style={styles.searchResultItem}
                            onPress={() => {
                              setSelectedUser(user);
                              setSearchResults([]);
                            }}
                          >
                            <Text style={styles.searchResultName}>{user.full_name}</Text>
                            <Text style={styles.searchResultEmail}>{user.email}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <View style={styles.adminActionsRow}>
                      <TouchableOpacity
                        style={[styles.adminBtn, styles.addMemberBtn, isAdminActionLoading && { opacity: 0.7 }]}
                        onPress={handleAddMember}
                        disabled={isAdminActionLoading}
                      >
                        <Ionicons name="person-add-outline" size={16} color="white" />
                        <Text style={styles.adminBtnText}>Add Member</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.adminBtn, styles.delegateBtn, isAdminActionLoading && { opacity: 0.7 }]}
                        onPress={handleDelegateAdmin}
                        disabled={isAdminActionLoading}
                      >
                        <Ionicons name="ribbon-outline" size={16} color="white" />
                        <Text style={styles.adminBtnText}>Delegate Admin</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Active Delegations */}
                  {delegations.length > 0 && (
                    <View style={styles.delegationsContainer}>
                      <Text style={styles.adminCardSub}>Active Admin Delegations</Text>
                      {delegations.map(del => (
                        <View key={del.id} style={styles.delegationItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.delegationTargetName} numberOfLines={1}>
                              {del.receiver ? del.receiver.full_name : del.receiver_email}
                            </Text>
                            <Text style={styles.delegationStatus}>
                              Status: <Text style={[styles.statusTextValue, {
                                color: del.status === 'accepted' ? '#10B981' : del.status === 'declined' ? '#EF4444' : '#D97706'
                              }]}>{del.status.toUpperCase()}</Text>
                            </Text>
                          </View>
                          {del.status === 'pending' && (
                            <TouchableOpacity
                              style={styles.cancelDelBtn}
                              onPress={() => handleCancelDelegation(del.id)}
                            >
                              <Text style={styles.cancelDelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Car Sharing Section */}
              <View style={styles.divider} />
              <View style={styles.carShareCard}>
                <View style={styles.carShareHeader}>
                  <View style={styles.carShareIconWrap}>
                    <Ionicons name="car-sport" size={22} color="white" />
                  </View>
                  <View style={styles.carShareInfo}>
                    <Text style={styles.carShareTitle}>Eco Car Share</Text>
                    <Text style={styles.carShareDesc}>Coordinate rides and share travel costs with other champions.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.carShareBtn}
                  onPress={() => navigation.navigate('CarShare', {
                    screen: 'CarShareScreen',
                    params: {
                      eventId: event.id,
                      eventTitle: event.title,
                      eventLocation: event.location
                    }
                  })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.carShareBtnText}>Browse Available Rides</Text>
                  <Ionicons name="arrow-forward" size={16} color="white" />
                </TouchableOpacity>
              </View>

              {/* Stats row */}
              <View style={styles.divider} />
              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statPill} onPress={() => setAttendeesVisible(true)}>
                  <Ionicons name="people-outline" size={16} color={AppColors.primary} />
                  <Text style={styles.statValue}>{attendeesCount}</Text>
                  <Text style={styles.statLabel}>Going</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.statPill} onPress={handleOpenComments}>
                  <Ionicons name="chatbubble-outline" size={16} color={AppColors.primary} />
                  <Text style={styles.statValue}>{event.comment_count ?? 0}</Text>
                  <Text style={styles.statLabel}>Comments</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statPill}
                  onPress={() => navigation.navigate('CarShare', {
                    screen: 'CarShareScreen',
                    params: {
                      eventId: event.id,
                      eventTitle: event.title,
                      eventLocation: event.location
                    }
                  })}
                >
                  <Ionicons name="car-outline" size={16} color={AppColors.primary} />
                  <Text style={styles.statValue}>{event.car_share_count ?? 0}</Text>
                  <Text style={styles.statLabel}>Rides</Text>
                </TouchableOpacity>

                {event.share_count !== undefined && (
                  <StatPill icon="share-outline" value={event.share_count} label="Shares" />
                )}
              </View>

              {/* ── Event Announcements & Updates ── */}
              <View style={styles.divider} />
              <EventAnnouncementsWidget
                eventId={eventId}
                canPost={isEventAdmin || canPostAnnouncements}
              />

              {/* ── Report Event Button ── */}
              <View style={styles.divider} />
              <TouchableOpacity style={styles.reportEventBtn} onPress={handleReportEvent}>
                <Ionicons name="flag-outline" size={16} color="#EF4444" />
                <Text style={styles.reportEventBtnText}>Report this event</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* ── Community Feed Tab ── */}
              {/* Share Feed Post Form */}
              <View style={styles.shareContainer}>
                <Text style={styles.shareTitle}>Share with Event Attendees</Text>
                <TextInput
                  style={styles.shareInput}
                  placeholder="Share a photo, question, or update about this event..."
                  placeholderTextColor={AppColors.textLight}
                  value={postContent}
                  onChangeText={setPostContent}
                  multiline
                />

                {selectedMedia && (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: selectedMedia.uri }} style={styles.previewImage} />
                    {selectedMedia.type === 'video' && (
                      <View style={styles.previewVideoOverlay}>
                        <Ionicons name="play" size={24} color="#FFF" />
                      </View>
                    )}
                    <TouchableOpacity style={styles.removePreviewBtn} onPress={() => setSelectedMedia(null)}>
                      <Ionicons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.attachmentRow}>
                  <TouchableOpacity style={styles.attachmentBtn} onPress={() => pickProofMedia('image')}>
                    <Ionicons name="image-outline" size={16} color={AppColors.primary} />
                    <Text style={styles.attachmentBtnText}>Image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachmentBtn} onPress={() => pickProofMedia('video')}>
                    <Ionicons name="videocam-outline" size={16} color={AppColors.primary} />
                    <Text style={styles.attachmentBtnText}>Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachmentBtn} onPress={captureProofMedia}>
                    <Ionicons name="camera-outline" size={16} color={AppColors.primary} />
                    <Text style={styles.attachmentBtnText}>Camera</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.postButton, posting && { opacity: 0.7 }]}
                  onPress={handleCreateFeedPost}
                  disabled={posting}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.postButtonText}>Post to Event Feed</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Feeds List */}
              {feedsLoading && eventFeeds.length === 0 ? (
                <ActivityIndicator size="large" color={AppColors.primary} style={{ marginTop: 24 }} />
              ) : eventFeeds.length === 0 ? (
                <View style={styles.noPostsContainer}>
                  <Ionicons name="chatbubbles-outline" size={48} color={AppColors.textLight} />
                  <Text style={styles.noPostsText}>No posts shared for this event yet. Be the first to share an update or question!</Text>
                </View>
              ) : (
                eventFeeds.map(post => {
                  const authorName = post.user?.full_name || post.author?.full_name || 'Attendee';
                  const authorImage = post.user?.profile_image || post.user?.avatar_url || post.author?.profile_image;
                  const isLiked = post.is_liked || post.user_reacted;
                  const likes = post.likes_count ?? 0;
                  const comments = post.comments_count ?? 0;
                  const hasMedia = post.media && post.media.length > 0;

                  return (
                    <View key={post.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        {authorImage ? (
                          <Image source={{ uri: resolveMediaUrl(authorImage) }} style={styles.postAvatar} />
                        ) : (
                          <View style={styles.postAvatarPlaceholder}>
                            <Text style={styles.postAvatarText}>
                              {authorName.substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.postAuthorInfo}>
                          <Text style={styles.postAuthorName}>{authorName}</Text>
                          <Text style={styles.postTime}>
                            {new Date(post.created_at || post.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>

                      {post.content ? <Text style={styles.postBody}>{post.content}</Text> : null}

                      {hasMedia && post.media.map((media: any) => {
                        return (
                          <Image
                            key={media.id || media.url}
                            source={{ uri: resolveMediaUrl(media.url) }}
                            style={styles.postMedia}
                            resizeMode="cover"
                          />
                        );
                      })}

                      <View style={styles.postActions}>
                        <TouchableOpacity style={styles.postActionBtn} onPress={() => handleLikePost(post.id)}>
                          <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={18}
                            color={isLiked ? AppColors.error : AppColors.textMedium}
                          />
                          <Text style={[styles.postActionText, isLiked && { color: AppColors.error }]}>{likes}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.postActionBtn}
                          onPress={() => navigation.navigate('Comments', { feedId: post.id })}
                        >
                          <Ionicons name="chatbubble-outline" size={18} color={AppColors.textMedium} />
                          <Text style={styles.postActionText}>{comments}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.postActionBtn}
                          onPress={() => {
                            Share.share({
                              message: `${post.content}\n\nShared from ${event.title} on Ekenox`,
                            });
                          }}
                        >
                          <Ionicons name="share-social-outline" size={18} color={AppColors.textMedium} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}

              {hasMoreFeeds && eventFeeds.length >= 10 && (
                <TouchableOpacity
                  style={{ paddingVertical: 14, alignItems: 'center' }}
                  onPress={() => loadFeeds(feedsPage + 1)}
                  disabled={feedsLoading}
                >
                  {feedsLoading ? (
                    <ActivityIndicator size="small" color={AppColors.primary} />
                  ) : (
                    <Text style={{ fontSize: 13, color: AppColors.primary, fontWeight: '700' }}>Load More Posts</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Attendees Modal ── */}
        <Modal
          visible={attendeesVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setAttendeesVisible(false)}
        >
          <View style={styles.commentsSheet}>
            {/* Header */}
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsHeaderTitle}>Event Attendees ({members.length})</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {(isEventAdmin || canManageTags) && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#EEF2FF',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                      gap: 4,
                    }}
                    onPress={() => {
                      setAttendeesVisible(false);
                      setTagsModalVisible(true);
                    }}
                  >
                    <Ionicons name="pricetags-outline" size={14} color="#4F46E5" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#4F46E5' }}>
                      Tags & Roles
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setAttendeesVisible(false)}>
                  <Ionicons name="close" size={24} color={AppColors.textDark} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Members List */}
            {membersLoading ? (
              <View style={styles.commentsLoader}>
                <ActivityIndicator size="large" color={AppColors.primary} />
              </View>
            ) : members.length === 0 ? (
              <View style={styles.commentsEmpty}>
                <Ionicons name="people-outline" size={40} color={AppColors.textLight} />
                <Text style={styles.commentsEmptyText}>No registered champions yet.</Text>
              </View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={item => String(item.registration_id || item.id)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                renderItem={({ item: member }) => (
                  <View style={styles.memberListItem}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => {
                        setAttendeesVisible(false);
                        if (member.user?.id) {
                          navigation.navigate('Profile', { userId: member.user.id });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {member.user?.profile_image ? (
                        <Image
                          source={{ uri: resolveMediaUrl(member.user.profile_image) }}
                          style={styles.memberAvatar}
                        />
                      ) : (
                        <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                          <Text style={styles.memberInitial}>
                            {(member.user?.full_name || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.user?.full_name}</Text>
                        {member.is_creator && (
                          <View style={styles.creatorBadge}>
                            <Text style={styles.creatorBadgeText}>Organizer</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    {isEventAdmin && !member.is_creator && (
                      <TouchableOpacity
                        style={styles.removeMemberBtn}
                        onPress={() => {
                          setAttendeesVisible(false);
                          handleRemoveMember(member.user?.id, member.user?.full_name);
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        </Modal>

        {/* ── Comments Modal ── */}
        <Modal
          visible={commentsVisible}
          animationType="slide"
          transparent
          onRequestClose={() => { setCommentsVisible(false); setReplyingTo(null); setEditingComment(null); }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.commentsSheet}>
              {/* Header */}
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsHeaderTitle}>Comments ({event.comment_count ?? 0})</Text>
                <TouchableOpacity onPress={() => { setCommentsVisible(false); setReplyingTo(null); setEditingComment(null); }}>
                  <Ionicons name="close" size={24} color={AppColors.textDark} />
                </TouchableOpacity>
              </View>

              {/* Comment list */}
              {commentsLoading && comments.length === 0 ? (
                <View style={styles.commentsLoader}>
                  <ActivityIndicator size="large" color={AppColors.primary} />
                </View>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={item => String(item.id)}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
                  ListEmptyComponent={
                    <View style={styles.commentsEmpty}>
                      <Ionicons name="chatbubble-outline" size={40} color={AppColors.textLight} />
                      <Text style={styles.commentsEmptyText}>No comments yet. Be the first!</Text>
                    </View>
                  }
                  ListFooterComponent={hasMoreComments ? (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={() => loadComments()}>
                      {commentsLoading ? <ActivityIndicator size="small" color={AppColors.primary} /> : <Text style={styles.loadMoreText}>Load more comments</Text>}
                    </TouchableOpacity>
                  ) : null}
                  renderItem={({ item: comment }) => (
                    <View style={styles.commentItem}>
                      {/* Author avatar */}
                      <View style={styles.commentAvatarCol}>
                        {comment.user?.profile_image ? (
                          <Image source={{ uri: UrlHelper.convertPathToUrl(comment.user.profile_image) }} style={styles.commentAvatar} />
                        ) : (
                          <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                            <Text style={styles.commentAvatarInitial}>{(comment.user?.full_name || 'U')[0]}</Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        {/* Bubble */}
                        <View style={styles.commentBubble}>
                          <View style={styles.commentBubbleHeader}>
                            <Text style={styles.commentAuthor}>{comment.user?.full_name || 'User'}</Text>
                            {comment.is_edited && <Text style={styles.editedTag}>(edited)</Text>}
                          </View>
                          <Text style={styles.commentContent}>{comment.content}</Text>
                        </View>

                        {/* Actions row */}
                        <View style={styles.commentActions}>
                          {/* Reactions */}
                          <TouchableOpacity
                            style={styles.commentReactBtn}
                            onPress={() => handleReactToComment(comment, 'like')}
                            onLongPress={() => {
                              Alert.alert('React', 'Choose reaction', [
                                ...REACTION_TYPES.map(r => ({ text: `${REACTION_EMOJIS[r]} ${r}`, onPress: () => handleReactToComment(comment, r) })),
                                { text: 'Cancel', style: 'cancel' },
                              ]);
                            }}
                          >
                            <Text style={[styles.commentReactText, comment.has_liked && { color: AppColors.primary }]}>
                              {comment.has_liked ? REACTION_EMOJIS[comment.user_reaction || 'like'] : '👍'}
                            </Text>
                            {comment.like_count > 0 && <Text style={styles.commentReactCount}>{comment.like_count}</Text>}
                          </TouchableOpacity>

                          {/* Reply */}
                          <TouchableOpacity
                            style={styles.commentActionBtn}
                            onPress={() => {
                              setReplyingTo(comment);
                              setEditingComment(null);
                              setCommentInput('');
                              setTimeout(() => commentInputRef.current?.focus(), 100);
                            }}
                          >
                            <Text style={styles.commentActionText}>Reply</Text>
                          </TouchableOpacity>

                          {/* Edit (own comment) */}
                          {currentUser && String(currentUser.id) === String(comment.user?.id) && (
                            <TouchableOpacity
                              style={styles.commentActionBtn}
                              onPress={() => {
                                setEditingComment(comment);
                                setReplyingTo(null);
                                setCommentInput(comment.content);
                                setTimeout(() => commentInputRef.current?.focus(), 100);
                              }}
                            >
                              <Text style={styles.commentActionText}>Edit</Text>
                            </TouchableOpacity>
                          )}

                          {/* Delete (own comment or admin) */}
                          {(currentUser && (String(currentUser.id) === String(comment.user?.id) || isEventAdmin)) && (
                            <TouchableOpacity style={styles.commentActionBtn} onPress={() => handleDeleteComment(comment.id)}>
                              <Text style={[styles.commentActionText, { color: '#EF4444' }]}>Delete</Text>
                            </TouchableOpacity>
                          )}

                          {/* Report */}
                          {currentUser && String(currentUser.id) !== String(comment.user?.id) && (
                            <TouchableOpacity style={styles.commentActionBtn} onPress={() => handleReportComment(comment.id)}>
                              <Ionicons name="flag-outline" size={12} color={AppColors.textLight} />
                            </TouchableOpacity>
                          )}

                          {/* Time */}
                          <Text style={styles.commentTime}>
                            {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>

                        {/* Replies toggle */}
                        {(comment.reply_count > 0 || expandedReplies.has(comment.id)) && (
                          <TouchableOpacity
                            style={styles.repliesToggle}
                            onPress={() => handleToggleReplies(comment)}
                          >
                            {loadingRepliesId === comment.id ? (
                              <ActivityIndicator size="small" color={AppColors.primary} />
                            ) : (
                              <Text style={styles.repliesToggleText}>
                                {expandedReplies.has(comment.id)
                                  ? 'Hide replies'
                                  : `View ${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {/* Replies list */}
                        {expandedReplies.has(comment.id) && (repliesMap[comment.id] || []).map(reply => (
                          <View key={reply.id} style={styles.replyItem}>
                            {reply.user?.profile_image ? (
                              <Image source={{ uri: UrlHelper.convertPathToUrl(reply.user.profile_image) }} style={styles.replyAvatar} />
                            ) : (
                              <View style={[styles.replyAvatar, styles.commentAvatarFallback]}>
                                <Text style={[styles.commentAvatarInitial, { fontSize: 9 }]}>{(reply.user?.full_name || 'U')[0]}</Text>
                              </View>
                            )}
                            <View style={styles.replyBubble}>
                              <Text style={styles.replyAuthor}>{reply.user?.full_name || 'User'}</Text>
                              <Text style={styles.replyContent}>{reply.content}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                />
              )}

              {/* Input bar */}
              <View style={styles.commentInputBar}>
                {(replyingTo || editingComment) && (
                  <View style={styles.commentReplyBanner}>
                    <Text style={styles.commentReplyBannerText}>
                      {editingComment ? `Editing comment` : `Replying to ${replyingTo?.user?.full_name}`}
                    </Text>
                    <TouchableOpacity onPress={() => { setReplyingTo(null); setEditingComment(null); setCommentInput(''); }}>
                      <Ionicons name="close-circle" size={16} color={AppColors.textMedium} />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.commentInputRow}>
                  <TextInput
                    ref={commentInputRef}
                    style={styles.commentTextInput}
                    placeholder={replyingTo ? `Reply to ${replyingTo.user?.full_name}…` : 'Write a comment…'}
                    placeholderTextColor={AppColors.textMedium}
                    value={commentInput}
                    onChangeText={setCommentInput}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity
                    style={[styles.commentSendBtn, !commentInput.trim() && { opacity: 0.4 }]}
                    onPress={handleSubmitComment}
                    disabled={!commentInput.trim() || commentSubmitting}
                  >
                    {commentSubmitting
                      ? <ActivityIndicator size="small" color="white" />
                      : <Ionicons name="send" size={18} color="white" />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Animated.ScrollView>

      {/* ── Sticky Registration CTA ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        {!event.hasAccess ? (
          // Locked state — no access (private or members-only event)
          <View style={styles.lockedCtaWrapper}>
            <View style={styles.lockedCtaIcon}>
              <Ionicons name="lock-closed" size={18} color="#9CA3AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedCtaTitle}>Registration Restricted</Text>
              <Text style={styles.lockedCtaSubtitle}>
                {(event.privacyLevel || event.privacy_level) === 'private'
                  ? 'This is a private event — authorised members only.'
                  : 'This event is open to group/association members only.'}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.registerBtn,
              isRegistered && styles.unregisterBtn,
              status.label === 'Past' && styles.disabledRegisterBtn,
            ]}
            onPress={handleRegister}
            disabled={isRegistering || status.label === 'Past'}
            activeOpacity={0.85}
          >
            {isRegistering ? (
              <ActivityIndicator color={isRegistered ? AppColors.primary : 'white'} size="small" />
            ) : (
              <>
                <Ionicons
                  name={
                    status.label === 'Past'
                      ? 'time-outline'
                      : isRegistered
                        ? 'checkmark-circle'
                        : 'add-circle-outline'
                  }
                  size={20}
                  color={
                    status.label === 'Past'
                      ? AppColors.textMedium
                      : isRegistered
                        ? AppColors.primary
                        : 'white'
                  }
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.registerBtnText,
                    isRegistered && styles.unregisterBtnText,
                    status.label === 'Past' && styles.disabledRegisterBtnText,
                  ]}
                >
                  {status.label === 'Past'
                    ? 'This event has ended'
                    : isRegistered
                      ? 'Unregister / Cancel'
                      : 'Register Now'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tag Management Modal ── */}
      <TagManagementModal
        visible={tagsModalVisible}
        onClose={() => setTagsModalVisible(false)}
        targetType="event"
        targetId={eventId}
        targetTitle={event?.title || 'Event'}
      />
    </View>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const InfoRow = ({
  icon,
  label,
  onPress,
  labelColor,
}: {
  icon: any;
  label: string;
  onPress?: () => void;
  labelColor?: string;
}) => (
  <TouchableOpacity
    style={styles.infoRow}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={16} color={AppColors.primary} />
    </View>
    <Text style={[styles.infoLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
    {onPress && <Ionicons name="chevron-forward" size={14} color={AppColors.textLight} />}
  </TouchableOpacity>
);

const StatPill = ({ icon, value, label }: { icon: any; value: number; label: string }) => (
  <View style={styles.statPill}>
    <Ionicons name={icon} size={16} color={AppColors.primary} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F5F5F7',
  },
  loadingText: {
    marginTop: 12,
    color: AppColors.textMedium,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  },

  // Sticky header
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  stickyBackBtn: { padding: 6 },
  stickyTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
    marginHorizontal: 8,
  },
  stickyShareBtn: { padding: 6 },

  // Banner
  bannerWrapper: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  floatingRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 52,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  attendeesPill: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  attendeesPillText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Content card
  contentCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    minHeight: 400,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.textDark,
    lineHeight: 30,
    marginBottom: 10,
  },

  // Organizer
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  organizerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  organizerText: {
    fontSize: 13,
    color: AppColors.textMedium,
  },
  organizerName: {
    color: AppColors.primary,
    fontWeight: '700',
  },

  // Tags / categories
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  categoryChip: {
    backgroundColor: AppColors.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryChipText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
  },
  tagChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagChipText: {
    fontSize: 12,
    color: AppColors.textMedium,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: AppColors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
  },

  // Description
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: AppColors.textMedium,
    lineHeight: 22,
  },

  // Attendees
  attendeesList: {
    marginTop: 4,
  },
  attendeeItem: {
    alignItems: 'center',
    marginRight: 14,
    width: 52,
  },
  attendeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  attendeeAvatarFallback: {
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeInitial: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  attendeeAvatarMore: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeMoreText: {
    color: AppColors.textMedium,
    fontWeight: '700',
    fontSize: 12,
  },
  attendeeName: {
    fontSize: 10,
    color: AppColors.textMedium,
    textAlign: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  statPill: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: AppColors.textMedium,
    marginTop: 2,
  },

  // CTA bar
  ctaBar: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  registerBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  unregisterBtn: {
    backgroundColor: '#F3F4F6',
    shadowColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  registerBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  unregisterBtnText: {
    color: AppColors.textDark,
  },
  disabledRegisterBtn: {
    backgroundColor: '#E5E7EB',
    shadowColor: 'transparent',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    opacity: 0.7,
  },
  disabledRegisterBtnText: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  lockedCtaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  lockedCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedCtaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  lockedCtaSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  noMembersText: {
    fontSize: 13,
    color: AppColors.textLight,
    fontStyle: 'italic',
    marginVertical: 10,
  },
  membersContainer: {
    marginTop: 8,
    gap: 12,
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberAvatarFallback: {
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  creatorBadge: {
    backgroundColor: AppColors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  creatorBadgeText: {
    fontSize: 10,
    color: AppColors.primary,
    fontWeight: '700',
  },
  removeMemberBtn: {
    padding: 6,
  },
  adminCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 10,
    marginBottom: 16,
  },
  adminCardSub: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: AppColors.textDark,
    fontSize: 14,
  },
  clearSearchBtn: {
    marginLeft: 6,
  },
  searchResultsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 6,
    maxHeight: 150,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  searchResultEmail: {
    fontSize: 12,
    color: AppColors.textLight,
    marginTop: 1,
  },
  adminActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  adminBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addMemberBtn: {
    backgroundColor: AppColors.primary,
  },
  delegateBtn: {
    backgroundColor: '#0D9488',
  },
  adminBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  delegationsContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  delegationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  delegationTargetName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  delegationStatus: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  statusTextValue: {
    fontWeight: '700',
  },
  cancelDelBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelDelBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Report event ──
  reportEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  reportEventBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },

  // ── Comments Modal ──
  commentsSheet: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 80,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  commentsHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  commentsLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  commentsEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  commentsEmptyText: {
    color: AppColors.textMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  commentAvatarCol: { paddingTop: 2 },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentAvatarFallback: {
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  commentBubble: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  editedTag: {
    fontSize: 10,
    color: AppColors.textLight,
    fontStyle: 'italic',
  },
  commentContent: {
    fontSize: 14,
    color: AppColors.textDark,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  commentReactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  commentReactText: {
    fontSize: 14,
  },
  commentReactCount: {
    fontSize: 12,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  commentActionBtn: { paddingVertical: 2 },
  commentActionText: {
    fontSize: 12,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 11,
    color: AppColors.textLight,
    marginLeft: 'auto',
  },
  repliesToggle: {
    marginTop: 4,
    marginLeft: 4,
    paddingVertical: 2,
  },
  repliesToggleText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
  },
  replyItem: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginLeft: 12,
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  replyBubble: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderTopLeftRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 1,
  },
  replyContent: {
    fontSize: 13,
    color: AppColors.textDark,
    lineHeight: 18,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadMoreText: {
    color: AppColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  commentInputBar: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: 'white',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  commentReplyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.primary + '12',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  commentReplyBannerText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  commentTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textDark,
  },
  commentSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carShareCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  carShareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  carShareIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carShareInfo: {
    marginLeft: 12,
    flex: 1,
  },
  carShareTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  carShareDesc: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
    lineHeight: 16,
  },
  carShareBtn: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    gap: 8,
  },
  carShareBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Tab Switcher ──
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  tabTextActive: {
    color: AppColors.primary,
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Share Feed Post ──
  shareContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 8,
  },
  shareInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: AppColors.textDark,
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewContainer: {
    marginTop: 10,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    height: 180,
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewVideoOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  removePreviewBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  attachmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  postButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  postButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Post Card ──
  noPostsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  noPostsText: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  postAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  postAvatarText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  postAuthorInfo: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  postTime: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 1,
  },
  postBody: {
    fontSize: 14,
    color: AppColors.textDark,
    lineHeight: 20,
    marginBottom: 10,
  },
  postMedia: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  postActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  postActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
});

