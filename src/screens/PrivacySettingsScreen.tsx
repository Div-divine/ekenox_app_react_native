import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '../theme/colors';

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [searchableEmail, setSearchableEmail] = useState(true);

  // Load preferences from local storage on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem('privacy_prefs');
        if (stored) {
          const parsed = JSON.parse(stored);
          setPrivateAccount(parsed.privateAccount ?? false);
          setReadReceipts(parsed.readReceipts ?? true);
          setShareLocation(parsed.shareLocation ?? true);
          setSearchableEmail(parsed.searchableEmail ?? true);
        }
      } catch (e) {
        console.warn('Failed to load privacy preferences:', e);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    let newPrivateAccount = privateAccount;
    let newReadReceipts = readReceipts;
    let newShareLocation = shareLocation;
    let newSearchableEmail = searchableEmail;

    if (key === 'privateAccount') {
      setPrivateAccount(value);
      newPrivateAccount = value;
    } else if (key === 'readReceipts') {
      setReadReceipts(value);
      newReadReceipts = value;
    } else if (key === 'shareLocation') {
      setShareLocation(value);
      newShareLocation = value;
    } else if (key === 'searchableEmail') {
      setSearchableEmail(value);
      newSearchableEmail = value;
    }

    try {
      const prefs = {
        privateAccount: newPrivateAccount,
        readReceipts: newReadReceipts,
        shareLocation: newShareLocation,
        searchableEmail: newSearchableEmail,
      };
      await AsyncStorage.setItem('privacy_prefs', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save privacy preferences:', e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Privacy</Text>
            <Text style={styles.sectionSubtitle}>Manage who can see your carbon saving statistics and logs.</Text>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="eye-off-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Private Account</Text>
                  <Text style={styles.rowDesc}>Only approved followers can view your bio, stats, and achievements.</Text>
                </View>
              </View>
              <Switch
                value={privateAccount}
                onValueChange={(val) => handleToggle('privateAccount', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={privateAccount ? AppColors.primary : '#F3F4F6'}
              />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Visibility & Sharing</Text>
            <Text style={styles.sectionSubtitle}>Configure map locations and contact information sharing rules.</Text>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="navigate-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Share Location</Text>
                  <Text style={styles.rowDesc}>Allow passengers and drivers to view real-time location during car shares.</Text>
                </View>
              </View>
              <Switch
                value={shareLocation}
                onValueChange={(val) => handleToggle('shareLocation', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={shareLocation ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="search-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Searchable by Email</Text>
                  <Text style={styles.rowDesc}>Allow other eco champions to find your profile using email searches.</Text>
                </View>
              </View>
              <Switch
                value={searchableEmail}
                onValueChange={(val) => handleToggle('searchableEmail', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={searchableEmail ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="checkmark-done-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Read Receipts</Text>
                  <Text style={styles.rowDesc}>Let chat members know when you have read their messages.</Text>
                </View>
              </View>
              <Switch
                value={readReceipts}
                onValueChange={(val) => handleToggle('readReceipts', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={readReceipts ? AppColors.primary : '#F3F4F6'}
              />
            </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
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
});
