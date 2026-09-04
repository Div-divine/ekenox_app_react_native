import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import collaborationService, {
  CollaborationInquiry,
  CollaborationSummary,
} from '../services/collaborationService';
import chatService from '../services/chatService';
import { UrlHelper } from '../utils/urlHelper';
import { AppColors } from '../theme/colors';

export const CollaborationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'invitations'>('received');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [inquiries, setInquiries] = useState<CollaborationInquiry[]>([]);
  const [invitationLogs, setInvitationLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<CollaborationSummary | null>(null);
  const [myInvitations, setMyInvitations] = useState<any[]>([]);
  const [respondingInviteId, setRespondingInviteId] = useState<number | null>(null);

  // Cancellation Modal State for Sent Invites
  const [cancelInviteTarget, setCancelInviteTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancellingInvite, setIsCancellingInvite] = useState<boolean>(false);

  // Action Modal State (Accept / Decline / Complete)
  const [selectedInquiry, setSelectedInquiry] = useState<CollaborationInquiry | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'decline' | 'complete' | null>(null);
  const [actionNote, setActionNote] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Detail Modal State
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [detailInquiry, setDetailInquiry] = useState<CollaborationInquiry | null>(null);
  const [activeInviteForDetail, setActiveInviteForDetail] = useState<any | null>(null);

  const handleOpenInvitationDetail = async (inv: any) => {
    try {
      if (inv.inquiry) {
        setDetailInquiry(inv.inquiry);
        setActiveInviteForDetail(inv);
        setDetailModalVisible(true);
      } else {
        const details = await collaborationService.getInquiryDetails(inv.inquiry_id);
        setDetailInquiry(details);
        setActiveInviteForDetail(inv);
        setDetailModalVisible(true);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load collaboration details.');
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [summaryData, invitesData] = await Promise.all([
        collaborationService.getSummary().catch(() => null),
        collaborationService.getMyInvitations().catch(() => null),
      ]);
      setSummary(summaryData);
      setMyInvitations(invitesData?.invitations || []);

      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      if (activeTab === 'invitations') {
        const logsRes = await collaborationService.getInvitationLogs(statusParam).catch(() => ({ invitations: [] }));
        setInvitationLogs(logsRes.invitations || []);
        setInquiries([]);
      } else {
        const list =
          activeTab === 'received'
            ? await collaborationService.getReceivedInquiries(statusParam)
            : await collaborationService.getSentInquiries(statusParam);
        setInquiries(list || []);
      }
    } catch (err: any) {
      console.error('Failed to load inquiries:', err);
      Alert.alert('Error', 'Failed to load collaboration inquiries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, statusFilter]);

  const handleRespondInvitation = async (inviteId: number, action: 'accept' | 'decline') => {
    setRespondingInviteId(inviteId);
    try {
      const res = await collaborationService.respondToInvitation(inviteId, action);
      Alert.alert(
        action === 'accept' ? 'Invitation Accepted! 🎉' : 'Invitation Declined',
        res.message || (action === 'accept' ? 'You have joined the collaboration workspace.' : 'Invitation declined.')
      );
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to respond to invitation.');
    } finally {
      setRespondingInviteId(null);
    }
  };

  const handleConfirmCancelInvite = async () => {
    if (!cancelInviteTarget) return;
    setIsCancellingInvite(true);
    try {
      await collaborationService.cancelInvitation(
        cancelInviteTarget.id,
        cancelReason.trim() || undefined
      );
      Alert.alert('Invitation Cancelled', 'The collaboration invitation has been cancelled.');
      setCancelInviteTarget(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.message || 'Failed to cancel invitation.'
      );
    } finally {
      setIsCancellingInvite(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Execute Accept / Decline / Complete
  const handleConfirmAction = async () => {
    if (!selectedInquiry || !actionType) return;
    setSubmittingAction(true);
    try {
      if (actionType === 'accept') {
        await collaborationService.acceptInquiry(selectedInquiry.id, actionNote.trim() || undefined);
        Alert.alert('Inquiry Accepted', 'The collaboration inquiry has been accepted and the sender has been notified.');
      } else if (actionType === 'decline') {
        await collaborationService.declineInquiry(selectedInquiry.id, actionNote.trim() || undefined);
        Alert.alert('Inquiry Declined', 'The collaboration inquiry has been declined.');
      } else if (actionType === 'complete') {
        await collaborationService.completeInquiry(selectedInquiry.id, actionNote.trim() || undefined);
        Alert.alert('Collaboration Completed', 'Marked as completed!');
      }

      setActionType(null);
      setSelectedInquiry(null);
      setActionNote('');
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to perform action';
      Alert.alert('Error', msg);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Cancel Inquiry (Sender)
  const handleCancelInquiry = (inquiry: CollaborationInquiry) => {
    Alert.alert(
      'Cancel Proposal',
      `Are you sure you want to cancel your proposal "${inquiry.subject}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await collaborationService.cancelInquiry(inquiry.id);
              Alert.alert('Cancelled', 'Your proposal has been cancelled.');
              loadData();
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to cancel proposal';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  // Open Dedicated Collaboration Workspace Chat
  const handleStartChat = async (inquiry: CollaborationInquiry) => {
    try {
      const details = await collaborationService.getCollaborationChat(inquiry.id);
      const chatRoom = details?.chat_room;
      if (chatRoom?.id) {
        if (detailModalVisible) {
          setDetailModalVisible(false);
        }
        navigation.navigate('ChatRoom', {
          chatRoomId: chatRoom.id,
          name: chatRoom.name || `Collab: ${inquiry.subject}`,
          type: 'collaboration',
          isGroup: true,
          collaborationData: {
            inquiryId: inquiry.id,
            subject: inquiry.subject,
            collaborationType: inquiry.collaboration_type,
            budgetAmount: inquiry.budget_amount,
            currency: inquiry.currency,
            compensationType: inquiry.compensation_type,
            status: inquiry.status,
            targetDate: inquiry.target_date,
            sender: inquiry.sender,
            receiver: inquiry.receiver,
          },
        });
      } else {
        Alert.alert('Workspace', 'Could not open collaboration workspace room.');
      }
    } catch (err: any) {
      // Fallback to direct chat if not accepted yet
      const otherUser = activeTab === 'received' ? inquiry.sender : inquiry.receiver;
      try {
        const room = await chatService.getOrCreateDirectChat(otherUser.id);
        const directChatRoom = room?.chatRoom || room;
        if (directChatRoom?.id) {
          if (detailModalVisible) {
            setDetailModalVisible(false);
          }
          navigation.navigate('ChatRoom', {
            chatRoomId: directChatRoom.id,
            name: otherUser.full_name,
            logo: otherUser.profile_image,
            type: 'direct',
          });
        }
      } catch (fallbackErr: any) {
        Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to open chat.');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#D97706';
      case 'accepted':
        return '#059669';
      case 'declined':
        return '#DC2626';
      case 'completed':
        return '#4F46E5';
      case 'cancelled':
        return '#64748B';
      default:
        return '#64748B';
    }
  };

  const filteredInquiries = inquiries.filter((inq) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const otherUser = activeTab === 'received' ? inq.sender : inq.receiver;
    return (
      inq.subject.toLowerCase().includes(q) ||
      inq.message.toLowerCase().includes(q) ||
      inq.collaboration_type.toLowerCase().includes(q) ||
      (inq.organization_or_brand && inq.organization_or_brand.toLowerCase().includes(q)) ||
      (otherUser?.full_name && otherUser.full_name.toLowerCase().includes(q))
    );
  });

  const filteredInvitationLogs = invitationLogs.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (inv.inquiry_subject && inv.inquiry_subject.toLowerCase().includes(q)) ||
      (inv.email && inv.email.toLowerCase().includes(q)) ||
      (inv.invited_user?.full_name && inv.invited_user.full_name.toLowerCase().includes(q)) ||
      (inv.invited_by?.full_name && inv.invited_by.full_name.toLowerCase().includes(q)) ||
      (inv.role && inv.role.toLowerCase().includes(q)) ||
      (inv.message && inv.message.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Collaboration Hub</Text>
          <Text style={styles.headerSubtitle}>
            {summary ? `${summary.pending_received} pending • ${summary.total_sent} sent • ${summary.pending_invitations || 0} invites` : 'Manage proposals'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* ── Summary Stats Overview ── */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="hourglass-outline" size={16} color="#D97706" />
          </View>
          <View>
            <Text style={styles.statVal}>{summary?.pending_received || 0}</Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
          </View>
          <View>
            <Text style={styles.statVal}>{summary?.accepted_received || 0}</Text>
            <Text style={styles.statLbl}>Accepted</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="paper-plane-outline" size={16} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.statVal}>{summary?.total_sent || 0}</Text>
            <Text style={styles.statLbl}>Sent</Text>
          </View>
        </View>
      </View>

      {/* ── Primary Tabs: Received vs Sent vs Invitation Logs ── */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'received' && styles.activeTabBtn]}
          onPress={() => {
            setActiveTab('received');
            setStatusFilter('all');
          }}
        >
          <Ionicons
            name="mail-unread-outline"
            size={16}
            color={activeTab === 'received' ? '#4F46E5' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
            Received ({summary?.total_received || 0})
          </Text>
          {summary && summary.pending_received > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{summary.pending_received}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'sent' && styles.activeTabBtn]}
          onPress={() => {
            setActiveTab('sent');
            setStatusFilter('all');
          }}
        >
          <Ionicons
            name="paper-plane-outline"
            size={16}
            color={activeTab === 'sent' ? '#4F46E5' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
            Sent ({summary?.total_sent || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'invitations' && styles.activeTabBtn]}
          onPress={() => {
            setActiveTab('invitations');
            setStatusFilter('all');
          }}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'invitations' ? '#4F46E5' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'invitations' && styles.activeTabText]}>
            Invitations
          </Text>
          {summary && (summary.pending_invitations || 0) > 0 && (
            <View style={[styles.badgeCount, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.badgeCountText}>{summary.pending_invitations}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Received Collaboration Workspace Invitations (Quick banner when on Received/Sent tab) ── */}
      {activeTab !== 'invitations' && myInvitations.length > 0 && (
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="mail-unread" size={16} color="#4F46E5" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                Pending Workspace Invitations ({myInvitations.length})
              </Text>
            </View>
          </View>

          {myInvitations.map((inv) => {
            const isResponding = respondingInviteId === inv.id;
            return (
              <View
                key={inv.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: '#C7D2FE',
                  shadowColor: '#4F46E5',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 8 }} numberOfLines={1}>
                    📌 {inv.inquiry_subject}
                  </Text>
                  <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#4F46E5' }}>
                      {inv.role === 'CHATROOM_ADMIN' ? 'ADMIN INVITE' : 'COLLABORATOR INVITE'}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                  Invited by <Text style={{ fontWeight: '700', color: '#0F172A' }}>{inv.invited_by?.full_name || inv.invited_by?.pseudo || 'Partner'}</Text>
                </Text>

                {inv.message ? (
                  <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>
                      "{inv.message}"
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#EEF2FF',
                    paddingVertical: 7,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                  onPress={() => handleOpenInvitationDetail(inv)}
                >
                  <Ionicons name="document-text-outline" size={14} color="#4F46E5" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4F46E5' }}>
                    View Full Collaboration Details
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#F1F5F9',
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                    onPress={() => handleRespondInvitation(inv.id, 'decline')}
                    disabled={isResponding}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1.5,
                      backgroundColor: '#4F46E5',
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                    onPress={() => handleRespondInvitation(inv.id, 'accept')}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>Accept & Join Chat</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Search Bar ── */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, organization, subject..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Status Filter Chips ── */}
      <View style={{ height: 44 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilterBar}
        >
          {(activeTab === 'invitations'
            ? ['all', 'pending', 'accepted', 'declined', 'cancelled']
            : ['all', 'pending', 'accepted', 'completed', 'declined', 'cancelled']
          ).map((st) => {
            const isSelected = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.statusFilterChip, isSelected && styles.statusFilterChipSelected]}
                onPress={() => setStatusFilter(st)}
              >
                <Text
                  style={[
                    styles.statusFilterChipText,
                    isSelected && styles.statusFilterChipTextSelected,
                  ]}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List Content: Inquiries vs Invitation Logs ── */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Fetching collaboration data...</Text>
        </View>
      ) : activeTab === 'invitations' ? (
        <FlatList
          data={filteredInvitationLogs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="mail-unread-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No invitations found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No invitation records matched your search keyword.'
                  : statusFilter !== 'all'
                  ? `No ${statusFilter} invitations in your records.`
                  : 'All sent and received collaboration invitations will be logged here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = item.status === 'pending';
            const isAccepted = item.status === 'accepted';
            const isDeclined = item.status === 'declined';
            const isCancelled = item.status === 'cancelled';
            const statusColor = getStatusColor(item.status);
            const isResponding = respondingInviteId === item.id;

            return (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1, marginRight: 8 }} numberOfLines={1}>
                    📌 {item.inquiry_subject || 'Collaboration Workspace'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                  <Text style={{ fontWeight: '700' }}>To:</Text> {item.invited_user?.full_name || item.email} • Role:{' '}
                  <Text style={{ fontWeight: '700', color: '#4F46E5' }}>
                    {item.role === 'CHATROOM_ADMIN' ? 'Admin' : 'Member'}
                  </Text>
                </Text>

                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
                  Invited by <Text style={{ fontWeight: '700', color: '#0F172A' }}>{item.invited_by?.full_name || 'Owner'}</Text>
                  {item.created_at ? ` • ${new Date(item.created_at).toLocaleDateString()}` : ''}
                </Text>

                {item.message ? (
                  <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
                      "{item.message}"
                    </Text>
                  </View>
                ) : null}

                {item.cancellation_reason ? (
                  <View style={{ backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Text style={{ fontSize: 11, color: '#991B1B' }}>
                      Cancellation Reason: "{item.cancellation_reason}"
                    </Text>
                  </View>
                ) : null}

                {/* View Full Collaboration Details Link */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#EEF2FF',
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                  onPress={() => handleOpenInvitationDetail(item)}
                >
                  <Ionicons name="document-text-outline" size={14} color="#4F46E5" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4F46E5' }}>
                    View Full Collaboration Details
                  </Text>
                </TouchableOpacity>

                {/* Actions Row */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  {isPending && (
                    <>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: '#F1F5F9',
                          paddingVertical: 8,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          setCancelInviteTarget(item);
                          setCancelReason('');
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>Cancel Invite</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flex: 1.5,
                          backgroundColor: '#4F46E5',
                          paddingVertical: 8,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                        onPress={() => handleRespondInvitation(item.id, 'accept')}
                        disabled={isResponding}
                      >
                        {isResponding ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>Accept & Join</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {isAccepted && (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: '#4F46E5',
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={() => handleStartChat(item.inquiry || { id: item.inquiry_id, subject: item.inquiry_subject })}
                    >
                      <Ionicons name="chatbubbles" size={14} color="#FFF" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>Open Workspace Chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={filteredInquiries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No collaboration proposals</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No inquiries matched your search keyword.'
                  : activeTab === 'received'
                  ? 'Incoming proposals from creators and brands will appear here.'
                  : 'You have not submitted any collaboration inquiries in this category.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const otherUser = activeTab === 'received' ? item.sender : item.receiver;
            const avatarUri = otherUser?.profile_image
              ? UrlHelper.convertPathToUrl(otherUser.profile_image)
              : null;
            const statusColor = getStatusColor(item.status);

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => {
                  setDetailInquiry(item);
                  setDetailModalVisible(true);
                }}
              >
                <View style={styles.cardHeader}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
                  ) : (
                    <View style={styles.userAvatarPlaceholder}>
                      <Text style={styles.userAvatarText}>
                        {otherUser?.full_name?.charAt(0) || 'U'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.cardHeaderInfo}>
                    <View style={styles.userRow}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {otherUser?.full_name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: `${statusColor}18` },
                          ]}
                        >
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {item.status.toUpperCase()}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                      </View>
                    </View>

                    <Text style={styles.orgText} numberOfLines={1}>
                      {item.organization_or_brand ? `🏢 ${item.organization_or_brand} • ` : ''}
                      {item.collaboration_type.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>

                {/* Subject */}
                <Text style={styles.subjectText} numberOfLines={2}>
                  {item.subject}
                </Text>

                {/* Proposal Message Snippet */}
                <Text style={styles.messageSnippet} numberOfLines={3}>
                  {item.message}
                </Text>

                {/* Budget & Metadata Tag Row */}
                <View style={styles.metaRow}>
                  {item.budget_amount ? (
                    <View style={styles.budgetPill}>
                      <Ionicons name="cash-outline" size={13} color="#059669" />
                      <Text style={styles.budgetPillText}>
                        {item.budget_amount} {item.currency} ({item.compensation_type})
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.budgetPill}>
                      <Text style={styles.budgetPillText}>
                        Compensation: {item.compensation_type || 'Negotiable'}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>

                {/* Response Note if present */}
                {item.response_note && (
                  <View style={styles.responseNoteBox}>
                    <Text style={styles.responseNoteTitle}>Response Note:</Text>
                    <Text style={styles.responseNoteText}>{item.response_note}</Text>
                  </View>
                )}

                {/* Visual Hint: Tap to view details */}
                <View style={styles.viewDetailsRow}>
                  <View style={styles.viewDetailsLeft}>
                    <Ionicons name="document-text-outline" size={13} color="#4F46E5" />
                    <Text style={styles.viewDetailsText}>Tap to view full proposal details</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={13} color="#4F46E5" />
                </View>

                {/* Interactive Actions for Received Inquiries */}
                {activeTab === 'received' && item.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => {
                        setSelectedInquiry(item);
                        setActionType('decline');
                        setActionNote('');
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => {
                        setSelectedInquiry(item);
                        setActionType('accept');
                        setActionNote('');
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                      <Text style={styles.acceptBtnText}>Accept Inquiry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Actions for Accepted Collaborations */}
                {item.status === 'accepted' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.chatPartnerBtn}
                      onPress={() => handleStartChat(item)}
                    >
                      <Ionicons name="chatbubbles-outline" size={15} color="#4F46E5" />
                      <Text style={styles.chatPartnerBtnText}>Workspace Chat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.completeBtn}
                      onPress={() => {
                        setSelectedInquiry(item);
                        setActionType('complete');
                        setActionNote('');
                      }}
                    >
                      <Ionicons name="flag-outline" size={15} color="#059669" />
                      <Text style={styles.completeBtnText}>Mark Completed</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Cancel Action for Pending Sent Inquiries */}
                {activeTab === 'sent' && item.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.cancelInquiryBtn}
                      onPress={() => handleCancelInquiry(item)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text style={styles.cancelInquiryBtnText}>Cancel Proposal</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Accept / Decline / Complete Action Confirmation Modal ── */}
      <Modal
        visible={!!actionType}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActionType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === 'accept'
                  ? 'Accept Collaboration'
                  : actionType === 'decline'
                  ? 'Decline Collaboration'
                  : 'Complete Collaboration'}
              </Text>
              <TouchableOpacity onPress={() => setActionType(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.actionPromptText}>
                {actionType === 'accept'
                  ? `Accept proposal from ${selectedInquiry?.sender?.full_name}? You can add an optional welcome note.`
                  : actionType === 'decline'
                  ? `Decline proposal from ${selectedInquiry?.sender?.full_name}? You can add a polite reason.`
                  : 'Mark this collaboration as fully delivered and completed.'}
              </Text>

              <Text style={styles.inputLabel}>
                {actionType === 'decline' ? 'Reason for declining' : 'Note / Next Steps (Optional)'}
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={
                  actionType === 'decline'
                    ? 'e.g. Schedule conflicts, not accepting sponsorships at this time...'
                    : 'e.g. Delighted to collaborate! Let us set up a kick-off message...'
                }
                placeholderTextColor="#94A3B8"
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setActionType(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  actionType === 'decline' && { backgroundColor: '#DC2626' },
                  submittingAction && styles.disabledBtn,
                ]}
                onPress={handleConfirmAction}
                disabled={submittingAction}
              >
                {submittingAction ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>
                    {actionType === 'accept'
                      ? 'Confirm Accept'
                      : actionType === 'decline'
                      ? 'Confirm Decline'
                      : 'Confirm Complete'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Cancel Invitation Modal with Optional Reason ── */}
      <Modal
        visible={cancelInviteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelInviteTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCancelInviteTarget(null)}
        >
          <View style={[styles.modalCard, { maxWidth: 360 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={22} color="#DC2626" />
                <Text style={styles.modalTitle}>Cancel Invitation</Text>
              </View>
              <TouchableOpacity onPress={() => setCancelInviteTarget(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.actionPromptText}>
                Are you sure you want to cancel the invitation sent to{' '}
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                  {cancelInviteTarget?.invited_user?.full_name || cancelInviteTarget?.email}
                </Text>?
              </Text>

              <Text style={styles.inputLabel}>Reason for Cancellation (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g. Scope changed, position filled, or invited by error..."
                placeholderTextColor="#94A3B8"
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCancelInviteTarget(null)}
              >
                <Text style={styles.modalCancelBtnText}>Keep Invite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: '#DC2626' },
                  isCancellingInvite && styles.disabledBtn,
                ]}
                onPress={handleConfirmCancelInvite}
                disabled={isCancellingInvite}
              >
                {isCancellingInvite ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Detail Inquiry View Modal ── */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setDetailModalVisible(false);
          setActiveInviteForDetail(null);
        }}
      >
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setDetailModalVisible(false);
                setActiveInviteForDetail(null);
              }}
            >
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Proposal Overview</Text>
            <View style={{ width: 36 }} />
          </View>

          {detailInquiry && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* Workspace Invitation Action Callout Banner */}
              {activeInviteForDetail && (
                <View
                  style={{
                    backgroundColor: '#EEF2FF',
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1.5,
                    borderColor: '#C7D2FE',
                    shadowColor: '#4F46E5',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Ionicons name="mail-open" size={20} color="#4F46E5" />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>
                      Workspace Invitation Received
                    </Text>
                  </View>

                  <Text style={{ fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 18 }}>
                    You have been invited by{' '}
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                      {activeInviteForDetail.invited_by?.full_name || activeInviteForDetail.invited_by?.pseudo || 'Partner'}
                    </Text>{' '}
                    to join as{' '}
                    <Text style={{ fontWeight: '700', color: '#4F46E5' }}>
                      {activeInviteForDetail.role === 'CHATROOM_ADMIN' ? 'Admin' : 'Member'}
                    </Text>.
                  </Text>

                  {activeInviteForDetail.message ? (
                    <View style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, marginBottom: 14, borderWidth: 1, borderColor: '#E0E7FF' }}>
                      <Text style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
                        "{activeInviteForDetail.message}"
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                      onPress={async () => {
                        const invId = activeInviteForDetail.id;
                        setDetailModalVisible(false);
                        setActiveInviteForDetail(null);
                        await handleRespondInvitation(invId, 'decline');
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Decline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1.5,
                        backgroundColor: '#4F46E5',
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                      onPress={async () => {
                        const invId = activeInviteForDetail.id;
                        setDetailModalVisible(false);
                        setActiveInviteForDetail(null);
                        await handleRespondInvitation(invId, 'accept');
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Accept & Join Chat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.detailHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: `${getStatusColor(detailInquiry.status)}20`,
                      alignSelf: 'flex-start',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: getStatusColor(detailInquiry.status) },
                    ]}
                  >
                    {detailInquiry.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.detailSubject}>{detailInquiry.subject}</Text>
                <Text style={styles.detailType}>
                  Type: {detailInquiry.collaboration_type.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>

              {/* Participants Card */}
              <View style={styles.detailUserCard}>
                <Text style={styles.detailSectionTitle}>Participants</Text>
                <Text style={styles.detailUserText}>
                  <Text style={{ fontWeight: '700' }}>Sender:</Text> {detailInquiry.sender.full_name} ({detailInquiry.sender.email})
                </Text>
                <Text style={styles.detailUserText}>
                  <Text style={{ fontWeight: '700' }}>Recipient:</Text> {detailInquiry.receiver.full_name} ({detailInquiry.receiver.email})
                </Text>
                {detailInquiry.organization_or_brand && (
                  <Text style={styles.detailUserText}>
                    <Text style={{ fontWeight: '700' }}>Organization:</Text> {detailInquiry.organization_or_brand}
                  </Text>
                )}
              </View>

              {/* Proposal Message */}
              <View style={styles.detailSectionBox}>
                <Text style={styles.detailSectionTitle}>Proposal Message</Text>
                <Text style={styles.detailMessageText}>{detailInquiry.message}</Text>
              </View>

              {/* Compensation & Contact */}
              <View style={styles.detailSectionBox}>
                <Text style={styles.detailSectionTitle}>Compensation & Logistics</Text>
                <Text style={styles.detailUserText}>
                  <Text style={{ fontWeight: '700' }}>Model:</Text> {detailInquiry.compensation_type || 'Negotiable'}
                </Text>
                {detailInquiry.budget_amount && (
                  <Text style={styles.detailUserText}>
                    <Text style={{ fontWeight: '700' }}>Budget:</Text> {detailInquiry.budget_amount} {detailInquiry.currency}
                  </Text>
                )}
                {detailInquiry.target_date && (
                  <Text style={styles.detailUserText}>
                    <Text style={{ fontWeight: '700' }}>Target Date:</Text> {new Date(detailInquiry.target_date).toLocaleDateString()}
                  </Text>
                )}
                {detailInquiry.contact_email && (
                  <Text style={styles.detailUserText}>
                    <Text style={{ fontWeight: '700' }}>Contact Email:</Text> {detailInquiry.contact_email}
                  </Text>
                )}
                {detailInquiry.contact_phone && (
                  <Text style={styles.detailUserText}>
                    <Text style={{ fontWeight: '700' }}>Contact Phone:</Text> {detailInquiry.contact_phone}
                  </Text>
                )}
              </View>

              {detailInquiry.response_note && (
                <View style={[styles.detailSectionBox, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.detailSectionTitle, { color: '#166534' }]}>Response Note</Text>
                  <Text style={[styles.detailMessageText, { color: '#166534' }]}>{detailInquiry.response_note}</Text>
                </View>
              )}

              {/* Direct Message Action from Detail (only when not viewing a pending invitation) */}
              {!activeInviteForDetail && (
                <View style={{ marginTop: 16, marginBottom: 32 }}>
                  <TouchableOpacity
                    style={styles.detailChatBtn}
                    onPress={() => handleStartChat(detailInquiry)}
                  >
                    <Ionicons name="chatbubbles" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.detailChatBtnText}>
                      {detailInquiry.status === 'accepted' || detailInquiry.status === 'completed'
                        ? 'Open Collaboration Workspace Chat'
                        : `Message ${activeTab === 'received' ? detailInquiry.sender.full_name : detailInquiry.receiver.full_name}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default CollaborationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 6,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    gap: 8,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  statLbl: {
    fontSize: 11,
    color: '#64748B',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeTabBtn: {
    borderBottomColor: '#4F46E5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  badgeCount: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  statusFilterBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  statusFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusFilterChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  statusFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusFilterChipTextSelected: {
    color: '#FFF',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  userAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orgText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  messageSnippet: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  budgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  budgetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  responseNoteBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  responseNoteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: 2,
  },
  responseNoteText: {
    fontSize: 12,
    color: '#334155',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  viewDetailsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  acceptBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  completeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  chatPartnerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  chatPartnerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  cancelInquiryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  cancelInquiryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    marginBottom: 16,
  },
  actionPromptText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  detailHeader: {
    marginBottom: 16,
  },
  detailSubject: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 4,
  },
  detailType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  detailUserCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  detailUserText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  detailSectionBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailMessageText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
  },
  detailChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
  },
  detailChatBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
