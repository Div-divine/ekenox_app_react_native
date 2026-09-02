import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/colors';
import adminService from '../../services/adminService';
import { UrlHelper } from '../../utils/urlHelper';

export default function AdminUsersScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [query, setQuery] = useState('');

  const fetchUsers = async (searchQuery = '', isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await adminService.getUsers(searchQuery);
      setUsers(data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers(query);
  }, []);

  const handleSearch = () => {
    fetchUsers(query);
  };

  const handleToggleBlock = (user: any) => {
    const isBlocked = user.isSuspended || user.is_suspended;
    Alert.alert(
      isBlocked ? 'Unblock User' : 'Block User',
      `Are you sure you want to ${isBlocked ? 'unblock' : 'suspend'} ${user.fullName || user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await adminService.toggleUserBlock(user.id);
              Alert.alert('Updated', res.message || 'User status updated');
              fetchUsers(query, true);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Action failed');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Accounts Management</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, pseudo, or email..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); fetchUsers(''); }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchUsers(query, true)} colors={[AppColors.primary]} />}
        >
          <Text style={styles.sectionHeader}>Registered Members ({users.length})</Text>

          {users.length === 0 ? (
            <Text style={styles.emptyText}>No user accounts found.</Text>
          ) : (
            users.map(user => {
              const avatar = user.profileImage || user.profile_image;
              const isBlocked = user.isSuspended || user.is_suspended;

              return (
                <View key={user.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    {avatar ? (
                      <Image source={{ uri: UrlHelper.convertPathToUrl(avatar) }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={20} color="white" />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.userName}>{user.fullName || user.full_name || 'Member'}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                      <Text style={styles.userHandle}>@{user.pseudo || 'user'}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.blockBtn, isBlocked ? styles.unblockBtnStyle : styles.blockBtnStyle]}
                      onPress={() => handleToggleBlock(user)}
                    >
                      <Text style={isBlocked ? styles.unblockBtnText : styles.blockBtnTextStyle}>
                        {isBlocked ? 'Unblock' : 'Block'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: AppColors.textDark },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    margin: 16, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: AppColors.textDark },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: AppColors.textDark, marginBottom: 12 },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: AppColors.primary, justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 14, fontWeight: '700', color: AppColors.textDark },
  userEmail: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  userHandle: { fontSize: 11, color: AppColors.primary, fontWeight: '600', marginTop: 1 },

  blockBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  blockBtnStyle: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  blockBtnTextStyle: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  unblockBtnStyle: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#A7F3D0' },
  unblockBtnText: { color: '#065F46', fontSize: 11, fontWeight: '700' },
});
