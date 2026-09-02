import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/colors';
import adminService from '../../services/adminService';

export default function AdminCarSharesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carShares, setCarShares] = useState<any[]>([]);

  const fetchCarShares = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await adminService.getCarShares();
      setCarShares(data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCarShares();
  }, []);

  const handleDelete = (id: number) => {
    Alert.alert('Delete Car Share', 'Are you sure you want to delete this ride offer as admin?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await adminService.deleteCarShare(id);
            Alert.alert('Deleted', 'Car share offer deleted successfully.');
            fetchCarShares(true);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Action failed.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Share Management</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCarShares(true)} colors={[AppColors.primary]} />}
        >
          <Text style={styles.sectionHeader}>Active Ride Offers ({carShares.length})</Text>

          {carShares.length === 0 ? (
            <Text style={styles.emptyText}>No car share offers posted yet.</Text>
          ) : (
            carShares.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeText}>{item.departureLocation || item.departure_location} → {item.destinationLocation || item.destination_location}</Text>
                    <Text style={styles.driverText}>Driver: {item.user?.fullName || item.user?.full_name || 'Driver'}</Text>
                    <Text style={styles.metaText}>Seats: {item.availableSeats || item.available_seats} • Price: €{item.pricePerSeat || item.price_per_seat || 0}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: AppColors.textDark },
  scrollContent: { padding: 16, paddingBottom: 60 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: AppColors.textDark, marginBottom: 12 },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeText: { fontSize: 15, fontWeight: '700', color: AppColors.textDark },
  driverText: { fontSize: 12, color: AppColors.primary, fontWeight: '600', marginTop: 2 },
  metaText: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  deleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
});
