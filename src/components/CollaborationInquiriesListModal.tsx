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
  SafeAreaView,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import collaborationService, {
  CollaborationInquiry,
  CollaborationSummary,
} from '../services/collaborationService';
import { UrlHelper } from '../utils/urlHelper';

interface CollaborationInquiriesListModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenChatWithUser?: (userId: number, userName: string) => void;
}

export const CollaborationInquiriesListModal: React.FC<CollaborationInquiriesListModalProps> = ({
  visible,
  onClose,
  onOpenChatWithUser,
}) => {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [inquiries, setInquiries] = useState<CollaborationInquiry[]>([]);
  const [summary, setSummary] = useState<CollaborationSummary | null>(null);

  // Action Modal State (Accept / Decline / Complete)
  const [selectedInquiry, setSelectedInquiry] = useState<CollaborationInquiry | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'decline' | 'complete' | null>(null);
  const [actionNote, setActionNote] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Detail Modal State
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [detailInquiry, setDetailInquiry] = useState<CollaborationInquiry | null>(null);

  const loadData = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    try {
      const summaryData = await collaborationService.getSummary().catch(() => null);
      setSummary(summaryData);

      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const list =
        activeTab === 'received'
          ? await collaborationService.getReceivedInquiries(statusParam)
          : await collaborationService.getSentInquiries(statusParam);
      setInquiries(list);
    } catch (err: any) {
      console.error('Failed to load inquiries:', err);
      Alert.alert('Error', 'Failed to load collaboration inquiries.');
    } finally {
      setLoading(false);
    }
  }, [visible, activeTab, statusFilter]);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

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
      'Cancel Inquiry',
      `Are you sure you want to cancel your proposal "${inquiry.subject}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await collaborationService.cancelInquiry(inquiry.id);
              Alert.alert('Cancelled', 'Your inquiry has been cancelled.');
              loadData();
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to cancel inquiry';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Collaboration Inquiries</Text>
            <Text style={styles.headerSubtitle}>
              {summary ? `${summary.pending_received} pending received • ${summary.total_sent} sent` : 'Proposals & Partnerships'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Ionicons name="refresh" size={20} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher: Received vs Sent */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'received' && styles.activeTabBtn]}
            onPress={() => setActiveTab('received')}
          >
            <Ionicons
              name="mail-unread-outline"
              size={18}
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
            onPress={() => setActiveTab('sent')}
          >
            <Ionicons
              name="paper-plane-outline"
              size={18}
              color={activeTab === 'sent' ? '#4F46E5' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
              Sent Proposals ({summary?.total_sent || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilterBar}>
          {['all', 'pending', 'accepted', 'completed', 'declined', 'cancelled'].map((st) => {
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

        {/* Inquiries List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Fetching inquiries...</Text>
          </View>
        ) : (
          <FlatList
            data={inquiries}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={54} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No collaboration inquiries found</Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'received'
                    ? 'Proposals from other members or brands will appear here.'
                    : 'You have not submitted any collaboration proposals in this filter.'}
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
                  activeOpacity={0.8}
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
                              { backgroundColor: `${statusColor}20` },
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
                        {item.collaboration_type.replace('_', ' ')}
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

                  {/* Complete Action for Accepted Collaborations */}
                  {item.status === 'accepted' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.completeBtn}
                        onPress={() => {
                          setSelectedInquiry(item);
                          setActionType('complete');
                          setActionNote('');
                        }}
                      >
                        <Ionicons name="flag-outline" size={16} color="#4F46E5" />
                        <Text style={styles.completeBtnText}>Mark as Completed</Text>
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

        {/* ─── Accept / Decline / Complete Action Confirmation Modal ─────── */}
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
                    ? `Accept collaboration proposal from ${selectedInquiry?.sender?.full_name}? You can add an optional welcome message.`
                    : actionType === 'decline'
                    ? `Decline collaboration proposal from ${selectedInquiry?.sender?.full_name}? You can add a polite reason.`
                    : 'Mark this collaboration as fully delivered and completed.'}
                </Text>

                <Text style={styles.inputLabel}>
                  {actionType === 'decline' ? 'Reason for declining' : 'Note / Next Steps (Optional)'}
                </Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder={
                    actionType === 'decline'
                      ? 'e.g. Schedule conflicts, not currently accepting new sponsorships...'
                      : 'e.g. Delighted to collaborate! Let us set up a kick-off call...'
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

        {/* ─── Detail Inquiry View Modal ──────────────────────────────────── */}
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setDetailModalVisible(false)}
        >
          <SafeAreaView style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Proposal Overview</Text>
              <View style={{ width: 36 }} />
            </View>

            {detailInquiry && (
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(detailInquiry.status)}20`, alignSelf: 'flex-start' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(detailInquiry.status) }]}>
                      {detailInquiry.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.detailSubject}>{detailInquiry.subject}</Text>
                  <Text style={styles.detailType}>
                    Type: {detailInquiry.collaboration_type.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>

                {/* Sender & Receiver Card */}
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

                {/* Proposal Full Message */}
                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>Proposal Message</Text>
                  <Text style={styles.detailMessageText}>{detailInquiry.message}</Text>
                </View>

                {/* Compensation & Logistics */}
                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>Logistics & Compensation</Text>
                  <Text style={styles.detailUserText}>
                    <Text style={{ fontWeight: '700' }}>Compensation Model:</Text> {detailInquiry.compensation_type || 'Negotiable'}
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
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

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
  closeBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeTabBtn: {
    borderBottomColor: '#4F46E5',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#4F46E5',
  },
  badgeCount: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statusFilterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statusFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  statusFilterChipSelected: {
    backgroundColor: '#4F46E5',
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: 12,
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
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  orgText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 10,
  },
  messageSnippet: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  budgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  budgetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  responseNoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  responseNoteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  responseNoteText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 10,
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    gap: 4,
  },
  declineBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#059669',
    gap: 4,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    gap: 6,
  },
  completeBtnText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelInquiryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  cancelInquiryBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  actionPromptText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalCancelBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 130,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  detailHeader: {
    marginBottom: 16,
  },
  detailSubject: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  detailType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  detailUserCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailSectionBox: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailUserText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  detailMessageText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
  },
});
