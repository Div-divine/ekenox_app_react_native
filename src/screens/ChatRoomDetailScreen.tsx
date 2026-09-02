import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Alert, TextInput, FlatList, Modal, Switch,
  RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import chatService from '../services/chatService';
import { UrlHelper } from '../utils/urlHelper';

const { width: SW } = Dimensions.get('window');

// ── Role constants matching API (ekenox_members_role.roles) ──
const ROLE_OWNER  = 200;
const ROLE_ADMIN  = 201;
const ROLE_MEMBER = 202;

type RouteParams = {
  chatRoomId: string | number;
  name: string;
  type?: 'direct' | 'group';
};

type TabName = 'info' | 'media' | 'members';

export default function ChatRoomDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { chatRoomId, type } = route.params;
  const { user: currentUser } = useAuth();

  const [room, setRoom]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>('info');

  // Media tab
  const [media, setMedia]       = useState<any[]>([]);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'document' | undefined>(undefined);
  const [mediaLoading, setMediaLoading] = useState(false);

  // Edit group modal
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName]       = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [editPrivate, setEditPrivate] = useState(false);
  const [editImage, setEditImage]     = useState<any>(null);
  const [editSaving, setEditSaving]   = useState(false);

  // Member action modal
  const [memberModal, setMemberModal]     = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // ── Derived state ──
  const myId = String(currentUser?.id);
  const myMemberData = room?.members?.find((m: any) => String(m.id) === myId);
  const myRoleIds: number[] = myMemberData?.role_ids ?? [];
  const myRoleNames: string[] = myMemberData?.role_names ?? [];
  const amOwner = Boolean(myMemberData?.is_owner) || myRoleIds.includes(ROLE_OWNER) || myRoleNames.includes('CHATROOM_OWNER');
  const amAdmin = Boolean(myMemberData?.is_admin) || myRoleIds.includes(ROLE_ADMIN) || myRoleNames.includes('CHATROOM_ADMIN') || amOwner;

  const loadRoom = useCallback(async () => {
    try {
      const data = await chatService.getRoomDetail(chatRoomId);
      setRoom(data);
      setEditName(data.name ?? '');
      setEditDesc(data.description ?? '');
      setEditPrivate(data.is_private ?? false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load room details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chatRoomId]);

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      const items = await chatService.getSharedMedia(chatRoomId, mediaType);
      setMedia(items);
    } catch (e) {
      // silent
    } finally {
      setMediaLoading(false);
    }
  }, [chatRoomId, mediaType]);

  useEffect(() => { loadRoom(); }, [loadRoom]);
  useEffect(() => { if (activeTab === 'media') loadMedia(); }, [activeTab, loadMedia]);

  const handleRefresh = () => { setRefreshing(true); loadRoom(); };

  // ── Mute ──
  const handleMute = () => {
    const isMuted = room?.is_muted;
    if (isMuted) {
      Alert.alert('Unmute', 'Unmute notifications for this chat?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmute', onPress: async () => {
            await chatService.muteRoom(chatRoomId, 0);
            loadRoom();
          }
        },
      ]);
    } else {
      Alert.alert('Mute Notifications', 'For how long?', [
        { text: '1 hour', onPress: () => doMute(1) },
        { text: '8 hours', onPress: () => doMute(8) },
        { text: '24 hours', onPress: () => doMute(24) },
        { text: '1 week', onPress: () => doMute(168) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const doMute = async (hours: number) => {
    try { await chatService.muteRoom(chatRoomId, hours); loadRoom(); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  // ── Leave ──
  const handleLeave = () => {
    Alert.alert(
      'Leave Chat',
      amOwner && room?.is_group
        ? 'You are the owner. Transfer ownership before leaving, or if you are the last member the group will be disbanded.'
        : 'Are you sure you want to leave this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive', onPress: async () => {
            try {
              await chatService.leaveRoom(chatRoomId);
              navigation.popToTop();
            } catch (e: any) { Alert.alert('Error', e.message); }
          }
        },
      ]
    );
  };

  // ── Edit group ──
  const handlePickGroupImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets.length > 0) setEditImage(res.assets[0]);
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      await chatService.updateGroup(chatRoomId, { name: editName, description: editDesc, is_private: editPrivate }, editImage);
      setEditVisible(false);
      loadRoom();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setEditSaving(false); }
  };

  // ── Member actions ──
  const openMemberActions = (member: any) => {
    if (String(member.id) === myId) return; // no actions on self
    setSelectedMember(member);
    setMemberModal(true);
  };

  const memberRoleIds: number[] = selectedMember?.role_ids ?? [];
  const memberRoleNames: string[] = selectedMember?.role_names ?? [];
  const memberIsOwner = Boolean(selectedMember?.is_owner) || memberRoleIds.includes(ROLE_OWNER) || memberRoleNames.includes('CHATROOM_OWNER');
  const memberIsAdmin = Boolean(selectedMember?.is_admin) || memberRoleIds.includes(ROLE_ADMIN) || memberRoleNames.includes('CHATROOM_ADMIN') || memberIsOwner;

  const handlePromote = async () => {
    setMemberModal(false);
    try {
      await chatService.promoteMember(chatRoomId, selectedMember.id);
      loadRoom();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleDemote = async () => {
    setMemberModal(false);
    try {
      await chatService.demoteMember(chatRoomId, selectedMember.id);
      loadRoom();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleTransferOwnership = async () => {
    setMemberModal(false);
    Alert.alert('Transfer Ownership', `Make ${selectedMember?.full_name} the new owner of this group? You will become an admin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer', onPress: async () => {
          try {
            await chatService.transferOwnership(chatRoomId, selectedMember.id);
            loadRoom();
          } catch (e: any) { Alert.alert('Error', e.message); }
        }
      },
    ]);
  };

  const handleKick = async () => {
    setMemberModal(false);
    Alert.alert('Remove Member', `Remove ${selectedMember?.full_name} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try { await chatService.removeMember(chatRoomId, selectedMember.id); loadRoom(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        }
      },
    ]);
  };

  // ── Render helpers ──
  const RoleBadge = ({ member }: { member: any }) => {
    const ids: number[] = member?.role_ids ?? [];
    const names: string[] = member?.role_names ?? [];
    if (member?.is_owner || ids.includes(ROLE_OWNER) || names.includes('CHATROOM_OWNER')) {
      return <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}><Text style={[styles.badgeText, { color: '#92400E' }]}>👑 Owner</Text></View>;
    }
    if (member?.is_admin || ids.includes(ROLE_ADMIN) || names.includes('CHATROOM_ADMIN')) {
      return <View style={[styles.badge, { backgroundColor: '#EDE9FE' }]}><Text style={[styles.badgeText, { color: '#5B21B6' }]}>⭐ Admin</Text></View>;
    }
    return <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}><Text style={[styles.badgeText, { color: '#374151' }]}>Member</Text></View>;
  };

  const MemberRow = ({ member }: { member: any }) => {
    const isMe = String(member.id) === myId;
    return (
      <View style={styles.memberRow}>
        <TouchableOpacity
          onPress={() => member.id && navigation.navigate('Profile', { userId: member.id })}
          activeOpacity={0.7}
        >
          <View style={styles.memberAvatar}>
            {member.avatar ? (
              <Image source={{ uri: UrlHelper.convertPathToUrl(member.avatar) }} style={styles.memberAvatarImg} />
            ) : (
              <View style={styles.memberAvatarPlaceholder}>
                <Text style={styles.memberAvatarInitial}>{(member.full_name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {member.is_muted && (
              <View style={styles.muteIndicator}><Ionicons name="volume-mute" size={8} color="white" /></View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingLeft: 12 }}
          onPress={() => member.id && navigation.navigate('Profile', { userId: member.id })}
          activeOpacity={0.7}
        >
          <Text style={styles.memberName}>{member.full_name}{isMe ? ' (You)' : ''}</Text>
          <Text style={styles.memberJoined}>Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '—'}</Text>
        </TouchableOpacity>
        <RoleBadge member={member} />
        {amAdmin && !isMe && (
          <TouchableOpacity onPress={() => openMemberActions(member)} style={{ paddingLeft: 6 }}>
            <Ionicons name="ellipsis-vertical" size={16} color={AppColors.textMedium} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const MediaItem = ({ item }: { item: any }) => {
    const filePath = item.file_path || item.filePath || '';
    const fullUrl = UrlHelper.convertPathToUrl(filePath);
    if (item.type === 'photo' || item.type === 'video') {
      return (
        <View style={styles.mediaThumb}>
          <Image source={{ uri: fullUrl }} style={styles.mediaThumbImg} resizeMode="cover" />
          {item.type === 'video' && (
            <View style={styles.videoOverlay}><Ionicons name="play-circle" size={28} color="white" /></View>
          )}
        </View>
      );
    }
    return (
      <View style={styles.docItem}>
        <Ionicons name="document-text" size={22} color={AppColors.primary} />
        <Text style={styles.docName} numberOfLines={1}>{item.file_name || 'Document'}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  const avatarUrl = room?.is_group
    ? (room.profile_image ? UrlHelper.convertPathToUrl(room.profile_image) : null)
    : (room?.other_user?.avatar ? UrlHelper.convertPathToUrl(room.other_user.avatar) : null);

  const displayName = room?.is_group
    ? (room.name ?? 'Group')
    : (room?.other_user?.full_name ?? 'Direct Chat');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Info</Text>
        {room?.is_group && amAdmin && (
          <TouchableOpacity onPress={() => setEditVisible(true)} style={styles.editBtn}>
            <Ionicons name="pencil" size={20} color={AppColors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={AppColors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar & Name ── */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name={room?.is_group ? 'people' : 'person'} size={44} color={AppColors.primary} />
              </View>
            )}
          </View>
          <Text style={styles.roomName}>{displayName}</Text>
          {room?.is_group && room?.description ? (
            <Text style={styles.roomDescription}>{room.description}</Text>
          ) : null}
          {room?.is_group && (
            <Text style={styles.memberCount}>{room.member_count} member{room.member_count !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* ── Action Row ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleMute}>
            <View style={styles.actionIconCircle}>
              <Ionicons name={room?.is_muted ? 'volume-high' : 'volume-mute'} size={20} color={AppColors.primary} />
            </View>
            <Text style={styles.actionLabel}>{room?.is_muted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ChatRoom', { chatRoomId })}>
            <View style={styles.actionIconCircle}>
              <Ionicons name="chatbubble" size={20} color={AppColors.primary} />
            </View>
            <Text style={styles.actionLabel}>Message</Text>
          </TouchableOpacity>

          {room?.is_group && amAdmin && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Invite', 'Coming soon: invite link / QR code')}>
              <View style={styles.actionIconCircle}>
                <Ionicons name="person-add" size={20} color={AppColors.primary} />
              </View>
              <Text style={styles.actionLabel}>Invite</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionBtn} onPress={handleLeave}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="exit" size={20} color="#DC2626" />
            </View>
            <Text style={[styles.actionLabel, { color: '#DC2626' }]}>Leave</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tabs ── */}
        {room?.is_group && (
          <View style={styles.tabBar}>
            {(['info', 'members', 'media'] as TabName[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Info Tab ── */}
        {(activeTab === 'info' || !room?.is_group) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            {room?.is_group && (
              <>
                <InfoRow icon="shield-checkmark-outline" label="Privacy" value={room.is_private ? 'Private' : 'Public'} />
                <InfoRow icon="calendar-outline" label="Created" value={room.created_at ? new Date(room.created_at).toLocaleDateString() : '—'} />
              </>
            )}
            {room?.muted_until && (
              <InfoRow icon="volume-mute-outline" label="Muted until" value={new Date(room.muted_until).toLocaleString()} />
            )}
          </View>
        )}

        {/* ── Members Tab ── */}
        {activeTab === 'members' && room?.is_group && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{room.member_count} Members</Text>
            {(room.members ?? []).map((m: any) => (
              <MemberRow key={String(m.id)} member={m} />
            ))}
          </View>
        )}

        {/* ── Media Tab ── */}
        {activeTab === 'media' && (
          <View style={styles.section}>
            {/* Filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {([undefined, 'photo', 'video', 'document'] as const).map(t => (
                <TouchableOpacity
                  key={String(t ?? 'all')}
                  style={[styles.pill, mediaType === t && styles.pillActive]}
                  onPress={() => setMediaType(t)}
                >
                  <Text style={[styles.pillText, mediaType === t && styles.pillTextActive]}>
                    {t ? t.charAt(0).toUpperCase() + t.slice(1) : 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {mediaLoading ? (
              <ActivityIndicator color={AppColors.primary} />
            ) : media.length === 0 ? (
              <Text style={styles.emptyText}>No media found</Text>
            ) : (
              <View style={styles.mediaGrid}>
                {media.map((item, i) => <MediaItem key={i} item={item} />)}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Edit Group Modal ── */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Group</Text>
            <TouchableOpacity onPress={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <ActivityIndicator size="small" color={AppColors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            {/* Group image picker */}
            <TouchableOpacity style={styles.editAvatarPicker} onPress={handlePickGroupImage}>
              {editImage ? (
                <Image source={{ uri: editImage.uri }} style={styles.editAvatarImg} />
              ) : room?.profile_image ? (
                <Image source={{ uri: UrlHelper.convertPathToUrl(room.profile_image) }} style={styles.editAvatarImg} />
              ) : (
                <View style={styles.editAvatarPlaceholder}>
                  <Ionicons name="camera" size={28} color={AppColors.primary} />
                  <Text style={styles.editAvatarLabel}>Change Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Group Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter group name"
              placeholderTextColor={AppColors.textMedium}
              maxLength={120}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Describe the group..."
              placeholderTextColor={AppColors.textMedium}
              multiline
              maxLength={500}
            />

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Private Group</Text>
                <Text style={styles.toggleSub}>Only invited members can join</Text>
              </View>
              <Switch value={editPrivate} onValueChange={setEditPrivate} trackColor={{ true: AppColors.primary }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Member Action Modal ── */}
      <Modal visible={memberModal} transparent animationType="slide" onRequestClose={() => setMemberModal(false)}>
        <TouchableOpacity style={styles.memberModalOverlay} activeOpacity={1} onPress={() => setMemberModal(false)} />
        <View style={[styles.memberModalSheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.memberModalHandle} />
          <Text style={styles.memberModalName}>{selectedMember?.full_name}</Text>
          <RoleBadge member={selectedMember} />

          {amOwner && !memberIsOwner && (
            <TouchableOpacity style={styles.memberAction} onPress={handleTransferOwnership}>
              <Ionicons name="key" size={20} color="#D97706" />
              <Text style={[styles.memberActionText, { color: '#D97706' }]}>Transfer Ownership</Text>
            </TouchableOpacity>
          )}

          {amAdmin && !memberIsAdmin && (
            <TouchableOpacity style={styles.memberAction} onPress={handlePromote}>
              <Ionicons name="star" size={20} color="#7C3AED" />
              <Text style={[styles.memberActionText, { color: '#7C3AED' }]}>Promote to Admin</Text>
            </TouchableOpacity>
          )}
          {amOwner && memberIsAdmin && !memberIsOwner && (
            <TouchableOpacity style={styles.memberAction} onPress={handleDemote}>
              <Ionicons name="star-outline" size={20} color={AppColors.textMedium} />
              <Text style={styles.memberActionText}>Remove Admin</Text>
            </TouchableOpacity>
          )}
          {amAdmin && !memberIsOwner && (
            <TouchableOpacity style={styles.memberAction} onPress={handleKick}>
              <Ionicons name="person-remove" size={20} color="#DC2626" />
              <Text style={[styles.memberActionText, { color: '#DC2626' }]}>Remove from Group</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.memberAction, { borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 6 }]} onPress={() => setMemberModal(false)}>
            <Text style={[styles.memberActionText, { color: AppColors.textMedium }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ── Small helper component ──
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={AppColors.primary} style={{ marginRight: 10 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: AppColors.textDark },
  editBtn: { padding: 4 },

  // Profile section
  profileSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: 'white', marginBottom: 8 },
  avatarWrapper: { marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  roomName: { fontSize: 20, fontWeight: '800', color: AppColors.textDark, marginBottom: 4 },
  roomDescription: { fontSize: 13, color: AppColors.textMedium, textAlign: 'center', paddingHorizontal: 32, marginTop: 4 },
  memberCount: { fontSize: 12, color: AppColors.textMedium, marginTop: 6 },

  // Action row
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, backgroundColor: 'white', marginBottom: 8 },
  actionBtn: { alignItems: 'center', minWidth: 64 },
  actionIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: AppColors.textDark },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: AppColors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: AppColors.textMedium },
  tabTextActive: { color: AppColors.primary },

  // Section
  section: { backgroundColor: 'white', marginHorizontal: 16, borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: AppColors.textMedium, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { flex: 1, fontSize: 14, color: AppColors.textDark },
  infoValue: { fontSize: 14, color: AppColors.textMedium },

  // Member rows
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  memberAvatar: { position: 'relative' },
  memberAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  memberAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  memberAvatarInitial: { fontSize: 16, fontWeight: '700', color: AppColors.primary },
  muteIndicator: { position: 'absolute', right: -2, bottom: -2, backgroundColor: '#6B7280', borderRadius: 6, padding: 2 },
  memberName: { fontSize: 14, fontWeight: '600', color: AppColors.textDark },
  memberJoined: { fontSize: 11, color: AppColors.textMedium, marginTop: 2 },

  // Role badge
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Media grid
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F3F4F6', marginRight: 8 },
  pillActive: { backgroundColor: AppColors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: AppColors.textDark },
  pillTextActive: { color: 'white' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  mediaThumb: { width: (SW - 35) / 3, height: (SW - 35) / 3, position: 'relative' },
  mediaThumbImg: { width: '100%', height: '100%', borderRadius: 6 },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6 },
  docItem: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#F9FAFB', borderRadius: 10, marginBottom: 8, gap: 10 },
  docName: { flex: 1, fontSize: 13, color: AppColors.textDark },
  emptyText: { color: AppColors.textMedium, textAlign: 'center', paddingVertical: 32, fontSize: 14 },

  // Edit modal
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCancel: { fontSize: 15, color: AppColors.textMedium, flex: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: AppColors.textDark },
  modalSave: { fontSize: 15, fontWeight: '700', color: AppColors.primary, flex: 1, textAlign: 'right' },
  editAvatarPicker: { alignSelf: 'center', marginBottom: 24 },
  editAvatarImg: { width: 90, height: 90, borderRadius: 45 },
  editAvatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  editAvatarLabel: { fontSize: 12, color: AppColors.primary, marginTop: 4 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: AppColors.textDark, marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: AppColors.textDark, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: AppColors.textDark },
  toggleSub: { fontSize: 12, color: AppColors.textMedium },

  // Member action sheet
  memberModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  memberModalSheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  memberModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 16 },
  memberModalName: { fontSize: 16, fontWeight: '700', color: AppColors.textDark, marginBottom: 8 },
  memberAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  memberActionText: { fontSize: 15, fontWeight: '600', color: AppColors.textDark },
});
