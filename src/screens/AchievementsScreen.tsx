import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface Achievement {
  id: string;
  title: string;
  description: string;
  progress: number; // 0 to 1
  points: number;
  unlocked: boolean;
  icon: string;
  categoryColor: string;
}

const mockAchievements: Achievement[] = [
  {
    id: '1',
    title: 'Green Commuter',
    description: 'Log 5 car share trips in Ekenox.',
    progress: 1.0,
    points: 150,
    unlocked: true,
    icon: 'car-sport',
    categoryColor: '#10B981',
  },
  {
    id: '2',
    title: 'Recycling Ambassador',
    description: 'Participate in 3 recycling activities.',
    progress: 1.0,
    points: 100,
    unlocked: true,
    icon: 'trash',
    categoryColor: '#3B82F6',
  },
  {
    id: '3',
    title: 'Streak Starter',
    description: 'Open Ekenox app 5 days in a row.',
    progress: 0.8,
    points: 50,
    unlocked: false,
    icon: 'flame',
    categoryColor: '#F59E0B',
  },
  {
    id: '4',
    title: 'Eco Organizer',
    description: 'Create an environmental event that attracts > 10 attendees.',
    progress: 0.3,
    points: 300,
    unlocked: false,
    icon: 'calendar',
    categoryColor: '#7C3AED',
  },
  {
    id: '5',
    title: 'Climate Advocate',
    description: 'Post 10 eco actions on the feed.',
    progress: 0.6,
    points: 200,
    unlocked: false,
    icon: 'megaphone',
    categoryColor: '#EF4444',
  },
  {
    id: '6',
    title: 'Forest Guardian',
    description: 'Plant or register a tree creation activity.',
    progress: 0.0,
    points: 500,
    unlocked: false,
    icon: 'leaf',
    categoryColor: '#0D9488',
  },
];

export default function AchievementsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const totalPoints = user?.points ?? 0;
  const level = user?.level ?? 1;
  const unlockedCount = mockAchievements.filter((a) => a.unlocked).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Level Stats Overview Widget */}
        <View style={styles.cardHeader}>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={24} color="#EF4444" />
            <Text style={styles.streakText}>5 Day Streak!</Text>
          </View>

          <View style={styles.pointsGrid}>
            <View style={styles.pointsBox}>
              <Text style={styles.pointsVal}>{totalPoints}</Text>
              <Text style={styles.pointsLabel}>Total Points</Text>
            </View>
            <View style={styles.pointsDivider} />
            <View style={styles.pointsBox}>
              <Text style={styles.pointsVal}>Lvl {level}</Text>
              <Text style={styles.pointsLabel}>Current Level</Text>
            </View>
            <View style={styles.pointsDivider} />
            <View style={styles.pointsBox}>
              <Text style={styles.pointsVal}>{unlockedCount}/{mockAchievements.length}</Text>
              <Text style={styles.pointsLabel}>Unlocked</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ecosystem Milestones</Text>

        {/* Achievements List */}
        <View style={styles.listContainer}>
          {mockAchievements.map((item) => {
            const percent = Math.round(item.progress * 100);
            return (
              <View key={item.id} style={[styles.itemCard, !item.unlocked && styles.itemCardLocked]}>
                <View style={[styles.iconBg, { backgroundColor: item.unlocked ? item.categoryColor + '20' : '#E5E7EB' }]}>
                  <Ionicons
                    name={item.unlocked ? (item.icon as any) : 'lock-closed'}
                    size={22}
                    color={item.unlocked ? item.categoryColor : AppColors.textMedium}
                  />
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={[styles.itemPoints, { color: item.unlocked ? '#10B981' : AppColors.textMedium }]}>
                      +{item.points} XP
                    </Text>
                  </View>
                  <Text style={styles.itemDesc}>{item.description}</Text>

                  {/* Progress bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${percent}%`,
                            backgroundColor: item.unlocked ? '#10B981' : item.categoryColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{percent}%</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  cardHeader: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
  },
  streakText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  pointsGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsBox: {
    flex: 1,
    alignItems: 'center',
  },
  pointsVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  pointsLabel: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
    fontWeight: '500',
  },
  pointsDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
    marginTop: 24,
    marginBottom: 12,
  },
  listContainer: {
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  itemCardLocked: {
    opacity: 0.85,
  },
  iconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemDetails: {
    flex: 1,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  itemPoints: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemDesc: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 4,
    lineHeight: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textMedium,
    width: 30,
    textAlign: 'right',
  },
});
