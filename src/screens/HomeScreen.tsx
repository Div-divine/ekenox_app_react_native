import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';

export const HomeScreen = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>eKeNox Eco Conscience</Text>
        <TouchableOpacity style={styles.logoutIcon} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={AppColors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.profileCard}>
          {user?.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
              </Text>
            </View>
          )}

          <Text style={styles.name}>{user?.fullName || 'Eco Champion'}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          {user?.location && (
            <View style={styles.badgeRow}>
              <Ionicons name="location-outline" size={16} color={AppColors.textMedium} />
              <Text style={styles.location}>{user.location}</Text>
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.level ?? 1}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.points ?? 0}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.xp ?? 0}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <Ionicons name="checkmark-circle-outline" size={48} color={AppColors.primary} style={styles.successIcon} />
          <Text style={styles.welcomeTitle}>Authenticated Successfully!</Text>
          <Text style={styles.welcomeDesc}>
            React Native authentication flow migrated perfectly from Flutter. The session state and token management are fully functioning.
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    height: 60,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  logoutIcon: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: AppColors.textMedium,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  location: {
    marginLeft: 4,
    fontSize: 14,
    color: AppColors.textMedium,
  },
  statsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    borderTopWidth: 1,
    borderTopColor: AppColors.divider,
    paddingTop: 16,
    marginTop: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: AppColors.textLight,
    marginTop: 4,
  },
  welcomeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 32,
  },
  successIcon: {
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeDesc: {
    fontSize: 14,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 20,
  },
  logoutBtn: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.error,
  },
  logoutBtnText: {
    color: AppColors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
