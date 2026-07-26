import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
  Animated, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import associationService, {
  Association,
  PendingInvitation,
  JoinRequest,
  AdminTransferDemand,
} from '../services/associationService';
import { UrlHelper } from '../utils/urlHelper';

const { width: SCREEN_W } = Dimensions.get('window');

const resolveUrl = (url?: string) => UrlHelper.convertPathToUrl(url);

const CATEGORIES = [
  'All', 'Conservation', 'Recycling', 'Clean Energy', 'Ocean Rescue',
  'Advocacy', 'Education', 'Wildlife', 'Climate', 'Agriculture', 'Other',
];

type TabFilter = 'all' | 'mine';

const parseSafeDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  if ((dateStr as any) instanceof Date) return dateStr as unknown as Date;
  let parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  const cleaned = String(dateStr).replace(' ', 'T');
  parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
};

const formatDate = (iso?: string | null) => {
  const d = parseSafeDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

export const AssociationScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user: currentUser } = useAuth();

  // Tabs & filters
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Lists & data
  const [associations, setAssociations] = useState<Association[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [myJoinRequests, setMyJoinRequests] = useState<JoinRequest[]>([]); // User's sent join requests
  const [adminAssociations, setAdminAssociations] = useState<Association[]>([]); // Associations user admins
  const [adminPendingMap, setAdminPendingMap] = useState<Record<string | number, number>>({}); // Map of assocId -> request count
  const [pendingTransfers, setPendingTransfers] = useState<AdminTransferDemand[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);

  // Counts & indicators
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0); // Sent requests badge
  const [adminPendingCount, setAdminPendingCount] = useState(0); // Received requests badge (admin)

  // Loading & refreshing state
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMount = useRef(true);

  // Modals state
  const [myRequestsModalVisible, setMyRequestsModalVisible] = useState(false);
  const [adminPanelModalVisible, setAdminPanelModalVisible] = useState(false);
  const [adminRequestsModalVisible, setAdminRequestsModalVisible] = useState(false);
  const [selectedAdminAssoc, setSelectedAdminAssoc] = useState<Association | null>(null);
  const [selectedAssocRequests, setSelectedAssocRequests] = useState<JoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // New settings-based Join Form & Favorites modal states
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedJoinAssoc, setSelectedJoinAssoc] = useState<Association | null>(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [resumeSelected, setResumeSelected] = useState(false);
  const [joinFormConfig, setJoinFormConfig] = useState<any | null>(null);

  const isJoinFormValid = () => {
    if (joinFormConfig?.require_motif && !joinMessage.trim()) return false;
    if (joinFormConfig?.enable_resume_upload && !resumeSelected) return false;
    if (joinFormConfig?.enable_portfolio_links && !portfolioLink.trim()) return false;
    if (joinFormConfig?.enable_preferred_role && !preferredRole.trim()) return false;
    return true;
  };

  const [favoritesModalVisible, setFavoritesModalVisible] = useState(false);
  const [favoritesList, setFavoritesList] = useState<Association[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const HEADER_HEIGHT = 60 + insets.top;
  const headerTranslateY = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT).interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
  });

  const createBarTranslateY = Animated.diffClamp(scrollY, 0, 60).interpolate({
    inputRange: [0, 60],
    outputRange: [0, -60],
  });

  const START_Y = 50 + 44 + 12 + (tabFilter === 'all' ? 50 : 0);
  const absoluteBarOpacity = scrollY.interpolate({
    inputRange: [START_Y - 20, START_Y],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    scrollY.setValue(0);
  }, [tabFilter]);

  const loadAssociations = useCallback(async (opts?: { reset?: boolean; search?: string; category?: string; filter?: TabFilter }) => {
    const newPage = opts?.reset ? 1 : page;
    const cat = opts?.category ?? selectedCategory;
    const q = opts?.search ?? searchQuery;
    const f = opts?.filter ?? tabFilter;

    try {
      if (f === 'mine') {
        const data = await associationService.getMyAssociations(newPage, 20);
        if (opts?.reset) setAssociations(data);
        else setAssociations(prev => [...prev, ...data]);
        setHasMore(data.length === 20);
      } else {
        const result = await associationService.getAssociations({
          search: q || undefined,
          category: cat !== 'All' ? cat : undefined,
          page: newPage,
          limit: 20,
        });
        if (opts?.reset) setAssociations(result.data);
        else setAssociations(prev => [...prev, ...result.data]);
        setHasMore(result.data.length === 20);
      }
      if (opts?.reset) setPage(2);
      else setPage(p => p + 1);
    } catch (e: any) {
      console.error('Failed to load associations:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedCategory, searchQuery, tabFilter]);

  const loadCountsAndBanners = async () => {
    try {
      const [invitations, myReqsCount, myReqsList, allMyAssocs, adminPendings] = await Promise.all([
        associationService.getMyPendingInvitations(),
        associationService.getMyPendingRequestsCount(),
        associationService.getMyJoinRequests(),
        associationService.getMyAssociations(1, 100), // load user's associations to filter roles
        associationService.getAdminPendingRequests(), // fetch admin pending request counts directly
      ]);

      setPendingInvitations(invitations);
      setPendingRequestsCount(myReqsCount);
      setMyJoinRequests(myReqsList.filter(r => r.status === 'pending'));

      // Filter associations where current user is admin/creator/moderator (standardizing role names)
      const admins = allMyAssocs.filter(a =>
        a.current_user_role === 'admin' ||
        a.current_user_role === 'creator' ||
        a.current_user_role === 'moderator' ||
        a.current_user_role === 'ADMIN_ASSO' ||
        a.current_user_role === 'SOUS_ADMIN_ASSO'
      );
      setAdminAssociations(admins);

      // Map pending request counts from the getAdminPendingRequests API response directly
      let totalAdminPending = 0;
      const countsMap: Record<string | number, number> = {};
      adminPendings.forEach(item => {
        countsMap[item.association.id] = item.pending_requests_count;
        totalAdminPending += item.pending_requests_count;
      });

      // For any admin association not in the pending requests list, default its pending requests count to 0
      admins.forEach(assoc => {
        if (countsMap[assoc.id] === undefined) {
          countsMap[assoc.id] = 0;
        }
      });

      setAdminPendingMap(countsMap);
      setAdminPendingCount(totalAdminPending);
    } catch (err) {
      console.error('Error fetching badges/banners:', err);
    }
  };

  const loadPendingTransfers = async () => {
    try {
      setTransfersLoading(true);
      const data = await associationService.getPendingAdminTransfers();
      setPendingTransfers(data);
    } catch (e) {
      console.error('Failed to load pending admin transfers:', e);
    } finally {
      setTransfersLoading(false);
    }
  };

  const handleAcceptTransfer = async (demandId: string | number) => {
    try {
      setActionLoadingId(demandId);
      await associationService.acceptAdminTransfer(demandId);
      Alert.alert('Accepted', 'You have accepted the administration transfer request. Waiting for the sender to validate.');
      loadPendingTransfers();
      loadCountsAndBanners();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept transfer.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRefuseTransfer = async (demandId: string | number) => {
    try {
      setActionLoadingId(demandId);
      await associationService.refuseAdminTransfer(demandId);
      Alert.alert('Refused', 'You have refused the administration transfer request.');
      loadPendingTransfers();
      loadCountsAndBanners();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to refuse transfer.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelTransfer = async (demandId: string | number) => {
    Alert.alert(
      'Cancel Transfer',
      'Are you sure you want to cancel this administrative transfer request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoadingId(demandId);
              await associationService.cancelAdminTransfer(demandId);
              Alert.alert('Cancelled', 'Transfer request cancelled.');
              loadPendingTransfers();
              loadCountsAndBanners();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to cancel transfer.');
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const handleValidateTransfer = async (demandId: string | number) => {
    Alert.alert(
      'Finalize Transfer',
      'By validating, you will hand over all administrative rights and your role will be set to Viewer. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Validate & Finalize',
          onPress: async () => {
            try {
              setActionLoadingId(demandId);
              await associationService.validateAdminTransfer(demandId);
              Alert.alert('🎉 Finalized', 'Administrative rights have been successfully transferred.');
              loadPendingTransfers();
              loadCountsAndBanners();
              loadAssociations({ reset: true });
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to validate transfer.');
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    setIsLoading(true);
    loadAssociations({ reset: true });
    if (isFirstMount.current) {
      isFirstMount.current = false;
    } else {
      loadCountsAndBanners();
      loadPendingTransfers();
    }
  }, [tabFilter]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadPendingTransfers();
      loadCountsAndBanners();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAssociations({ reset: true });
    loadCountsAndBanners();
    loadPendingTransfers();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setIsLoading(true);
      loadAssociations({ reset: true, search: text });
    }, 500);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setIsLoading(true);
    loadAssociations({ reset: true, category: cat });
  };

  const handleToggleFavorite = async (assoc: Association) => {
    setActionLoadingId(assoc.id);
    try {
      const isFav = await associationService.toggleFavorite(assoc.id);
      Alert.alert(
        isFav ? '⭐ Added to Favorites' : 'Removed from Favorites',
        isFav ? `Added "${assoc.name}" to your favorites.` : `Removed "${assoc.name}" from your favorites.`
      );
      // Toggle favorite indicator locally
      setAssociations(prev =>
        prev.map(item => (item.id === assoc.id ? { ...item, is_favorited: isFav } : item))
      );
      if (favoritesModalVisible) {
        setFavoritesList(prev =>
          prev.map(item => (item.id === assoc.id ? { ...item, is_favorited: isFav } : item))
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update favorites status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleJoinPress = async (assoc: Association) => {
    setSelectedJoinAssoc(assoc);
    setActionLoadingId(assoc.id);
    try {
      const config = await associationService.getJoinFormConfig(assoc.id);
      setJoinFormConfig(config);

      const hasMotif = config.require_motif;
      const hasResume = config.enable_resume_upload;
      const hasPortfolio = config.enable_portfolio_links;
      const hasRole = config.enable_preferred_role;

      if (!hasMotif && !hasResume && !hasPortfolio && !hasRole) {
        await handleJoinSubmit(assoc.id, undefined, {});
      } else {
        setJoinModalVisible(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch join settings.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleJoinSubmit = async (assocId: string | number, message?: string, payload?: any) => {
    setActionLoadingId(assocId);
    try {
      await associationService.requestJoin(assocId, message, payload);
      Alert.alert('✅ Request Sent', 'Your join request has been submitted.');
      setJoinModalVisible(false);
      setJoinMessage('');
      setPortfolioLink('');
      setPreferredRole('');
      setResumeSelected(false);

      // Update locally
      setAssociations(prev =>
        prev.map(item => (item.id === assocId ? { ...item, has_pending_join_request: true } : item))
      );
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send join request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeaveAssociation = (assoc: Association) => {
    Alert.alert('Leave Association', `Are you sure you want to leave "${assoc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setActionLoadingId(assoc.id);
          try {
            await associationService.leaveAssociation(assoc.id);
            Alert.alert('Left', `You left "${assoc.name}".`);
            onRefresh();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to leave.');
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  };

  const handleAcceptInvitation = async (inv: PendingInvitation) => {
    try {
      await associationService.acceptInvitation(inv.id);
      Alert.alert('🎉 Joined!', `You joined "${inv.association.name}".`);
      setPendingInvitations(prev => prev.filter(i => i.id !== inv.id));
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept invitation.');
    }
  };

  const handleRejectInvitation = async (inv: PendingInvitation) => {
    try {
      await associationService.rejectInvitation(inv.id);
      setPendingInvitations(prev => prev.filter(i => i.id !== inv.id));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Cancel join request from sent requests modal
  const handleCancelRequest = async (assocId: string | number) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel your join request?', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          try {
            await associationService.cancelJoinRequest(assocId);
            Alert.alert('Cancelled', 'Your request has been successfully cancelled.');
            // Refresh counts and lists
            setMyJoinRequests(prev => prev.filter(r => r.association?.id !== assocId));
            onRefresh();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to cancel request.');
          }
        },
      },
    ]);
  };

  // Load applicant requests for a specific admin association
  const openAdminRequests = async (assoc: Association) => {
    setSelectedAdminAssoc(assoc);
    setRequestsLoading(true);
    setAdminRequestsModalVisible(true);
    try {
      const requestsList = await associationService.getJoinRequests(assoc.id);
      setSelectedAssocRequests(requestsList);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load pending requests.');
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleApproveRequest = async (req: JoinRequest) => {
    if (!selectedAdminAssoc) return;
    try {
      await associationService.approveJoinRequest(selectedAdminAssoc.id, req.id);
      Alert.alert('Approved', `${req.user?.full_name} has been approved successfully.`);
      // Reload sub-requests list
      const requestsList = await associationService.getJoinRequests(selectedAdminAssoc.id);
      setSelectedAssocRequests(requestsList);
      // Refresh parent lists/counts
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to approve request.');
    }
  };

  const handleRejectRequest = async (req: JoinRequest) => {
    if (!selectedAdminAssoc) return;
    try {
      await associationService.rejectJoinRequest(selectedAdminAssoc.id, req.id);
      Alert.alert('Rejected', 'Request rejected.');
      // Reload sub-requests list
      const requestsList = await associationService.getJoinRequests(selectedAdminAssoc.id);
      setSelectedAssocRequests(requestsList);
      // Refresh parent lists/counts
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reject request.');
    }
  };

  // ─── Render Components ──────────────────────────────────────────────────────

  const renderAssociationCard = ({ item }: { item: Association }) => {
    const isLoader = actionLoadingId === item.id;
    const isMember = !!item.current_user_role;
    const hasPending = item.has_pending_join_request;
    const hasInvite = item.has_pending_invitation;

    // Use profile_image if available, else logo_image, else fallback
    const resolvedImage = item.profile_image || item.logo_image;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={() => navigation.navigate('AssociationDetail', { associationId: item.id })}
      >
        {/* Floating Star Toggler (Favorite) inside card at top-right */}
        <TouchableOpacity
          style={styles.floatingStarBtn}
          onPress={() => handleToggleFavorite(item)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={item.is_favorited ? 'star' : 'star-outline'}
            size={20}
            color={item.is_favorited ? '#F59E0B' : AppColors.textMedium}
          />
        </TouchableOpacity>

        {/* Card Content body */}
        <View style={styles.cardContent}>
          <View style={styles.cardMainRow}>
            {resolvedImage ? (
              <Image source={{ uri: resolveUrl(resolvedImage) }} style={styles.cardLogo} />
            ) : (
              <View style={styles.cardLogoPlaceholder}>
                <Ionicons name="business" size={18} color={AppColors.primary} />
              </View>
            )}

            <View style={styles.cardTitleBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                {item.is_verified && (
                  <Ionicons name="checkmark-circle" size={15} color="#1D4ED8" style={{ marginLeft: 4 }} />
                )}
                {item.is_private && (
                  <View style={styles.privateAssoBadge}>
                    <Ionicons name="lock-closed" size={10} color="#EF4444" style={{ marginRight: 2 }} />
                    <Text style={styles.privateAssoBadgeText}>Private</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardCategoryText}>{item.category}</Text>
              {item.short_tagline ? (
                <Text style={styles.cardTagline} numberOfLines={1}>{item.short_tagline}</Text>
              ) : null}
            </View>
          </View>

          {/* Member count & role row */}
          <View style={styles.metaInfoRow}>
            <View style={styles.membersIndicator}>
              <Ionicons name="people-outline" size={14} color={AppColors.textMedium} />
              <Text style={styles.membersIndicatorText}>{item.member_count} member{item.member_count > 1 ? 's' : ''}</Text>
            </View>

            {item.current_user_role && (
              <View style={styles.roleLabelPill}>
                <Text style={styles.roleLabelPillText}>
                  {item.current_user_role === 'ADMIN_ASSO' ? 'Admin' : item.current_user_role === 'SOUS_ADMIN_ASSO' ? 'Sub-Admin' : item.current_user_role}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

          {hasInvite && !isMember && (
            <View style={styles.inlineInviteAlert}>
              <Ionicons name="mail-open-outline" size={14} color="#1D4ED8" />
              <Text style={styles.inlineInviteAlertText}>You have a pending invitation</Text>
            </View>
          )}

          <View style={styles.cardDivider} />

          {/* Action buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.detailsActionBtn}
              onPress={() => navigation.navigate('AssociationDetail', { associationId: item.id })}
            >
              <Text style={styles.detailsActionBtnText}>Details</Text>
              <Ionicons name="chevron-forward" size={13} color={AppColors.primary} />
            </TouchableOpacity>

            {item.chat_room && isMember && (
              <TouchableOpacity
                style={styles.chatActionBtn}
                onPress={() => navigation.navigate('ChatRoom', {
                  chatRoomId: item.chat_room!.id,
                  name: item.name,
                  logo: resolvedImage,
                })}
              >
                <Ionicons name="chatbubbles-outline" size={14} color="white" />
                <Text style={styles.chatActionBtnText}>Chat</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.joinActionBtn,
                isMember && styles.joinActionBtnMember,
                hasPending && styles.joinActionBtnPending
              ]}
              onPress={() => {
                if (isMember) {
                  handleLeaveAssociation(item);
                } else if (hasPending) {
                  handleCancelRequest(item.id);
                } else {
                  handleJoinPress(item);
                }
              }}
              disabled={isLoader}
            >
              {isLoader ? (
                <ActivityIndicator size="small" color={isMember ? AppColors.primary : 'white'} />
              ) : (
                <>
                  <Ionicons
                    name={isMember ? 'checkmark-circle' : hasPending ? 'hourglass-outline' : 'add-circle-outline'}
                    size={14}
                    color={isMember ? AppColors.primary : hasPending ? '#D97706' : 'white'}
                  />
                  <Text
                    style={[
                      styles.joinActionBtnText,
                      isMember && styles.joinActionBtnTextMember,
                      hasPending && styles.joinActionBtnTextPending
                    ]}
                  >
                    {isMember ? 'Member' : hasPending ? 'Pending' : 'Join'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      {/* ─── Tabs Filter Switch ─── */}
      <View style={[styles.toggleTabBar, { borderBottomWidth: 0, paddingHorizontal: 0 }]}>
        <TouchableOpacity
          style={[styles.toggleTab, tabFilter === 'all' && styles.toggleTabActive]}
          onPress={() => { setTabFilter('all'); setIsLoading(true); }}
        >
          <Ionicons name="earth" size={14} color={tabFilter === 'all' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.toggleTabText, tabFilter === 'all' && styles.toggleTabTextActive]}>Discover</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleTab, tabFilter === 'mine' && styles.toggleTabActive]}
          onPress={() => { setTabFilter('mine'); setIsLoading(true); }}
        >
          <Ionicons name="heart" size={14} color={tabFilter === 'mine' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.toggleTabText, tabFilter === 'mine' && styles.toggleTabTextActive]}>My Associations</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Search & Category Row ─── */}
      <View style={[styles.searchSection, { borderBottomWidth: 0, paddingBottom: 0 }]}>
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={AppColors.textMedium} style={styles.searchBarIcon} />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Search associations..."
            placeholderTextColor={AppColors.textMedium}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); loadAssociations({ reset: true, search: '' }); }}>
              <Ionicons name="close-circle" size={18} color={AppColors.textMedium} />
            </TouchableOpacity>
          )}
        </View>

        {tabFilter === 'all' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryChipsScroll}
            contentContainerStyle={styles.categoryChipsContent}
          >
            {CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => handleCategoryChange(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Top Create Association Bar ── */}
      <View style={styles.createAssocBarCard}>
        <TouchableOpacity
          style={styles.createAssocBarContent}
          onPress={() => navigation.navigate('CreateAssociation')}
          activeOpacity={0.85}
        >
          <View style={styles.createAssocBarIconHolder}>
            <Ionicons name="business" size={18} color={AppColors.primary} />
          </View>
          <Text style={styles.createAssocBarInputPlaceholder}>Create or register a new eco association…</Text>
          <View style={styles.createAssocBarBtn}>
            <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
            <Text style={styles.createAssocBarBtnText}>Create Association</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Pending invitations top banner */}
      {pendingInvitations.length > 0 && (
        <View style={styles.bannerContainer}>
          <View style={styles.bannerHeadingRow}>
            <Ionicons name="mail-open" size={16} color="#1D4ED8" />
            <Text style={styles.bannerHeadingText}>{pendingInvitations.length} Pending Invitation{pendingInvitations.length > 1 ? 's' : ''}</Text>
          </View>
          {pendingInvitations.slice(0, 2).map(inv => (
            <View key={inv.id} style={styles.invitationRow}>
              <View style={styles.invitationLogoPlaceholder}>
                {inv.association.logo ? (
                  <Image source={{ uri: resolveUrl(inv.association.logo) }} style={styles.invitationLogoImg} />
                ) : (
                  <Ionicons name="business" size={15} color={AppColors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.invitationAssocName} numberOfLines={1}>{inv.association.name}</Text>
                <Text style={styles.invitationRoleName}>Role: {inv.role?.name || 'Member'}</Text>
              </View>
              <View style={styles.invitationBtnWrap}>
                <TouchableOpacity style={styles.acceptActionBtn} onPress={() => handleAcceptInvitation(inv)}>
                  <Ionicons name="checkmark" size={14} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineActionBtn} onPress={() => handleRejectInvitation(inv)}>
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Pending join requests top warning banner */}
      {pendingRequestsCount > 0 && (
        <TouchableOpacity style={styles.warningBanner} onPress={() => setMyRequestsModalVisible(true)}>
          <Ionicons name="hourglass-outline" size={15} color="#92400E" />
          <Text style={styles.warningBannerText}>
            You have {pendingRequestsCount} join request{pendingRequestsCount > 1 ? 's' : ''} pending. Tap to view.
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#92400E" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      {/* Pending Administrative Transfers Section */}
      {pendingTransfers.length > 0 && (
        <View style={styles.transfersSection}>
          <Text style={styles.transfersSectionTitle}>Pending Administrative Transfers</Text>
          {pendingTransfers.map((demand) => {
            const isReceived = String(demand.receiver?.id) === String(currentUser?.id) || 
                               (demand.email && currentUser?.email && demand.email.toLowerCase() === currentUser.email.toLowerCase());
            const isLoader = actionLoadingId === demand.id;

            return (
              <View key={demand.id} style={styles.transferCard}>
                <View style={styles.transferCardHeader}>
                  <Ionicons name="shield-checkmark" size={18} color={AppColors.primary} />
                  <Text style={styles.transferAssocName} numberOfLines={1}>
                    {demand.association.name}
                  </Text>
                  <View style={[styles.transferStatusTag, 
                    demand.status === 'accepted_pending_validation' ? styles.statusAcceptedBg : styles.statusPendingBg
                  ]}>
                    <Text style={[styles.transferStatusText,
                      demand.status === 'accepted_pending_validation' ? styles.statusAcceptedText : styles.statusPendingText
                    ]}>
                      {demand.status === 'accepted_pending_validation' ? 'Accepted' : 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={styles.transferBody}>
                  {isReceived ? (
                    <Text style={styles.transferInfoText}>
                      Sender: <Text style={{ fontWeight: '700' }}>{demand.sender.full_name}</Text> ({demand.sender.email})
                    </Text>
                  ) : (
                    <Text style={styles.transferInfoText}>
                      Recipient: <Text style={{ fontWeight: '700' }}>{demand.receiver?.full_name || demand.email}</Text> {demand.receiver ? `(${demand.receiver.email})` : '(Not Registered)'}
                    </Text>
                  )}
                  <Text style={styles.transferDateText}>
                    Date: {formatDate(demand.created_at)}
                  </Text>
                </View>

                <View style={styles.transferActionsRow}>
                  {isReceived ? (
                    demand.status === 'accepted_pending_validation' ? (
                      <>
                        <Text style={styles.waitingText}>Waiting for sender validation</Text>
                        <TouchableOpacity 
                          style={styles.cancelLinkBtn}
                          onPress={() => handleCancelTransfer(demand.id)}
                          disabled={isLoader}
                        >
                          <Text style={styles.cancelLinkText}>Cancel</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity 
                          style={styles.acceptBtn}
                          onPress={() => handleAcceptTransfer(demand.id)}
                          disabled={isLoader}
                        >
                          {isLoader ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.actionBtnText}>Accept</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.refuseBtn}
                          onPress={() => handleRefuseTransfer(demand.id)}
                          disabled={isLoader}
                        >
                          {isLoader ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.actionBtnText}>Refuse</Text>}
                        </TouchableOpacity>
                      </>
                    )
                  ) : (
                    <>
                      {demand.status === 'accepted_pending_validation' && (
                        <TouchableOpacity 
                          style={styles.validateBtn}
                          onPress={() => handleValidateTransfer(demand.id)}
                          disabled={isLoader}
                        >
                          {isLoader ? <ActivityIndicator size="small" color="white" /> : (
                            <>
                              <Ionicons name="checkmark-done" size={14} color="white" />
                              <Text style={styles.actionBtnText}>Validate Transfer</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        style={styles.cancelBtn}
                        onPress={() => handleCancelTransfer(demand.id)}
                        disabled={isLoader}
                      >
                        {isLoader ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.actionBtnText}>Cancel</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={60} color={AppColors.textLight} />
      <Text style={styles.emptyTitle}>No Associations Found</Text>
      <Text style={styles.emptyText}>
        {tabFilter === 'mine'
          ? "You haven't joined or followed any eco associations yet."
          : "Try searching with a different term or clearing your category filters."}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* ─── Premium Header / AppBar ─── */}
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Eco Associations</Text>

        <View style={styles.appBarActions}>
          {/* Favorites Star Icon Button */}
          <TouchableOpacity
            style={styles.iconBadgeBtn}
            onPress={async () => {
              setFavoritesModalVisible(true);
              setFavoritesLoading(true);
              try {
                const list = await associationService.getFavorites();
                setFavoritesList(list);
              } catch (err) {
                console.error('Error fetching favorites:', err);
              } finally {
                setFavoritesLoading(false);
              }
            }}
          >
            <Ionicons name="star" size={22} color="#F59E0B" />
          </TouchableOpacity>

          {/* User sent requests count badge */}
          <TouchableOpacity style={styles.iconBadgeBtn} onPress={() => setMyRequestsModalVisible(true)}>
            <Ionicons name="hourglass-outline" size={22} color={AppColors.textDark} />
            {pendingRequestsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Admin pending requests count badge */}
          {adminAssociations.length > 0 && (
            <TouchableOpacity style={styles.iconBadgeBtn} onPress={() => setAdminPanelModalVisible(true)}>
              <Ionicons name="shield-checkmark-outline" size={22} color={AppColors.primary} />
              {adminPendingCount > 0 && (
                <View style={[styles.badge, { backgroundColor: AppColors.primary }]}>
                  <Text style={styles.badgeText}>{adminPendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Sticky Create Association Bar Overlay */}
      {!isLoading && (
        <Animated.View
          style={[
            styles.createAssocBarCard,
            {
              position: 'absolute',
              top: 60 + insets.top,
              left: 0,
              right: 0,
              zIndex: 99,
              marginVertical: 0,
              paddingVertical: 8,
              backgroundColor: '#F5F5F7',
              opacity: absoluteBarOpacity,
              transform: [{ translateY: createBarTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.createAssocBarContent}
            onPress={() => navigation.navigate('CreateAssociation')}
            activeOpacity={0.85}
          >
            <View style={styles.createAssocBarIconHolder}>
              <Ionicons name="business" size={18} color={AppColors.primary} />
            </View>
            <Text style={styles.createAssocBarInputPlaceholder}>Create or register a new eco association…</Text>
            <View style={styles.createAssocBarBtn}>
              <Ionicons name="add" size={14} color="white" style={{ marginRight: 2 }} />
              <Text style={styles.createAssocBarBtnText}>Create Association</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ─── Associations List ─── */}
      {isLoading && associations.length === 0 ? (
        <View style={[styles.loaderContainer, { paddingTop: 60 + insets.top }]}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loaderText}>Loading eco associations...</Text>
        </View>
      ) : (
        <Animated.FlatList
          data={associations}
          renderItem={renderAssociationCard}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.listContainerStyle, { paddingTop: 60 + insets.top }]}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} progressViewOffset={60 + insets.top} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          onEndReached={() => { if (hasMore && !isLoading) loadAssociations(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            hasMore && associations.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={AppColors.primary} size="small" />
              </View>
            ) : null
          }
        />
      )}



      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 1: MY SENT REQUESTS BOTTOM SHEET
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={myRequestsModalVisible} animationType="slide" transparent onRequestClose={() => setMyRequestsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Sent Join Requests</Text>
              <TouchableOpacity onPress={() => setMyRequestsModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {myJoinRequests.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="hourglass-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.modalEmptyTitle}>No Pending Requests</Text>
                <Text style={styles.modalEmptyText}>You don't have any sent join requests currently waiting for approval.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {myJoinRequests.map((req, idx) => (
                  <View key={req.id ? String(req.id) : `myreq-${idx}`} style={styles.requestCard}>
                    <View style={styles.requestCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestAssocName}>{req.association?.name || 'Eco Association'}</Text>
                        <Text style={styles.requestDate}>Requested on: {formatDate(req.created_at)}</Text>
                      </View>
                      <View style={styles.pendingIndicatorTag}>
                        <Text style={styles.pendingIndicatorTagText}>Pending</Text>
                      </View>
                    </View>

                    {req.message ? (
                      <View style={styles.requestMessageContainer}>
                        <Text style={styles.requestMessageLabel}>My message:</Text>
                        <Text style={styles.requestMessageText}>"{req.message}"</Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={styles.cancelRequestActionBtn}
                      onPress={() => handleCancelRequest(req.association?.id || '')}
                    >
                      <Ionicons name="trash-outline" size={14} color={AppColors.error} />
                      <Text style={styles.cancelRequestActionBtnText}>Cancel Join Request</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 2: ADMIN CONTROL PANEL
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={adminPanelModalVisible} animationType="slide" transparent onRequestClose={() => setAdminPanelModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Admin Control Panel</Text>
              <TouchableOpacity onPress={() => setAdminPanelModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {adminAssociations.map((assoc, idx) => {
                const pendingCount = adminPendingMap[assoc.id] || 0;
                return (
                  <View key={assoc.id ? String(assoc.id) : `admin-assoc-${idx}`} style={styles.adminCard}>
                    <View style={styles.adminCardHeader}>
                      {assoc.logo_image ? (
                        <Image source={{ uri: resolveUrl(assoc.logo_image) }} style={styles.adminLogo} />
                      ) : (
                        <View style={styles.adminLogoPlaceholder}>
                          <Ionicons name="business" size={18} color={AppColors.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adminAssocName} numberOfLines={1}>{assoc.name}</Text>
                        <View style={styles.adminRoleRow}>
                          <View style={styles.adminBadge}>
                            <Text style={styles.adminBadgeText}>{assoc.current_user_role || 'Admin'}</Text>
                          </View>
                          {pendingCount > 0 && (
                            <View style={styles.pendingBadge}>
                              <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Admin quick shortcut actions */}
                    <View style={styles.adminActionsBlock}>
                      <TouchableOpacity
                        style={[styles.adminShortcutBtn, pendingCount === 0 && { opacity: 0.55 }]}
                        onPress={() => {
                          setAdminPanelModalVisible(false);
                          navigation.navigate('JoinRequests', { associationId: assoc.id, associationName: assoc.name });
                        }}
                      >
                        <Ionicons name="people-outline" size={16} color={AppColors.primary} />
                        <Text style={styles.adminShortcutBtnText}>View Requests</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.adminShortcutBtn}
                        onPress={() => {
                          setAdminPanelModalVisible(false);
                          navigation.navigate('CreateAssociation', { associationId: assoc.id, association: assoc });
                        }}
                      >
                        <Ionicons name="pencil-outline" size={16} color="#7C3AED" />
                        <Text style={styles.adminShortcutBtnText}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.adminShortcutBtn}
                        onPress={() => {
                          setAdminPanelModalVisible(false);
                          navigation.navigate('EventDetail', { eventId: null }); // creation parameter
                        }}
                      >
                        <Ionicons name="calendar-outline" size={16} color="#0284C7" />
                        <Text style={styles.adminShortcutBtnText}>+ Event</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 3: PENDING APPLICANTS REQUESTS LIST (SUB-VIEW)
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={adminRequestsModalVisible} animationType="slide" transparent onRequestClose={() => setAdminRequestsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Join Requests</Text>
                <Text style={styles.modalSubTitle}>{selectedAdminAssoc?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setAdminRequestsModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {requestsLoading ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator size="large" color={AppColors.primary} />
                <Text style={styles.modalLoaderText}>Loading join requests...</Text>
              </View>
            ) : selectedAssocRequests.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.modalEmptyTitle}>All Caught Up!</Text>
                <Text style={styles.modalEmptyText}>No pending requests found for this association currently.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {selectedAssocRequests.map((req, idx) => (
                  <View key={req.id ? String(req.id) : `reqadm-${idx}`} style={styles.adminRequestCard}>
                    <View style={styles.adminRequestRow}>
                      <View style={styles.applicantAvatarBox}>
                        <Text style={styles.applicantAvatarInitial}>
                          {(req.user?.full_name || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.applicantName}>{req.user?.full_name || 'Unknown User'}</Text>
                        <Text style={styles.applicantDate}>Sent: {formatDate(req.created_at)}</Text>
                      </View>

                      {/* Approve / Reject buttons */}
                      <View style={styles.adminRequestActions}>
                        <TouchableOpacity style={styles.approveCardBtn} onPress={() => handleApproveRequest(req)}>
                          <Ionicons name="checkmark" size={14} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectCardBtn} onPress={() => handleRejectRequest(req)}>
                          <Ionicons name="close" size={14} color="white" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {req.message ? (
                      <View style={styles.applicantMessageWrap}>
                        <Text style={styles.applicantMessageText}>"{req.message}"</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 4: SETTINGS-BASED JOIN CONFIGURATION FORM
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={joinModalVisible} animationType="slide" transparent onRequestClose={() => setJoinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join {selectedJoinAssoc?.name}</Text>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350, marginVertical: 8 }}>
              {/* Region Restriction Note */}
              {joinFormConfig?.restricted_to_regions && joinFormConfig?.allowed_regions?.length > 0 && (
                <View style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309', textTransform: 'uppercase' }}>restricted region notice</Text>
                  <Text style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>
                    This association restricts joins to: {joinFormConfig.allowed_regions.join(', ')}
                  </Text>
                </View>
              )}

              {/* Motif Text Area */}
              {joinFormConfig?.require_motif && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>
                    {joinFormConfig.motif_prompt || 'Reason for joining (Motif)'} *
                  </Text>
                  <TextInput
                    style={styles.modalInputText}
                    value={joinMessage}
                    onChangeText={setJoinMessage}
                    placeholder="Why would you like to join?"
                    placeholderTextColor={AppColors.textLight}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Preferred Role Input */}
              {joinFormConfig?.enable_preferred_role && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>
                    Preferred Role
                  </Text>
                  <TextInput
                    style={[styles.modalInputText, { height: 44, paddingVertical: 10 }]}
                    value={preferredRole}
                    onChangeText={setPreferredRole}
                    placeholder="e.g. Volunteer, Contributor, Admin"
                    placeholderTextColor={AppColors.textLight}
                  />
                </View>
              )}

              {/* Portfolio Link Input */}
              {joinFormConfig?.enable_portfolio_links && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: AppColors.textMedium, marginBottom: 6 }}>
                    Portfolio / Website Link
                  </Text>
                  <TextInput
                    style={[styles.modalInputText, { height: 44, paddingVertical: 10 }]}
                    value={portfolioLink}
                    onChangeText={setPortfolioLink}
                    placeholder="https://example.com"
                    placeholderTextColor={AppColors.textLight}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              )}

              {/* Resume Checkbox */}
              {joinFormConfig?.enable_resume_upload && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, gap: 8 }}
                  activeOpacity={0.8}
                  onPress={() => setResumeSelected(!resumeSelected)}
                >
                  <Ionicons
                    name={resumeSelected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={resumeSelected ? AppColors.primary : AppColors.textMedium}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: AppColors.textDark }}>
                    Attach my Ekenox resume / profile document
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.joinActionBtn,
                { width: '100%', marginTop: 12, height: 44 },
                !isJoinFormValid() && { backgroundColor: AppColors.textLight, borderColor: AppColors.textLight }
              ]}
              onPress={() => {
                if (!selectedJoinAssoc) return;
                if (!isJoinFormValid()) return;
                const payload: any = {};
                if (joinFormConfig?.enable_resume_upload && resumeSelected) {
                  payload.resume_url = 'attached_resume.pdf';
                }
                if (joinFormConfig?.enable_preferred_role && preferredRole) {
                  payload.preferred_role_id = 4;
                }
                if (joinFormConfig?.enable_portfolio_links && portfolioLink) {
                  payload.portfolio_links = [portfolioLink];
                }

                handleJoinSubmit(selectedJoinAssoc.id, joinMessage || undefined, payload);
              }}
              disabled={!isJoinFormValid() || actionLoadingId === selectedJoinAssoc?.id}
            >
              {actionLoadingId === selectedJoinAssoc?.id ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.joinActionBtnText}>Send Join Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 5: APPBAR FAVORITES LIST MODAL
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={favoritesModalVisible} animationType="slide" transparent onRequestClose={() => setFavoritesModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.modalTitle}>My Favorites</Text>
              </View>
              <TouchableOpacity onPress={() => setFavoritesModalVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {favoritesLoading ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator size="large" color={AppColors.primary} />
                <Text style={styles.modalLoaderText}>Loading favorites list...</Text>
              </View>
            ) : favoritesList.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="star-outline" size={48} color="#F59E0B" style={{ opacity: 0.6 }} />
                <Text style={styles.modalEmptyTitle}>No Favorites Yet</Text>
                <Text style={styles.modalEmptyText}>
                  Tap the Star icon on any eco association card to save them to your favorites for instant access.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {favoritesList.map((assoc, idx) => {
                  const resolvedImage = assoc.profile_image || assoc.logo_image;
                  return (
                    <TouchableOpacity
                      key={assoc.id ? String(assoc.id) : `fav-assoc-${idx}`}
                      style={styles.adminCard}
                      onPress={() => {
                        setFavoritesModalVisible(false);
                        navigation.navigate('AssociationDetail', { associationId: assoc.id });
                      }}
                    >
                      <View style={styles.adminCardHeader}>
                        {resolvedImage ? (
                          <Image source={{ uri: resolveUrl(resolvedImage) }} style={styles.adminLogo} />
                        ) : (
                          <View style={styles.adminLogoPlaceholder}>
                            <Ionicons name="business" size={18} color={AppColors.primary} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.adminAssocName} numberOfLines={1}>{assoc.name}</Text>
                          <Text style={styles.adminRoleRow} numberOfLines={1}>
                            {assoc.category} • {assoc.member_count} members
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },

  // ── AppBar ──
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backBtn: { padding: 6 },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
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
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: AppColors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ── Tab Filters Switch ──
  toggleTabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    padding: 4,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  toggleTabActive: {
    borderBottomColor: AppColors.primary,
  },
  toggleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  toggleTabTextActive: {
    color: AppColors.primary,
    fontWeight: '800',
  },

  // ── Search & Categories ──
  searchSection: {
    backgroundColor: 'white',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  searchBarIcon: { marginRight: 8 },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textDark,
    height: '100%',
  },
  categoryChipsScroll: { marginTop: 10 },
  categoryChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: AppColors.primary + '14',
    borderWidth: 1,
    borderColor: AppColors.primary + '25',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },
  categoryChipTextActive: {
    color: 'white',
  },

  // ── Loader ──
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: AppColors.textMedium,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // ── Banners ──
  bannerContainer: {
    backgroundColor: '#DBEAFE',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bannerHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  bannerHeadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  invitationLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  invitationLogoImg: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  invitationAssocName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  invitationRoleName: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  invitationBtnWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },

  // ── Cards Redesign ──
  listContainerStyle: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  cardImageWrap: {
    height: 140,
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    backgroundColor: AppColors.primary + 'C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCategoryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'white',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardCategoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
    textTransform: 'uppercase',
  },
  cardContent: {
    padding: 16,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  cardLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: AppColors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: AppColors.primary + '25',
  },
  cardTitleBlock: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  privateAssoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginLeft: 6,
  },
  privateAssoBadgeText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '700',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    flexShrink: 1,
  },
  cardTagline: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
    fontStyle: 'italic',
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  membersIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  membersIndicatorText: {
    fontSize: 12,
    color: AppColors.textMedium,
    fontWeight: '500',
  },
  roleLabelPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleLabelPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'capitalize',
  },
  cardDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 12,
  },
  inlineInviteAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  inlineInviteAlertText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
    marginBottom: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailsActionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AppColors.primary + '40',
    gap: 4,
  },
  detailsActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  chatActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.primaryLight,
    gap: 5,
  },
  chatActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  joinActionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.primary,
    gap: 5,
  },
  joinActionBtnMember: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  joinActionBtnPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  joinActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  joinActionBtnTextMember: {
    color: AppColors.primary,
  },
  joinActionBtnTextPending: {
    color: '#D97706',
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── FAB ──
  floatingActionBtn: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Modals / Bottom Sheets ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  modalSubTitle: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  modalScroll: {
    marginVertical: 8,
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  modalEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    marginTop: 8,
  },
  modalEmptyText: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 24,
  },

  // ── Sent Requests Card ──
  requestCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  requestAssocName: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  requestDate: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 2,
  },
  pendingIndicatorTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingIndicatorTagText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '700',
  },
  requestMessageContainer: {
    marginTop: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestMessageLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMedium,
    marginBottom: 2,
  },
  requestMessageText: {
    fontSize: 12,
    color: AppColors.textDark,
    fontStyle: 'italic',
  },
  cancelRequestActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: AppColors.error + '40',
    borderRadius: 10,
    height: 36,
  },
  cancelRequestActionBtnText: {
    color: AppColors.error,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Admin Panel Card ──
  adminCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 16,
    marginBottom: 12,
  },
  adminCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  adminLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adminLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: AppColors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primary + '20',
  },
  adminAssocName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  adminRoleRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    alignItems: 'center',
  },
  adminBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'capitalize',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  adminActionsBlock: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  adminShortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  adminShortcutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textDark,
  },

  // ── Admin Join Requests Sub-Modal ──
  modalLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  modalLoaderText: {
    fontSize: 13,
    color: AppColors.textMedium,
  },
  adminRequestCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adminRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  applicantAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.primary,
  },
  applicantName: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  applicantDate: {
    fontSize: 10,
    color: AppColors.textLight,
    marginTop: 2,
  },
  adminRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveCardBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  rejectCardBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AppColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  applicantMessageWrap: {
    marginTop: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  applicantMessageText: {
    fontSize: 12,
    color: AppColors.textDark,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  floatingStarBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  cardCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.primary,
    marginTop: 2,
  },
  modalInputText: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: AppColors.textDark,
    backgroundColor: '#FAFAFA',
    minHeight: 44,
  },
  transfersSection: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  transfersSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transferCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  transferCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  transferAssocName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
    flex: 1,
  },
  transferStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  transferStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusPendingBg: {
    backgroundColor: '#FEF3C7',
  },
  statusPendingText: {
    color: '#D97706',
  },
  statusAcceptedBg: {
    backgroundColor: '#D1FAE5',
  },
  statusAcceptedText: {
    color: '#059669',
  },
  transferBody: {
    marginBottom: 12,
  },
  transferInfoText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  transferDateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  transferActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  refuseBtn: {
    backgroundColor: AppColors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  validateBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  cancelBtn: {
    backgroundColor: '#64748B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  waitingText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1,
  },
  cancelLinkBtn: {
    padding: 6,
  },
  cancelLinkText: {
    color: AppColors.error,
    fontSize: 12,
    fontWeight: '700',
  },
  createAssocBarCard: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  createAssocBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  createAssocBarIconHolder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CCFAF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAssocBarInputPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: AppColors.textMedium,
    marginLeft: 10,
    marginRight: 8,
  },
  createAssocBarBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createAssocBarBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});
