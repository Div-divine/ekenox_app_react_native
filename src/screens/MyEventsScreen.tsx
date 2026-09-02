import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import feedService, { Event } from '../services/feedService';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UrlHelper } from '../utils/urlHelper';

const { width: SCREEN_W } = Dimensions.get('window');

const resolveMediaUrl = (url?: string) => UrlHelper.convertPathToUrl(url);

const formatShortDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (iso: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateRange = (s: string, e: string) => {
  const sd = formatShortDate(s);
  const ed = formatShortDate(e);
  if (!sd) return 'Date TBD';
  if (sd === ed) return `${sd}  •  ${formatTime(s)} – ${formatTime(e)}`;
  return `${sd} ${formatTime(s)} → ${ed} ${formatTime(e)}`;
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

type TabKey = 'Organized' | 'Registered';

export default function MyEventsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('Organized');
  const [organizedEvents, setOrganizedEvents] = useState<Event[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<Event[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreOrganized, setHasMoreOrganized] = useState(false);
  const [organizedOffset, setOrganizedOffset] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Fetch Organized Events
  const fetchOrganized = async (offset = 0, append = false) => {
    try {
      const result = await feedService.getMyOrganizedEvents(10, offset);
      if (append) {
        setOrganizedEvents(prev => [...prev, ...result.events]);
      } else {
        setOrganizedEvents(result.events);
      }
      setHasMoreOrganized(result.hasMore);
      setOrganizedOffset(offset + result.events.length);
    } catch (e: any) {
      console.error('Error fetching organized events:', e.message);
    }
  };

  // Fetch Registered Events
  const fetchRegistered = async () => {
    try {
      const events = await feedService.getMyRegisteredEvents();
      setRegisteredEvents(events);
    } catch (e: any) {
      console.error('Error fetching registered events:', e.message);
    }
  };

  const loadData = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    
    if (activeTab === 'Organized') {
      await fetchOrganized(0, false);
    } else {
      await fetchRegistered();
    }
    
    setLoading(false);
  }, [activeTab]);

  // Use focus effect to ensure fresh data whenever user navigates back
  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'Organized') {
      await fetchOrganized(0, false);
    } else {
      await fetchRegistered();
    }
    setRefreshing(false);
  };

  const handleLoadMoreOrganized = () => {
    if (!hasMoreOrganized || loading || refreshing) return;
    fetchOrganized(organizedOffset, true);
  };

  const handleCancelEvent = (event: Event) => {
    Alert.alert(
      'Cancel Event',
      `Are you sure you want to permanently cancel and delete "${event.title}"? This cannot be undone.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel Event',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(event.id);
            try {
              const res = await feedService.cancelEvent(event.id);
              if (res.success) {
                Alert.alert('Success', 'Event has been cancelled successfully.');
                setOrganizedEvents(prev => prev.filter(e => e.id !== event.id));
              } else {
                Alert.alert('Error', res.message || 'Failed to cancel event.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An error occurred.');
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const handleUnregisterEvent = (event: Event) => {
    Alert.alert(
      'Unregister',
      `Do you want to unregister from "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unregister',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(event.id);
            try {
              const res = await feedService.unregisterFromEvent(event.id);
              if (res.success) {
                Alert.alert('Success', 'Successfully unregistered from event.');
                setRegisteredEvents(prev => prev.filter(e => e.id !== event.id));
              } else {
                Alert.alert('Error', res.message || 'Failed to unregister.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An error occurred.');
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    const status = getStatusInfo(item);
    const isOrganized = activeTab === 'Organized';
    const isActLoading = actionLoadingId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        >
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: resolveMediaUrl(item.banner_image || item.bannerImage) }}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Ionicons name={status.icon} size={11} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={14} color={AppColors.primary} />
              <Text style={styles.infoText} numberOfLines={1}>
                {formatDateRange(item.startTime || item.start_time || '', item.endTime || item.end_time || '')}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color={AppColors.primary} />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.location || 'Location TBD'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={14} color={AppColors.primary} />
              <Text style={styles.infoText}>
                {item.attendees_count ?? item.attendeesCount ?? 0} registered
              </Text>
            </View>

            {/* Categories */}
            {item.categories && item.categories.length > 0 && (
              <View style={styles.categoriesRow}>
                {item.categories.slice(0, 3).map((c, idx) => (
                  <View key={c.id || c.name || idx.toString()} style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>{c.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
          >
            <Text style={styles.detailsBtnText}>View Details</Text>
            <Ionicons name="arrow-forward" size={14} color={AppColors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isOrganized ? styles.cancelBtn : styles.unregisterBtn]}
            onPress={() => isOrganized ? handleCancelEvent(item) : handleUnregisterEvent(item)}
            disabled={isActLoading}
          >
            {isActLoading ? (
              <ActivityIndicator size="small" color={AppColors.error} />
            ) : (
              <>
                <Ionicons
                  name={isOrganized ? 'trash-outline' : 'close-circle-outline'}
                  size={14}
                  color={AppColors.error}
                />
                <Text style={styles.actionBtnText}>
                  {isOrganized ? 'Cancel Event' : 'Unregister'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    const isOrganized = activeTab === 'Organized';
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBg}>
          <Ionicons
            name={isOrganized ? 'calendar-outline' : 'checkmark-circle-outline'}
            size={40}
            color={AppColors.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isOrganized ? 'No Events Created' : 'No Events Registered'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isOrganized
            ? "You haven't organized any eco events yet. Tap the '+' button on the main Events screen to create one!"
            : "You haven't registered for any events yet. Browse eco events and join the movement!"}
        </Text>
        {!isOrganized && (
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('Events')}
          >
            <Text style={styles.browseBtnText}>Browse Events</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Events</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Selectors */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Organized' && styles.activeTab]}
          onPress={() => {
            setActiveTab('Organized');
            setLoading(true);
          }}
        >
          <Ionicons
            name="construct-outline"
            size={18}
            color={activeTab === 'Organized' ? AppColors.primary : AppColors.textMedium}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'Organized' && styles.activeTabText]}>
            Organized
          </Text>
          {activeTab === 'Organized' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'Registered' && styles.activeTab]}
          onPress={() => {
            setActiveTab('Registered');
            setLoading(true);
          }}
        >
          <Ionicons
            name="checkbox-outline"
            size={18}
            color={activeTab === 'Registered' ? AppColors.primary : AppColors.textMedium}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'Registered' && styles.activeTabText]}>
            Registered
          </Text>
          {activeTab === 'Registered' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading your events...</Text>
        </View>
      ) : (
        <FlatList
          data={activeTab === 'Organized' ? organizedEvents : registeredEvents}
          keyExtractor={item => item.id.toString()}
          renderItem={renderEventItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[AppColors.primary]}
            />
          }
          onEndReached={activeTab === 'Organized' ? handleLoadMoreOrganized : null}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={
            activeTab === 'Organized' && hasMoreOrganized ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={AppColors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: AppColors.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'rgba(11, 110, 79, 0.03)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  activeTabText: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: AppColors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: AppColors.textMedium,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    height: 150,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 10,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: AppColors.textMedium,
    flex: 1,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  categoryChip: {
    backgroundColor: 'rgba(11, 110, 79, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryChipText: {
    fontSize: 11,
    color: AppColors.primary,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFBFC',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: 'rgba(211, 47, 47, 0.06)',
  },
  unregisterBtn: {
    backgroundColor: 'rgba(211, 47, 47, 0.06)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.error,
  },
  footerLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(11, 110, 79, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  browseBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
