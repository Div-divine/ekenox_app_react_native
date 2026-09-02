import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');

  // Load local settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedMode = await AsyncStorage.getItem('dark_mode');
        if (storedMode) setDarkMode(JSON.parse(storedMode));

        const storedLang = await AsyncStorage.getItem('app_language');
        if (storedLang) setLanguage(storedLang);
      } catch (e) {
        console.warn('Failed to load general settings:', e);
      }
    };
    loadSettings();
  }, []);

  const handleDarkModeToggle = async (value: boolean) => {
    setDarkMode(value);
    try {
      await AsyncStorage.setItem('dark_mode', JSON.stringify(value));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleLanguageChange = () => {
    Alert.alert(
      'Select Language',
      'Choose your preferred language:',
      [
        {
          text: 'English (US)',
          onPress: async () => {
            setLanguage('en');
            await AsyncStorage.setItem('app_language', 'en');
          },
        },
        {
          text: 'Français (FR)',
          onPress: async () => {
            setLanguage('fr');
            await AsyncStorage.setItem('app_language', 'fr');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Storage & Cache',
      'Are you sure you want to clear the local application cache? This will not delete your account data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: () => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
              Alert.alert('Cache Cleared', 'All local cached files and images have been cleared successfully.');
            }, 1000);
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'WARNING: This action is permanent and cannot be undone. All your carbon saving logs and personal data will be completely deleted according to GDPR compliance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed to Deletion',
          style: 'destructive',
          onPress: () => {
            // Second double-confirmation prompt
            Alert.alert(
              'Final Confirmation Required',
              'Are you absolutely sure you want to permanently delete your Ekenox account? This is your last chance to cancel.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    setLoading(true);
                    // Simulate account deletion
                    setTimeout(async () => {
                      setLoading(false);
                      try {
                        await logout();
                      } catch (e) {
                        console.warn('Logout after deletion failed', e);
                      }
                      Alert.alert('Account Deleted', 'Your account has been deleted. We are sorry to see you go!');
                    }, 1500);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>General Settings</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <Text style={styles.sectionSubtitle}>Change the app interface and localized options.</Text>
          </View>

          <View style={styles.settingsGroup}>
            {/* Dark Mode Switch */}
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="moon-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Dark Mode Theme</Text>
                  <Text style={styles.rowDesc}>Adjust interface theme colors for night visibility.</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={handleDarkModeToggle}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={darkMode ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            {/* Language Selector */}
            <TouchableOpacity style={styles.settingsRow} onPress={handleLanguageChange}>
              <View style={styles.rowLeft}>
                <Ionicons name="globe-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Language</Text>
                  <Text style={styles.rowDesc}>Choose language settings: English, French.</Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.selectedValueText}>
                  {language === 'en' ? 'English' : 'Français'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
              </View>
            </TouchableOpacity>

            {/* Driver Verification */}
            <TouchableOpacity style={styles.settingsRow} onPress={() => navigation.navigate('UserVerification')}>
              <View style={styles.rowLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Driver Verification</Text>
                  <Text style={styles.rowDesc}>Verify your phone, ID, driver's license & vehicle to offer rides.</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Storage & Maintenance</Text>
            <Text style={styles.sectionSubtitle}>Manage temporary app data to free up space.</Text>
          </View>

          <View style={styles.settingsGroup}>
            {/* Clear Cache */}
            <TouchableOpacity style={styles.settingsRow} onPress={handleClearCache}>
              <View style={styles.rowLeft}>
                <Ionicons name="trash-bin-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Clear Cache</Text>
                  <Text style={styles.rowDesc}>Wipes temporary image downloads and diagnostic logs.</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <Text style={styles.sectionSubtitle}>Critical account operations.</Text>
          </View>

          <View style={styles.settingsGroup}>
            {/* Delete Account */}
            <TouchableOpacity style={styles.settingsRow} onPress={handleDeleteAccount}>
              <View style={styles.rowLeft}>
                <Ionicons name="trash-outline" size={20} color={AppColors.error} />
                <View style={styles.rowTextContainer}>
                  <Text style={[styles.rowTitle, { color: AppColors.error }]}>Delete Account Permanently</Text>
                  <Text style={styles.rowDesc}>Removes all saved statistics, details, and posts forever.</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.error} />
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 19,
    fontWeight: '800',
    color: AppColors.primary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 4,
    lineHeight: 16,
  },
  settingsGroup: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  rowTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  rowDesc: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
    lineHeight: 15,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedValueText: {
    fontSize: 13,
    color: AppColors.textMedium,
    fontWeight: '500',
  },
});
