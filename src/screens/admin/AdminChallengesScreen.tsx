import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/colors';
import adminService from '../../services/adminService';

export default function AdminChallengesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState<any[]>([]);

  // Create Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('20');
  const [submitting, setSubmitting] = useState(false);

  const fetchChallenges = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await adminService.getChallenges();
      setChallenges(data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a challenge title.');
      return;
    }
    setSubmitting(true);
    try {
      await adminService.createChallenge({
        title: title.trim(),
        description: description.trim(),
        points: parseInt(points) || 10,
      });
      setModalVisible(false);
      setTitle('');
      setDescription('');
      Alert.alert('Success', 'Eco Challenge created successfully!');
      fetchChallenges(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Challenge', 'Are you sure you want to delete this eco challenge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await adminService.deleteChallenge(id);
            Alert.alert('Deleted', 'Challenge deleted.');
            fetchChallenges(true);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Deletion failed.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eco Challenges & Categories</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchChallenges(true)} colors={[AppColors.primary]} />}
        >
          <Text style={styles.sectionHeader}>Active Challenges ({challenges.length})</Text>

          {challenges.length === 0 ? (
            <Text style={styles.emptyText}>No eco challenges created yet.</Text>
          ) : (
            challenges.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.challengeTitle}>{item.title}</Text>
                    <Text style={styles.challengeDesc}>{item.description}</Text>
                    <Text style={styles.pointsText}>🌱 +{item.points || 10} Eco Points</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Create Challenge Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Eco Challenge</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Challenge Title (e.g. Zero Plastic Week)"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              placeholder="Description & guidelines..."
              multiline
              value={description}
              onChangeText={setDescription}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Points (default 20)"
              keyboardType="numeric"
              value={points}
              onChangeText={setPoints}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.modalConfirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: AppColors.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: AppColors.textDark },
  scrollContent: { padding: 16, paddingBottom: 60 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: AppColors.textDark, marginBottom: 12 },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  challengeTitle: { fontSize: 15, fontWeight: '700', color: AppColors.textDark },
  challengeDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pointsText: { fontSize: 12, color: AppColors.primary, fontWeight: '700', marginTop: 4 },
  deleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: AppColors.textDark, marginBottom: 12 },
  modalInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: '#6B7280', fontWeight: '600' },
  modalConfirmBtn: { flex: 1, backgroundColor: AppColors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmText: { color: 'white', fontWeight: '700' },
});
