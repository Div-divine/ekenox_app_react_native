import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tagService, {
  Tag,
  MemberWithTags,
  PermittedAction,
  CreateTagData,
  UserTag,
  UserTagLog,
} from '../services/tagService';
import { UrlHelper } from '../utils/urlHelper';

const { width } = Dimensions.get('window');

const COLOR_PALETTE = [
  '#4F46E5', // Indigo
  '#059669', // Emerald
  '#DC2626', // Red
  '#D97706', // Amber
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#475569', // Slate
  '#16A34A', // Green
];

interface TagManagementModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: 'association' | 'event';
  targetId: string | number;
  targetTitle: string;
}

export const TagManagementModal: React.FC<TagManagementModalProps> = ({
  visible,
  onClose,
  targetType: initialTargetType,
  targetId,
  targetTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'tags' | 'logs'>('members');
  const [loading, setLoading] = useState<boolean>(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [members, setMembers] = useState<MemberWithTags[]>([]);
  const [availableActions, setAvailableActions] = useState<PermittedAction[]>([]);
  const [auditLogs, setAuditLogs] = useState<UserTagLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Tag Form Modal State
  const [tagFormVisible, setTagFormVisible] = useState<boolean>(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState<string>('');
  const [tagDesc, setTagDesc] = useState<string>('');
  const [tagColor, setTagColor] = useState<string>(COLOR_PALETTE[0]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [savingTag, setSavingTag] = useState<boolean>(false);

  // Member Tag Assignment Modal State
  const [assignModalVisible, setAssignModalVisible] = useState<boolean>(false);
  const [memberModalSubTab, setMemberModalSubTab] = useState<'assign' | 'history'>('assign');
  const [selectedMember, setSelectedMember] = useState<MemberWithTags | null>(null);
  const [memberSelectedTagIds, setMemberSelectedTagIds] = useState<(string | number)[]>([]);
  const [savingAssignment, setSavingAssignment] = useState<boolean>(false);
  const [expandedTagIds, setExpandedTagIds] = useState<(string | number)[]>([]);

  // Tag Withdrawal Modal State
  const [withdrawModalVisible, setWithdrawModalVisible] = useState<boolean>(false);
  const [tagToWithdraw, setTagToWithdraw] = useState<UserTag | null>(null);
  const [withdrawReason, setWithdrawReason] = useState<string>('');
  const [withdrawing, setWithdrawing] = useState<boolean>(false);

  // Member Log History State
  const [memberLogs, setMemberLogs] = useState<UserTagLog[]>([]);
  const [loadingMemberLogs, setLoadingMemberLogs] = useState<boolean>(false);

  // Load Main Data
  const loadData = useCallback(async () => {
    if (!visible || !targetId) return;
    setLoading(true);
    try {
      // 1. Available Actions Catalogue
      const actionsRes = await tagService.getAvailableActions();
      const actions =
        initialTargetType === 'association' ? actionsRes.association : actionsRes.event;
      setAvailableActions(actions || []);

      // 2. Tags for this Association / Event (Sorted by createdAt DESC)
      const tagsList =
        initialTargetType === 'association'
          ? await tagService.getAssociationTags(targetId)
          : await tagService.getEventTags(targetId);

      tagsList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setTags(tagsList);

      // 3. Members with their assigned & withdrawn tags
      const membersList =
        initialTargetType === 'association'
          ? await tagService.getAssociationMembersWithTags(targetId)
          : await tagService.getEventMembersWithTags(targetId);
      setMembers(membersList);
    } catch (err: any) {
      console.error('Error loading tags & members:', err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to load tags data';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [visible, initialTargetType, targetId]);

  // Load Aggregate Audit Logs
  const loadAuditLogs = useCallback(async () => {
    if (members.length === 0) return;
    setLoadingLogs(true);
    try {
      const logsPromises = members.map((m) =>
        tagService.getUserTagLogs(m.user.id).catch(() => [])
      );
      const allLogsArrays = await Promise.all(logsPromises);
      const flattened = allLogsArrays.flat();
      flattened.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAuditLogs(flattened);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [members]);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  useEffect(() => {
    if (activeTab === 'logs' && members.length > 0) {
      loadAuditLogs();
    }
  }, [activeTab, members, loadAuditLogs]);

  // Open Create Tag Form
  const handleOpenCreateTag = () => {
    setEditingTag(null);
    setTagName('');
    setTagDesc('');
    setTagColor(COLOR_PALETTE[0]);
    setSelectedActions([]);
    setTagFormVisible(true);
  };

  // Open Edit Tag Form
  const handleOpenEditTag = (tag: Tag) => {
    if (tag.is_default) {
      Alert.alert('System Default', 'Default template tags cannot be edited.');
      return;
    }
    setEditingTag(tag);
    setTagName(tag.name);
    setTagDesc(tag.description || '');
    setTagColor(tag.color || COLOR_PALETTE[0]);
    setSelectedActions(tag.permitted_actions || []);
    setTagFormVisible(true);
  };

  // Toggle Action Selection
  const toggleAction = (actionId: string) => {
    setSelectedActions((prev) =>
      prev.includes(actionId) ? prev.filter((a) => a !== actionId) : [...prev, actionId]
    );
  };

  // Toggle expandable tag preview
  const toggleExpandTag = (tagId: string | number) => {
    setExpandedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Save Tag (Create or Update)
  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      Alert.alert('Validation', 'Please provide a tag name (min 2 characters)');
      return;
    }
    setSavingTag(true);
    try {
      if (editingTag) {
        await tagService.updateTag(editingTag.id, {
          name: tagName.trim(),
          description: tagDesc.trim() || undefined,
          color: tagColor,
          permitted_actions: selectedActions,
        });
        Alert.alert('Success', 'Tag updated successfully');
      } else {
        const payload: CreateTagData = {
          name: tagName.trim(),
          description: tagDesc.trim() || undefined,
          color: tagColor,
          type: initialTargetType,
          permitted_actions: selectedActions,
          ...(initialTargetType === 'association'
            ? { association_id: targetId }
            : { event_id: targetId }),
        };
        await tagService.createTag(payload);
        Alert.alert('Success', 'New custom tag created successfully');
      }
      setTagFormVisible(false);
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to save tag';
      Alert.alert('Error', msg);
    } finally {
      setSavingTag(false);
    }
  };

  // Delete Tag
  const handleDeleteTag = (tag: Tag) => {
    if (tag.is_default) {
      Alert.alert('System Default', 'Default template tags cannot be deleted.');
      return;
    }
    Alert.alert('Delete Tag', `Are you sure you want to delete custom tag "${tag.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await tagService.deleteTag(tag.id);
            setTagFormVisible(false);
            loadData();
          } catch (err: any) {
            const msg =
              err?.response?.data?.message || err?.response?.data?.error || 'Failed to delete tag';
            Alert.alert('Error', msg);
          }
        },
      },
    ]);
  };

  // Open Member Assignment Modal
  const handleOpenAssignModal = async (member: MemberWithTags) => {
    const isCreator = member.is_creator;
    const isAdmin = member.role?.name?.toUpperCase()?.includes('ADMIN');

    if (isCreator) {
      Alert.alert(
        'Full Administrative Rights',
        `${member.user.full_name} is the creator of this ${initialTargetType} and inherently possesses all administrative permissions. Custom tags cannot be assigned.`
      );
      return;
    }

    if (isAdmin) {
      Alert.alert(
        'Full Administrative Rights',
        `${member.user.full_name} has the administrator role and already possesses all permissions.`
      );
      return;
    }

    setSelectedMember(member);
    setMemberModalSubTab('assign');
    const currentTagIds = (member.tags || []).map((t) => t.id);
    setMemberSelectedTagIds(currentTagIds);
    setExpandedTagIds([]);
    setAssignModalVisible(true);

    // Fetch individual member audit history
    setLoadingMemberLogs(true);
    try {
      const logs = await tagService.getUserTagLogs(member.user.id);
      setMemberLogs(logs);
    } catch (e) {
      setMemberLogs([]);
    } finally {
      setLoadingMemberLogs(false);
    }
  };

  // Toggle Tag for Member
  const toggleMemberTag = (tagId: string | number) => {
    setMemberSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Save Member Tag Assignments
  const handleSaveMemberAssignments = async () => {
    if (!selectedMember) return;
    setSavingAssignment(true);
    try {
      await tagService.batchAssignTags(selectedMember.user.id, memberSelectedTagIds, {
        ...(initialTargetType === 'association'
          ? { associationId: targetId }
          : { eventId: targetId }),
      });
      Alert.alert('Success', 'Member tags updated and notification dispatched.');
      setAssignModalVisible(false);
      loadData();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to update member tags';
      Alert.alert('Error', msg);
    } finally {
      setSavingAssignment(false);
    }
  };

  // Prompt Single Tag Withdrawal
  const handlePromptWithdrawTag = (userTag: UserTag) => {
    setTagToWithdraw(userTag);
    setWithdrawReason('');
    setWithdrawModalVisible(true);
  };

  // Confirm Single Tag Withdrawal
  const handleConfirmWithdrawTag = async () => {
    if (!tagToWithdraw || !selectedMember) return;
    setWithdrawing(true);
    try {
      await tagService.withdrawTag(
        selectedMember.user.id,
        tagToWithdraw.tag.id,
        withdrawReason.trim() || undefined
      );
      Alert.alert(
        'Tag Withdrawn',
        `Tag "${tagToWithdraw.tag.name}" has been withdrawn. The user was notified.`
      );
      setWithdrawModalVisible(false);
      setAssignModalVisible(false);
      loadData();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.response?.data?.error || 'Failed to withdraw tag';
      Alert.alert('Error', msg);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Tags & Permissions
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {initialTargetType === 'association' ? 'Association' : 'Event'}: {targetTitle}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreateTag}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'members' && styles.activeTabBtn]}
            onPress={() => setActiveTab('members')}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={activeTab === 'members' ? '#4F46E5' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
              Members ({members.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tags' && styles.activeTabBtn]}
            onPress={() => setActiveTab('tags')}
          >
            <Ionicons
              name="pricetags-outline"
              size={18}
              color={activeTab === 'tags' ? '#4F46E5' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'tags' && styles.activeTabText]}>
              Tags ({tags.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'logs' && styles.activeTabBtn]}
            onPress={() => setActiveTab('logs')}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={activeTab === 'logs' ? '#4F46E5' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>
              Audit Logs
            </Text>
          </TouchableOpacity>
        </View>

        {/* Body Content */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading tags & permissions...</Text>
          </View>
        ) : activeTab === 'members' ? (
          /* Members Tab */
          <FlatList
            data={members}
            keyExtractor={(item) => String(item.user.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No members found</Text>
                <Text style={styles.emptySubtitle}>
                  Members will appear here once they join this {initialTargetType}.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const rawAvatar =
                item.user.profile_image ||
                (item.user as any).profile_picture ||
                (item.user as any).avatar;
              const avatarUri = rawAvatar ? UrlHelper.convertPathToUrl(rawAvatar) : null;
              const isCreator = item.is_creator;
              const isAdmin = item.role?.name?.toUpperCase()?.includes('ADMIN');

              return (
                <TouchableOpacity
                  style={styles.memberCard}
                  activeOpacity={0.7}
                  onPress={() => handleOpenAssignModal(item)}
                >
                  <View style={styles.memberHeader}>
                    {avatarUri ? (
                      <Image
                        source={{ uri: avatarUri }}
                        style={styles.memberAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.memberAvatarPlaceholder}>
                        <Text style={styles.memberAvatarInitial}>
                          {item.user.full_name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                    )}

                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {item.user.full_name}
                        </Text>
                        {isCreator && (
                          <View style={styles.creatorBadge}>
                            <Ionicons name="shield-checkmark" size={11} color="#D97706" />
                            <Text style={styles.creatorBadgeText}>Creator</Text>
                          </View>
                        )}
                        {isAdmin && !isCreator && (
                          <View style={styles.adminBadge}>
                            <Ionicons name="shield-checkmark" size={11} color="#4F46E5" />
                            <Text style={styles.adminBadgeText}>Admin</Text>
                          </View>
                        )}
                        {item.role && !isCreator && !isAdmin && (
                          <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>
                              {item.role.display_name || item.role.name}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {item.user.email}
                      </Text>
                    </View>

                    {!isCreator && !isAdmin ? (
                      <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                    ) : (
                      <View style={styles.fullAccessBadge}>
                        <Text style={styles.fullAccessBadgeText}>Full Access</Text>
                      </View>
                    )}
                  </View>

                  {/* Active Assigned Tag Badges or Creator Full Access */}
                  {isCreator || isAdmin ? (
                    <View style={styles.allPermissionsBanner}>
                      {/* <Ionicons name="sparkles" size={13} color="#059669" /> */}
                      <Text style={styles.allPermissionsBannerText}>
                        Inherits all permissions and management actions unconditionally
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.tagChipsRow}>
                        {item.tags && item.tags.length > 0 ? (
                          item.tags.map((t) => (
                            <View
                              key={t.id}
                              style={[
                                styles.tagPill,
                                { backgroundColor: `${t.color || '#4F46E5'}20` },
                              ]}
                            >
                              <View
                                style={[
                                  styles.tagPillDot,
                                  { backgroundColor: t.color || '#4F46E5' },
                                ]}
                              />
                              <Text style={[styles.tagPillText, { color: t.color || '#4F46E5' }]}>
                                {t.name}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noTagsAssignedText}>No active tags • Tap to assign</Text>
                        )}
                      </View>

                      {/* Permitted Actions Preview */}
                      {item.permitted_actions && item.permitted_actions.length > 0 && (
                        <View style={styles.actionsPreview}>
                          <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
                          <Text style={styles.actionsPreviewText} numberOfLines={1}>
                            {item.permitted_actions.length} action
                            {item.permitted_actions.length > 1 ? 's' : ''} permitted:{' '}
                            {item.permitted_actions.join(', ')}
                          </Text>
                        </View>
                      )}

                      {/* Withdrawn Tags Indicator */}
                      {item.withdrawn_tags && item.withdrawn_tags.length > 0 && (
                        <View style={styles.withdrawnInfoRow}>
                          <Ionicons name="time-outline" size={12} color="#94A3B8" />
                          <Text style={styles.withdrawnInfoText}>
                            {item.withdrawn_tags.length} revoked/withdrawn tag(s) on record
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        ) : activeTab === 'tags' ? (
          /* Tags Tab (Ordered by createdAt DESC) */
          <FlatList
            data={tags}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="pricetags-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No tags available</Text>
                <Text style={styles.emptySubtitle}>
                  Create custom tags to delegate specific management actions to members.
                </Text>
                <TouchableOpacity style={styles.createTagEmptyBtn} onPress={handleOpenCreateTag}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.createTagEmptyBtnText}>Create Custom Tag</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.tagCard}>
                <View style={styles.tagCardHeader}>
                  <View style={styles.tagCardTitleRow}>
                    <View style={[styles.tagBadgePill, { backgroundColor: item.color || '#4F46E5' }]}>
                      <Text style={styles.tagBadgePillText}>{item.name}</Text>
                    </View>
                    {item.is_default ? (
                      <View style={styles.defaultTagBadge}>
                        {/* <Ionicons name="sparkles" size={12} color="#D97706" /> */}
                        <Text style={styles.defaultTagBadgeText}>Default Template</Text>
                      </View>
                    ) : (
                      <View style={styles.customTagBadge}>
                        <Text style={styles.customTagBadgeText}>Custom</Text>
                      </View>
                    )}
                  </View>
                  {!item.is_default && (
                    <TouchableOpacity
                      style={styles.editTagBtn}
                      onPress={() => handleOpenEditTag(item)}
                    >
                      <Ionicons name="create-outline" size={18} color="#4F46E5" />
                      <Text style={styles.editTagBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {item.description ? (
                  <Text style={styles.tagCardDesc}>{item.description}</Text>
                ) : null}

                <View style={styles.tagActionsContainer}>
                  <Text style={styles.tagActionsTitle}>Permitted Actions:</Text>
                  <View style={styles.tagActionsList}>
                    {item.permitted_actions && item.permitted_actions.length > 0 ? (
                      item.permitted_actions.map((actKey) => {
                        const actDef = availableActions.find((a) => a.id === actKey);
                        return (
                          <View key={actKey} style={styles.actionChip}>
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={styles.actionChipText}>
                              {actDef ? actDef.label : actKey}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.noActionsText}>No actions assigned to this tag</Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        ) : (
          /* Audit Logs Tab */
          <FlatList
            data={auditLogs}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              loadingLogs ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text style={styles.loadingText}>Fetching activity timeline...</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No tag activity recorded yet</Text>
                  <Text style={styles.emptySubtitle}>
                    All tag assignments, updates, and withdrawals will appear here in real time.
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <View style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logActionBadgeRow}>
                    <View
                      style={[
                        styles.logTypeBadge,
                        item.action === 'assigned'
                          ? styles.logAssignedBadge
                          : styles.logWithdrawnBadge,
                      ]}
                    >
                      <Ionicons
                        name={item.action === 'assigned' ? 'add-circle' : 'remove-circle'}
                        size={14}
                        color={item.action === 'assigned' ? '#059669' : '#DC2626'}
                      />
                      <Text
                        style={[
                          styles.logTypeBadgeText,
                          { color: item.action === 'assigned' ? '#059669' : '#DC2626' },
                        ]}
                      >
                        {item.action.toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.logTagPill,
                        { backgroundColor: `${item.tag?.color || '#4F46E5'}20` },
                      ]}
                    >
                      <Text style={[styles.logTagPillText, { color: item.tag?.color || '#4F46E5' }]}>
                        {item.tag?.name}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.logTimeText}>
                    {new Date(item.created_at).toLocaleDateString()} •{' '}
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <Text style={styles.logTargetUserText}>
                  Member: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{item.user?.name}</Text>{' '}
                  ({item.user?.email})
                </Text>

                {item.performed_by && (
                  <Text style={styles.logAdminText}>
                    Performed by:{' '}
                    <Text style={{ fontWeight: '600', color: '#4F46E5' }}>
                      {item.performed_by.name}
                    </Text>
                  </Text>
                )}

                {item.reason ? (
                  <Text style={styles.logReasonText}>Reason: "{item.reason}"</Text>
                ) : null}
              </View>
            )}
          />
        )}

        {/* ─── Create / Edit Tag Modal (Fixed Header & Full Screen Safe Area) ─ */}
        <Modal
          visible={tagFormVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setTagFormVisible(false)}
        >
          <SafeAreaView style={styles.formContainer}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              {/* Fixed Clean Header */}
              <View style={styles.formHeader}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setTagFormVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.formHeaderTitle}>
                  {editingTag ? 'Edit Custom Tag' : 'Create Custom Tag'}
                </Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView
                style={styles.formBody}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>Tag Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Event Coordinator, Moderator..."
                  placeholderTextColor="#94A3B8"
                  value={tagName}
                  onChangeText={setTagName}
                />

                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Explain what this tag is for..."
                  placeholderTextColor="#94A3B8"
                  value={tagDesc}
                  onChangeText={setTagDesc}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.inputLabel}>Tag Color</Text>
                <View style={styles.colorPaletteRow}>
                  {COLOR_PALETTE.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        tagColor === c && styles.selectedColorCircle,
                      ]}
                      onPress={() => setTagColor(c)}
                    >
                      {tagColor === c && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Permitted Actions Selection */}
                <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                  Assign Permitted Actions
                </Text>
                <Text style={styles.inputHelp}>
                  Members assigned this tag will receive these rights:
                </Text>

                <View style={styles.actionsSelectBox}>
                  {availableActions.map((action) => {
                    const isSelected = selectedActions.includes(action.id);
                    return (
                      <TouchableOpacity
                        key={action.id}
                        style={[styles.actionRow, isSelected && styles.actionRowSelected]}
                        onPress={() => toggleAction(action.id)}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? '#4F46E5' : '#94A3B8'}
                        />
                        <View style={styles.actionRowTexts}>
                          <Text
                            style={[
                              styles.actionRowLabel,
                              isSelected && styles.actionRowLabelSelected,
                            ]}
                          >
                            {action.label}
                          </Text>
                          <Text style={styles.actionRowDesc}>{action.description}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.formFooter}>
                {editingTag && !editingTag.is_default && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteTag(editingTag)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                    <Text style={{ color: '#DC2626', fontWeight: '600', marginLeft: 4 }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.saveBtn, savingTag && styles.disabledBtn]}
                  onPress={handleSaveTag}
                  disabled={savingTag}
                >
                  {savingTag ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingTag ? 'Save Changes' : 'Create Tag'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* ─── Member Tag Assignment & History Modal with Sub-Tabs ────────── */}
        <Modal
          visible={assignModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setAssignModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { height: '90%' }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Manage Member Tags</Text>
                  <Text style={styles.modalSubTitle} numberOfLines={1}>
                    {selectedMember?.user.full_name} ({selectedMember?.user.email})
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Inner Sub-Tabs: Assign Tags vs Member History */}
              <View style={styles.memberSubTabContainer}>
                <TouchableOpacity
                  style={[
                    styles.memberSubTabBtn,
                    memberModalSubTab === 'assign' && styles.memberSubTabBtnActive,
                  ]}
                  onPress={() => setMemberModalSubTab('assign')}
                >
                  <Ionicons
                    name="pricetags-outline"
                    size={16}
                    color={memberModalSubTab === 'assign' ? '#4F46E5' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.memberSubTabText,
                      memberModalSubTab === 'assign' && styles.memberSubTabTextActive,
                    ]}
                  >
                    Assign Tags ({memberSelectedTagIds.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.memberSubTabBtn,
                    memberModalSubTab === 'history' && styles.memberSubTabBtnActive,
                  ]}
                  onPress={() => setMemberModalSubTab('history')}
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={memberModalSubTab === 'history' ? '#4F46E5' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.memberSubTabText,
                      memberModalSubTab === 'history' && styles.memberSubTabTextActive,
                    ]}
                  >
                    Activity History ({memberLogs.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Modal Sub-Tab Content */}
              {memberModalSubTab === 'assign' ? (
                <>
                  <ScrollView
                    style={styles.modalBody}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.sectionSubHeader}>Select Tags to Assign or Revoke</Text>
                    {tags.length === 0 ? (
                      <View style={styles.noTagsForAssignment}>
                        <Ionicons name="pricetag-outline" size={32} color="#94A3B8" />
                        <Text style={styles.noTagsForAssignmentText}>
                          No tags available. Create custom tags first!
                        </Text>
                      </View>
                    ) : (
                      tags.map((tag) => {
                        const isSelected = memberSelectedTagIds.includes(tag.id);
                        const isExpanded = expandedTagIds.includes(tag.id);
                        const currentAssignment = selectedMember?.tag_assignments?.find(
                          (ta) => ta.tag.id === tag.id
                        );

                        return (
                          <View
                            key={tag.id}
                            style={[
                              styles.assignTagRow,
                              isSelected && {
                                borderColor: tag.color || '#4F46E5',
                                backgroundColor: '#F8FAFC',
                              },
                            ]}
                          >
                            <View style={styles.assignTagTopRow}>
                              <TouchableOpacity
                                style={styles.assignTagCheckboxTouch}
                                onPress={() => toggleMemberTag(tag.id)}
                              >
                                <Ionicons
                                  name={isSelected ? 'checkbox' : 'square-outline'}
                                  size={22}
                                  color={isSelected ? tag.color || '#4F46E5' : '#94A3B8'}
                                />
                                <View style={styles.assignTagBadgeRow}>
                                  <View
                                    style={[
                                      styles.tagPillDot,
                                      { backgroundColor: tag.color || '#4F46E5' },
                                    ]}
                                  />
                                  <Text style={styles.assignTagName}>{tag.name}</Text>
                                  {tag.is_default && (
                                    <View style={styles.defaultMiniBadge}>
                                      <Text style={styles.defaultMiniBadgeText}>Default</Text>
                                    </View>
                                  )}
                                </View>
                              </TouchableOpacity>

                              {/* Expand/Reduce Actions Button */}
                              <TouchableOpacity
                                style={styles.expandTagBtn}
                                onPress={() => toggleExpandTag(tag.id)}
                              >
                                <Ionicons
                                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>

                            {/* Tag Description */}
                            {tag.description ? (
                              <Text style={styles.assignTagDesc}>{tag.description}</Text>
                            ) : null}

                            {/* Assigned By Info */}
                            {currentAssignment?.assigned_by && (
                              <Text style={styles.assignmentMetaText}>
                                Assigned by {currentAssignment.assigned_by.name} on{' '}
                                {new Date(currentAssignment.assigned_at).toLocaleDateString()}
                              </Text>
                            )}

                            {/* Expandable Permitted Actions Details */}
                            {isExpanded ? (
                              <View style={styles.expandedActionsBox}>
                                <Text style={styles.expandedActionsTitle}>Permitted Actions:</Text>
                                <View style={styles.tagActionsList}>
                                  {tag.permitted_actions && tag.permitted_actions.length > 0 ? (
                                    tag.permitted_actions.map((actKey) => {
                                      const actDef = availableActions.find((a) => a.id === actKey);
                                      return (
                                        <View key={actKey} style={styles.actionChip}>
                                          <Ionicons
                                            name="checkmark-circle"
                                            size={13}
                                            color="#059669"
                                          />
                                          <Text style={styles.actionChipText}>
                                            {actDef ? actDef.label : actKey}
                                          </Text>
                                        </View>
                                      );
                                    })
                                  ) : (
                                    <Text style={styles.noActionsText}>
                                      No actions included in this tag
                                    </Text>
                                  )}
                                </View>
                              </View>
                            ) : (
                              <TouchableOpacity
                                onPress={() => toggleExpandTag(tag.id)}
                                style={styles.expandActionCountRow}
                              >
                                <Text style={styles.assignTagActionsCount}>
                                  {tag.permitted_actions?.length || 0} action(s) included • Tap to preview
                                </Text>
                              </TouchableOpacity>
                            )}

                            {/* Direct Withdraw button if currently assigned */}
                            {currentAssignment && (
                              <TouchableOpacity
                                style={styles.directWithdrawBtn}
                                onPress={() => handlePromptWithdrawTag(currentAssignment)}
                              >
                                <Ionicons name="remove-circle-outline" size={16} color="#DC2626" />
                                <Text style={styles.directWithdrawBtnText}>Withdraw Tag</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })
                    )}
                  </ScrollView>

                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setAssignModalVisible(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, savingAssignment && styles.disabledBtn]}
                      onPress={handleSaveMemberAssignments}
                      disabled={savingAssignment}
                    >
                      {savingAssignment ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.saveBtnText}>Save Assignments</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* Activity History Sub-Tab */
                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={{ paddingBottom: 32 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.sectionSubHeader}>
                    Assignment & Revocation Timeline for {selectedMember?.user.full_name}
                  </Text>

                  {loadingMemberLogs ? (
                    <View style={styles.centerLoading}>
                      <ActivityIndicator size="small" color="#4F46E5" />
                      <Text style={styles.loadingText}>Fetching timeline...</Text>
                    </View>
                  ) : memberLogs.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="time-outline" size={40} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No history recorded</Text>
                      <Text style={styles.emptySubtitle}>
                        Tag assignments and withdrawals for this member will appear here.
                      </Text>
                    </View>
                  ) : (
                    memberLogs.map((log, idx) => (
                      <View key={`${log.id}-${idx}`} style={styles.withdrawnTagItem}>
                        <View style={styles.withdrawnTagHeader}>
                          <View style={styles.withdrawnTagBadge}>
                            <View
                              style={[
                                styles.tagPillDot,
                                { backgroundColor: log.tag?.color || '#94A3B8' },
                              ]}
                            />
                            <Text style={styles.withdrawnTagName}>{log.tag?.name}</Text>
                          </View>
                          <View
                            style={[
                              styles.withdrawnBadge,
                              log.action === 'assigned' && { backgroundColor: '#DCFCE7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.withdrawnBadgeText,
                                log.action === 'assigned' && { color: '#059669' },
                              ]}
                            >
                              {log.action.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {log.performed_by && (
                          <Text style={styles.withdrawnDetailsText}>
                            By:{' '}
                            <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                              {log.performed_by.name}
                            </Text>{' '}
                            on {new Date(log.created_at).toLocaleDateString()} at{' '}
                            {new Date(log.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                        {log.reason ? (
                          <Text style={styles.withdrawnReasonText}>Reason: "{log.reason}"</Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* ─── Withdraw Tag Confirmation Modal with Reason ───────────────── */}
        <Modal
          visible={withdrawModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setWithdrawModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: '#DC2626' }]}>Withdraw Tag</Text>
                <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.withdrawWarningText}>
                  Are you sure you want to withdraw the tag "{tagToWithdraw?.tag?.name}" from{' '}
                  <Text style={{ fontWeight: '700' }}>{selectedMember?.user.full_name}</Text>?
                </Text>
                <Text style={styles.withdrawWarningSubText}>
                  The user will receive an instant notification and their tag actions will be immediately revoked.
                </Text>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                  Withdrawal Reason (Optional)
                </Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="e.g. End of tenure, role reassignment..."
                  placeholderTextColor="#94A3B8"
                  value={withdrawReason}
                  onChangeText={setWithdrawReason}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setWithdrawModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.withdrawConfirmBtn, withdrawing && styles.disabledBtn]}
                  onPress={handleConfirmWithdrawTag}
                  disabled={withdrawing}
                >
                  {withdrawing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.withdrawConfirmBtnText}>Confirm Withdrawal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#4F46E5',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
  memberCard: {
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
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  fullAccessBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fullAccessBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  allPermissionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  allPermissionsBannerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#166534',
    flex: 1,
  },
  memberEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  tagPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noTagsAssignedText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  actionsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  actionsPreviewText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
    flex: 1,
  },
  withdrawnInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  withdrawnInfoText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  tagCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagBadgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagBadgePillText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  defaultTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
    gap: 4,
  },
  defaultTagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  customTagBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  customTagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  editTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 4,
  },
  editTagBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  tagCardDesc: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 18,
  },
  tagActionsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tagActionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  tagActionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 4,
  },
  actionChipText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  noActionsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
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
  createTagEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  createTagEmptyBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  formHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  formBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  formFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFF',
    gap: 12,
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
  modalSubTitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  memberSubTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  memberSubTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  memberSubTabBtnActive: {
    borderBottomColor: '#4F46E5',
    backgroundColor: '#FFF',
  },
  memberSubTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  memberSubTabTextActive: {
    color: '#4F46E5',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionSubHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputHelp: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
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
    marginBottom: 12,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorCircle: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  actionsSelectBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 10,
  },
  actionRowSelected: {
    backgroundColor: '#EEF2FF',
  },
  actionRowTexts: {
    flex: 1,
  },
  actionRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  actionRowLabelSelected: {
    color: '#4F46E5',
  },
  actionRowDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
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
  saveBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginRight: 'auto',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  assignTagRow: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  assignTagTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignTagCheckboxTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  assignTagBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignTagName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  defaultMiniBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultMiniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  expandTagBtn: {
    padding: 6,
  },
  assignTagDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginLeft: 32,
  },
  expandActionCountRow: {
    marginTop: 6,
    marginLeft: 32,
  },
  assignTagActionsCount: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
  },
  expandedActionsBox: {
    marginTop: 8,
    marginLeft: 32,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expandedActionsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  assignmentMetaText: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 4,
    marginLeft: 32,
    fontWeight: '500',
  },
  directWithdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 32,
  },
  directWithdrawBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  noTagsForAssignment: {
    padding: 24,
    alignItems: 'center',
  },
  noTagsForAssignmentText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  withdrawnTagItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  withdrawnTagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  withdrawnTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  withdrawnTagName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  withdrawnBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  withdrawnBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  withdrawnDetailsText: {
    fontSize: 11,
    color: '#64748B',
  },
  withdrawnReasonText: {
    fontSize: 11,
    color: '#DC2626',
    fontStyle: 'italic',
    marginTop: 2,
  },
  withdrawWarningText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  withdrawWarningSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 18,
  },
  withdrawConfirmBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  withdrawConfirmBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  logActionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  logAssignedBadge: {
    backgroundColor: '#DCFCE7',
  },
  logWithdrawnBadge: {
    backgroundColor: '#FEE2E2',
  },
  logTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  logTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logTagPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  logTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  logTargetUserText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  logAdminText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  logReasonText: {
    fontSize: 12,
    color: '#DC2626',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
