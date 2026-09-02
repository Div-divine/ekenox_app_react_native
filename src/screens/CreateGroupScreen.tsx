import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import feedService from '../services/feedService';
import { AppColors } from '../theme/colors';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PrivacyLevel = 'public' | 'private';
type MediaFile = { uri: string; type: string; name: string };

interface CreateGroupScreenProps {
  navigation: any;
  onGroupCreated?: () => void;
}

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ navigation, onGroupCreated }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('public');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [rules, setRules] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);
  const [requirePostApproval, setRequirePostApproval] = useState(false);
  const [allowMemberInvites, setAllowMemberInvites] = useState(true);

  const [coverImage, setCoverImage] = useState<MediaFile | null>(null);
  const [profileImage, setProfileImage] = useState<MediaFile | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const pickImage = async (type: 'cover' | 'profile') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: type === 'cover' ? [16, 9] : [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const file: MediaFile = {
        uri: asset.uri,
        type: 'image/jpeg',
        name: asset.fileName || `${type}_${Date.now()}.jpg`,
      };
      if (type === 'cover') setCoverImage(file);
      else setProfileImage(file);
    }
  };

  const canCreate = () => name.trim().length >= 3 && description.trim().length >= 10;

  const handleCreate = async () => {
    if (!canCreate() || submitting) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const result = await feedService.createGroup({
        name: name.trim(),
        description: description.trim(),
        privacyLevel,
        category: category.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        rules: rules.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
        allowMemberPosts,
        requirePostApproval,
        allowMemberInvites,
        coverImage: coverImage || null,
        profileImage: profileImage || null,
      });

      if (result.success) {
        Alert.alert('Group Created! ðŸŽ‰', `"${name}" has been created successfully.`, [
          {
            text: 'OK',
            onPress: () => {
              onGroupCreated?.();
              navigation.goBack();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to create group. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Group</Text>
        <TouchableOpacity
          style={[styles.createBtn, !canCreate() && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canCreate() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Cover image */}
          <TouchableOpacity style={styles.coverImageContainer} onPress={() => pickImage('cover')}>
            {coverImage ? (
              <Image source={{ uri: coverImage.uri }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverImagePlaceholder}>
                <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.8)" />
                <Text style={styles.coverImagePlaceholderText}>Tap to add cover image</Text>
              </View>
            )}
            <View style={styles.coverEditOverlay}>
              <Ionicons name="camera" size={18} color="white" />
            </View>
          </TouchableOpacity>

          {/* Profile image floating on cover */}
          <View style={styles.profileImageWrapper}>
            <TouchableOpacity style={styles.profileImageContainer} onPress={() => pickImage('profile')}>
              {profileImage ? (
                <Image source={{ uri: profileImage.uri }} style={styles.profileImage} resizeMode="cover" />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="people" size={32} color={AppColors.primary} />
                </View>
              )}
              <View style={styles.profileEditBadge}>
                <Ionicons name="camera" size={12} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.formContent}>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Group Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Eco Warriors Paris"
                placeholderTextColor={AppColors.textLight}
                value={name}
                onChangeText={setName}
                maxLength={80}
              />
              <Text style={styles.fieldHint}>{name.length}/80 â€” Min. 3 characters</Text>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[styles.fieldInput, styles.textArea]}
                placeholder="Describe your group, its purpose and who should join..."
                placeholderTextColor={AppColors.textLight}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.fieldHint}>{description.length}/500 â€” Min. 10 characters</Text>
            </View>

            {/* Privacy */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Privacy</Text>
              <View style={styles.privacyToggle}>
                <TouchableOpacity
                  style={[styles.privacyBtn, privacyLevel === 'public' && styles.privacyBtnActive]}
                  onPress={() => setPrivacyLevel('public')}
                >
                  <Ionicons
                    name="globe-outline"
                    size={16}
                    color={privacyLevel === 'public' ? 'white' : AppColors.primary}
                  />
                  <Text style={[styles.privacyBtnText, privacyLevel === 'public' && styles.privacyBtnTextActive]}>
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.privacyBtn, privacyLevel === 'private' && styles.privacyBtnActive]}
                  onPress={() => setPrivacyLevel('private')}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={privacyLevel === 'private' ? 'white' : AppColors.primary}
                  />
                  <Text style={[styles.privacyBtnText, privacyLevel === 'private' && styles.privacyBtnTextActive]}>
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.privacyHint}>
                {privacyLevel === 'public'
                  ? 'Anyone can find and join this group.'
                  : 'Only people you approve can join.'}
              </Text>
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Climate Action, Recycling, Urban Farming..."
                placeholderTextColor={AppColors.textLight}
                value={category}
                onChangeText={setCategory}
                maxLength={60}
              />
            </View>

            {/* Tags */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tags (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="eco, green, sustainability (comma separated)"
                placeholderTextColor={AppColors.textLight}
                value={tagsInput}
                onChangeText={setTagsInput}
                maxLength={200}
              />
            </View>

            {/* Location */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Location (optional)</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="location-outline" size={18} color={AppColors.textMedium} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="City, Country"
                  placeholderTextColor={AppColors.textLight}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={100}
                />
              </View>
            </View>

            {/* Website */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Website (optional)</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="link-outline" size={18} color={AppColors.textMedium} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="https://yoursite.com"
                  placeholderTextColor={AppColors.textLight}
                  value={website}
                  onChangeText={setWebsite}
                  keyboardType="url"
                  autoCapitalize="none"
                  maxLength={200}
                />
              </View>
            </View>

            {/* Group rules */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Group Rules (optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.textArea]}
                placeholder="List the rules members should follow..."
                placeholderTextColor={AppColors.textLight}
                value={rules}
                onChangeText={setRules}
                multiline
                textAlignVertical="top"
                maxLength={1000}
              />
            </View>

            {/* Settings */}
            <View style={styles.settingsCard}>
              <Text style={styles.settingsSectionTitle}>Member Settings</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="create-outline" size={18} color={AppColors.primary} />
                  <View>
                    <Text style={styles.settingLabel}>Members can post</Text>
                    <Text style={styles.settingHint}>Allow members to create posts</Text>
                  </View>
                </View>
                <Switch
                  value={allowMemberPosts}
                  onValueChange={setAllowMemberPosts}
                  thumbColor={allowMemberPosts ? AppColors.primary : '#f4f3f4'}
                  trackColor={{ false: '#ddd', true: AppColors.primaryLight }}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={AppColors.primary} />
                  <View>
                    <Text style={styles.settingLabel}>Require post approval</Text>
                    <Text style={styles.settingHint}>Review posts before they're visible</Text>
                  </View>
                </View>
                <Switch
                  value={requirePostApproval}
                  onValueChange={setRequirePostApproval}
                  thumbColor={requirePostApproval ? AppColors.primary : '#f4f3f4'}
                  trackColor={{ false: '#ddd', true: AppColors.primaryLight }}
                />
              </View>

              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="person-add-outline" size={18} color={AppColors.primary} />
                  <View>
                    <Text style={styles.settingLabel}>Members can invite</Text>
                    <Text style={styles.settingHint}>Let members invite others</Text>
                  </View>
                </View>
                <Switch
                  value={allowMemberInvites}
                  onValueChange={setAllowMemberInvites}
                  thumbColor={allowMemberInvites ? AppColors.primary : '#f4f3f4'}
                  trackColor={{ false: '#ddd', true: AppColors.primaryLight }}
                />
              </View>
            </View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  createBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  createBtnDisabled: {
    backgroundColor: '#BDBDBD',
  },
  createBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },

  // Cover
  coverImageContainer: {
    height: 160,
    backgroundColor: '#C8E6C9',
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    gap: 8,
  },
  coverImagePlaceholderText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  coverEditOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Profile image
  profileImageWrapper: {
    alignItems: 'flex-start',
    paddingLeft: 20,
    marginTop: -42,
    marginBottom: 8,
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'white',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E8F5E9',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  profileEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: AppColors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
  },

  // Form
  formContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: AppColors.textDark,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 12,
  },
  fieldHint: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 4,
    marginLeft: 2,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  iconInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: AppColors.textDark,
  },

  // Privacy toggle
  privacyToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0FAF5',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  privacyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  privacyBtnActive: {
    backgroundColor: AppColors.primary,
  },
  privacyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
  privacyBtnTextActive: {
    color: 'white',
  },
  privacyHint: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 6,
    marginLeft: 2,
  },

  // Settings card
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  settingsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  settingHint: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 1,
  },
});

export default CreateGroupScreen;
