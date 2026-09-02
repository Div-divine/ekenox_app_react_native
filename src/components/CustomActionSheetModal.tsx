import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';

export interface ActionSheetOption {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  isDestructive?: boolean;
  badge?: string;
  onPress: () => void;
}

interface CustomActionSheetModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
  onClose: () => void;
  cancelButtonText?: string;
}

export const CustomActionSheetModal: React.FC<CustomActionSheetModalProps> = ({
  visible,
  title = 'Select an Action',
  subtitle,
  options,
  onClose,
  cancelButtonText = 'Back',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdropOverlay}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.sheetContainer}>
                {/* Drag / Handle Indicator */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{title}</Text>
                    {!!subtitle && <Text style={styles.sheetSubtitle}>{subtitle}</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.closeCircleBtn}
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Options List */}
                <ScrollView
                  bounces={false}
                  contentContainerStyle={styles.optionsListContainer}
                  showsVerticalScrollIndicator={false}
                >
                  {options.map((option, index) => {
                    const isDestructive = option.isDestructive;
                    const defaultIcon = isDestructive ? 'trash-outline' : 'ellipsis-horizontal';
                    const iconName = option.icon || defaultIcon;
                    const iconColor = option.iconColor || (isDestructive ? '#EF4444' : '#006D40');
                    const iconBg = isDestructive ? '#FEE2E2' : '#E6F4EA';

                    return (
                      <TouchableOpacity
                        key={option.id || `${option.title}_${index}`}
                        style={[
                          styles.optionItemRow,
                          index === options.length - 1 && { borderBottomWidth: 0 },
                        ]}
                        onPress={() => {
                          onClose();
                          setTimeout(() => {
                            option.onPress();
                          }, 150);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.optionIconCircle, { backgroundColor: iconBg }]}>
                          <Ionicons name={iconName} size={18} color={iconColor} />
                        </View>

                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[
                              styles.optionTitleText,
                              isDestructive && { color: '#DC2626' },
                            ]}
                          >
                            {option.title}
                          </Text>
                          {!!option.subtitle && (
                            <Text style={styles.optionSubtitleText}>{option.subtitle}</Text>
                          )}
                        </View>

                        {!!option.badge && (
                          <View style={styles.optionBadge}>
                            <Text style={styles.optionBadgeText}>{option.badge}</Text>
                          </View>
                        )}

                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={isDestructive ? '#FCA5A5' : '#CBD5E1'}
                          style={{ marginLeft: 6 }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Bottom Prominent Back / Cancel Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={17} color="#475569" style={{ marginRight: 6 }} />
                  <Text style={styles.backButtonText}>{cancelButtonText}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsListContainer: {
    paddingVertical: 4,
  },
  optionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  optionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  optionSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  optionBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  optionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  backButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
});
