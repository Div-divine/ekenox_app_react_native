import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import feedService, { AppNotification } from '../services/feedService';
import { AppColors } from '../theme/colors';

export const NotificationScreen = () => {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await feedService.getNotifications(50, 0);
      setNotifications(data);
    } catch (e: any) {
      console.error('Failed to load notifications:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      const success = await feedService.markAllNotificationsRead();
      if (success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );
      } else {
        Alert.alert('Error', 'Failed to mark all notifications as read.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    }
  };

  const handleNotificationPress = async (item: AppNotification) => {
    // Mark as read in background if unread
    if (!item.is_read) {
      try {
        const success = await feedService.markNotificationRead(item.id);
        if (success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
          );
        }
      } catch (e) {
        console.warn('Failed to mark notification as read:', e);
      }
    }

    // Navigation logic based on data payload
    const data = item.data || {};
    if (data.group_id) {
      navigation.navigate('GroupDetail', { groupId: data.group_id });
    } else if (data.association_id) {
      navigation.navigate('AssociationDetail', { associationId: data.association_id });
    } else if (data.feed_id) {
      // Go back to feed tab or tell user
      navigation.navigate('Feed');
    } else if (item.action_url) {
      Alert.alert('Notification Action', `Please visit: ${item.action_url}`);
    } else {
      // Show full details
      Alert.alert(item.title || 'Notification Details', item.body || '');
    }
  };

  const handleAcceptDelegation = async (delegationId: string | number, notificationId: string | number) => {
    try {
      const res = await feedService.acceptEventDelegation(delegationId);
      if (res.success) {
        Alert.alert('Accepted', 'You are now an administrator of this event!');
        await feedService.markNotificationRead(notificationId);
        fetchNotifications();
      } else {
        Alert.alert('Error', res.message || 'Failed to accept delegation.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    }
  };

  const handleDeclineDelegation = async (delegationId: string | number, notificationId: string | number) => {
    try {
      const res = await feedService.declineEventDelegation(delegationId);
      if (res.success) {
        Alert.alert('Declined', 'Delegation request declined.');
        await feedService.markNotificationRead(notificationId);
        fetchNotifications();
      } else {
        Alert.alert('Error', res.message || 'Failed to decline delegation.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    }
  };

  const handleAcceptInvitation = async (invitationId: string | number, notificationId: string | number) => {
    try {
      const res = await feedService.respondToEventInvitation(invitationId, 'accept');
      if (res.success) {
        Alert.alert('🎉 Accepted', 'Invitation accepted! You are now registered for this event.');
        await feedService.markNotificationRead(notificationId);
        fetchNotifications();
      } else {
        Alert.alert('Error', res.message || 'Failed to accept invitation.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    }
  };

  const handleDeclineInvitation = async (invitationId: string | number, notificationId: string | number) => {
    try {
      const res = await feedService.respondToEventInvitation(invitationId, 'decline');
      if (res.success) {
        Alert.alert('Declined', 'Invitation declined.');
        await feedService.markNotificationRead(notificationId);
        fetchNotifications();
      } else {
        Alert.alert('Error', res.message || 'Failed to decline invitation.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    }
  };

  const handleDeleteNotification = (id: string | number) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await feedService.deleteNotification(id);
              if (success) {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
              } else {
                Alert.alert('Error', 'Failed to delete notification.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'An error occurred.');
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 600);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderNotificationItem = ({ item }: { item: AppNotification }) => {
    const avatarUrl = item.related_user?.profile_picture || item.image_url;
    const initials = item.related_user?.full_name
      ? item.related_user.full_name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      : 'NK';

    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, !item.is_read && styles.unreadAvatarPlaceholder]}>
              <Text style={[styles.avatarPlaceholderText, !item.is_read && styles.unreadAvatarText]}>
                {initials}
              </Text>
            </View>
          )}

          <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.titleText, !item.is_read && styles.unreadTitleText]} numberOfLines={1}>
                {item.title || 'Notification'}
              </Text>
              {!item.is_read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.bodyText} numberOfLines={2}>
              {item.body || ''}
            </Text>
            <Text style={styles.timeText}>{formatTimeAgo(item.created_at)}</Text>
            {item.type === 'event_delegation_request' && ((item as any).additional_data?.delegation_id || (item as any).additionalData?.delegation_id) && (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => handleAcceptDelegation((item as any).additional_data?.delegation_id || (item as any).additionalData?.delegation_id, item.id)}
                >
                  <Text style={styles.actionBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.declineBtn]}
                  onPress={() => handleDeclineDelegation((item as any).additional_data?.delegation_id || (item as any).additionalData?.delegation_id, item.id)}
                >
                  <Text style={[styles.actionBtnText, { color: AppColors.textDark }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {(item.type === 'event_invite' || item.type === 'event_invitation') && ((item as any).additional_data?.invitation_id || (item as any).additionalData?.invitation_id) && (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => handleAcceptInvitation((item as any).additional_data?.invitation_id || (item as any).additionalData?.invitation_id, item.id)}
                >
                  <Text style={styles.actionBtnText}>Accept Invitation</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.declineBtn]}
                  onPress={() => handleDeclineInvitation((item as any).additional_data?.invitation_id || (item as any).additionalData?.invitation_id, item.id)}
                >
                  <Text style={[styles.actionBtnText, { color: AppColors.textDark }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteNotification(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color={AppColors.textMedium} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllReadButton} onPress={handleMarkAllRead}>
            <Text style={styles.markAllReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[AppColors.primary]}
              tintColor={AppColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="notifications-off-outline" size={48} color={AppColors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyText}>
                You will be notified here when someone interacts with your posts, groups, or comments.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  markAllReadButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  card: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unreadCard: {
    backgroundColor: 'rgba(11, 110, 79, 0.04)', // Tint of primary color for unread items
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadAvatarPlaceholder: {
    backgroundColor: '#E6F4EA',
  },
  avatarPlaceholderText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  unreadAvatarText: {
    color: AppColors.primary,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.textDark,
    flex: 1,
  },
  unreadTitleText: {
    color: AppColors.textDark,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.primary,
    marginLeft: 6,
  },
  bodyText: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    color: AppColors.textLight,
  },
  deleteButton: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  acceptBtn: {
    backgroundColor: AppColors.primary,
  },
  declineBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default NotificationScreen;
