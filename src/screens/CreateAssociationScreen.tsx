import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AppColors } from '../theme/colors';
import associationService from '../services/associationService';

// Dynamically loaded from backend

const FOCUS_AREA_SUGGESTIONS = [
  'Reforestation', 'Ocean Cleanup', 'Solar Energy', 'Waste Reduction',
  'Carbon Neutral', 'Biodiversity', 'Water Conservation', 'Renewable Energy',
  'Community Education', 'Policy Reform', 'Wildlife Protection', 'Urban Farming',
];

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SectionLabel = ({ label, required }: { label: string; required?: boolean }) => (
  <Text style={styles.label}>
    {label}
    {required && <Text style={styles.labelRequired}> *</Text>}
  </Text>
);

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  required,
  keyboardType,
}: any) => (
  <View style={styles.fieldGroup}>
    <SectionLabel label={label} required={required} />
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={AppColors.textLight}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize="none"
    />
  </View>
);

// â”€â”€â”€ Main Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const CreateAssociationScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const associationId = route.params?.associationId;
  const editingAssociation = route.params?.association;
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [shortTagline, setShortTagline] = useState('');
  const [description, setDescription] = useState('');
  const [mission, setMission] = useState('');
  const [whatTheyDo, setWhatTheyDo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [establishedDate, setEstablishedDate] = useState('');

  // Arrays
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [focusInput, setFocusInput] = useState('');
  const [achievements, setAchievements] = useState<string[]>([]);
  const [achievementInput, setAchievementInput] = useState('');

  // Social Media
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');

  // Images
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [logoImageUri, setLogoImageUri] = useState<string | null>(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const list = await associationService.getCategories();
        setCategories(list || []);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    })();
  }, []);

  React.useEffect(() => {
    const initEdit = async () => {
      let assocData = editingAssociation;
      if (!assocData && associationId) {
        setIsSubmitting(true);
        try {
          assocData = await associationService.getAssociationById(associationId);
        } catch (e) {
          Alert.alert('Error', 'Failed to load association details.');
        } finally {
          setIsSubmitting(false);
        }
      }

      if (assocData) {
        setIsEditMode(true);
        setName(assocData.name || '');
        setCategory(assocData.category ? (assocData.category.id || assocData.category) : '');
        setShortTagline(assocData.short_tagline || '');
        setDescription(assocData.description || '');
        setMission(assocData.mission || '');
        setWhatTheyDo(assocData.what_they_do || '');
        setEmail(assocData.email || '');
        setPhone(assocData.phone_number || '');
        setWebsite(assocData.website || '');
        setAddress(assocData.address || '');
        setIsPrivate(!!assocData.is_private);
        setEstablishedDate(assocData.established_date || '');
        setFocusAreas(assocData.focus_areas || []);
        setAchievements(assocData.achievements || []);

        if (assocData.social_media) {
          setFacebook(assocData.social_media.facebook || '');
          setInstagram(assocData.social_media.instagram || '');
          setTwitter(assocData.social_media.twitter || '');
          setLinkedin(assocData.social_media.linkedin || '');
        }

        if (assocData.profile_image) {
          setCoverImageUri(associationService.resolveUrl(assocData.profile_image));
        }
        if (assocData.logo_image) {
          setLogoImageUri(associationService.resolveUrl(assocData.logo_image));
        }
      }
    };

    initEdit();
  }, [associationId, editingAssociation]);

  const pickImage = async (type: 'cover' | 'logo') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Gallery access is required to pick an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.[0]) {
      if (type === 'cover') setCoverImageUri(result.assets[0].uri);
      else setLogoImageUri(result.assets[0].uri);
    }
  };

  const addFocusArea = (area: string) => {
    const trimmed = area.trim();
    if (!trimmed || focusAreas.includes(trimmed)) return;
    setFocusAreas(prev => [...prev, trimmed]);
    setFocusInput('');
  };

  const removeFocusArea = (area: string) => {
    setFocusAreas(prev => prev.filter(a => a !== area));
  };

  const addAchievement = () => {
    const trimmed = achievementInput.trim();
    if (!trimmed) return;
    setAchievements(prev => [...prev, trimmed]);
    setAchievementInput('');
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Association name is required.';
    if (!category) return 'Please select a category.';
    if (!description.trim()) return 'Description is required.';
    if (!mission.trim()) return 'Mission statement is required.';
    if (!whatTheyDo.trim()) return '"What they do" is required.';
    if (focusAreas.length === 0) return 'Add at least one focus area.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'A valid email address is required.';
    if (!address.trim()) return 'Address is required.';
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    setIsSubmitting(true);
    try {
      const socialMedia: Record<string, string> = {};
      if (facebook.trim()) socialMedia.facebook = facebook.trim();
      if (instagram.trim()) socialMedia.instagram = instagram.trim();
      if (twitter.trim()) socialMedia.twitter = twitter.trim();
      if (linkedin.trim()) socialMedia.linkedin = linkedin.trim();

      const payload: any = {
        name: name.trim(),
        category_id: typeof category === 'object' ? (category as any).id : category,
        short_tagline: shortTagline.trim() || undefined,
        description: description.trim(),
        mission: mission.trim(),
        what_they_do: whatTheyDo.trim(),
        focus_areas: focusAreas,
        achievements: achievements.length > 0 ? achievements : undefined,
        email: email.trim(),
        phone_number: phone.trim() || undefined,
        website: website.trim() || undefined,
        address: address.trim(),
        is_private: isPrivate,
        established_date: establishedDate.trim() || undefined,
        social_media: Object.keys(socialMedia).length > 0 ? socialMedia : undefined,
      };

      // 1. Create or Update the association
      let result;
      if (isEditMode) {
        result = await associationService.updateAssociation(associationId, payload);
      } else {
        result = await associationService.createAssociation(payload);
      }

      // 2. Upload images if selected and changed (local paths)
      const uploadCover = coverImageUri && !coverImageUri.startsWith('http');
      const uploadLogo = logoImageUri && !logoImageUri.startsWith('http');
      if (uploadCover || uploadLogo) {
        await associationService.uploadAssociationImages(
          isEditMode ? associationId : result.id,
          uploadCover ? coverImageUri : undefined,
          uploadLogo ? logoImageUri : undefined
        );
      }

      Alert.alert(
        isEditMode ? 'ðŸŽ‰ Association Updated!' : 'ðŸŽ‰ Association Created!',
        isEditMode
          ? `"${name}" has been updated successfully.`
          : `"${result.name}" has been created successfully.`,
        [
          {
            text: 'View Details',
            onPress: () => {
              if (isEditMode) {
                navigation.goBack();
              } else {
                navigation.replace('AssociationDetail', { associationId: result.id });
              }
            },
          },
        ]
      );
    } catch (e: any) {
      const msg = e?.response?.data?.error || e.message || 'Failed to submit association details.';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container]}>
        {/* â”€â”€ Sticky Header â”€â”€ */}
        <View style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Association' : 'Create Association'}</Text>
          <TouchableOpacity
            style={[styles.submitHdrBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.submitHdrText}>{isEditMode ? 'Save' : 'Create'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* â”€â”€ Cover Image â”€â”€ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="images-outline" size={16} color={AppColors.primary} /> Cover & Logo
            </Text>

            {/* Cover Image */}
            <SectionLabel label="Cover Image (Profile Image)" />
            <TouchableOpacity style={styles.coverPickerBox} onPress={() => pickImage('cover')}>
              {coverImageUri ? (
                <Image source={{ uri: coverImageUri }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverPickerPlaceholder}>
                  <Ionicons name="image-outline" size={36} color={AppColors.textMedium} />
                  <Text style={styles.coverPickerText}>Tap to select cover image (16:9)</Text>
                </View>
              )}
              <View style={styles.coverPickerOverlay}>
                <Ionicons name="camera" size={20} color="white" />
              </View>
            </TouchableOpacity>

            {/* Logo Image */}
            <SectionLabel label="Logo Image" />
            <View style={styles.logoRow}>
              <TouchableOpacity style={styles.logoPickerBox} onPress={() => pickImage('logo')}>
                {logoImageUri ? (
                  <Image source={{ uri: logoImageUri }} style={styles.logoPreview} />
                ) : (
                  <View style={styles.logoPickerPlaceholder}>
                    <Ionicons name="business-outline" size={28} color={AppColors.textMedium} />
                  </View>
                )}
                <View style={styles.logoPickerBadge}>
                  <Ionicons name="camera" size={14} color="white" />
                </View>
              </TouchableOpacity>
              <View style={styles.logoHint}>
                <Text style={styles.logoHintText}>Upload a square logo image (1:1 ratio)</Text>
                <Text style={styles.logoHintSub}>Recommended: 400Ã—400px, PNG or JPG</Text>
              </View>
            </View>
          </View>

          {/* â”€â”€ Basic Info â”€â”€ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="information-circle-outline" size={16} color={AppColors.primary} /> Basic Information
            </Text>

            <Field
              label="Association Name"
              required
              value={name}
              onChangeText={setName}
              placeholder="e.g. Green Earth Alliance"
            />

            {/* Category Picker */}
            <View style={styles.fieldGroup}>
              <SectionLabel label="Category" required />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, (category === cat.id || (typeof category === 'object' && (category as any).id === cat.id)) && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text style={[styles.categoryChipText, (category === cat.id || (typeof category === 'object' && (category as any).id === cat.id)) && styles.categoryChipTextActive]}>
                      {cat.displayName || cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Field
              label="Short Tagline"
              value={shortTagline}
              onChangeText={setShortTagline}
              placeholder="A catchy one-liner for your association"
            />

            <Field
              label="Description"
              required
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what this association is about..."
              multiline
            />

            <Field
              label="Mission Statement"
              required
              value={mission}
              onChangeText={setMission}
              placeholder="What is your association's core mission?"
              multiline
            />

            <Field
              label="What We Do"
              required
              value={whatTheyDo}
              onChangeText={setWhatTheyDo}
              placeholder="Describe the key activities and programs..."
              multiline
            />
          </View>

          {/* â”€â”€ Focus Areas â”€â”€ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="leaf-outline" size={16} color={AppColors.primary} /> Focus Areas
            </Text>
            <SectionLabel label="Focus Areas" required />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={focusInput}
                onChangeText={setFocusInput}
                placeholder="Add a focus area..."
                placeholderTextColor={AppColors.textLight}
                onSubmitEditing={() => addFocusArea(focusInput)}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addBtn} onPress={() => addFocusArea(focusInput)}>
                <Ionicons name="add" size={22} color="white" />
              </TouchableOpacity>
            </View>
            {/* Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {FOCUS_AREA_SUGGESTIONS.filter(s => !focusAreas.includes(s)).map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestionChip}
                  onPress={() => addFocusArea(s)}
                >
                  <Ionicons name="add-circle-outline" size={13} color={AppColors.primary} />
                  <Text style={styles.suggestionChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Tags */}
            {focusAreas.length > 0 && (
              <View style={styles.tagsList}>
                {focusAreas.map(area => (
                  <View key={area} style={styles.tag}>
                    <Text style={styles.tagText}>{area}</Text>
                    <TouchableOpacity onPress={() => removeFocusArea(area)} style={styles.tagRemove}>
                      <Ionicons name="close" size={14} color={AppColors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* â”€â”€ Achievements â”€â”€ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="trophy-outline" size={16} color={AppColors.primary} /> Achievements
            </Text>
            <SectionLabel label="Key Achievements (optional)" />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={achievementInput}
                onChangeText={setAchievementInput}
                placeholder="e.g. Planted 10,000 trees in 2023"
                placeholderTextColor={AppColors.textLight}
                onSubmitEditing={addAchievement}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addBtn} onPress={addAchievement}>
                <Ionicons name="add" size={22} color="white" />
              </TouchableOpacity>
            </View>
            {achievements.length > 0 && (
              <View style={styles.achievementList}>
                {achievements.map((a, i) => (
                  <View key={i} style={styles.achievementItem}>
                    <Ionicons name="checkmark-circle" size={18} color={AppColors.primary} />
                    <Text style={styles.achievementText}>{a}</Text>
                    <TouchableOpacity onPress={() => setAchievements(prev => prev.filter((_, idx) => idx !== i))}>
                      <Ionicons name="close-circle-outline" size={18} color={AppColors.textMedium} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* â”€â”€ Contact Info â”€â”€ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="call-outline" size={16} color={AppColors.primary} /> Contact Information
            </Text>

            <Field
              label="Email"
              required
              value={email}
              onChangeText={setEmail}
              placeholder="contact@yourorg.com"
              keyboardType="email-address"
            />
            <Field
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+33 6 12 34 56 78"
              keyboardType="phone-pad"
            />
            <Field
              label="Website"
              value={website}
              onChangeText={setWebsite}
              placeholder="https://yourorganization.com"
              keyboardType="url"
            />
            <Field
              label="Address"
              required
              value={address}
              onChangeText={setAddress}
              placeholder="Full address of the association..."
            />
            <Field
              label="Established Date"
              value={establishedDate}
              onChangeText={setEstablishedDate}
              placeholder="e.g. 2019-03-15"
            />
          </View>

          {/* â”€â”€ Social Media â”€â”€ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="share-social-outline" size={16} color={AppColors.primary} /> Social Media
            </Text>

            {[
              { label: 'Facebook URL', icon: 'logo-facebook', value: facebook, setter: setFacebook, placeholder: 'https://facebook.com/yourpage' },
              { label: 'Instagram URL', icon: 'logo-instagram', value: instagram, setter: setInstagram, placeholder: 'https://instagram.com/yourpage' },
              { label: 'Twitter / X URL', icon: 'logo-twitter', value: twitter, setter: setTwitter, placeholder: 'https://x.com/yourpage' },
              { label: 'LinkedIn URL', icon: 'logo-linkedin', value: linkedin, setter: setLinkedin, placeholder: 'https://linkedin.com/company/yourpage' },
            ].map(({ label, icon, value, setter, placeholder }) => (
              <View key={label} style={styles.fieldGroup}>
                <SectionLabel label={label} />
                <View style={styles.socialInputRow}>
                  <View style={styles.socialIconBox}>
                    <Ionicons name={icon as any} size={18} color={AppColors.primary} />
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                    value={value}
                    onChangeText={setter}
                    placeholder={placeholder}
                    placeholderTextColor={AppColors.textLight}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            ))}
          </View>

          {/* â”€â”€ Privacy â”€â”€ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="lock-closed-outline" size={16} color={AppColors.primary} /> Privacy Settings
            </Text>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Private Association</Text>
                <Text style={styles.switchDesc}>
                  When private, members can only join by invitation or approved request.
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: '#E5E7EB', true: AppColors.primary + '60' }}
                thumbColor={isPrivate ? AppColors.primary : '#9CA3AF'}
              />
            </View>
          </View>

          {/* â”€â”€ Create Button â”€â”€ */}
          <TouchableOpacity
            style={[styles.createBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.createBtnText}>{isEditMode ? 'Save Changes' : 'Create Association'}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: AppColors.primary,
  },
  submitHdrBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  submitHdrText: { color: 'white', fontWeight: '700', fontSize: 14 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 14,
  },

  label: { fontSize: 13, fontWeight: '600', color: AppColors.textMedium, marginBottom: 6, marginTop: 2 },
  labelRequired: { color: AppColors.error },
  fieldGroup: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: AppColors.textDark,
    backgroundColor: '#FAFAFA',
  },
  inputMultiline: {
    height: 100,
    paddingTop: 12,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cover image
  coverPickerBox: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    marginBottom: 14,
    position: 'relative',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverPickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverPickerText: { fontSize: 13, color: AppColors.textMedium, textAlign: 'center' },
  coverPickerOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoPickerBox: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    position: 'relative',
  },
  logoPreview: { width: '100%', height: '100%' },
  logoPickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPickerBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHint: { flex: 1 },
  logoHintText: { fontSize: 13, color: AppColors.textMedium, fontWeight: '500' },
  logoHintSub: { fontSize: 11, color: AppColors.textLight, marginTop: 4 },

  // Categories
  categoryRow: { gap: 8, paddingBottom: 2 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: AppColors.textMedium },
  categoryChipTextActive: { color: 'white' },

  // Focus areas
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: AppColors.primary + '12',
    marginRight: 8,
    borderWidth: 1,
    borderColor: AppColors.primary + '30',
  },
  suggestionChipText: { fontSize: 12, color: AppColors.primary, fontWeight: '600' },
  tagsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  tagText: { fontSize: 13, color: AppColors.primary, fontWeight: '600' },
  tagRemove: { padding: 2 },

  // Achievements
  achievementList: { gap: 8, marginTop: 4 },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  achievementText: { flex: 1, fontSize: 13, color: AppColors.textDark },

  // Social
  socialInputRow: { flexDirection: 'row', alignItems: 'center' },
  socialIconBox: {
    width: 44,
    height: 44,
    backgroundColor: AppColors.primary + '12',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRightWidth: 0,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Privacy
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchInfo: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: AppColors.textDark },
  switchDesc: { fontSize: 12, color: AppColors.textMedium, marginTop: 4, lineHeight: 17 },

  // Submit
  createBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
