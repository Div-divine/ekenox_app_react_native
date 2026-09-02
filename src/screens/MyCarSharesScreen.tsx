import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';
import carShareService, { CarShareOffer, CarShareRequest } from '../services/carShareService';
import vehicleService from '../services/vehicleService';
import driverLicenseService from '../services/driverLicenseService';
import { UrlHelper } from '../utils/urlHelper';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: '#FEF3C7', text: '#D97706', label: 'Pending' },
  approved:  { bg: '#D1FAE5', text: '#065F46', label: 'Approved' },
  rejected:  { bg: '#FEE2E2', text: '#B91C1C', label: 'Rejected' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280', label: 'Cancelled' },
  active:    { bg: '#D1FAE5', text: '#065F46', label: 'Active' },
  full:      { bg: '#FEF3C7', text: '#D97706', label: 'Full' },
};

const fmt = (s?: string) => {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const MyCarSharesScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'offers' | 'requests' | 'vehicles'>('offers');

  // Offers tab state
  const [offers, setOffers] = useState<CarShareOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersRefreshing, setOffersRefreshing] = useState(false);

  // Incoming requests for my offers
  const [incomingRequests, setIncomingRequests] = useState<CarShareRequest[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);

  // Requests tab state (requests I sent)
  const [myRequests, setMyRequests] = useState<CarShareRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsRefreshing, setRequestsRefreshing] = useState(false);

  // Response modal (approve/reject)
  const [responseModal, setResponseModal] = useState<{
    visible: boolean;
    action: 'approve' | 'reject';
    request: CarShareRequest | null;
  }>({ visible: false, action: 'approve', request: null });
  const [responseMessage, setResponseMessage] = useState('');
  const [responseLoading, setResponseLoading] = useState(false);

  // Vehicles & Verification state
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  const loadOffers = useCallback(async (refresh = false) => {
    if (refresh) setOffersRefreshing(true);
    else setOffersLoading(true);
    try {
      const data = await carShareService.getUserOffers();
      setOffers(data || []);
    } catch (e) {
      console.warn('loadOffers error', e);
    } finally {
      setOffersLoading(false);
      setOffersRefreshing(false);
    }
  }, []);

  const loadIncomingRequests = useCallback(async () => {
    setIncomingLoading(true);
    try {
      const data = await carShareService.getIncomingRequests();
      setIncomingRequests(data || []);
    } catch (e) {
      console.warn('loadIncomingRequests error', e);
    } finally {
      setIncomingLoading(false);
    }
  }, []);

  const loadMyRequests = useCallback(async (refresh = false) => {
    if (refresh) setRequestsRefreshing(true);
    else setRequestsLoading(true);
    try {
      const data = await carShareService.getUserRequests();
      setMyRequests(data || []);
    } catch (e) {
      console.warn('loadMyRequests error', e);
    } finally {
      setRequestsLoading(false);
      setRequestsRefreshing(false);
    }
  }, []);

  const loadVehiclesData = useCallback(async () => {
    setVehiclesLoading(true);
    try {
      const vData = await vehicleService.getVehicles();
      setVehiclesList(vData || []);
      const lData = await driverLicenseService.getDriverLicense();
      setLicenseStatus(lData);
    } catch (e) {
      console.warn('loadVehiclesData error', e);
    } finally {
      setVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'offers') {
      loadOffers();
      loadIncomingRequests();
    } else if (tab === 'requests') {
      loadMyRequests();
    } else if (tab === 'vehicles') {
      loadVehiclesData();
    }
  }, [tab]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleDeleteOffer = (offer: CarShareOffer) => {
    Alert.alert('Delete Ride', 'Are you sure you want to delete this ride offer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await carShareService.deleteCarShare(offer.id);
          if (result.success) {
            setOffers(prev => prev.filter(o => String(o.id) !== String(offer.id)));
            Alert.alert('Deleted', 'Your ride offer has been deleted.');
          } else {
            Alert.alert('Error', result.message || 'Could not delete offer.');
          }
        },
      },
    ]);
  };

  const openResponseModal = (action: 'approve' | 'reject', request: CarShareRequest) => {
    setResponseMessage('');
    setResponseModal({ visible: true, action, request });
  };

  const submitResponse = async () => {
    const { action, request } = responseModal;
    if (!request) return;
    setResponseLoading(true);
    try {
      const offerId = request.carShareId || (request.car_share as any)?.id;
      const result = action === 'approve'
        ? await carShareService.approveRequest(offerId, request.id, responseMessage || undefined)
        : await carShareService.rejectRequest(offerId, request.id, responseMessage || undefined);

      if (result.success) {
        setIncomingRequests(prev =>
          prev.map(r => String(r.id) === String(request.id) ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r)
        );
        setResponseModal({ visible: false, action: 'approve', request: null });
        Alert.alert(
          action === 'approve' ? '✅ Approved!' : '❌ Rejected',
          action === 'approve'
            ? `${request.userName} has been confirmed for the ride.`
            : `${request.userName}'s request has been declined.`
        );
      } else {
        Alert.alert('Error', result.message || 'Action failed.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Action failed.');
    } finally {
      setResponseLoading(false);
    }
  };

  const handleCancelMyRequest = (req: CarShareRequest) => {
    Alert.alert('Cancel Request', 'Are you sure you want to withdraw this join request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          const offerId = req.carShareId || (req.car_share as any)?.id;
          const result = await carShareService.cancelRequest(offerId, req.id);
          if (result.success) {
            setMyRequests(prev =>
              prev.map(r => String(r.id) === String(req.id) ? { ...r, status: 'cancelled' } : r)
            );
            Alert.alert('Cancelled', 'Your join request has been withdrawn.');
          } else {
            Alert.alert('Error', result.message || 'Could not cancel request.');
          }
        },
      },
    ]);
  };

  // ─── Render: Offer card ─────────────────────────────────────────────────────

  const renderOffer = ({ item }: { item: CarShareOffer }) => {
    const st = STATUS_COLORS[item.status] ?? STATUS_COLORS.active;
    const pendingCount = incomingRequests.filter(
      r => String(r.carShareId) === String(item.id) && r.status === 'pending'
    ).length;

    return (
      <View style={styles.offerCard}>
        {/* Header row */}
        <View style={styles.offerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeText} numberOfLines={1}>
              {item.departureLocation} → {item.destinationLocation}
            </Text>
            <Text style={styles.dateText}>{fmt(item.departureDate)} · {item.departureTime?.slice(0, 5)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>

        {/* Seats + price */}
        <View style={styles.offerMeta}>
          <MetaChip icon="people-outline" label={`${item.availableSeats - item.bookedSeats} / ${item.availableSeats} seats`} />
          {item.pricePerSeat !== undefined && item.pricePerSeat !== null && (
            <MetaChip icon="cash-outline" label={`€${item.pricePerSeat} / seat`} />
          )}
          <MetaChip icon="car-outline" label={item.vehicleType || 'Vehicle'} />
        </View>

        {/* Pending requests badge */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.pendingBadge}
            onPress={() => setTab('offers')} // scroll down to requests section
            activeOpacity={0.7}
          >
            <Ionicons name="notifications" size={14} color="#D97706" />
            <Text style={styles.pendingBadgeText}>{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.offerActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('CarShareDetail', { carShareId: item.id })}
          >
            <Ionicons name="eye-outline" size={16} color={AppColors.primary} />
            <Text style={[styles.actionBtnText, { color: AppColors.primary }]}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('CreateCarShare', { editMode: true, carShareId: item.id })}
          >
            <Ionicons name="pencil-outline" size={16} color="#6B7280" />
            <Text style={[styles.actionBtnText, { color: '#6B7280' }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#FEE2E2' }]}
            onPress={() => handleDeleteOffer(item)}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Render: Incoming request card (driver view) ─────────────────────────────

  const renderIncomingRequest = ({ item }: { item: CarShareRequest }) => {
    const st = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const avatar = item.userImageUrl ? { uri: UrlHelper.convertPathToUrl(item.userImageUrl) } : null;

    return (
      <View style={styles.reqCard}>
        <View style={styles.reqHeader}>
          {avatar ? (
            <Image source={avatar} style={styles.reqAvatar} />
          ) : (
            <View style={[styles.reqAvatar, { backgroundColor: AppColors.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={18} color="white" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.reqName}>{item.userName}</Text>
            <Text style={styles.reqTime}>{fmt(item.requestTime)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>

        {item.message ? (
          <View style={styles.reqMessageBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={AppColors.textMedium} />
            <Text style={styles.reqMessageText}>{item.message}</Text>
          </View>
        ) : null}

        {item.status === 'pending' && (
          <View style={styles.reqActions}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => openResponseModal('approve', item)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="white" />
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => openResponseModal('reject', item)}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.responseMessage ? (
          <Text style={styles.responseMsg}>Your reply: "{item.responseMessage}"</Text>
        ) : null}
      </View>
    );
  };

  // ─── Render: My sent request card (passenger view) ──────────────────────────

  const renderMyRequest = ({ item }: { item: CarShareRequest }) => {
    const st = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const offer = item.car_share as CarShareOffer | undefined;

    return (
      <View style={styles.myReqCard}>
        <View style={styles.myReqHeader}>
          <View style={{ flex: 1 }}>
            {offer ? (
              <Text style={styles.routeText} numberOfLines={1}>
                {(offer as any).departureLocation || (offer as any).departure_location || 'Route'}
                {' → '}
                {(offer as any).destinationLocation || (offer as any).destination_location || ''}
              </Text>
            ) : (
              <Text style={styles.routeText}>Ride request</Text>
            )}
            <Text style={styles.dateText}>Requested: {fmt(item.requestTime)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>

        {item.message ? (
          <View style={styles.reqMessageBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={AppColors.textMedium} />
            <Text style={styles.reqMessageText}>Your message: {item.message}</Text>
          </View>
        ) : null}

        {item.responseMessage ? (
          <View style={[styles.reqMessageBox, { backgroundColor: st.bg }]}>
            <Ionicons name="arrow-undo-outline" size={13} color={st.text} />
            <Text style={[styles.reqMessageText, { color: st.text }]}>
              Driver: "{item.responseMessage}"
            </Text>
          </View>
        ) : null}

        <View style={styles.myReqActions}>
          {offer && (
            <TouchableOpacity
              style={styles.viewRideBtn}
              onPress={() => navigation.navigate('CarShareDetail', { carShareId: offer.id })}
            >
              <Ionicons name="eye-outline" size={15} color={AppColors.primary} />
              <Text style={styles.viewRideBtnText}>View Ride</Text>
            </TouchableOpacity>
          )}
          {item.status === 'pending' && (
            <TouchableOpacity
              style={styles.cancelReqBtn}
              onPress={() => handleCancelMyRequest(item)}
            >
              <Ionicons name="close-outline" size={15} color="#EF4444" />
              <Text style={styles.cancelReqBtnText}>Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Car Shares</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateCarShare', {})}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'offers' && styles.activeTabItem]}
          onPress={() => setTab('offers')}
        >
          <Ionicons name={tab === 'offers' ? 'car' : 'car-outline'} size={15} color={tab === 'offers' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.tabText, tab === 'offers' && styles.activeTabText]}>My Rides</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'requests' && styles.activeTabItem]}
          onPress={() => setTab('requests')}
        >
          <Ionicons name={tab === 'requests' ? 'send' : 'send-outline'} size={15} color={tab === 'requests' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.tabText, tab === 'requests' && styles.activeTabText]}>Requests</Text>
          {myRequests.filter(r => r.status === 'pending').length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{myRequests.filter(r => r.status === 'pending').length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'vehicles' && styles.activeTabItem]}
          onPress={() => setTab('vehicles')}
        >
          <Ionicons name={tab === 'vehicles' ? 'shield-checkmark' : 'shield-checkmark-outline'} size={15} color={tab === 'vehicles' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.tabText, tab === 'vehicles' && styles.activeTabText]}>Verifications</Text>
        </TouchableOpacity>
      </View>

      {/* ── OFFERS TAB ── */}
      {tab === 'offers' && (
        <FlatList
          data={offers}
          keyExtractor={item => String(item.id)}
          renderItem={renderOffer}
          refreshControl={<RefreshControl refreshing={offersRefreshing} onRefresh={() => { loadOffers(true); loadIncomingRequests(); }} colors={[AppColors.primary]} />}
          ListHeaderComponent={
            offersLoading && offers.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={AppColors.primary} />
            ) : null
          }
          ListFooterComponent={
            incomingRequests.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={16} color={AppColors.primary} />
                  <Text style={styles.sectionTitle}>Incoming Join Requests</Text>
                  {incomingLoading && <ActivityIndicator size="small" color={AppColors.primary} style={{ marginLeft: 8 }} />}
                </View>
                {incomingRequests.map(item => (
                  <View key={String(item.id)}>
                    {renderIncomingRequest({ item })}
                  </View>
                ))}
              </View>
            ) : !incomingLoading ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={16} color={AppColors.primary} />
                  <Text style={styles.sectionTitle}>Incoming Join Requests</Text>
                </View>
                <Text style={styles.emptyText}>No incoming requests yet.</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !offersLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="car-outline" size={56} color={AppColors.textLight} />
                <Text style={styles.emptyTitle}>No rides offered yet</Text>
                <Text style={styles.emptySubtitle}>Share a ride to an event and help others get there!</Text>
                <TouchableOpacity
                  style={styles.createRideBtn}
                  onPress={() => navigation.navigate('CreateCarShare', {})}
                >
                  <Ionicons name="add-circle-outline" size={18} color="white" />
                  <Text style={styles.createRideBtnText}>Offer a Ride</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, flexGrow: 1 }}
        />
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <FlatList
          data={myRequests}
          keyExtractor={item => String(item.id)}
          renderItem={renderMyRequest}
          refreshControl={<RefreshControl refreshing={requestsRefreshing} onRefresh={() => loadMyRequests(true)} colors={[AppColors.primary]} />}
          ListHeaderComponent={
            requestsLoading && myRequests.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={AppColors.primary} />
            ) : null
          }
          ListEmptyComponent={
            !requestsLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="send-outline" size={56} color={AppColors.textLight} />
                <Text style={styles.emptyTitle}>No join requests sent</Text>
                <Text style={styles.emptySubtitle}>Browse event car shares and request to join a ride!</Text>
                <TouchableOpacity style={styles.createRideBtn} onPress={() => navigation.navigate('Events')}>
                  <Ionicons name="calendar-outline" size={18} color="white" />
                  <Text style={styles.createRideBtnText}>Browse Events</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, flexGrow: 1, paddingTop: 8 }}
        />
      )}

      {/* ── VEHICLES & VERIFICATION TAB ── */}
      {tab === 'vehicles' && (
        <FlatList
          data={vehiclesList}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={vehiclesLoading} onRefresh={loadVehiclesData} colors={[AppColors.primary]} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              {/* Driver License Status Card */}
              <View style={styles.offerCard}>
                <View style={styles.offerHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeText}>🪪 Driver's License Status</Text>
                    <Text style={styles.dateText}>
                      {licenseStatus?.hasDriverLicense ? `License No: ${licenseStatus.licenseNumber || 'Submitted'}` : 'Not submitted yet'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[licenseStatus?.verificationStatus || 'pending']?.bg || '#FEF3C7' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[licenseStatus?.verificationStatus || 'pending']?.text || '#D97706' }]}>
                      {(licenseStatus?.verificationStatus || 'NOT SUBMITTED').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.createRideBtn, { marginTop: 12, paddingVertical: 10 }]}
                  onPress={() => navigation.navigate('DriverLicenseVerification')}
                >
                  <Ionicons name="create-outline" size={16} color="white" />
                  <Text style={styles.createRideBtnText}>
                    {licenseStatus?.hasDriverLicense ? 'Edit / Update Pending License Info' : 'Upload Driver License'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Registered Vehicles Header */}
              <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                <Ionicons name="car-sport" size={18} color={AppColors.primary} />
                <Text style={styles.sectionTitle}>Registered Vehicles ({vehiclesList.length})</Text>
                <TouchableOpacity
                  style={{ backgroundColor: AppColors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                  onPress={() => navigation.navigate('VehicleVerification')}
                >
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>+ Add Vehicle</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUS_COLORS[item.verificationStatus || item.verification_status || 'pending'] || STATUS_COLORS.pending;
            return (
              <View style={styles.offerCard}>
                <View style={styles.offerHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeText}>{item.make} {item.model} ({item.year})</Text>
                    <Text style={styles.dateText}>Plate: {item.licensePlate || item.license_plate} • Color: {item.color || 'N/A'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.text }]}>{st.label.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Edit Pending Vehicle Details button */}
                <TouchableOpacity
                  style={[styles.actionBtn, { marginTop: 10 }]}
                  onPress={() => navigation.navigate('VehicleVerification', { vehicleId: item.id })}
                >
                  <Ionicons name="create-outline" size={16} color={AppColors.primary} />
                  <Text style={[styles.actionBtnText, { color: AppColors.primary }]}>
                    Edit / Update Pending Vehicle Details
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            !vehiclesLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="car-outline" size={56} color={AppColors.textLight} />
                <Text style={styles.emptyTitle}>No vehicles registered</Text>
                <Text style={styles.emptySubtitle}>Add your car specs & papers to offer rides to your friends and community!</Text>
                <TouchableOpacity
                  style={styles.createRideBtn}
                  onPress={() => navigation.navigate('VehicleVerification')}
                >
                  <Ionicons name="add-circle-outline" size={18} color="white" />
                  <Text style={styles.createRideBtnText}>Register A Vehicle</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, flexGrow: 1, paddingTop: 8 }}
        />
      )}

      {/* ── Approve / Reject response modal ── */}
      <Modal visible={responseModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, responseModal.action === 'reject' && { color: '#EF4444' }]}>
              {responseModal.action === 'approve' ? '✅ Approve Request' : '❌ Decline Request'}
            </Text>
            <Text style={styles.modalDesc}>
              {responseModal.action === 'approve'
                ? `Approve ${responseModal.request?.userName}'s request to join your ride?`
                : `Decline ${responseModal.request?.userName}'s request?`}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={responseModal.action === 'approve' ? 'Optional: pickup instructions...' : 'Optional: reason for declining...'}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={responseMessage}
              onChangeText={setResponseMessage}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setResponseModal({ visible: false, action: 'approve', request: null })}
                disabled={responseLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  responseModal.action === 'reject' && { backgroundColor: '#EF4444' },
                  responseLoading && { opacity: 0.6 },
                ]}
                onPress={submitResponse}
                disabled={responseLoading}
              >
                {responseLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {responseModal.action === 'approve' ? 'Approve' : 'Decline'}
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

// ─── Sub-component ─────────────────────────────────────────────────────────────

const MetaChip = ({ icon, label }: { icon: any; label: string }) => (
  <View style={styles.metaChip}>
    <Ionicons name={icon} size={12} color={AppColors.textMedium} />
    <Text style={styles.metaChipText}>{label}</Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: AppColors.textDark },
  createBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: AppColors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTabItem: { borderBottomColor: AppColors.primary },
  tabText: { fontSize: 13, color: AppColors.textMedium, fontWeight: '500' },
  activeTabText: { color: AppColors.primary, fontWeight: '700' },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, color: 'white', fontWeight: '700' },

  // Offer card
  offerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  offerHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  routeText: { fontSize: 15, fontWeight: '700', color: AppColors.textDark, flex: 1 },
  dateText: { fontSize: 12, color: AppColors.textMedium, marginTop: 2 },
  offerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  metaChipText: { fontSize: 11, color: AppColors.textMedium },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 8, padding: 8, marginBottom: 10,
  },
  pendingBadgeText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  offerActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 7,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // Status badge
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Incoming request card
  reqCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reqHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  reqAvatar: { width: 40, height: 40, borderRadius: 20 },
  reqName: { fontSize: 14, fontWeight: '600', color: AppColors.textDark },
  reqTime: { fontSize: 11, color: AppColors.textMedium, marginTop: 1 },
  reqMessageBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginTop: 6,
  },
  reqMessageText: { flex: 1, fontSize: 12, color: AppColors.textMedium },
  reqActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: AppColors.primary, borderRadius: 10, paddingVertical: 9, gap: 6,
  },
  approveBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 10, paddingVertical: 9, gap: 6,
    borderWidth: 1, borderColor: '#FECACA',
  },
  rejectBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  responseMsg: { fontSize: 11, color: AppColors.textMedium, fontStyle: 'italic', marginTop: 6 },

  // My sent request card
  myReqCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  myReqHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  myReqActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  viewRideBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: AppColors.primary,
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12,
  },
  viewRideBtnText: { fontSize: 12, color: AppColors.primary, fontWeight: '600' },
  cancelReqBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12,
  },
  cancelReqBtnText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },

  // Section
  section: { marginTop: 20, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: AppColors.textDark, flex: 1 },

  // Empty states
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: AppColors.textDark, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: AppColors.textMedium, textAlign: 'center', marginTop: 6, paddingHorizontal: 24 },
  emptyText: { fontSize: 13, color: AppColors.textLight, fontStyle: 'italic' },
  createRideBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: AppColors.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24, marginTop: 20,
  },
  createRideBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: AppColors.textDark, marginBottom: 6 },
  modalDesc: { fontSize: 14, color: AppColors.textMedium, marginBottom: 14 },
  modalInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 12, fontSize: 14, color: AppColors.textDark, height: 80,
    textAlignVertical: 'top', marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, color: AppColors.textMedium, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: AppColors.primary,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, color: 'white', fontWeight: '700' },
});

export default MyCarSharesScreen;
