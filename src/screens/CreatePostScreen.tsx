import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  FlatList,
  Modal,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import feedService from '../services/feedService';
import { Group } from '../services/feedService';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function resolveMedia(url?: string | null): string {
  if (!url) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80';
  if (url.startsWith('http')) return url;
  return `${ApiConfig.baseUrl}${url}`;
}

type PostType = 'general' | 'poll';
type PrivacyLevel = 'public' | 'friends' | 'private';
type MediaFile = { uri: string; type: 'image' | 'video'; name: string };

interface CreatePostScreenProps {
  navigation: any;
  route?: any;
  onPostCreated?: () => void;
}

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; icon: string }[] = [
  { value: 'public', label: 'Public', icon: 'globe-outline' },
  { value: 'friends', label: 'Friends', icon: 'people-outline' },
  { value: 'private', label: 'Only Me', icon: 'lock-closed-outline' },
];

const CreatePostScreen: React.FC<CreatePostScreenProps> = ({ navigation, route, onPostCreated }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isSubmittedRef = useRef(false);

  const [postType, setPostType] = useState<PostType>('general');
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('public');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  // Poll state
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [pollExpiresAt, setPollExpiresAt] = useState<Date | null>(null);
  const [showPollExpiry, setShowPollExpiry] = useState(false);

  // Group selection
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  // Schedule
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showScheduleDate, setShowScheduleDate] = useState(false);
  const [showScheduleTime, setShowScheduleTime] = useState(false);

  // Privacy picker
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);

  // Drafts management
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | number | null>(null);
  const [loadedMedia, setLoadedMedia] = useState<any[]>([]);
  const [deletedMediaIds, setDeletedMediaIds] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      feedService.getUserGroups(user.id).then(groups => {
        setUserGroups(groups);
        if (route?.params?.group) {
          setSelectedGroup(route.params.group);
        } else if (route?.params?.groupId) {
          const g = groups.find(grp => String(grp.id) === String(route.params.groupId));
          if (g) setSelectedGroup(g);
        }
      });
    }
  }, [user?.id, route?.params]);

  const loadAndShowDrafts = async () => {
    setLoadingDrafts(true);
    setShowDraftsModal(true);
    try {
      const list = await feedService.getDrafts(1, 50);
      setDrafts(list);
    } catch (e) {
      console.error('Error loading drafts:', e);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const handleLoadDraft = (draft: any) => {
    setContent(draft.content || '');
    setPostType(draft.post_type === 'poll' ? 'poll' : 'general');
    setPrivacyLevel((draft.privacy_level as PrivacyLevel) || 'public');
    setLocation(draft.location || '');
    
    if (draft.poll_options) {
      setPollOptions(draft.poll_options);
      setAllowMultipleVotes(!!draft.allow_multiple_votes);
      setPollExpiresAt(draft.poll_expires_at ? new Date(draft.poll_expires_at) : null);
    } else {
      setPollOptions(['', '']);
      setAllowMultipleVotes(false);
      setPollExpiresAt(null);
    }
    
    setMediaFiles([]);
    setLoadedMedia(draft.media || []);
    setDeletedMediaIds([]);
    
    if (draft.group_id) {
      const group = userGroups.find(g => String(g.id) === String(draft.group_id));
      setSelectedGroup(group || null);
    } else {
      setSelectedGroup(null);
    }
    
    setScheduledAt(draft.scheduled_at ? new Date(draft.scheduled_at) : null);
    setEditingDraftId(draft.id);
    setShowDraftsModal(false);
    Alert.alert('Draft Loaded', 'You can now edit or publish this draft.');
  };

  const handleDeleteDraft = async (draftId: string | number) => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await feedService.deleteFeed(draftId);
            if (success) {
              setDrafts(prev => prev.filter(d => d.id !== draftId));
              if (editingDraftId === draftId) {
                setEditingDraftId(null);
                setContent('');
                setPostType('general');
                setMediaFiles([]);
                setLoadedMedia([]);
                setDeletedMediaIds([]);
                setPollOptions(['', '']);
                setAllowMultipleVotes(false);
                setPollExpiresAt(null);
                setSelectedGroup(null);
                setScheduledAt(null);
              }
              Alert.alert('Deleted', 'Draft deleted successfully.');
            } else {
              Alert.alert('Error', 'Failed to delete draft.');
            }
          }
        }
      ]
    );
  };

  const pickMedia = async (type: 'image' | 'video') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: type === 'image',
      quality: 0.85,
    });
    if (!result.canceled) {
      const files: MediaFile[] = result.assets.map(asset => ({
        uri: asset.uri,
        type,
        name: asset.fileName || `${type}_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`,
      }));
      setMediaFiles(prev => [...prev, ...files].slice(0, 5));
    }
  };

  const pickFromCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setMediaFiles(prev => [
        ...prev,
        {
          uri: asset.uri,
          type: (isVideo ? 'video' : 'image') as 'image' | 'video',
          name: asset.fileName || `capture_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        },
      ].slice(0, 5));
    }
  };

  const removeMedia = (idx: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions(prev => [...prev, '']);
    }
  };

  const removePollOption = (idx: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const updatePollOption = (idx: number, text: string) => {
    setPollOptions(prev => prev.map((o, i) => i === idx ? text : o));
  };

  const canPost = (): boolean => {
    if (postType === 'poll') {
      return content.trim().length > 0 && pollOptions.filter(o => o.trim()).length >= 2;
    }
    const activeLoadedMedia = loadedMedia.filter(m => !deletedMediaIds.includes(m.id));
    return content.trim().length > 0 || mediaFiles.length > 0 || activeLoadedMedia.length > 0;
  };

  const handlePost = useCallback(async (saveAsDraft = false) => {
    if (!canPost() && !saveAsDraft) return;
    setSubmitting(true);
    try {
      if (editingDraftId) {
        // 1. Update text content
        const updateSuccess = await feedService.updateFeed(editingDraftId, content.trim() || ' ');
        if (!updateSuccess) {
          Alert.alert('Error', 'Failed to update draft text.');
          setSubmitting(false);
          return;
        }

        // 2. Delete media
        for (const mediaId of deletedMediaIds) {
          await feedService.deleteFeedMedia(editingDraftId, mediaId);
        }

        // 3. Add new media files
        if (mediaFiles.length > 0) {
          const addMediaSuccess = await feedService.addFeedMedia(editingDraftId, mediaFiles);
          if (!addMediaSuccess) {
            Alert.alert('Warning', 'Draft updated, but failed to upload some new media.');
          }
        }

        // 4. Publish if not saving as draft
        if (!saveAsDraft) {
          const publishSuccess = await feedService.publishDraft(editingDraftId, scheduledAt);
          if (publishSuccess) {
            if (scheduledAt) {
              Alert.alert('Scheduled', `Your post has been scheduled for ${scheduledAt.toLocaleString()}`);
            } else {
              Alert.alert('Published!', 'Your draft has been published.');
            }
            onPostCreated?.();
            isSubmittedRef.current = true;
            navigation.goBack();
          } else {
            Alert.alert('Error', 'Failed to publish draft post.');
          }
        } else {
          Alert.alert('Saved', 'Your draft has been updated.');
          isSubmittedRef.current = true;
          navigation.goBack();
        }
      } else {
        // Create new post
        const result = await feedService.createFeedFull({
          content: content.trim() || ' ',
          postType: postType === 'poll' ? 'poll' : 'general',
          isDraft: saveAsDraft,
          scheduledAt,
          location: location.trim() || null,
          mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
          pollOptions: postType === 'poll' ? pollOptions.filter(o => o.trim()) : undefined,
          allowMultipleVotes: postType === 'poll' ? allowMultipleVotes : undefined,
          pollExpiresAt: postType === 'poll' ? pollExpiresAt : undefined,
          groupId: selectedGroup?.id || null,
          privacyLevel,
        });

        if (result.success) {
          if (saveAsDraft) {
            Alert.alert('Saved', 'Your post has been saved as draft.');
          } else if (scheduledAt) {
            Alert.alert('Scheduled', `Your post is scheduled for ${scheduledAt.toLocaleString()}`);
          } else {
            Alert.alert('Posted!', 'Your post has been published.');
          }
          onPostCreated?.();
          isSubmittedRef.current = true;
          navigation.goBack();
        } else {
          Alert.alert('Error', result.message || 'Failed to create post. Please try again.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  }, [
    content,
    postType,
    scheduledAt,
    location,
    mediaFiles,
    pollOptions,
    allowMultipleVotes,
    pollExpiresAt,
    selectedGroup,
    privacyLevel,
    editingDraftId,
    deletedMediaIds,
    loadedMedia,
    onPostCreated,
    navigation,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (isSubmittedRef.current) {
        return;
      }

      const hasContent = content.trim().length > 0;
      const hasMedia = mediaFiles.length > 0 || deletedMediaIds.length > 0;
      const hasPoll = postType === 'poll' && pollOptions.some(o => o.trim().length > 0);
      const hasLocation = location.trim().length > 0;
      const hasScheduled = scheduledAt !== null;

      if (!hasContent && !hasMedia && !hasPoll && !hasLocation && !hasScheduled) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Unsaved Changes',
        'Do you want to save this post as a draft or discard it?',
        [
          {
            text: 'Save Draft',
            onPress: () => {
              handlePost(true);
            },
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {},
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, content, mediaFiles, deletedMediaIds, postType, pollOptions, location, scheduledAt, handlePost]);

  const currentPrivacy = PRIVACY_OPTIONS.find(p => p.value === privacyLevel)!;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity onPress={loadAndShowDrafts} style={[styles.headerBtn, { marginRight: 12 }]}>
          <Ionicons name="folder-open-outline" size={24} color={AppColors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.postBtn, !canPost() && styles.postBtnDisabled]}
          onPress={() => handlePost(false)}
          disabled={!canPost() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.postBtnText}>
              {scheduledAt ? 'Schedule' : 'Post'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Post type toggle */}
          <View style={styles.typeToggleRow}>
            <TouchableOpacity
              style={[styles.typeToggleBtn, postType === 'general' && styles.typeToggleBtnActive]}
              onPress={() => setPostType('general')}
            >
              <Ionicons name="create-outline" size={16} color={postType === 'general' ? 'white' : AppColors.primary} />
              <Text style={[styles.typeToggleText, postType === 'general' && styles.typeToggleTextActive]}>Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeToggleBtn, postType === 'poll' && styles.typeToggleBtnActive]}
              onPress={() => setPostType('poll')}
            >
              <Ionicons name="bar-chart-outline" size={16} color={postType === 'poll' ? 'white' : AppColors.primary} />
              <Text style={[styles.typeToggleText, postType === 'poll' && styles.typeToggleTextActive]}>Poll</Text>
            </TouchableOpacity>
          </View>

          {/* Author header */}
          <View style={styles.authorRow}>
            {user?.profileImage ? (
              <Image source={{ uri: resolveMedia(user.profileImage) }} style={styles.authorAvatar} />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Text style={styles.authorAvatarText}>
                  {user?.fullName?.substring(0, 2).toUpperCase() || 'EC'}
                </Text>
              </View>
            )}
            <View style={styles.authorMeta}>
              <Text style={styles.authorName}>{user?.fullName || 'Eco Champion'}</Text>
              <View style={styles.authorBadgesRow}>
                {/* Privacy selector */}
                <TouchableOpacity
                  style={styles.metaBadge}
                  onPress={() => setShowPrivacyPicker(true)}
                >
                  <Ionicons name={currentPrivacy.icon as any} size={12} color={AppColors.primary} />
                  <Text style={styles.metaBadgeText}>{currentPrivacy.label}</Text>
                  <Ionicons name="chevron-down" size={12} color={AppColors.primary} />
                </TouchableOpacity>

                {/* Group badge */}
                {selectedGroup && (
                  <TouchableOpacity
                    style={styles.metaBadge}
                    onPress={() => setShowGroupPicker(true)}
                  >
                    <Ionicons name="people" size={12} color={AppColors.primary} />
                    <Text style={styles.metaBadgeText} numberOfLines={1}>{selectedGroup.name}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Content input */}
          <TextInput
            style={styles.contentInput}
            placeholder={postType === 'poll' ? "What's your question?" : "Share your eco action, thought, or update..."}
            placeholderTextColor={AppColors.textLight}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          {/* Character count */}
          <Text style={styles.charCount}>{content.length}/2000</Text>

          {/* Media preview */}
          {(mediaFiles.length > 0 || loadedMedia.filter(m => !deletedMediaIds.includes(m.id)).length > 0) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewRow}>
              {loadedMedia.filter(m => !deletedMediaIds.includes(m.id)).map((file) => (
                <View key={`loaded-${file.id}`} style={styles.mediaPreviewItem}>
                  <Image source={{ uri: resolveMedia(file.url) }} style={styles.mediaPreviewImage} resizeMode="cover" />
                  {file.type === 'video' && (
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={30} color="white" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setDeletedMediaIds(prev => [...prev, file.id])}>
                    <Ionicons name="close-circle" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              {mediaFiles.map((file, idx) => (
                <View key={`new-${idx}`} style={styles.mediaPreviewItem}>
                  <Image source={{ uri: file.uri }} style={styles.mediaPreviewImage} resizeMode="cover" />
                  {file.type === 'video' && (
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={30} color="white" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeMedia(idx)}>
                    <Ionicons name="close-circle" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Poll options */}
          {postType === 'poll' && (
            <View style={styles.pollSection}>
              <Text style={styles.sectionLabel}>Poll Options</Text>
              {pollOptions.map((option, idx) => (
                <View key={idx} style={styles.pollOptionRow}>
                  <View style={styles.pollOptionBullet}>
                    <Text style={styles.pollOptionBulletText}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.pollOptionInput}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={AppColors.textLight}
                    value={option}
                    onChangeText={text => updatePollOption(idx, text)}
                    maxLength={100}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity onPress={() => removePollOption(idx)}>
                      <Ionicons name="remove-circle-outline" size={22} color={AppColors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 6 && (
                <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption}>
                  <Ionicons name="add-circle-outline" size={20} color={AppColors.primary} />
                  <Text style={styles.addOptionText}>Add option</Text>
                </TouchableOpacity>
              )}

              <View style={styles.pollSettingsRow}>
                <View style={styles.pollSettingItem}>
                  <Text style={styles.pollSettingLabel}>Allow multiple votes</Text>
                  <Switch
                    value={allowMultipleVotes}
                    onValueChange={setAllowMultipleVotes}
                    thumbColor={allowMultipleVotes ? AppColors.primary : '#f4f3f4'}
                    trackColor={{ false: '#ddd', true: AppColors.primaryLight }}
                  />
                </View>
                <TouchableOpacity
                  style={styles.pollSettingItem}
                  onPress={() => setShowPollExpiry(true)}
                >
                  <Text style={styles.pollSettingLabel}>
                    {pollExpiresAt ? `Expires: ${pollExpiresAt.toLocaleDateString()}` : 'Set expiry date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={AppColors.primary} />
                </TouchableOpacity>
                {pollExpiresAt && (
                  <TouchableOpacity onPress={() => setPollExpiresAt(null)}>
                    <Text style={styles.clearBtn}>Clear expiry</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showPollExpiry && (
                <DateTimePicker
                  value={pollExpiresAt || new Date(Date.now() + 86400000)}
                  mode="datetime"
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    if (Platform.OS === 'android') {
                      setTimeout(() => setShowPollExpiry(false), 100);
                    } else {
                      setShowPollExpiry(false);
                    }
                    if (date) setPollExpiresAt(date);
                  }}
                />
              )}
            </View>
          )}

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={18} color={AppColors.textMedium} />
            <TextInput
              style={styles.locationInput}
              placeholder="Add location (optional)"
              placeholderTextColor={AppColors.textLight}
              value={location}
              onChangeText={setLocation}
              maxLength={120}
            />
            {location.length > 0 && (
              <TouchableOpacity onPress={() => setLocation('')}>
                <Ionicons name="close-circle" size={18} color={AppColors.textLight} />
              </TouchableOpacity>
            )}
          </View>

          {/* Schedule banner */}
          {scheduledAt && (
            <View style={styles.scheduleBanner}>
              <Ionicons name="time-outline" size={16} color={AppColors.primary} />
              <Text style={styles.scheduleBannerText}>Scheduled for {scheduledAt.toLocaleString()}</Text>
              <TouchableOpacity onPress={() => setScheduledAt(null)}>
                <Ionicons name="close-circle" size={18} color={AppColors.textMedium} />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Toolbar */}
        <View style={[styles.toolbar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
          {postType !== 'poll' && (
            <>
              <TouchableOpacity style={styles.toolbarBtn} onPress={() => pickMedia('image')}>
                <Ionicons name="image-outline" size={22} color={AppColors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn} onPress={() => pickMedia('video')}>
                <Ionicons name="videocam-outline" size={22} color={AppColors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn} onPress={pickFromCamera}>
                <Ionicons name="camera-outline" size={22} color={AppColors.primary} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowGroupPicker(true)}>
            <Ionicons name="people-outline" size={22} color={selectedGroup ? AppColors.primary : AppColors.textMedium} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn} onPress={() => {
            setShowScheduleDate(true);
          }}>
            <Ionicons name="time-outline" size={22} color={scheduledAt ? AppColors.primary : AppColors.textMedium} />
          </TouchableOpacity>
          <View style={styles.toolbarSpacer} />
          <TouchableOpacity
            style={styles.draftBtn}
            onPress={() => handlePost(true)}
            disabled={submitting}
          >
            <Text style={styles.draftBtnText}>Save Draft</Text>
          </TouchableOpacity>
        </View>

        {/* Schedule date picker */}
        {showScheduleDate && (
          <DateTimePicker
            value={scheduledAt || new Date()}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, date) => {
              if (Platform.OS === 'android') {
                setTimeout(() => setShowScheduleDate(false), 100);
              } else {
                setShowScheduleDate(false);
              }
              if (date) {
                const d = date;
                setTimeout(() => {
                  setScheduledAt(d);
                  setShowScheduleTime(true);
                }, 200);
              }
            }}
          />
        )}
        {showScheduleTime && (
          <DateTimePicker
            value={scheduledAt || new Date()}
            mode="time"
            onChange={(_, time) => {
              if (Platform.OS === 'android') {
                setTimeout(() => setShowScheduleTime(false), 100);
              } else {
                setShowScheduleTime(false);
              }
              if (time && scheduledAt) {
                const merged = new Date(scheduledAt);
                merged.setHours(time.getHours(), time.getMinutes());
                setScheduledAt(merged);
              }
            }}
          />
        )}
      </KeyboardAvoidingView>

      {/* Privacy Picker Modal */}
      <Modal visible={showPrivacyPicker} transparent animationType="slide" onRequestClose={() => setShowPrivacyPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPrivacyPicker(false)} activeOpacity={1}>
          <View style={styles.privacySheet}>
            <Text style={styles.sheetTitle}>Who can see this post?</Text>
            {PRIVACY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.privacyOption, privacyLevel === opt.value && styles.privacyOptionActive]}
                onPress={() => { setPrivacyLevel(opt.value); setShowPrivacyPicker(false); }}
              >
                <Ionicons name={opt.icon as any} size={20} color={privacyLevel === opt.value ? 'white' : AppColors.primary} />
                <Text style={[styles.privacyOptionText, privacyLevel === opt.value && styles.privacyOptionTextActive]}>
                  {opt.label}
                </Text>
                {privacyLevel === opt.value && <Ionicons name="checkmark" size={18} color="white" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Group Picker Modal */}
      <Modal visible={showGroupPicker} transparent animationType="slide" onRequestClose={() => setShowGroupPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowGroupPicker(false)} activeOpacity={1}>
          <View style={styles.groupSheet}>
            <Text style={styles.sheetTitle}>Post to a Group (optional)</Text>
            <TouchableOpacity
              style={[styles.groupOption, !selectedGroup && styles.groupOptionActive]}
              onPress={() => { setSelectedGroup(null); setShowGroupPicker(false); }}
            >
              <Ionicons name="person-outline" size={20} color={!selectedGroup ? 'white' : AppColors.primary} />
              <Text style={[styles.groupOptionText, !selectedGroup && styles.groupOptionTextActive]}>My Feed</Text>
              {!selectedGroup && <Ionicons name="checkmark" size={18} color="white" />}
            </TouchableOpacity>
            {userGroups.map(group => (
              <TouchableOpacity
                key={group.id}
                style={[styles.groupOption, selectedGroup?.id === group.id && styles.groupOptionActive]}
                onPress={() => { setSelectedGroup(group); setShowGroupPicker(false); }}
              >
                <Ionicons name="people" size={20} color={selectedGroup?.id === group.id ? 'white' : AppColors.primary} />
                <Text style={[styles.groupOptionText, selectedGroup?.id === group.id && styles.groupOptionTextActive]} numberOfLines={1}>
                  {group.name}
                </Text>
                {selectedGroup?.id === group.id && <Ionicons name="checkmark" size={18} color="white" />}
              </TouchableOpacity>
            ))}
            {userGroups.length === 0 && (
              <Text style={styles.noGroupsText}>You haven't joined any groups yet.</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Drafts List Modal */}
      <Modal visible={showDraftsModal} transparent animationType="slide" onRequestClose={() => setShowDraftsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.draftsSheet}>
            <View style={styles.draftsHeader}>
              <Text style={styles.sheetTitle}>My Drafts</Text>
              <TouchableOpacity onPress={() => setShowDraftsModal(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            {loadingDrafts ? (
              <ActivityIndicator size="large" color={AppColors.primary} style={{ marginVertical: 40 }} />
            ) : drafts.length === 0 ? (
              <View style={styles.noDraftsContainer}>
                <Ionicons name="folder-open-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.noDraftsText}>No drafts found.</Text>
              </View>
            ) : (
              <FlatList
                data={drafts}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.draftsList}
                renderItem={({ item }) => (
                  <View style={styles.draftCard}>
                    <TouchableOpacity style={styles.draftCardContent} onPress={() => handleLoadDraft(item)}>
                      <Text style={styles.draftCardText} numberOfLines={2}>
                        {item.content || '(No content)'}
                      </Text>
                      <Text style={styles.draftCardMeta}>
                        {item.post_type === 'poll' ? '📊 Poll • ' : ''}
                        Last edited: {new Date(item.created_at || Date.now()).toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.draftDeleteBtn} onPress={() => handleDeleteDraft(item.id)}>
                      <Ionicons name="trash-outline" size={20} color={AppColors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
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
  postBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: 'center',
  },
  postBtnDisabled: {
    backgroundColor: '#BDBDBD',
  },
  postBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },

  // Post type toggle
  typeToggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#F0FAF5',
    borderRadius: 24,
    padding: 3,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 20,
  },
  typeToggleBtnActive: {
    backgroundColor: AppColors.primary,
  },
  typeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
  typeToggleTextActive: {
    color: 'white',
  },

  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.primary,
  },
  authorMeta: {
    flex: 1,
    gap: 4,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  authorBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF9F4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.primaryLight,
  },
  metaBadgeText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
    maxWidth: 90,
  },

  // Content
  contentInput: {
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 16,
    color: AppColors.textDark,
    minHeight: 100,
    lineHeight: 24,
  },
  charCount: {
    marginHorizontal: 16,
    marginTop: 4,
    fontSize: 11,
    color: AppColors.textLight,
    textAlign: 'right',
  },

  // Media preview
  mediaPreviewRow: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  mediaPreviewItem: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    position: 'relative',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Poll section
  pollSection: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#F8FFFE',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4EDDA',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 10,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pollOptionBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  pollOptionBulletText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  pollOptionInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: AppColors.textDark,
    backgroundColor: 'white',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  addOptionText: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
  },
  pollSettingsRow: {
    marginTop: 10,
    gap: 8,
  },
  pollSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E8F5E9',
  },
  pollSettingLabel: {
    fontSize: 13,
    color: AppColors.textDark,
  },
  clearBtn: {
    fontSize: 12,
    color: AppColors.error,
    fontWeight: '600',
  },

  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textDark,
  },

  // Schedule banner
  scheduleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EFF9F4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.primaryLight,
  },
  scheduleBannerText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '500',
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: 'white',
  },
  toolbarBtn: {
    padding: 8,
  },
  toolbarSpacer: {
    flex: 1,
  },
  draftBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primary,
  },

  // Modal overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  // Privacy sheet
  privacySheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  privacyOptionActive: {
    backgroundColor: AppColors.primary,
  },
  privacyOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  privacyOptionTextActive: {
    color: 'white',
  },

  // Group sheet
  groupSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 8,
    maxHeight: '70%',
  },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  groupOptionActive: {
    backgroundColor: AppColors.primary,
  },
  groupOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  groupOptionTextActive: {
    color: 'white',
  },
  noGroupsText: {
    textAlign: 'center',
    color: AppColors.textMedium,
    fontSize: 14,
    paddingVertical: 20,
  },
  draftsSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '80%',
  },
  draftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 10,
  },
  noDraftsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  noDraftsText: {
    fontSize: 14,
    color: AppColors.textMedium,
  },
  draftsList: {
    paddingBottom: 20,
  },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EAEFF2',
  },
  draftCardContent: {
    flex: 1,
    gap: 4,
  },
  draftCardText: {
    fontSize: 14,
    color: AppColors.textDark,
    fontWeight: '600',
  },
  draftCardMeta: {
    fontSize: 11,
    color: AppColors.textMedium,
  },
  draftDeleteBtn: {
    padding: 8,
  },
});

export default CreatePostScreen;
