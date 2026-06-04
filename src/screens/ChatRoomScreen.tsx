import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import chatService, { ChatMessage, ChatReaction } from '../services/chatService';
import { UrlHelper } from '../utils/urlHelper';

const { width: SCREEN_W } = Dimensions.get('window');

type RouteParams = {
  chatRoomId: string | number;
  name: string;
  logo?: string;
  type?: 'direct' | 'group';
};

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '🎉'];

export const ChatRoomScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ ChatRoom: RouteParams }, 'ChatRoom'>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const { chatRoomId, name, logo } = route.params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Reaction/Options sheet modal state
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentUserIdStr = user?.id ? String(user.id) : '';

  // ─── Message Loading ───────────────────────────────────────────────────────

  const loadMessages = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const data = await chatService.getMessages(chatRoomId);
      // Backend returns array reversed (oldest first). We keep it reversed as FlatList renders oldest first by default,
      // or we can sort it by date to ensure perfect chronological order.
      const sorted = [...data].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sorted);
    } catch (e: any) {
      console.error('Failed to load messages:', e.message);
    } finally {
      setIsLoading(false);
    }
  }, [chatRoomId]);

  // Initial load
  useEffect(() => {
    loadMessages(true);
    chatService.markChatAsRead(chatRoomId);

    // Setup background polling (every 4 seconds) to keep messages updated
    pollTimerRef.current = setInterval(() => {
      loadMessages(false);
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      // Mark as read on unmount
      chatService.markChatAsRead(chatRoomId);
    };
  }, [chatRoomId, loadMessages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 200);
  };

  // Scroll to bottom when message count changes
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText('');
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    try {
      const newMsg = await chatService.sendMessage(chatRoomId, text, replyId);
      setMessages(prev => [...prev, newMsg]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddReaction = async (messageId: string | number, emoji: string) => {
    setOptionsModalVisible(false);
    try {
      const updatedReaction = await chatService.addReaction(messageId, emoji);
      // Local update to save a server round-trip
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === messageId) {
            const rxns = msg.reactions || [];
            // Remove user's previous reaction if exists
            const filtered = rxns.filter(r => String(r.user.id) !== currentUserIdStr);
            return {
              ...msg,
              reactions: [...filtered, updatedReaction],
            };
          }
          return msg;
        })
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add reaction.');
    }
  };

  const handleDeleteMessage = (messageId: string | number) => {
    setOptionsModalVisible(false);
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatService.deleteMessage(messageId, true);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete message.');
          }
        },
      },
    ]);
  };

  // ─── Rendering Helpers ─────────────────────────────────────────────────────

  const renderMessageBubble = ({ item }: { item: ChatMessage }) => {
    const isCurrentUser = String(item.sender?.id) === currentUserIdStr;
    const hasReactions = item.reactions && item.reactions.length > 0;

    // Format time (e.g. 10:24 AM)
    const formatTime = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <View style={[styles.messageRow, isCurrentUser ? styles.rowRight : styles.rowLeft]}>
        {/* Profile Avatar for group chat */}
        {!isCurrentUser && (
          <View style={styles.senderAvatarBox}>
            {item.sender?.avatar || item.sender?.profile_image ? (
              <Image
                source={{ uri: UrlHelper.convertPathToUrl(item.sender.avatar || item.sender.profile_image) }}
                style={styles.senderAvatar}
              />
            ) : (
              <View style={styles.senderAvatarPlaceholder}>
                <Text style={styles.senderAvatarText}>
                  {(item.sender?.full_name || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.bubbleContainer}>
          {/* Sender Name above message bubble */}
          {!isCurrentUser && (
            <Text style={styles.senderName}>{item.sender?.full_name || 'Member'}</Text>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.bubble,
              isCurrentUser ? styles.bubbleRight : styles.bubbleLeft,
              hasReactions && { marginBottom: 12 }
            ]}
            onLongPress={() => {
              setSelectedMessage(item);
              setOptionsModalVisible(true);
            }}
          >
            {/* Reply Preview Curve inside the bubble */}
            {item.reply_to && (
              <View style={styles.replyPreviewInBubble}>
                <View style={styles.replyPreviewHeader}>
                  <Ionicons name="arrow-undo" size={10} color={AppColors.primary} />
                  <Text style={styles.replyPreviewInBubbleSender}>
                    {String(item.reply_to.sender?.id) === currentUserIdStr ? 'You' : (item.reply_to.sender?.full_name || 'Member')}
                  </Text>
                </View>
                <Text style={styles.replyPreviewInBubbleText} numberOfLines={1}>
                  {item.reply_to.content}
                </Text>
              </View>
            )}

            <Text style={[styles.messageText, isCurrentUser ? styles.textRight : styles.textLeft]}>
              {item.content}
            </Text>

            <Text style={[styles.messageTime, isCurrentUser ? styles.timeRight : styles.timeLeft]}>
              {formatTime(item.created_at)}
            </Text>
          </TouchableOpacity>

          {/* Reactions Row overlaid bottom right of bubble */}
          {hasReactions && (
            <View style={[styles.reactionsRow, isCurrentUser ? styles.rxnRight : styles.rxnLeft]}>
              {item.reactions!.map((rxn, idx) => (
                <View key={rxn.id || idx} style={styles.reactionBadge}>
                  <Text style={styles.reactionEmoji}>{rxn.emoji}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
      {/* ─── Premium Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>

        {logo ? (
          <Image source={{ uri: UrlHelper.convertPathToUrl(logo) }} style={styles.headerLogo} />
        ) : (
          <View style={styles.headerLogoFallback}>
            <Ionicons name="business" size={16} color={AppColors.primary} />
          </View>
        )}

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.headerSubtitle}>Group Chat • Syncing Live</Text>
        </View>
      </View>

      {/* ─── Message List ─── */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.chatArea}>
          {isLoading && messages.length === 0 ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={AppColors.primary} />
              <Text style={styles.loaderText}>Loading live messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageBubble}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
            />
          )}

          {/* Reply Preview Bar above text input */}
          {replyingTo && (
            <View style={styles.replyPreviewBar}>
              <View style={styles.replyPreviewLeftLine} />
              <View style={{ flex: 1, paddingLeft: 8 }}>
                <Text style={styles.replyPreviewSenderTitle}>
                  Replying to {String(replyingTo.sender?.id) === currentUserIdStr ? 'yourself' : replyingTo.sender?.full_name}
                </Text>
                <Text style={styles.replyPreviewMessageBody} numberOfLines={1}>
                  {replyingTo.content}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyPreviewCloseBtn}>
                <Ionicons name="close-circle" size={20} color={AppColors.textMedium} />
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Input Row ─── */}
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Write a message..."
                placeholderTextColor={AppColors.textMedium}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
              />
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={18} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Reaction / Actions Modal ─── */}
      <Modal
        visible={optionsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.dragIndicator} />
            <Text style={styles.modalHeading}>Message Actions</Text>

            {/* Emojis Selector Row */}
            <View style={styles.emojisRow}>
              {EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => selectedMessage && handleAddReaction(selectedMessage.id, emoji)}
                >
                  <Text style={styles.emojiBtnText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalDivider} />

            {/* List Actions */}
            <TouchableOpacity
              style={styles.modalActionItem}
              onPress={() => {
                if (selectedMessage) {
                  setReplyingTo(selectedMessage);
                  setOptionsModalVisible(false);
                }
              }}
            >
              <Ionicons name="arrow-undo" size={20} color={AppColors.primary} />
              <Text style={styles.modalActionText}>Reply to Message</Text>
            </TouchableOpacity>

            {selectedMessage && String(selectedMessage.sender?.id) === currentUserIdStr && (
              <TouchableOpacity
                style={[styles.modalActionItem, styles.modalActionItemDestructive]}
                onPress={() => selectedMessage && handleDeleteMessage(selectedMessage.id)}
              >
                <Ionicons name="trash-outline" size={20} color={AppColors.error} />
                <Text style={[styles.modalActionText, styles.modalActionTextDestructive]}>Delete Message</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setOptionsModalVisible(false)}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    paddingHorizontal: 16,
    gap: 12,
  },
  headerBackBtn: {
    padding: 4,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primary + '25',
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textDark,
  },
  headerSubtitle: {
    fontSize: 10,
    color: AppColors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  chatArea: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: AppColors.textMedium,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },

  // ── Message Bubbles ──
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  senderAvatarBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  senderAvatar: {
    width: '100%',
    height: '100%',
  },
  senderAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.primary,
  },
  bubbleContainer: {
    maxWidth: SCREEN_W * 0.7,
  },
  senderName: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleRight: {
    backgroundColor: AppColors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleLeft: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textRight: {
    color: 'white',
  },
  textLeft: {
    color: AppColors.textDark,
  },
  messageTime: {
    fontSize: 8,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeRight: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  timeLeft: {
    color: AppColors.textMedium,
  },

  // ── Reply Preview Inside Bubble ──
  replyPreviewInBubble: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.primary,
  },
  replyPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  replyPreviewInBubbleSender: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.primary,
  },
  replyPreviewInBubbleText: {
    fontSize: 11,
    color: AppColors.textMedium,
  },

  // ── Message Reactions ──
  reactionsRow: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: -8,
    gap: 3,
  },
  rxnRight: {
    right: 8,
  },
  rxnLeft: {
    left: 8,
  },
  reactionBadge: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  reactionEmoji: {
    fontSize: 11,
  },

  // ── Input Area ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    maxHeight: 100,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    color: AppColors.textDark,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: AppColors.textMedium + '50',
    shadowOpacity: 0,
    elevation: 0,
  },

  // ── Reply Preview Bar above text input ──
  replyPreviewBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
  },
  replyPreviewLeftLine: {
    width: 3,
    height: '100%',
    backgroundColor: AppColors.primary,
    borderRadius: 1.5,
  },
  replyPreviewSenderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.primary,
  },
  replyPreviewMessageBody: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  replyPreviewCloseBtn: {
    padding: 4,
  },

  // ── Modals / Bottom Sheets ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    textAlign: 'center',
    marginBottom: 20,
  },
  emojisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emojiBtnText: {
    fontSize: 24,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  modalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 12,
  },
  modalActionItemDestructive: {
    marginTop: 4,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  modalActionTextDestructive: {
    color: AppColors.error,
  },
  modalCancelBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
});
