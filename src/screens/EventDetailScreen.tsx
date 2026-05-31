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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';
import feedService, { Event } from '../services/feedService';
import { UrlHelper } from '../utils/urlHelper';

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

type RouteParams = { eventId: string | number };

export const EventDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ EventDetail: RouteParams }, 'EventDetail'>>();
  const insets = useSafeAreaInsets();
  const { eventId } = route.params;

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

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

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

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
    } catch {}
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
            <View style={styles.organizerRow}>
              <View style={styles.organizerAvatar}>
                <Ionicons name="person" size={14} color={AppColors.primary} />
              </View>
              <Text style={styles.organizerText}>
                Organized by <Text style={styles.organizerName}>{event.organizer.name}</Text>
              </Text>
            </View>
          )}

          {/* Categories */}
          {event.categories && event.categories.length > 0 && (
            <View style={styles.tagsRow}>
              {event.categories.map(cat => (
                <View key={cat.id} style={styles.categoryChip}>
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

          <View style={styles.divider} />

          {/* Info rows */}
          <InfoRow icon="calendar-outline" label={formatDateRange(event.startTime, event.endTime)} />
          <InfoRow icon="location-outline" label={event.location || 'Location TBD'} />
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
          <Text style={styles.description}>{event.description || 'No description available.'}</Text>

          {/* Attendees list */}
          {event.registrations && event.registrations.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Champions Attending ({attendeesCount})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attendeesList}>
                {event.registrations.slice(0, 12).map(att => (
                  <View key={att.id} style={styles.attendeeItem}>
                    {att.profile_image ? (
                      <Image
                        source={{ uri: resolveMediaUrl(att.profile_image) }}
                        style={styles.attendeeAvatar}
                      />
                    ) : (
                      <View style={[styles.attendeeAvatar, styles.attendeeAvatarFallback]}>
                        <Text style={styles.attendeeInitial}>
                          {(att.full_name || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.attendeeName} numberOfLines={1}>
                      {att.full_name?.split(' ')[0]}
                    </Text>
                  </View>
                ))}
                {attendeesCount > 12 && (
                  <View style={styles.attendeeItem}>
                    <View style={[styles.attendeeAvatar, styles.attendeeAvatarMore]}>
                      <Text style={styles.attendeeMoreText}>+{attendeesCount - 12}</Text>
                    </View>
                    <Text style={styles.attendeeName}>More</Text>
                  </View>
                )}
              </ScrollView>
            </>
          )}

          {/* Stats row */}
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            <StatPill icon="people-outline" value={attendeesCount} label="Going" />
            {event.comment_count !== undefined && (
              <StatPill icon="chatbubble-outline" value={event.comment_count} label="Comments" />
            )}
            {event.share_count !== undefined && (
              <StatPill icon="share-outline" value={event.share_count} label="Shares" />
            )}
            {event.car_share_count !== undefined && (
              <StatPill icon="car-outline" value={event.car_share_count} label="Car Shares" />
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── Sticky Registration CTA ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <TouchableOpacity
          style={[styles.registerBtn, isRegistered && styles.unregisterBtn]}
          onPress={handleRegister}
          disabled={isRegistering || status.label === 'Past'}
          activeOpacity={0.85}
        >
          {isRegistering ? (
            <ActivityIndicator color={isRegistered ? AppColors.primary : 'white'} size="small" />
          ) : (
            <>
              <Ionicons
                name={isRegistered ? 'checkmark-circle' : 'add-circle-outline'}
                size={20}
                color={isRegistered ? AppColors.primary : 'white'}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.registerBtnText, isRegistered && styles.unregisterBtnText]}>
                {status.label === 'Past'
                  ? 'This event has ended'
                  : isRegistered
                  ? 'Unregister / Cancel'
                  : 'Register Now'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
});
