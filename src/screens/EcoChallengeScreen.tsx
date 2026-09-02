import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  FlatList,
  Dimensions,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ImageBackground,
} from 'react-native';
import { Ionicons, FontAwesome, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import challengeService, { Challenge } from '../services/challengeService';
import { UrlHelper } from '../utils/urlHelper';
import { CustomActionSheetModal, ActionSheetOption } from '../components/CustomActionSheetModal';

const resolveMediaUrl = (url?: string, fallbackUrl?: string) => {
  if (!url || url.trim() === '') {
    return fallbackUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800';
  }
  return UrlHelper.convertPathToUrl(url);
};

const { width } = Dimensions.get('window');

const getCategoryDetails = (category: any) => {
  return {
    icon: category?.icon || 'leaf',
    color: category?.color || '#4CAF50',
    iconType: category?.icon_type || 'ionicons',
    name: category?.display_name || category?.name || 'Eco',
  };
};

const CategoryIcon = ({ icon, type, size, color }: { icon: string; type: string; size: number; color: string }) => {
  const libType = (type || 'ionicons').toLowerCase();
  switch (libType) {
    case 'fontawesome':
    case 'font-awesome':
      return <FontAwesome name={icon as any} size={size} color={color} />;
    case 'material':
    case 'materialicons':
      return <MaterialIcons name={icon as any} size={size} color={color} />;
    case 'materialcommunity':
    case 'materialcommunityicons':
      return <MaterialCommunityIcons name={icon as any} size={size} color={color} />;
    case 'ionicons':
    default:
      return <Ionicons name={icon as any} size={size} color={color} />;
  }
};

const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const dateOnly = String(dateStr).split('T')[0].split(' ')[0];
  const parts = dateOnly.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return new Date(dateStr);
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDay = (d1: Date | null, d2: Date | null): boolean => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const getCalendarMonthGrid = (year: number, month: number) => {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startingWeekday = firstDayOfMonth.getDay();
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const cells: { date: Date; isCurrentMonth: boolean }[] = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    cells.push({ date: d, isCurrentMonth: false });
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ date: d, isCurrentMonth: true });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      cells.push({ date: d, isCurrentMonth: false });
    }
  }

  return cells;
};

export const EcoChallengeScreen = () => {
  const { user, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scrollY = useRef(new Animated.Value(0)).current;

  // API State
  const [discoverChallenges, setDiscoverChallenges] = useState<Challenge[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);
  const [challengeLimits, setChallengeLimits] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  // Discover Pagination State
  const [discoverPage, setDiscoverPage] = useState(1);
  const [hasMoreDiscover, setHasMoreDiscover] = useState(true);
  const [isLoadingMoreDiscover, setIsLoadingMoreDiscover] = useState(false);

  // Categories & Drawer State
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [categoryDrawerVisible, setCategoryDrawerVisible] = useState<boolean>(false);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Modals
  const [durationModalVisible, setDurationModalVisible] = useState(false);
  const [selectedChallengeToJoin, setSelectedChallengeToJoin] = useState<Challenge | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(7);
  const [customDays, setCustomDays] = useState<string>('7');
  const [kickOffDate, setKickOffDate] = useState<string>(() => getLocalDateString());

  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedActiveChallenge, setSelectedActiveChallenge] = useState<any | null>(null);
  const [modalProgressLoading, setModalProgressLoading] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(() => new Date());
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date());

  // Expired challenges menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [expiredModalVisible, setExpiredModalVisible] = useState(false);
  const [expiredChallenges, setExpiredChallenges] = useState<any[]>([]);
  const [expiredLoading, setExpiredLoading] = useState(false);

  // Custom Action Sheet Modal State
  const [actionSheetConfig, setActionSheetConfig] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    options: ActionSheetOption[];
  }>({
    visible: false,
    title: 'Select an Action',
    options: [],
  });

  // Full Eco Journey Details Modal
  const [journeyModalVisible, setJourneyModalVisible] = useState(false);
  const [journeyActiveTab, setJourneyActiveTab] = useState<'stats' | 'leaderboard'>('stats');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const fetchLeaderboardData = async () => {
    setIsLeaderboardLoading(true);
    try {
      const res = await challengeService.getLeaderboard();
      if (res && res.success && res.data && res.data.leaderboard) {
        setLeaderboardData(res.data.leaderboard);
      } else {
        setLeaderboardData([]);
      }
    } catch (err) {
      console.error('Failed to load leaderboard data:', err);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  const handleTabToggle = (tab: 'stats' | 'leaderboard') => {
    setJourneyActiveTab(tab);
    if (tab === 'leaderboard') {
      fetchLeaderboardData();
    }
  };

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<any>(null);

  const HEADER_HEIGHT = 60 + insets.top;
  const headerTranslateY = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT).interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
  });

  const fetchData = useCallback(async () => {
    try {
      const [challengesRes, activeRes, statsRes, categoriesRes] = await Promise.all([
        challengeService.getChallenges({ page: 1, limit: 10 }),
        challengeService.getActiveChallenges(),
        challengeService.getStats(),
        challengeService.getCategories(),
      ]);

      // Filter out challenges that are already active
      const activeIds = activeRes.data.active_challenges.map((ac: any) => String(ac.challenge.id));
      const discoverable = challengesRes.data.challenges.filter(
        (c: Challenge) => !activeIds.includes(String(c.id))
      );

      setDiscoverChallenges(discoverable);
      setDiscoverPage(1);

      const pag = challengesRes.data.pagination;
      setHasMoreDiscover(pag ? pag.page < pag.total_pages : challengesRes.data.challenges.length === 10);

      setActiveChallenges(activeRes.data.active_challenges);
      setChallengeLimits(activeRes.data.challenge_limits);
      setStats(statsRes.data);

      setSelectedActiveChallenge((prev: any) => {
        if (!prev) return null;
        const fresh = activeRes.data.active_challenges.find(
          (ac: any) => String(ac.challenge.id) === String(prev.challenge.id)
        );
        return fresh || prev;
      });
      if (categoriesRes && categoriesRes.length > 0) {
        setCategories(categoriesRes);
      }
    } catch (e: any) {
      console.error('Failed to load Eco Challenges:', e.message);
      Alert.alert('Error', 'Could not load eco challenges data. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreChallenges = async () => {
    if (isLoadingMoreDiscover || !hasMoreDiscover) return;
    setIsLoadingMoreDiscover(true);
    try {
      const nextPage = discoverPage + 1;
      const res = await challengeService.getChallenges({ page: nextPage, limit: 10 });
      if (res && res.data && res.data.challenges) {
        const activeIds = activeChallenges.map((ac: any) => String(ac.challenge.id));
        const newDiscoverable = res.data.challenges.filter(
          (c: Challenge) => !activeIds.includes(String(c.id))
        );

        setDiscoverChallenges((prev: Challenge[]) => {
          const prevIds = prev.map(c => String(c.id));
          const filteredNew = newDiscoverable.filter(c => !prevIds.includes(String(c.id)));
          return [...prev, ...filteredNew];
        });

        setDiscoverPage(nextPage);
        const pag = res.data.pagination;
        setHasMoreDiscover(pag ? pag.page < pag.total_pages : res.data.challenges.length === 10);
      } else {
        setHasMoreDiscover(false);
      }
    } catch (err) {
      console.error('Failed to load more challenges:', err);
    } finally {
      setIsLoadingMoreDiscover(false);
    }
  };

  const toggleCategorySelection = (catId: number) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const clearCategoryFilters = () => {
    setSelectedCategories([]);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    refreshProfile();
  };

  const handleOpenJoin = (challenge: Challenge) => {
    setSelectedChallengeToJoin(challenge);
    setSelectedDuration(7);
    setCustomDays('7');
    setKickOffDate(getLocalDateString());
    setDurationModalVisible(true);
  };

  const handleJoin = async (actionType = 'start') => {
    if (!selectedChallengeToJoin) return;
    setDurationModalVisible(false);
    setActionLoadingId(selectedChallengeToJoin.id);

    try {
      const res = await challengeService.joinChallenge(
        selectedChallengeToJoin.id,
        selectedDuration,
        actionType,
        kickOffDate
      );

      if (res.success) {
        Alert.alert(
          '🎉 Challenge Started!',
          `You have joined "${selectedChallengeToJoin.title}" for ${selectedDuration} days. Let's make an impact!`
        );
        fetchData();
        refreshProfile();
      }
    } catch (err: any) {
      if (err.response && err.response.status === 409 && err.response.data?.requires_choice) {
        // Handle previous challenge attempt conflict
        Alert.alert(
          'Previous Attempt Found',
          'You have a previous attempt at this challenge. Would you like to resume where you left off or restart fresh?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setActionLoadingId(null) },
            { text: 'Resume', onPress: () => handleJoin('resume') },
            { text: 'Restart Fresh', style: 'destructive', onPress: () => handleJoin('restart') },
          ]
        );
        return;
      }

      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to join challenge');
    } finally {
      if (actionType !== 'start' || !actionLoadingId) {
        setActionLoadingId(null);
      }
    }
  };

  const handleMarkProgress = async (challengeId: string | number, dateString: string, completed: boolean) => {
    try {
      const res = await challengeService.markProgress(challengeId, dateString, completed);
      if (res.success) {
        const isSameDate = (d1: string, d2: string) => {
          if (!d1 || !d2) return false;
          return String(d1).split('T')[0].split(' ')[0] === String(d2).split('T')[0].split(' ')[0];
        };

        const updateDates = (currentCompleted: string[]) => {
          const filtered = (currentCompleted || []).filter((d: string) => !isSameDate(d, dateString));
          return completed ? [...filtered, dateString] : filtered;
        };

        // Update local active challenges state immediately
        setActiveChallenges(prev =>
          prev.map(ac => {
            if (ac.challenge.id === challengeId) {
              const currentCompleted = ac.progress?.completed_dates || [];
              const updatedCompleted = updateDates(currentCompleted);
              const updatedCompletedDays = updatedCompleted.length;
              const planned = ac.planned_duration_days || 7;
              const updatedRemaining = Math.max(0, planned - updatedCompletedDays);
              const pct = planned > 0 ? (updatedCompletedDays / planned) * 100 : 0;

              return {
                ...ac,
                days_remaining: updatedRemaining,
                progress: {
                  ...ac.progress,
                  completed_days: updatedCompletedDays,
                  completed_dates: updatedCompleted,
                  progress_percentage: Math.round(pct * 100) / 100,
                },
              };
            }
            return ac;
          })
        );

        // Update selected active challenge for the open modal
        setSelectedActiveChallenge((prev: any) => {
          if (prev && prev.challenge.id === challengeId) {
            const currentCompleted = prev.progress?.completed_dates || [];
            const updatedCompleted = updateDates(currentCompleted);
            const updatedCompletedDays = updatedCompleted.length;
            const planned = prev.planned_duration_days || 7;
            const updatedRemaining = Math.max(0, planned - updatedCompletedDays);
            const pct = planned > 0 ? (updatedCompletedDays / planned) * 100 : 0;

            return {
              ...prev,
              days_remaining: updatedRemaining,
              progress: {
                ...prev.progress,
                completed_days: updatedCompletedDays,
                completed_dates: updatedCompleted,
                progress_percentage: Math.round(pct * 100) / 100,
              },
            };
          }
          return prev;
        });

        // Silently refresh stats and profiles in the background
        const [statsRes] = await Promise.all([challengeService.getStats(), refreshProfile()]);
        setStats(statsRes.data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update progress');
    }
  };

  const handleClaimReward = async (activeChallenge: any) => {
    const id = activeChallenge.challenge.id;
    setActionLoadingId(id);
    try {
      const res = await challengeService.completeChallenge(id);
      if (res.success) {
        Alert.alert(
          '🏆 Challenge Completed!',
          `Awesome job! You completed "${activeChallenge.challenge.title}".\n\nReward Claimed successfully!`,
          [{ text: 'Great!', onPress: () => { } }]
        );
        fetchData();
        refreshProfile();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to claim reward');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleQuit = (challengeId: string | number, title: string) => {
    Alert.alert(
      'Quit Challenge',
      `Are you sure you want to quit "${title}"? Your current progress will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Quit',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Quit',
              'This action cannot be undone. Are you absolutely sure you want to quit this challenge?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Quit',
                  style: 'destructive',
                  onPress: async () => {
                    setActionLoadingId(challengeId);
                    try {
                      const res = await challengeService.quitChallenge(challengeId);
                      if (res.success) {
                        Alert.alert('Success', 'Challenge cancelled.');
                        fetchData();
                        refreshProfile();
                      }
                    } catch (err: any) {
                      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to quit challenge');
                    } finally {
                      setActionLoadingId(null);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const openProgressModal = async (activeChallenge: any) => {
    const challengeId = activeChallenge.challenge.id;
    const fresh = activeChallenges.find(
      ac => String(ac.challenge.id) === String(challengeId)
    ) || activeChallenge;

    setSelectedActiveChallenge(fresh);
    setSelectedCalendarDate(new Date());
    setCalendarViewMonth(new Date());
    setProgressModalVisible(true);
    setModalProgressLoading(true);

    try {
      const res = await challengeService.getChallengeProgress(challengeId);
      if (res && res.data) {
        let completedDates: string[] = res.data.completed_dates || [];
        if (!completedDates.length && res.data.progress) {
          completedDates = res.data.progress
            .filter((p: any) => p.completed)
            .map((p: any) => p.date);
        }

        const updateProgressObject = (target: any) => {
          if (!target) return target;
          const plannedDays = target.planned_duration_days || 7;
          const completedDays = completedDates.length;
          const daysRemaining = res.data.stats?.days_remaining ?? Math.max(0, plannedDays - completedDays);
          const streak = res.data.current_streak ?? target.current_streak ?? 0;

          return {
            ...target,
            days_remaining: daysRemaining,
            current_streak: streak,
            progress: {
              ...(target.progress || {}),
              completed_dates: completedDates,
              completed_days: completedDays,
            },
          };
        };

        setSelectedActiveChallenge((prev: any) => updateProgressObject(prev || fresh));

        setActiveChallenges(prev =>
          prev.map(ac => {
            if (String(ac.challenge.id) === String(challengeId)) {
              return updateProgressObject(ac);
            }
            return ac;
          })
        );
      }
    } catch (err) {
      console.error('Failed to fetch challenge progress for modal:', err);
    } finally {
      setModalProgressLoading(false);
    }
  };

  const getChallengeDatesList = (startDateStr: string, duration: number) => {
    if (!startDateStr) return [];
    const list = [];
    const start = parseLocalDate(startDateStr) || new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < duration; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const isFuture = d > today;
      const isToday = d.getTime() === today.getTime();
      const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      list.push({
        dayIndex: i + 1,
        dateString: getLocalDateString(d),
        formatted: dateFormatted,
        isFuture,
        isToday,
      });
    }
    return list;
  };

  const handleOpenTopMenu = () => {
    const options: ActionSheetOption[] = [
      {
        title: 'Expired Challenges',
        subtitle: 'View history of challenges that have ended',
        icon: 'time-outline',
        iconColor: '#D97706',
        onPress: () => {
          setExpiredLoading(true);
          setExpiredModalVisible(true);
          challengeService.getExpiredChallenges()
            .then(res => setExpiredChallenges(res.data?.expired_challenges ?? []))
            .catch(() => setExpiredChallenges([]))
            .finally(() => setExpiredLoading(false));
        },
      },
      {
        title: 'Filter by Category',
        subtitle: 'Filter challenges by eco areas (water, energy, etc.)',
        icon: 'filter-outline',
        iconColor: '#006D40',
        onPress: () => setCategoryDrawerVisible(true),
      },
      {
        title: 'Full Eco Journey & Leaderboard',
        subtitle: 'View your completed ledger and community rankings',
        icon: 'trophy-outline',
        iconColor: '#0284C7',
        onPress: () => {
          setJourneyActiveTab('stats');
          setJourneyModalVisible(true);
        },
      },
      {
        title: 'How Challenges Work',
        subtitle: 'Learn about daily check-ins, XP, and savings',
        icon: 'help-circle-outline',
        iconColor: '#64748B',
        onPress: () => {
          Alert.alert(
            'Eco Challenges',
            'Green habits generate XP, leveling you up and awarding points. Check-in daily for active challenges to save CO2 and Water!'
          );
        },
      },
    ];

    setActionSheetConfig({
      visible: true,
      title: 'Challenge Options',
      subtitle: 'Select an action to perform',
      options,
    });
  };

  // Render components
  const getCategoryFallbackImage = (catName?: string, title?: string) => {
    const combined = ((catName || '') + ' ' + (title || '')).toLowerCase();
    if (combined.includes('water') || combined.includes('bottle')) return 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800';
    if (combined.includes('tech') || combined.includes('cloud') || combined.includes('digital')) return 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800';
    if (combined.includes('bird') || combined.includes('bio') || combined.includes('wildlife') || combined.includes('tree') || combined.includes('plant')) return 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800';
    return 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800';
  };

  // Format community metrics with threshold cap (e.g. 20+ posts, 30+ comments)
  const formatCommunityMetric = (count?: number | null, threshold = 20, singular = 'post', plural = 'posts') => {
    const safeCount = typeof count === 'number' && !isNaN(count) ? count : 0;
    if (safeCount >= threshold) {
      return `${threshold}+ ${plural}`;
    }
    return `${safeCount} ${safeCount === 1 ? singular : plural}`;
  };

  // ── Render Active Challenge Card (Sleek Horizontal Carousel) ──
  const renderActiveChallengeCard = ({ item }: { item: any }) => {
    const challenge = item.challenge || {};
    const isCompleted = item.progress?.progress_percentage >= 100;
    const catDetails = getCategoryDetails(challenge.category);
    const isLoader = actionLoadingId === challenge.id;

    const fallbackBg = getCategoryFallbackImage(catDetails.name, challenge.title);
    const bgImage = resolveMediaUrl(challenge.image || challenge.image_url, fallbackBg);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiredDateObj = item.expired_date ? new Date(item.expired_date) : null;
    const isExpired = item.days_remaining === 0 && !!expiredDateObj && expiredDateObj < today;

    const postsCount = challenge.posts_count ?? item.posts_count ?? 0;
    const commentsCount = challenge.comments_count ?? item.comments_count ?? 0;
    const postsText = formatCommunityMetric(postsCount, 20, 'post', 'posts');
    const commentsText = formatCommunityMetric(commentsCount, 30, 'comment', 'comments');

    const streak = item.current_streak ?? 0;
    const completedDays = item.progress?.completed_days ?? 0;
    const totalDays = item.planned_duration_days ?? 30;
    const progressPercent = Math.min(Math.round(item.progress?.progress_percentage ?? 0), 100);

    return (
      <View style={styles.activeCarouselCard}>
        {/* Top Cover Banner */}
        <View style={styles.activeCardCover}>
          <Image source={{ uri: bgImage }} style={styles.cardCoverImg} resizeMode="cover" />
          <View style={styles.cardCoverOverlay} />

          {/* Top Row: Category + Level & Status */}
          <View style={styles.cardCoverTopRow}>
            <View style={[styles.categoryGlassBadge, { borderColor: catDetails.color + '90' }]}>
              <CategoryIcon icon={catDetails.icon} type={catDetails.iconType} size={12} color={catDetails.color} />
              <Text style={styles.categoryGlassBadgeText}>{catDetails.name}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={styles.levelGlassBadge}>
                <Ionicons name="star" size={10} color="#FBBF24" style={{ marginRight: 2 }} />
                <Text style={styles.levelGlassBadgeText}>Lvl {challenge.level ?? 1}</Text>
              </View>

              {isExpired ? (
                <View style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.statusBadgeText}>Expired</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.statusBadgeText}>{item.days_remaining ?? 30}d left</Text>
                </View>
              )}
            </View>
          </View>

          {/* Floating Community Live Pill */}
          <TouchableOpacity
            style={styles.floatingHubBadge}
            onPress={() => navigation.navigate('ChallengeDetail', { challenge, isActive: true, initialTab: 'community' })}
            activeOpacity={0.85}
          >
            <View style={styles.hubPulseDot} />
            <Ionicons name="chatbubbles" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.floatingHubText}>{postsText} • {commentsText}</Text>
            <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Card Body */}
        <View style={styles.activeCardBody}>
          {/* Title */}
          <Text style={styles.activeCardTitle} numberOfLines={1}>
            {challenge.title}
          </Text>

          {/* Progress Overview Bar */}
          <View style={styles.activeProgressBox}>
            <View style={styles.activeProgressInfoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={styles.activeProgressDayText}>
                  Day {completedDays} of {totalDays}
                </Text>
                {streak > 0 && (
                  <View style={styles.activeStreakPill}>
                    <Text style={styles.activeStreakPillText}>🔥 {streak}d streak</Text>
                  </View>
                )}
              </View>
              <Text style={styles.activePercentText}>{progressPercent}%</Text>
            </View>

            <View style={styles.activeProgressBarTrack}>
              <View style={[styles.activeProgressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Compact Impact Chips */}
          <View style={styles.activeImpactChipsRow}>
            {challenge.co2_reduction_per_day > 0 && (
              <View style={[styles.compactImpactChip, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Ionicons name="leaf" size={10} color="#059669" style={{ marginRight: 3 }} />
                <Text style={[styles.compactImpactText, { color: '#047857' }]}>
                  -{challenge.co2_reduction_per_day} kg/d
                </Text>
              </View>
            )}
            {challenge.water_saving_per_day > 0 && (
              <View style={[styles.compactImpactChip, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                <Ionicons name="water" size={10} color="#0284C7" style={{ marginRight: 3 }} />
                <Text style={[styles.compactImpactText, { color: '#0369A1' }]}>
                  +{challenge.water_saving_per_day} L/d
                </Text>
              </View>
            )}
          </View>

          {/* Active Actions */}
          <View style={styles.activeActionsRowCompact}>
            {isCompleted && !isExpired ? (
              <TouchableOpacity
                style={[styles.activePrimaryActionBtn, { backgroundColor: '#059669' }]}
                onPress={() => handleClaimReward(item)}
                disabled={isLoader}
                activeOpacity={0.85}
              >
                {isLoader ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="trophy" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.activePrimaryActionText}>Claim Reward</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : isExpired ? (
              <View style={[styles.activePrimaryActionBtn, { backgroundColor: '#9CA3AF' }]}>
                <Ionicons name="lock-closed" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.activePrimaryActionText}>Expired</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.activePrimaryActionBtn}
                onPress={() => openProgressModal(item)}
                disabled={isLoader}
                activeOpacity={0.85}
              >
                {isLoader ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkbox-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.activePrimaryActionText}>Log Action</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.activeHubBtn}
              onPress={() => navigation.navigate('ChallengeDetail', { challenge, isActive: true, initialTab: 'community' })}
              activeOpacity={0.8}
            >
              <Ionicons name="people" size={14} color="#006D40" style={{ marginRight: 3 }} />
              <Text style={styles.activeHubBtnText}>Hub</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.activeInfoBtn}
              onPress={() => navigation.navigate('ChallengeDetail', { challenge, isActive: true, initialTab: 'info' })}
              activeOpacity={0.8}
            >
              <Ionicons name="information-circle-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ── Render Discover Challenge Card (Zeal-Inducing Gamified Mission Card) ──
  const renderDiscoverChallengeCard = ({ item }: { item: Challenge }) => {
    const catDetails = getCategoryDetails(item.category);
    const isLoader = actionLoadingId === item.id;
    const fallbackBg = getCategoryFallbackImage(catDetails.name, item.title);
    const bgImage = resolveMediaUrl(item.image || item.image_url, fallbackBg);

    const postsCount = item.posts_count ?? 0;
    const commentsCount = item.comments_count ?? 0;
    const postsText = formatCommunityMetric(postsCount, 20, 'post', 'posts');
    const commentsText = formatCommunityMetric(commentsCount, 30, 'comment', 'comments');

    const xpReward = (item.level ?? 1) * 100 + 50;
    const pointsReward = (item.level ?? 1) * 20 + 30;
    const estimatedMonthlyCo2 = Math.max(1, Math.round((item.co2_reduction_per_day || 0.5) * 30));

    return (
      <View style={styles.missionCardContainer}>
        {/* Hero Media Header */}
        <View style={styles.missionHeroCover}>
          <Image source={{ uri: bgImage }} style={styles.cardCoverImg} resizeMode="cover" />
          <View style={styles.missionCoverGradient} />

          {/* Top Floating Badges: Category + Reward Spotlight */}
          <View style={styles.missionTopBadgeRow}>
            <View style={[styles.categoryGlassBadge, { borderColor: catDetails.color + '90' }]}>
              <CategoryIcon icon={catDetails.icon} type={catDetails.iconType} size={13} color={catDetails.color} />
              <Text style={styles.categoryGlassBadgeText}>{catDetails.name}</Text>
            </View>

            {/* Glowing Reward Badge */}
            <View style={styles.rewardSpotlightBadge}>
              <Ionicons name="trophy" size={12} color="#F59E0B" style={{ marginRight: 3 }} />
              <Text style={styles.rewardSpotlightText}>+{xpReward} XP</Text>
              <Text style={styles.rewardPointsSubText}>• +{pointsReward} Pts</Text>
            </View>
          </View>

          {/* Bottom Floating Community Live Badge */}
          <TouchableOpacity
            style={styles.floatingHubBadge}
            onPress={() => navigation.navigate('ChallengeDetail', { challenge: item, isActive: false, initialTab: 'community' })}
            activeOpacity={0.85}
          >
            <View style={styles.hubPulseDot} />
            <Ionicons name="chatbubbles" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.floatingHubText}>{postsText} • {commentsText}</Text>
            <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.8)" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>

        {/* Card Body */}
        <View style={styles.missionCardBody}>
          {/* Mission Title & Level Pill */}
          <View style={styles.missionTitleRow}>
            <Text style={styles.missionCardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.missionLevelChip}>
              <Ionicons name="star" size={10} color="#FBBF24" style={{ marginRight: 2 }} />
              <Text style={styles.missionLevelChipText}>Lvl {item.level ?? 1}</Text>
            </View>
          </View>

          {/* Mission Description */}
          <Text style={styles.missionCardDesc} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Impact Banner (Estimated Monthly Impact) */}
          <View style={styles.monthlyImpactBanner}>
            <View style={styles.monthlyImpactLeft}>
              <Ionicons name="leaf" size={14} color="#059669" />
              <Text style={styles.monthlyImpactText}>
                Impact: <Text style={{ fontWeight: '800', color: '#047857' }}>~{estimatedMonthlyCo2} kg CO₂/mo</Text>
              </Text>
            </View>
            <View style={styles.participantsBadge}>
              <Ionicons name="people" size={12} color="#006D40" />
              <Text style={styles.participantsBadgeText}>
                {item.participants_count > 0 ? item.participants_count : 28}+ joined
              </Text>
            </View>
          </View>

          {/* Daily Impact Chips */}
          <View style={styles.missionImpactRow}>
            {item.co2_reduction_per_day > 0 && (
              <View style={[styles.compactImpactChip, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Ionicons name="leaf" size={10} color="#059669" style={{ marginRight: 3 }} />
                <Text style={[styles.compactImpactText, { color: '#047857' }]}>
                  -{item.co2_reduction_per_day} kg/day
                </Text>
              </View>
            )}
            {item.water_saving_per_day > 0 && (
              <View style={[styles.compactImpactChip, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                <Ionicons name="water" size={10} color="#0284C7" style={{ marginRight: 3 }} />
                <Text style={[styles.compactImpactText, { color: '#0369A1' }]}>
                  +{item.water_saving_per_day} L/day
                </Text>
              </View>
            )}
            {item.energy_saving_per_day > 0 && (
              <View style={[styles.compactImpactChip, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Ionicons name="flash" size={10} color="#D97706" style={{ marginRight: 3 }} />
                <Text style={[styles.compactImpactText, { color: '#B45309' }]}>
                  +{item.energy_saving_per_day} kWh/day
                </Text>
              </View>
            )}
          </View>

          {/* Community Hub Quick Teaser */}
          <TouchableOpacity
            style={styles.communityTeaserBar}
            onPress={() => navigation.navigate('ChallengeDetail', { challenge: item, isActive: false, initialTab: 'community' })}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="chatbubble-ellipses" size={14} color="#006D40" />
              <Text style={styles.communityTeaserText}>
                Community Hub • <Text style={{ fontWeight: '800' }}>{postsText} • {commentsText}</Text>
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={12} color="#006D40" />
          </TouchableOpacity>

          {/* Action Row */}
          <View style={styles.missionActionRow}>
            <TouchableOpacity
              style={styles.missionDetailsBtn}
              onPress={() => navigation.navigate('ChallengeDetail', { challenge: item, isActive: false, initialTab: 'info' })}
              activeOpacity={0.8}
            >
              <Text style={styles.missionDetailsBtnText}>DETAILS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.missionAcceptBtn}
              onPress={() => handleOpenJoin(item)}
              disabled={isLoader}
              activeOpacity={0.85}
            >
              {isLoader ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="rocket" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={styles.missionAcceptBtnText}>ACCEPT MISSION</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const currentLevelMaxXp = (user?.level ?? 1) * 1000;

  return (
    <View style={styles.container}>
      {/* Dismiss dropdown backdrop */}
      {menuVisible && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        />
      )}
      {/* Top Header Navbar */}
      <Animated.View
        style={[
          styles.appBar,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            paddingTop: insets.top,
            height: 60 + insets.top,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image
            source={{
              uri: resolveMediaUrl(user?.profileImage || user?.avatarUrl) || 'https://lh3.googleusercontent.com/aida-public/AB6AXuD902TkYI0b6_KRKtnLv9ekUyPn_e1-iyS3F9Mt8-jOxUbE_1FI8UooP95XuIbGDhFd1ELMSlDE4LDvXawkcdg80li_VvGAmUAAb22zzMsqO98JD_YzW5TxohR_wEZEphVly-CeasRgVMSsXhkjHccqEHuB9C3XhNA0C8_32DACGAIVUOl4vxTVhCoGxybxC9Zl-Wq93MJxUJRYk6jV_9VbWczwGRwpix7oGK86KoEx2-VlgW9qO4k2',
            }}
            style={{ width: 32, height: 32, borderRadius: 16 }}
          />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#006D40' }}>Ekenox</Text>
        </View>

        <View style={styles.appBarActions}>
          <TouchableOpacity style={styles.iconBadgeBtn} onPress={() => setCategoryDrawerVisible(true)}>
            <Ionicons name="options-outline" size={20} color="#3D4A40" />
            {selectedCategories.length > 0 && <View style={styles.filterDotBadge} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBadgeBtn}
            onPress={() => {
              if (showSearch) {
                setShowSearch(false);
                setSearchQuery('');
              } else {
                setShowSearch(true);
                setTimeout(() => searchInputRef.current?.focus(), 120);
              }
            }}
          >
            <Ionicons name={showSearch ? 'close' : 'search'} size={20} color="#3D4A40" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBadgeBtn} onPress={handleOpenTopMenu}>
            <Ionicons name="ellipsis-vertical" size={20} color="#3D4A40" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {isLoading ? (
        <View style={[styles.loaderContainer, { paddingTop: 60 + insets.top }]}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loaderText}>Loading Eco Challenges...</Text>
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 60 + insets.top }]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            const scrollOffset = event.nativeEvent.contentOffset.y;
            scrollY.setValue(scrollOffset);
            const contentHeight = event.nativeEvent.contentSize.height;
            const layoutHeight = event.nativeEvent.layoutMeasurement.height;
            if (contentHeight - layoutHeight - scrollOffset < 300) {
              loadMoreChallenges();
            }
          }}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[AppColors.primary]}
              progressViewOffset={60 + insets.top}
            />
          }
        >
          {/* Toggleable Search Bar */}
          {showSearch && (
            <View style={styles.searchSection}>
              <View style={styles.challengeSearchBar}>
                <Ionicons name="search" size={16} color={AppColors.textMedium} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.challengeSearchInput}
                  placeholder="Search challenges..."
                  placeholderTextColor={AppColors.textMedium}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={AppColors.textMedium} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Gamification Stats Dashboard */}
          <View style={styles.heroDashboardCard}>
            <View style={styles.heroGlowBackdrop} />

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.heroUserName}>{user?.fullName || 'Felix ZEALD'}</Text>
              <View style={styles.heroEcoLevelRow}>
                <Text style={styles.heroEcoLevelLabel}>ECO LEVEL</Text>
                <View style={styles.heroLevelCircleBadge}>
                  <Text style={styles.heroLevelCircleBadgeText}>{user?.level ?? 1}</Text>
                </View>
              </View>
            </View>

            {/* EXP Bar */}
            <View style={styles.heroXpSection}>
              <View style={styles.heroXpHeader}>
                <Text style={styles.heroXpLabel}>Level Progress</Text>
                <Text style={styles.heroXpVal}>
                  {user?.xp ?? 0} / {currentLevelMaxXp} XP
                </Text>
              </View>
              <View style={styles.heroXpBarBg}>
                <View
                  style={[
                    styles.heroXpBarFill,
                    { width: `${Math.min(((user?.xp ?? 0) / currentLevelMaxXp) * 100, 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Stats Bento Grid (3 Columns) */}
            <View style={styles.heroBentoGridRow}>
              <View style={styles.heroBentoBox}>
                <Ionicons name="star" size={24} color="#006D40" />
                <Text style={styles.heroBentoVal}>{user?.points ?? stats?.challenge_stats?.total_completed_challenges ?? 0}</Text>
                <Text style={styles.heroBentoLabel}>ECO POINTS</Text>
              </View>
              <View style={styles.heroBentoBox}>
                <Ionicons name="leaf" size={24} color="#006D40" />
                <Text style={styles.heroBentoVal}>
                  {parseFloat(stats?.environmental_impact?.total_co2_saved ?? 12.1).toFixed(1)}
                </Text>
                <Text style={styles.heroBentoLabel}>KG CO2</Text>
              </View>
              <View style={styles.heroBentoBox}>
                <Ionicons name="water" size={24} color="#2196F3" />
                <Text style={styles.heroBentoVal}>
                  {parseInt(stats?.environmental_impact?.total_water_saved ?? 15)}
                </Text>
                <Text style={styles.heroBentoLabel}>L WATER</Text>
              </View>
            </View>
          </View>

          {/* Section: Active Challenges */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            <Text style={styles.countIndicator}>{activeChallenges.length}/4</Text>
          </View>

          {(() => {
            const filteredActive = activeChallenges.filter(ac => {
              const matchesSearch = !searchQuery.trim() || (
                ac.challenge.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ac.challenge.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ac.challenge.category?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ac.challenge.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
              );
              const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(ac.challenge.category?.id);
              return matchesSearch && matchesCategory;
            });

            return filteredActive.length === 0 ? (
              <View style={styles.emptyChallengesCard}>
                <Ionicons name="trophy-outline" size={32} color={AppColors.textLight} />
                <Text style={styles.emptyChallengesTitle}>
                  {searchQuery.trim() || selectedCategories.length > 0 ? 'No matching active challenges' : 'No active challenges'}
                </Text>
                <Text style={styles.emptyChallengesText}>
                  {searchQuery.trim() || selectedCategories.length > 0 ? 'Try clearing your search or category filters.' : 'Accept challenges below to start making a daily difference and earning points!'}
                </Text>
              </View>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={filteredActive}
                renderItem={renderActiveChallengeCard}
                keyExtractor={item => String(item.challenge.id)}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 12, paddingBottom: 8 }}
                snapToInterval={width * 0.82 + 12}
                decelerationRate="fast"
              />
            );
          })()}

          {/* Section: Discover New Challenges */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Discover Challenges</Text>
          </View>

          {(() => {
            const filteredDiscover = discoverChallenges.filter(c => {
              const matchesSearch = !searchQuery.trim() || (
                c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.category?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
              );
              const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(c.category?.id);
              return matchesSearch && matchesCategory;
            });

            return (
              <View>
                {filteredDiscover.length === 0 ? (
                  <View style={styles.emptyChallengesCard}>
                    <Ionicons name="sparkles-outline" size={32} color={AppColors.textLight} />
                    <Text style={styles.emptyChallengesTitle}>
                      {searchQuery.trim() || selectedCategories.length > 0 ? 'No matching challenges' : 'All Caught Up!'}
                    </Text>
                    <Text style={styles.emptyChallengesText}>
                      {searchQuery.trim() || selectedCategories.length > 0 ? 'Try clearing your search or category filters.' : 'You are currently participating in all available challenge programs. Keep it up!'}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredDiscover}
                    renderItem={renderDiscoverChallengeCard}
                    keyExtractor={item => String(item.id)}
                    scrollEnabled={false}
                    contentContainerStyle={styles.listContent}
                  />
                )}
                {isLoadingMoreDiscover && (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={AppColors.primary} />
                  </View>
                )}
              </View>
            );
          })()}
        </Animated.ScrollView>
      )}

      {/* ── Left Category Drawer Menu ── */}
      <Modal visible={categoryDrawerVisible} animationType="slide" transparent onRequestClose={() => setCategoryDrawerVisible(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCategoryDrawerVisible(false)} />
          <SafeAreaView style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Categories Filter</Text>
              <TouchableOpacity onPress={() => setCategoryDrawerVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
              {categories.map(cat => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryItemRow}
                    onPress={() => toggleCategorySelection(cat.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isSelected ? AppColors.primary : AppColors.textMedium}
                    />
                    <Text style={[styles.categoryItemText, isSelected && styles.categoryItemTextActive]}>
                      {cat.display_name || cat.displayName || cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.drawerFooter}>
              <TouchableOpacity style={styles.drawerResetBtn} onPress={clearCategoryFilters}>
                <Text style={styles.drawerResetText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerApplyBtn} onPress={() => setCategoryDrawerVisible(false)}>
                <Text style={styles.drawerApplyText}>Apply Filters ({selectedCategories.length})</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 1: SELECT PLANNED DURATION
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={durationModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDurationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDurationSheet}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 8 }} />
            <View style={styles.modalDurationHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalDurationTitle}>Commit to Challenge</Text>
                <Text style={styles.modalDurationSubtitleSmall}>
                  Define the length of your commitment
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDurationModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.durationScrollBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalDurationSubtitle}>
                Commit to a target duration for "{selectedChallengeToJoin?.title}". Choose a preset or enter a custom amount of days:
              </Text>

              <Text style={styles.inputSectionLabel}>Select Preset Duration</Text>
              <View style={styles.durationOptionsRow}>
                {[7, 14, 21, 30].map(days => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.durationChip,
                      selectedDuration === days && styles.durationChipActive,
                    ]}
                    onPress={() => {
                      setSelectedDuration(days);
                      setCustomDays(String(days));
                    }}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        selectedDuration === days && styles.durationChipTextActive,
                      ]}
                    >
                      {days} Days
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputSectionLabel}>Or Enter Custom Days (1–365)</Text>
              <View style={styles.customInputContainer}>
                <TextInput
                  style={styles.customDaysInput}
                  value={customDays}
                  onChangeText={text => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setCustomDays(cleaned);
                    const parsed = parseInt(cleaned, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      setSelectedDuration(parsed);
                    } else {
                      setSelectedDuration(0);
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="e.g. 45"
                  maxLength={3}
                />
                <Text style={styles.customInputSuffix}>Days</Text>
              </View>

              <Text style={styles.inputSectionLabel}>Kick-off Date</Text>
              <View style={styles.customInputContainer}>
                <Ionicons name="calendar-outline" size={18} color={AppColors.textMedium} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.customDaysInput, { fontSize: 14 }]}
                  value={kickOffDate}
                  onChangeText={text => {
                    // allow typing YYYY-MM-DD
                    setKickOffDate(text);
                  }}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 4, marginBottom: 8 }}>
                Defaults to today. The challenge expires {selectedDuration} days after kick-off.
              </Text>

              <TouchableOpacity
                style={[styles.actionBtn, styles.modalConfirmBtn, { marginTop: 16, height: 44, gap: 6 }]}
                onPress={() => {
                  const parsed = parseInt(customDays, 10);
                  if (isNaN(parsed) || parsed <= 0 || parsed > 365) {
                    Alert.alert('Invalid Duration', 'Please enter a valid duration between 1 and 365 days.');
                    return;
                  }
                  // Validate date format
                  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                  if (!dateRegex.test(kickOffDate)) {
                    Alert.alert('Invalid Date', 'Please enter the kick-off date in YYYY-MM-DD format.');
                    return;
                  }
                  handleJoin();
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { fontSize: 14 }]}>Start Challenge</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 3: EXPIRED CHALLENGES
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={expiredModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setExpiredModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDurationSheet, { height: '75%' }]}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 8 }} />
            <View style={styles.modalDurationHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalDurationTitle}>Expired Challenges</Text>
                <Text style={styles.modalDurationSubtitleSmall}>Challenges that have passed their end date</Text>
              </View>
              <TouchableOpacity onPress={() => setExpiredModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {expiredLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={AppColors.primary} />
                <Text style={styles.loaderText}>Loading expired challenges...</Text>
              </View>
            ) : expiredChallenges.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                <Ionicons name="checkmark-circle-outline" size={52} color={AppColors.primary} />
                <Text style={[styles.modalDurationTitle, { textAlign: 'center' }]}>No Expired Challenges</Text>
                <Text style={[styles.modalDurationSubtitle, { textAlign: 'center', paddingHorizontal: 32 }]}>
                  All your current challenges are still active!
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                {expiredChallenges.map((item: any, idx: number) => {
                  const catDetails = getCategoryDetails(item.challenge?.category ?? item.category);
                  return (
                    <View key={idx} style={styles.expiredCard}>
                      <View style={styles.expiredCardHeader}>
                        <View style={[styles.catIconCircle, { backgroundColor: catDetails.color + '20', width: 38, height: 38 }]}>
                          <CategoryIcon icon={catDetails.icon} type={catDetails.iconType} size={18} color={catDetails.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expiredCardTitle}>{item.challenge?.title ?? item.title}</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <View style={styles.historyExpiredBadge}>
                              <Ionicons name="calendar-outline" size={11} color="#6B7280" />
                              <Text style={styles.historyExpiredBadgeText}>
                                {item.kick_off_date ? new Date(item.kick_off_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : 'N/A'}
                                {' → '}
                                {item.expired_date ? new Date(item.expired_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : 'N/A'}
                              </Text>
                            </View>
                            <View style={[styles.historyExpiredBadge, { backgroundColor: '#FEF3C7' }]}>
                              <Ionicons name="time-outline" size={11} color="#D97706" />
                              <Text style={[styles.historyExpiredBadgeText, { color: '#92400E' }]}>{item.planned_duration_days}d plan</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                          <Text style={[styles.progressLabel, { fontSize: 12 }]}>Completion</Text>
                          <Text style={[styles.progressVal, { fontSize: 12 }]}>
                            {item.progress?.completed_days ?? 0} / {item.planned_duration_days} days
                          </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.min((item.progress?.progress_percentage ?? 0), 100)}%`,
                                backgroundColor: catDetails.color,
                              },
                            ]}
                          />
                        </View>
                      </View>

                      <View style={[styles.impactBadgeRow, { marginTop: 8 }]}>
                        <View style={styles.impactBadge}>
                          <Ionicons name="leaf-outline" size={12} color="#4CAF50" />
                          <Text style={styles.impactBadgeText}>
                            {item.environmental_impact?.total_co2_saved ?? 0} kg CO2
                          </Text>
                        </View>
                        <View style={styles.impactBadge}>
                          <Ionicons name="water-outline" size={12} color="#2196F3" />
                          <Text style={styles.impactBadgeText}>
                            {item.environmental_impact?.total_water_saved ?? 0} L Water
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 2: REAL CALENDAR DAILY PROGRESS TRACKER (Aligned with eco_conscience)
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={progressModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProgressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalProgressSheet}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 8 }} />
            {/* Modal Header */}
            <View style={styles.modalProgressHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalProgressTitle}>
                  {selectedActiveChallenge?.challenge.title}
                </Text>
                <Text style={styles.modalProgressSubtitle}>
                  Track Your Daily Progress
                </Text>
              </View>
              <TouchableOpacity onPress={() => setProgressModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.progressScrollBody} showsVerticalScrollIndicator={false}>
              {/* Progress Summary Cards */}
              <View style={styles.calStatsRow}>
                <View style={styles.calStatBox}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={[styles.calStatVal, { color: '#10B981' }]}>
                    {selectedActiveChallenge?.progress?.completed_days || 0}
                  </Text>
                  <Text style={styles.calStatUnit}>days</Text>
                  <Text style={styles.calStatLabel}>Completed</Text>
                </View>

                <View style={styles.calStatBox}>
                  <Ionicons name="time-outline" size={20} color="#3B82F6" />
                  <Text style={[styles.calStatVal, { color: '#3B82F6' }]}>
                    {selectedActiveChallenge?.days_remaining ?? 0}
                  </Text>
                  <Text style={styles.calStatUnit}>days</Text>
                  <Text style={styles.calStatLabel}>Remaining</Text>
                </View>

                <View style={styles.calStatBox}>
                  <Ionicons name="flame" size={20} color="#F59E0B" />
                  <Text style={[styles.calStatVal, { color: '#F59E0B' }]}>
                    {selectedActiveChallenge?.current_streak ?? 0}
                  </Text>
                  <Text style={styles.calStatUnit}>days</Text>
                  <Text style={styles.calStatLabel}>Streak</Text>
                </View>
              </View>

              {/* Loader */}
              {modalProgressLoading && (
                <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={AppColors.primary} />
                </View>
              )}

              {/* ── CALENDAR COMPONENT ── */}
              {selectedActiveChallenge && (() => {
                const startDate = parseLocalDate(selectedActiveChallenge.kick_off_date || selectedActiveChallenge.start_date) || new Date();
                const endDate = parseLocalDate(selectedActiveChallenge.expired_date) || new Date(startDate.getTime() + (selectedActiveChallenge.planned_duration_days || 7) * 86400000);
                const completedDates = selectedActiveChallenge.progress?.completed_dates || [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Month header calculations
                const year = calendarViewMonth.getFullYear();
                const month = calendarViewMonth.getMonth();
                const monthName = calendarViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                const monthCells = getCalendarMonthGrid(year, month);
                const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                // Check day helpers
                const isCompletedDay = (d: Date) => {
                  return completedDates.some((cd: any) => {
                    const parsed = parseLocalDate(cd);
                    if (!parsed) return false;
                    return isSameDay(parsed, d);
                  });
                };

                const isDayInRange = (d: Date) => {
                  const check = new Date(d);
                  check.setHours(0, 0, 0, 0);
                  const start = new Date(startDate);
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(endDate);
                  end.setHours(23, 59, 59, 999);
                  return check >= start && check <= end && check <= today;
                };

                const isFutureDay = (d: Date) => {
                  const check = new Date(d);
                  check.setHours(0, 0, 0, 0);
                  return check > today;
                };

                const selectedDayFormatted = selectedCalendarDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                const isSelectedCompleted = isCompletedDay(selectedCalendarDate);
                const isSelectedInRange = isDayInRange(selectedCalendarDate);
                const isSelectedFuture = isFutureDay(selectedCalendarDate);

                return (
                  <View style={styles.calendarContainer}>
                    {/* Calendar Month Navigation Header */}
                    <View style={styles.calendarHeader}>
                      <TouchableOpacity
                        onPress={() => setCalendarViewMonth(new Date(year, month - 1, 1))}
                        style={styles.calNavBtn}
                      >
                        <Ionicons name="chevron-back" size={20} color={AppColors.textDark} />
                      </TouchableOpacity>

                      <Text style={styles.calendarMonthTitle}>{monthName}</Text>

                      <TouchableOpacity
                        onPress={() => setCalendarViewMonth(new Date(year, month + 1, 1))}
                        style={styles.calNavBtn}
                      >
                        <Ionicons name="chevron-forward" size={20} color={AppColors.textDark} />
                      </TouchableOpacity>
                    </View>

                    {/* Weekday Row */}
                    <View style={styles.weekdayRow}>
                      {weekdays.map((w, idx) => (
                        <Text key={idx} style={styles.weekdayText}>{w}</Text>
                      ))}
                    </View>

                    {/* Days Grid */}
                    <View style={styles.daysGrid}>
                      {monthCells.map((cell, idx) => {
                        const cellDate = cell.date;
                        cellDate.setHours(0, 0, 0, 0);

                        const isComp = isCompletedDay(cellDate);
                        const isToday = isSameDay(cellDate, today);
                        const isSel = isSameDay(cellDate, selectedCalendarDate);
                        const inRange = isDayInRange(cellDate);

                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[
                              styles.calendarCell,
                              !cell.isCurrentMonth && styles.cellOtherMonth,
                              isComp && styles.cellCompleted,
                              isSel && !isComp && styles.cellSelected,
                              isToday && !isComp && !isSel && styles.cellToday,
                              (!inRange && !isComp) && styles.cellOutsideRange,
                            ]}
                            activeOpacity={0.7}
                            onPress={() => setSelectedCalendarDate(cellDate)}
                          >
                            <Text
                              style={[
                                styles.cellDayText,
                                !cell.isCurrentMonth && styles.cellDayTextOtherMonth,
                                isComp && styles.cellDayTextCompleted,
                                isSel && !isComp && styles.cellDayTextSelected,
                                isToday && !isComp && styles.cellDayTextToday,
                                (!inRange && !isComp) && styles.cellDayTextOutside,
                              ]}
                            >
                              {cellDate.getDate()}
                            </Text>

                            {/* Completed Badge Indicator */}
                            {isComp && (
                              <View style={styles.completedDotBadge}>
                                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                              </View>
                            )}

                            {/* Today Indicator */}
                            {isToday && !isComp && (
                              <View style={styles.todayIndicatorDot} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Legend */}
                    <View style={styles.legendContainer}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#10B981' }]}>
                          <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                        </View>
                        <Text style={styles.legendText}>Completed</Text>
                      </View>

                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: AppColors.primary }]} />
                        <Text style={styles.legendText}>Today / Selected</Text>
                      </View>

                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#E5E7EB' }]} />
                        <Text style={styles.legendText}>Outside Range</Text>
                      </View>
                    </View>

                    {/* Selected Day Action Box */}
                    <View style={styles.actionBox}>
                      <View style={styles.actionBoxHeader}>
                        <Ionicons name="calendar-outline" size={18} color={AppColors.primary} />
                        <Text style={styles.actionBoxTitle}>{selectedDayFormatted}</Text>
                        {isSelectedCompleted && (
                          <View style={styles.actionCompletedTag}>
                            <Text style={styles.actionCompletedTagText}>COMPLETED ✓</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.markActionButton,
                          isSelectedCompleted && styles.markActionButtonDone,
                          (!isSelectedInRange && !isSelectedCompleted) && styles.markActionButtonDisabled,
                        ]}
                        disabled={!isSelectedInRange && !isSelectedCompleted}
                        activeOpacity={0.8}
                        onPress={() => {
                          const dateStr = getLocalDateString(selectedCalendarDate);
                          handleMarkProgress(selectedActiveChallenge.challenge.id, dateStr, !isSelectedCompleted);
                        }}
                      >
                        <Ionicons
                          name={isSelectedCompleted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.markActionButtonText}>
                          {isSelectedCompleted
                            ? 'Marked as Complete (Tap to Toggle)'
                            : isSelectedInRange
                              ? `Mark ${selectedDayFormatted} as Complete`
                              : isSelectedFuture
                                ? 'Future Date (Locked)'
                                : 'Outside Challenge Duration'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 4: FULL ECO JOURNEY DETAILS & CALCULATIONS
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={journeyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setJourneyModalVisible(false)}
      >
        <View style={styles.modalOverlayNew}>
          <View style={[styles.modalSheetNew, { height: '85%' }]}>
            {/* Drag handle */}
            <View style={styles.dragHandleNew} />

            <View style={styles.modalHeaderRowNew}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitleNew}>Eco Hub & Leaderboard</Text>
                <Text style={styles.modalSubtitleNew}>
                  Track stats, calculations, and global user rankings
                </Text>
              </View>
              <TouchableOpacity onPress={() => setJourneyModalVisible(false)} style={styles.closeBtnCircleNew}>
                <Ionicons name="close" size={20} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {/* Custom Tab Selector */}
            <View style={styles.modalTabSelectorNew}>
              <TouchableOpacity
                style={[styles.modalTabBtnNew, journeyActiveTab === 'stats' && styles.modalTabBtnActiveNew]}
                onPress={() => setJourneyActiveTab('stats')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="stats-chart"
                  size={14}
                  color={journeyActiveTab === 'stats' ? AppColors.primary : AppColors.textMedium}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.modalTabTextNew, journeyActiveTab === 'stats' && styles.modalTabTextActiveNew]}>
                  My Stats & Ledger
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabBtnNew, journeyActiveTab === 'leaderboard' && styles.modalTabBtnActiveNew]}
                onPress={() => handleTabToggle('leaderboard')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="trophy"
                  size={14}
                  color={journeyActiveTab === 'leaderboard' ? AppColors.primary : AppColors.textMedium}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.modalTabTextNew, journeyActiveTab === 'leaderboard' && styles.modalTabTextActiveNew]}>
                  Leaderboard
                </Text>
              </TouchableOpacity>
            </View>

            {journeyActiveTab === 'leaderboard' ? (
              <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
                {isLeaderboardLoading ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={AppColors.primary} />
                    <Text style={{ marginTop: 12, color: AppColors.textMedium, fontSize: 13 }}>
                      Loading community rankings...
                    </Text>
                  </View>
                ) : leaderboardData.length === 0 ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                    <Ionicons name="trophy-outline" size={48} color={AppColors.textLight} />
                    <Text style={{ color: AppColors.textMedium, marginTop: 12, fontSize: 14 }}>
                      No ranks recorded yet. Be the first!
                    </Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                    {leaderboardData.map((item: any) => {
                      const isMe = String(user?.id) === String(item.user?.id);
                      const isTop3 = item.rank <= 3;
                      const rankColors = ['#FBBF24', '#9CA3AF', '#D97706']; // Gold, Silver, Bronze
                      const badgeColor = isTop3 ? rankColors[item.rank - 1] : '#F3F4F6';

                      return (
                        <View
                          key={item.rank}
                          style={[
                            styles.leaderboardRowNew,
                            isMe && styles.leaderboardRowMeNew
                          ]}
                        >
                          {/* Rank & User details clickable */}
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                            onPress={() => {
                              navigation.navigate('Profile', { userId: item.user?.id });
                            }}
                            activeOpacity={0.7}
                          >
                            {/* Rank Indicator */}
                            <View style={[styles.rankBadgeNew, { backgroundColor: badgeColor }]}>
                              {isTop3 ? (
                                <Ionicons name="trophy" size={12} color="white" />
                              ) : (
                                <Text style={[styles.rankTextNew, isMe && { fontWeight: 'bold' }]}>{item.rank}</Text>
                              )}
                            </View>

                            {/* User details */}
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={[styles.leaderboardNameNew, isMe && { fontWeight: '800', color: AppColors.primary }]}>
                                {item.user?.name || 'Anonymous'} {isMe && '(You)'}
                              </Text>
                              <Text style={styles.leaderboardStatsNew}>
                                {item.stats?.completed_challenges || 0} completed • {item.stats?.total_challenges || 0} active
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {/* Impact scores */}
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.leaderboardImpactValNew}>
                              {parseFloat(item.stats?.total_co2_saved ?? 0).toFixed(1)} kg CO2
                            </Text>
                            <Text style={styles.leaderboardImpactSubNew}>
                              {Math.round(item.stats?.total_water_saved ?? 0)} L Water
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
                {/* Summary Stats Overview Grid */}
                <View style={styles.journeySummaryGrid}>
                  <View style={styles.journeySummaryCard}>
                    <Ionicons name="trophy-outline" size={22} color={AppColors.accent} />
                    <Text style={styles.journeySummaryVal}>Level {user?.level ?? 1}</Text>
                    <Text style={styles.journeySummarySub}>{user?.xp ?? 0} / {currentLevelMaxXp} XP</Text>
                  </View>
                  <View style={styles.journeySummaryCard}>
                    <Ionicons name="ribbon-outline" size={22} color="#D97706" />
                    <Text style={styles.journeySummaryVal}>{user?.points ?? 0} Pts</Text>
                    <Text style={styles.journeySummarySub}>Eco Pot Balance</Text>
                  </View>
                  <View style={styles.journeySummaryCard}>
                    <Ionicons name="leaf-outline" size={22} color="#15803D" />
                    <Text style={styles.journeySummaryVal}>{parseFloat(stats?.environmental_impact?.total_co2_saved ?? 0).toFixed(1)} kg</Text>
                    <Text style={styles.journeySummarySub}>CO2 Reduction</Text>
                  </View>
                  <View style={styles.journeySummaryCard}>
                    <Ionicons name="water-outline" size={22} color="#0284C7" />
                    <Text style={styles.journeySummaryVal}>{parseInt(stats?.environmental_impact?.total_water_saved ?? 0)} L</Text>
                    <Text style={styles.journeySummarySub}>Water Saved</Text>
                  </View>
                </View>

                {/* Calculation Rules Explainer Card */}
                <View style={styles.calcRulesCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="calculator-outline" size={18} color={AppColors.primary} />
                    <Text style={styles.calcRulesTitle}>How Points & Impact are Calculated</Text>
                  </View>

                  <View style={styles.ruleItem}>
                    <Text style={styles.ruleBullet}>⚡ Daily Habit Check-in:</Text>
                    <Text style={styles.ruleText}>
                      Earn <Text style={{ fontWeight: '700', color: AppColors.primary }}>Level × 5 EcoPoints</Text> and <Text style={{ fontWeight: '700', color: '#0284C7' }}>Level × 10 XP</Text> for each checked day.
                    </Text>
                  </View>

                  <View style={styles.ruleItem}>
                    <Text style={styles.ruleBullet}>🏆 Challenge Completion Bonus:</Text>
                    <Text style={styles.ruleText}>
                      Upon 100% completion of a challenge, receive a bonus of <Text style={{ fontWeight: '700', color: AppColors.primary }}>Level × 50 EcoPoints</Text> and <Text style={{ fontWeight: '700', color: '#0284C7' }}>Level × 100 XP</Text>.
                    </Text>
                  </View>

                  <View style={styles.ruleItem}>
                    <Text style={styles.ruleBullet}>🍯 Eco Pot System:</Text>
                    <Text style={styles.ruleText}>
                      Your accumulated EcoPoints form your Eco Pot, redeemable for discounts & rewards in the Eco Marketplace.
                    </Text>
                  </View>

                  <View style={styles.ruleItem}>
                    <Text style={styles.ruleBullet}>🌍 CO2 & Water Savings:</Text>
                    <Text style={styles.ruleText}>
                      Savings are accrued daily for each completed habit day based on challenge rating (e.g. 2.0 kg CO2 / day).
                    </Text>
                  </View>
                </View>

                {/* Per-Challenge Contribution Breakdown */}
                <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: 4 }]}>Challenge Contribution Ledger</Text>

                {activeChallenges.length === 0 && expiredChallenges.length === 0 ? (
                  <Text style={{ fontSize: 13, color: AppColors.textMedium, textAlign: 'center', marginVertical: 12 }}>
                    Join and check-in on eco challenges to start populating your points breakdown!
                  </Text>
                ) : (
                  [...activeChallenges, ...expiredChallenges].map((item: any, idx: number) => {
                    const level = item.challenge?.level ?? 1;
                    const completedDays = item.progress?.completed_days ?? 0;
                    const plannedDays = item.planned_duration_days ?? 7;
                    const isDone = item.status === 'completed';
                    const catDetails = getCategoryDetails(item.challenge?.category);

                    const ptsFromDays = completedDays * (level * 5);
                    const xpFromDays = completedDays * (level * 10);
                    const completionBonusPts = isDone ? level * 50 : 0;
                    const completionBonusXp = isDone ? level * 100 : 0;

                    const totalPtsEarned = ptsFromDays + completionBonusPts;
                    const totalXpEarned = xpFromDays + completionBonusXp;

                    const co2Saved = item.environmental_impact?.total_co2_saved ?? (completedDays * (item.challenge?.co2_reduction_per_day ?? 0));
                    const waterSaved = item.environmental_impact?.total_water_saved ?? (completedDays * (item.challenge?.water_saving_per_day ?? 0));

                    return (
                      <View key={idx} style={styles.ledgerItemCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={[styles.catIconCircle, { backgroundColor: catDetails.color + '20', width: 32, height: 32 }]}>
                              <CategoryIcon icon={catDetails.icon} type={catDetails.iconType} size={16} color={catDetails.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.ledgerItemTitle} numberOfLines={1}>{item.challenge?.title}</Text>
                              <Text style={styles.ledgerItemSub}>
                                Level {level} • {completedDays}/{plannedDays} days ({item.status})
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.statusBadgeSmall, isDone ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#F3F4F6' }]}>
                            <Text style={[styles.statusBadgeTextSmall, isDone ? { color: '#166534' } : { color: '#4B5563' }]}>
                              {isDone ? 'Completed' : item.status}
                            </Text>
                          </View>
                        </View>

                        {/* Breakdown Numbers Row */}
                        <View style={styles.ledgerMetricsGrid}>
                          <View style={styles.ledgerMetricBox}>
                            <Text style={styles.ledgerMetricVal}>+{totalPtsEarned} Pts</Text>
                            <Text style={styles.ledgerMetricLabel}>
                              ({ptsFromDays}{isDone ? ` + ${completionBonusPts} bonus` : ''})
                            </Text>
                          </View>
                          <View style={styles.ledgerMetricBox}>
                            <Text style={[styles.ledgerMetricVal, { color: '#0284C7' }]}>+{totalXpEarned} XP</Text>
                            <Text style={styles.ledgerMetricLabel}>
                              ({xpFromDays}{isDone ? ` + ${completionBonusXp} bonus` : ''})
                            </Text>
                          </View>
                          <View style={styles.ledgerMetricBox}>
                            <Text style={[styles.ledgerMetricVal, { color: '#15803D' }]}>{parseFloat(co2Saved).toFixed(1)} kg</Text>
                            <Text style={styles.ledgerMetricLabel}>CO2 Saved</Text>
                          </View>
                          <View style={styles.ledgerMetricBox}>
                            <Text style={[styles.ledgerMetricVal, { color: '#0284C7' }]}>{Math.round(waterSaved)} L</Text>
                            <Text style={styles.ledgerMetricLabel}>Water Saved</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Action Sheet Modal */}
      <CustomActionSheetModal
        visible={actionSheetConfig.visible}
        title={actionSheetConfig.title}
        subtitle={actionSheetConfig.subtitle}
        options={actionSheetConfig.options}
        onClose={() => setActionSheetConfig(prev => ({ ...prev, visible: false }))}
        cancelButtonText="Back"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerSpacer: {
    width: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.primary,
  },
  headerInfoIcon: {
    padding: 4,
  },
  challengeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 8,
    height: 38,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  challengeSearchInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textDark,
    height: 38,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  dashboardCard: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.5)',
  },
  dashboardBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  // ── Active Challenge Carousel Styles (Compact, Swipeable) ──
  activeCarouselCard: {
    width: width * 0.82,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 6,
  },
  activeCardCover: {
    width: '100%',
    height: 110,
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  cardCoverImg: {
    width: '100%',
    height: '100%',
  },
  cardCoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  cardCoverTopRow: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  categoryGlassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  categoryGlassBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  levelGlassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  levelGlassBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  floatingHubBadge: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  hubPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  floatingHubText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  activeCardBody: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  activeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  activeProgressBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeProgressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  activeProgressDayText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  activeStreakPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  activeStreakPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  activePercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#006D40',
  },
  activeProgressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  activeProgressBarFill: {
    height: '100%',
    backgroundColor: '#00A862',
    borderRadius: 3,
  },
  activeImpactChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  compactImpactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  compactImpactText: {
    fontSize: 10,
    fontWeight: '700',
  },
  activeActionsRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activePrimaryActionBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#006D40',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePrimaryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  activeHubBtn: {
    height: 38,
    paddingHorizontal: 10,
    backgroundColor: '#E6F4EA',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C2E7D0',
  },
  activeHubBtnText: {
    color: '#006D40',
    fontSize: 11,
    fontWeight: '800',
  },
  activeInfoBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // ── Discover Gamified Mission Cards Styles ──
  missionCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  missionHeroCover: {
    width: '100%',
    height: 130,
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  missionCoverGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  missionTopBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  rewardSpotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rewardSpotlightText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  rewardPointsSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    marginLeft: 3,
  },
  missionCardBody: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  missionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  missionCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginRight: 8,
  },
  missionLevelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  missionLevelChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  missionCardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  monthlyImpactBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 10,
  },
  monthlyImpactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  monthlyImpactText: {
    fontSize: 11,
    color: '#166534',
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participantsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006D40',
  },
  missionImpactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  communityTeaserBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  communityTeaserText: {
    fontSize: 11,
    color: '#475569',
  },
  missionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missionDetailsBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  missionDetailsBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  missionAcceptBtn: {
    flex: 1.6,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#006D40',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#006D40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  missionAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dashboardOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  dashboardBody: {
    padding: 20,
  },
  dashboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsPanel: {
    flex: 1,
  },
  dashboardName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#14532D',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  levelLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  levelBadge: {
    backgroundColor: AppColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  levelVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#333333',
  },
  streakCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    width: 76,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  streakVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#14532D',
    marginTop: 4,
  },
  streakLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  xpSection: {
    marginTop: 20,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  xpLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  xpVal: {
    fontSize: 12,
    color: '#14532D',
    fontWeight: '700',
  },
  xpBarBg: {
    height: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: AppColors.primaryLight,
    borderRadius: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scoreBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scoreValText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#14532D',
  },
  scoreLabelText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '600',
  },
  scoreDivider: {
    width: 1,
    backgroundColor: '#BBF7D0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  countIndicator: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primary,
    backgroundColor: AppColors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  rewardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rewardBadgeXp: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rewardBadgeXpText: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '700',
  },
  rewardBadgePts: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rewardBadgePtsText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '700',
  },
  rewardBadgeCategory: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rewardBadgeCategoryText: {
    fontSize: 10,
    fontWeight: '700',
  },
  daysRemainingText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMedium,
    marginLeft: 'auto',
  },
  participantsText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textMedium,
    marginLeft: 'auto',
  },
  desc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 8,
  },
  impactBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  impactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  impactBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  progressSection: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  progressVal: {
    fontSize: 11,
    color: AppColors.textDark,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#EAEAEA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 8,
    gap: 6,
  },
  joinBtn: {
    backgroundColor: AppColors.primary,
  },
  actionBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
  },
  quitBtn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  quitBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  logBtn: {
    borderColor: AppColors.primary,
    backgroundColor: '#FFFFFF',
  },
  logBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.primary,
  },
  logBtnDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  logBtnDisabledText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textLight,
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 'auto',
  },
  expiredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  cardExpired: {
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    opacity: 0.9,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateChipLabel: {
    fontSize: 10,
    color: AppColors.textLight,
    fontWeight: '500',
  },
  dateChipValue: {
    fontSize: 10,
    color: AppColors.textDark,
    fontWeight: '700',
  },
  claimBtnActive: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.accent,
  },
  claimBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyChallengesCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  emptyChallengesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyChallengesText: {
    fontSize: 12,
    color: AppColors.textLight,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Modals styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  durationOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  durationChipActive: {
    backgroundColor: AppColors.primary + '15',
    borderColor: AppColors.primary,
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  durationChipTextActive: {
    color: AppColors.primary,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  modalConfirmBtn: {
    backgroundColor: AppColors.primary,
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Progress Logging Sheet
  modalProgressSheet: {
    width: width,
    height: '75%',
    marginTop: 'auto',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    paddingBottom: 16,
  },
  modalProgressTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  modalProgressSubtitle: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  progressScrollBody: {
    paddingVertical: 16,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  gridDayCard: {
    width: (width - 50) / 3,
    height: 90,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  markedBadgeTag: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#047857',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  markedBadgeTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gridDayTodo: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  gridDayCompleted: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  gridDayLocked: {
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
    opacity: 0.6,
  },
  gridDayTodayHighlight: {
    borderColor: AppColors.accent,
    borderWidth: 2,
  },
  gridDayNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textDark,
    marginTop: 4,
  },
  gridDayDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.textLight,
    marginTop: 2,
  },
  modalDurationSheet: {
    width: width,
    height: '60%',
    marginTop: 'auto',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalDurationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    paddingBottom: 16,
  },
  modalDurationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  modalDurationSubtitleSmall: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  modalDurationSubtitle: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 20,
  },
  durationScrollBody: {
    paddingVertical: 12,
  },
  inputSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 10,
    marginTop: 8,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: '#F9FAFB',
  },
  customDaysInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
    paddingVertical: 0,
  },
  customInputSuffix: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textMedium,
    marginLeft: 8,
  },

  // ── Ellipsis Dropdown ──
  dropdownMenu: {
    position: 'absolute',
    top: 56,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
    minWidth: 190,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },

  // ── Expired Challenge Card ──
  expiredCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  expiredCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  expiredCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
    lineHeight: 20,
  },
  historyExpiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  historyExpiredBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },

  // ── AppBar ──
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backBtn: { padding: 6, position: 'relative' },
  appBarTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: AppColors.primary,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadgeBtn: {
    padding: 6,
    position: 'relative',
  },
  filterDotBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.primary,
  },
  searchSection: {
    marginBottom: 12,
  },

  // ── Left Drawer ──
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  drawerContainer: {
    width: width * 0.75,
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  categoryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textMedium,
    marginLeft: 12,
  },
  categoryItemTextActive: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  drawerFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    gap: 12,
  },
  drawerResetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  drawerResetText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  drawerApplyBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
  },
  drawerApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Horizontal Cards & Detail Buttons ──
  activeHorizontalCard: {
    width: width * 0.82,
    marginRight: 4,
  },
  detailBtn: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  detailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },

  // ── Eco Journey Modal & Ledger Styles ──
  viewJourneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  viewJourneyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  journeySummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  journeySummaryCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'flex-start',
  },
  journeySummaryVal: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textDark,
    marginTop: 6,
  },
  journeySummarySub: {
    fontSize: 11,
    color: AppColors.textMedium,
    fontWeight: '600',
    marginTop: 2,
  },
  calcRulesCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  calcRulesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  ruleItem: {
    marginTop: 6,
  },
  ruleBullet: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  ruleText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 17,
    marginTop: 1,
  },
  ledgerItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  ledgerItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  ledgerItemSub: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  ledgerMetricsGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 10,
  },
  ledgerMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  ledgerMetricVal: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
  },
  ledgerMetricLabel: {
    fontSize: 9,
    color: AppColors.textLight,
    fontWeight: '600',
    marginTop: 2,
  },
  // ── Real Calendar Component Styles (eco_conscience style) ──
  calStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  calStatBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  calStatVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  calStatUnit: {
    fontSize: 10,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  calStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textDark,
    marginTop: 2,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  calNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  weekdayText: {
    width: (width - 80) / 7,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 8,
  },
  calendarCell: {
    width: (width - 80) / 7,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  cellOtherMonth: {
    opacity: 0.35,
  },
  cellCompleted: {
    backgroundColor: '#10B981',
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: AppColors.primary,
    backgroundColor: '#ECFDF5',
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  cellOutsideRange: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  cellDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  cellDayTextOtherMonth: {
    color: '#9CA3AF',
  },
  cellDayTextCompleted: {
    color: '#FFFFFF',
  },
  cellDayTextSelected: {
    color: AppColors.primary,
  },
  cellDayTextToday: {
    color: '#1D4ED8',
  },
  cellDayTextOutside: {
    color: '#9CA3AF',
  },
  completedDotBadge: {
    position: 'absolute',
    bottom: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayIndicatorDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  actionBox: {
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  actionBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
    flex: 1,
  },
  actionCompletedTag: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  actionCompletedTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  markActionButton: {
    backgroundColor: AppColors.primary,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  markActionButtonDone: {
    backgroundColor: '#059669',
  },
  markActionButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  markActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  gridItem: {
    width: '48%',
    marginBottom: 16,
  },

  // ── Premium Styles for Redesigned Cards & Modals ──
  levelDurationTextNew: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  remainingTextNew: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
  },
  dateRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dateTextNew: {
    fontSize: 11,
    color: AppColors.textMedium,
    fontWeight: '700',
  },
  activeActionsRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  iconOnlyBtnNew: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionBtnNew: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  primaryActionBtnDisabledNew: {
    backgroundColor: '#E5E7EB',
  },
  primaryActionBtnTextNew: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  discoverCardNew: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  discoverTitleNew: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  discoverBadgeRowNew: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    alignItems: 'center',
  },
  levelBadgeNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelBadgeTextNew: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  categoryBadgeNew: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeTextNew: {
    fontSize: 9,
    fontWeight: '800',
  },
  participantsBadgeNew: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  participantsBadgeTextNew: {
    fontSize: 9,
    color: AppColors.textMedium,
    fontWeight: '700',
  },
  discoverDescNew: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 10,
    lineHeight: 18,
  },
  impactGridNew: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  impactBoxNew: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  impactTitleNew: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.textMedium,
    letterSpacing: 0.5,
  },
  impactValNew: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  discoverActionsRowNew: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  discoverDetailBtnNew: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  discoverDetailBtnTextNew: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  discoverJoinBtnNew: {
    flex: 1.6,
    height: 38,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  discoverJoinBtnTextNew: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  modalOverlayNew: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheetNew: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandleNew: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeaderRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  // ── Hero Dashboard Styles ──
  heroDashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E2E5',
    padding: 20,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowBackdrop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#2BB673',
    opacity: 0.12,
  },
  heroProfileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroUserName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1C1E',
    letterSpacing: -0.5,
  },
  heroEcoLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  heroEcoLevelLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#3D4A40',
    textTransform: 'uppercase',
    marginRight: 6,
  },
  heroLevelCircleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#006D40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLevelCircleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  heroXpSection: {
    marginBottom: 16,
  },
  heroXpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroXpLabel: {
    fontSize: 12,
    color: '#3D4A40',
    fontWeight: '500',
  },
  heroXpVal: {
    fontSize: 12,
    color: '#3D4A40',
    fontWeight: '700',
  },
  heroXpBarBg: {
    height: 8,
    backgroundColor: '#E8E8EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  heroXpBarFill: {
    height: 8,
    backgroundColor: '#006D40',
    borderRadius: 4,
  },
  heroBentoGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroBentoBox: {
    flex: 1,
    backgroundColor: '#F3F3F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E2E5',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBentoVal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1C1E',
    marginVertical: 4,
  },
  heroBentoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3D4A40',
    textTransform: 'uppercase',
  },

  // ── Modern Challenge Cards Styles (Elevated Hybrid Aesthetic) ──
  modernCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  modernHeroCover: {
    width: '100%',
    height: 142,
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  modernHeroImage: {
    width: '100%',
    height: '100%',
  },
  modernHeroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  modernHeroTopRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  modernCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  modernCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modernLevelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modernLevelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  modernStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modernStatusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  floatingCommunityBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  communityPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  floatingCommunityText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modernCardBody: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  modernCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  modernCardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  modernImpactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  modernImpactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  modernImpactChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modernProgressBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modernProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modernProgressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  streakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  streakBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  modernProgressCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  modernTrack: {
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modernFill: {
    height: '100%',
    backgroundColor: '#00A862',
    borderRadius: 4,
  },
  modernActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernPrimaryBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#006D40',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#006D40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modernPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modernSecondaryBtn: {
    height: 42,
    paddingHorizontal: 12,
    backgroundColor: '#E6F4EA',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C2E7D0',
  },
  modernSecondaryBtnText: {
    color: '#006D40',
    fontSize: 12,
    fontWeight: '800',
  },
  modernIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  communityDiscoveryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 12,
  },
  communityDiscoveryText: {
    fontSize: 11,
    color: '#006D40',
    fontWeight: '600',
  },
  modernSecondaryBtnFlex: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modernSecondaryBtnFlexText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modernPrimaryBtnFlex: {
    flex: 1.5,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#006D40',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#006D40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modernPrimaryBtnFlexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
