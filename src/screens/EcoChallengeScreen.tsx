import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface Challenge {
  id: string;
  title: string;
  xpReward: number;
  pointsReward: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  progress: number; // 0 to 1
  totalNeeded: string;
  currentCompleted: string;
  description: string;
  category: 'water' | 'energy' | 'waste' | 'mobility';
}

const MOCK_CHALLENGES: Challenge[] = [
  {
    id: 'c1',
    title: 'No Plastic Shopping Week',
    xpReward: 150,
    pointsReward: 75,
    difficulty: 'Medium',
    progress: 0.6,
    totalNeeded: '5 days',
    currentCompleted: '3 days',
    description: 'Do all your groceries without buying any single-use plastic bags, wrappers, or plastic bottles.',
    category: 'waste',
  },
  {
    id: 'c2',
    title: 'Bike to Work / School',
    xpReward: 100,
    pointsReward: 50,
    difficulty: 'Easy',
    progress: 0.8,
    totalNeeded: '10 km',
    currentCompleted: '8 km',
    description: 'Use your bicycle or walk instead of using your car or motorized vehicles for short commutes.',
    category: 'mobility',
  },
  {
    id: 'c3',
    title: 'Shower Under 5 Minutes',
    xpReward: 80,
    pointsReward: 40,
    difficulty: 'Easy',
    progress: 1.0, // Completed!
    totalNeeded: '3 times',
    currentCompleted: '3 times',
    description: 'Reduce water wastage by taking a quick shower under 5 minutes three times in a row.',
    category: 'water',
  },
  {
    id: 'c4',
    title: 'Unplug Unused Electronics',
    xpReward: 120,
    pointsReward: 60,
    difficulty: 'Easy',
    progress: 0.2,
    totalNeeded: '7 days',
    currentCompleted: '1 day',
    description: 'Unplug chargers, gaming systems, and appliances before going to sleep to combat vampire power draw.',
    category: 'energy',
  },
  {
    id: 'c5',
    title: 'Planted a Tree / Sapling',
    xpReward: 300,
    pointsReward: 150,
    difficulty: 'Hard',
    progress: 0.0,
    totalNeeded: '1 tree',
    currentCompleted: '0 tree',
    description: 'Plant a fruit tree, a flower sapling, or a native plant in your community and take a picture to upload.',
    category: 'water',
  },
];

export const EcoChallengeScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [challenges, setChallenges] = useState<Challenge[]>(MOCK_CHALLENGES);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [streak, setStreak] = useState(5);

  const handleClaim = (item: Challenge) => {
    if (claimedIds.includes(item.id)) return;
    setClaimedIds([...claimedIds, item.id]);
    Alert.alert(
      '🏆 Reward Claimed!',
      `You successfully completed the "${item.title}" challenge!\n\nEarned: +${item.xpReward} XP\nEarned: +${item.pointsReward} Points`,
      [{ text: 'Awesome!', onPress: () => {} }]
    );
  };

  const handleJoinChallenge = (item: Challenge) => {
    Alert.alert(
      'Join Challenge',
      `Would you like to register for the "${item.title}" challenge?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Join now', onPress: () => Alert.alert('Success', `You have joined the "${item.title}" challenge. Let's make an impact!`) },
      ]
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'water': return 'water';
      case 'energy': return 'flash';
      case 'waste': return 'trash-bin';
      case 'mobility': return 'bicycle';
      default: return 'leaf';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'water': return '#2196F3';
      case 'energy': return '#FFC107';
      case 'waste': return '#4CAF50';
      case 'mobility': return '#9C27B0';
      default: return AppColors.primary;
    }
  };

  const renderChallengeCard = ({ item }: { item: Challenge }) => {
    const isCompleted = item.progress >= 1.0;
    const isClaimed = claimedIds.includes(item.id);
    const catColor = getCategoryColor(item.category);
    const catIcon = getCategoryIcon(item.category);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.catIconCircle, { backgroundColor: catColor + '15' }]}>
            <Ionicons name={catIcon as any} size={20} color={catColor} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.rewardBadgeRow}>
              <View style={styles.rewardBadgeXp}>
                <Text style={styles.rewardBadgeXpText}>+{item.xpReward} XP</Text>
              </View>
              <View style={styles.rewardBadgePts}>
                <Text style={styles.rewardBadgePtsText}>+{item.pointsReward} pts</Text>
              </View>
              <Text style={[styles.difficultyText, { color: item.difficulty === 'Hard' ? AppColors.error : item.difficulty === 'Medium' ? '#FF9800' : AppColors.primary }]}>
                {item.difficulty}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.desc}>{item.description}</Text>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressVal}>{item.currentCompleted} / {item.totalNeeded}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${item.progress * 100}%`, backgroundColor: isCompleted ? AppColors.primary : catColor }]} />
          </View>
        </View>

        {isCompleted ? (
          <TouchableOpacity
            style={[styles.actionBtn, isClaimed ? styles.claimedBtn : styles.claimBtn]}
            disabled={isClaimed}
            onPress={() => handleClaim(item)}
          >
            <Ionicons name={isClaimed ? "checkmark-circle" : "trophy"} size={16} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>{isClaimed ? 'Claimed' : 'Claim Rewards'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, item.progress > 0 ? styles.activeBtn : styles.joinBtn]}
            onPress={() => item.progress > 0 ? Alert.alert('Active Challenge', 'Complete the requirements to claim rewards.') : handleJoinChallenge(item)}
          >
            <Ionicons name={item.progress > 0 ? "time-outline" : "play-outline"} size={16} color={item.progress > 0 ? AppColors.primary : '#FFFFFF'} />
            <Text style={item.progress > 0 ? styles.activeBtnText : styles.actionBtnText}>
              {item.progress > 0 ? 'In Progress' : 'Accept Challenge'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header Navbar */}
      <View style={[styles.header, { paddingTop: insets.top, height: 60 + insets.top }]}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Eco Challenges</Text>
        <TouchableOpacity
          style={styles.headerInfoIcon}
          onPress={() => Alert.alert('Eco Challenges', 'Complete green challenges to earn XP, Level up, and accumulate points to redeem rewards. Maintain your streak by logging eco-actions daily!')}
        >
          <Ionicons name="help-circle-outline" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Dynamic Game Dashboard */}
        <View style={styles.dashboardCard}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' }}
            style={styles.dashboardBg}
          />
          <View style={styles.dashboardOverlay} />
          
          <View style={styles.dashboardBody}>
            <View style={styles.dashboardRow}>
              <View style={styles.statsPanel}>
                <Text style={styles.dashboardName}>{user?.fullName || 'Eco Champion'}</Text>
                <View style={styles.levelRow}>
                  <Text style={styles.levelLabel}>Level</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelVal}>{user?.level ?? 1}</Text>
                  </View>
                </View>
              </View>

              {/* Daily Streak */}
              <View style={styles.streakCard}>
                <Ionicons name="flame" size={28} color="#FF9800" />
                <Text style={styles.streakVal}>{streak} Day</Text>
                <Text style={styles.streakLabel}>Streak</Text>
              </View>
            </View>

            {/* EXP Bar */}
            <View style={styles.xpSection}>
              <View style={styles.xpHeader}>
                <Text style={styles.xpLabel}>Total Experience</Text>
                <Text style={styles.xpVal}>{user?.xp ?? 0} / 1200 XP</Text>
              </View>
              <View style={styles.xpBarBg}>
                <View style={[styles.xpBarFill, { width: `${Math.min(((user?.xp ?? 0) / 1200) * 100, 100)}%` }]} />
              </View>
            </View>

            {/* Score Stats */}
            <View style={styles.scoreRow}>
              <View style={styles.scoreBox}>
                <Ionicons name="ribbon-outline" size={20} color="#FFC107" />
                <View>
                  <Text style={styles.scoreValText}>{user?.points ?? 0}</Text>
                  <Text style={styles.scoreLabelText}>Eco Points</Text>
                </View>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreBox}>
                <Ionicons name="leaf-outline" size={20} color="#81C784" />
                <View>
                  <Text style={styles.scoreValText}>2.4 kg</Text>
                  <Text style={styles.scoreLabelText}>CO2 Saved</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active Challenges</Text>
          <TouchableOpacity onPress={() => Alert.alert('Info', 'Earn rewards upon completing challenges!')}>
            <Text style={styles.seeAllText}>Rules</Text>
          </TouchableOpacity>
        </View>

        {/* Challenge list */}
        <FlatList
          data={challenges}
          renderItem={renderChallengeCard}
          keyExtractor={item => item.id}
          scrollEnabled={false} // Nested inside ScrollView
          contentContainerStyle={styles.listContent}
        />
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },
  dashboardCard: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: AppColors.primaryDark,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  dashboardBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  dashboardOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(11, 110, 79, 0.45)',
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
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  levelLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    width: 76,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  streakVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  streakLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
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
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  xpVal: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  xpBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  scoreBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scoreValText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreLabelText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
  },
  scoreDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  seeAllText: {
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '600',
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
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  desc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 12,
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
  claimBtn: {
    backgroundColor: AppColors.accent,
  },
  claimedBtn: {
    backgroundColor: AppColors.primary,
    opacity: 0.8,
  },
  joinBtn: {
    backgroundColor: AppColors.primary,
  },
  activeBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  activeBtnText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '700',
  },
  actionBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
