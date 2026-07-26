import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface Badge {
  id: string;
  name: string;
  description: string;
  howToEarn: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

const mockBadges: Badge[] = [
  {
    id: '1',
    name: 'Carbon Saver',
    description: 'Acknowledges outstanding contribution to reducing carbon footprint through car sharing.',
    howToEarn: 'Save 50kg of CO2 by participating in Ekenox car shares.',
    icon: 'leaf-outline',
    color: '#10B981',
    unlocked: true,
  },
  {
    id: '2',
    name: 'Recycling Champion',
    description: 'Awarded for active recycling logs and plastic waste reduction actions.',
    howToEarn: 'Log 5 separate recycling activities in the community feed.',
    icon: 'trash-outline',
    color: '#3B82F6',
    unlocked: true,
  },
  {
    id: '3',
    name: 'Energy Star',
    description: 'Celebrates smart home energy savings and efficiency choices.',
    howToEarn: 'Complete the Energy Efficiency challenge checklist.',
    icon: 'flash-outline',
    color: '#F59E0B',
    unlocked: true,
  },
  {
    id: '4',
    name: 'Green Driver',
    description: 'Recognizes drivers who consistently share routes and minimize empty car travel.',
    howToEarn: 'Create and complete 3 car share offers with at least 1 passenger each.',
    icon: 'car-outline',
    color: '#14B8A6',
    unlocked: false,
  },
  {
    id: '5',
    name: 'Eco Community Leader',
    description: 'Awarded to champions who organize environmental events and bring groups together.',
    howToEarn: 'Host 3 public community cleaning or climate awareness events.',
    icon: 'people-outline',
    color: '#8B5CF6',
    unlocked: false,
  },
  {
    id: '6',
    name: 'Tree Planter',
    description: 'Symbol of reforestation support and direct biodiversity enhancement.',
    howToEarn: 'Successfully participate in or log a planting action.',
    icon: 'flower-outline',
    color: '#EC4899',
    unlocked: false,
  },
];

export default function BadgesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const unlockedCount = mockBadges.filter((b) => b.unlocked).length;

  const renderBadgeItem = ({ item }: { item: Badge }) => {
    return (
      <TouchableOpacity
        style={[styles.badgeCard, !item.unlocked && styles.badgeCardLocked]}
        onPress={() => setSelectedBadge(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBg, { backgroundColor: item.unlocked ? item.color + '15' : '#E5E7EB' }]}>
          <Ionicons
            name={item.icon as any}
            size={32}
            color={item.unlocked ? item.color : AppColors.textMedium}
          />
          {!item.unlocked && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={10} color="white" />
            </View>
          )}
        </View>
        <Text style={styles.badgeName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.badgeStatusText, { color: item.unlocked ? item.color : AppColors.textLight }]}>
          {item.unlocked ? 'UNLOCKED' : 'LOCKED'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impact Badges</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryCount}>{unlockedCount}</Text>
        <Text style={styles.summaryLabel}>Badges Earned</Text>
        <Text style={styles.summarySubtitle}>Keep taking green actions to unlock more badges!</Text>
      </View>

      <FlatList
        data={mockBadges}
        renderItem={renderBadgeItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
      />

      {/* Badge Details Modal */}
      {selectedBadge && (
        <Modal
          visible={!!selectedBadge}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedBadge(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedBadge(null)}>
                <Ionicons name="close" size={20} color={AppColors.textDark} />
              </TouchableOpacity>

              <View style={[styles.modalIconBg, { backgroundColor: selectedBadge.unlocked ? selectedBadge.color + '15' : '#F3F4F6' }]}>
                <Ionicons
                  name={selectedBadge.icon as any}
                  size={48}
                  color={selectedBadge.unlocked ? selectedBadge.color : AppColors.textMedium}
                />
              </View>

              <Text style={styles.modalName}>{selectedBadge.name}</Text>
              
              <View style={[styles.modalStatusBadge, { backgroundColor: selectedBadge.unlocked ? '#D1FAE5' : '#F3F4F6' }]}>
                <Text style={[styles.modalStatusText, { color: selectedBadge.unlocked ? '#065F46' : AppColors.textMedium }]}>
                  {selectedBadge.unlocked ? 'Unlocked Badge' : 'Locked Badge'}
                </Text>
              </View>

              <Text style={styles.modalDesc}>{selectedBadge.description}</Text>

              <View style={styles.requirementBox}>
                <Text style={styles.requirementTitle}>How to earn:</Text>
                <Text style={styles.requirementText}>{selectedBadge.howToEarn}</Text>
              </View>
            </View>
          </View>
        </Modal>
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
  summaryCard: {
    backgroundColor: 'white',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryCount: {
    fontSize: 36,
    fontWeight: '900',
    color: AppColors.primary,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginTop: 2,
  },
  summarySubtitle: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 6,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 12,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  badgeCardLocked: {
    opacity: 0.75,
  },
  iconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  lockBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: AppColors.textMedium,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  badgeName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  badgeStatusText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  modalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
    textAlign: 'center',
  },
  modalStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  modalStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  modalDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: 16,
  },
  requirementBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requirementTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: AppColors.textMedium,
    lineHeight: 16,
  },
});
