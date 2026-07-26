import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';
import chatService from '../services/chatService';
import { UrlHelper } from '../utils/urlHelper';
import { useAuth } from '../context/AuthContext';

// ── Hermes-safe Date Formatter ────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatConvTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffH < 24) {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;
  }
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getDay()];
  }
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};

const formatFullDateTime = (iso?: string): string => {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'N/A';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const timeStr = `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} • ${timeStr}`;
};

const getExpiresInText = (expiresAtIso?: string): { text: string; isExpired: boolean } => {
  if (!expiresAtIso) return { text: '', isExpired: false };
  const expiresAt = new Date(expiresAtIso);
  if (isNaN(expiresAt.getTime())) return { text: '', isExpired: false };
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  if (diffMs <= 0) return { text: 'Expired', isExpired: true };

  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays > 0) return { text: `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}`, isExpired: false };
  if (diffHours > 0) return { text: `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`, isExpired: false };
  const diffMins = Math.floor(diffMs / 60000);
  return { text: `Expires in ${diffMins} min${diffMins > 1 ? 's' : ''}`, isExpired: false };
};

// ── Item Resolvers ────────────────────────────────────────────────────────────

const resolveName = (item: any, currentUser?: any): string => {
  if (item.isGroup) {
    return item.name || item.displayName || 'Group Chat';
  }
  if (item.displayName && String(item.displayName).trim() !== '') {
    return item.displayName;
  }
  if (item.contact?.user?.name) return item.contact.user.name;
  if (item.contact?.user?.full_name) return item.contact.user.full_name;
  if (item.contact?.name) return item.contact.name;

  if (Array.isArray(item.members)) {
    const other = item.members.find((m: any) => {
      const mId = m.user?.id || m.id;
      return String(mId) !== String(currentUser?.id);
    });
    if (other?.user?.name) return other.user.name;
    if (other?.user?.full_name) return other.user.full_name;
  }
  return item.name || 'Direct Chat';
};

const resolveAvatar = (item: any, currentUser?: any): string | null => {
  if (item.profileImage && String(item.profileImage).trim() !== '') {
    return UrlHelper.convertPathToUrl(item.profileImage);
  }
  if (item.contact?.user?.profile_image) {
    return UrlHelper.convertPathToUrl(item.contact.user.profile_image);
  }
  if (Array.isArray(item.members)) {
    const other = item.members.find((m: any) => {
      const mId = m.user?.id || m.id;
      return String(mId) !== String(currentUser?.id);
    });
    if (other?.user?.profile_image) {
      return UrlHelper.convertPathToUrl(other.user.profile_image);
    }
  }
  return null;
};

const resolveLastMessage = (item: any): string => {
  if (!item.lastMessage) return 'No messages yet';
  if (typeof item.lastMessage === 'string') return item.lastMessage;
  const content = item.lastMessage.content || '';
  if (!content) return 'No messages yet';
  const sender = item.lastMessage.isOwn
    ? 'You'
    : item.lastMessage.sender;
  return sender ? `${sender}: ${content}` : content;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const MessagesScreen = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [allInvites, setAllInvites] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mainTab, setMainTab] = useState<'chats' | 'invites'>('chats');
  const [inviteSubTab, setInviteSubTab] = useState<'pending' | 'all'>('pending');

  // Modals state
  const [menuVisible, setMenuVisible] = useState(false);
  const [directModalVisible, setDirectModalVisible] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [detailInviteModal, setDetailInviteModal] = useState<any | null>(null);

  // Contacts / Mutual Friends state
  const [contacts, setContacts] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<(number | string)[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Expanded description tracking
  const [expandedInviteIds, setExpandedInviteIds] = useState<Record<string, boolean>>({});

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const [apiTotalUnread, setApiTotalUnread] = useState(0);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);

    // 1. Fetch Conversations
    try {
      const convData = await chatService.getConversations();

      const list = Array.isArray(convData)
        ? convData
        : (convData?.conversations ?? convData?.data?.conversations ?? convData?.data ?? []);

      setConversations(list);
      const q = searchQuery.trim().toLowerCase();
      setFiltered(q ? list.filter((c: any) => resolveName(c, user).toLowerCase().includes(q)) : list);

      setApiTotalUnread(
        convData?.totalUnreadCount ??
        convData?.total_unread_count ??
        convData?.data?.totalUnreadCount ??
        0
      );
    } catch (e) {
      console.error('MessagesScreen load conversations error:', e);
    }

    // 2. Fetch Pending Invites
    try {
      const pInvites = await chatService.getPendingInvites();
      setPendingInvites(pInvites ?? []);
    } catch (e) {
      console.error('MessagesScreen load pending invites error:', e);
    }

    // 3. Fetch All Invites
    try {
      const aInvites = await chatService.getAllUserInvites();
      setAllInvites(aInvites ?? []);
    } catch (e) {
      console.error('MessagesScreen load all invites error:', e);
    }

    setIsLoading(false);
    setRefreshing(false);
  }, [searchQuery]);

  const applyFilter = (q: string, rawList: any[] = conversations) => {
    const query = q.trim().toLowerCase();
    if (!query) { setFiltered(rawList); return; }
    setFiltered(
      rawList.filter(c => {
        const name = resolveName(c, user).toLowerCase();
        return name.includes(query);
      })
    );
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applyFilter(text);
  };

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const list = await chatService.getUserContacts();
      setContacts(list);
      setFoundUsers(list);
    } catch (e) {
      console.error('Failed to load contacts:', e);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadData();
      pollRef.current = setInterval(() => loadData(true), 8000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isFocused]);

  const onRefresh = () => { setRefreshing(true); loadData(true); };

  // ── Contact / User Search ─────────────────────────────────────────────────

  // Selected users map for pinned invite chips
  const [selectedUsersMap, setSelectedUsersMap] = useState<Record<string, any>>({});

  const handleUserSearch = async (query: string) => {
    setUserSearchQuery(query);
    const q = query.trim().toLowerCase();
    if (!q) {
      setFoundUsers(contacts);
      setLoadingContacts(false);
      return;
    }

    // Instant client-side search across contacts (zero delay)
    const localMatches = contacts.filter((u: any) => {
      const name = (u.full_name || u.name || u.pseudo || u.email || '').toLowerCase();
      return name.includes(q);
    });
    setFoundUsers(localMatches);

    // Asynchronous backend search in background (non-blocking)
    try {
      const results = await chatService.searchContacts(query);
      if (results && results.length > 0) {
        const map = new Map();
        localMatches.forEach(u => map.set(String(u.id), u));
        results.forEach(u => {
          const name = (u.full_name || u.name || u.pseudo || u.email || '').toLowerCase();
          if (name.includes(q)) map.set(String(u.id), u);
        });
        setFoundUsers(Array.from(map.values()));
      }
    } catch (e) {
      // Keep instant local matches if backend search fails
    }
  };

  const toggleSelectUser = (u: any) => {
    const uId = String(u.id);
    const exists = selectedUserIds.some(id => String(id) === uId);
    if (exists) {
      setSelectedUserIds(prev => prev.filter(id => String(id) !== uId));
      setSelectedUsersMap(prev => {
        const next = { ...prev };
        delete next[uId];
        return next;
      });
    } else {
      setSelectedUserIds(prev => [...prev, u.id]);
      setSelectedUsersMap(prev => ({ ...prev, [uId]: u }));
    }
  };

  const openDirectModal = () => {
    setUserSearchQuery('');
    loadContacts();
    setDirectModalVisible(true);
  };

  const openGroupModal = () => {
    setGroupName('');
    setGroupDesc('');
    setSelectedUserIds([]);
    setSelectedUsersMap({});
    setUserSearchQuery('');
    loadContacts();
    setGroupModalVisible(true);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleStartDirectChat = async (targetUser: any) => {
    setDirectModalVisible(false);
    try {
      const result = await chatService.getOrCreateDirectChat(targetUser.id);
      const chatRoom = result.chatRoom || result;
      const titleName = targetUser.full_name || targetUser.pseudo || targetUser.name || 'Chat';
      const logoPath = targetUser.profile_image || targetUser.avatar;

      await loadData(true);
      navigation.navigate('ChatRoom', {
        chatRoomId: chatRoom.id,
        name: titleName,
        logo: logoPath,
        type: 'direct',
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start direct chat.');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    setIsCreatingGroup(true);
    try {
      // 1. Create the group chat room
      const created = await chatService.createGroupChat(groupName.trim(), selectedUserIds, groupDesc.trim());

      // 2. Send group invitations to all selected member IDs
      for (const uId of selectedUserIds) {
        try {
          await chatService.sendGroupInvite(created.id, uId);
        } catch (inviteErr) {
          console.error(`Invite failed for user ${uId}:`, inviteErr);
        }
      }

      setGroupModalVisible(false);
      await loadData(true);

      navigation.navigate('ChatRoom', {
        chatRoomId: created.id,
        name: groupName.trim(),
        type: 'group',
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create group.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleRespondInvite = async (invite: any, accept: boolean) => {
    try {
      await chatService.respondToInvite(invite.id, accept);
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
      setAllInvites(prev => prev.map(i => i.id === invite.id ? { ...i, status: accept ? 'accepted' : 'declined' } : i));
      if (detailInviteModal?.id === invite.id) {
        setDetailInviteModal(null);
      }
      if (accept) loadData(true);
      Alert.alert(
        accept ? 'Joined Group! 🌱' : 'Invitation Declined',
        accept ? `You joined ${invite.chat_room_name || invite.chat_room?.name || 'the group'}.` : 'Invitation declined.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not respond to invite.');
    }
  };

  const handleCancelInvite = async (invite: any) => {
    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel invitation for ${invite.chat_room_name || invite.chat_room?.name || 'this group'}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Invite',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.cancelGroupInvite(invite.id);
              setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
              setAllInvites(prev => prev.filter(i => i.id !== invite.id));
              if (detailInviteModal?.id === invite.id) setDetailInviteModal(null);
              Alert.alert('Cancelled', 'Group invitation cancelled.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not cancel invitation.');
            }
          },
        },
      ]
    );
  };

  const openChat = (item: any) => {
    const titleName = resolveName(item, user);
    const logoUrl = resolveAvatar(item, user);
    navigation.navigate('ChatRoom', {
      chatRoomId: item.id,
      name: titleName,
      logo: logoUrl,
      type: item.isGroup ? 'group' : 'direct',
    });
  };

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

  const renderAvatarView = (item: any, size = 52) => {
    const avatarUrl = resolveAvatar(item, user);
    return (
      <View style={{ width: size, height: size }}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
            <Ionicons
              name={item.isGroup ? 'people-sharp' : 'person-sharp'}
              size={size * 0.4}
              color={AppColors.primary}
            />
          </View>
        )}
      </View>
    );
  };

  const renderConversation = ({ item }: { item: any }) => {
    const unread = item.unreadCount ?? 0;
    const name = resolveName(item, user);
    const lastMsg = resolveLastMessage(item);
    const timeStr = formatConvTime(item.lastMessageTime || item.lastMessage?.created_at || item.createdAt);

    return (
      <TouchableOpacity
        style={styles.convRow}
        activeOpacity={0.7}
        onPress={() => openChat(item)}
      >
        {renderAvatarView(item)}

        <View style={styles.convContent}>
          <View style={styles.convHeader}>
            <Text style={[styles.convName, unread > 0 && styles.convNameUnread]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.convTime, unread > 0 && styles.convTimeUnread]}>{timeStr}</Text>
          </View>
          <View style={styles.convFooter}>
            <Text style={[styles.convPreview, unread > 0 && styles.convPreviewUnread]} numberOfLines={1}>
              {item.isGroup ? '👥 ' : ''}{lastMsg}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'pending': return { label: 'Pending', bg: '#FEF3C7', color: '#B45309' };
      case 'accepted': return { label: 'Accepted', bg: '#D1FAE5', color: '#059669' };
      case 'declined': return { label: 'Declined', bg: '#FEE2E2', color: '#DC2626' };
      case 'expired': return { label: 'Expired', bg: '#F3F4F6', color: '#6B7280' };
      default: return { label: status, bg: '#DBEAFE', color: '#1E40AF' };
    }
  };

  const renderInviteItem = ({ item }: { item: any }) => {
    const status = (item.status || 'pending').toLowerCase();
    const badge = getStatusBadgeStyle(status);
    const { text: expiresText, isExpired } = getExpiresInText(item.expires_at || item.expiresAt);
    const desc = item.group_description || item.description || '';
    const isExpanded = !!expandedInviteIds[String(item.id)];
    const groupTitle = item.chat_room_name || item.chat_room?.name || 'Community Group';
    const inviterName = item.inviter?.full_name || item.inviter?.pseudo || 'A Community Member';
    const isOwnSent = String(item.inviter?.id) === String(user?.id);

    return (
      <TouchableOpacity
        style={styles.inviteCard}
        activeOpacity={0.9}
        onPress={() => setDetailInviteModal(item)}
      >
        <View style={styles.inviteCardHeader}>
          <View style={styles.inviteAvatar}>
            <Ionicons name="people-sharp" size={26} color={AppColors.primary} />
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.inviteGroupTitle}>{groupTitle}</Text>
        <Text style={styles.inviteSubTitle}>
          {isOwnSent ? 'Sent by you' : `Invited by ${inviterName}`}
        </Text>

        {desc ? (
          <View style={styles.inviteDescBox}>
            <Text style={styles.inviteDescText} numberOfLines={isExpanded ? undefined : 3}>
              {desc}
            </Text>
            {desc.length > 80 && (
              <TouchableOpacity
                onPress={() => setExpandedInviteIds(prev => ({ ...prev, [String(item.id)]: !isExpanded }))}
                style={{ marginTop: 4 }}
              >
                <Text style={styles.readMoreText}>{isExpanded ? 'Read less' : 'Read more'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {status === 'pending' && expiresText ? (
          <Text style={[styles.expiresText, isExpired && { color: '#DC2626' }]}>
            {expiresText}
          </Text>
        ) : null}

        {/* Action Buttons */}
        {status === 'pending' && !isExpired ? (
          <View style={styles.inviteActionsRow}>
            {isOwnSent ? (
              <TouchableOpacity
                style={[styles.inviteActionBtn, styles.declineBtn, { flex: 1 }]}
                onPress={() => handleCancelInvite(item)}
              >
                <Text style={styles.declineBtnText}>Cancel Invite</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.inviteActionBtn, styles.declineBtn]}
                  onPress={() => handleRespondInvite(item, false)}
                >
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteActionBtn, styles.acceptBtn]}
                  onPress={() => handleRespondInvite(item, true)}
                >
                  <Text style={styles.acceptBtnText}>Join Group</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // ── Main Render ─────────────────────────────────────────────────────────────

  const invitesDisplayList = inviteSubTab === 'pending' ? pendingInvites : allInvites;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <Text style={styles.headerSub}>{totalUnread} unread message{totalUnread > 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.composeBtn} onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={22} color={AppColors.textDark} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={AppColors.textMedium} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search conversations..."
          placeholderTextColor={AppColors.textMedium}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={AppColors.textMedium} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Main Navigation Tabs ── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mainTab === 'chats' && styles.tabActive]}
          onPress={() => setMainTab('chats')}
        >
          <Text style={[styles.tabText, mainTab === 'chats' && styles.tabTextActive]}>
            Chats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mainTab === 'invites' && styles.tabActive]}
          onPress={() => setMainTab('invites')}
        >
          <Text style={[styles.tabText, mainTab === 'invites' && styles.tabTextActive]}>Invites</Text>
          {pendingInvites.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingInvites.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Invites Sub-Tabs ── */}
      {mainTab === 'invites' && (
        <View style={styles.subTabRow}>
          <TouchableOpacity
            style={[styles.subTab, inviteSubTab === 'pending' && styles.subTabActive]}
            onPress={() => setInviteSubTab('pending')}
          >
            <Text style={[styles.subTabText, inviteSubTab === 'pending' && styles.subTabTextActive]}>
              Pending ({pendingInvites.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, inviteSubTab === 'all' && styles.subTabActive]}
            onPress={() => setInviteSubTab('all')}
          >
            <Text style={[styles.subTabText, inviteSubTab === 'all' && styles.subTabTextActive]}>
              All ({allInvites.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content List ── */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : mainTab === 'invites' ? (
        invitesDisplayList.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="mail-open-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {inviteSubTab === 'pending' ? 'No pending group invites' : 'No group invites found'}
            </Text>
            <Text style={styles.emptySub}>
              {inviteSubTab === 'pending'
                ? 'You have no pending invitations right now.'
                : 'You have not received or sent any group invitations yet.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={invitesDisplayList}
            keyExtractor={item => String(item.id)}
            renderItem={renderInviteItem}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
          />
        )
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubble-ellipses-outline" size={60} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No results found' : 'No conversations yet'}
          </Text>
          <Text style={styles.emptySub}>
            {searchQuery ? 'Try a different search term' : 'Start a conversation or join a group!'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={styles.emptyActionBtn} onPress={openDirectModal}>
              <Ionicons name="create-outline" size={18} color="white" />
              <Text style={styles.emptyActionText}>New Message</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderConversation}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listPad}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openDirectModal}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses-sharp" size={24} color="white" />
      </TouchableOpacity>

      {/* ── Actions Menu Sheet ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Message Options</Text>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setMenuVisible(false);
                openDirectModal();
              }}
            >
              <View style={styles.sheetIcon}>
                <Ionicons name="person-add-outline" size={22} color={AppColors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetItemTitle}>New Message</Text>
                <Text style={styles.sheetItemSub}>Start a private conversation with mutual friends</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setMenuVisible(false);
                openGroupModal();
              }}
            >
              <View style={styles.sheetIcon}>
                <Ionicons name="people-outline" size={22} color={AppColors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetItemTitle}>Create Group Chat</Text>
                <Text style={styles.sheetItemSub}>Create a new group and send invitations to members</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                setMenuVisible(false);
                setMainTab('invites');
              }}
            >
              <View style={styles.sheetIcon}>
                <Ionicons name="mail-outline" size={22} color={AppColors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetItemTitle}>Group Invites</Text>
                <Text style={styles.sheetItemSub}>
                  {pendingInvites.length > 0
                    ? `${pendingInvites.length} pending invitation${pendingInvites.length > 1 ? 's' : ''}`
                    : 'No pending invitations'}
                </Text>
              </View>
              {pendingInvites.length > 0 && (
                <View style={styles.sheetBadge}>
                  <Text style={styles.sheetBadgeText}>{pendingInvites.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── New Direct Message Modal ── */}
      <Modal
        visible={directModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDirectModalVisible(false)}
      >
        <SafeAreaView style={styles.fullModalSafe}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity onPress={() => setDirectModalVisible(false)}>
              <Ionicons name="close" size={26} color={AppColors.textDark} />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>New Message</Text>
            <TouchableOpacity
              onPress={() => {
                setDirectModalVisible(false);
                openGroupModal();
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="people-outline" size={24} color={AppColors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchWrap}>
            <Ionicons name="search-outline" size={18} color={AppColors.textMedium} />
            <TextInput
              style={styles.searchInput}
              value={userSearchQuery}
              onChangeText={handleUserSearch}
              placeholder="Search users..."
              placeholderTextColor={AppColors.textMedium}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {userSearchQuery ? 'Search Results' : 'Contacts & Friends'}
            </Text>
          </View>

          {loadingContacts ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={AppColors.primary} />
              <Text style={{ marginTop: 8, fontSize: 13, color: AppColors.textMedium }}>Loading friends...</Text>
            </View>
          ) : foundUsers.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySub}>
                {userSearchQuery ? 'Try a different search term' : 'No friends or contacts available yet'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={foundUsers}
              keyExtractor={u => String(u.id)}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item: u }) => {
                const avatar = u.profile_image ? UrlHelper.convertPathToUrl(u.profile_image) : null;
                const displayName = u.full_name || u.name || u.pseudo || 'User';
                return (
                  <TouchableOpacity
                    style={styles.userPickRow}
                    onPress={() => handleStartDirectChat(u)}
                  >
                    <View style={{ position: 'relative' }}>
                      {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.userPickAvatar} />
                      ) : (
                        <View style={[styles.userPickAvatar, styles.avatarFallback]}>
                          <Ionicons name="person" size={20} color={AppColors.primary} />
                        </View>
                      )}
                      {u.is_online || u.isOnline ? <View style={styles.onlineBadge} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userPickName}>{displayName}</Text>
                      {u.pseudo ? <Text style={styles.userPickSub}>@{u.pseudo}</Text> : null}
                    </View>
                    <Ionicons name="chatbubble-outline" size={22} color={AppColors.primary} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Create Group Chat Modal (Multi-Select Members & Send Invitations) ── */}
      <Modal
        visible={groupModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <SafeAreaView style={styles.fullModalSafe}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity onPress={() => setGroupModalVisible(false)}>
              <Ionicons name="close" size={26} color={AppColors.textDark} />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>Create Group Chat</Text>
            <TouchableOpacity onPress={handleCreateGroup} disabled={isCreatingGroup || !groupName.trim()}>
              {isCreatingGroup ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <Text style={[styles.saveBtnText, (!groupName.trim()) && { opacity: 0.4 }]}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Group Name *</Text>
            <TextInput
              style={styles.formInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g. Eco Action Team"
              placeholderTextColor={AppColors.textMedium}
            />

            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.formInput, { height: 75, textAlignVertical: 'top' }]}
              value={groupDesc}
              onChangeText={setGroupDesc}
              placeholder="Describe the group purpose..."
              placeholderTextColor={AppColors.textMedium}
              multiline
            />

            {/* Selected Invites Pinned Chips Header */}
            {Object.keys(selectedUsersMap).length > 0 && (
              <View style={styles.selectedChipsWrap}>
                <Text style={styles.selectedChipsLabel}>
                  Selected Invites ({Object.keys(selectedUsersMap).length}):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollPad}>
                  {Object.values(selectedUsersMap).map(u => {
                    const avatar = u.profile_image ? UrlHelper.convertPathToUrl(u.profile_image) : null;
                    const displayName = u.full_name || u.name || u.pseudo || 'User';
                    return (
                      <View key={String(u.id)} style={styles.userChip}>
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={styles.chipAvatar} />
                        ) : (
                          <View style={[styles.chipAvatar, styles.avatarFallback]}>
                            <Ionicons name="person" size={10} color={AppColors.primary} />
                          </View>
                        )}
                        <Text style={styles.chipName} numberOfLines={1}>{displayName}</Text>
                        <TouchableOpacity onPress={() => toggleSelectUser(u)} style={styles.chipRemoveBtn}>
                          <Ionicons name="close-circle" size={16} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
              <Text style={styles.inputLabel}>Invite Members</Text>
            </View>

            <View style={styles.modalSearchWrap}>
              <Ionicons name="search-outline" size={18} color={AppColors.textMedium} />
              <TextInput
                style={styles.searchInput}
                value={userSearchQuery}
                onChangeText={handleUserSearch}
                placeholder="Search friends to invite..."
                placeholderTextColor={AppColors.textMedium}
              />
            </View>

            {loadingContacts ? (
              <ActivityIndicator size="small" color={AppColors.primary} style={{ marginVertical: 12 }} />
            ) : (
              foundUsers.map(u => {
                const isSelected = selectedUserIds.some(id => String(id) === String(u.id));
                const avatar = u.profile_image ? UrlHelper.convertPathToUrl(u.profile_image) : null;
                const displayName = u.full_name || u.name || u.pseudo;
                return (
                  <TouchableOpacity
                    key={String(u.id)}
                    style={[styles.userPickRow, isSelected && styles.userPickRowSelected]}
                    onPress={() => toggleSelectUser(u)}
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.userPickAvatar} />
                    ) : (
                      <View style={[styles.userPickAvatar, styles.avatarFallback]}>
                        <Ionicons name="person" size={20} color={AppColors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userPickName, isSelected && { color: AppColors.primary }]}>{displayName}</Text>
                      {u.pseudo ? <Text style={styles.userPickSub}>@{u.pseudo}</Text> : null}
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? AppColors.primary : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Group Invite Detail Modal ── */}
      <Modal
        visible={!!detailInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailInviteModal(null)}
      >
        {detailInviteModal && (() => {
          const inv = detailInviteModal;
          const status = (inv.status || 'pending').toLowerCase();
          const badge = getStatusBadgeStyle(status);
          const { text: expiresText, isExpired } = getExpiresInText(inv.expires_at || inv.expiresAt);
          const groupTitle = inv.chat_room_name || inv.chat_room?.name || 'Community Group';
          const inviterName = inv.inviter?.full_name || inv.inviter?.pseudo || 'A Community Member';
          const inviterAvatar = inv.inviter?.profile_image ? UrlHelper.convertPathToUrl(inv.inviter.profile_image) : null;
          const memberCount = inv.chat_room?.members_count || inv.members_count || inv.memberCount || 1;
          const sentDateStr = formatFullDateTime(inv.created_at || inv.createdAt);
          const desc = inv.group_description || inv.description || '';
          const isOwnSent = String(inv.inviter?.id) === String(user?.id);

          return (
            <SafeAreaView style={styles.fullModalSafe}>
              <View style={styles.fullModalHeader}>
                <TouchableOpacity onPress={() => setDetailInviteModal(null)}>
                  <Ionicons name="chevron-back" size={24} color={AppColors.textDark} />
                </TouchableOpacity>
                <Text style={styles.fullModalTitle}>Group Invitation</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
                {/* Hero Section */}
                <View style={styles.detailHero}>
                  <View style={styles.detailAvatarWrap}>
                    <Ionicons name="people" size={60} color={AppColors.primary} />
                  </View>
                  <Text style={styles.detailGroupTitle}>{groupTitle}</Text>

                  <View style={styles.invitedPill}>
                    <Ionicons name="mail" size={16} color={AppColors.primary} />
                    <Text style={styles.invitedPillText}>You've been invited!</Text>
                  </View>
                </View>

                {/* Description */}
                {desc ? (
                  <View style={styles.detailDescBox}>
                    <Text style={styles.detailDescText}>{desc}</Text>
                  </View>
                ) : null}

                {/* Details Grid (2x2) */}
                <View style={styles.detailsGrid}>
                  {/* Invited By */}
                  <View style={styles.gridCard}>
                    <View style={styles.gridCardHeader}>
                      <Ionicons name="person-add" size={16} color={AppColors.primary} />
                      <Text style={styles.gridCardLabel}>INVITED BY</Text>
                    </View>
                    <View style={styles.gridCardUserRow}>
                      {inviterAvatar ? (
                        <Image source={{ uri: inviterAvatar }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                      ) : (
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: AppColors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="person" size={12} color={AppColors.primary} />
                        </View>
                      )}
                      <Text style={styles.gridCardValue} numberOfLines={1}>{inviterName}</Text>
                    </View>
                  </View>

                  {/* Sent Date */}
                  <View style={styles.gridCard}>
                    <View style={styles.gridCardHeader}>
                      <Ionicons name="time" size={16} color={AppColors.primary} />
                      <Text style={styles.gridCardLabel}>SENT</Text>
                    </View>
                    <Text style={styles.gridCardValue}>{sentDateStr}</Text>
                  </View>

                  {/* Expires */}
                  <View style={styles.gridCard}>
                    <View style={styles.gridCardHeader}>
                      <Ionicons name="hourglass" size={16} color="#B45309" />
                      <Text style={[styles.gridCardLabel, { color: '#B45309' }]}>EXPIRES</Text>
                    </View>
                    <Text style={styles.gridCardValue}>{expiresText || 'N/A'}</Text>
                  </View>

                  {/* Members */}
                  <View style={styles.gridCard}>
                    <View style={styles.gridCardHeader}>
                      <Ionicons name="people" size={16} color={AppColors.primary} />
                      <Text style={styles.gridCardLabel}>MEMBERS</Text>
                    </View>
                    <Text style={styles.gridCardValue}>{memberCount} member{memberCount > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </ScrollView>

              {/* Sticky Footer */}
              {status === 'pending' && !isExpired ? (
                <View style={styles.detailFooter}>
                  {isOwnSent ? (
                    <TouchableOpacity
                      style={[styles.inviteActionBtn, styles.declineBtn, { flex: 1 }]}
                      onPress={() => handleCancelInvite(inv)}
                    >
                      <Text style={styles.declineBtnText}>Cancel Invitation</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.inviteActionBtn, styles.declineBtn, { flex: 1 }]}
                        onPress={() => handleRespondInvite(inv, false)}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.inviteActionBtn, styles.acceptBtn, { flex: 2 }]}
                        onPress={() => handleRespondInvite(inv, true)}
                      >
                        <Text style={styles.acceptBtnText}>Join Group</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : null}
            </SafeAreaView>
          );
        })()}
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 11, color: AppColors.primary, fontWeight: '600', marginTop: 1 },
  composeBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Search ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 0 },

  // ── Tabs ──
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tabActive: { backgroundColor: AppColors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },

  // ── Sub-Tabs (Invites) ──
  subTabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  subTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabActive: {
    backgroundColor: AppColors.primary + '20',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  subTabText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  subTabTextActive: { color: AppColors.primary },

  // ── List ──
  listPad: { paddingBottom: 80, paddingTop: 4 },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 82 },

  // ── Conversation Row ──
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  avatarFallback: {
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primary + '25',
  },
  convContent: { flex: 1, minWidth: 0 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  convName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  convNameUnread: { fontWeight: '800', color: '#000000' },
  convTime: { fontSize: 11, color: '#9CA3AF', flexShrink: 0 },
  convTimeUnread: { color: AppColors.primary, fontWeight: '700' },
  convFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convPreview: { fontSize: 13, color: '#6B7280', flex: 1 },
  convPreviewUnread: { color: '#374151', fontWeight: '600' },
  unreadBadge: {
    backgroundColor: AppColors.primary,
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  unreadBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  // ── Invite Card ──
  inviteCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: AppColors.primary + '30',
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  inviteGroupTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 2 },
  inviteSubTitle: { fontSize: 13, color: '#6B7280', fontWeight: '500', marginBottom: 10 },
  inviteDescBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  inviteDescText: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  readMoreText: { fontSize: 12, fontWeight: '700', color: AppColors.primary },
  expiresText: { fontSize: 12, fontWeight: '700', color: '#B45309', marginTop: 4, textAlign: 'center' },
  inviteActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  inviteActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  declineBtnText: { fontSize: 14, fontWeight: '700', color: '#4B5563' },
  acceptBtn: {
    backgroundColor: AppColors.primary,
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Empty State ──
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#6B7280' },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 16 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  emptyActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, backgroundColor: AppColors.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
  },
  emptyActionText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Floating Action Button ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Compose Bottom Sheet ──
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 16,
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sheetIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: AppColors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetItemTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sheetItemSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sheetBadge: {
    backgroundColor: AppColors.primary, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  sheetBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  // ── Full Modal ──
  fullModalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  fullModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  fullModalTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: AppColors.primary },
  modalSearchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    marginHorizontal: 16, marginVertical: 8, borderRadius: 12, paddingHorizontal: 12, height: 42, gap: 8,
  },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F9FAFB' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  userPickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  userPickAvatar: { width: 44, height: 44, borderRadius: 22 },
  userPickName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  userPickSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  onlineBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF',
  },

  // ── Form Controls ──
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  formInput: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827', marginBottom: 12,
  },

  // ── Invite Detail Modal Styles ──
  detailHero: { alignItems: 'center', marginVertical: 16 },
  detailAvatarWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: AppColors.primary + '30',
    marginBottom: 16,
  },
  detailGroupTitle: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
  invitedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: AppColors.primary + '15',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: AppColors.primary + '30',
  },
  invitedPillText: { fontSize: 13, fontWeight: '700', color: AppColors.primary },
  detailDescBox: {
    backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginVertical: 12,
  },
  detailDescText: { fontSize: 14, color: '#374151', lineHeight: 20, textAlign: 'center' },
  detailsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 16,
  },
  gridCard: {
    width: '48%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  gridCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  gridCardLabel: { fontSize: 10, fontWeight: '800', color: AppColors.primary, letterSpacing: 0.5 },
  gridCardValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  gridCardUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 24,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },

  // ── Selected User Chips ──
  selectedChipsWrap: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 10,
  },
  selectedChipsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsScrollPad: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.primary + '50',
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  chipName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    maxWidth: 90,
  },
  chipRemoveBtn: {
    marginLeft: 2,
  },
  userPickRowSelected: {
    backgroundColor: AppColors.primary + '0D',
  },
});
