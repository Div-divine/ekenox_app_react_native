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
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppColors } from '../theme/colors';
import driverLicenseService, { DriverLicense } from '../services/driverLicenseService';

export default function DriverLicenseVerificationScreen() {
  const navigation = useNavigation<any>();

  // State values
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseClass, setLicenseClass] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date>(new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000)); // 5 years from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [licenseImageUri, setLicenseImageUri] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingLicense, setExistingLicense] = useState<DriverLicense | null>(null);

  useEffect(() => {
    const loadLicense = async () => {
      setLoading(true);
      try {
        const license = await driverLicenseService.getDriverLicense();
        if (license) {
          setExistingLicense(license);
          setLicenseNumber(license.licenseNumber);
          setLicenseClass(license.licenseClass);
          setIssuingAuthority(license.issuingAuthority);
          setExpiryDate(new Date(license.expiryDate));
          if (license.imagePath) {
            setLicenseImageUri(license.imagePath);
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    loadLicense();
  }, []);

  const handlePickImage = async (useCamera = false) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          `Ekenox needs permission to access your ${useCamera ? 'camera' : 'photo library'} to upload your driver's license.`
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            allowsMultipleSelection: true,
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLicenseImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  };

  const handleShowImageOptions = () => {
    Alert.alert('Upload License Photo', 'Choose an option to submit your photo:', [
      { text: 'Take Photo', onPress: () => handlePickImage(true) },
      { text: 'Choose from Gallery', onPress: () => handlePickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!licenseNumber.trim() || !licenseClass.trim() || !issuingAuthority.trim()) {
      Alert.alert('Required Fields', 'Please fill out all driver license information details.');
      return;
    }

    if (!licenseImageUri) {
      Alert.alert('License Photo Required', 'Please submit a clear photo of your driver license.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = expiryDate.toISOString().split('T')[0];
      const payload = {
        licenseNumber: licenseNumber.trim(),
        licenseClass: licenseClass.trim(),
        issuingAuthority: issuingAuthority.trim(),
        expiryDate: formattedDate,
      };

      let result;
      if (existingLicense) {
        result = await driverLicenseService.updateDriverLicense(payload);
      } else {
        result = await driverLicenseService.createDriverLicense(payload);
      }

      if (result.success) {
        // Upload photo if it has been updated locally
        if (licenseImageUri && !licenseImageUri.startsWith('http') && !licenseImageUri.startsWith('uploads/')) {
          const imageResult = await driverLicenseService.uploadLicenseImage(licenseImageUri);
          if (!imageResult.success) {
            Alert.alert(
              'License Registered',
              'Driver license details saved, but photo upload failed. Please try re-uploading the photo.'
            );
            setIsSubmitting(false);
            return;
          }
        }

        Alert.alert('Success', 'Driver license verification documents submitted successfully for admin review!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to submit driver license details.');
      }
    } catch (err: any) {
      Alert.alert('Error', 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setExpiryDate(selectedDate);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver's License Details</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Top Banner Alert */}
          <View style={styles.stepBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.stepBannerText}>Step 4 of 5: Driver License Details</Text>
          </View>

          <Text style={styles.sectionHeader}>License Details</Text>

          {/* Form Fields */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>License Number *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="barcode-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter license number"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>License Class *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="document-text-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g., Class C, Class A"
                value={licenseClass}
                onChangeText={setLicenseClass}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Issuing Authority *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="business-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g., DMV, State Dept"
                value={issuingAuthority}
                onChangeText={setIssuingAuthority}
              />
            </View>
          </View>

          {/* Expiry Date picker */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>License Expiry Date *</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <Text style={styles.datePickerText}>{expiryDate.toLocaleDateString()}</Text>
              <Ionicons name="chevron-down" size={16} color={AppColors.textLight} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={expiryDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}
          </View>

          {/* Image Upload section */}
          <Text style={styles.sectionHeader}>License Photo</Text>

          {licenseImageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{
                  uri:
                    licenseImageUri.startsWith('http') || licenseImageUri.startsWith('uploads/')
                      ? `${driverLicenseService['baseUrl']}/../${licenseImageUri}`
                      : licenseImageUri,
                }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <TouchableOpacity style={styles.changeImageBtn} onPress={handleShowImageOptions}>
                <Ionicons name="camera" size={16} color="white" />
                <Text style={styles.changeImageBtnText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholder} onPress={handleShowImageOptions}>
              <View style={styles.uploadCircle}>
                <Ionicons name="camera" size={32} color={AppColors.primary} />
              </View>
              <Text style={styles.uploadTitle}>Add Driver License Photo</Text>
              <Text style={styles.uploadDesc}>Take a clear photo of the front side of your license</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.warningHint}>
            Please ensure the photo is clear, all details are legible, and no information is covered or blurry.
          </Text>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitBtnText}>Submit for Review</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
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
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 24,
  },
  stepBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
    paddingLeft: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#1F2937',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  changeImageBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeImageBtnText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  uploadPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AppColors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    marginBottom: 12,
  },
  uploadCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.primary,
    marginBottom: 4,
  },
  uploadDesc: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  warningHint: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    marginBottom: 32,
    paddingHorizontal: 2,
  },
  submitBtn: {
    backgroundColor: AppColors.primary,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
});
