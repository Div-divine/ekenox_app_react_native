import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';

interface ActivityLog {
  id: string;
  action: string;
  category: 'transport' | 'waste' | 'community' | 'events';
  date: string;
  points: number;
  icon: string;
  color: string;
}

const mockActivities: ActivityLog[] = [
  {
    id: '1',
    action: 'Logged Car Share to Albany Office',
    category: 'transport',
    date: 'Today, 2:30 PM',
    points: 50,
    icon: 'car-sport',
    color: '#3B82F6',
  },
  {
    id: '2',
    action: 'Posted Eco Action: Refused Single-Use Plastic Bottle',
    category: 'waste',
    date: 'Yesterday, 9:15 AM',
    points: 10,
    icon: 'trash',
    color: '#EF4444',
  },
  {
    id: '3',
    action: 'Joined Group: Green Energy Initiative',
    category: 'community',
    date: 'June 6, 2026',
    points: 20,
    icon: 'people',
    color: '#8B5CF6',
  },
  {
    id: '4',
    action: 'Registered for: Forest Re-planting Drive',
    category: 'events',
    date: 'June 4, 2026',
    points: 30,
    icon: 'calendar',
    color: '#10B981',
  },
  {
    id: '5',
    action: 'Completed Quiz: Climate Change Basics',
    category: 'community',
    date: 'May 30, 2026',
    points: 100,
    icon: 'ribbon',
    color: '#F59E0B',
  },
  {
    id: '6',
    action: 'Created Car Share Offer: NYC Commute',
    category: 'transport',
    date: 'May 28, 2026',
    points: 40,
    icon: 'add-circle',
    color: '#14B8A6',
  },
];

export default function ActivityHistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filteredActivities = activeFilter === 'all'
    ? mockActivities
    : mockActivities.filter((a) => a.category === activeFilter);

  const renderActivityItem = ({ item, index }: { item: ActivityLog; index: number }) => {
    const isLast = index === filteredActivities.length - 1;
    
    return (
      <View style={styles.logRow}>
        {/* Left timeline line and icon */}
        <View style={styles.timelineColumn}>
          <View style={[styles.iconWrapper, { backgroundColor: item.color + '15' }]}>
            <Ionicons name={item.icon as any} size={18} color={item.color} />
          </View>
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        {/* Right activity details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Text style={styles.actionText}>{item.action}</Text>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>+{item.points} XP</Text>
            </View>
          </View>
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity History</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Filter Buttons horizontal scroll */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: 'all', label: 'All Logs' },
            { key: 'transport', label: 'Transport' },
            { key: 'waste', label: 'Waste' },
            { key: 'community', label: 'Community' },
            { key: 'events', label: 'Events' },
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterBtn, activeFilter === item.key && styles.filterBtnActive]}
              onPress={() => setActiveFilter(item.key)}
            >
              <Text style={[styles.filterText, activeFilter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>

      {filteredActivities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={48} color={AppColors.textLight} />
          <Text style={styles.emptyText}>No activities found in this category.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
  headerBtn: {
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  filterContainer: {
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnActive: {
    backgroundColor: '#E6F4EA',
    borderColor: AppColors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  filterTextActive: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  logRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineColumn: {
    alignItems: 'center',
    width: 36,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#D1D5DB',
    marginVertical: 4,
  },
  detailsCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
    flex: 1,
    lineHeight: 18,
  },
  pointsBadge: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pointsText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  dateText: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: AppColors.textMedium,
  },
});
