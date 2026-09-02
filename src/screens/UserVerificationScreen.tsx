import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { AppColors } from '../theme/colors';
import userVerificationService, { UserVerificationStatus } from '../services/userVerificationService';
import { useAuth } from '../context/AuthContext';
import { COUNTRIES, CountryData, DEFAULT_COUNTRY } from '../constants/countries';

export default function UserVerificationScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<UserVerificationStatus | null>(null);

  // Phone Verification State
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(DEFAULT_COUNTRY);
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSentVia, setCodeSentVia] = useState<'sms' | 'email'>('sms');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Auto-detect country from user's phone if already on profile
  useEffect(() => {
    const phone = user?.phone;
    if (phone) {
      const matched = COUNTRIES.find(c => phone.startsWith(c.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        setLocalPhoneNumber(phone.slice(matched.dialCode.length).trim());
      } else {
        setLocalPhoneNumber(phone);
      }
    }
  }, [user?.phone]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Action Loading for document / selfie uploads
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await userVerificationService.getVerificationStatus();
      if (data) {
        setStatus(data);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  // 1. Phone Verification flow
  const handleSendPhoneCode = async () => {
    const cleanNumber = localPhoneNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber) {
      Alert.alert('Required', `Please enter your mobile phone number (e.g. ${selectedCountry.example}).`);
      return;
    }
    const fullPhoneNumber = `${selectedCountry.dialCode}${cleanNumber}`;
    setPhoneLoading(true);
    try {
      const res = await userVerificationService.submitPhoneVerification(fullPhoneNumber, {
        code: selectedCountry.code,
        name: selectedCountry.name,
        dialCode: selectedCountry.dialCode,
        region: selectedCountry.region,
      });
      if (res && (res.success || res.status === 200)) {
        setCodeSent(true);
        setCodeSentVia(res.provider === 'email_fallback' ? 'email' : 'sms');
        setResendCooldown(60);
        Alert.alert(
          res.provider === 'email_fallback' ? 'Code Sent to Email' : 'Code Sent via SMS',
          res.message || `Verification code sent to ${fullPhoneNumber}`
        );
      } else {
        Alert.alert('Notice', res?.message || 'Verification code dispatched.');
        setCodeSent(true);
        setResendCooldown(60);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send SMS code.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleSendViaEmail = async () => {
    setPhoneLoading(true);
    try {
      const res = await userVerificationService.resendPhoneVerificationEmail();
      if (res && res.success) {
        setCodeSentVia('email');
        setResendCooldown(60);
        Alert.alert('Email Sent', res.message || `Verification code sent to ${user?.email || 'your registered email'}`);
      } else {
        Alert.alert('Notice', res?.message || 'Code sent via email.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send code via email.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Required', 'Please enter the 6-digit verification code received.');
      return;
    }
    setPhoneLoading(true);
    try {
      const res = await userVerificationService.verifyPhoneCode(otpCode.trim());
      if (res && res.success) {
        Alert.alert('Verified! 🎉', 'Your phone number has been verified successfully.');
        setPhoneModalVisible(false);
        setCodeSent(false);
        setOtpCode('');
        fetchStatus();
      } else {
        Alert.alert('Verification Failed', res?.message || 'Invalid or expired verification code.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Verification code failed.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // 2. ID Document upload
  const handlePickIdDocument = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow gallery access to upload your government ID.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setUploadingDoc(true);
      try {
        const res = await userVerificationService.submitIdVerification([uri]);
        if (res && res.success) {
          Alert.alert('Submitted', 'Government ID document submitted! Our safety team will review it shortly.');
          fetchStatus();
        } else {
          Alert.alert('Error', res?.message || 'Failed to submit ID document.');
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Upload failed.');
      } finally {
        setUploadingDoc(false);
      }
    }
  };

  // 3. Face match selfie upload
  const handlePickSelfie = async () => {
    Alert.alert('Face Match Selfie', 'Take or select a clear photo of your face for identity confirmation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Camera',
        onPress: async () => {
          const camPerm = await ImagePicker.requestCameraPermissionsAsync();
          if (!camPerm.granted) {
            Alert.alert('Permission Needed', 'Camera access is required.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets && result.assets.length > 0) {
            uploadSelfie(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Photo Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets && result.assets.length > 0) {
            uploadSelfie(result.assets[0].uri);
          }
        },
      },
    ]);
  };

  const uploadSelfie = async (uri: string) => {
    setUploadingDoc(true);
    try {
      const res = await userVerificationService.submitFaceMatch(uri);
      if (res && res.success) {
        Alert.alert('Submitted', 'Selfie face match submitted successfully for review.');
        fetchStatus();
      } else {
        Alert.alert('Error', res?.message || 'Failed to submit selfie.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Selfie upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleVerificationPress = (type: string, itemStatus: string) => {
    if (itemStatus === 'pending') {
      Alert.alert('Pending Review ⏳', 'Our safety & compliance team is reviewing this document. We will notify you once verified.');
      return;
    }

    switch (type) {
      case 'phone':
        setPhoneModalVisible(true);
        break;
      case 'id':
        handlePickIdDocument();
        break;
      case 'face':
        handlePickSelfie();
        break;
      case 'license':
        navigation.navigate('DriverLicenseVerification');
        break;
      case 'vehicle':
        navigation.navigate('VehicleVerification');
        break;
    }
  };

  if (loading || uploadingDoc) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>
          {uploadingDoc ? 'Uploading verification document...' : 'Fetching verification status...'}
        </Text>
      </View>
    );
  }

  const progress = status ? status.verification_progress : 0;
  const isFullyVerified = status ? status.is_fully_verified : false;

  const renderStatusBadge = (itemStatus: string) => {
    switch (itemStatus) {
      case 'verified':
        return (
          <View style={[styles.badge, styles.badgeVerified]}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={[styles.badgeText, { color: '#047857' }]}>Verified</Text>
          </View>
        );
      case 'pending':
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Ionicons name="time" size={14} color="#F59E0B" />
            <Text style={[styles.badgeText, { color: '#B45309' }]}>Pending Review</Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.badge, styles.badgeRejected]}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={[styles.badgeText, { color: '#B91C1C' }]}>Rejected</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.badgeNotSubmitted]}>
            <Ionicons name="ellipse-outline" size={14} color="#9CA3AF" />
            <Text style={[styles.badgeText, { color: '#4B5563' }]}>Not Submitted</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver & Profile Verification</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
      >
        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={[styles.progressCircle, isFullyVerified && styles.progressCircleVerified]}>
            <Ionicons
              name={isFullyVerified ? 'shield-checkmark' : 'shield-half-outline'}
              size={36}
              color={isFullyVerified ? '#10B981' : AppColors.primary}
            />
          </View>

          <Text style={styles.statusTitle}>
            {isFullyVerified ? "You're a Fully Verified Driver! 🛡️" : 'Complete Driver Verification'}
          </Text>
          <Text style={styles.statusDesc}>
            {isFullyVerified
              ? "You've successfully completed all trust checks. You can now publish car share rides and offer seats."
              : 'Complete the trust layers below to verify your driver profile and publish rides on Ekenox.'}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}% Complete</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>5 Independent Trust Layers</Text>

        <View style={styles.stepsGroup}>
          {/* Step 1: Phone */}
          <TouchableOpacity
            style={styles.stepRow}
            onPress={() => handleVerificationPress('phone', status?.phone_verification || 'not_submitted')}
          >
            <View style={styles.stepLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="call" size={20} color={AppColors.primary} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepName}>Phone Verification</Text>
                <Text style={styles.stepDesc}>OTP verification for contactability</Text>
              </View>
            </View>
            <View style={styles.stepRight}>
              {renderStatusBadge(status?.phone_verification || 'not_submitted')}
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </View>
          </TouchableOpacity>

          {/* Step 2: ID verification */}
          <TouchableOpacity
            style={styles.stepRow}
            onPress={() => handleVerificationPress('id', status?.id_verification || 'not_submitted')}
          >
            <View style={styles.stepLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="card" size={20} color={AppColors.primary} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepName}>Government ID Document</Text>
                <Text style={styles.stepDesc}>Submit national ID or passport</Text>
              </View>
            </View>
            <View style={styles.stepRight}>
              {renderStatusBadge(status?.id_verification || 'not_submitted')}
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </View>
          </TouchableOpacity>

          {/* Step 3: Face match */}
          <TouchableOpacity
            style={styles.stepRow}
            onPress={() => handleVerificationPress('face', status?.face_match_verification || 'not_submitted')}
          >
            <View style={styles.stepLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="scan" size={20} color={AppColors.primary} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepName}>Face Match Selfie</Text>
                <Text style={styles.stepDesc}>Facial confirmation against ID</Text>
              </View>
            </View>
            <View style={styles.stepRight}>
              {renderStatusBadge(status?.face_match_verification || 'not_submitted')}
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </View>
          </TouchableOpacity>

          {/* Step 4: Driver license */}
          <TouchableOpacity
            style={styles.stepRow}
            onPress={() => handleVerificationPress('license', status?.driver_license_verification || 'not_submitted')}
          >
            <View style={styles.stepLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="ribbon" size={20} color={AppColors.primary} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepName}>Driver's License</Text>
                <Text style={styles.stepDesc}>Verify driving authorization</Text>
              </View>
            </View>
            <View style={styles.stepRight}>
              {renderStatusBadge(status?.driver_license_verification || 'not_submitted')}
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </View>
          </TouchableOpacity>

          {/* Step 5: Vehicle documents */}
          <TouchableOpacity
            style={styles.stepRow}
            onPress={() => handleVerificationPress('vehicle', status?.vehicle_documents_verification || 'not_submitted')}
          >
            <View style={styles.stepLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="car-sport" size={20} color={AppColors.primary} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepName}>Vehicle Registration & Insurance</Text>
                <Text style={styles.stepDesc}>Registration certificate and insurance card</Text>
              </View>
            </View>
            <View style={styles.stepRight}>
              {renderStatusBadge(status?.vehicle_documents_verification || 'not_submitted')}
              <Ionicons name="chevron-forward" size={16} color={AppColors.textLight} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color="#059669" />
          <Text style={styles.infoText}>
            Safety First: Admins verify KYC documents independently. Your personal data is encrypted and never shared publicly without consent.
          </Text>
        </View>
      </ScrollView>

      {/* ── Phone OTP Modal ── */}
      <Modal visible={phoneModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Phone Number Verification</Text>
              <TouchableOpacity
                onPress={() => {
                  setPhoneModalVisible(false);
                  setCodeSent(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {!codeSent ? (
              <>
                <Text style={styles.modalDesc}>
                  Select your country and enter your mobile number to receive a verification code:
                </Text>

                {/* Country + Local Phone Input Row */}
                <View style={styles.phoneInputRow}>
                  <TouchableOpacity
                    style={styles.countryPickerBtn}
                    onPress={() => {
                      setCountrySearchQuery('');
                      setCountryPickerVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.countryPickerFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryPickerDialCode}>{selectedCountry.dialCode}</Text>
                    <Ionicons name="chevron-down" size={14} color="#64748B" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.phoneTextInput}
                    placeholder={`e.g. ${selectedCountry.example}`}
                    placeholderTextColor="#94A3B8"
                    value={localPhoneNumber}
                    onChangeText={setLocalPhoneNumber}
                    keyboardType="phone-pad"
                    autoFocus
                  />
                </View>

                {/* Full Number Preview */}
                <View style={styles.phonePreviewBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#059669" />
                  <Text style={styles.phonePreviewText}>
                    Full number: <Text style={{ fontWeight: '800', color: '#006D40' }}>{selectedCountry.dialCode} {localPhoneNumber || selectedCountry.example}</Text>
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSubmitBtn}
                    onPress={handleSendPhoneCode}
                    disabled={phoneLoading}
                    activeOpacity={0.8}
                  >
                    {phoneLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Send Verification Code</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.codeSentBanner}>
                  <Ionicons
                    name={codeSentVia === 'email' ? 'mail' : 'chatbubble-ellipses'}
                    size={18}
                    color="#006D40"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.codeSentBannerText}>
                    {codeSentVia === 'email'
                      ? `Code dispatched to your registered email: ${user?.email}`
                      : `Code sent via SMS to ${selectedCountry.dialCode} ${localPhoneNumber}`}
                  </Text>
                </View>

                <Text style={styles.modalDesc}>
                  Enter the 6-digit verification code below:
                </Text>

                <TextInput
                  style={styles.otpInput}
                  placeholder="123456"
                  placeholderTextColor="#CBD5E1"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSubmitBtn}
                    onPress={handleVerifyOtp}
                    disabled={phoneLoading}
                    activeOpacity={0.8}
                  >
                    {phoneLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Confirm Code</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Resend & Email Fallback Options */}
                <View style={styles.resendActionsContainer}>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleSendPhoneCode}
                    disabled={phoneLoading || resendCooldown > 0}
                  >
                    <Ionicons name="refresh-outline" size={14} color={resendCooldown > 0 ? '#94A3B8' : AppColors.primary} />
                    <Text style={[styles.resendBtnText, resendCooldown > 0 && { color: '#94A3B8' }]}>
                      {resendCooldown > 0 ? `Resend SMS (${resendCooldown}s)` : 'Resend SMS'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emailFallbackBtn}
                    onPress={handleSendViaEmail}
                    disabled={phoneLoading}
                  >
                    <Ionicons name="mail-outline" size={14} color="#0284C7" />
                    <Text style={styles.emailFallbackBtnText}>Send code to Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.changePhoneBtn}
                    onPress={() => {
                      setCodeSent(false);
                      setOtpCode('');
                    }}
                  >
                    <Text style={styles.changePhoneBtnText}>Change phone number</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Country Selector Modal ── */}
      <Modal visible={countryPickerVisible} transparent animationType="slide">
        <SafeAreaView style={styles.countryPickerModalOverlay}>
          <View style={styles.countryPickerCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Country Search Bar */}
            <View style={styles.countrySearchWrap}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.countrySearchInput}
                placeholder="Search country or dial code..."
                placeholderTextColor="#94A3B8"
                value={countrySearchQuery}
                onChangeText={setCountrySearchQuery}
                autoFocus
              />
              {!!countrySearchQuery && (
                <TouchableOpacity onPress={() => setCountrySearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Country List */}
            <FlatList
              data={COUNTRIES.filter(c =>
                c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
                c.dialCode.includes(countrySearchQuery) ||
                c.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
              )}
              keyExtractor={item => `${item.code}_${item.dialCode}`}
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCountry.code && item.dialCode === selectedCountry.dialCode;
                return (
                  <TouchableOpacity
                    style={[styles.countryRow, isSelected && styles.countryRowSelected]}
                    onPress={() => {
                      setSelectedCountry(item);
                      setCountryPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.countryRowFlag}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.countryRowName, isSelected && { color: AppColors.primary, fontWeight: '800' }]}>
                        {item.name}
                      </Text>
                      <Text style={styles.countryRowExample}>e.g. {item.example}</Text>
                    </View>
                    <Text style={[styles.countryRowDialCode, isSelected && { color: AppColors.primary, fontWeight: '800' }]}>
                      {item.dialCode}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={AppColors.primary} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F7' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#4B5563' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: AppColors.textDark },

  scrollContent: { padding: 16, paddingBottom: 40 },
  statusCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4, marginBottom: 20,
  },
  progressCircle: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  progressCircleVerified: { backgroundColor: '#D1FAE5' },
  statusTitle: { fontSize: 17, fontWeight: '800', color: '#1F2937', marginBottom: 6, textAlign: 'center' },
  statusDesc: { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 18, marginBottom: 16, paddingHorizontal: 8 },
  progressContainer: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14,
  },
  progressBarWrapper: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', marginRight: 12, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4, backgroundColor: AppColors.primary },
  progressText: { fontSize: 12, fontWeight: '700', color: '#374151' },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#374151', marginBottom: 10, paddingLeft: 4, textTransform: 'uppercase' },
  stepsGroup: {
    backgroundColor: 'white', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2, marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  stepLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  iconContainer: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  stepText: { marginLeft: 12, flex: 1 },
  stepName: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  stepDesc: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  stepRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeVerified: { backgroundColor: '#D1FAE5' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeRejected: { backgroundColor: '#FEE2E2' },
  badgeNotSubmitted: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 10, fontWeight: '700' },

  infoBox: { flexDirection: 'row', backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  infoText: { flex: 1, fontSize: 11, color: '#047857', lineHeight: 16, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', width: '100%', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: AppColors.textDark },
  modalDesc: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },

  // Phone input row
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  countryPickerFlag: { fontSize: 20, marginRight: 6 },
  countryPickerDialCode: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  phoneTextInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  phonePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 18,
    gap: 6,
  },
  phonePreviewText: {
    fontSize: 12,
    color: '#166534',
  },

  // OTP banner & input
  codeSentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  codeSentBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 12,
    height: 56,
    letterSpacing: 10,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '900',
    color: '#065F46',
    marginBottom: 16,
  },

  modalActions: { flexDirection: 'row', marginTop: 4 },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  modalSubmitText: { color: 'white', fontWeight: '800', fontSize: 15 },

  // Resend actions
  resendActionsContainer: {
    marginTop: 16,
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primary,
  },
  emailFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    width: '100%',
    justifyContent: 'center',
  },
  emailFallbackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  changePhoneBtn: {
    paddingVertical: 4,
  },
  changePhoneBtnText: {
    fontSize: 12,
    color: '#64748B',
    textDecorationLine: 'underline',
  },

  // Country Picker Modal
  countryPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  countryPickerCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '80%',
  },
  countrySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginVertical: 12,
  },
  countrySearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  countryRowSelected: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  countryRowFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  countryRowExample: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  countryRowDialCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
});
