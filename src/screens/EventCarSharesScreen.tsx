import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { AppColors } from '../theme/colors';
import carShareService, { CarShareOffer } from '../services/carShareService';
import userVerificationService from '../services/userVerificationService';
import { UrlHelper } from '../utils/urlHelper';

const resolveAvatar = (imagePath?: string) => {
  if (!imagePath) return null;
  return UrlHelper.convertPathToUrl(imagePath);
};

export default function EventCarSharesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { eventId, eventTitle, eventLocation } = route.params;

  const [offers, setOffers] = useState<CarShareOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDriverVerified, setIsDriverVerified] = useState(false);

  const fetchEventCarShares = async () => {
    try {
      const data = await carShareService.getEventCarShares(eventId);
      if (data) {
        setOffers(data);
      }
      
      // Check if current user is verified to offer a ride
      const status = await userVerificationService.getVerificationStatus();
      if (status) {
        setIsDriverVerified(status.is_fully_verified);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEventCarShares();
    }, [eventId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEventCarShares();
  };

  const handleProposeRide = () => {
    if (!isDriverVerified) {
      navigation.navigate('UserVerification');
      return;
    }
    navigation.navigate('CreateCarShare', { eventId, eventTitle, eventLocation });
  };

  const renderOfferItem = ({ item }: { item: CarShareOffer }) => {
    const avatar = resolveAvatar(item.user.profileImage);
    const seatsRemaining = item.availableSeats - item.bookedSeats;

    return (
      <TouchableOpacity
        style={styles.rideCard}
        onPress={() => navigation.navigate('CarShareDetail', { offerId: item.id })}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <View style={styles.driverRow}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{(item.user?.fullName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{item.user?.fullName || 'User'}</Text>
              <Text style={styles.vehicleInfo}>
                {item.vehicleType || 'No vehicle specified'} {item.vehicleColor ? `• ${item.vehicleColor}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceValue}>
              {parseFloat(item.pricePerSeat as string) > 0 ? `${item.pricePerSeat}€` : 'Free'}
            </Text>
            <Text style={styles.priceLabel}>per seat</Text>
          </View>
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
              <Text style={styles.locationName} numberOfLines={1}>
                {item.departureLocation}
              </Text>
            </View>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>TO EVENT</Text>
              <Text style={styles.locationName} numberOfLines={1}>
                {item.destinationLocation}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.timeInfo}>
            <Ionicons name="time-outline" size={16} color="#4B5563" />
            <Text style={styles.timeText}>
              {new Date(item.departureDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
              {item.departureTime && typeof item.departureTime === 'string' ? (item.departureTime.substring(11, 16) || item.departureTime) : ''}
            </Text>
          </View>

          <View style={styles.seatsInfo}>
            <Ionicons name="people-outline" size={16} color={seatsRemaining > 0 ? '#10B981' : '#EF4444'} />
            <Text style={[styles.seatsText, { color: seatsRemaining > 0 ? '#10B981' : '#EF4444' }]}>
              {seatsRemaining > 0 ? `${seatsRemaining} seats left` : 'Ride Full'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Rides to {eventTitle}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {eventLocation}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('MyCarShares')} style={styles.rightHeaderBtn}>
          <Ionicons name="list" size={22} color={AppColors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <FlatList
          data={offers}
          renderItem={renderOfferItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={60} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No rides offered yet</Text>
              <Text style={styles.emptySubtitle}>
                Be the first to offer a ride for this event to help other attendees!
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleProposeRide} activeOpacity={0.85}>
        <Ionicons name="add" size={24} color="white" style={{ marginRight: 6 }} />
        <Text style={styles.fabText}>Offer a Ride</Text>
      </TouchableOpacity>
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
  header: {
    height: 60,
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
  rightHeaderBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 88, // Space for FAB
  },
  rideCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.primary,
  },
  driverInfo: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  vehicleInfo: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.primary,
  },
  priceLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  routeRow: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 16,
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
    gap: 12,
  },
  locationItem: {},
  locationLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  locationName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  seatsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seatsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4B5563',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
});
