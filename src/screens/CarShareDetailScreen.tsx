import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppColors } from '../theme/colors';
import carShareService, { CarShareOffer, CarShareRequest } from '../services/carShareService';
import { useAuth } from '../context/AuthContext';
import { UrlHelper } from '../utils/urlHelper';

export default function CarShareDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { offerId } = route.params;
  const { user: currentUser } = useAuth();

  const [offer, setOffer] = useState<CarShareOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Request/Join states
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Reporting states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('Behavior');
  const [reportDescription, setReportDescription] = useState('');

  const fetchDetail = async () => {
    try {
      const data = await carShareService.getCarShareById(offerId);
      if (data) {
        setOffer(data);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [offerId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text style={styles.errorText}>Ride share offer not found</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = String(offer.user.id) === String(currentUser?.id);
  const avatar = offer.user.profileImage ? UrlHelper.convertPathToUrl(offer.user.profileImage) : null;
  const seatsRemaining = offer.availableSeats - offer.bookedSeats;

  // Parse preferences accurately from offer.preferences and top-level properties
  const rawPrefs = typeof offer.preferences === 'string'
    ? (() => { try { return JSON.parse(offer.preferences); } catch { return {}; } })()
    : (typeof offer.preferences === 'object' && offer.preferences !== null ? offer.preferences : {});

  const allowSmoking = rawPrefs.smoking !== undefined
    ? Boolean(rawPrefs.smoking)
    : Boolean(offer.allow_smoking ?? offer.allowSmoking ?? false);

  const allowPets = rawPrefs.pets !== undefined
    ? Boolean(rawPrefs.pets)
    : Boolean(offer.allow_pets ?? offer.allowPets ?? false);

  const allowMusic = rawPrefs.music !== undefined
    ? Boolean(rawPrefs.music)
    : Boolean(offer.allow_music ?? offer.allowMusic ?? false);

  const extraPrefs = Array.isArray(offer.preferences)
    ? offer.preferences
    : Object.entries(rawPrefs)
        .filter(([key]) => !['pets', 'music', 'smoking', 'allow_pets', 'allow_music', 'allow_smoking'].includes(key.toLowerCase()))
        .map(([key, val]) => (typeof val === 'boolean' ? (val ? key : null) : `${key}: ${val}`))
        .filter(Boolean);

  // Find current user's active request if any
  const myRequest = offer.requests?.find(
    r => String(r.userId || r.user?.id) === String(currentUser?.id) && r.status !== 'cancelled'
  );

  // Event registration check
  const isEventRegistered = Boolean(
    isOwner ||
    offer.event?.isRegistered ||
    offer.event?.is_registered ||
    (offer.event?.registrations && Array.isArray(offer.event.registrations) && offer.event.registrations.some((reg: any) => String(reg.userId || reg.user?.id) === String(currentUser?.id) && (reg.registrationStatus === 'confirmed' || reg.status === 'confirmed')))
  );

  // Expired check
  const isExpired = Boolean(
    offer.isExpired ||
    offer.is_expired ||
    offer.status === 'completed' ||
    offer.status === 'cancelled' ||
    (offer.departureDate && new Date(offer.departureDate.slice(0, 10) + 'T' + (offer.departureTime ? (offer.departureTime.includes('T') ? offer.departureTime.split('T')[1] : offer.departureTime) : '23:59:59')) < new Date()) ||
    (offer.event?.endTime && new Date(offer.event.endTime) < new Date())
  );

  const handleJoinRequestSubmit = async () => {
    if (isExpired) {
      Alert.alert('Event Expired', 'This car share or event has already ended. Join requests are no longer accepted.');
      return;
    }
    if (!isEventRegistered) {
      Alert.alert(
        'Event Registration Required',
        'You must register for the event first before you can join or request a ride.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Event',
            onPress: () => {
              if (offer.event?.id || offer.eventId) {
                navigation.navigate('EventDetail' as never, { eventId: offer.event?.id || offer.eventId } as never);
              }
            },
          },
        ]
      );
      return;
    }
    if (seatsRemaining <= 0) {
      Alert.alert('Ride Full', 'This car share is already full. No available seats remaining.');
      return;
    }
    setShowRequestModal(false);
    setActionLoading(true);
    try {
      const res = await carShareService.requestToJoin(offer.id, requestMessage);
      if (res.success) {
        Alert.alert('Request Sent', 'Your request to join this ride has been submitted to the driver.');
        fetchDetail();
      } else {
        Alert.alert('Error', res.message || 'Failed to submit request.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to request joining.');
    } finally {
      setActionLoading(false);
      setRequestMessage('');
    }
  };

  const handleCancelRequest = async (requestId: string | number) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel your request to join this ride?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await carShareService.cancelRequest(offer.id, requestId);
            if (res.success) {
              Alert.alert('Cancelled', 'Your request was successfully cancelled.');
              fetchDetail();
            } else {
              Alert.alert('Error', res.message || 'Failed to cancel request.');
            }
          } catch (e) {
            Alert.alert('Error', 'Action failed.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleLeaveRide = async () => {
    Alert.alert('Leave Ride', 'Are you sure you want to leave this ride?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Leave Ride',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await carShareService.leaveCarShare(offer.id);
            if (res.success) {
              Alert.alert('Left Ride', "You've successfully left the ride.");
              fetchDetail();
            } else {
              Alert.alert('Error', res.message || 'Failed to leave ride.');
            }
          } catch (e) {
            Alert.alert('Error', 'Action failed.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteOffer = async () => {
    Alert.alert('Delete Ride Offer', 'Are you sure you want to cancel and delete this ride offer?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await carShareService.deleteCarShare(offer.id);
            if (res.success) {
              Alert.alert('Deleted', 'Your ride offer has been cancelled.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } else {
              Alert.alert('Error', res.message || 'Failed to delete offer.');
            }
          } catch (e) {
            Alert.alert('Error', 'Action failed.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleApproveRequest = async (requestId: string | number) => {
    setActionLoading(true);
    try {
      const res = await carShareService.approveRequest(offer.id, requestId);
      if (res.success) {
        Alert.alert('Approved', 'Passenger request approved!');
        fetchDetail();
      } else {
        Alert.alert('Error', res.message || 'Failed to approve request.');
      }
    } catch (e) {
      Alert.alert('Error', 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: string | number) => {
    setActionLoading(true);
    try {
      const res = await carShareService.rejectRequest(offer.id, requestId);
      if (res.success) {
        Alert.alert('Rejected', 'Passenger request rejected.');
        fetchDetail();
      } else {
        Alert.alert('Error', res.message || 'Failed to reject request.');
      }
    } catch (e) {
      Alert.alert('Error', 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportSubmit = async () => {
    setShowReportModal(false);
    setActionLoading(true);
    try {
      const res = await carShareService.reportCarShare(offer.id, reportType, reportDescription);
      if (res.success) {
        Alert.alert('Report Submitted', 'Thank you. Our safety team will review this ride share shortly.');
      } else {
        Alert.alert('Error', res.message || 'Failed to submit report.');
      }
    } catch (e) {
      Alert.alert('Error', 'Action failed.');
    } finally {
      setActionLoading(false);
      setReportDescription('');
    }
  };

  // Passenger list rendering (approved requests)
  const passengers = offer.requests?.filter(r => r.status === 'approved') || [];
  // Pending requests for ride owner
  const pendingRequests = offer.requests?.filter(r => r.status === 'pending') || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride details</Text>
        {isOwner ? (
          <TouchableOpacity onPress={() => navigation.navigate('MyCarShares')} style={styles.rightHeaderBtn}>
            <Ionicons name="list" size={22} color={AppColors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setShowReportModal(true)} style={styles.rightHeaderBtn}>
            <Ionicons name="alert-circle-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Route Timeline */}
        <View style={styles.routeCard}>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>
              {parseFloat(offer.pricePerSeat as string) > 0 ? `${offer.pricePerSeat}€` : 'Free'}
            </Text>
            <Text style={styles.priceSub}>per seat</Text>
          </View>

          <View style={styles.routeRow}>
            <View style={styles.timelineContainer}>
              <View style={[styles.timelineDot, { backgroundColor: AppColors.primary }]} />
              <View style={styles.timelineLine} />
              <View style={[styles.timelineDot, { backgroundColor: '#EF4444' }]} />
            </View>

            <View style={styles.locationsContainer}>
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>PICKUP FROM</Text>
                <Text style={styles.locationName}>{offer.departureLocation}</Text>
              </View>
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>DESTINATION EVENT</Text>
                <Text style={styles.locationName}>{offer.destinationLocation}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={18} color={AppColors.textMedium} />
              <Text style={styles.detailText}>
                {new Date(offer.departureDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={18} color={AppColors.textMedium} />
              <Text style={styles.detailText}>
                {offer.departureTime && typeof offer.departureTime === 'string' ? (offer.departureTime.substring(11, 16) || offer.departureTime) : ''}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={18} color={AppColors.textMedium} />
              <Text style={styles.detailText}>{seatsRemaining} seats left</Text>
            </View>
          </View>
        </View>

        {/* Informational Banners */}
        {isExpired && (
          <View style={[styles.infoBanner, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
            <Ionicons name="information-circle" size={20} color="#4B5563" />
            <Text style={[styles.infoBannerText, { color: '#374151', flex: 1, marginLeft: 8 }]}>
              This car share or event has ended. It is available in view-only mode for historical reference.
            </Text>
          </View>
        )}

        {!isExpired && !isOwner && !isEventRegistered && (
          <TouchableOpacity
            style={[styles.infoBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
            onPress={() => {
              if (offer.event?.id || offer.eventId) {
                navigation.navigate('EventDetail' as never, { eventId: offer.event?.id || offer.eventId } as never);
              } else {
                Alert.alert('Registration Required', 'You must register for this event before you can request to join its car shares.');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={20} color="#D97706" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.infoBannerTitle, { color: '#92400E' }]}>Event Registration Required</Text>
              <Text style={[styles.infoBannerText, { color: '#B45309' }]}>
                You must register for {offer.event?.title || 'the event'} before you can request to join this ride. Tap here to register.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D97706" />
          </TouchableOpacity>
        )}

        {/* Driver Section */}
        <Text style={styles.sectionTitle}>Driver & Trust Verification</Text>
        <View style={styles.driverCard}>
          <View style={styles.driverRow}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.driverAvatar as any} />
            ) : (
              <View style={styles.driverAvatarPlaceholder}>
                <Text style={styles.avatarLetter}>{(offer.user?.fullName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{offer.user?.fullName || 'Driver'}</Text>
              <Text style={styles.driverSubtitle}>⭐ 4.9 • Verified Member</Text>
            </View>
          </View>

          {/* 5-Layer Trust Badges */}
          <View style={styles.trustBadgesRow}>
            <View style={styles.trustBadgeItem}>
              <Ionicons name="call" size={12} color="#10B981" />
              <Text style={styles.trustBadgeLabel}>Phone verified ✓</Text>
            </View>
            <View style={styles.trustBadgeItem}>
              <Ionicons name="shield-checkmark" size={12} color="#10B981" />
              <Text style={styles.trustBadgeLabel}>Identity verified ✓</Text>
            </View>
            <View style={styles.trustBadgeItem}>
              <Ionicons name="ribbon" size={12} color="#10B981" />
              <Text style={styles.trustBadgeLabel}>Licence verified ✓</Text>
            </View>
            <View style={styles.trustBadgeItem}>
              <Ionicons name="car-sport" size={12} color="#10B981" />
              <Text style={styles.trustBadgeLabel}>Vehicle & Insurance ✓</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Vehicle info with plate privacy protection */}
          <View style={styles.vehicleRow}>
            <Ionicons name="car-sport-outline" size={20} color={AppColors.textMedium} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.vehicleText}>
                {offer.vehicleColor ? `${offer.vehicleColor} ` : ''}
                {offer.vehicleType || 'Vehicle'}
              </Text>
              {offer.licensePlate && (
                <Text style={styles.plateText}>
                  {myRequest?.status === 'approved' || isOwner
                    ? `Plate: ${offer.licensePlate}`
                    : `Plate: ${offer.licensePlate.substring(0, 2)}-•••-${offer.licensePlate.slice(-2)} (Visible after booking)`}
                </Text>
              )}
            </View>
          </View>

          {offer.contactPhone && (
            <View style={styles.vehicleRow}>
              <Ionicons name="call-outline" size={20} color={AppColors.textMedium} />
              <Text style={[styles.vehicleText, { marginLeft: 8 }]}>{offer.contactPhone}</Text>
            </View>
          )}

          {offer.notes ? (
            <View style={styles.driverNotesContainer}>
              <Text style={styles.notesLabel}>Driver Notes:</Text>
              <Text style={styles.notesText}>{offer.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>Ride Preferences & Rules</Text>
        <View style={styles.prefGrid}>
          {/* Smoking */}
          <View style={[styles.prefItem, allowSmoking ? styles.prefItemAllowed : styles.prefItemDisallowed]}>
            <Ionicons
              name={allowSmoking ? 'checkmark-circle' : 'ban-outline'}
              size={18}
              color={allowSmoking ? '#047857' : '#6B7280'}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.prefTitle, allowSmoking ? styles.prefTitleAllowed : styles.prefTitleDisallowed]}>
                {allowSmoking ? 'Smoking Allowed' : 'No Smoking'}
              </Text>
            </View>
          </View>

          {/* Pets */}
          <View style={[styles.prefItem, allowPets ? styles.prefItemAllowed : styles.prefItemDisallowed]}>
            <Ionicons
              name={allowPets ? 'paw' : 'paw-outline'}
              size={18}
              color={allowPets ? '#047857' : '#6B7280'}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.prefTitle, allowPets ? styles.prefTitleAllowed : styles.prefTitleDisallowed]}>
                {allowPets ? 'Pets Allowed' : 'No Pets'}
              </Text>
            </View>
          </View>

          {/* Music */}
          <View style={[styles.prefItem, allowMusic ? styles.prefItemAllowed : styles.prefItemDisallowed]}>
            <Ionicons
              name={allowMusic ? 'musical-notes' : 'volume-mute-outline'}
              size={18}
              color={allowMusic ? '#047857' : '#6B7280'}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.prefTitle, allowMusic ? styles.prefTitleAllowed : styles.prefTitleDisallowed]}>
                {allowMusic ? 'Music Friendly' : 'Quiet Ride'}
              </Text>
            </View>
          </View>
        </View>

        {/* Extra Custom Preferences if any */}
        {extraPrefs.length > 0 && (
          <View style={styles.extraPrefsContainer}>
            {extraPrefs.map((pref: any, idx: number) => {
              const prefText = typeof pref === 'string' ? pref : (pref?.label || pref?.name || JSON.stringify(pref));
              return (
                <View key={idx} style={styles.extraPrefChip}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 5 }} />
                  <Text style={styles.extraPrefText}>{prefText}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Passengers section */}
        <Text style={styles.sectionTitle}>Passengers ({passengers.length})</Text>
        {passengers.length > 0 ? (
          <View style={styles.passengersList}>
            {passengers.map((p, idx) => (
              <View key={idx} style={styles.passengerRow}>
                {p.userImageUrl || p.user?.profile_image ? (
                  <Image
                    source={{ uri: UrlHelper.convertPathToUrl(p.userImageUrl || p.user?.profile_image || '') }}
                    style={styles.passengerAvatar as any}
                  />
                ) : (
                  <View style={styles.passengerAvatarPlaceholder}>
                    <Text style={{ fontWeight: '700' }}>
                      {(p.userName || p.user?.full_name || 'P').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.passengerName}>{p.userName || p.user?.full_name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noPassengersText}>No passengers have joined this ride yet.</Text>
        )}

        {/* Driver Requests Section */}
        {isOwner && (
          <>
            <Text style={styles.sectionTitle}>Join Requests ({pendingRequests.length})</Text>
            {pendingRequests.length > 0 ? (
              <View style={styles.requestsList}>
                {pendingRequests.map((r, idx) => (
                  <View key={idx} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {r.userImageUrl || r.user?.profile_image ? (
                          <Image
                            source={{ uri: UrlHelper.convertPathToUrl(r.userImageUrl || r.user?.profile_image || '') }}
                            style={styles.passengerAvatar as any}
                          />
                        ) : (
                          <View style={styles.passengerAvatarPlaceholder}>
                            <Text style={{ fontWeight: '700' }}>
                              {(r.userName || r.user?.full_name || 'R').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.passengerName}>{r.userName || r.user?.full_name}</Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.actionApproveBtn}
                          onPress={() => handleApproveRequest(r.id)}
                        >
                          <Ionicons name="checkmark" size={16} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionRejectBtn} onPress={() => handleRejectRequest(r.id)}>
                          <Ionicons name="close" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {r.message ? (
                      <Text style={styles.requestMessage}>"{r.message}"</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noPassengersText}>No pending requests.</Text>
            )}

            <TouchableOpacity style={styles.deleteOfferBtn} onPress={handleDeleteOffer}>
              <Ionicons name="trash-outline" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.deleteOfferText}>Cancel Ride Offer</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Rider action section */}
        {!isOwner && (
          <View style={styles.actionContainer}>
            {myRequest ? (
              <View style={styles.myRequestCard}>
                <View style={styles.requestStatusRow}>
                  <Ionicons
                    name={myRequest.status === 'approved' ? 'checkmark-circle' : 'time-outline'}
                    size={20}
                    color={myRequest.status === 'approved' ? '#10B981' : '#F59E0B'}
                  />
                  <Text
                    style={[
                      styles.requestStatusText,
                      { color: myRequest.status === 'approved' ? '#047857' : '#B45309' },
                    ]}
                  >
                    Request {myRequest.status.charAt(0).toUpperCase() + myRequest.status.slice(1)}
                  </Text>
                </View>
                <Text style={styles.requestStatusDesc}>
                  {myRequest.status === 'approved'
                    ? "You've been approved by the driver! Contact them for details."
                    : 'The driver is reviewing your request.'}
                </Text>

                {myRequest.status === 'approved' ? (
                  <TouchableOpacity style={styles.leaveRideBtn} onPress={handleLeaveRide}>
                    <Text style={styles.leaveRideText}>Leave Ride</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.leaveRideBtn} onPress={() => handleCancelRequest(myRequest.id)}>
                    <Text style={styles.leaveRideText}>Cancel Request</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : isExpired ? (
              <View style={[styles.joinBtn, { backgroundColor: '#6B7280', shadowOpacity: 0, elevation: 0 }]}>
                <Ionicons name="time-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.joinBtnText}>Ride / Event Ended (View Only)</Text>
              </View>
            ) : !isEventRegistered ? (
              <TouchableOpacity
                style={[styles.joinBtn, { backgroundColor: '#D97706', shadowColor: '#D97706' }]}
                onPress={() => {
                  if (offer.event?.id || offer.eventId) {
                    navigation.navigate('EventDetail' as never, { eventId: offer.event?.id || offer.eventId } as never);
                  } else {
                    Alert.alert('Registration Required', 'You must register for this event before joining its car shares.');
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="ticket-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.joinBtnText}>Register for Event to Join Ride</Text>
              </TouchableOpacity>
            ) : seatsRemaining > 0 ? (
              <TouchableOpacity style={styles.joinBtn} onPress={() => setShowRequestModal(true)} activeOpacity={0.8}>
                <Ionicons name="car-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.joinBtnText}>Request to Join Ride ({seatsRemaining} {seatsRemaining === 1 ? 'seat' : 'seats'} left)</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.joinBtn, { backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0 }]}>
                <Ionicons name="close-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.joinBtnText}>Ride Full (No Available Seats)</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Join Request modal */}
      <Modal visible={showRequestModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Ride</Text>
            <Text style={styles.modalDesc}>Send an optional message to the driver coordinating pickup:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Can you pick me up near the subway station?"
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRequestModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleJoinRequestSubmit}>
                <Text style={styles.modalConfirmText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: '#EF4444' }]}>Report Ride</Text>
            <Text style={styles.modalDesc}>Provide details about why you're reporting this ride share offer:</Text>

            <View style={styles.reportTypeSelector}>
              {['Behavior', 'Vehicle', 'Fake Offer', 'Other'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.reportTypeBtn, reportType === type && styles.reportTypeBtnActive]}
                  onPress={() => setReportType(type)}
                >
                  <Text
                    style={[styles.reportTypeBtnText, reportType === type && styles.reportTypeBtnTextActive]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Explain details of your report..."
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowReportModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
                onPress={handleReportSubmit}
              >
                <Text style={styles.modalConfirmText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {actionLoading && (
        <View style={styles.overlayLoading}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  backLink: {
    marginTop: 16,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backLinkText: {
    color: 'white',
    fontWeight: '700',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.primary,
  },
  rightHeaderBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  routeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
    marginBottom: 20,
  },
  priceTag: {
    position: 'absolute',
    top: 18,
    right: 18,
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 22,
    fontWeight: '900',
    color: AppColors.primary,
  },
  priceSub: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },
  routeRow: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 20,
    marginTop: 8,
  },
  timelineContainer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 12,
    paddingVertical: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  locationsContainer: {
    marginLeft: 12,
    flex: 1,
    gap: 16,
    marginRight: 60, // Space for price tag
  },
  locationItem: {},
  locationLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
    marginBottom: 10,
    marginTop: 8,
    paddingLeft: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoBannerText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  driverCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  driverAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.primary,
  },
  driverInfo: {
    marginLeft: 12,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  driverSubtitle: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  vehicleText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  driverNotesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
  prefGrid: {
    gap: 8,
    marginBottom: 20,
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  prefItemAllowed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  prefItemDisallowed: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  prefTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  prefTitleAllowed: {
    color: '#065F46',
  },
  prefTitleDisallowed: {
    color: '#4B5563',
  },
  extraPrefsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  extraPrefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  extraPrefText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  passengersList: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  passengerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  passengerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 12,
  },
  noPassengersText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingLeft: 4,
    marginBottom: 24,
  },
  requestsList: {
    gap: 12,
    marginBottom: 24,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionApproveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRejectBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestMessage: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 4,
  },
  deleteOfferBtn: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  deleteOfferText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  actionContainer: {
    marginTop: 12,
    marginBottom: 24,
  },
  joinBtn: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  joinBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  fullRideMessage: {
    backgroundColor: '#F3F4F6',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullRideMessageText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '800',
  },
  myRequestCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  requestStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requestStatusText: {
    fontSize: 15,
    fontWeight: '800',
  },
  requestStatusDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  leaveRideBtn: {
    backgroundColor: '#FEE2E2',
    height: 40,
    width: '100%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveRideText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  overlayLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: 'white',
    width: '100%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#374151',
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#4B5563',
    fontWeight: '700',
  },
  modalConfirmBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: '800',
  },
  reportTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reportTypeBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reportTypeBtnActive: {
    backgroundColor: '#FEE2E2',
  },
  reportTypeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  reportTypeBtnTextActive: {
    color: '#EF4444',
  },
  trustBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  trustBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  trustBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  plateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    marginTop: 2,
  },
});
