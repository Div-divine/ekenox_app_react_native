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
  RefreshControl,
  Linking,
  TextInput,
  Modal,
  Animated,
  Platform,
  FlatList,
  Switch,
  SafeAreaView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { AssociationInviteModal } from './AssociationInviteModal';
import associationService, {
  Association,
  AssociationMember,
  AssociationEvent,
  JoinRequest,
  PendingInvitation,
  Role,
  AdminTransferDemand,
} from '../services/associationService';
import { UrlHelper } from '../utils/urlHelper';

const resolveUrl = (url?: string) => UrlHelper.convertPathToUrl(url);

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  ADMIN_ASSO: 'Administrator',
  SOUS_ADMIN_ASSO: 'Sub-Admin',
  COORD_ASSO: 'Coordinator',
  VOLUNTEER_ASSO: 'Volunteer',
  VIEWER_ASSO: 'Member',
};

const HEADER_HEIGHT = 240;

type RouteParams = { associationId: string | number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseSafeDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  if ((dateStr as any) instanceof Date) return dateStr as unknown as Date;
  let parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  const cleaned = String(dateStr).replace(' ', 'T');
  parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
};

const formatDate = (iso?: string) => {
  const d = parseSafeDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const formatEventDate = (start?: string, end?: string) => {
  const s = parseSafeDate(start);
  if (!s) return 'Date TBD';
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const getEventStatus = (start_time?: string, end_time?: string) => {
  if (!start_time) return { label: 'Upcoming', color: '#0D9488', bg: '#CCFAF6' };
  const now = Date.now();
  const sDate = parseSafeDate(start_time);
  const s = sDate ? sDate.getTime() : 0;
  const eDate = parseSafeDate(end_time);
  const e = eDate ? eDate.getTime() : s;
  if (now >= s && now <= e) return { label: 'Ongoing', color: '#10B981', bg: '#D1FAE5' };
  if (now < s) return { label: 'Upcoming', color: '#0D9488', bg: '#CCFAF6' };
  return { label: 'Past', color: '#6B7280', bg: '#F3F4F6' };
};

const getRoleBadge = (role?: string | null) => {
  switch (role) {
    case 'creator':
    case 'ADMIN_ASSO': return { label: 'Creator/Admin', color: '#7C3AED', bg: '#EDE9FE' };
    case 'admin': return { label: 'Admin', color: '#DC2626', bg: '#FEE2E2' };
    case 'SOUS_ADMIN_ASSO': return { label: 'Sub-Admin', color: '#D97706', bg: '#FEF3C7' };
    case 'moderator': return { label: 'Moderator', color: '#D97706', bg: '#FEF3C7' };
    case 'COORD_ASSO': return { label: 'Coordinator', color: '#2563EB', bg: '#DBEAFE' };
    case 'VOLUNTEER_ASSO': return { label: 'Volunteer', color: '#4F46E5', bg: '#EEF2FF' };
    case 'member':
    case 'MEMBRE_ASSO':
    case 'VIEWER_ASSO': return { label: 'Member', color: '#059669', bg: '#D1FAE5' };
    default: return null;
  }
};

const isAdmin = (role?: string | null) =>
  role === 'admin' || role === 'creator' || role === 'moderator' || role === 'ADMIN_ASSO' || role === 'SOUS_ADMIN_ASSO';

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({ icon, label, value, onPress }: { icon: any; label: string; value?: string; onPress?: () => void }) => {
  if (!value) return null;
  return (
    <TouchableOpacity style={s.infoRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={s.infoIconBox}>
        <Ionicons name={icon} size={16} color={AppColors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, onPress && { color: AppColors.primary }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={14} color={AppColors.textLight} />}
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const AssociationDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ AssociationDetail: RouteParams }, 'AssociationDetail'>>();
  const insets = useSafeAreaInsets();
  const { associationId } = route.params;
  const { user: currentUser } = useAuth();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [HEADER_HEIGHT - 80, HEADER_HEIGHT - 30],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const [assoc, setAssoc] = useState<Association | null>(null);
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [events, setEvents] = useState<AssociationEvent[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [pendingTransfers, setPendingTransfers] = useState<AdminTransferDemand[]>([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [transferHistory, setTransferHistory] = useState<AdminTransferDemand[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'members'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);

  // Invite modal
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');

  // New states for invitations & moderation
  const [inviteEmail, setInviteEmail] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<any[]>([]);
  const [rolePickerIndex, setRolePickerIndex] = useState<number | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersHasMore, setUsersHasMore] = useState(true);

  // Member Options states
  const [memberOptionsVisible, setMemberOptionsVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<AssociationMember | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [changeRoleModalVisible, setChangeRoleModalVisible] = useState(false);
  const [selectedMemberRole, setSelectedMemberRole] = useState<Role | null>(null);
  const [removeMemberModalVisible, setRemoveMemberModalVisible] = useState(false);
  const [removalReason, setRemovalReason] = useState('');

  // Admin Transfer modal states
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [transferSearchResults, setTransferSearchResults] = useState<any[]>([]);
  const [transferSearchLoading, setTransferSearchLoading] = useState(false);
  const [transferUsersPage, setTransferUsersPage] = useState(1);
  const [transferUsersHasMore, setTransferUsersHasMore] = useState(true);
  const [transferSelectedUser, setTransferSelectedUser] = useState<any | null>(null);
  const [transferManualEmail, setTransferManualEmail] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Header settings context menu
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);

  // Report modal states
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  // Join message modal
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');

  // Extended Join Settings states
  const [joinFormConfig, setJoinFormConfig] = useState<any | null>(null);
  const [portfolioLink, setPortfolioLink] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [resumeSelected, setResumeSelected] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  const isJoinFormValid = () => {
    if (joinFormConfig?.require_motif && !joinMessage.trim()) return false;
    if (joinFormConfig?.enable_resume_upload && !resumeSelected) return false;
    if (joinFormConfig?.enable_portfolio_links && !portfolioLink.trim()) return false;
    if (joinFormConfig?.enable_preferred_role && !preferredRole) return false;
    return true;
  };

  // Association settings states
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'requests' | 'responses'>('requests');
  const [newRegion, setNewRegion] = useState('');
  const [requestSettings, setRequestSettings] = useState<any>({
    require_motif: false,
    motif_prompt: '',
    enable_resume_upload: false,
    enable_portfolio_links: false,
    enable_preferred_role: false,
    auto_response_on_received: false,
    auto_response_on_accepted: false,
    auto_response_on_declined: false,
    auto_accept_mutual_friends: false,
    restricted_to_regions: false,
    allowed_regions: []
  });
  const [autoResponses, setAutoResponses] = useState<any[]>([]);
  const [personalizationPlaceholders, setPersonalizationPlaceholders] = useState<any[]>([]);
  const [activeResponseEditor, setActiveResponseEditor] = useState<string | null>(null); // 'request_received', 'request_accepted', 'request_declined'
  const [editingSubject, setEditingSubject] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [editingEnabled, setEditingEnabled] = useState(true);
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body'>('body');

  // Create event states
  const [createEventVisible, setCreateEventVisible] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventMaxAttendees, setEventMaxAttendees] = useState('');
  const [eventType, setEventType] = useState<'online' | 'in_person'>('in_person');

  const loadAssociation = useCallback(async () => {
    try {
      const data = await associationService.getAssociationById(associationId);
      if (data) setAssoc(data);
      else Alert.alert('Error', 'Association not found.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load association.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [associationId]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await associationService.getMembers(associationId);
      setMembers(data);
      setMembersLoaded(true);
    } catch { }
  }, [associationId]);

  const loadEvents = useCallback(async () => {
    try {
      const [ongoing, upcoming] = await Promise.all([
        associationService.getOngoingEvents(associationId),
        associationService.getUpcomingEvents(associationId),
      ]);
      const combined = [...ongoing, ...upcoming.filter(e => !ongoing.find(o => o.id === e.id))];
      setEvents(combined);
      setEventsLoaded(true);
    } catch { }
  }, [associationId]);

  const loadJoinRequests = useCallback(async () => {
    try {
      const [reqs, count] = await Promise.all([
        associationService.getJoinRequests(associationId),
        associationService.countPendingRequests(associationId),
      ]);
      setJoinRequests(reqs);
      setPendingCount(count);
      setRequestsLoaded(true);
    } catch { }
  }, [associationId]);

  const loadPendingTransfers = useCallback(async () => {
    try {
      const data = await associationService.getPendingAdminTransfers();
      setPendingTransfers(data);
    } catch (e) {
      console.log('Failed to load pending transfers:', e);
    }
  }, []);

  const fetchAndShowHistory = async () => {
    setHistoryLoading(true);
    setHistoryModalVisible(true);
    try {
      const data = await associationService.getAdminTransferHistory(associationId);
      setTransferHistory(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load transfer history.');
      setHistoryModalVisible(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Helper to search users for invitations
  const searchUsersForInvitation = async (queryText: string, resetPage = true) => {
    const pageToLoad = resetPage ? 1 : usersPage;
    setUsersLoading(true);
    try {
      const res = await associationService.getPaginatedUsers({
        q: queryText ? queryText.toLowerCase() : undefined,
        page: pageToLoad,
        limit: 10
      });
      if (resetPage) {
        setSearchResults(res.data);
        setUsersPage(2);
      } else {
        setSearchResults(prev => [...prev, ...res.data]);
        setUsersPage(p => p + 1);
      }
      setUsersHasMore(res.data.length === 10);
    } catch (e: any) {
      console.error('Failed to search users:', e.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadMoreUsers = () => {
    if (!usersLoading && usersHasMore) {
      searchUsersForInvitation(userSearchQuery, false);
    }
  };

  // ── Transfer Admin helpers ────────────────────────────────────────────────────

  const searchUsersForTransfer = async (queryText: string, resetPage = true) => {
    const pageToLoad = resetPage ? 1 : transferUsersPage;
    setTransferSearchLoading(true);
    try {
      const res = await associationService.getPaginatedUsers({
        q: queryText ? queryText.toLowerCase() : undefined,
        page: pageToLoad,
        limit: 10,
      });
      if (resetPage) {
        setTransferSearchResults(res.data);
        setTransferUsersPage(2);
      } else {
        setTransferSearchResults(prev => [...prev, ...res.data]);
        setTransferUsersPage(p => p + 1);
      }
      setTransferUsersHasMore(res.data.length === 10);
    } catch (e: any) {
      console.error('Transfer user search failed:', e.message);
    } finally {
      setTransferSearchLoading(false);
    }
  };

  const loadMoreTransferUsers = () => {
    if (!transferSearchLoading && transferUsersHasMore) {
      searchUsersForTransfer(transferSearchQuery, false);
    }
  };

  const openTransferModal = () => {
    setTransferSearchQuery('');
    setTransferSearchResults([]);
    setTransferSelectedUser(null);
    setTransferManualEmail('');
    setTransferUsersPage(1);
    setTransferUsersHasMore(true);
    setTransferModalVisible(true);
    searchUsersForTransfer('', true);
  };

  const handleSubmitTransfer = async () => {
    // Must have either a selected user OR a manual email
    const email = transferSelectedUser?.email || transferManualEmail.trim();
    if (!email) {
      Alert.alert('Required', 'Please select a user from the list or enter an email address.');
      return;
    }
    if (!transferSelectedUser && transferManualEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(transferManualEmail.trim())) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
    }
    Alert.alert(
      'Confirm Transfer',
      `Send an admin transfer request to ${transferSelectedUser?.full_name || email}?\n\nThey will receive a notification and email asking them to become the new administrator.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            try {
              setTransferSubmitting(true);
              await associationService.initiateAdminTransfer(
                associationId,
                email,
                transferSelectedUser?.id
              );
              setTransferModalVisible(false);
              Alert.alert(
                '✅ Request Sent',
                `The admin transfer request has been sent to ${transferSelectedUser?.full_name || email}.`
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to initiate transfer.');
            } finally {
              setTransferSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleFollowMember = async (member: AssociationMember) => {
    const userId = member.user?.id;
    const fullName = member.user?.full_name || '?';
    if (!userId) return;
    try {
      const currentlyFollowing = member.is_following;
      if (currentlyFollowing) {
        await associationService.unfollowUser(userId);
        Alert.alert('Unfollowed', `You have unfollowed ${fullName}.`);
      } else {
        await associationService.followUser(userId);
        Alert.alert('Followed', `You are now following ${fullName}.`);
      }
      setMembers(prev => prev.map(m => m.user?.id === userId ? { ...m, is_following: !currentlyFollowing } : m));
      setSelectedMember(prev => prev ? { ...prev, is_following: !currentlyFollowing } : null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to toggle follow status.');
    }
  };

  const handleMessageMember = async (member: AssociationMember) => {
    const userId = member.user?.id;
    const fullName = member.user?.full_name || '?';
    const avatar = member.user?.profile_image;
    if (!userId) return;
    try {
      setActionLoading(true);
      const chatRoom = await associationService.getOrCreateDirectChat(userId);
      if (chatRoom && chatRoom.id) {
        setMemberOptionsVisible(false);
        navigation.navigate('ChatRoom', {
          chatRoomId: chatRoom.id,
          name: fullName,
          logo: avatar,
        });
      } else {
        Alert.alert('Error', 'Failed to open chat room.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to open chat room.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    if (!assoc) return;
    try {
      await Share.share({
        message: `Check out ${assoc.name} on EkeNox!`,
      });
      setHeaderMenuVisible(false);
    } catch (e: any) {
      console.error('Error sharing:', e.message);
    }
  };

  const handleToggleMute = async () => {
    if (!assoc) return;
    try {
      const isMuted = await associationService.toggleMuteNotifications(associationId);
      setAssoc(prev => prev ? { ...prev, is_muted: isMuted } : null);
      setHeaderMenuVisible(false);
      Alert.alert('Success', isMuted ? 'Notifications muted.' : 'Notifications unmuted.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to toggle notifications.');
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason) {
      Alert.alert('Required', 'Please select a reason.');
      return;
    }
    try {
      await associationService.reportAssociation(associationId, reportReason, reportDescription);
      Alert.alert('Report Submitted', 'Thank you for reporting. We will review this association.');
      setReportModalVisible(false);
      setReportReason('');
      setReportDescription('');
      setHeaderMenuVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit report.');
    }
  };

  const handleLeave = () => {
    if (!assoc) return;
    setHeaderMenuVisible(false);
    Alert.alert(
      'Leave Association',
      `Are you sure you want to leave ${assoc.name}? \n\nImplications:\n• You will lose your role (${ROLE_DISPLAY_NAMES[assoc.current_user_role || ''] || assoc.current_user_role || 'Member'}).\n• You will lose access to the association chat room.\n• You will need to submit a new join request to return.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await associationService.leaveAssociation(associationId);
              Alert.alert('Left Association', `You have successfully left ${assoc.name}.`);
              loadAssociation();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to leave association.');
            }
          }
        }
      ]
    );
  };

  const handleChangeMemberRole = async () => {
    if (!selectedMember || !selectedMemberRole) return;
    const userId = selectedMember.user?.id;
    if (!userId) return;
    try {
      setActionLoading(true);
      await associationService.changeMemberRole(associationId, userId, selectedMemberRole.id);
      setMembers(prev => prev.map(m => m.user?.id === userId ? { ...m, role: { name: selectedMemberRole.name } } : m));
      setChangeRoleModalVisible(false);
      Alert.alert('Success', 'Member role updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change role.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMemberConfirm = async () => {
    if (!selectedMember) return;
    const userId = selectedMember.user?.id;
    const fullName = selectedMember.user?.full_name || '?';
    if (!userId) return;
    try {
      setActionLoading(true);
      await associationService.removeMember(associationId, userId);
      setMembers(prev => prev.filter(m => m.user?.id !== userId));
      setRemoveMemberModalVisible(false);
      setRemovalReason('');
      Alert.alert('Removed', `${fullName} has been removed.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove member.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (inviteVisible) {
      setUserSearchQuery('');
      setSelectedInvitees([]);
      setRolePickerIndex(null);
      setInviteEmail('');
      setInviteMessage('');
      searchUsersForInvitation('', true);
    }
  }, [inviteVisible]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const rolesList = await associationService.getRoles();
        setAvailableRoles(rolesList);
        // Find default Member role VIEWER_ASSO
        const defaultRole = rolesList.find(r => r.name === 'VIEWER_ASSO');
        if (defaultRole) {
          setInviteRoleId(String(defaultRole.id));
        } else if (rolesList.length > 0) {
          setInviteRoleId(String(rolesList[0].id));
        }
      } catch (err) {
        console.error('Failed to fetch association roles:', err);
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAssociation();
      loadJoinRequests();
      loadEvents();
      loadMembers();
      loadPendingTransfers();
    });
    return unsubscribe;
  }, [navigation, loadAssociation, loadJoinRequests, loadEvents, loadMembers, loadPendingTransfers]);

  useEffect(() => {
    if (activeTab === 'members' && !membersLoaded) loadMembers();
    if (activeTab === 'events' && !eventsLoaded) loadEvents();
  }, [activeTab]);

  useEffect(() => {
    if (settingsVisible && assoc) {
      const loadSettingsData = async () => {
        try {
          const reqSettings = await associationService.getRequestSettings(assoc.id);
          setRequestSettings(reqSettings);

          const templates = await associationService.getAutoResponses(assoc.id);
          setAutoResponses(templates);

          const placeholders = await associationService.getPlaceholders(assoc.id);
          setPersonalizationPlaceholders(placeholders);
        } catch (e: any) {
          Alert.alert('Error', 'Failed to load settings data: ' + e.message);
        }
      };
      loadSettingsData();
    }
  }, [settingsVisible, assoc]);

  const onRefresh = () => {
    setRefreshing(true);
    setMembersLoaded(false);
    setEventsLoaded(false);
    setRequestsLoaded(false);
    loadAssociation();
    loadPendingTransfers();
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleFollow = async () => {
    if (!assoc) return;
    try {
      const isFav = await associationService.toggleFavorite(assoc.id);
      Alert.alert(isFav ? '⭐ Following' : 'Unfollowed', isFav ? 'You are now following this association.' : 'You unfollowed this association.');
      // Toggle locally
      setAssoc(prev => prev ? { ...prev, is_favorited: isFav } : null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update follow status.');
    }
  };

  const handleJoinPress = async () => {
    if (!assoc) return;
    setActionLoading(true);
    try {
      const config = await associationService.getJoinFormConfig(assoc.id);
      setJoinFormConfig(config);

      // Check if any specific options are required
      const hasMotif = config.require_motif;
      const hasResume = config.enable_resume_upload;
      const hasPortfolio = config.enable_portfolio_links;
      const hasRole = config.enable_preferred_role;

      if (!hasMotif && !hasResume && !hasPortfolio && !hasRole) {
        // Submit instantly if no form config fields are enabled
        await handleJoinSubmit(undefined, {});
      } else {
        setJoinModalVisible(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch join configurations.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinSubmit = async (message?: string, payload?: any) => {
    if (!assoc) return;
    setActionLoading(true);
    try {
      await associationService.requestJoin(assoc.id, message, payload);
      Alert.alert('✅ Request Sent', 'Your join request has been submitted.');
      setJoinModalVisible(false);
      setJoinMessage('');
      setPortfolioLink('');
      setPreferredRole('');
      setResumeSelected(false);
      loadAssociation();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send join request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!assoc) return;
    setActionLoading(true);
    try {
      await associationService.cancelJoinRequest(assoc.id);
      Alert.alert('Cancelled', 'Your join request has been cancelled.');
      loadAssociation();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!assoc?.chat_room) return; // invitation id would come from assoc
    // For now accept via pending invitations
    Alert.alert('Accept Invitation', 'This will accept the invitation and add you as a member.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          // Accept the first pending invitation related to this association
          try {
            const invitations = await associationService.getMyPendingInvitations();
            const inv = invitations.find(i => String(i.association?.id) === String(assoc.id));
            if (inv) {
              await associationService.acceptInvitation(inv.id);
              Alert.alert('🎉 Joined!', `You are now a member of "${assoc.name}".`);
              loadAssociation();
            }
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleApproveRequest = async (req: JoinRequest) => {
    try {
      await associationService.approveJoinRequest(associationId, req.id);
      Alert.alert('Approved', `${req.user?.full_name} has been approved.`);
      loadJoinRequests();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleRejectRequest = async (req: JoinRequest) => {
    try {
      await associationService.rejectJoinRequest(associationId, req.id);
      Alert.alert('Rejected', 'Join request rejected.');
      loadJoinRequests();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleRemoveMember = (member: AssociationMember) => {
    const userId = member.user?.id;
    const fullName = member.user?.full_name || '?';
    if (!userId) return;
    Alert.alert('Remove Member', `Remove ${fullName} from this association?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await associationService.removeMember(associationId, userId);
            setMembers(prev => prev.filter(m => m.id !== member.id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  // ── Render States ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={s.loadingText}>Loading association...</Text>
      </View>
    );
  }

  if (!assoc) {
    return (
      <View style={s.centered}>
        <Ionicons name="alert-circle-outline" size={60} color={AppColors.textLight} />
        <Text style={s.emptyTitle}>Association not found</Text>
        <TouchableOpacity style={s.backActionBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backActionText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const role = assoc.current_user_role;
  const isMember = !!role;
  const hasPendingRequest = assoc.has_pending_join_request;
  const hasPendingInvitation = assoc.has_pending_invitation;
  const roleBadge = getRoleBadge(role);

  // ── Tabs Content ─────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <View style={s.tabContent}>
      {/* Pending invitation banner */}
      {hasPendingInvitation && !isMember && (
        <TouchableOpacity style={s.invitationBanner} onPress={handleAcceptInvitation} activeOpacity={0.85}>
          <Ionicons name="mail-open-outline" size={20} color="#1D4ED8" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.invitationBannerTitle}>You have a pending invitation!</Text>
            <Text style={s.invitationBannerSub}>Tap to accept and join this association</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
        </TouchableOpacity>
      )}

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statVal}>{assoc.member_count}</Text>
          <Text style={s.statLabel}>Members</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>{assoc.event_count}</Text>
          <Text style={s.statLabel}>Events</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>{(assoc.average_rating || 0).toFixed(1)}</Text>
          <Text style={s.statLabel}>Rating</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>{assoc.share_count}</Text>
          <Text style={s.statLabel}>Shares</Text>
        </View>
      </View>

      {/* Admin Section */}
      {isAdmin(role) && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Administration</Text>

          <TouchableOpacity style={s.adminAction} onPress={() => navigation.navigate('CreateAssociation', { associationId: assoc.id, association: assoc })}>
            <View style={[s.adminActionIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="pencil-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={s.adminActionText}>Edit Association</Text>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={s.adminAction} onPress={() => navigation.navigate('JoinRequests', { associationId: assoc.id, associationName: assoc.name })}>
            <View style={[s.adminActionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="people-outline" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.adminActionText}>Manage Join Requests</Text>
              {pendingCount > 0 && (
                <Text style={s.adminActionSub}>{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={s.adminAction} onPress={() => setInviteVisible(true)}>
            <View style={[s.adminActionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="person-add-outline" size={18} color="#059669" />
            </View>
            <Text style={s.adminActionText}>Invite Members</Text>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.adminAction}
            onPress={() => navigation.navigate('CreateEvent', {
              associationId: assoc.id,
              associationName: assoc.name,
              onSuccess: () => {
                loadEvents();
              }
            })}
          >
            <View style={[s.adminActionIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="calendar-outline" size={18} color="#0284C7" />
            </View>
            <Text style={s.adminActionText}>Create Event</Text>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
          </TouchableOpacity>
        </View>
      )}



      {/* Transfer History option */}
      {(isMember || pendingTransfers.some(d => String(d.association?.id) === String(assoc.id))) && (
        <View style={s.card}>
          <Text style={s.cardTitle}>History</Text>
          <TouchableOpacity style={s.adminAction} onPress={fetchAndShowHistory}>
            <View style={[s.adminActionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="time-outline" size={18} color="#2563EB" />
            </View>
            <Text style={s.adminActionText}>Administrative Transfer History</Text>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {/* Description */}
      <View style={s.card}>
        <Text style={s.cardTitle}>About</Text>
        <Text style={s.cardText}>{assoc.description || 'No description available.'}</Text>
      </View>

      {/* Mission */}
      {assoc.mission && (
        <View style={[s.card, s.missionCard]}>
          <View style={s.missionHeader}>
            <Ionicons name="flag" size={16} color={AppColors.primary} />
            <Text style={s.missionTitle}>Our Mission</Text>
          </View>
          <Text style={s.missionText}>{assoc.mission}</Text>
        </View>
      )}

      {/* What they do */}
      {assoc.what_they_do && (
        <View style={s.card}>
          <Text style={s.cardTitle}>What We Do</Text>
          <Text style={s.cardText}>{assoc.what_they_do}</Text>
        </View>
      )}

      {/* Focus areas */}
      {assoc.focus_areas?.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Focus Areas</Text>
          <View style={s.chipRow}>
            {assoc.focus_areas.map((area, i) => (
              <View key={i} style={s.focusChip}>
                <Text style={s.focusChipText}>{area}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Achievements */}
      {assoc.achievements?.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Achievements</Text>
          {assoc.achievements.map((a, i) => (
            <View key={i} style={s.achievementRow}>
              <Ionicons name="checkmark-circle" size={16} color={AppColors.primary} />
              <Text style={s.achievementText}>{a}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Contact & Links */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Contact & Links</Text>
        <InfoRow icon="mail-outline" label="Email" value={assoc.email} onPress={() => Linking.openURL(`mailto:${assoc.email}`)} />
        <InfoRow icon="call-outline" label="Phone" value={assoc.phone_number} onPress={() => Linking.openURL(`tel:${assoc.phone_number}`)} />
        <InfoRow icon="globe-outline" label="Website" value={assoc.website} onPress={() => assoc.website && Linking.openURL(assoc.website)} />
        <InfoRow icon="location-outline" label="Address" value={assoc.address} />
        {assoc.established_date && <InfoRow icon="calendar-outline" label="Established" value={formatDate(assoc.established_date)} />}
      </View>

      {/* Social Media */}
      {assoc.social_media && Object.keys(assoc.social_media).length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Social Media</Text>
          {Object.entries(assoc.social_media).map(([platform, url]) => (
            <InfoRow
              key={platform}
              icon={`logo-${platform.toLowerCase()}` as any}
              label={platform.charAt(0).toUpperCase() + platform.slice(1)}
              value={url}
              onPress={() => Linking.openURL(url)}
            />
          ))}
        </View>
      )}

      {/* Creator */}
      {assoc.creator && (
        <View style={s.creatorCard}>
          <View style={s.creatorAvatar}>
            <Ionicons name="person" size={18} color={AppColors.primary} />
          </View>
          <View>
            <Text style={s.creatorLabel}>Founded by</Text>
            <Text style={s.creatorName}>{assoc.creator.full_name}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEvents = () => (
    <View style={s.tabContent}>
      {/* ── Create Event Bar for Association Admins ── */}
      {isAdmin(role) && assoc && (
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
            associationId: assoc.id,
            associationName: assoc.name,
            onSuccess: () => loadEvents(),
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
            Organize an eco event for {assoc.name}…
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

      {!eventsLoaded ? (
        <View style={s.centeredTab}>
          <ActivityIndicator color={AppColors.primary} size="large" />
          <Text style={s.centeredTabText}>Loading events...</Text>
        </View>
      ) : events.length === 0 ? (
        <View style={s.centeredTab}>
          <Ionicons name="calendar-outline" size={48} color={AppColors.textLight} />
          <Text style={s.emptyTabText}>No events yet for this association.</Text>
        </View>
      ) : (
        events.map((event, idx) => {
          const status = getEventStatus(event.start_time, event.end_time);
          return (
            <TouchableOpacity
              key={event.id ? String(event.id) : `event-${idx}`}
              style={s.eventCard}
              onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
              activeOpacity={0.85}
            >
              {event.banner_image ? (
                <Image source={{ uri: resolveUrl(event.banner_image) }} style={s.eventBanner} />
              ) : (
                <View style={[s.eventBanner, s.eventBannerPlaceholder]}>
                  <Ionicons name="calendar" size={32} color={AppColors.textLight} />
                </View>
              )}
              <View style={[s.eventStatusBadge, { backgroundColor: status.bg }]}>
                <Text style={[s.eventStatusText, { color: status.color }]}>{status.label}</Text>
              </View>
              <View style={s.eventCardBody}>
                <Text style={s.eventTitle}>{event.title}</Text>
                {event.description ? (
                  <Text style={s.eventDesc} numberOfLines={2}>{event.description}</Text>
                ) : null}
                <View style={s.eventMeta}>
                  <Ionicons name="calendar-outline" size={13} color={AppColors.textMedium} />
                  <Text style={s.eventMetaText}>{formatEventDate(event.start_time)}</Text>
                </View>
                <View style={s.eventMeta}>
                  <Ionicons name="location-outline" size={13} color={AppColors.textMedium} />
                  <Text style={s.eventMetaText} numberOfLines={1}>{event.location}</Text>
                </View>
                <View style={s.eventMeta}>
                  <Ionicons name="people-outline" size={13} color={AppColors.textMedium} />
                  <Text style={s.eventMetaText}>{event.registration_count} attending</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );


  const renderMembers = () => (
    <View style={s.tabContent}>
      {!membersLoaded ? (
        <View style={s.centeredTab}>
          <ActivityIndicator color={AppColors.primary} size="large" />
          <Text style={s.centeredTabText}>Loading members...</Text>
        </View>
      ) : members.length === 0 ? (
        <View style={s.centeredTab}>
          <Ionicons name="people-outline" size={48} color={AppColors.textLight} />
          <Text style={s.emptyTabText}>No members to display.</Text>
        </View>
      ) : (
        members.map((member, idx) => {
          const roleName = member.role?.name || '';
          const badge = getRoleBadge(roleName);
          const fullName = member.user?.full_name || '?';
          const email = member.user?.email || '';
          const avatar = member.user?.profile_image;
          const isCurrentUser = String(member.user?.id) === String(currentUser?.id);
          const currentUserIsAdmin = role === 'ADMIN_ASSO';

          return (
            <View key={member.id ? String(member.id) : `member-${idx}`} style={s.memberCard}>
              {avatar ? (
                <Image source={{ uri: resolveUrl(avatar) }} style={s.memberAvatar} />
              ) : (
                <View style={[s.memberAvatar, s.memberAvatarPlaceholder]}>
                  <Text style={s.memberAvatarInitial}>{fullName[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.memberName}>{fullName}{isCurrentUser ? ' (You)' : ''}</Text>
                <Text style={s.memberEmail}>{email}</Text>
              </View>
              {badge && (
                <View style={[s.roleBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[s.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              )}
              {/* Admin's OWN card: show transfer icon */}
              {isCurrentUser && currentUserIsAdmin && (
                <TouchableOpacity
                  style={[s.removeMemberBtn, { backgroundColor: '#EDE9FE', borderRadius: 8, padding: 6 }]}
                  onPress={openTransferModal}
                >
                  <Ionicons name="swap-horizontal-outline" size={20} color="#7C3AED" />
                </TouchableOpacity>
              )}
              {/* Other members: always show 3-dots */}
              {!isCurrentUser && (
                <TouchableOpacity
                  style={s.removeMemberBtn}
                  onPress={() => {
                    setSelectedMember(member);
                    const memberRoleObj = availableRoles.find(r => r.name === roleName);
                    if (memberRoleObj) setSelectedMemberRole(memberRoleObj);
                    setMemberOptionsVisible(true);
                  }}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={AppColors.textMedium} />
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );

  // ── Main Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[s.container]}>
      {/* Animated sticky header */}
      <Animated.View style={[s.stickyHeader, { paddingTop: insets.top, opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.stickyBackBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={s.stickyTitle} numberOfLines={1}>{assoc.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isAdmin(role) && (
            <TouchableOpacity style={[s.stickyFollowBtn, { marginRight: 4 }]} onPress={() => setSettingsVisible(true)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="settings-outline" size={20} color={AppColors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.stickyFollowBtn, { marginRight: 4 }]} onPress={handleFollow} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name={assoc.is_favorited ? 'star' : 'star-outline'} size={20} color={assoc.is_favorited ? '#F59E0B' : AppColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.stickyFollowBtn} onPress={() => setHeaderMenuVisible(true)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="ellipsis-vertical" size={20} color={AppColors.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* ── Hero Banner ── */}
        <View style={s.heroWrapper}>
          {assoc.profile_image ? (
            <Image source={{ uri: resolveUrl(assoc.profile_image) }} style={s.heroBanner} resizeMode="cover" />
          ) : (
            <View style={[s.heroBanner, s.heroBannerPlaceholder]}>
              <Ionicons name="leaf" size={48} color="white" opacity={0.5} />
            </View>
          )}
          <View style={s.heroBannerOverlay} />
          <View style={[s.heroFloatingRow, { top: insets.top + 10 }]}>
            <TouchableOpacity style={s.heroFloatBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {isAdmin(role) && (
                <TouchableOpacity style={s.heroFloatBtn} onPress={() => setSettingsVisible(true)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                  <Ionicons name="settings-outline" size={20} color="white" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.heroFloatBtn} onPress={handleFollow} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <Ionicons name={assoc.is_favorited ? 'star' : 'star-outline'} size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroFloatBtn} onPress={() => setHeaderMenuVisible(true)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <Ionicons name="ellipsis-vertical" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
          {assoc.is_verified && (
            <View style={s.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#1D4ED8" />
              <Text style={s.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        {/* ── Identity Card ── */}
        <View style={s.identityCard}>
          <View style={s.identityRow}>
            {/* Logo */}
            {assoc.logo_image ? (
              <Image source={{ uri: resolveUrl(assoc.logo_image) }} style={s.logoImg} />
            ) : (
              <View style={s.logoPlaceholder}>
                <Ionicons name="business" size={22} color={AppColors.primary} />
              </View>
            )}

            {/* Name + category */}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={s.assocName}>{assoc.name}</Text>
                {assoc.is_verified && (
                  <Ionicons name="checkmark-circle" size={18} color="#1D4ED8" style={{ marginLeft: 4 }} />
                )}
              </View>
              <View style={s.categoryBadge}>
                <Text style={s.categoryBadgeText}>{assoc.category}</Text>
              </View>
              {roleBadge && (
                <View style={[s.myRoleBadge, { backgroundColor: roleBadge.bg }]}>
                  <Text style={[s.myRoleBadgeText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tagline */}
          {assoc.short_tagline ? (
            <Text style={s.tagline}>{assoc.short_tagline}</Text>
          ) : null}

          {/* Private badge */}
          {assoc.is_private && (
            <View style={s.privateBadge}>
              <Ionicons name="lock-closed" size={12} color="#6B7280" />
              <Text style={s.privateBadgeText}>Private Association</Text>
            </View>
          )}

          {/* ── Action Buttons ── */}
          <View style={s.actionsRow}>
            {/* Favorite (Follow) */}
            {/* <TouchableOpacity style={s.followBtn} onPress={handleFollow}>
              <Ionicons
                name={assoc.is_favorited ? 'star' : 'star-outline'}
                size={16}
                color={assoc.is_favorited ? '#F59E0B' : AppColors.primary}
              />
              <Text style={[s.followBtnText, assoc.is_favorited && { color: '#F59E0B' }]}>
                {assoc.is_favorited ? 'Favorited' : 'Favorite'}
              </Text>
            </TouchableOpacity> */}

            {/* Chat Room (If member) */}
            {isMember && assoc.chat_room && (
              <TouchableOpacity
                style={[s.followBtn, { backgroundColor: AppColors.primary, borderColor: AppColors.primary }]}
                onPress={() => navigation.navigate('ChatRoom', {
                  chatRoomId: assoc.chat_room!.id,
                  name: assoc.name,
                  logo: assoc.logo_image,
                })}
              >
                <Ionicons name="chatbubbles-outline" size={16} color="white" />
                <Text style={[s.followBtnText, { color: 'white' }]}>Chat</Text>
              </TouchableOpacity>
            )}

            {/* Membership CTA */}
            {hasPendingInvitation && !isMember ? (
              <TouchableOpacity style={s.ctaBtn} onPress={handleAcceptInvitation} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="white" /> : (
                  <>
                    <Ionicons name="mail-open-outline" size={16} color="white" />
                    <Text style={s.ctaBtnText}>Accept Invitation</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : isMember ? (
              <TouchableOpacity style={[s.ctaBtn, s.leaveBtn]} onPress={handleLeave} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color={AppColors.error} /> : (
                  <>
                    <Ionicons name="exit-outline" size={16} color={AppColors.error} />
                    <Text style={[s.ctaBtnText, { color: AppColors.error }]}>Leave</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : hasPendingRequest ? (
              <TouchableOpacity style={[s.ctaBtn, s.pendingBtn]} onPress={handleCancelRequest} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#D97706" /> : (
                  <>
                    <Ionicons name="hourglass-outline" size={16} color="#D97706" />
                    <Text style={[s.ctaBtnText, { color: '#D97706' }]}>Cancel Request</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.ctaBtn}
                onPress={handleJoinPress}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator size="small" color="white" /> : (
                  <>
                    <Ionicons name="add-circle-outline" size={16} color="white" />
                    <Text style={s.ctaBtnText}>Join</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabBar}>
          {(['overview', 'events', 'members'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>
                {tab === 'overview' ? 'Overview' : tab === 'events' ? `Events (${events.length})` : `Members (${assoc.member_count ?? members.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Content ── */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'events' && renderEvents()}
        {activeTab === 'members' && renderMembers()}
      </Animated.ScrollView>

      {/* ── Join Message Modal ── */}
      <Modal visible={joinModalVisible} animationType="slide" transparent onRequestClose={() => setJoinModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Join {assoc.name}</Text>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350, marginVertical: 8 }}>
              {/* Region Restriction Note */}
              {joinFormConfig?.restricted_to_regions && joinFormConfig?.allowed_regions?.length > 0 && (
                <View style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309', textTransform: 'uppercase' }}>restricted region notice</Text>
                  <Text style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>
                    This association restricts joins to: {joinFormConfig.allowed_regions.join(', ')}
                  </Text>
                </View>
              )}

              {/* Motif Text Area */}
              {joinFormConfig?.require_motif && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>
                    {joinFormConfig.motif_prompt || 'Reason for joining (Motif)'} *
                  </Text>
                  <TextInput
                    style={s.modalInput}
                    value={joinMessage}
                    onChangeText={setJoinMessage}
                    placeholder="Why would you like to join?"
                    placeholderTextColor={AppColors.textLight}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Preferred Role Chips */}
              {joinFormConfig?.enable_preferred_role && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>
                    Preferred Role *
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {availableRoles.map(role => (
                      <TouchableOpacity
                        key={role.id}
                        style={[
                          s.roleChip,
                          preferredRole === String(role.id) && s.roleChipActive
                        ]}
                        onPress={() => setPreferredRole(String(role.id))}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          s.roleChipText,
                          preferredRole === String(role.id) && s.roleChipTextActive
                        ]}>
                          {role.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Portfolio Link Input */}
              {joinFormConfig?.enable_portfolio_links && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>
                    Portfolio / Website Link *
                  </Text>
                  <TextInput
                    style={[s.modalInput, { height: 44, paddingVertical: 10 }]}
                    value={portfolioLink}
                    onChangeText={setPortfolioLink}
                    placeholder="https://example.com"
                    placeholderTextColor={AppColors.textLight}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              )}

              {/* Resume Checkbox */}
              {joinFormConfig?.enable_resume_upload && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, gap: 8 }}
                  activeOpacity={0.8}
                  onPress={() => setResumeSelected(!resumeSelected)}
                >
                  <Ionicons
                    name={resumeSelected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={resumeSelected ? AppColors.primary : AppColors.textMedium}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: AppColors.textDark }}>
                    Attach my Ekenox resume / profile document *
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                s.ctaBtn,
                { width: '100%', marginTop: 12 },
                !isJoinFormValid() && { backgroundColor: AppColors.textLight, borderColor: AppColors.textLight }
              ]}
              onPress={() => {
                if (!isJoinFormValid()) return;
                const payload: any = {};
                if (joinFormConfig?.enable_resume_upload && resumeSelected) {
                  payload.resume_url = 'attached_resume.pdf';
                }
                if (joinFormConfig?.enable_preferred_role && preferredRole) {
                  payload.preferred_role_id = Number(preferredRole);
                }
                if (joinFormConfig?.enable_portfolio_links && portfolioLink) {
                  payload.portfolio_links = [portfolioLink];
                }

                handleJoinSubmit(joinMessage || undefined, payload);
              }}
              disabled={actionLoading || !isJoinFormValid()}
            >
              {actionLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.ctaBtnText}>Send Join Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Invite Members Modal ── */}
      <AssociationInviteModal
        visible={inviteVisible}
        associationId={assoc.id}
        associationName={assoc.name}
        onClose={() => setInviteVisible(false)}
        onSuccess={() => {
          loadAssociation();
        }}
      />

      {/* ── Admin Transfer Modal ── */}
      <Modal
        visible={transferModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Transfer Admin Rights</Text>
                <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 2 }}>
                  Search for a user or enter an email address
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTransferModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <View style={[s.modalInput, { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingHorizontal: 12 }]}>
                <Ionicons name="search-outline" size={16} color={AppColors.textLight} style={{ marginRight: 6 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: AppColors.textDark }}
                  value={transferSearchQuery}
                  onChangeText={(text) => {
                    setTransferSearchQuery(text);
                    setTransferSelectedUser(null);
                    searchUsersForTransfer(text, true);
                  }}
                  placeholder="Search by name or email..."
                  placeholderTextColor={AppColors.textLight}
                  autoCapitalize="none"
                />
                {transferSearchLoading && <ActivityIndicator size="small" color={AppColors.primary} />}
              </View>
            </View>

            {/* Selected user banner */}
            {transferSelectedUser && (
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                {transferSelectedUser.profile_image ? (
                  <Image source={{ uri: resolveUrl(transferSelectedUser.profile_image) }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                      {(transferSelectedUser.full_name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#5B21B6' }}>{transferSelectedUser.full_name}</Text>
                  <Text style={{ fontSize: 11, color: '#7C3AED' }}>{transferSelectedUser.email}</Text>
                </View>
                <TouchableOpacity onPress={() => setTransferSelectedUser(null)}>
                  <Ionicons name="close-circle" size={20} color="#7C3AED" />
                </TouchableOpacity>
              </View>
            )}

            {/* User list */}
            <FlatList
              data={transferSearchResults}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 260, marginBottom: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onEndReached={loadMoreTransferUsers}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={
                !transferSearchLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Ionicons name="people-outline" size={32} color={AppColors.textLight} />
                    <Text style={{ fontSize: 13, color: AppColors.textLight, marginTop: 8 }}>No users found</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                transferUsersHasMore && transferSearchResults.length > 0 ? (
                  <TouchableOpacity
                    style={{ paddingVertical: 10, alignItems: 'center' }}
                    onPress={loadMoreTransferUsers}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: AppColors.primary }}>Load More</Text>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = transferSelectedUser && String(transferSelectedUser.id) === String(item.id);
                const isSelf = String(item.id) === String(currentUser?.id);
                if (isSelf) return null;
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F3F4F6',
                      backgroundColor: isSelected ? '#F5F3FF' : 'transparent',
                      borderRadius: isSelected ? 8 : 0,
                    }}
                    onPress={() => {
                      setTransferSelectedUser(isSelected ? null : item);
                      setTransferManualEmail('');
                    }}
                    activeOpacity={0.75}
                  >
                    {item.profile_image ? (
                      <Image source={{ uri: resolveUrl(item.profile_image) }} style={{ width: 38, height: 38, borderRadius: 19 }} />
                    ) : (
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#E6F4EA', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.primary }}>
                          {(item.full_name || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: AppColors.textDark }}>{item.full_name}</Text>
                      <Text style={{ fontSize: 11, color: AppColors.textMedium }}>{item.email}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSelected ? '#7C3AED' : AppColors.textLight}
                    />
                  </TouchableOpacity>
                );
              }}
            />

            {/* Divider + manual email */}
            {!transferSelectedUser && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                  <Text style={{ marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: AppColors.textLight }}>OR BY EMAIL</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <TextInput
                    style={[s.modalInput, { flex: 1, height: 44, paddingVertical: 10 }]}
                    value={transferManualEmail}
                    onChangeText={setTransferManualEmail}
                    placeholder="Enter email address"
                    placeholderTextColor={AppColors.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[s.ctaBtn, { width: '100%', backgroundColor: '#7C3AED', borderColor: '#7C3AED' }, transferSubmitting && { opacity: 0.7 }]}
              onPress={handleSubmitTransfer}
              disabled={transferSubmitting}
            >
              {transferSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="swap-horizontal-outline" size={16} color="white" style={{ marginRight: 6 }} />
                  <Text style={s.ctaBtnText}>Send Transfer Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Member Options Modal ── */}
      <Modal visible={memberOptionsVisible} transparent animationType="slide" onRequestClose={() => setMemberOptionsVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selectedMember?.user?.full_name || 'Member Options'}</Text>
              <TouchableOpacity onPress={() => setMemberOptionsVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 8 }}>
              {/* View Profile */}
              <TouchableOpacity
                style={s.adminAction}
                onPress={() => {
                  setMemberOptionsVisible(false);
                  setProfileModalVisible(true);
                }}
              >
                <View style={[s.adminActionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="person-outline" size={18} color="#2563EB" />
                </View>
                <Text style={s.adminActionText}>View Profile</Text>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
              </TouchableOpacity>

              {/* Message */}
              <TouchableOpacity
                style={s.adminAction}
                onPress={() => {
                  if (selectedMember) handleMessageMember(selectedMember);
                }}
              >
                <View style={[s.adminActionIcon, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#059669" />
                </View>
                <Text style={s.adminActionText}>Message</Text>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
              </TouchableOpacity>

              {/* Follow / Unfollow */}
              <TouchableOpacity
                style={s.adminAction}
                onPress={() => {
                  if (selectedMember) {
                    setMemberOptionsVisible(false);
                    handleFollowMember(selectedMember);
                  }
                }}
              >
                <View style={[s.adminActionIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name={selectedMember?.is_following ? "person-remove-outline" : "person-add-outline"} size={18} color="#EF4444" />
                </View>
                <Text style={s.adminActionText}>{selectedMember?.is_following ? 'Unfollow' : 'Follow User'}</Text>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
              </TouchableOpacity>

              {/* Change Role (Admin Only) */}
              {isAdmin(role) && (
                <TouchableOpacity
                  style={s.adminAction}
                  onPress={() => {
                    setMemberOptionsVisible(false);
                    setChangeRoleModalVisible(true);
                  }}
                >
                  <View style={[s.adminActionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="shield-outline" size={18} color="#D97706" />
                  </View>
                  <Text style={s.adminActionText}>Change Role</Text>
                  <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
                </TouchableOpacity>
              )}

              {/* Remove Member (Admin Only) */}
              {isAdmin(role) && selectedMember?.role?.name !== 'creator' && selectedMember?.role?.name !== 'ADMIN_ASSO' && (
                <TouchableOpacity
                  style={s.adminAction}
                  onPress={() => {
                    setMemberOptionsVisible(false);
                    setRemoveMemberModalVisible(true);
                  }}
                >
                  <View style={[s.adminActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </View>
                  <Text style={[s.adminActionText, { color: '#DC2626' }]}>Remove Member</Text>
                  <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Profile Detail Modal ── */}
      <Modal visible={profileModalVisible} transparent animationType="slide" onRequestClose={() => setProfileModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>User Profile</Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                {selectedMember.user?.profile_image ? (
                  <Image source={{ uri: resolveUrl(selectedMember.user.profile_image) }} style={{ width: 90, height: 90, borderRadius: 45, marginBottom: 12 }} />
                ) : (
                  <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#E6F4EA', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 32, fontWeight: '700', color: AppColors.primary }}>{(selectedMember.user?.full_name || '?')[0].toUpperCase()}</Text>
                  </View>
                )}

                <Text style={{ fontSize: 20, fontWeight: '800', color: AppColors.textDark }}>{selectedMember.user?.full_name}</Text>
                <Text style={{ fontSize: 14, color: AppColors.textMedium, marginTop: 4, marginBottom: 16 }}>{selectedMember.user?.email}</Text>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                    <Text style={{ fontSize: 13, color: AppColors.textDark }}>
                      Role: <Text style={{ fontWeight: '700' }}>{ROLE_DISPLAY_NAMES[selectedMember.role?.name || ''] || selectedMember.role?.name || ''}</Text>
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                    <Text style={{ fontSize: 13, color: AppColors.textDark }}>
                      Joined: <Text style={{ fontWeight: '700' }}>{formatDate(selectedMember.joined_at)}</Text>
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.ctaBtn, { width: '100%', backgroundColor: selectedMember.is_following ? '#EF4444' : AppColors.primary }]}
                  onPress={() => {
                    handleFollowMember(selectedMember);
                  }}
                >
                  <Ionicons name={selectedMember.is_following ? "person-remove-outline" : "person-add-outline"} size={18} color="white" style={{ marginRight: 6 }} />
                  <Text style={s.ctaBtnText}>{selectedMember.is_following ? 'Unfollow User' : 'Follow User'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Change Role Modal ── */}
      <Modal visible={changeRoleModalVisible} transparent animationType="slide" onRequestClose={() => setChangeRoleModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Change Member Role</Text>
              <TouchableOpacity onPress={() => setChangeRoleModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSub}>
              Assign a new role for {selectedMember?.user?.full_name}:
            </Text>

            <View style={{ marginVertical: 12 }}>
              {availableRoles
                .filter(r => {
                  if (r.name === 'ADMIN_ASSO') {
                    return role === 'ADMIN_ASSO' || role === 'creator';
                  }
                  return true;
                })
                .map(roleItem => {
                  const isSelected = selectedMemberRole?.id === roleItem.id;
                  return (
                    <TouchableOpacity
                      key={roleItem.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F3F4F6',
                      }}
                      onPress={() => setSelectedMemberRole(roleItem)}
                    >
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={isSelected ? AppColors.primary : AppColors.textMedium}
                      />
                      <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: isSelected ? '700' : '500', color: isSelected ? AppColors.primary : AppColors.textDark }}>
                        {ROLE_DISPLAY_NAMES[roleItem.name] || roleItem.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            <TouchableOpacity
              style={[s.ctaBtn, { width: '100%', marginTop: 16 }]}
              onPress={handleChangeMemberRole}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="white" /> : <Text style={s.ctaBtnText}>Update Role</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Remove Member Modal ── */}
      <Modal visible={removeMemberModalVisible} transparent animationType="slide" onRequestClose={() => setRemoveMemberModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: AppColors.error }]}>Remove Member</Text>
              <TouchableOpacity onPress={() => setRemoveMemberModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSub}>
              Are you sure you want to remove {selectedMember?.user?.full_name} from the association?
            </Text>

            <View style={{ marginVertical: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>Reason for removal</Text>
              <TextInput
                style={[s.modalInput, { height: 80 }]}
                value={removalReason}
                onChangeText={setRemovalReason}
                placeholder="Inappropriate behavior, inactive, etc."
                placeholderTextColor={AppColors.textLight}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[s.ctaBtn, { width: '100%', backgroundColor: AppColors.error }]}
              onPress={handleRemoveMemberConfirm}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="white" /> : <Text style={s.ctaBtnText}>Remove Member</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Header Context Menu Modal ── */}
      <Modal visible={headerMenuVisible} transparent animationType="fade" onRequestClose={() => setHeaderMenuVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setHeaderMenuVisible(false)}>
          <View style={{
            position: 'absolute',
            top: insets.top + 45,
            right: 16,
            backgroundColor: 'white',
            borderRadius: 12,
            width: 200,
            padding: 8,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
              android: { elevation: 4 }
            })
          }}>
            {/* Share */}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={18} color={AppColors.textDark} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 14, color: AppColors.textDark, fontWeight: '600' }}>Share</Text>
            </TouchableOpacity>

            {/* Mute / Unmute (If member) */}
            {isMember && (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }} onPress={handleToggleMute}>
                <Ionicons name={assoc?.is_muted ? "notifications-outline" : "notifications-off-outline"} size={18} color={AppColors.textDark} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 14, color: AppColors.textDark, fontWeight: '600' }}>
                  {assoc?.is_muted ? 'Unmute Alerts' : 'Mute Alerts'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Report */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}
              onPress={() => {
                setHeaderMenuVisible(false);
                setReportModalVisible(true);
              }}
            >
              <Ionicons name="flag-outline" size={18} color={AppColors.textDark} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 14, color: AppColors.textDark, fontWeight: '600' }}>Report</Text>
            </TouchableOpacity>

            {/* Leave (If member & not creator) */}
            {isMember && assoc?.current_user_role !== 'creator' && (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }} onPress={handleLeave}>
                <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 14, color: '#EF4444', fontWeight: '700' }}>Leave</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Report Association Modal ── */}
      <Modal visible={reportModalVisible} transparent animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: AppColors.error }]}>Report Association</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 8 }}>Select a reason</Text>
              {['Spam', 'Harassment', 'Inappropriate Content', 'Impersonation/Fake', 'Other'].map(reason => {
                const isSelected = reportReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
                    onPress={() => setReportReason(reason)}
                  >
                    <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={20} color={isSelected ? AppColors.primary : AppColors.textMedium} />
                    <Text style={{ fontSize: 14, color: AppColors.textDark, marginLeft: 10, fontWeight: isSelected ? '700' : '500' }}>{reason}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginTop: 16, marginBottom: 8 }}>Additional Details</Text>
              <TextInput
                style={[s.modalInput, { height: 80 }]}
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="Explain why you are reporting this association..."
                placeholderTextColor={AppColors.textLight}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <TouchableOpacity style={[s.ctaBtn, { width: '100%', backgroundColor: AppColors.error, marginTop: 16 }]} onPress={handleReportSubmit}>
              <Text style={s.ctaBtnText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Local Create Event Modal removed in favor of navigation */}

      {/* ── Premium Association Settings Modal ── */}
      <Modal visible={settingsVisible} animationType="slide" transparent={false} onRequestClose={() => setSettingsVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
          {/* Header */}
          <View style={[s.stickyHeader, { position: 'relative', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', shadowOpacity: 0 }]}>
            <TouchableOpacity onPress={() => setSettingsVisible(false)} style={s.stickyBackBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="close" size={24} color={AppColors.textDark} />
            </TouchableOpacity>
            <Text style={s.stickyTitle}>Settings Panel</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Sub Tab Selection Bar */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            <TouchableOpacity
              style={[{ flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, settingsTab === 'requests' && { borderBottomColor: AppColors.primary }]}
              onPress={() => { setSettingsTab('requests'); setActiveResponseEditor(null); }}
            >
              <Text style={[{ fontSize: 13, fontWeight: '700', color: AppColors.textMedium }, settingsTab === 'requests' && { color: AppColors.primary }]}>Join Form Rules</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[{ flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, settingsTab === 'responses' && { borderBottomColor: AppColors.primary }]}
              onPress={() => setSettingsTab('responses')}
            >
              <Text style={[{ fontSize: 13, fontWeight: '700', color: AppColors.textMedium }, settingsTab === 'responses' && { color: AppColors.primary }]}>Auto Responses</Text>
            </TouchableOpacity>
          </View>

          {/* Tab 1: Request Settings */}
          {settingsTab === 'requests' && (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: AppColors.textDark, marginBottom: 16 }}>Request Settings</Text>

              {/* require_motif */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.textDark }}>Motif Required</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>Require applicants to write a statement when requesting to join.</Text>
                </View>
                <Switch
                  value={requestSettings.require_motif}
                  onValueChange={(val) => setRequestSettings((prev: any) => ({ ...prev, require_motif: val }))}
                  trackColor={{ false: '#D1D5DB', true: AppColors.primary }}
                />
              </View>

              {/* motif_prompt prompt */}
              {requestSettings.require_motif && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>Motif/Prompt Text</Text>
                  <TextInput
                    style={[s.modalInput, { height: 44, paddingVertical: 10 }]}
                    value={requestSettings.motif_prompt}
                    onChangeText={(txt) => setRequestSettings((prev: any) => ({ ...prev, motif_prompt: txt }))}
                    placeholder="e.g. Why would you like to join Ekenox?"
                    placeholderTextColor={AppColors.textLight}
                  />
                </View>
              )}

              {/* enable_resume_upload */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.textDark }}>Resume Required</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>Require attachment of resume/profile document to joining.</Text>
                </View>
                <Switch
                  value={requestSettings.enable_resume_upload}
                  onValueChange={(val) => setRequestSettings((prev: any) => ({ ...prev, enable_resume_upload: val }))}
                  trackColor={{ false: '#D1D5DB', true: AppColors.primary }}
                />
              </View>

              {/* enable_portfolio_links */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.textDark }}>Portfolio Link Required</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>Require candidate to supply website/portfolio links.</Text>
                </View>
                <Switch
                  value={requestSettings.enable_portfolio_links}
                  onValueChange={(val) => setRequestSettings((prev: any) => ({ ...prev, enable_portfolio_links: val }))}
                  trackColor={{ false: '#D1D5DB', true: AppColors.primary }}
                />
              </View>

              {/* enable_preferred_role */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.textDark }}>Enable Preferred Role Selection</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>Allows applicants to select a preferred role from roles lists.</Text>
                </View>
                <Switch
                  value={requestSettings.enable_preferred_role}
                  onValueChange={(val) => setRequestSettings((prev: any) => ({ ...prev, enable_preferred_role: val }))}
                  trackColor={{ false: '#D1D5DB', true: AppColors.primary }}
                />
              </View>

              {/* auto_accept_mutual_friends */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.textDark }}>Auto-Accept Mutual Friends</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>Instantly approve requests of candidates with existing members.</Text>
                </View>
                <Switch
                  value={requestSettings.auto_accept_mutual_friends}
                  onValueChange={(val) => setRequestSettings((prev: any) => ({ ...prev, auto_accept_mutual_friends: val }))}
                  trackColor={{ false: '#D1D5DB', true: AppColors.primary }}
                />
              </View>

              {/* restricted_to_regions */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.textDark }}>Restricted to Regions</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>Only allow joining requests from specific geographic regions.</Text>
                </View>
                <Switch
                  value={requestSettings.restricted_to_regions}
                  onValueChange={(val) => setRequestSettings((prev: any) => ({ ...prev, restricted_to_regions: val }))}
                  trackColor={{ false: '#D1D5DB', true: AppColors.primary }}
                />
              </View>

              {/* restricted regions text tag list */}
              {requestSettings.restricted_to_regions && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>Allowed Regions</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[s.modalInput, { flex: 1, height: 44, paddingVertical: 10 }]}
                      value={newRegion}
                      onChangeText={setNewRegion}
                      placeholder="Add region (e.g. EU, US)"
                      placeholderTextColor={AppColors.textLight}
                    />
                    <TouchableOpacity
                      style={[s.ctaBtn, { flex: 0, paddingHorizontal: 16 }]}
                      onPress={() => {
                        if (newRegion.trim()) {
                          setRequestSettings((prev: any) => ({
                            ...prev,
                            allowed_regions: [...(prev.allowed_regions || []), newRegion.trim()]
                          }));
                          setNewRegion('');
                        }
                      }}
                    >
                      <Text style={s.ctaBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {(requestSettings.allowed_regions || []).map((region: string, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 }}>
                        <Text style={{ fontSize: 12, color: AppColors.textDark }}>{region}</Text>
                        <TouchableOpacity onPress={() => {
                          setRequestSettings((prev: any) => ({
                            ...prev,
                            allowed_regions: prev.allowed_regions.filter((_: any, i: number) => i !== idx)
                          }));
                        }}>
                          <Ionicons name="close-circle" size={14} color={AppColors.textMedium} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Save Settings button */}
              <TouchableOpacity
                style={[s.ctaBtn, { width: '100%', height: 48, borderRadius: 12, marginTop: 12 }]}
                onPress={async () => {
                  setActionLoading(true);
                  try {
                    await associationService.updateRequestSettings(assoc.id, requestSettings);
                    Alert.alert('🎉 Success', 'Request configuration settings updated.');
                    setSettingsVisible(false);
                    loadAssociation();
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to save settings.');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator color="white" /> : <Text style={s.ctaBtnText}>Save Configurations</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Tab 2: Auto Responses */}
          {settingsTab === 'responses' && (
            <View style={{ flex: 1 }}>
              {activeResponseEditor === null ? (
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: AppColors.textDark, marginBottom: 6 }}>Auto Responses</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 20 }}>Configure automatic triggers that dispatch messages upon membership action state changes.</Text>

                  {autoResponses.map((template) => (
                    <TouchableOpacity
                      key={template.trigger_type}
                      style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      onPress={() => {
                        setActiveResponseEditor(template.trigger_type);
                        setEditingSubject(template.subject_line || '');
                        setEditingBody(template.message_body || '');
                        setEditingEnabled(template.is_active ?? true);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: AppColors.textDark }}>{template.trigger_label || template.trigger_type}</Text>
                          <View style={[{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }, template.is_active ? { backgroundColor: AppColors.primary + '15' } : { backgroundColor: '#F3F4F6' }]}>
                            <Text style={[{ fontSize: 9, fontWeight: '700' }, template.is_active ? { color: AppColors.primary } : { color: AppColors.textLight }]}>{template.is_active ? 'ENABLED' : 'DISABLED'}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 4 }}>{template.trigger_description}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  {/* Editor subheader */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}
                    onPress={() => setActiveResponseEditor(null)}
                  >
                    <Ionicons name="chevron-back" size={18} color={AppColors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: AppColors.primary }}>Back to Templates</Text>
                  </TouchableOpacity>

                  <Text style={{ fontSize: 16, fontWeight: '800', color: AppColors.textDark, marginBottom: 4 }}>Edit Auto Response</Text>
                  <Text style={{ fontSize: 12, color: AppColors.textMedium, marginBottom: 20 }}>Customize trigger parameters and content. Personalization placeholders will be dynamically evaluated upon dispatcher execution.</Text>

                  {/* Trigger Toggle */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: AppColors.textDark }}>Trigger Active</Text>
                    <Switch
                      value={editingEnabled}
                      onValueChange={setEditingEnabled}
                      trackColor={{ false: '#D1D5DB', true: AppColors.primary }}
                    />
                  </View>

                  {/* Subject Line */}
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>Subject Line</Text>
                    <TextInput
                      style={[s.modalInput, { height: 44, paddingVertical: 10 }]}
                      value={editingSubject}
                      onChangeText={setEditingSubject}
                      onFocus={() => setLastFocusedField('subject')}
                      placeholder="Enter email/message subject line"
                      placeholderTextColor={AppColors.textLight}
                    />
                  </View>

                  {/* Message Body */}
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>Message Body</Text>
                    <TextInput
                      style={[s.modalInput, { height: 160, paddingVertical: 10 }]}
                      value={editingBody}
                      onChangeText={setEditingBody}
                      onFocus={() => setLastFocusedField('body')}
                      placeholder="Welcome candidate to the team!"
                      placeholderTextColor={AppColors.textLight}
                      multiline
                      numberOfLines={8}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Personalization Variable Placeholder Chips */}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: AppColors.textMedium, textTransform: 'uppercase', marginBottom: 8 }}>Evaluate Placeholder Variables (Tap to Insert)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                    {personalizationPlaceholders.map((place, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={{ backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}
                        onPress={() => {
                          const placeholderStr = place.placeholder;
                          if (lastFocusedField === 'subject') {
                            setEditingSubject((prev) => prev + placeholderStr);
                          } else {
                            setEditingBody((prev) => prev + placeholderStr);
                          }
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: AppColors.primary }}>{place.placeholder}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Action Buttons Row */}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      style={[{ flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }]}
                      onPress={async () => {
                        Alert.alert('Reset Template', 'Are you sure you want to reset this response to its default value?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Reset',
                            style: 'destructive',
                            onPress: async () => {
                              setActionLoading(true);
                              try {
                                const res = await associationService.resetAutoResponse(assoc.id, activeResponseEditor!);
                                Alert.alert('🎉 Reset Completed', 'Template reset to factory default value.');
                                setEditingSubject(res.data?.subject_line || '');
                                setEditingBody(res.data?.message_body || '');
                                setEditingEnabled(res.data?.is_active ?? true);
                                setAutoResponses((prev) =>
                                  prev.map((t) => (t.trigger_type === activeResponseEditor ? res.data : t))
                                );
                              } catch (err: any) {
                                Alert.alert('Error', err.message);
                              } finally {
                                setActionLoading(false);
                              }
                            }
                          }
                        ]);
                      }}
                    >
                      <Text style={{ fontSize: 13, color: AppColors.error, fontWeight: '700' }}>Reset to Default</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.ctaBtn, { flex: 1, height: 44, borderRadius: 10 }]}
                      onPress={async () => {
                        setActionLoading(true);
                        try {
                          const res = await associationService.updateAutoResponse(assoc.id, activeResponseEditor!, {
                            subject_line: editingSubject,
                            message_body: editingBody,
                            is_active: editingEnabled
                          });
                          Alert.alert('🎉 Saved!', 'Auto response template saved.');
                          setAutoResponses((prev) =>
                            prev.map((t) => (t.trigger_type === activeResponseEditor ? res.data : t))
                          );
                          setActiveResponseEditor(null);
                        } catch (err: any) {
                          Alert.alert('Error', err.message);
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                    >
                      {actionLoading ? <ActivityIndicator color="white" /> : <Text style={s.ctaBtnText}>Save Template</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* ── Transfer History Modal ── */}
      <Modal visible={historyModalVisible} animationType="slide" transparent onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '80%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Admin Transfer History</Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={AppColors.primary} />
                <Text style={{ marginTop: 12, color: AppColors.textMedium, fontSize: 13 }}>Loading history...</Text>
              </View>
            ) : transferHistory.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={48} color={AppColors.textLight} />
                <Text style={{ marginTop: 12, color: AppColors.textMedium, fontSize: 14, textAlign: 'center' }}>No administrative transfers found.</Text>
              </View>
            ) : (
              <FlatList
                data={transferHistory}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                style={{ marginVertical: 8 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const statusColors = {
                    pending_response: { text: '#D97706', bg: '#FEF3C7' },
                    accepted_pending_validation: { text: '#2563EB', bg: '#DBEAFE' },
                    refused: { text: '#DC2626', bg: '#FEE2E2' },
                    cancelled: { text: '#4B5563', bg: '#F3F4F6' },
                    validated: { text: '#059669', bg: '#D1FAE5' }
                  };
                  const statusLabel = {
                    pending_response: 'Pending Response',
                    accepted_pending_validation: 'Accepted (Pending Validation)',
                    refused: 'Refused',
                    cancelled: 'Cancelled',
                    validated: 'Validated'
                  };
                  const color = statusColors[item.status] || { text: '#4B5563', bg: '#F3F4F6' };
                  const label = statusLabel[item.status] || item.status;

                  return (
                    <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: AppColors.textMedium }}>ID: {item.id}</Text>
                        <View style={[{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: color.bg }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: color.text }}>{label}</Text>
                        </View>
                      </View>

                      <View style={{ gap: 4, marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: AppColors.textDark }}>
                          Sender: <Text style={{ fontWeight: '700' }}>{item.sender?.full_name}</Text>
                        </Text>
                        <Text style={{ fontSize: 13, color: AppColors.textDark }}>
                          Receiver: <Text style={{ fontWeight: '700' }}>{item.receiver?.full_name || item.email}</Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: AppColors.textLight }}>
                          Requested on {parseSafeDate(item.created_at)?.toLocaleString() || 'N/A'}
                        </Text>
                      </View>

                      {/* Action details */}
                      <View style={{ borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, gap: 4 }}>
                        {item.accepted_by && (
                          <Text style={{ fontSize: 12, color: AppColors.textMedium }}>
                            ✓ Accepted by <Text style={{ fontWeight: '600', color: AppColors.textDark }}>{item.accepted_by.full_name}</Text>
                          </Text>
                        )}
                        {item.refused_by && (
                          <Text style={{ fontSize: 12, color: AppColors.textMedium }}>
                            ✗ Refused by <Text style={{ fontWeight: '600', color: AppColors.textDark }}>{item.refused_by.full_name}</Text>
                          </Text>
                        )}
                        {item.cancelled_by && (
                          <Text style={{ fontSize: 12, color: AppColors.textMedium }}>
                            ✗ Cancelled by <Text style={{ fontWeight: '600', color: AppColors.textDark }}>{item.cancelled_by.full_name}</Text>
                          </Text>
                        )}
                        {item.validated_by && (
                          <Text style={{ fontSize: 12, color: AppColors.textMedium }}>
                            ✓ Validated by <Text style={{ fontWeight: '600', color: AppColors.textDark }}>{item.validated_by.full_name}</Text>
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F5F5F7' },
  loadingText: { marginTop: 12, color: AppColors.textMedium, fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: AppColors.textDark, marginTop: 12 },
  backActionBtn: {
    marginTop: 16, backgroundColor: AppColors.primary,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10,
  },
  backActionText: { color: 'white', fontWeight: 'bold' },

  // Sticky header
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: 'white', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  stickyBackBtn: { padding: 6 },
  stickyTitle: {
    flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700',
    color: AppColors.textDark, marginHorizontal: 8,
  },
  stickyFollowBtn: { padding: 10 },

  // Hero
  heroWrapper: { height: HEADER_HEIGHT, overflow: 'hidden', position: 'relative' },
  heroBanner: { width: '100%', height: '100%' },
  heroBannerPlaceholder: { backgroundColor: AppColors.primary + 'C0', alignItems: 'center', justifyContent: 'center' },
  heroBannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroFloatingRow: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  heroFloatBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute', bottom: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },

  // Identity card
  identityCard: {
    backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04, shadowRadius: 8,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoImg: { width: 60, height: 60, borderRadius: 14, borderWidth: 2, borderColor: '#E5E7EB' },
  logoPlaceholder: {
    width: 60, height: 60, borderRadius: 14,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: AppColors.primary + '30',
  },
  assocName: { fontSize: 20, fontWeight: '800', color: AppColors.textDark, flexShrink: 1 },
  categoryBadge: {
    backgroundColor: AppColors.primary + '18',
    alignSelf: 'flex-start', marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: '700', color: AppColors.primary },
  myRoleBadge: {
    alignSelf: 'flex-start', marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  myRoleBadgeText: { fontSize: 11, fontWeight: '700' },
  tagline: { fontSize: 14, color: AppColors.textMedium, fontStyle: 'italic', marginBottom: 8 },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 12,
  },
  privateBadgeText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  // Actions row
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  followBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: AppColors.primary, gap: 6,
  },
  followBtnText: { fontSize: 14, fontWeight: '700', color: AppColors.primary },
  ctaBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 40, borderRadius: 10, backgroundColor: AppColors.primary, gap: 6,
  },
  ctaBtnText: { fontSize: 14, fontWeight: '700', color: 'white' },
  leaveBtn: { backgroundColor: AppColors.error + '15', borderWidth: 1.5, borderColor: AppColors.error },
  pendingBtn: { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#D97706' },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  tabBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: AppColors.primary },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: AppColors.textMedium },
  tabBtnTextActive: { color: AppColors.primary, fontWeight: '800' },
  tabContent: { padding: 14, gap: 12 },
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


  // Invitation banner
  invitationBanner: {
    backgroundColor: '#DBEAFE', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  invitationBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  invitationBannerSub: { fontSize: 12, color: '#1D4ED8', marginTop: 2 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#EBEBEB',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: AppColors.primary },
  statLabel: { fontSize: 10, color: AppColors.textMedium, marginTop: 3, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },

  // Card
  card: {
    backgroundColor: 'white', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#EBEBEB', gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: AppColors.textDark, marginBottom: 4 },
  cardText: { fontSize: 14, color: AppColors.textMedium, lineHeight: 21 },

  missionCard: { backgroundColor: AppColors.primary + '08', borderColor: AppColors.primary + '30' },
  missionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  missionTitle: { fontSize: 15, fontWeight: '700', color: AppColors.primary },
  missionText: { fontSize: 14, color: AppColors.textDark, lineHeight: 21, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  focusChip: {
    backgroundColor: AppColors.primary + '18',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  focusChipText: { fontSize: 12, color: AppColors.primary, fontWeight: '600' },

  achievementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  achievementText: { flex: 1, fontSize: 13, color: AppColors.textMedium, lineHeight: 19 },

  // InfoRow
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  infoIconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: AppColors.primary + '12',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  infoLabel: { fontSize: 11, color: AppColors.textLight, fontWeight: '600' },
  infoValue: { fontSize: 13, color: AppColors.textDark, marginTop: 1 },

  // Creator
  creatorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  creatorAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  creatorLabel: { fontSize: 11, color: AppColors.textLight, fontWeight: '600' },
  creatorName: { fontSize: 14, fontWeight: '700', color: AppColors.textDark, marginTop: 2 },

  // Admin section
  adminAction: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 12,
  },
  adminActionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  adminActionText: { flex: 1, fontSize: 14, fontWeight: '600', color: AppColors.textDark },
  adminActionSub: { fontSize: 12, color: AppColors.textMedium, marginTop: 2 },

  // Join Requests
  requestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  requestAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  requestAvatarText: { fontSize: 14, fontWeight: '700', color: AppColors.primary },
  requestName: { fontSize: 13, fontWeight: '700', color: AppColors.textDark },
  requestMessage: { fontSize: 12, color: AppColors.textMedium, marginTop: 2 },
  approveBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: AppColors.primary, alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: AppColors.error, alignItems: 'center', justifyContent: 'center',
  },

  // Events tab
  centeredTab: { paddingVertical: 60, alignItems: 'center' },
  centeredTabText: { marginTop: 12, color: AppColors.textMedium, fontSize: 14 },
  emptyTabText: { marginTop: 12, fontSize: 14, color: AppColors.textMedium, textAlign: 'center' },

  eventCard: {
    backgroundColor: 'white', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EBEBEB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    position: 'relative',
  },
  eventBanner: { width: '100%', height: 120 },
  eventBannerPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  eventStatusBadge: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  eventStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  eventCardBody: { padding: 14 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: AppColors.textDark, marginBottom: 6 },
  eventDesc: { fontSize: 13, color: AppColors.textMedium, lineHeight: 18, marginBottom: 8 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  eventMetaText: { fontSize: 12, color: AppColors.textMedium, flex: 1 },

  // Members tab
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22 },
  memberAvatarPlaceholder: {
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarInitial: { fontSize: 17, fontWeight: '700', color: AppColors.primary },
  memberName: { fontSize: 14, fontWeight: '700', color: AppColors.textDark },
  memberEmail: { fontSize: 12, color: AppColors.textMedium, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  removeMemberBtn: { padding: 6 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: AppColors.textDark },
  modalSub: { fontSize: 13, color: AppColors.textMedium, marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 14, color: AppColors.textDark,
    height: 100, textAlignVertical: 'top', backgroundColor: '#FAFAFA',
  },
  roleChip: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 4,
  },
  roleChipActive: {
    backgroundColor: AppColors.primary + '18',
    borderColor: AppColors.primary,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  roleChipTextActive: {
    color: AppColors.primary,
    fontWeight: '800',
  },
});
