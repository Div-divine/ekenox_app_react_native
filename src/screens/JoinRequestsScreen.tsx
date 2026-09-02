import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import associationService, { JoinRequest, Role } from '../services/associationService';
import { AppColors } from '../theme/colors';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  ADMIN_ASSO: 'Association Administrator',
  SOUS_ADMIN_ASSO: 'Sub-Admin',
  COORD_ASSO: 'Coordinator',
  COORDINATOR_ASSO: 'Coordinator',
  VOLUNTEER_ASSO: 'Volunteer',
  VIEWER_ASSO: 'Member',
  PROJECT_MANAGER_ASSO: 'Project Manager',
  ADMIN_EVENT: 'Event Administrator',
  USER: 'User',
  CHATROOM_OWNER: 'Chatroom Owner',
};

export const JoinRequestsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { associationId, associationName } = route.params || {};

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Role Selector Modal state
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await associationService.getJoinRequests(associationId);
      setRequests(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load join requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [associationId]);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await associationService.getRoles();
      setRoles(data);
      // Find and set the default Member (VIEWER_ASSO) role
      const memberRole = data.find((r) => r.name === 'VIEWER_ASSO');
      if (memberRole) {
        setSelectedRole(memberRole);
      } else if (data.length > 0) {
        setSelectedRole(data[0]);
      }
    } catch (e: any) {
      console.warn('Failed to load association roles:', e.message);
    }
  }, []);

  useEffect(() => {
    if (!associationId) {
      Alert.alert('Error', 'Missing Association ID parameter.');
      navigation.goBack();
      return;
    }
    fetchRequests();
    fetchRoles();
  }, [associationId, fetchRequests, fetchRoles]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const openApproveModal = (req: JoinRequest) => {
    setSelectedRequest(req);
    // Reset to default Member role
    const memberRole = roles.find((r) => r.name === 'VIEWER_ASSO');
    if (memberRole) {
      setSelectedRole(memberRole);
    }
    setRoleModalVisible(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !selectedRole) return;
    
    setActionLoading(selectedRequest.id);
    setRoleModalVisible(false);
    
    try {
      await associationService.approveJoinRequest(
        associationId,
        selectedRequest.id,
        selectedRole.id
      );
      Alert.alert('Success', `${selectedRequest.user?.full_name || 'User'} has been approved as a ${selectedRole.displayName || selectedRole.display_name || ROLE_DISPLAY_NAMES[selectedRole.name] || selectedRole.name}.`);
      fetchRequests();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to approve request.');
    } finally {
      setActionLoading(null);
      setSelectedRequest(null);
    }
  };

  const handleReject = (req: JoinRequest) => {
    Alert.alert(
      'Reject Request',
      `Are you sure you want to reject the join request from ${req.user?.full_name || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(req.id);
            try {
              await associationService.rejectJoinRequest(associationId, req.id);
              Alert.alert('Success', 'Join request rejected.');
              fetchRequests();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to reject request.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const renderRequestItem = ({ item }: { item: JoinRequest }) => {
    const userFullName = item.user?.full_name || 'Unknown User';
    const initials = userFullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarUrl = associationService.resolveUrl(item.user?.profile_image);
    const isWorking = actionLoading === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>{initials || '?'}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userFullName}</Text>
            <Text style={styles.requestTime}>
              Requested {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {item.message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageLabel}>Motif / Note:</Text>
            <Text style={styles.messageText}>{item.message}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn, isWorking && styles.btnDisabled]}
            onPress={() => handleReject(item)}
            disabled={isWorking}
          >
            <Ionicons name="close-circle-outline" size={18} color={AppColors.error} />
            <Text style={[styles.btnText, { color: AppColors.error }]}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.approveBtn, isWorking && styles.btnDisabled]}
            onPress={() => openApproveModal(item)}
            disabled={isWorking}
          >
            {isWorking ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={[styles.btnText, { color: 'white' }]}>Approve...</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Join Requests</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {associationName || 'Manage requests'}
          </Text>
        </View>
      </View>

      {/* Requests list */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="people" size={48} color={AppColors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyText}>
                There are no pending join requests for this association.
              </Text>
            </View>
          }
        />
      )}

      {/* Role Picker Modal */}
      <Modal
        visible={roleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Approve Member</Text>
            <Text style={styles.modalSubtitle}>
              Select a role for {selectedRequest?.user?.full_name || 'the user'}:
            </Text>

            <View style={styles.rolesList}>
              {roles.map((role) => {
                const isSelected = selectedRole?.id === role.id;
                const displayName = role.displayName || role.display_name || ROLE_DISPLAY_NAMES[role.name] || role.name;
                return (
                  <TouchableOpacity
                    key={role.id}
                    style={[
                      styles.roleItem,
                      isSelected && styles.roleItemSelected,
                    ]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={isSelected ? AppColors.primary : AppColors.textMedium}
                    />
                    <Text
                      style={[
                        styles.roleText,
                        isSelected && styles.roleTextSelected,
                      ]}
                    >
                      {displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setRoleModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={handleApprove}
              >
                <Text style={styles.modalConfirmBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  requestTime: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  messageBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textDark,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'flex-end',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
    flex: 1,
    maxWidth: 150,
  },
  approveBtn: {
    backgroundColor: AppColors.primary,
  },
  rejectBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.textMedium,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: AppColors.textMedium,
    marginBottom: 16,
  },
  rolesList: {
    marginBottom: 24,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  roleItemSelected: {
    borderBottomColor: AppColors.primary,
  },
  roleText: {
    fontSize: 15,
    color: AppColors.textDark,
    marginLeft: 12,
  },
  roleTextSelected: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 12,
  },
  modalCancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  modalConfirmBtn: {
    backgroundColor: AppColors.primary,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

export default JoinRequestsScreen;
