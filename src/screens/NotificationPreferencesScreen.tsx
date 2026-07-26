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

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [challengeEnabled, setChallengeEnabled] = useState(true);
  const [messagesEnabled, setMessagesEnabled] = useState(true);

  // Load preferences from local storage on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem('notification_prefs');
        if (stored) {
          const parsed = JSON.parse(stored);
          setPushEnabled(parsed.push ?? true);
          setEmailEnabled(parsed.email ?? true);
          setDigestEnabled(parsed.digest ?? false);
          setChallengeEnabled(parsed.challenge ?? true);
          setMessagesEnabled(parsed.messages ?? true);
        }
      } catch (e) {
        console.warn('Failed to load notification preferences:', e);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    let newPush = pushEnabled;
    let newEmail = emailEnabled;
    let newDigest = digestEnabled;
    let newChallenge = challengeEnabled;
    let newMessages = messagesEnabled;

    if (key === 'push') {
      setPushEnabled(value);
      newPush = value;
    } else if (key === 'email') {
      setEmailEnabled(value);
      newEmail = value;
    } else if (key === 'digest') {
      setDigestEnabled(value);
      newDigest = value;
    } else if (key === 'challenge') {
      setChallengeEnabled(value);
      newChallenge = value;
    } else if (key === 'messages') {
      setMessagesEnabled(value);
      newMessages = value;
    }

    try {
      const prefs = {
        push: newPush,
        email: newEmail,
        digest: newDigest,
        challenge: newChallenge,
        messages: newMessages,
      };
      await AsyncStorage.setItem('notification_prefs', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save notification preferences:', e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Alert Channels</Text>
            <Text style={styles.sectionSubtitle}>Choose where you want to receive notifications from Ekenox.</Text>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="notifications-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Push Notifications</Text>
                  <Text style={styles.rowDesc}>Instant alerts on your device for likes, comments, and events.</Text>
                </View>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={(val) => handleToggle('push', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={pushEnabled ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="mail-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Email Notifications</Text>
                  <Text style={styles.rowDesc}>Important updates sent directly to your inbox.</Text>
                </View>
              </View>
              <Switch
                value={emailEnabled}
                onValueChange={(val) => handleToggle('email', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={emailEnabled ? AppColors.primary : '#F3F4F6'}
              />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Eco Initiatives Updates</Text>
            <Text style={styles.sectionSubtitle}>Configure updates regarding actions, events, and streaks.</Text>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="newspaper-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Weekly Eco Digest</Text>
                  <Text style={styles.rowDesc}>Weekly statistics reporting carbon saved and community news.</Text>
                </View>
              </View>
              <Switch
                value={digestEnabled}
                onValueChange={(val) => handleToggle('digest', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={digestEnabled ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="trophy-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Eco Challenges</Text>
                  <Text style={styles.rowDesc}>Get notified about new community challenges and active streaks.</Text>
                </View>
              </View>
              <Switch
                value={challengeEnabled}
                onValueChange={(val) => handleToggle('challenge', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={challengeEnabled ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="chatbubbles-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Direct Messages</Text>
                  <Text style={styles.rowDesc}>Alerts for direct chat message invitations from followers.</Text>
                </View>
              </View>
              <Switch
                value={messagesEnabled}
                onValueChange={(val) => handleToggle('messages', val)}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={messagesEnabled ? AppColors.primary : '#F3F4F6'}
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
