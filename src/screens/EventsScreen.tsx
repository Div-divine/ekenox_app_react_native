import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
  TextInput,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import feedService, { Event, PaginatedEvents } from '../services/feedService';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UrlHelper } from '../utils/urlHelper';

// ── platform geo ──────────────────────────────────────────────────────────────
let Geolocation: any = null;
try {
  Geolocation = require('@react-native-community/geolocation');
} catch {
  try {
    const expo = require('expo-location');
    Geolocation = { expo };
  } catch {}
}

const { width: SCREEN_W } = Dimensions.get('window');

// ─── helpers ──────────────────────────────────────────────────────────────────

const resolveMediaUrl = (url?: string) => UrlHelper.convertPathToUrl(url);

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

// ─── types ─────────────────────────────────────────────────────────────────────

type TabKey = 'Ongoing' | 'Upcoming' | 'Nearby' | 'Registered';

const TABS: TabKey[] = ['Ongoing', 'Upcoming', 'Nearby', 'Registered'];

const TAB_ICONS: Record<TabKey, { active: string; inactive: string }> = {
  Ongoing: { active: 'play-circle', inactive: 'play-circle-outline' },
  Upcoming: { active: 'calendar', inactive: 'calendar-outline' },
  Nearby: { active: 'location', inactive: 'location-outline' },
  Registered: { active: 'checkmark-circle', inactive: 'checkmark-circle-outline' },
};

// ─── main screen ──────────────────────────────────────────────────────────────

export const EventsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // ── state ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('Ongoing');
  const [isListView, setIsListView] = useState(true);

  // Per-tab data maps
  const [eventsMap, setEventsMap] = useState<Record<TabKey, Event[]>>({
    Ongoing: [],
    Upcoming: [],
    Nearby: [],
    Registered: [],
  });
  const [loadingMap, setLoadingMap] = useState<Record<TabKey, boolean>>({
    Ongoing: true,
    Upcoming: false,
    Nearby: false,
    Registered: false,
  });
  const [hasMoreMap, setHasMoreMap] = useState<Record<TabKey, boolean>>({
    Ongoing: false,
    Upcoming: false,
    Nearby: false,
    Registered: false,
  });
  const [offsetMap, setOffsetMap] = useState<Record<TabKey, number>>({
    Ongoing: 0,
    Upcoming: 0,
    Nearby: 0,
    Registered: 0,
  });
  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(new Set());

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Event[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimer = useRef<any>(null);

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // Location (for Nearby)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState(false);

  // Calendar date selection
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Registration action loading
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // ── location permission ─────────────────────────────────────────────────────
  const requestLocation = useCallback(async () => {
    try {
      // Try expo-location first
      const expoLocation = require('expo-location');
      const { status } = await expoLocation.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await expoLocation.getCurrentPositionAsync({});
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationError(false);
      } else {
        setLocationError(true);
      }
    } catch {
      setLocationError(true);
    }
  }, []);

  // ── fetch helpers ───────────────────────────────────────────────────────────
  const fetchTab = useCallback(
    async (tab: TabKey, offset = 0, append = false) => {
      setLoadingMap(prev => ({ ...prev, [tab]: true }));
      try {
        let result: PaginatedEvents = { events: [], total: 0, hasMore: false };

        if (tab === 'Ongoing') {
          result = await feedService.getOngoingEvents(20, offset);
        } else if (tab === 'Upcoming') {
          result = await feedService.getUpcomingEvents(20, offset);
        } else if (tab === 'Nearby') {
          if (!location) {
            await requestLocation();
            setLoadingMap(prev => ({ ...prev, [tab]: false }));
            return;
          }
          result = await feedService.getNearbyEvents(
            location.latitude,
            location.longitude,
            50.0,
            20,
            offset,
          );
        } else if (tab === 'Registered') {
          const events = await feedService.getMyRegisteredEvents();
          result = { events, total: events.length, hasMore: false };
        }

        setEventsMap(prev => ({
          ...prev,
          [tab]: append ? [...prev[tab], ...result.events] : result.events,
        }));
        setHasMoreMap(prev => ({ ...prev, [tab]: result.hasMore }));
        setOffsetMap(prev => ({ ...prev, [tab]: offset + result.events.length }));
        setLoadedTabs(prev => new Set([...prev, tab]));
      } catch (e: any) {
        console.error(`Error fetching ${tab} events:`, e.message);
      } finally {
        setLoadingMap(prev => ({ ...prev, [tab]: false }));
      }
    },
    [location, requestLocation],
  );

  // ── initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTab('Ongoing');
    requestLocation();
  }, []);

  // ── tab switch → lazy load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedTabs.has(activeTab)) {
      if (activeTab === 'Nearby' && !location) {
        requestLocation();
      } else {
        fetchTab(activeTab);
      }
    }
  }, [activeTab]);

  // Load nearby once location arrives
  useEffect(() => {
    if (location && !loadedTabs.has('Nearby')) {
      fetchTab('Nearby');
    }
  }, [location]);

  // ── refresh ─────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffsetMap(prev => ({ ...prev, [activeTab]: 0 }));
    await fetchTab(activeTab, 0, false);
    setRefreshing(false);
  }, [activeTab, fetchTab]);

  // ── load more ───────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!hasMoreMap[activeTab] || loadingMap[activeTab]) return;
    fetchTab(activeTab, offsetMap[activeTab], true);
  }, [activeTab, hasMoreMap, loadingMap, offsetMap, fetchTab]);

  // ── search ──────────────────────────────────────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await feedService.searchEvents(text.trim(), 20, 0);
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
  };

  // ── registration toggle ─────────────────────────────────────────────────────
  const handleToggleRegistration = async (event: Event) => {
    const isReg = event.isRegistered || event.is_registered;
    setActionLoadingId(event.id);
    try {
      if (isReg) {
        const r = await feedService.unregisterFromEvent(event.id);
        if (r.success) {
          Alert.alert('Done', `Unregistered from "${event.title}".`);
          updateEventInMap(event.id, { isRegistered: false, is_registered: false });
          // Remove from Registered tab
          setEventsMap(prev => ({
            ...prev,
            Registered: prev.Registered.filter(e => e.id !== event.id),
          }));
        } else Alert.alert('Error', r.message || 'Failed to unregister.');
      } else {
        const r = await feedService.registerForEvent(event.id);
        if (r.success) {
          Alert.alert('🎉 Registered!', `You're in for "${event.title}"!`);
          updateEventInMap(event.id, {
            isRegistered: true,
            is_registered: true,
            attendeesCount: (event.attendeesCount ?? 0) + 1,
          });
        } else Alert.alert('Error', r.message || 'Failed to register.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const updateEventInMap = (id: string | number, changes: Partial<Event>) => {
    setEventsMap(prev => {
      const updated = { ...prev };
      (Object.keys(updated) as TabKey[]).forEach(tab => {
        updated[tab] = updated[tab].map(e => (e.id === id ? { ...e, ...changes } : e));
      });
      return updated;
    });
  };

  // ── rendered event list ─────────────────────────────────────────────────────
  const displayedEvents = searchQuery.trim() ? searchResults : eventsMap[activeTab];
  const isCurrentLoading = loadingMap[activeTab];

  // ── calendar helpers ────────────────────────────────────────────────────────
  const eventsByDate = React.useMemo(() => {
    const map: Record<string, Event[]> = {};
    displayedEvents.forEach(ev => {
      const key = (ev.startTime || ev.start_time || '').slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [displayedEvents]);

  const selectedDateStr = selectedDate.toISOString().slice(0, 10);
  const eventsOnSelectedDate = eventsByDate[selectedDateStr] || [];

  const daysInMonth = () => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysCount = new Date(y, m + 1, 0).getDate();
    return { firstDay, daysCount };
  };

  const { firstDay, daysCount } = daysInMonth();
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const changeMonth = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    setSelectedDate(d);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={AppColors.textMedium} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events…"
          placeholderTextColor={AppColors.textMedium}
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={18} color={AppColors.textMedium} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tab selector ── */}
      {!searchQuery.trim() && (
        <View style={styles.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {TABS.map(tab => {
              const isActive = activeTab === tab;
              const icons = TAB_ICONS[tab];
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabChip, isActive && styles.tabChipActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={(isActive ? icons.active : icons.inactive) as any}
                    size={14}
                    color={isActive ? 'white' : AppColors.primary}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── List / Calendar toggle ── */}
      {!searchQuery.trim() && (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, isListView && styles.toggleBtnActive]}
            onPress={() => setIsListView(true)}
          >
            <Ionicons
              name="list"
              size={15}
              color={isListView ? AppColors.primary : AppColors.textMedium}
            />
            <Text style={[styles.toggleText, isListView && styles.toggleTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !isListView && styles.toggleBtnActive]}
            onPress={() => setIsListView(false)}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={!isListView ? AppColors.primary : AppColors.textMedium}
            />
            <Text style={[styles.toggleText, !isListView && styles.toggleTextActive]}>Calendar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Body ── */}
      {isCurrentLoading && eventsMap[activeTab].length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={AppColors.primary} size="large" />
          <Text style={styles.loadingText}>Loading {activeTab.toLowerCase()} events…</Text>
        </View>
      ) : activeTab === 'Nearby' && !location && !loadingMap['Nearby'] ? (
        <NearbyPermissionView onEnable={requestLocation} hasError={locationError} />
      ) : isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={AppColors.primary} size="small" />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      ) : !isListView ? (
        // ── Calendar view
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <CalendarView
              selectedDate={selectedDate}
              monthName={monthName}
              firstDay={firstDay}
              daysCount={daysCount}
              eventsByDate={eventsByDate}
              onDayPress={d => setSelectedDate(d)}
              onChangeMonth={changeMonth}
              eventsOnDate={eventsOnSelectedDate}
              onEventPress={ev =>
                navigation.navigate('EventDetail' as never, { eventId: ev.id } as never)
              }
            />
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />
          }
        />
      ) : (
        // ── List view
        <FlatList
          data={displayedEvents}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              actionLoadingId={actionLoadingId}
              onPress={() =>
                navigation.navigate('EventDetail' as never, { eventId: item.id } as never)
              }
              onRegisterPress={() => handleToggleRegistration(item)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            hasMoreMap[activeTab] && !searchQuery.trim() ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={AppColors.primary} size="small" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState tab={activeTab} hasSearch={!!searchQuery.trim()} />
          }
        />
      )}
    </View>
  );
};

// ─── EventCard ────────────────────────────────────────────────────────────────

const EventCard = ({
  event,
  actionLoadingId,
  onPress,
  onRegisterPress,
}: {
  event: Event;
  actionLoadingId: string | number | null;
  onPress: () => void;
  onRegisterPress: () => void;
}) => {
  const status = getStatusInfo(event);
  const isReg = event.isRegistered || event.is_registered;
  const isLoading = actionLoadingId === event.id;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* Banner */}
      <View style={styles.cardImageWrap}>
        <Image
          source={{ uri: resolveMediaUrl(event.banner_image || event.bannerImage) }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={11} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        {event.distance_km !== undefined && (
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate" size={10} color="white" />
            <Text style={styles.distanceText}>{event.distance_km.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>

        {event.organizer && (
          <Text style={styles.cardOrganizer} numberOfLines={1}>
            by {event.organizer.name}
          </Text>
        )}

        <View style={styles.cardInfoRow}>
          <Ionicons name="time-outline" size={13} color={AppColors.primary} />
          <Text style={styles.cardInfoText}>
            {formatDateRange(event.startTime || event.start_time || '', event.endTime || event.end_time || '')}
          </Text>
        </View>

        <View style={styles.cardInfoRow}>
          <Ionicons name="location-outline" size={13} color={AppColors.primary} />
          <Text style={styles.cardInfoText} numberOfLines={1}>{event.location || 'Location TBD'}</Text>
        </View>

        <View style={styles.cardInfoRow}>
          <Ionicons name="people-outline" size={13} color={AppColors.primary} />
          <Text style={styles.cardInfoText}>
            {event.attendees_count ?? event.attendeesCount ?? 0} attending
            {event.max_attendees ? ` / ${event.max_attendees} max` : ''}
          </Text>
        </View>

        {/* Categories */}
        {event.categories && event.categories.length > 0 && (
          <View style={styles.cardCatsRow}>
            {event.categories.slice(0, 3).map(c => (
              <View key={c.id} style={styles.catChip}>
                <Text style={styles.catChipText}>{c.name}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.regBtn, isReg && styles.regBtnActive]}
            onPress={onRegisterPress}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={isReg ? AppColors.primary : 'white'} size="small" />
            ) : (
              <>
                <Ionicons
                  name={isReg ? 'checkmark-circle' : 'add-circle-outline'}
                  size={15}
                  color={isReg ? AppColors.primary : 'white'}
                />
                <Text style={[styles.regBtnText, isReg && styles.regBtnTextActive]}>
                  {isReg ? 'Registered' : 'Register'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.detailBtn}
            onPress={onPress}
          >
            <Text style={styles.detailBtnText}>View Details</Text>
            <Ionicons name="chevron-forward" size={13} color={AppColors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Calendar view ────────────────────────────────────────────────────────────

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CalendarView = ({
  selectedDate,
  monthName,
  firstDay,
  daysCount,
  eventsByDate,
  onDayPress,
  onChangeMonth,
  eventsOnDate,
  onEventPress,
}: {
  selectedDate: Date;
  monthName: string;
  firstDay: number;
  daysCount: number;
  eventsByDate: Record<string, Event[]>;
  onDayPress: (d: Date) => void;
  onChangeMonth: (delta: number) => void;
  eventsOnDate: Event[];
  onEventPress: (e: Event) => void;
}) => {
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysCount; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={calStyles.container}>
      {/* Month nav */}
      <View style={calStyles.monthRow}>
        <TouchableOpacity onPress={() => onChangeMonth(-1)} style={calStyles.arrowBtn}>
          <Ionicons name="chevron-back" size={20} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{monthName}</Text>
        <TouchableOpacity onPress={() => onChangeMonth(1)} style={calStyles.arrowBtn}>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textDark} />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={calStyles.daysRow}>
        {DAYS.map(d => (
          <Text key={d} style={calStyles.dayLabel}>{d}</Text>
        ))}
      </View>

      {/* Cells */}
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={`empty-${idx}`} style={calStyles.cell} />;
          const cellDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
          const key = cellDate.toISOString().slice(0, 10);
          const hasEvents = !!eventsByDate[key]?.length;
          const isSelected =
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === cellDate.getMonth();
          const isToday =
            new Date().toISOString().slice(0, 10) === key;

          return (
            <TouchableOpacity
              key={`day-${day}`}
              style={[
                calStyles.cell,
                isSelected && calStyles.cellSelected,
                isToday && !isSelected && calStyles.cellToday,
              ]}
              onPress={() => onDayPress(cellDate)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  calStyles.cellText,
                  isSelected && calStyles.cellTextSelected,
                  isToday && !isSelected && calStyles.cellTextToday,
                ]}
              >
                {day}
              </Text>
              {hasEvents && (
                <View
                  style={[calStyles.dot, isSelected && { backgroundColor: 'white' }]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events for selected date */}
      <View style={calStyles.selectedSection}>
        <Text style={calStyles.selectedTitle}>
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        {eventsOnDate.length === 0 ? (
          <View style={calStyles.emptyDate}>
            <Ionicons name="calendar-outline" size={36} color={AppColors.textLight} />
            <Text style={calStyles.emptyDateText}>No events on this date</Text>
          </View>
        ) : (
          eventsOnDate.map(ev => (
            <TouchableOpacity
              key={ev.id}
              style={calStyles.eventRow}
              onPress={() => onEventPress(ev)}
              activeOpacity={0.82}
            >
              <View style={calStyles.eventRowLine} />
              <View style={calStyles.eventRowContent}>
                <Text style={calStyles.eventRowTitle} numberOfLines={1}>{ev.title}</Text>
                <Text style={calStyles.eventRowTime}>
                  {formatTime(ev.startTime || ev.start_time || '')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
};

// ─── Nearby permission ─────────────────────────────────────────────────────────

const NearbyPermissionView = ({
  onEnable,
  hasError,
}: {
  onEnable: () => void;
  hasError: boolean;
}) => (
  <View style={styles.emptyContainer}>
    <Ionicons name="location-outline" size={60} color={AppColors.textLight} />
    <Text style={styles.emptyTitle}>Location Required</Text>
    <Text style={styles.emptySub}>
      {hasError
        ? 'Location permission was denied. Please enable it in your device settings.'
        : 'Enable location access to find eco events near you.'}
    </Text>
    {!hasError && (
      <TouchableOpacity style={styles.enableBtn} onPress={onEnable}>
        <Ionicons name="navigate" size={18} color="white" />
        <Text style={styles.enableBtnText}>Enable Location</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Empty state ───────────────────────────────────────────────────────────────

const EmptyState = ({ tab, hasSearch }: { tab: TabKey; hasSearch: boolean }) => {
  const messages: Record<TabKey, string> = {
    Ongoing: 'No eco events are happening right now.',
    Upcoming: 'No upcoming events scheduled yet.',
    Nearby: 'No events found within 50 km of your location.',
    Registered: "You haven't registered for any eco initiatives yet.",
  };
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={60} color={AppColors.textLight} />
      <Text style={styles.emptyTitle}>{hasSearch ? 'No results found' : 'No Events'}</Text>
      <Text style={styles.emptySub}>{hasSearch ? 'Try a different search term.' : messages[tab]}</Text>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 6 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: AppColors.textDark,
  },

  // Tabs
  tabBar: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: AppColors.primary + '14',
    marginRight: 8,
  },
  tabChipActive: {
    backgroundColor: AppColors.primary,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
  },
  tabChipTextActive: {
    color: 'white',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F2',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    paddingVertical: 8,
    gap: 5,
  },
  toggleBtnActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  toggleTextActive: {
    color: AppColors.textDark,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: AppColors.textMedium,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Card
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageWrap: {
    height: 160,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  distanceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 4,
  },
  distanceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    marginBottom: 4,
    lineHeight: 22,
  },
  cardOrganizer: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  cardInfoText: {
    fontSize: 12,
    color: AppColors.textMedium,
    flex: 1,
  },
  cardCatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  catChip: {
    backgroundColor: AppColors.primary + '14',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  catChipText: {
    fontSize: 10,
    color: AppColors.primary,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  regBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    height: 38,
    gap: 6,
  },
  regBtnActive: {
    backgroundColor: AppColors.primary + '14',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  regBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  regBtnTextActive: {
    color: AppColors.primary,
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.primary + '30',
    gap: 4,
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
    marginTop: 14,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 20,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  enableBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
});

// Calendar styles
const calStyles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  arrowBtn: { padding: 6 },
  monthLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  daysRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textMedium,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    backgroundColor: AppColors.primary,
    borderRadius: 22,
  },
  cellToday: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  cellText: {
    fontSize: 13,
    color: AppColors.textDark,
    fontWeight: '500',
  },
  cellTextSelected: {
    color: 'white',
    fontWeight: '800',
  },
  cellTextToday: {
    color: AppColors.primary,
    fontWeight: '800',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.primary,
    marginTop: 2,
  },

  selectedSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.textDark,
    marginBottom: 12,
  },
  emptyDate: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyDateText: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 8,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventRowLine: {
    width: 4,
    height: '100%',
    minHeight: 36,
    backgroundColor: AppColors.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  eventRowContent: { flex: 1 },
  eventRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  eventRowTime: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
});
