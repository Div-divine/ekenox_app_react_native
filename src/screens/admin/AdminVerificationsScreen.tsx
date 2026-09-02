import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/colors';
import adminService from '../../services/adminService';
import { UrlHelper } from '../../utils/urlHelper';

const { width, height } = Dimensions.get('window');

type SectionTab = 'licenses' | 'vehicles' | 'identities' | 'carshares';
type StatusFilter = 'pending' | 'all';

// Safely extract array of image URLs/paths from various formats (array, JSON string, single string)
const extractImageArray = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field
      .map(item => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return item.url || item.path || item.filename || item.selfie_filename || item.raw_filename || '';
      })
      .filter(Boolean);
  }
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map(item => (typeof item === 'string' ? item : item?.url || item?.path || item?.filename || ''))
            .filter(Boolean);
        }
      } catch (e) {}
    }
    return [trimmed];
  }
  return [];
};

export default function AdminVerificationsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [sectionTab, setSectionTab] = useState<SectionTab>('licenses');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [driverLicenses, setDriverLicenses] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [userVerifications, setUserVerifications] = useState<any[]>([]);
  const [carShares, setCarShares] = useState<any[]>([]);

  // Lightbox Modal state
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);

  // Audit History Log Modal
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditUserName, setAuditUserName] = useState('');

  // Rejection Modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: any; type: 'license' | 'vehicle' | 'id' | 'face' | 'phone'; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await adminService.getVerifications(statusFilter === 'pending' ? 'pending' : undefined);
      if (res && res.success) {
        setDriverLicenses(res.driver_licenses || res.driverLicenses || []);
        setVehicles(res.vehicles || []);
        setUserVerifications(res.user_verifications || res.userVerifications || []);
        setCarShares(res.car_shares || res.carShares || []);
      }
    } catch (e) {
      console.warn('Failed to load verifications', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Approve handlers
  const handleApprove = (id: number, type: 'license' | 'vehicle' | 'id' | 'face' | 'phone', userName: string) => {
    const label =
      type === 'license' ? "Driver's License" :
      type === 'vehicle' ? 'Vehicle Registration & Insurance' :
      type === 'id' ? 'Government ID' :
      type === 'face' ? 'Face Match Selfie' : 'Phone Number';

    Alert.alert(`Approve ${label}`, `Confirm approval of ${label} for ${userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setLoading(true);
          try {
            if (type === 'license') {
              await adminService.verifyDriverLicense(id, true);
            } else if (type === 'vehicle') {
              await adminService.verifyVehicle(id, true);
            } else if (type === 'id') {
              await adminService.verifyIdDocument(id, true);
            } else if (type === 'face') {
              await adminService.verifyFaceMatch(id, true);
            } else if (type === 'phone') {
              await adminService.verifyPhone(id, true);
            }
            Alert.alert('Approved', `${label} verified successfully!`);
            fetchData(true);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Action failed.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // Open rejection modal
  const handleOpenReject = (id: number, type: 'license' | 'vehicle' | 'id' | 'face' | 'phone', userName: string) => {
    setSelectedItem({ id, type, name: userName });
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  // Submit rejection
  const submitReject = async () => {
    if (!selectedItem) return;
    setSubmittingAction(true);
    try {
      if (selectedItem.type === 'license') {
        await adminService.verifyDriverLicense(selectedItem.id, false, rejectionReason);
      } else if (selectedItem.type === 'vehicle') {
        await adminService.verifyVehicle(selectedItem.id, false, rejectionReason);
      } else if (selectedItem.type === 'id') {
        await adminService.verifyIdDocument(selectedItem.id, false, rejectionReason);
      } else if (selectedItem.type === 'face') {
        await adminService.verifyFaceMatch(selectedItem.id, false, rejectionReason);
      } else if (selectedItem.type === 'phone') {
        await adminService.verifyPhone(selectedItem.id, false, rejectionReason);
      }
      setRejectModalVisible(false);
      Alert.alert('Rejected', 'Verification status set to rejected and user notified.');
      fetchData(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Action failed.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Delete Car Share offer
  const handleDeleteCarShare = (id: number) => {
    Alert.alert('Cancel Car Share', 'Remove this ride offer from the platform?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await adminService.deleteCarShare(id);
            Alert.alert('Deleted', 'Car share offer removed.');
            fetchData(true);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete car share.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // Open audit history log
  const openAuditLog = async (userId: number, userName: string) => {
    if (!userId) {
      Alert.alert('Notice', 'User information not available for audit log.');
      return;
    }
    setAuditUserName(userName || 'User');
    setAuditModalVisible(true);
    setAuditLoading(true);
    try {
      const logs = await adminService.getVerificationAuditLog(userId);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (e) {
      console.warn(e);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  // Open document lightbox
  const openImageLightbox = (images: string[], initialIndex = 0) => {
    if (!images || images.length === 0) return;
    const formatted = images
      .filter(Boolean)
      .map(img => (typeof img === 'string' ? UrlHelper.convertPathToUrl(img) : ''))
      .filter(Boolean);
    if (formatted.length === 0) return;
    setPreviewImages(formatted);
    setPreviewActiveIndex(initialIndex >= 0 && initialIndex < formatted.length ? initialIndex : 0);
    setPreviewModalVisible(true);
  };

  // Filter counts with snake_case & camelCase tolerance
  const pendingLicensesCount = driverLicenses.filter(
    l => (l.verification_status ?? l.verificationStatus) === 'pending'
  ).length;
  const pendingVehiclesCount = vehicles.filter(
    v => (v.verification_status ?? v.verificationStatus) === 'pending'
  ).length;
  const pendingIdentitiesCount = userVerifications.filter(
    u =>
      (u.id_verification ?? u.idVerification) === 'pending' ||
      (u.face_match_verification ?? u.faceMatchVerification) === 'pending' ||
      (u.phone_verification ?? u.phoneVerification) === 'pending'
  ).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trust & Verification Hub</Text>
        <TouchableOpacity onPress={() => fetchData(true)} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color={AppColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Section Tabs */}
      <View style={styles.sectionTabBar}>
        <TouchableOpacity
          style={[styles.sectionTabItem, sectionTab === 'licenses' && styles.sectionTabItemActive]}
          onPress={() => setSectionTab('licenses')}
        >
          <Text style={[styles.sectionTabText, sectionTab === 'licenses' && styles.sectionTabTextActive]}>
            🪪 Licenses {pendingLicensesCount > 0 && `(${pendingLicensesCount})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionTabItem, sectionTab === 'vehicles' && styles.sectionTabItemActive]}
          onPress={() => setSectionTab('vehicles')}
        >
          <Text style={[styles.sectionTabText, sectionTab === 'vehicles' && styles.sectionTabTextActive]}>
            🚗 Vehicles {pendingVehiclesCount > 0 && `(${pendingVehiclesCount})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionTabItem, sectionTab === 'identities' && styles.sectionTabItemActive]}
          onPress={() => setSectionTab('identities')}
        >
          <Text style={[styles.sectionTabText, sectionTab === 'identities' && styles.sectionTabTextActive]}>
            👤 Identity {pendingIdentitiesCount > 0 && `(${pendingIdentitiesCount})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionTabItem, sectionTab === 'carshares' && styles.sectionTabItemActive]}
          onPress={() => setSectionTab('carshares')}
        >
          <Text style={[styles.sectionTabText, sectionTab === 'carshares' && styles.sectionTabTextActive]}>
            🚘 Rides ({carShares.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Bar (Pending vs All) */}
      {sectionTab !== 'carshares' && (
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'pending' && styles.filterChipActive]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'pending' && styles.filterChipTextActive]}>
              Pending Review Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>
              All Records
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Fetching verifications...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={[AppColors.primary]} />}
        >
          {/* ── TAB 1: DRIVER LICENSES ── */}
          {sectionTab === 'licenses' && (
            <View>
              {driverLicenses.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No driver license verification requests found.</Text>
                </View>
              ) : (
                driverLicenses.map(license => {
                  const rawImages = license.image_paths ?? license.imagePaths ?? (license.image_path ?? license.imagePath);
                  const images = extractImageArray(rawImages);
                  const status = license.verification_status ?? license.verificationStatus ?? 'pending';
                  const isPending = status === 'pending';
                  const user = license.user || {};
                  const userName = user.full_name ?? user.fullName ?? 'Driver';
                  const userEmail = user.email || 'N/A';
                  const userPhone = user.phone || 'N/A';
                  const licNum = license.license_number ?? license.licenseNumber ?? 'N/A';
                  const licClass = license.license_class ?? license.licenseClass ?? 'B';
                  const licAuth = license.issuing_authority ?? license.issuingAuthority ?? 'N/A';
                  const expDate = license.expiry_date ?? license.expiryDate;
                  const rejectReason = license.rejection_reason ?? license.rejectionReason;

                  return (
                    <View key={license.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName}>{userName}</Text>
                          <Text style={styles.userSub}>Email: {userEmail} • Phone: {userPhone}</Text>
                          <Text style={styles.userSub}>License #: <Text style={styles.boldText}>{licNum}</Text> • Class: {licClass}</Text>
                          <Text style={styles.userSub}>Authority: {licAuth} • Expiry: {expDate ? new Date(expDate).toLocaleDateString() : 'N/A'}</Text>
                        </View>
                        <View style={[styles.badge, isPending ? styles.pendingBadge : styles.approvedBadge]}>
                          <Text style={[styles.badgeText, isPending ? styles.pendingBadgeText : styles.approvedBadgeText]}>
                            {status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Documents Preview Section */}
                      <View style={styles.docSection}>
                        <Text style={styles.docSectionTitle}>🪪 Driver's License Document Photos ({images.length}):</Text>
                        {images.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                            {images.map((img: string, idx: number) => (
                              <TouchableOpacity key={idx} onPress={() => openImageLightbox(images, idx)} style={styles.thumbnailWrapper}>
                                <Image source={{ uri: UrlHelper.convertPathToUrl(img) }} style={styles.docImage} resizeMode="cover" />
                                <View style={styles.docZoomBadge}>
                                  <Ionicons name="scan-outline" size={12} color="white" />
                                  <Text style={styles.docZoomText}>Inspect</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : (
                          <View style={styles.noDocBox}>
                            <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                            <Text style={styles.noDocText}>No license document image uploaded yet</Text>
                          </View>
                        )}
                      </View>

                      {/* Rejection Note Display */}
                      {rejectReason ? (
                        <View style={styles.rejectionNotice}>
                          <Ionicons name="alert-circle" size={14} color="#EF4444" />
                          <Text style={styles.rejectionNoticeText}>Reason: {rejectReason}</Text>
                        </View>
                      ) : null}

                      {/* Card Footer */}
                      <View style={styles.cardFooter}>
                        <TouchableOpacity style={styles.auditBtn} onPress={() => openAuditLog(user.id, userName)}>
                          <Ionicons name="time-outline" size={14} color={AppColors.primary} />
                          <Text style={styles.auditBtnText}>Audit History</Text>
                        </TouchableOpacity>

                        {isPending && (
                          <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleOpenReject(license.id, 'license', userName)}>
                              <Text style={styles.rejectBtnText}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(license.id, 'license', userName)}>
                              <Text style={styles.approveBtnText}>Approve</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ── TAB 2: VEHICLES & INSURANCE ── */}
          {sectionTab === 'vehicles' && (
            <View>
              {vehicles.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="car-outline" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No vehicle verification requests found.</Text>
                </View>
              ) : (
                vehicles.map(v => {
                  const rawPhotos = v.photo_urls ?? v.photoUrls ?? [];
                  const rawRegDocs = v.registration_document_paths ?? v.registrationDocumentPaths ?? [];
                  const rawInsDocs = v.insurance_document_paths ?? v.insuranceDocumentPaths ?? [];

                  const photos = extractImageArray(rawPhotos);
                  const regDocs = extractImageArray(rawRegDocs);
                  const insDocs = extractImageArray(rawInsDocs);
                  const allDocs = [...photos, ...regDocs, ...insDocs];

                  const status = v.verification_status ?? v.verificationStatus ?? 'pending';
                  const isPending = status === 'pending';
                  const user = v.user || {};
                  const userName = user.full_name ?? user.fullName ?? 'Owner';
                  const userEmail = user.email || 'N/A';
                  const plate = v.license_plate ?? v.licensePlate ?? 'N/A';
                  const regNumber = v.registration_number ?? v.registrationNumber ?? 'N/A';
                  const regExpiry = v.registration_expiry ?? v.registrationExpiry;
                  const insProvider = v.insurance_provider ?? v.insuranceProvider ?? 'N/A';
                  const insPolicy = v.insurance_policy_number ?? v.insurancePolicyNumber ?? 'N/A';
                  const insExpiry = v.insurance_expiry ?? v.insuranceExpiry;
                  const rejectReason = v.rejection_reason ?? v.rejectionReason;

                  return (
                    <View key={v.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName}>{v.make} {v.model} ({v.year})</Text>
                          <Text style={styles.userSub}>Plate: <Text style={styles.boldText}>{plate}</Text> • Color: {v.color || 'N/A'}</Text>
                          <Text style={styles.userSub}>Owner: {userName} ({userEmail})</Text>
                          <Text style={styles.userSub}>Reg #: {regNumber} • Exp: {regExpiry ? new Date(regExpiry).toLocaleDateString() : 'N/A'}</Text>
                          <Text style={styles.userSub}>Insurance: {insProvider} • Policy: {insPolicy} {insExpiry ? `(Exp: ${new Date(insExpiry).toLocaleDateString()})` : ''}</Text>
                        </View>
                        <View style={[styles.badge, isPending ? styles.pendingBadge : styles.approvedBadge]}>
                          <Text style={[styles.badgeText, isPending ? styles.pendingBadgeText : styles.approvedBadgeText]}>
                            {status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Vehicle Photos Gallery */}
                      <View style={styles.docSection}>
                        <Text style={styles.docSectionTitle}>📸 Vehicle Photos ({photos.length}) & Certificates ({regDocs.length + insDocs.length}):</Text>
                        {allDocs.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                            {allDocs.map((img: string, idx: number) => (
                              <TouchableOpacity key={idx} onPress={() => openImageLightbox(allDocs, idx)} style={styles.thumbnailWrapper}>
                                <Image source={{ uri: UrlHelper.convertPathToUrl(img) }} style={styles.docImage} resizeMode="cover" />
                                <View style={styles.docZoomBadge}>
                                  <Ionicons name="scan-outline" size={12} color="white" />
                                  <Text style={styles.docZoomText}>Inspect</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : (
                          <View style={styles.noDocBox}>
                            <Ionicons name="car-outline" size={20} color="#9CA3AF" />
                            <Text style={styles.noDocText}>No vehicle photos or certificates uploaded yet</Text>
                          </View>
                        )}
                      </View>

                      {/* Rejection Note Display */}
                      {rejectReason ? (
                        <View style={styles.rejectionNotice}>
                          <Ionicons name="alert-circle" size={14} color="#EF4444" />
                          <Text style={styles.rejectionNoticeText}>Reason: {rejectReason}</Text>
                        </View>
                      ) : null}

                      {/* Card Footer */}
                      <View style={styles.cardFooter}>
                        <TouchableOpacity style={styles.auditBtn} onPress={() => openAuditLog(user.id, userName)}>
                          <Ionicons name="time-outline" size={14} color={AppColors.primary} />
                          <Text style={styles.auditBtnText}>Audit History</Text>
                        </TouchableOpacity>

                        {isPending && (
                          <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleOpenReject(v.id, 'vehicle', userName)}>
                              <Text style={styles.rejectBtnText}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(v.id, 'vehicle', userName)}>
                              <Text style={styles.approveBtnText}>Approve</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ── TAB 3: USER IDENTITY & PHONE ── */}
          {sectionTab === 'identities' && (
            <View>
              {userVerifications.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="shield-checkmark-outline" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No user identity verifications found.</Text>
                </View>
              ) : (
                userVerifications.map(uv => {
                  const user = uv.user || {};
                  const userName = user.full_name ?? user.fullName ?? 'User';
                  const userEmail = user.email || 'N/A';
                  const userPhone = user.phone || 'Not provided';

                  const docsObj = uv.verification_documents ?? uv.verificationDocuments ?? {};
                  const idDocsList = docsObj.id_documents ?? docsObj.idDocuments ?? [];
                  const selfieDoc = docsObj.face_match ?? docsObj.faceMatch ?? {};

                  const idImages = extractImageArray(idDocsList);
                  let selfieImg = '';
                  if (typeof selfieDoc === 'string') {
                    selfieImg = selfieDoc;
                  } else if (selfieDoc) {
                    selfieImg = selfieDoc.selfie_filename || selfieDoc.url || selfieDoc.filename || selfieDoc.path || selfieDoc.raw_filename || '';
                  }
                  const allIdAndSelfie = [...idImages, ...(selfieImg ? [selfieImg] : [])];

                  const idStatus = uv.id_verification ?? uv.idVerification ?? 'not_submitted';
                  const phoneStatus = uv.phone_verification ?? uv.phoneVerification ?? 'not_submitted';
                  const emailStatus = uv.email_verification ?? uv.emailVerification ?? 'not_submitted';
                  const faceMatchStatus = uv.face_match_verification ?? uv.faceMatchVerification ?? 'not_submitted';

                  return (
                    <View key={uv.id || user.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName}>{userName}</Text>
                          <Text style={styles.userSub}>Email: {userEmail}</Text>
                          <Text style={styles.userSub}>Phone: {userPhone}</Text>
                        </View>
                        <View style={styles.identityBadges}>
                          <View style={[styles.microBadge, emailStatus === 'verified' ? styles.microBadgeGreen : styles.microBadgeYellow]}>
                            <Text style={styles.microBadgeText}>Email: {emailStatus}</Text>
                          </View>
                          <View style={[styles.microBadge, phoneStatus === 'verified' ? styles.microBadgeGreen : styles.microBadgeYellow]}>
                            <Text style={styles.microBadgeText}>Phone: {phoneStatus}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Government ID & Selfie Gallery */}
                      <View style={styles.docSection}>
                        <Text style={styles.docSectionTitle}>🪪 Government ID & Face Match Selfie ({allIdAndSelfie.length}):</Text>
                        {allIdAndSelfie.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                            {allIdAndSelfie.map((img: string, idx: number) => (
                              <TouchableOpacity key={idx} onPress={() => openImageLightbox(allIdAndSelfie, idx)} style={styles.thumbnailWrapper}>
                                <Image source={{ uri: UrlHelper.convertPathToUrl(img) }} style={styles.docImage} resizeMode="cover" />
                                <View style={styles.docZoomBadge}>
                                  <Ionicons name="scan-outline" size={12} color="white" />
                                  <Text style={styles.docZoomText}>Inspect</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : (
                          <View style={styles.noDocBox}>
                            <Ionicons name="card-outline" size={20} color="#9CA3AF" />
                            <Text style={styles.noDocText}>No ID document or selfie submitted yet</Text>
                          </View>
                        )}
                      </View>

                      {/* Direct Verification Status & Action Checklist */}
                      <View style={styles.verificationChecklist}>
                        {/* ID Verification Row */}
                        <View style={styles.checklistRow}>
                          <Text style={styles.checkListName}>🪪 Government ID Document:</Text>
                          <View style={styles.checklistActionGroup}>
                            <Text style={[styles.checklistStatusText, idStatus === 'verified' ? styles.textGreen : styles.textYellow]}>
                              {idStatus}
                            </Text>
                            {idStatus === 'pending' && (
                              <View style={styles.miniActionRow}>
                                <TouchableOpacity style={styles.miniApproveBtn} onPress={() => handleApprove(user.id, 'id', userName)}>
                                  <Ionicons name="checkmark" size={14} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.miniRejectBtn} onPress={() => handleOpenReject(user.id, 'id', userName)}>
                                  <Ionicons name="close" size={14} color="white" />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Face Match Row */}
                        <View style={styles.checklistRow}>
                          <Text style={styles.checkListName}>🤳 Face Match Selfie:</Text>
                          <View style={styles.checklistActionGroup}>
                            <Text style={[styles.checklistStatusText, faceMatchStatus === 'verified' ? styles.textGreen : styles.textYellow]}>
                              {faceMatchStatus}
                            </Text>
                            {faceMatchStatus === 'pending' && (
                              <View style={styles.miniActionRow}>
                                <TouchableOpacity style={styles.miniApproveBtn} onPress={() => handleApprove(user.id, 'face', userName)}>
                                  <Ionicons name="checkmark" size={14} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.miniRejectBtn} onPress={() => handleOpenReject(user.id, 'face', userName)}>
                                  <Ionicons name="close" size={14} color="white" />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Phone Verification Row */}
                        <View style={styles.checklistRow}>
                          <Text style={styles.checkListName}>📱 Phone Verification:</Text>
                          <View style={styles.checklistActionGroup}>
                            <Text style={[styles.checklistStatusText, phoneStatus === 'verified' ? styles.textGreen : styles.textYellow]}>
                              {phoneStatus}
                            </Text>
                            {phoneStatus !== 'verified' && (
                              <TouchableOpacity style={styles.verifyPhoneBtn} onPress={() => handleApprove(user.id, 'phone', userName)}>
                                <Text style={styles.verifyPhoneBtnText}>Mark Verified</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Card Footer */}
                      <View style={styles.cardFooter}>
                        <TouchableOpacity style={styles.auditBtn} onPress={() => openAuditLog(user.id, userName)}>
                          <Ionicons name="time-outline" size={14} color={AppColors.primary} />
                          <Text style={styles.auditBtnText}>Audit History</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ── TAB 4: CAR SHARE RIDES ── */}
          {sectionTab === 'carshares' && (
            <View>
              {carShares.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="car-sport-outline" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No car share rides active.</Text>
                </View>
              ) : (
                carShares.map(item => {
                  const driver = item.user || {};
                  const driverName = driver.full_name ?? driver.fullName ?? 'Driver';
                  const departureDate = item.departure_date ?? item.departureDate;
                  const depLoc = item.departure_location ?? item.departureLocation ?? '';
                  const destLoc = item.destination_location ?? item.destinationLocation ?? '';
                  const availSeats = item.available_seats ?? item.availableSeats ?? 0;
                  const bookedSeats = item.booked_seats ?? item.bookedSeats ?? 0;
                  const price = item.price_per_seat ?? item.pricePerSeat ?? 0;

                  return (
                    <View key={item.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.routeTitle}>
                            {depLoc} → {destLoc}
                          </Text>
                          <Text style={styles.userSub}>Driver: {driverName} ({driver.phone || 'Phone verified'})</Text>
                          <Text style={styles.userSub}>
                            Date: {departureDate ? new Date(departureDate).toLocaleDateString() : ''} • Seats: {availSeats} (Booked: {bookedSeats})
                          </Text>
                          <Text style={styles.userSub}>Price: €{price} / seat</Text>
                        </View>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteCarShare(item.id)}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Trust Badges */}
                      <View style={styles.trustBadgesRow}>
                        <View style={styles.trustBadge}>
                          <Ionicons name="call" size={12} color="#10B981" />
                          <Text style={styles.trustBadgeText}>Phone ✓</Text>
                        </View>
                        <View style={styles.trustBadge}>
                          <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                          <Text style={styles.trustBadgeText}>Identity ✓</Text>
                        </View>
                        <View style={styles.trustBadge}>
                          <Ionicons name="ribbon" size={12} color="#10B981" />
                          <Text style={styles.trustBadgeText}>License ✓</Text>
                        </View>
                        <View style={styles.trustBadge}>
                          <Ionicons name="car-sport" size={12} color="#10B981" />
                          <Text style={styles.trustBadgeText}>Vehicle ✓</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Non-Cropped Fullscreen Image Lightbox Modal ── */}
      <Modal visible={previewModalVisible} transparent animationType="fade" onRequestClose={() => setPreviewModalVisible(false)}>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setPreviewModalVisible(false)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="close-circle" size={36} color="white" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1, width }}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setPreviewActiveIndex(idx);
            }}
          >
            {previewImages.map((uri, idx) => (
              <View key={idx} style={[styles.lightboxSlide, { width }]}>
                <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <View style={styles.lightboxCounter}>
            <Text style={styles.lightboxCounterText}>
              {previewActiveIndex + 1} / {previewImages.length}
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Audit History Log Modal with Easy Close ── */}
      <Modal visible={auditModalVisible} transparent animationType="slide" onRequestClose={() => setAuditModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setAuditModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Verification Audit History</Text>
                    <Text style={styles.modalSubTitle}>{auditUserName}</Text>
                  </View>
                  <TouchableOpacity style={styles.modalTopCloseBtn} onPress={() => setAuditModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={26} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {auditLoading ? (
                  <ActivityIndicator color={AppColors.primary} style={{ marginVertical: 30 }} />
                ) : auditLogs.length === 0 ? (
                  <View style={styles.emptyAuditBox}>
                    <Ionicons name="information-circle-outline" size={32} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No previous verification audit logs for this user.</Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
                    {auditLogs.map((log: any) => (
                      <View key={log.id} style={styles.auditLogItem}>
                        <View style={styles.auditLogHeaderRow}>
                          <Text style={styles.auditLogAction}>
                            {log.action?.toUpperCase() || 'UPDATE'}
                          </Text>
                          <Text style={styles.auditLogDate}>
                            {log.createdAt || log.created_at ? new Date(log.createdAt || log.created_at).toLocaleString() : ''}
                          </Text>
                        </View>
                        <Text style={styles.auditLogSummary}>{log.summary || 'User verification updated.'}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <TouchableOpacity style={styles.modalBigCloseBtn} onPress={() => setAuditModalVisible(false)}>
                  <Text style={styles.modalBigCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Decline / Rejection Reason Modal with Backdrop Dismiss ── */}
      <Modal visible={rejectModalVisible} transparent animationType="slide" onRequestClose={() => setRejectModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setRejectModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: '#EF4444' }]}>Reject Verification</Text>
                  <TouchableOpacity onPress={() => setRejectModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={26} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalDesc}>
                  Enter a clear reason to notify {selectedItem?.name} why their verification was declined:
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Document image is blurry / Expired certificate / Name mismatch..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModalVisible(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
                    onPress={submitReject}
                    disabled={submittingAction}
                  >
                    {submittingAction ? <ActivityIndicator color="white" /> : <Text style={styles.modalConfirmText}>Reject Document</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#6B7280' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  refreshBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: AppColors.textDark },

  sectionTabBar: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  sectionTabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sectionTabItemActive: { borderBottomColor: AppColors.primary },
  sectionTabText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  sectionTabTextActive: { color: AppColors.primary, fontWeight: '800' },

  filterBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: AppColors.primary },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
  filterChipTextActive: { color: 'white', fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 60 },
  emptyCard: { backgroundColor: 'white', borderRadius: 14, padding: 30, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF', marginTop: 10, textAlign: 'center' },

  card: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  userName: { fontSize: 15, fontWeight: '700', color: AppColors.textDark },
  userSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  boldText: { fontWeight: '800', color: '#1F2937' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  pendingBadgeText: { color: '#D97706' },
  approvedBadge: { backgroundColor: '#D1FAE5' },
  approvedBadgeText: { color: '#065F46' },

  identityBadges: { gap: 4, alignItems: 'flex-end' },
  microBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  microBadgeGreen: { backgroundColor: '#D1FAE5' },
  microBadgeYellow: { backgroundColor: '#FEF3C7' },
  microBadgeText: { fontSize: 9, fontWeight: '700', color: '#374151' },

  docSection: { marginTop: 12, backgroundColor: '#F9FAFB', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  docSectionTitle: { fontSize: 12, fontWeight: '700', color: AppColors.textDark, marginBottom: 8 },
  galleryScroll: { flexDirection: 'row' },
  thumbnailWrapper: { position: 'relative', marginRight: 10 },
  docImage: { width: 140, height: 100, borderRadius: 8, backgroundColor: '#E5E7EB' },
  docZoomBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  docZoomText: { color: 'white', fontSize: 10, fontWeight: '700' },
  noDocBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  noDocText: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  rejectionNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginTop: 8 },
  rejectionNoticeText: { color: '#EF4444', fontSize: 11, fontWeight: '600', flex: 1 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  auditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  auditBtnText: { fontSize: 12, color: AppColors.primary, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: AppColors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  approveBtnText: { color: 'white', fontWeight: '800', fontSize: 12 },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  rejectBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 12 },

  verificationChecklist: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 10 },
  checklistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkListName: { fontSize: 12, fontWeight: '700', color: AppColors.textDark },
  checklistActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checklistStatusText: { fontSize: 11, fontWeight: '700' },
  textGreen: { color: '#10B981' },
  textYellow: { color: '#D97706' },
  miniActionRow: { flexDirection: 'row', gap: 6 },
  miniApproveBtn: { backgroundColor: AppColors.primary, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  miniRejectBtn: { backgroundColor: '#EF4444', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  verifyPhoneBtn: { backgroundColor: '#E0F2FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  verifyPhoneBtnText: { fontSize: 11, fontWeight: '700', color: '#0284C7' },

  routeTitle: { fontSize: 14, fontWeight: '800', color: AppColors.textDark },
  trustBadgesRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  trustBadgeText: { fontSize: 10, fontWeight: '700', color: '#047857' },
  deleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },

  lightboxOverlay: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  lightboxCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 20 },
  lightboxSlide: { height: '100%', justifyContent: 'center', alignItems: 'center' },
  lightboxImage: { width: '94%', height: '82%' },
  lightboxCounter: { position: 'absolute', bottom: 40, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  lightboxCounterText: { color: 'white', fontWeight: '800', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: height * 0.8 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: AppColors.textDark },
  modalSubTitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  modalTopCloseBtn: { padding: 4 },
  emptyAuditBox: { alignItems: 'center', paddingVertical: 24 },
  modalDesc: { fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 18 },
  modalInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, height: 85, textAlignVertical: 'top', marginBottom: 16, fontSize: 13, color: AppColors.textDark },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { color: '#6B7280', fontWeight: '700' },
  modalConfirmBtn: { flex: 1, backgroundColor: AppColors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: { color: 'white', fontWeight: '800' },
  modalBigCloseBtn: { marginTop: 16, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBigCloseText: { color: '#374151', fontWeight: '800', fontSize: 14 },
  auditLogItem: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  auditLogHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  auditLogAction: { fontSize: 11, fontWeight: '800', color: AppColors.primary },
  auditLogDate: { fontSize: 10, color: '#9CA3AF' },
  auditLogSummary: { fontSize: 12, color: AppColors.textDark, lineHeight: 16 },
});
