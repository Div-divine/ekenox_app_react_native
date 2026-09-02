import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';

const PRIVACY_URL = `${ApiConfig.apiUrl}/settings/privacy`;

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Original Privacy Preferences State
  const [privateAccount, setPrivateAccount] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [searchableEmail, setSearchableEmail] = useState(true);

  // New Message & Communication Settings State
  const [whoCanMessage, setWhoCanMessage] = useState<'EVERYONE' | 'MUTUAL_ONLY' | 'NO_ONE'>('EVERYONE');
  const [whoCanCall, setWhoCanCall] = useState<'EVERYONE' | 'MUTUAL_ONLY' | 'NO_ONE'>('EVERYONE');
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  // Options Modal State
  const [activePickerField, setActivePickerField] = useState<'whoCanMessage' | 'whoCanCall' | null>(null);

  const getHeaders = async () => {
    const token = await AsyncStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Load preferences from Symfony Backend & local storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 1. Fetch backend privacy & message settings
        const headers = await getHeaders();
        const res = await axios.get(PRIVACY_URL, { headers, timeout: 10000 });
        if (res.status === 200 && res.data) {
          const data = res.data;
          setWhoCanMessage(data.whoCanMessage || 'EVERYONE');
          setWhoCanCall(data.whoCanCall || 'EVERYONE');
          setShowLastSeen(data.showLastSeen ?? true);
          setShowOnlineStatus(data.showOnlineStatus ?? true);
        }
      } catch (e: any) {
        console.warn('Backend privacy settings load failed, using local storage fallback:', e.message);
      } finally {
        // 2. Load original & local privacy preferences from AsyncStorage
        try {
          const stored = await AsyncStorage.getItem('privacy_prefs');
          if (stored) {
            const parsed = JSON.parse(stored);
            setPrivateAccount(parsed.privateAccount ?? false);
            setReadReceipts(parsed.readReceipts ?? true);
            setShareLocation(parsed.shareLocation ?? true);
            setSearchableEmail(parsed.searchableEmail ?? true);
          }
        } catch (_) {}
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveLocalPrefs = async (updates: Partial<{
    privateAccount: boolean;
    readReceipts: boolean;
    shareLocation: boolean;
    searchableEmail: boolean;
  }>) => {
    try {
      const prefs = {
        privateAccount: updates.privateAccount ?? privateAccount,
        readReceipts: updates.readReceipts ?? readReceipts,
        shareLocation: updates.shareLocation ?? shareLocation,
        searchableEmail: updates.searchableEmail ?? searchableEmail,
      };
      await AsyncStorage.setItem('privacy_prefs', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save local privacy preferences:', e);
    }
  };

  const saveSettingsToBackend = async (updates: Partial<{
    whoCanMessage: string;
    whoCanCall: string;
    showLastSeen: boolean;
    showOnlineStatus: boolean;
  }>) => {
    setSaving(true);
    try {
      const headers = await getHeaders();
      const payload = {
        whoCanMessage: updates.whoCanMessage ?? whoCanMessage,
        whoCanCall: updates.whoCanCall ?? whoCanCall,
        showLastSeen: updates.showLastSeen ?? showLastSeen,
        showOnlineStatus: updates.showOnlineStatus ?? showOnlineStatus,
      };
      await axios.post(PRIVACY_URL, payload, { headers, timeout: 10000 });
    } catch (e: any) {
      console.error('Failed to update privacy settings on backend:', e.message);
      Alert.alert('Notice', 'Failed to sync message settings with server.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectOption = (value: 'EVERYONE' | 'MUTUAL_ONLY' | 'NO_ONE') => {
    if (activePickerField === 'whoCanMessage') {
      setWhoCanMessage(value);
      saveSettingsToBackend({ whoCanMessage: value });
    } else if (activePickerField === 'whoCanCall') {
      setWhoCanCall(value);
      saveSettingsToBackend({ whoCanCall: value });
    }
    setActivePickerField(null);
  };

  const getOptionLabel = (val: string) => {
    switch (val) {
      case 'EVERYONE': return 'Everyone';
      case 'MUTUAL_ONLY': return 'Mutual Followers Only';
      case 'NO_ONE': return 'No One';
      default: return 'Everyone';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Message Settings</Text>
        <View style={styles.headerBtn}>
          {saving && <ActivityIndicator size="small" color={AppColors.primary} />}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Section 1: Account Privacy (Original) */}
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
                onValueChange={(val) => {
                  setPrivateAccount(val);
                  saveLocalPrefs({ privateAccount: val });
                }}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={privateAccount ? AppColors.primary : '#F3F4F6'}
              />
            </View>
          </View>

          {/* Section 2: Communication & Call Permissions (New Message Settings) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Message & Call Permissions</Text>
            <Text style={styles.sectionSubtitle}>Control who can start direct chats or place calls to you.</Text>
          </View>

          <View style={styles.settingsGroup}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setActivePickerField('whoCanMessage')}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="chatbubbles-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Who can message me</Text>
                  <Text style={styles.rowDesc}>Restrict direct message requests</Text>
                </View>
              </View>
              <View style={styles.pickerValueRow}>
                <Text style={styles.pickerValueText}>{getOptionLabel(whoCanMessage)}</Text>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setActivePickerField('whoCanCall')}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="call-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Who can call me</Text>
                  <Text style={styles.rowDesc}>Control incoming audio & video call permissions</Text>
                </View>
              </View>
              <View style={styles.pickerValueRow}>
                <Text style={styles.pickerValueText}>{getOptionLabel(whoCanCall)}</Text>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Section 3: Presence & Online Status (New Message Settings) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Presence & Online Status</Text>
            <Text style={styles.sectionSubtitle}>Manage online visibility and last seen timestamps.</Text>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="ellipse" size={16} color="#10B981" />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Show Online Status</Text>
                  <Text style={styles.rowDesc}>Let your contacts see when you are active on Ekenox.</Text>
                </View>
              </View>
              <Switch
                value={showOnlineStatus}
                onValueChange={(val) => {
                  setShowOnlineStatus(val);
                  saveSettingsToBackend({ showOnlineStatus: val });
                }}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={showOnlineStatus ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <Ionicons name="time-outline" size={20} color={AppColors.primary} />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Show Last Seen</Text>
                  <Text style={styles.rowDesc}>Display timestamp of your last active session.</Text>
                </View>
              </View>
              <Switch
                value={showLastSeen}
                onValueChange={(val) => {
                  setShowLastSeen(val);
                  saveSettingsToBackend({ showLastSeen: val });
                }}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={showLastSeen ? AppColors.primary : '#F3F4F6'}
              />
            </View>
          </View>

          {/* Section 4: Visibility & Sharing (Original Settings) */}
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
                onValueChange={(val) => {
                  setShareLocation(val);
                  saveLocalPrefs({ shareLocation: val });
                }}
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
                onValueChange={(val) => {
                  setSearchableEmail(val);
                  saveLocalPrefs({ searchableEmail: val });
                }}
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
                onValueChange={(val) => {
                  setReadReceipts(val);
                  saveLocalPrefs({ readReceipts: val });
                }}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={readReceipts ? AppColors.primary : '#F3F4F6'}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Selector Modal for Options */}
      <Modal
        visible={activePickerField !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePickerField(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePickerField(null)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.dragIndicator} />
            <Text style={styles.modalTitle}>
              {activePickerField === 'whoCanMessage' ? 'Who can message me?' : 'Who can call me?'}
            </Text>

            {[
              { label: 'Everyone', value: 'EVERYONE', desc: 'Any user on Ekenox can start a conversation' },
              { label: 'Mutual Followers Only', value: 'MUTUAL_ONLY', desc: 'Only users you follow back can reach you' },
              { label: 'No One', value: 'NO_ONE', desc: 'Block new direct chat requests completely' },
            ].map((opt) => {
              const isSelected = (activePickerField === 'whoCanMessage' ? whoCanMessage : whoCanCall) === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => handleSelectOption(opt.value as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.desc}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={AppColors.primary} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setActivePickerField(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    fontSize: 17,
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
    marginRight: 12,
  },
  rowTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  rowDesc: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
    lineHeight: 15,
  },
  pickerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickerValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    backgroundColor: '#FAF9FB',
  },
  optionItemSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary + '10',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  optionLabelSelected: {
    color: AppColors.primary,
  },
  optionDesc: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
});
