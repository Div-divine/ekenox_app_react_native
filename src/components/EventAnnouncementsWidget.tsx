import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import eventAnnouncementService, {
  EventAnnouncement,
} from '../services/eventAnnouncementService';

interface EventAnnouncementsWidgetProps {
  eventId: string | number;
  canPost: boolean;
}

export const EventAnnouncementsWidget: React.FC<EventAnnouncementsWidgetProps> = ({
  eventId,
  canPost,
}) => {
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<EventAnnouncement | null>(null);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadAnnouncements = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await eventAnnouncementService.getAnnouncements(eventId);
      setAnnouncements(data);
    } catch (err: any) {
      console.error('Error fetching event announcements:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setTitle('');
    setContent('');
    setIsPinned(false);
    setModalVisible(true);
  };

  const handleOpenEdit = (item: EventAnnouncement) => {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content);
    setIsPinned(item.is_pinned);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Validation', 'Title and content cannot be empty');
      return;
    }
    setSubmitting(true);
    try {
      if (editingItem) {
        await eventAnnouncementService.updateAnnouncement(editingItem.id, {
          title: title.trim(),
          content: content.trim(),
          is_pinned: isPinned,
        });
        Alert.alert('Success', 'Announcement updated successfully');
      } else {
        await eventAnnouncementService.createAnnouncement(eventId, {
          title: title.trim(),
          content: content.trim(),
          is_pinned: isPinned,
        });
        Alert.alert('Success', 'Announcement published successfully');
      }
      setModalVisible(false);
      loadAnnouncements();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item: EventAnnouncement) => {
    Alert.alert('Delete Announcement', `Are you sure you want to delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await eventAnnouncementService.deleteAnnouncement(item.id);
            loadAnnouncements();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to delete announcement');
          }
        },
      },
    ]);
  };

  const handleTogglePin = async (item: EventAnnouncement) => {
    try {
      await eventAnnouncementService.togglePin(item.id);
      loadAnnouncements();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to toggle pin');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="megaphone-outline" size={20} color="#4F46E5" />
          <Text style={styles.headerTitle}>Announcements ({announcements.length})</Text>
        </View>
        {canPost && (
          <TouchableOpacity style={styles.createBtn} onPress={handleOpenCreate}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.createBtnText}>Post Update</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#4F46E5" style={{ marginVertical: 20 }} />
      ) : announcements.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="notifications-off-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyText}>No announcements posted yet for this event.</Text>
          {canPost && (
            <TouchableOpacity style={styles.emptyCreateBtn} onPress={handleOpenCreate}>
              <Text style={styles.emptyCreateBtnText}>Post First Announcement</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {announcements.map((item) => (
            <View
              key={item.id}
              style={[styles.card, item.is_pinned && styles.pinnedCard]}
            >
              {item.is_pinned && (
                <View style={styles.pinnedBanner}>
                  <Ionicons name="pin" size={14} color="#D97706" />
                  <Text style={styles.pinnedBannerText}>PINNED ANNOUNCEMENT</Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={styles.authorRow}>
                  {item.author?.profile_image ? (
                    <Image
                      source={{ uri: item.author.profile_image }}
                      style={styles.authorAvatar}
                    />
                  ) : (
                    <View style={styles.authorAvatarPlaceholder}>
                      <Text style={styles.authorAvatarInitial}>
                        {item.author?.full_name?.charAt(0) || 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.authorTexts}>
                    <Text style={styles.authorName}>
                      {item.author?.full_name || 'Organizer'}
                    </Text>
                    <Text style={styles.postDate}>
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>

                {canPost && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleTogglePin(item)}
                    >
                      <Ionicons
                        name={item.is_pinned ? 'pin' : 'pin-outline'}
                        size={18}
                        color={item.is_pinned ? '#D97706' : '#94A3B8'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleOpenEdit(item)}
                    >
                      <Ionicons name="create-outline" size={18} color="#4F46E5" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleDelete(item)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardContent}>{item.content}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ─── Create / Edit Announcement Modal ────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Edit Announcement' : 'New Announcement'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Announcement Title"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Type your announcement / update details here..."
                placeholderTextColor="#94A3B8"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={5}
              />

              <TouchableOpacity
                style={styles.pinToggleRow}
                onPress={() => setIsPinned(!isPinned)}
              >
                <Ionicons
                  name={isPinned ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isPinned ? '#D97706' : '#94A3B8'}
                />
                <View style={styles.pinToggleTexts}>
                  <Text style={styles.pinToggleLabel}>Pin this announcement</Text>
                  <Text style={styles.pinToggleDesc}>
                    Keep it at the very top of the announcement feed
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, submitting && styles.disabledBtn]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingItem ? 'Save Changes' : 'Publish'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  pinnedCard: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  pinnedBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  authorAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  authorTexts: {
    justifyContent: 'center',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  postDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    padding: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardContent: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyCreateBtn: {
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyCreateBtnText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingVertical: 8,
  },
  pinToggleTexts: {
    flex: 1,
  },
  pinToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  pinToggleDesc: {
    fontSize: 11,
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
  disabledBtn: {
    opacity: 0.6,
  },
});
