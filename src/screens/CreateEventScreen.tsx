import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import feedService, { EventCategory, Group } from '../services/feedService';
import associationService, { Association } from '../services/associationService';
import { AppColors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface BannerImage {
  uri: string;
  type: string;
  name: string;
}

export default function CreateEventScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  // Route params for context-awareness (pre-attaching organizer if opened from details)
  const preSelectedAssoId = route.params?.associationId;
  const preSelectedAssoName = route.params?.associationName;
  const preSelectedGroupId = route.params?.groupId;
  const preSelectedGroupName = route.params?.groupName;

  // Form fields states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState<'physical' | 'online'>('physical');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Date and Time selection states
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000)); // default +2 hours
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Category states
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Organizer selection states
  const [organizerType, setOrganizerType] = useState<'user' | 'association' | 'group'>(
    preSelectedAssoId ? 'association' : preSelectedGroupId ? 'group' : 'user'
  );
  
  // Lazy-loaded lists
  const [myAssociations, setMyAssociations] = useState<Association[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [organizersLoading, setOrganizersLoading] = useState(false);
  const [organizersLoaded, setOrganizersLoaded] = useState({ associations: false, groups: false });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected single organizer entity (if not personal)
  const [selectedAsso, setSelectedAsso] = useState<Association | null>(
    preSelectedAssoId ? { id: preSelectedAssoId, name: preSelectedAssoName } as any : null
  );
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(
    preSelectedGroupId ? { id: preSelectedGroupId, name: preSelectedGroupName } as any : null
  );

  // Banner image state
  const [bannerImage, setBannerImage] = useState<BannerImage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Privacy & access control (only relevant when from asso/group context)
  const hasOrganizerContext = !!(preSelectedAssoId || preSelectedGroupId);
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'private'>('public');
  const [allowNonMembers, setAllowNonMembers] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(true);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);

  // User picker states for personal private events
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [pickerTab, setPickerTab] = useState<'friends' | 'users'>('friends');
  const [pickerSearch, setPickerSearch] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  // Role options for private events
  const ASSO_ROLE_OPTIONS = [
    { label: 'Admins', value: 'ADMIN_ASSO' },
    { label: 'Sub-Admins', value: 'SOUS_ADMIN_ASSO' },
    { label: 'Coordinators', value: 'COORD_ASSO' },
    { label: 'Project Managers', value: 'PROJECT_MANAGER_ASSO' },
    { label: 'Volunteers', value: 'VOLUNTEER_ASSO' },
  ];
  const EVENT_ROLE_OPTIONS = [
    { label: 'Admins', value: 'ADMIN_EVENT' },
    { label: 'Moderators', value: 'MODERATOR_EVENT' },
    { label: 'Staff / Crew', value: 'STAFF_EVENT' },
    { label: 'Speakers', value: 'SPEAKER_EVENT' },
    { label: 'VIP Guests', value: 'VIP_EVENT' },
    { label: 'Participants', value: 'PARTICIPANT_EVENT' },
  ];
  const GROUP_ROLE_OPTIONS = [
    { label: 'Admins', value: 'ADMIN_GROUP' },
    { label: 'Moderators', value: 'MODERATOR_GROUP' },
    { label: 'Members', value: 'MEMBER_GROUP' },
  ];
  const roleOptions = organizerType === 'association' ? ASSO_ROLE_OPTIONS : organizerType === 'group' ? GROUP_ROLE_OPTIONS : EVENT_ROLE_OPTIONS;

  const toggleRole = (roleValue: string) => {
    setAllowedRoles(prev =>
      prev.includes(roleValue) ? prev.filter(r => r !== roleValue) : [...prev, roleValue]
    );
  };

  const toggleUser = (userItem: any) => {
    const userIdStr = String(userItem.id);
    setSelectedUsers(prev => {
      const exists = prev.some(u => String(u.id) === userIdStr);
      if (exists) {
        return prev.filter(u => String(u.id) !== userIdStr);
      } else {
        if (prev.length >= 200) {
          Alert.alert('Limit Reached', 'You can invite a maximum of 200 users to a private event.');
          return prev;
        }
        return [...prev, userItem];
      }
    });
  };

  const handlePickerSearch = async (text: string) => {
    setPickerSearch(text);
    if (pickerTab === 'friends') {
      setLoadingFriends(true);
      try {
        const list = await feedService.getFriends(text);
        setFriendsList(list || []);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingFriends(false);
      }
    } else {
      if (text.trim().length >= 2) {
        setLoadingGlobal(true);
        try {
          const list = await feedService.searchUsers(text);
          setGlobalUsers(list || []);
        } catch (err) {
          console.warn(err);
        } finally {
          setLoadingGlobal(false);
        }
      } else {
        setGlobalUsers([]);
      }
    }
  };

  // Load mutual followers when personal + private
  useEffect(() => {
    if (organizerType === 'user' && privacyLevel === 'private') {
      const fetchFriends = async () => {
        setLoadingFriends(true);
        try {
          const list = await feedService.getFriends();
          setFriendsList(list || []);
        } catch (err) {
          console.warn('Failed to load friends list:', err);
        } finally {
          setLoadingFriends(false);
        }
      };
      fetchFriends();
    }
  }, [organizerType, privacyLevel]);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const cats = await feedService.getEventCategories();
        setCategories(cats);
      } catch (e: any) {
        console.warn('Failed to fetch event categories:', e);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Lazy-load associations when requested
  const loadAssociationsIfNeeded = async () => {
    if (organizersLoaded.associations) return;
    setOrganizersLoading(true);
    try {
      const assos = await associationService.getMyAssociations();
      setMyAssociations(assos);
      setOrganizersLoaded(prev => ({ ...prev, associations: true }));
    } catch (e: any) {
      Alert.alert('Error', 'Failed to fetch your associations.');
    } finally {
      setOrganizersLoading(false);
    }
  };

  // Lazy-load groups when requested
  const loadGroupsIfNeeded = async () => {
    if (organizersLoaded.groups) return;
    setOrganizersLoading(true);
    try {
      const groups = await feedService.getManagedGroups();
      setMyGroups(groups);
      setOrganizersLoaded(prev => ({ ...prev, groups: true }));
    } catch (e: any) {
      Alert.alert('Error', 'Failed to fetch your managed groups.');
    } finally {
      setOrganizersLoading(false);
    }
  };

  const handleOrganizerTypeChange = (type: 'user' | 'association' | 'group') => {
    if (preSelectedAssoId || preSelectedGroupId) return; // Locked by context parameters
    setOrganizerType(type);
    setSearchQuery('');
    if (type === 'association') {
      loadAssociationsIfNeeded();
    } else if (type === 'group') {
      loadGroupsIfNeeded();
    }
  };

  // Banner picking logic
  const handlePickBanner = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need photo library access to upload event banners.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selected = result.assets[0];
      setBannerImage({
        uri: selected.uri,
        type: 'image/jpeg',
        name: selected.fileName || `banner_${Date.now()}.jpg`,
      });
    }
  };

  // Category toggle selection
  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  // Submission validation
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Event Title is required.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Event Description is required.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Validation Error', 'Event Location is required.');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('Validation Error', 'End Time must be after Start Time.');
      return;
    }
    if (organizerType === 'association' && !selectedAsso) {
      Alert.alert('Validation Error', 'Please select an Association organizer.');
      return;
    }
    if (organizerType === 'group' && !selectedGroup) {
      Alert.alert('Validation Error', 'Please select a Group organizer.');
      return;
    }

    setSubmitting(true);
    try {
      // Parse tags
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        location: location.trim(),
        event_type: eventType,
        organizer_type: organizerType,
        max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        website: contactWebsite.trim() || null,
        organizer_association_id: organizerType === 'association' ? (selectedAsso?.id ?? preSelectedAssoId ?? null) : null,
        organizer_group_id: organizerType === 'group' ? (selectedGroup?.id ?? preSelectedGroupId ?? null) : null,
        privacy_level: privacyLevel,
        allow_non_members: allowNonMembers,
        display_location: displayLocation,
        allowed_roles: (organizerType !== 'user' && privacyLevel === 'private' && allowedRoles.length > 0) ? allowedRoles : undefined,
        allowed_users: (organizerType === 'user' && privacyLevel === 'private' && selectedUsers.length > 0) ? selectedUsers.map(u => String(u.id)) : undefined,
        tags,
        category_ids: selectedCategoryIds,
        banner_image: bannerImage,
      };

      const result = await feedService.createEvent(payload);
      if (result.success) {
        Alert.alert('ðŸŽ‰ Success', 'Event created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
              // Try to refresh events screen if it's in history stack
              if (route.params?.onSuccess) {
                route.params.onSuccess();
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Could not create event.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // Date picker handlers
  const handleStartDateChange = (event: any, selected: Date | undefined) => {
    if (Platform.OS === 'android') {
      setTimeout(() => setShowStartDatePicker(false), 100);
    } else {
      setShowStartDatePicker(false);
    }
    if (selected) {
      const updated = new Date(startDate);
      updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setStartDate(updated);
      // Auto shift end date to start date + 2 hours if before
      if (endDate <= updated) {
        setEndDate(new Date(updated.getTime() + 2 * 60 * 60 * 1000));
      }
    }
  };

  const handleStartTimeChange = (event: any, selected: Date | undefined) => {
    if (Platform.OS === 'android') {
      setTimeout(() => setShowStartTimePicker(false), 100);
    } else {
      setShowStartTimePicker(false);
    }
    if (selected) {
      const updated = new Date(startDate);
      updated.setHours(selected.getHours(), selected.getMinutes());
      setStartDate(updated);
      if (endDate <= updated) {
        setEndDate(new Date(updated.getTime() + 2 * 60 * 60 * 1000));
      }
    }
  };

  const handleEndDateChange = (event: any, selected: Date | undefined) => {
    if (Platform.OS === 'android') {
      setTimeout(() => setShowEndDatePicker(false), 100);
    } else {
      setShowEndDatePicker(false);
    }
    if (selected) {
      const updated = new Date(endDate);
      updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setEndDate(updated);
    }
  };

  const handleEndTimeChange = (event: any, selected: Date | undefined) => {
    if (Platform.OS === 'android') {
      setTimeout(() => setShowEndTimePicker(false), 100);
    } else {
      setShowEndTimePicker(false);
    }
    if (selected) {
      const updated = new Date(endDate);
      updated.setHours(selected.getHours(), selected.getMinutes());
      setEndDate(updated);
    }
  };

  // Search filtering
  const filteredAssociations = myAssociations.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroups = myGroups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* â”€â”€ Top Custom Navigation Header â”€â”€ */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="close" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Eco Event</Text>
        <TouchableOpacity
          style={[styles.publishHeaderBtn, (!title.trim() || !description.trim() || !location.trim()) && styles.publishHeaderBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.publishHeaderBtnText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* â”€â”€ Banner Image Picker â”€â”€ */}
        <TouchableOpacity style={styles.bannerPicker} onPress={handlePickBanner} activeOpacity={0.8}>
          {bannerImage ? (
            <View style={styles.bannerContainer}>
              <Image source={{ uri: bannerImage.uri }} style={styles.bannerImage} />
              <View style={styles.changeBannerBadge}>
                <Ionicons name="camera" size={16} color="white" />
                <Text style={styles.changeBannerText}>Change</Text>
              </View>
            </View>
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Ionicons name="image-outline" size={40} color={AppColors.textMedium} />
              <Text style={styles.bannerPlaceholderTitle}>Add Event Cover Banner</Text>
              <Text style={styles.bannerPlaceholderDesc}>Recommended size: 16:9 ratio</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* â”€â”€ Organizer Selector â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Create Event As *</Text>
          {(preSelectedAssoId || preSelectedGroupId) ? (
            // Read-Only Organizer Card if launched in specific context
            <View style={styles.lockedOrganizerCard}>
              <Ionicons
                name={preSelectedAssoId ? 'business-outline' : 'people-outline'}
                size={20}
                color={AppColors.primary}
              />
              <Text style={styles.lockedOrganizerName}>
                {preSelectedAssoId ? `Association: ${preSelectedAssoName}` : `Group: ${preSelectedGroupName}`}
              </Text>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={12} color={AppColors.textMedium} />
                <Text style={styles.lockedText}>Context Bound</Text>
              </View>
            </View>
          ) : (
            // Full interactive organizer picker (Lazy load values)
            <View>
              <View style={styles.organizerTabs}>
                <TouchableOpacity
                  style={[styles.organizerTab, organizerType === 'user' && styles.organizerTabActive]}
                  onPress={() => handleOrganizerTypeChange('user')}
                >
                  <Ionicons name="person-outline" size={16} color={organizerType === 'user' ? 'white' : AppColors.textMedium} />
                  <Text style={[styles.organizerTabText, organizerType === 'user' && styles.organizerTabTextActive]}>Personal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.organizerTab, organizerType === 'association' && styles.organizerTabActive]}
                  onPress={() => handleOrganizerTypeChange('association')}
                >
                  <Ionicons name="business-outline" size={16} color={organizerType === 'association' ? 'white' : AppColors.textMedium} />
                  <Text style={[styles.organizerTabText, organizerType === 'association' && styles.organizerTabTextActive]}>Association</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.organizerTab, organizerType === 'group' && styles.organizerTabActive]}
                  onPress={() => handleOrganizerTypeChange('group')}
                >
                  <Ionicons name="people-outline" size={16} color={organizerType === 'group' ? 'white' : AppColors.textMedium} />
                  <Text style={[styles.organizerTabText, organizerType === 'group' && styles.organizerTabTextActive]}>Group</Text>
                </TouchableOpacity>
              </View>

              {/* Selector Lists based on Tab selection */}
              {organizersLoading && (
                <View style={styles.loadingContainerInline}>
                  <ActivityIndicator color={AppColors.primary} size="small" />
                  <Text style={styles.loadingTextInline}>Loading organizations...</Text>
                </View>
              )}

              {organizerType === 'association' && !organizersLoading && (
                <View style={styles.orgSelectionCard}>
                  {selectedAsso ? (
                    <View style={styles.selectedOrgRow}>
                      <Ionicons name="checkmark-circle" size={18} color={AppColors.primary} />
                      <Text style={styles.selectedOrgName}>{selectedAsso.name}</Text>
                      <TouchableOpacity style={styles.changeOrgBtn} onPress={() => setSelectedAsso(null)}>
                        <Text style={styles.changeOrgBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      {myAssociations.length === 0 ? (
                        <Text style={styles.emptyOrgMsg}>You do not manage any associations.</Text>
                      ) : (
                        <View>
                          <TextInput
                            style={styles.searchBar}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search managed associations..."
                            placeholderTextColor={AppColors.textLight}
                          />
                          <ScrollView style={styles.orgScrollList} nestedScrollEnabled>
                            {filteredAssociations.map(asso => (
                              <TouchableOpacity
                                key={asso.id}
                                style={styles.orgListItem}
                                onPress={() => setSelectedAsso(asso)}
                              >
                                <Ionicons name="business-outline" size={16} color={AppColors.textMedium} />
                                <Text style={styles.orgListItemText}>{asso.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {organizerType === 'group' && !organizersLoading && (
                <View style={styles.orgSelectionCard}>
                  {selectedGroup ? (
                    <View style={styles.selectedOrgRow}>
                      <Ionicons name="checkmark-circle" size={18} color={AppColors.primary} />
                      <Text style={styles.selectedOrgName}>{selectedGroup.name}</Text>
                      <TouchableOpacity style={styles.changeOrgBtn} onPress={() => setSelectedGroup(null)}>
                        <Text style={styles.changeOrgBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      {myGroups.length === 0 ? (
                        <Text style={styles.emptyOrgMsg}>You do not manage any groups.</Text>
                      ) : (
                        <View>
                          <TextInput
                            style={styles.searchBar}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search managed groups..."
                            placeholderTextColor={AppColors.textLight}
                          />
                          <ScrollView style={styles.orgScrollList} nestedScrollEnabled>
                            {filteredGroups.map(group => (
                              <TouchableOpacity
                                key={group.id}
                                style={styles.orgListItem}
                                onPress={() => setSelectedGroup(group)}
                              >
                                <Ionicons name="people-outline" size={16} color={AppColors.textMedium} />
                                <Text style={styles.orgListItemText}>{group.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* â”€â”€ Title & Description â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Event Title *</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Community Beach Cleanup Drive"
            placeholderTextColor={AppColors.textLight}
          />
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detail the eco action mission, what attendees should bring, and agenda..."
            placeholderTextColor={AppColors.textLight}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* â”€â”€ Event Type & Location â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Location Type *</Text>
          <View style={styles.organizerTabs}>
            <TouchableOpacity
              style={[styles.organizerTab, eventType === 'physical' && styles.organizerTabActive]}
              onPress={() => setEventType('physical')}
            >
              <Ionicons name="location-outline" size={16} color={eventType === 'physical' ? 'white' : AppColors.textMedium} />
              <Text style={[styles.organizerTabText, eventType === 'physical' && styles.organizerTabTextActive]}>Physical Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.organizerTab, eventType === 'online' && styles.organizerTabActive]}
              onPress={() => setEventType('online')}
            >
              <Ionicons name="globe-outline" size={16} color={eventType === 'online' ? 'white' : AppColors.textMedium} />
              <Text style={[styles.organizerTabText, eventType === 'online' && styles.organizerTabTextActive]}>Online Event</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            {eventType === 'physical' ? 'Venue Address *' : 'Webinar / Meeting URL *'}
          </Text>
          <TextInput
            style={styles.textInput}
            value={location}
            onChangeText={setLocation}
            placeholder={eventType === 'physical' ? 'e.g. Central Park West Gates, NY' : 'e.g. Zoom link, Google Meet URL'}
            placeholderTextColor={AppColors.textLight}
            autoCapitalize="none"
          />
        </View>

        {/* â”€â”€ Dates and Times â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Date & Time Settings *</Text>
          <View style={styles.dateTimeGrid}>
            
            {/* Start Date */}
            <View style={styles.dateTimeCol}>
              <Text style={styles.dateTimeSubLabel}>Starts On</Text>
              <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowStartDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={AppColors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Start Time */}
            <View style={styles.dateTimeCol}>
              <Text style={styles.dateTimeSubLabel}>Start Time</Text>
              <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowStartTimePicker(true)}>
                <Ionicons name="time-outline" size={16} color={AppColors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.dateTimeGrid, { marginTop: 12 }]}>
            
            {/* End Date */}
            <View style={styles.dateTimeCol}>
              <Text style={styles.dateTimeSubLabel}>Ends On</Text>
              <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowEndDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={AppColors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Time */}
            <View style={styles.dateTimeCol}>
              <Text style={styles.dateTimeSubLabel}>End Time</Text>
              <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowEndTimePicker(true)}>
                <Ionicons name="time-outline" size={16} color={AppColors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DateTime Picker instances */}
          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleStartDateChange}
              minimumDate={new Date()}
            />
          )}

          {showStartTimePicker && (
            <DateTimePicker
              value={startDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleStartTimeChange}
            />
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleEndDateChange}
              minimumDate={startDate}
            />
          )}

          {showEndTimePicker && (
            <DateTimePicker
              value={endDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleEndTimeChange}
            />
          )}
        </View>

        {/* â”€â”€ Category Select Chips â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Categories * (Select one or more)</Text>
          {categoriesLoading ? (
            <ActivityIndicator color={AppColors.primary} />
          ) : (
            <View style={styles.categoriesGrid}>
              {categories.map(cat => {
                const isSelected = selectedCategoryIds.includes(String(cat.id));
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: cat.color || AppColors.primary, borderColor: cat.color || AppColors.primary }
                    ]}
                    onPress={() => handleToggleCategory(String(cat.id))}
                  >
                    <Text style={[styles.categoryChipText, isSelected && { color: 'white' }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* â”€â”€ Max Attendees â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Max Attendees Limit (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            placeholder="e.g. 100 (Leave empty for unlimited)"
            placeholderTextColor={AppColors.textLight}
            keyboardType="number-pad"
          />
        </View>

        {/* â”€â”€ Tags Input â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Tags (Separated by commas)</Text>
          <TextInput
            style={styles.textInput}
            value={tagsInput}
            onChangeText={setTagsInput}
            placeholder="e.g. recycling, trees, ocean, plastic-free"
            placeholderTextColor={AppColors.textLight}
            autoCapitalize="none"
          />
        </View>

        {/* â”€â”€ Contact Details Section â”€â”€ */}
        <View style={styles.sectionDivider}>
          <Text style={styles.dividerTitle}>Contact Information (Optional)</Text>
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Contact Email</Text>
          <TextInput
            style={styles.textInput}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="e.g. info@organization.org"
            placeholderTextColor={AppColors.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Contact Phone</Text>
          <TextInput
            style={styles.textInput}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="e.g. +1 555 123-4567"
            placeholderTextColor={AppColors.textLight}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Contact Website</Text>
          <TextInput
            style={styles.textInput}
            value={contactWebsite}
            onChangeText={setContactWebsite}
            placeholder="https://example.com"
            placeholderTextColor={AppColors.textLight}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* â”€â”€ Privacy Level â”€â”€ */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Event Privacy</Text>
          <View style={styles.organizerTabs}>
            <TouchableOpacity
              style={[styles.organizerTab, privacyLevel === 'public' && styles.organizerTabActive]}
              onPress={() => { setPrivacyLevel('public'); setAllowedRoles([]); setSelectedUsers([]); }}
            >
              <Ionicons name="globe-outline" size={16} color={privacyLevel === 'public' ? 'white' : AppColors.textMedium} />
              <Text style={[styles.organizerTabText, privacyLevel === 'public' && styles.organizerTabTextActive]}>Public</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.organizerTab, privacyLevel === 'private' && styles.organizerTabActive]}
              onPress={() => setPrivacyLevel('private')}
            >
              <Ionicons name="lock-closed-outline" size={16} color={privacyLevel === 'private' ? 'white' : AppColors.textMedium} />
              <Text style={[styles.organizerTabText, privacyLevel === 'private' && styles.organizerTabTextActive]}>Private</Text>
            </TouchableOpacity>
          </View>

          {privacyLevel === 'private' && (
            organizerType === 'user' ? (
              // â”€â”€ Personal user picker â”€â”€
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { marginBottom: 8, fontSize: 13 }]}>
                  Who can access? (Select friends / search users)
                </Text>

                {/* Selected Users list */}
                {selectedUsers.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 }}>
                    {selectedUsers.map(u => (
                      <TouchableOpacity
                        key={u.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: AppColors.primary + '15',
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 20,
                          borderColor: AppColors.primary,
                          borderWidth: 0.5,
                        }}
                        onPress={() => toggleUser(u)}
                      >
                        <Text style={{ fontSize: 12, color: AppColors.primary, marginRight: 4 }}>{u.fullName || u.displayName}</Text>
                        <Ionicons name="close-circle" size={14} color={AppColors.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Picker sub-tabs */}
                <View style={[styles.organizerTabs, { height: 35, marginBottom: 8 }]}>
                  <TouchableOpacity
                    style={[styles.organizerTab, pickerTab === 'friends' && styles.organizerTabActive]}
                    onPress={() => { setPickerTab('friends'); handlePickerSearch(''); }}
                  >
                    <Text style={[styles.organizerTabText, { fontSize: 12 }, pickerTab === 'friends' && styles.organizerTabTextActive]}>Friends (Mutual)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.organizerTab, pickerTab === 'users' && styles.organizerTabActive]}
                    onPress={() => { setPickerTab('users'); handlePickerSearch(''); }}
                  >
                    <Text style={[styles.organizerTabText, { fontSize: 12 }, pickerTab === 'users' && styles.organizerTabTextActive]}>All Users</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <TextInput
                  style={[styles.searchBar, { height: 40, marginBottom: 8 }]}
                  value={pickerSearch}
                  onChangeText={handlePickerSearch}
                  placeholder={pickerTab === 'friends' ? "Search mutual followers..." : "Search all users..."}
                  placeholderTextColor={AppColors.textLight}
                />

                {/* User list */}
                <View style={[styles.orgSelectionCard, { maxHeight: 180 }]}>
                  {pickerTab === 'friends' ? (
                    loadingFriends ? (
                      <ActivityIndicator color={AppColors.primary} size="small" />
                    ) : friendsList.length === 0 ? (
                      <Text style={styles.emptyOrgMsg}>No friends found.</Text>
                    ) : (
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                        {friendsList.map(u => {
                          const isSelected = selectedUsers.some(su => String(su.id) === String(u.id));
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.orgListItem, { justifyContent: 'space-between' }]}
                              onPress={() => toggleUser(u)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="person-outline" size={16} color={AppColors.textMedium} style={{ marginRight: 8 }} />
                                <Text style={styles.orgListItemText}>{u.fullName || u.displayName}</Text>
                              </View>
                              <Ionicons
                                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                size={18}
                                color={isSelected ? AppColors.primary : AppColors.textLight}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )
                  ) : (
                    loadingGlobal ? (
                      <ActivityIndicator color={AppColors.primary} size="small" />
                    ) : globalUsers.length === 0 ? (
                      <Text style={styles.emptyOrgMsg}>Type at least 2 characters to search users...</Text>
                    ) : (
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                        {globalUsers.map(u => {
                          const isSelected = selectedUsers.some(su => String(su.id) === String(u.id));
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.orgListItem, { justifyContent: 'space-between' }]}
                              onPress={() => toggleUser(u)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="person-outline" size={16} color={AppColors.textMedium} style={{ marginRight: 8 }} />
                                <Text style={styles.orgListItemText}>{u.fullName || u.displayName}</Text>
                              </View>
                              <Ionicons
                                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                size={18}
                                color={isSelected ? AppColors.primary : AppColors.textLight}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )
                  )}
                </View>
              </View>
            ) : (
              // â”€â”€ Role chips selection â”€â”€
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { marginBottom: 8, fontSize: 13 }]}>
                  Who can attend? (select roles)
                </Text>
                <View style={styles.categoriesGrid}>
                  {roleOptions.map((opt: { label: string; value: string }) => {
                    const isSelected = allowedRoles.includes(opt.value);
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.categoryChip,
                          isSelected && { backgroundColor: AppColors.primary, borderColor: AppColors.primary }
                        ]}
                        onPress={() => toggleRole(opt.value)}
                      >
                        <Text style={[styles.categoryChipText, isSelected && { color: 'white' }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )
          )}
          {/* Allow Non-Members & Display Location Settings */}
          <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: AppColors.textDark }}>Allow Non-Members</Text>
                  {allowNonMembers && (
                    <Text style={{ fontSize: 11, color: AppColors.primary, fontWeight: '600', marginLeft: 8 }}>
                      Will make location visible to all
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>
                  Permit non-group/association members to view and attend event
                </Text>
              </View>
              <Switch
                value={allowNonMembers}
                onValueChange={val => {
                  setAllowNonMembers(val);
                  if (val) setDisplayLocation(true);
                }}
                thumbColor={allowNonMembers ? AppColors.primary : '#f4f3f4'}
                trackColor={{ false: '#ddd', true: AppColors.primaryLight }}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: AppColors.textDark }}>Display Location</Text>
                <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 2 }}>
                  Show venue address or meeting URL on event details
                </Text>
              </View>
              <Switch
                value={displayLocation}
                onValueChange={setDisplayLocation}
                thumbColor={displayLocation ? AppColors.primary : '#f4f3f4'}
                trackColor={{ false: '#ddd', true: AppColors.primaryLight }}
              />
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 60 + 20, // default offset
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: 'white',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  publishHeaderBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  publishHeaderBtnDisabled: {
    backgroundColor: AppColors.textLight,
  },
  publishHeaderBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  bannerPicker: {
    width: '100%',
    height: 190,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  bannerContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  changeBannerBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  changeBannerText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bannerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  bannerPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
    marginTop: 8,
  },
  bannerPlaceholderDesc: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  fieldSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: AppColors.textDark,
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    height: 100,
    paddingVertical: 12,
  },
  organizerTabs: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    padding: 2,
  },
  organizerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  organizerTabActive: {
    backgroundColor: AppColors.primary,
  },
  organizerTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  organizerTabTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  lockedOrganizerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  lockedOrganizerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockedText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  orgSelectionCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  selectedOrgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedOrgName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  changeOrgBtn: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  changeOrgBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  emptyOrgMsg: {
    fontSize: 12,
    color: AppColors.textMedium,
    textAlign: 'center',
    paddingVertical: 10,
  },
  searchBar: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    fontSize: 12,
    color: AppColors.textDark,
    marginBottom: 8,
  },
  orgScrollList: {
    maxHeight: 120,
  },
  orgListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  orgListItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  loadingContainerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
  },
  loadingTextInline: {
    fontSize: 12,
    color: AppColors.textMedium,
  },
  dateTimeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeCol: {
    flex: 1,
  },
  dateTimeSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMedium,
    marginBottom: 4,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#FAFAFA',
  },
  dateTimeButtonText: {
    fontSize: 13,
    color: AppColors.textDark,
    fontWeight: '500',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FAFAFA',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginTop: 24,
    paddingBottom: 8,
    marginHorizontal: 16,
  },
  dividerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textMedium,
  },
});
