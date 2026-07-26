import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import associationService, { AssociationMember } from '../services/associationService';
import feedService from '../services/feedService';

const ASSO_INVITE_ROLES = [
  { value: 'VOLUNTEER_ASSO', label: 'Volunteer', icon: 'heart-outline' },
  { value: 'VIEWER_ASSO', label: 'Viewer / Member', icon: 'eye-outline' },
  { value: 'PROJECT_MANAGER_ASSO', label: 'Project Manager', icon: 'briefcase-outline' },
  { value: 'COORDINATOR_ASSO', label: 'Coordinator', icon: 'compass-outline' },
  { value: 'SOUS_ADMIN_ASSO', label: 'Sub-Admin', icon: 'shield-outline' },
];

interface AssociationInviteModalProps {
  visible: boolean;
  associationId: number | string;
  associationName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AssociationInviteModal: React.FC<AssociationInviteModalProps> = ({
  visible,
  associationId,
  associationName,
  onClose,
  onSuccess,
}) => {
  const [query, setQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('VOLUNTEER_ASSO');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchTimer = useRef<any>(null);

  // Registered roles mapping
  const [roleMap, setRoleMap] = useState<Record<string, string | number>>({});

  useEffect(() => {
    if (visible && associationId) {
      loadRoles();
    }
  }, [visible, associationId]);

  const loadRoles = async () => {
    try {
      const roles = await associationService.getRoles();
      const map: Record<string, string | number> = {};
      roles.forEach(r => {
        map[r.name] = r.id;
      });
      setRoleMap(map);
    } catch (e) {
      console.warn('Failed to load association roles:', e);
    }
  };

  const handleSearchChange = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await feedService.searchUsers(text.trim());
        setSearchResults(results || []);
      } catch (e) {
        console.warn(e);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleToggleUser = (user: any) => {
    setSelectedUsers(prev => {
      const exists = prev.some(u => String(u.id) === String(user.id));
      if (exists) {
        return prev.filter(u => String(u.id) !== String(user.id));
      } else {
        return [...prev, user];
      }
    });
  };

  const handleAddCustomEmail = () => {
    const email = query.trim();
    if (email && email.includes('@')) {
      if (!customEmails.includes(email)) {
        setCustomEmails(prev => [...prev, email]);
      }
      setQuery('');
      setSearchResults([]);
    } else {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setCustomEmails(prev => prev.filter(e => e !== email));
  };

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0 && customEmails.length === 0) {
      Alert.alert('No Recipients', 'Please select at least one member or enter an email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const roleId = roleMap[selectedRole] || selectedRole;

      const invitations = [
        ...selectedUsers.map(u => ({ user_id: u.id, role_id: roleId })),
        ...customEmails.map(email => ({ email, role_id: roleId })),
      ];

      const res = await associationService.sendInvitations(
        associationId,
        invitations,
        `You have been invited to join ${associationName || 'our association'}`
      );

      if (res.created > 0 || (res.errors && res.errors.length === 0)) {
        Alert.alert(
          '🎉 Invitations Sent',
          `${res.created || invitations.length} invitation(s) sent successfully.`
        );
        setSelectedUsers([]);
        setCustomEmails([]);
        setQuery('');
        onSuccess?.();
        onClose();
      } else {
        Alert.alert(
          'Notice',
          res.errors && res.errors.length > 0
            ? res.errors.join('\n')
            : 'Failed to send invitations.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred while sending invitations.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Invite Members</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={AppColors.textDark} />
            </TouchableOpacity>
          </View>

          {/* Assigned Role Selector (ADMIN_ASSO excluded) */}
          <Text style={styles.sectionLabel}>Assign Role to Invitees</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleRow}>
            {ASSO_INVITE_ROLES.map(r => {
              const isSelected = selectedRole === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleChip, isSelected && styles.roleChipSelected]}
                  onPress={() => setSelectedRole(r.value)}
                >
                  <Ionicons name={r.icon as any} size={14} color={isSelected ? 'white' : AppColors.primary} />
                  <Text style={[styles.roleChipText, isSelected && styles.roleChipTextSelected]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search bar & Email input */}
          <Text style={styles.sectionLabel}>Search Users or Enter Email</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search user name or type email..."
              placeholderTextColor={AppColors.textLight}
              value={query}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
            />
            {query.includes('@') && (
              <TouchableOpacity style={styles.addEmailBtn} onPress={handleAddCustomEmail}>
                <Text style={styles.addEmailText}>Add Email</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results Dropdown */}
          {isSearching ? (
            <ActivityIndicator size="small" color={AppColors.primary} style={{ marginVertical: 8 }} />
          ) : searchResults.length > 0 ? (
            <View style={styles.resultsContainer}>
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                {searchResults.map(user => {
                  const isSelected = selectedUsers.some(u => String(u.id) === String(user.id));
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.resultItem}
                      onPress={() => handleToggleUser(user)}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isSelected ? AppColors.primary : AppColors.textMedium}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{user.full_name}</Text>
                        <Text style={styles.resultEmail}>{user.email}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Selected Invitees Tags */}
          {(selectedUsers.length > 0 || customEmails.length > 0) && (
            <View style={styles.selectedSection}>
              <Text style={styles.sectionLabel}>Selected Invitees ({selectedUsers.length + customEmails.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {selectedUsers.map(u => (
                  <View key={u.id} style={styles.inviteeTag}>
                    <Text style={styles.inviteeText}>{u.full_name}</Text>
                    <TouchableOpacity onPress={() => handleToggleUser(u)}>
                      <Ionicons name="close-circle" size={16} color={AppColors.primary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                ))}
                {customEmails.map(email => (
                  <View key={email} style={styles.inviteeTag}>
                    <Text style={styles.inviteeText}>{email}</Text>
                    <TouchableOpacity onPress={() => handleRemoveEmail(email)}>
                      <Ionicons name="close-circle" size={16} color={AppColors.primary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Submit Action */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              selectedUsers.length === 0 && customEmails.length === 0 && styles.sendBtnDisabled,
            ]}
            onPress={handleSendInvitations}
            disabled={isSubmitting || (selectedUsers.length === 0 && customEmails.length === 0)}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.sendBtnText}>Send Member Invitations</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  closeBtn: {
    padding: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
    marginTop: 10,
    marginBottom: 6,
  },
  roleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.primary,
    marginRight: 8,
  },
  roleChipSelected: {
    backgroundColor: AppColors.primary,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
    marginLeft: 4,
  },
  roleChipTextSelected: {
    color: 'white',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    fontSize: 14,
    color: AppColors.textDark,
  },
  addEmailBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  addEmailText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  resultsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 6,
    padding: 6,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  resultEmail: {
    fontSize: 11,
    color: AppColors.textMedium,
  },
  selectedSection: {
    marginTop: 8,
  },
  inviteeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFAF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  inviteeText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default AssociationInviteModal;
