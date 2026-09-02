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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppColors } from '../theme/colors';
import vehicleService, { Vehicle } from '../services/vehicleService';
import userVerificationService, { UserVerificationStatus } from '../services/userVerificationService';
import driverLicenseService from '../services/driverLicenseService';
import { UrlHelper } from '../utils/urlHelper';

export default function VehicleVerificationScreen() {
  const navigation = useNavigation<any>();

  // State values
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regExpiry, setRegExpiry] = useState<Date>(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [insExpiry, setInsExpiry] = useState<Date>(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

  const [activeDatePicker, setActiveDatePicker] = useState<'registration' | 'insurance' | null>(null);
  const [photosUris, setPhotosUris] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingVehicle, setExistingVehicle] = useState<Vehicle | null>(null);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);

  useEffect(() => {
    const loadVehicleAndPrereqs = async () => {
      setLoading(true);
      try {
        const [vehicles, vStatus, license] = await Promise.all([
          vehicleService.getVehicles().catch(() => []),
          userVerificationService.getVerificationStatus().catch(() => null),
          driverLicenseService.getDriverLicense().catch(() => null),
        ]);

        const missing: string[] = [];
        if (vStatus) {
          if (vStatus.phone_verification !== 'verified') missing.push('Phone Verification');
          if (vStatus.id_verification !== 'verified') missing.push('Government ID Document');
          if (vStatus.face_match_verification !== 'verified') missing.push('Face Match Selfie');
          if (vStatus.email_verification !== 'verified') missing.push('Email Verification');
        } else {
          missing.push('User Profile Verifications');
        }

        if (!license || !license.verified) {
          missing.push("Approved Driver's License");
        }
        setMissingRequirements(missing);

        if (vehicles && vehicles.length > 0) {
          const mainVehicle: any = vehicles[0]; // take the first registered vehicle
          setExistingVehicle(mainVehicle);
          setMake(mainVehicle.make || '');
          setModel(mainVehicle.model || '');
          setYear(String(mainVehicle.year || ''));
          setColor(mainVehicle.color || '');
          setLicensePlate(mainVehicle.license_plate || mainVehicle.licensePlate || '');
          setRegNumber(mainVehicle.registration_number || mainVehicle.registrationNumber || '');
          const regExp = mainVehicle.registration_expiry || mainVehicle.registrationExpiry;
          if (regExp) {
            setRegExpiry(new Date(regExp));
          }
          setInsuranceProvider(mainVehicle.insurance_provider || mainVehicle.insuranceProvider || '');
          setInsurancePolicy(mainVehicle.insurance_policy_number || mainVehicle.insurancePolicyNumber || '');
          const insExp = mainVehicle.insurance_expiry || mainVehicle.insuranceExpiry;
          if (insExp) {
            setInsExpiry(new Date(insExp));
          }
          const pUrls = mainVehicle.photo_urls ?? mainVehicle.photoUrls;
          if (pUrls) {
            const arr = Array.isArray(pUrls) ? pUrls : (typeof pUrls === 'string' ? JSON.parse(pUrls) : []);
            setPhotosUris(arr);
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    loadVehicleAndPrereqs();
  }, []);

  const handlePickPhotos = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Ekenox needs permission to access your gallery to upload vehicle photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 4,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map(asset => asset.uri);
        setPhotosUris(prev => [...prev, ...uris]);
      }
    } catch (e) {
      console.warn('Photos picking error:', e);
    }
  };

  const handleDeletePhoto = async (index: number) => {
    const photoUrl = photosUris[index];

    // If it is a remote photo, call backend to delete
    if (existingVehicle && (photoUrl.startsWith('http') || photoUrl.startsWith('uploads/'))) {
      Alert.alert('Delete Photo', 'Are you sure you want to permanently delete this vehicle photo?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await vehicleService.deleteVehiclePhoto(existingVehicle.id, photoUrl);
              if (res.success) {
                setPhotosUris(prev => prev.filter((_, i) => i !== index));
              } else {
                Alert.alert('Error', res.message || 'Failed to delete photo.');
              }
            } catch (err) {
              console.warn(err);
            } finally {
              setLoading(false);
            }
          },
        },
      ]);
    } else {
      setPhotosUris(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!existingVehicle && missingRequirements.length > 0) {
      Alert.alert(
        'Prerequisites Required',
        `To register a vehicle, all identity verifications and driver's license approval must be completed first.\n\nIncomplete requirements:\n• ${missingRequirements.join('\n• ')}`,
        [
          { text: 'Complete Verifications', onPress: () => navigation.navigate('UserVerification') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (!make.trim() || !model.trim() || !year.trim() || !licensePlate.trim()) {
      Alert.alert('Required Fields', 'Please fill in make, model, year, and license plate.');
      return;
    }

    setIsSubmitting(true);
    try {
      const vehiclePayload = {
        make: make.trim(),
        model: model.trim(),
        year: year.trim(),
        color: color.trim(),
        license_plate: licensePlate.trim(),
        registration_number: regNumber.trim(),
        registration_expiry: regExpiry.toISOString().split('T')[0],
        insurance_provider: insuranceProvider.trim(),
        insurance_policy_number: insurancePolicy.trim(),
        insurance_expiry: insExpiry.toISOString().split('T')[0],
      };

      let result;
      if (existingVehicle) {
        result = await vehicleService.updateVehicle(existingVehicle.id, vehiclePayload);
      } else {
        result = await vehicleService.createVehicle(vehiclePayload);
      }

      if (result.success && result.data) {
        const vehicleId = result.data.id;

        // Find local photos to upload
        const localPhotos = photosUris.filter(
          uri => !uri.startsWith('http') && !uri.startsWith('uploads/')
        );

        if (localPhotos.length > 0) {
          const uploadResult = await vehicleService.uploadVehiclePhotos(vehicleId, localPhotos);
          if (!uploadResult.success) {
            Alert.alert('Registered', 'Vehicle details saved, but uploading some photos failed.');
            setIsSubmitting(false);
            return;
          }
        }

        Alert.alert('Success', 'Vehicle registered successfully for verification!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to submit vehicle details.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const type = activeDatePicker;
    setActiveDatePicker(null);

    if (selectedDate) {
      if (type === 'registration') {
        setRegExpiry(selectedDate);
      } else if (type === 'insurance') {
        setInsExpiry(selectedDate);
      }
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
          <Text style={styles.headerTitle}>Vehicle Details</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Top Banner Alert */}
          <View style={styles.stepBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.stepBannerText}>Step 5 of 5: Vehicle Registration</Text>
          </View>

          {/* Missing Prerequisites Alert Box */}
          {!existingVehicle && missingRequirements.length > 0 && (
            <View style={styles.prereqBox}>
              <View style={styles.prereqHeader}>
                <Ionicons name="alert-circle" size={20} color="#D97706" />
                <Text style={styles.prereqTitle}>Verifications Required</Text>
              </View>
              <Text style={styles.prereqText}>
                Before registering a vehicle, you must complete your driver profile verifications:
              </Text>
              {missingRequirements.map((req, idx) => (
                <View key={idx} style={styles.prereqRow}>
                  <Ionicons name="close-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.prereqItemText}>{req}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.prereqActionBtn}
                onPress={() => navigation.navigate('UserVerification')}
                activeOpacity={0.8}
              >
                <Text style={styles.prereqActionText}>Complete Driver Verification</Text>
                <Ionicons name="arrow-forward" size={15} color="#006D40" />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionHeader}>Vehicle Specifications</Text>

          {/* Form Fields */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Make *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="construct-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="e.g., Toyota" value={make} onChangeText={setMake} />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Model *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="car-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="e.g., Camry" value={model} onChangeText={setModel} />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Year *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 2021"
                  value={year}
                  onChangeText={setYear}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Color</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="e.g., White" value={color} onChangeText={setColor} />
              </View>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>License Plate *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="card-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g., AB-123-CD"
                value={licensePlate}
                onChangeText={setLicensePlate}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Text style={styles.sectionHeader}>Registration & Insurance</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Registration Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="document-text-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Registration Certificate / Card No."
                value={regNumber}
                onChangeText={setRegNumber}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Registration Expiry *</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setActiveDatePicker('registration')}>
              <Ionicons name="calendar-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <Text style={styles.datePickerText}>{regExpiry.toLocaleDateString()}</Text>
              <Ionicons name="chevron-down" size={16} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Insurance Provider</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="business-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Insurance Company Name"
                value={insuranceProvider}
                onChangeText={setInsuranceProvider}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Insurance Policy Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="shield-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Policy Number"
                value={insurancePolicy}
                onChangeText={setInsurancePolicy}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Insurance Expiry *</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setActiveDatePicker('insurance')}>
              <Ionicons name="calendar-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <Text style={styles.datePickerText}>{insExpiry.toLocaleDateString()}</Text>
              <Ionicons name="chevron-down" size={16} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>

          {activeDatePicker && (
            <DateTimePicker
              value={activeDatePicker === 'registration' ? regExpiry : insExpiry}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          <Text style={styles.sectionHeader}>Vehicle Photos (Optional)</Text>

          {photosUris.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosScroll}>
                {photosUris.map((uri, idx) => (
                  <View key={idx} style={styles.photoContainer}>
                    <Image
                      source={{
                        uri:
                          uri.startsWith('http') || uri.startsWith('uploads/') || uri.startsWith('vehicle_')
                            ? UrlHelper.convertPathToUrl(uri)
                            : uri,
                      }}
                      style={styles.photoThumb}
                    />
                    <TouchableOpacity style={styles.deletePhotoBtn} onPress={() => handleDeletePhoto(idx)}>
                      <Ionicons name="trash" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                {photosUris.length < 4 && (
                  <TouchableOpacity style={styles.addPhotoThumb} onPress={handlePickPhotos}>
                    <Ionicons name="add" size={24} color={AppColors.primary} />
                    <Text style={styles.addPhotoThumbText}>Add Photo</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickPhotos}>
              <View style={styles.uploadCircle}>
                <Ionicons name="images" size={32} color={AppColors.primary} />
              </View>
              <Text style={styles.uploadTitle}>Add Vehicle Photos</Text>
              <Text style={styles.uploadDesc}>Add up to 4 photos showing the exterior and interior</Text>
            </TouchableOpacity>
          )}

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Vehicle Details</Text>
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
    marginTop: 12,
    marginBottom: 16,
    paddingLeft: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  photosScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 10,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  addPhotoThumbText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
    marginTop: 4,
  },
  uploadPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AppColors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    marginBottom: 24,
  },
  uploadCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primary,
    marginBottom: 4,
  },
  uploadDesc: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
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
    marginTop: 16,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  prereqBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: 20,
  },
  prereqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  prereqTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
    marginLeft: 6,
  },
  prereqText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 10,
  },
  prereqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  prereqItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  prereqActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  prereqActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006D40',
    marginRight: 6,
  },
});
