import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import collaborationService, { CreateInquiryData } from '../services/collaborationService';

interface CollaborationInquiryModalProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: number;
  targetUserName: string;
  onSuccess?: () => void;
}

const COLLAB_TYPES = [
  { id: 'partnership', label: 'Partnership', icon: 'people-outline' },
  { id: 'sponsorship', label: 'Sponsorship', icon: 'ribbon-outline' },
  { id: 'content_creation', label: 'Content Creation', icon: 'camera-outline' },
  { id: 'speaking_engagement', label: 'Speaking / Host', icon: 'mic-outline' },
  { id: 'project_cooperation', label: 'Joint Project', icon: 'construct-outline' },
  { id: 'consulting', label: 'Consulting', icon: 'bulb-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const COMPENSATION_TYPES = [
  { id: 'negotiable', label: 'Negotiable' },
  { id: 'paid', label: 'Fixed Budget' },
  { id: 'revenue_share', label: 'Rev Share' },
  { id: 'exchange', label: 'Value Exchange' },
];

export const CollaborationInquiryModal: React.FC<CollaborationInquiryModalProps> = ({
  visible,
  onClose,
  targetUserId,
  targetUserName,
  onSuccess,
}) => {
  const { user: currentUser } = useAuth();
  const isSelf = Boolean(
    currentUser?.id &&
    targetUserId &&
    String(currentUser.id) === String(targetUserId)
  );

  const [selectedType, setSelectedType] = useState<string>('partnership');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [organization, setOrganization] = useState<string>('');
  const [compensationType, setCompensationType] = useState<string>('negotiable');
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  const handleSend = async () => {
    if (isSelf) {
      Alert.alert('Invalid Action', 'You cannot send a collaboration inquiry to yourself.');
      return;
    }
    if (!targetUserId) {
      Alert.alert('Validation Error', 'Invalid recipient.');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Validation Error', 'Please provide a subject for your inquiry.');
      return;
    }
    if (message.trim().length < 10) {
      Alert.alert('Validation Error', 'Please provide detailed proposal message (minimum 10 characters).');
      return;
    }

    setSending(true);
    try {
      const payload: CreateInquiryData = {
        receiver_id: targetUserId,
        collaboration_type: selectedType,
        subject: subject.trim(),
        message: message.trim(),
        compensation_type: compensationType,
        budget_amount: budgetAmount ? parseFloat(budgetAmount) : undefined,
        currency,
        organization_or_brand: organization.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        target_date: targetDate.trim() || undefined,
      };

      await collaborationService.sendInquiry(payload);
      Alert.alert(
        'Inquiry Sent',
        `Your collaboration proposal has been sent to ${targetUserName}. You will be notified when they respond!`,
        [
          {
            text: 'OK',
            onPress: () => {
              onClose();
              if (onSuccess) onSuccess();
            },
          },
        ]
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to send collaboration inquiry';
      Alert.alert('Error', msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Collaboration Inquiry</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Proposal for {targetUserName}
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {isSelf && (
              <View style={styles.selfWarningBanner}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.selfWarningText}>
                  You cannot send a collaboration inquiry to yourself.
                </Text>
              </View>
            )}

            {/* Collaboration Type Selector */}
            <Text style={styles.sectionTitle}>Collaboration Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {COLLAB_TYPES.map((t) => {
                const isSelected = selectedType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typePill, isSelected && styles.typePillSelected]}
                    onPress={() => setSelectedType(t.id)}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={16}
                      color={isSelected ? '#FFF' : '#475569'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.typePillText, isSelected && styles.typePillTextSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Subject */}
            <Text style={styles.label}>Subject / Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Brand Partnership & Joint Campaign"
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
            />

            {/* Organization / Brand */}
            <Text style={styles.label}>Organization / Company / Brand Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. EcoSphere Media, GreenTech Inc."
              placeholderTextColor="#94A3B8"
              value={organization}
              onChangeText={setOrganization}
            />

            {/* Proposal Message */}
            <Text style={styles.label}>Proposal Details & Objectives *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Detail your collaboration idea, scope, expectations, and timeline..."
              placeholderTextColor="#94A3B8"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
            />

            {/* Compensation & Budget */}
            <Text style={styles.label}>Compensation Model</Text>
            <View style={styles.compensationRow}>
              {COMPENSATION_TYPES.map((ct) => {
                const isSelected = compensationType === ct.id;
                return (
                  <TouchableOpacity
                    key={ct.id}
                    style={[styles.compBtn, isSelected && styles.compBtnSelected]}
                    onPress={() => setCompensationType(ct.id)}
                  >
                    <Text style={[styles.compBtnText, isSelected && styles.compBtnTextSelected]}>
                      {ct.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {compensationType === 'paid' && (
              <View style={styles.budgetRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>Budget Amount</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={budgetAmount}
                    onChangeText={setBudgetAmount}
                  />
                </View>
                <View style={{ width: 90 }}>
                  <Text style={styles.label}>Currency</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="EUR"
                    placeholderTextColor="#94A3B8"
                    value={currency}
                    onChangeText={setCurrency}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            )}

            {/* Contact Email & Phone */}
            <Text style={styles.label}>Direct Contact Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="partner@company.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={contactEmail}
              onChangeText={setContactEmail}
            />

            <Text style={styles.label}>Direct Contact Phone (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="+33 6 12 34 56 78"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />

            {/* Target Date */}
            <Text style={styles.label}>Target Launch Date / Deadline (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD (e.g. 2026-10-15)"
              placeholderTextColor="#94A3B8"
              value={targetDate}
              onChangeText={setTargetDate}
            />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={sending}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, (sending || isSelf) && styles.disabledBtn]}
              onPress={handleSend}
              disabled={sending || isSelf}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.sendBtnText}>Submit Proposal</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  selfWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  selfWarningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  typePillSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  typePillTextSelected: {
    color: '#FFF',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  compensationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  compBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  compBtnSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  compBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  compBtnTextSelected: {
    color: '#4F46E5',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
    minWidth: 140,
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
