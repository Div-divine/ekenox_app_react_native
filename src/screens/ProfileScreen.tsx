import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';
import { UrlHelper } from '../utils/urlHelper';

const { width } = Dimensions.get('window');

const resolveUrl = (url?: string) => UrlHelper.convertPathToUrl(url);

export default function ProfileScreen() {
  const { user, refreshProfile, logout } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (e: any) {
      console.warn('Failed to refresh user profile data:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  useEffect(() => {
    // Refresh user details on screen mount
    onRefresh();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Ekenox?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await logout();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Logout failed.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Calculate XP Percentage
  const xpProgress = user.maxXp > 0 ? Math.min(user.xp / user.maxXp, 1) : 0;

  // Check connected social accounts
  const isGoogleConnected = user.socialAccounts?.some(sa => sa.provider.toLowerCase() === 'google');
  const isAppleConnected = user.socialAccounts?.some(sa => sa.provider.toLowerCase() === 'apple');

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />
        }
      >
        {/* ── Header Cover & Avatar ── */}
        <View style={styles.headerContainer}>
          {user.coverImageUrl ? (
            <Image source={{ uri: resolveUrl(user.coverImageUrl) }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}

          {/* Floating Back Button */}
          <TouchableOpacity
            style={[styles.floatingBackBtn, { top: insets.top + 10 }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>

          {/* Profile Details Overlay Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              {user.profileImage ? (
                <Image source={{ uri: resolveUrl(user.profileImage) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarPlaceholderText}>
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {user.isOnline && <View style={styles.onlineBadge} />}
            </View>

            <Text style={styles.fullName}>{user.fullName || 'Ekenox User'}</Text>
            <Text style={styles.email}>{user.email}</Text>

            {user.location && (
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={14} color={AppColors.textMedium} />
                <Text style={styles.locationText}>{user.location}</Text>
              </View>
            )}

            {user.website && (
              <TouchableOpacity
                style={styles.websiteContainer}
                onPress={() => Linking.openURL(user.website!.startsWith('http') ? user.website! : `https://${user.website}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="globe-outline" size={14} color={AppColors.primary} />
                <Text style={styles.websiteText}>{user.website}</Text>
              </TouchableOpacity>
            )}

            {user.birth_date && (
              <View style={styles.birthDateContainer}>
                <Ionicons name="calendar-outline" size={14} color={AppColors.textMedium} />
                <Text style={styles.birthDateText}>Born: {new Date(user.birth_date).toLocaleDateString()}</Text>
              </View>
            )}

            {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

            {/* Level & XP bar */}
            <View style={styles.xpCard}>
              <View style={styles.xpHeader}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lvl {user.level}</Text>
                </View>
                <Text style={styles.xpText}>{user.xp} / {user.maxXp} XP</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${xpProgress * 100}%` }]} />
              </View>
            </View>

            {/* Admin Dashboard Button */}
            {(user.roles.includes('ROLE_ADMIN') || user.roles.includes('ROLE_SUPER_ADMIN')) && (
              <TouchableOpacity
                style={styles.adminDashboardBtn}
                onPress={() => navigation.navigate('AdminDashboard')}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark" size={18} color="white" />
                <Text style={styles.adminDashboardBtnText}>Admin Dashboard</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Key Stats Counters Grid ── */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="leaf-outline" size={20} color={AppColors.primary} />
              <Text style={styles.statVal}>{user.points}</Text>
              <Text style={styles.statLabel}>Eco Points</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#2563EB" />
              <Text style={styles.statVal}>{user.actionsCount}</Text>
              <Text style={styles.statLabel}>Eco Actions</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="ribbon-outline" size={20} color="#D97706" />
              <Text style={styles.statVal}>{user.badgesCount}</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="people-outline" size={20} color="#7C3AED" />
              <Text style={styles.statVal}>{user.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="person-add-outline" size={20} color="#0D9488" />
              <Text style={styles.statVal}>{user.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="grid-outline" size={20} color="#E11D48" />
              <Text style={styles.statVal}>{user.groupsCount}</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </View>
          </View>
        </View>

        {/* ── Interests Section ── */}
        {user.interests && user.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsWrapper}>
              {user.interests.map((interest, idx) => (
                <View key={idx} style={styles.interestChip}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Badges / Impact Section ── */}
        {user.badges && user.badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Impact Badges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesWrapper}>
              {user.badges.map((badge, idx) => (
                <View key={idx} style={styles.badgeChip}>
                  <Ionicons name="ribbon" size={20} color="#D97706" />
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Connected Social Accounts ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Socials</Text>
          <View style={styles.socialRows}>
            <View style={styles.socialRow}>
              <View style={styles.socialBrand}>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={styles.socialText}>Google Account</Text>
              </View>
              <View style={[styles.statusBadge, isGoogleConnected ? styles.statusConnected : styles.statusDisconnected]}>
                <Text style={[styles.statusText, isGoogleConnected ? styles.statusTextConnected : styles.statusTextDisconnected]}>
                  {isGoogleConnected ? 'Connected' : 'Not Linked'}
                </Text>
              </View>
            </View>

            <View style={styles.socialRow}>
              <View style={styles.socialBrand}>
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text style={styles.socialText}>Apple ID</Text>
              </View>
              <View style={[styles.statusBadge, isAppleConnected ? styles.statusConnected : styles.statusDisconnected]}>
                <Text style={[styles.statusText, isAppleConnected ? styles.statusTextConnected : styles.statusTextDisconnected]}>
                  {isAppleConnected ? 'Connected' : 'Not Linked'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Support Buy Me A Coffee Banner */}
        <TouchableOpacity
          style={styles.coffeeCard}
          onPress={() => Linking.openURL('https://buymeacoffee.com/dosuu')}
          activeOpacity={0.8}
        >
          <View style={styles.coffeeIconBg}>
            <Ionicons name="cafe" size={20} color="#000000" />
          </View>
          <View style={styles.coffeeTextContainer}>
            <Text style={styles.coffeeTitle}>Support Ekenox development</Text>
            <Text style={styles.coffeeSubtitle}>I survive by donations, buy me a coffee! ☕</Text>
          </View>
          <View style={styles.coffeeBadge}>
            <Text style={styles.coffeeBadgeText}>Donate</Text>
            <Ionicons name="heart" size={12} color="#EF4444" style={{ marginLeft: 2 }} />
          </View>
        </TouchableOpacity>

        {/* ── Actions List ── */}
        <View style={[styles.section, { borderBottomWidth: 0 }]}>
          <Text style={styles.sectionTitle}>Account & Settings</Text>
          <View style={styles.actionList}>
            {/* Edit Profile */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('EditProfile')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="create-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.actionLabel}>Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* My Events */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('MyEvents')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#10B981" />
                </View>
                <Text style={styles.actionLabel}>My Events</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Achievements */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('Achievements')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="trophy-outline" size={18} color="#D97706" />
                </View>
                <Text style={styles.actionLabel}>Achievements</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Badges */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('Badges')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="ribbon-outline" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.actionLabel}>Badges</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Saved Items */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('SavedItems')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#FCE7F3' }]}>
                  <Ionicons name="bookmark-outline" size={18} color="#EC4899" />
                </View>
                <Text style={styles.actionLabel}>Saved Items</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Activity History */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('ActivityHistory')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#ECFEFF' }]}>
                  <Ionicons name="time-outline" size={18} color="#06B6D4" />
                </View>
                <Text style={styles.actionLabel}>Activity History</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Notification Preferences */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('NotificationPreferences')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="notifications-outline" size={18} color="#F59E0B" />
                </View>
                <Text style={styles.actionLabel}>Notification Preferences</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Privacy Settings */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('PrivacySettings')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
                </View>
                <Text style={styles.actionLabel}>Privacy Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Account Security */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('AccountSecurity')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#E6F4EA' }]}>
                  <Ionicons name="shield-half-outline" size={18} color="#10B981" />
                </View>
                <Text style={styles.actionLabel}>Account Security</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Preferences */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => navigation.navigate('Settings')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="settings-outline" size={18} color="#0284C7" />
                </View>
                <Text style={styles.actionLabel}>Preferences</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Help & Support */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => Linking.openURL('https://ecoconnect.com/support')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="help-circle-outline" size={18} color="#2563EB" />
                </View>
                <Text style={styles.actionLabel}>Help & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* About */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => Alert.alert('About Ekenox', 'Ekenox Mobile Client\nVersion 1.0.0\nBuilt for environmental sustainability and carbon tracking.')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="information-circle-outline" size={18} color="#1F2937" />
                </View>
                <Text style={styles.actionLabel}>About Ekenox</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {/* Sign Out */}
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={handleLogout}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="log-out-outline" size={18} color={AppColors.error} />
                </View>
                <Text style={[styles.actionLabel, { color: AppColors.error }]}>Sign Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      {loading && (
        <View style={styles.overlayLoading}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    color: AppColors.textMedium,
    fontSize: 14,
  },
  headerContainer: {
    position: 'relative',
    backgroundColor: 'white',
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  coverImage: {
    width: '100%',
    height: 180,
  },
  coverPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: AppColors.primary,
  },
  floatingBackBtn: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  profileCard: {
    alignItems: 'center',
    marginTop: -60,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: 'white',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.primaryLight,
  },
  avatarPlaceholderText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: 'white',
  },
  fullName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  email: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: AppColors.textMedium,
  },
  websiteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  websiteText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
  },
  birthDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  birthDateText: {
    fontSize: 12,
    color: AppColors.textMedium,
  },
  bio: {
    fontSize: 13,
    color: AppColors.textMedium,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
    paddingHorizontal: 15,
  },
  xpCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  xpText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  progressBarBg: {
    height: 6,
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: AppColors.primary,
    borderRadius: 3,
  },
  statsContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: AppColors.textMedium,
    marginTop: 2,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 12,
  },
  interestsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  interestText: {
    fontSize: 11,
    color: AppColors.primary,
    fontWeight: '700',
  },
  badgesWrapper: {
    gap: 10,
    paddingRight: 10,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },
  socialRows: {
    gap: 10,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  socialBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusConnected: {
    backgroundColor: '#D1FAE5',
  },
  statusDisconnected: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusTextConnected: {
    color: '#065F46',
  },
  statusTextDisconnected: {
    color: AppColors.textMedium,
  },
  actionList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  overlayLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  adminDashboardBtn: {
    width: '100%',
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  adminDashboardBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  coffeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFDD00',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  coffeeIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coffeeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  coffeeTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
  },
  coffeeSubtitle: {
    fontSize: 11,
    color: '#374151',
    marginTop: 2,
    fontWeight: '500',
  },
  coffeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  coffeeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
  },
});
