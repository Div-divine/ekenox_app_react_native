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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import chatService, { ChatMessage, ChatReaction, ChatAttachment } from '../services/chatService';
import { UrlHelper } from '../utils/urlHelper';

const getAudioModule = () => {
  try {
    const av = require('expo-av');
    return av?.Audio || av;
  } catch (e) {
    return null;
  }
};

const { width: SCREEN_W } = Dimensions.get('window');

type RouteParams = {
  chatRoomId: string | number;
  name: string;
  logo?: string;
  type?: 'direct' | 'group';
};

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '🎉'];

// ── List item union type (must be outside component for FlatList generic) ──
type SeparatorItem = { kind: 'separator'; label: string; key: string };
type MessageItem = { kind: 'message'; msg: ChatMessage; isFirst: boolean; isLast: boolean; key: string };
type ListItem = SeparatorItem | MessageItem;

// ── Hermes-safe date helpers (toLocaleTimeString unavailable in some Hermes builds) ──
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Returns 'Today', 'Yesterday', or 'Monday, Jul 21' */
const formatDateLabel = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
};

/** Returns '09:45 AM' style — Hermes safe */
const formatTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;
};

/** Deduplicates messages by id (backend polling may return overlapping pages) */
const deduplicateMessages = (msgs: ChatMessage[]): ChatMessage[] => {
  const seen = new Set<string>();
  return msgs.filter(m => {
    const k = String(m.id);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const buildListItems = (msgs: ChatMessage[]): ListItem[] => {
  const items: ListItem[] = [];
  let lastDateLabel: string | null = null;
  let lastSenderId: string | null = null;

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    const next = msgs[i + 1];
    const dateLabel = formatDateLabel(msg.created_at || '');

    if (dateLabel !== lastDateLabel) {
      // Use index in key to guarantee uniqueness even if label text repeats
      items.push({ kind: 'separator', label: dateLabel, key: `sep-${i}-${dateLabel}` });
      lastDateLabel = dateLabel;
      lastSenderId = null;
    }

    const senderId = String(msg.sender?.id ?? 'unknown');
    const isFirst = senderId !== lastSenderId;
    const nextSenderId = next ? String(next.sender?.id ?? 'unknown') : null;
    const isLast = nextSenderId !== senderId;

    // Prefix with 'msg-' + index to guarantee uniqueness when IDs are duplicated
    items.push({ kind: 'message', msg, isFirst, isLast, key: `msg-${i}-${String(msg.id)}` });
    lastSenderId = senderId;
  }

  return items;
};

export const ChatRoomScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ ChatRoom: RouteParams }, 'ChatRoom'>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const { chatRoomId, name, logo, type } = route.params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isNavigatingToReplyRef = useRef(false);

  const scrollToMessage = (messageId: string | number) => {
    if (!messageId) return;
    const targetIdStr = String(messageId);
    const listItems = buildListItems(messages);
    const index = listItems.findIndex(
      item => item.kind === 'message' && String(item.msg.id) === targetIdStr
    );
    if (index !== -1 && flatListRef.current) {
      isNavigatingToReplyRef.current = true;
      setHighlightedMsgId(targetIdStr);
      try {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.4,
        });
      } catch (e) {
        flatListRef.current.scrollToOffset({
          offset: Math.max(0, index * 60),
          animated: true,
        });
      }
      setTimeout(() => {
        setHighlightedMsgId(null);
      }, 3500);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setShowScrollToBottom(distanceFromBottom > 180);
  };

  // Reaction/Options sheet modal state
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  // Attachment & Voice Recording state
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<any>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<any>(null);

interface StagedAttachment {
  type: 'photo' | 'video' | 'document' | 'location';
  file?: {
    uri: string;
    fileName?: string;
    mimeType?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  previewUri?: string;
  title: string;
}

  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);

  // ── Attachment Pickers (Stage attachment for preview before sending) ──
  const handlePickImage = async () => {
    setAttachmentModalVisible(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        const typeName = isVideo ? 'video' : 'photo';
        const name = asset.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
        setStagedAttachment({
          type: typeName,
          file: {
            uri: asset.uri,
            fileName: name,
            mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          },
          previewUri: asset.uri,
          title: name,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to select media: ' + (e.message || 'Unknown error'));
    }
  };

  const handleTakeCamera = async () => {
    setAttachmentModalVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera access is required to take photos/videos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        const name = `camera_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
        setStagedAttachment({
          type: isVideo ? 'video' : 'photo',
          file: {
            uri: asset.uri,
            fileName: name,
            mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          },
          previewUri: asset.uri,
          title: name,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to capture media: ' + (e.message || 'Unknown error'));
    }
  };

  const handlePickDocument = async () => {
    setAttachmentModalVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        setStagedAttachment({
          type: 'document',
          file: {
            uri: doc.uri,
            fileName: doc.name,
            mimeType: doc.mimeType || 'application/octet-stream',
          },
          title: doc.name || 'Document',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to select document: ' + (e.message || 'Unknown error'));
    }
  };

  const handleShareLocation = async () => {
    setAttachmentModalVisible(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to share current location.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setStagedAttachment({
        type: 'location',
        location: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
        title: `📍 Location (${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)})`,
      });
    } catch (e: any) {
      Alert.alert('Error', 'Failed to fetch location: ' + (e.message || 'Unknown error'));
    }
  };

  // ── Voice Recording ──
  const startRecording = async () => {
    const audioModule = getAudioModule();
    if (!audioModule) {
      Alert.alert('Notice', 'Voice recording requires a standalone build or dev client (npx expo run:android).');
      return;
    }
    try {
      const perm = await audioModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Microphone access is required to record audio messages.');
        return;
      }
      await audioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await audioModule.Recording.createAsync(
        audioModule.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordSecs(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordSecs(prev => prev + 1);
      }, 1000);
    } catch (e: any) {
      console.error('Failed to start recording:', e);
      Alert.alert('Recording Error', 'Could not access microphone.');
    }
  };

  const stopAndSendRecording = async () => {
    if (!recordingRef.current) return;
    try {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const duration = recordSecs;
      recordingRef.current = null;
      setIsRecording(false);
      setRecordSecs(0);

      const audioModule = getAudioModule();
      if (audioModule) {
        await audioModule.setAudioModeAsync({ allowsRecordingIOS: false });
      }

      if (uri) {
        setIsSending(true);
        const sent = await chatService.sendMessageWithAttachment(
          chatRoomId,
          '🎤 Voice Note',
          {
            uri,
            fileName: `voice_${Date.now()}.m4a`,
            mimeType: 'audio/m4a',
          },
          'voice_note',
          { duration, replyToId: replyingTo?.id }
        );
        if (sent) {
          setMessages(prev => [...prev, sent]);
          setReplyingTo(null);
        }
      }
    } catch (e: any) {
      console.error('Failed to send voice recording:', e);
      Alert.alert('Error', 'Failed to send voice note.');
    } finally {
      setIsSending(false);
      setIsRecording(false);
    }
  };

  const cancelRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (_) {}
      recordingRef.current = null;
    }
    setIsRecording(false);
    setRecordSecs(0);
    const audioModule = getAudioModule();
    if (audioModule) {
      await audioModule.setAudioModeAsync({ allowsRecordingIOS: false });
    }
  };

  const togglePlayVoiceNote = async (msgId: string | number, audioUrl: string) => {
    const audioModule = getAudioModule();
    if (!audioModule) {
      Alert.alert('Notice', 'Audio playback requires a standalone build or dev client (npx expo run:android).');
      return;
    }
    try {
      if (playingAudioId === msgId) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingAudioId(null);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const fullUrl = UrlHelper.convertPathToUrl(audioUrl);
      const { sound } = await audioModule.Sound.createAsync({ uri: fullUrl }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingAudioId(msgId);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingAudioId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e: any) {
      console.warn('Failed to play audio:', e);
      Alert.alert('Error', 'Unable to play audio message.');
      setPlayingAudioId(null);
    }
  };

  const currentUserIdStr = user?.id ? String(user.id) : '';

  // ─── Message Loading ───────────────────────────────────────────────────────

  const loadMessages = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const data = await chatService.getMessages(chatRoomId);
      // Sort chronologically then deduplicate by id
      const sorted = [...data].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(deduplicateMessages(sorted));
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

  const scrollToBottom = (force = false) => {
    if (isNavigatingToReplyRef.current && !force) return;
    setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 200);
  };

  // Scroll to bottom when message count changes
  useEffect(() => {
    if (messages.length > 0 && !isNavigatingToReplyRef.current) {
      scrollToBottom();
    }
  }, [messages.length]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = inputText.trim();
    if ((!text && !stagedAttachment) || isSending) return;

    isNavigatingToReplyRef.current = false;
    setIsSending(true);
    setInputText('');

    const currentStaged = stagedAttachment;
    setStagedAttachment(null);

    const replyId = replyingTo?.id;
    setReplyingTo(null);

    try {
      let newMsg: ChatMessage;
      if (currentStaged) {
        newMsg = await chatService.sendMessageWithAttachment(
          chatRoomId,
          text,
          currentStaged.file,
          currentStaged.type,
          {
            replyToId: replyId,
            latitude: currentStaged.location?.latitude,
            longitude: currentStaged.location?.longitude,
          }
        );
      } else {
        newMsg = await chatService.sendMessage(chatRoomId, text, replyId);
      }

      setMessages(prev => deduplicateMessages([...prev, newMsg]));
      scrollToBottom(true);
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

  const renderMetadataCard = (rawMetadata: any, isCurrentUser: boolean) => {
    if (!rawMetadata) return null;

    let metadata = rawMetadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error('Failed to parse message metadata:', e);
      }
    }

    if (!metadata || typeof metadata !== 'object') return null;

    const item = metadata.product || metadata.item || metadata;

    const title =
      item.product_title ||
      item.title ||
      item.name ||
      metadata.product_title ||
      metadata.title ||
      metadata.name ||
      'Marketplace Item';

    const rawImage =
      item.product_image ||
      item.image ||
      item.image_url ||
      item.thumbnail ||
      item.photos?.[0] ||
      item.profile_image ||
      metadata.product_image ||
      metadata.image;

    const imageUrl = rawImage ? UrlHelper.convertPathToUrl(rawImage) : null;

    const price =
      item.product_price ??
      item.price ??
      item.prize ??
      metadata.product_price ??
      metadata.price ??
      metadata.prize;

    const hourlyRate =
      item.hourly_rate ??
      item.product_hourly_rate ??
      item.hourlyRate ??
      metadata.hourly_rate ??
      metadata.product_hourly_rate ??
      metadata.hourlyRate;

    const sellerName =
      item.seller_name ||
      metadata.seller_name ||
      item.sellerName ||
      metadata.sellerName;

    const productId =
      item.product_id ||
      item.id ||
      metadata.product_id ||
      metadata.productId;

    let priceDisplay = '';
    if (price !== undefined && price !== null && price !== '') {
      priceDisplay = typeof price === 'number' ? `$${price.toFixed(2)}` : (String(price).startsWith('$') ? String(price) : `$${price}`);
    }
    if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== '') {
      const hrDisplay = typeof hourlyRate === 'number' ? `$${hourlyRate.toFixed(2)}/hr` : (String(hourlyRate).includes('/hr') ? String(hourlyRate) : `$${hourlyRate}/hr`);
      priceDisplay = priceDisplay ? `${priceDisplay} • ${hrDisplay}` : hrDisplay;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          styles.metadataCard,
          isCurrentUser ? styles.metadataCardRight : styles.metadataCardLeft
        ]}
        onPress={() => {
          if (productId) {
            try {
              (navigation as any).navigate('MainTabs', {
                screen: 'EcoMarket',
                params: { productId: Number(productId) },
              });
            } catch (e) {
              (navigation as any).navigate('EcoMarket', { productId: Number(productId) });
            }
          }
        }}
      >
        <View style={styles.metadataCardInner}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.metadataImage} />
          ) : (
            <View style={styles.metadataImageFallback}>
              <Ionicons name="pricetag" size={22} color={AppColors.primary} />
            </View>
          )}
          <View style={styles.metadataInfo}>
            <View style={styles.metadataTagRow}>
              <Ionicons name="bag-handle" size={11} color={AppColors.primary} />
              <Text style={styles.metadataTagText}>
                {sellerName ? `Item Inquiry • ${sellerName}` : 'Item Inquiry'}
              </Text>
            </View>
            <Text style={styles.metadataTitle} numberOfLines={1}>{title}</Text>
            {priceDisplay ? (
              <Text style={styles.metadataPrice}>{priceDisplay}</Text>
            ) : null}
          </View>
          {productId ? (
            <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: ListItem }) => {
    // ── Date separator ──
    if (item.kind === 'separator') {
      return (
        <View style={styles.dateSeparatorRow}>
          <View style={styles.dateSeparatorLine} />
          <Text style={styles.dateSeparatorLabel}>{item.label}</Text>
          <View style={styles.dateSeparatorLine} />
        </View>
      );
    }

    // ── Message bubble ──
    const { msg, isFirst, isLast } = item;
    const isCurrentUser = String(msg.sender?.id) === currentUserIdStr;
    const hasReactions = msg.reactions && msg.reactions.length > 0;

    return (
      <View
        style={[
          styles.messageRow,
          isCurrentUser ? styles.rowRight : styles.rowLeft,
          !isFirst && { marginTop: 2 },
        ]}
      >
        {/* Avatar — shown only on LAST bubble of a consecutive sender run */}
        {!isCurrentUser && (
          <View style={[styles.senderAvatarBox, !isLast && styles.avatarHidden]}>
            {isLast ? (
              <TouchableOpacity
                onPress={() => msg.sender?.id && navigation.navigate('Profile', { userId: msg.sender.id })}
                activeOpacity={0.7}
              >
                {(msg.sender?.avatar || msg.sender?.profile_image) ? (
                  <Image
                    source={{ uri: UrlHelper.convertPathToUrl(msg.sender.avatar || msg.sender.profile_image) }}
                    style={styles.senderAvatar}
                  />
                ) : (
                  <View style={styles.senderAvatarPlaceholder}>
                    <Text style={styles.senderAvatarText}>
                      {(msg.sender?.full_name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={styles.bubbleContainer}>
          {/* Sender name — only on FIRST bubble of a run */}
          {!isCurrentUser && isFirst && (
            <TouchableOpacity
              onPress={() => msg.sender?.id && navigation.navigate('Profile', { userId: msg.sender.id })}
              activeOpacity={0.7}
            >
              <Text style={styles.senderName}>{msg.sender?.full_name || 'Member'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.bubble,
              isCurrentUser ? styles.bubbleRight : styles.bubbleLeft,
              isCurrentUser
                ? { borderBottomRightRadius: isLast ? 4 : 18, borderTopRightRadius: isFirst ? 18 : 6 }
                : { borderBottomLeftRadius: isLast ? 4 : 18, borderTopLeftRadius: isFirst ? 18 : 6 },
              hasReactions && { marginBottom: 14 },
              String(msg.id) === highlightedMsgId && styles.bubbleHighlighted,
            ]}
            onLongPress={() => { setSelectedMessage(msg); setOptionsModalVisible(true); }}
          >
            {/* Reply preview */}
            {msg.reply_to && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => msg.reply_to?.id && scrollToMessage(msg.reply_to.id)}
                style={[
                  styles.replyPreviewInBubble,
                  isCurrentUser ? styles.replyPreviewInBubbleRight : styles.replyPreviewInBubbleLeft
                ]}
              >
                <View style={styles.replyPreviewHeader}>
                  <Ionicons
                    name="arrow-undo"
                    size={10}
                    color={isCurrentUser ? '#FFFFFF' : AppColors.primary}
                  />
                  <Text
                    style={[
                      styles.replyPreviewInBubbleSender,
                      isCurrentUser ? styles.replySenderRight : styles.replySenderLeft
                    ]}
                  >
                    {String(msg.reply_to.sender?.id) === currentUserIdStr ? 'You' : (msg.reply_to.sender?.full_name || 'Member')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.replyPreviewInBubbleText,
                    isCurrentUser ? styles.replyTextRight : styles.replyTextLeft
                  ]}
                  numberOfLines={1}
                >
                  {msg.reply_to.content}
                </Text>
              </TouchableOpacity>
            )}

            {/* Metadata Card (Product/Item Inquiry) */}
            {msg.metadata && renderMetadataCard(msg.metadata, isCurrentUser)}

            {/* Attachments rendering */}
            {msg.attachments && msg.attachments.length > 0 && msg.attachments.map((att: ChatAttachment, idx: number) => {
              const attType = att.type || 'photo';
              const rawPath = att.filePath || att.file_path || att.url || '';
              const fullUrl = UrlHelper.convertPathToUrl(rawPath);
              if (attType === 'photo') {
                return (
                  <View key={att.id || idx} style={styles.attachmentMediaCard}>
                    <Image source={{ uri: fullUrl }} style={styles.attachmentImage} resizeMode="cover" />
                  </View>
                );
              }
              if (attType === 'voice_note' || attType === 'audio') {
                const isPlaying = playingAudioId === msg.id;
                return (
                  <View key={att.id || idx} style={[styles.voiceBubble, isCurrentUser ? styles.voiceBubbleRight : styles.voiceBubbleLeft]}>
                    <TouchableOpacity
                      style={[styles.voicePlayBtn, isCurrentUser ? styles.voicePlayBtnRight : styles.voicePlayBtnLeft]}
                      onPress={() => togglePlayVoiceNote(msg.id, rawPath)}
                    >
                      <Ionicons name={isPlaying ? "pause" : "play"} size={16} color={isCurrentUser ? AppColors.primary : "white"} />
                    </TouchableOpacity>
                    <View style={styles.voiceTrack}>
                      <View style={[styles.voiceTrackBar, isPlaying && styles.voiceTrackBarActive]} />
                      <Text style={[styles.voiceDurationText, isCurrentUser ? styles.textRight : styles.textLeft]}>
                        {att.duration ? `${Math.floor(att.duration / 60)}:${(att.duration % 60).toString().padStart(2, '0')}` : 'Voice Note'}
                      </Text>
                    </View>
                  </View>
                );
              }
              if (attType === 'location') {
                return (
                  <View key={att.id || idx} style={styles.locationCard}>
                    <Ionicons name="location" size={24} color="#EF4444" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.locationTitle}>Shared Location</Text>
                      <Text style={styles.locationCoords}>Lat: {att.latitude?.toFixed(4)}, Lon: {att.longitude?.toFixed(4)}</Text>
                    </View>
                  </View>
                );
              }
              if (attType === 'document') {
                return (
                  <View key={att.id || idx} style={styles.documentCard}>
                    <Ionicons name="document-text" size={22} color={AppColors.primary} />
                    <Text style={styles.documentName} numberOfLines={1}>{att.fileName || att.file_name || 'Document'}</Text>
                  </View>
                );
              }
              return null;
            })}

            {msg.content ? (
              <Text style={[styles.messageText, isCurrentUser ? styles.textRight : styles.textLeft]}>
                {msg.content}
              </Text>
            ) : null}

            {/* Timestamp — shown only on LAST bubble of a run */}
            {isLast && (
              <Text style={[styles.messageTime, isCurrentUser ? styles.timeRight : styles.timeLeft]}>
                {formatTime(msg.created_at)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Reactions */}
          {hasReactions && (
            <View style={[styles.reactionsRow, isCurrentUser ? styles.rxnRight : styles.rxnLeft]}>
              {msg.reactions!.map((rxn, idx) => (
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

        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={() => navigation.navigate('ChatRoomDetail', { chatRoomId, name, type })}
          activeOpacity={0.75}
        >
          {logo ? (
            <Image source={{ uri: UrlHelper.convertPathToUrl(logo) }} style={styles.headerLogo} />
          ) : (
            <View style={styles.headerLogoFallback}>
              <Ionicons name={type === 'group' ? 'people' : 'person'} size={16} color={AppColors.primary} />
            </View>
          )}

          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.headerSubtitle}>{type === 'group' ? 'Tap for group info' : 'Tap for contact info'}</Text>
          </View>
        </TouchableOpacity>

        <Ionicons name="chevron-forward" size={16} color={AppColors.textMedium} style={{ marginRight: 4 }} />
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
              data={buildListItems(messages)}
              renderItem={renderListItem}
              keyExtractor={item => item.key}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (!isNavigatingToReplyRef.current) {
                  scrollToBottom();
                }
              }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onScrollToIndexFailed={info => {
                flatListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
              }}
            />
          )}

          {/* Floating Scroll to Bottom / End Button */}
          {showScrollToBottom && (
            <TouchableOpacity
              style={[styles.scrollToBottomFab, { bottom: Math.max(insets.bottom, 8) + 56 }]}
              onPress={() => {
                isNavigatingToReplyRef.current = false;
                scrollToBottom(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-down" size={22} color="white" />
            </TouchableOpacity>
          )}

          {/* Staged Attachment Preview Bar */}
          {stagedAttachment && (
            <View style={styles.stagedAttachmentBar}>
              <View style={styles.stagedAttachmentContent}>
                {stagedAttachment.previewUri ? (
                  <Image source={{ uri: stagedAttachment.previewUri }} style={styles.stagedThumbnail} />
                ) : (
                  <View style={styles.stagedIconBox}>
                    <Ionicons
                      name={
                        stagedAttachment.type === 'location'
                          ? 'location'
                          : stagedAttachment.type === 'document'
                          ? 'document-text'
                          : 'attach'
                      }
                      size={20}
                      color={AppColors.primary}
                    />
                  </View>
                )}
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={styles.stagedTitle} numberOfLines={1}>
                    {stagedAttachment.title}
                  </Text>
                  <Text style={styles.stagedSubtext}>
                    {stagedAttachment.type.toUpperCase()} • Add comment below & tap Send
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setStagedAttachment(null)} style={styles.stagedCloseBtn}>
                <Ionicons name="close-circle" size={22} color={AppColors.textMedium} />
              </TouchableOpacity>
            </View>
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
          {isRecording ? (
            <View style={[styles.inputRow, styles.recordingRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <TouchableOpacity onPress={cancelRecording} style={styles.recordingTrashBtn}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              </TouchableOpacity>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimerText}>
                Recording: {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity onPress={stopAndSendRecording} style={styles.recordingSendBtn}>
                <Ionicons name="arrow-up-circle" size={32} color={AppColors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <TouchableOpacity style={styles.attachBtn} onPress={() => setAttachmentModalVisible(true)}>
                <Ionicons name="add-circle-outline" size={26} color={AppColors.primary} />
              </TouchableOpacity>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={stagedAttachment ? "Add a caption/comment..." : "Write a message..."}
                  placeholderTextColor={AppColors.textMedium}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={1000}
                />
              </View>

              {inputText.trim() || stagedAttachment ? (
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={handleSend}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="send" size={18} color="white" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={startRecording}
                >
                  <Ionicons name="mic" size={20} color="white" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ─── Attachment Options Modal Sheet ─── */}
      <Modal
        visible={attachmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachmentModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAttachmentModalVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.dragIndicator} />
            <Text style={styles.modalHeading}>Send Attachment</Text>

            <View style={styles.attachmentGrid}>
              <TouchableOpacity style={styles.attachmentGridItem} onPress={handlePickImage}>
                <View style={[styles.attachmentIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="images" size={24} color="#0284C7" />
                </View>
                <Text style={styles.attachmentGridLabel}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentGridItem} onPress={handleTakeCamera}>
                <View style={[styles.attachmentIconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="camera" size={24} color="#EF4444" />
                </View>
                <Text style={styles.attachmentGridLabel}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentGridItem} onPress={handlePickDocument}>
                <View style={[styles.attachmentIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="document-text" size={24} color="#D97706" />
                </View>
                <Text style={styles.attachmentGridLabel}>Document</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentGridItem} onPress={handleShareLocation}>
                <View style={[styles.attachmentIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="location" size={24} color="#16A34A" />
                </View>
                <Text style={styles.attachmentGridLabel}>Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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
  },

  // ── Date Timeline Separator ──
  dateSeparatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateSeparatorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
  },

  // ── Message Bubbles ──
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    marginVertical: 2,
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
  // Avatar slot is preserved for alignment but made invisible for non-last messages
  avatarHidden: {
    opacity: 0,
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

  bubbleHighlighted: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  scrollToBottomFab: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 10,
  },

  // ── Reply Preview Inside Bubble ──
  replyPreviewInBubble: {
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
  },
  replyPreviewInBubbleRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderLeftColor: '#FFFFFF',
  },
  replyPreviewInBubbleLeft: {
    backgroundColor: '#F3F4F6',
    borderLeftColor: AppColors.primary,
  },
  replyPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  replyPreviewInBubbleSender: {
    fontSize: 10,
    fontWeight: '800',
  },
  replySenderRight: {
    color: '#FFFFFF',
  },
  replySenderLeft: {
    color: AppColors.primary,
  },
  replyPreviewInBubbleText: {
    fontSize: 11,
    fontWeight: '500',
  },
  replyTextRight: {
    color: 'rgba(255, 255, 255, 0.95)',
  },
  replyTextLeft: {
    color: AppColors.textDark,
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

  // ── Item / Product Metadata Card ──
  metadataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metadataCardRight: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  metadataCardLeft: {
    borderColor: '#E5E7EB',
  },
  metadataCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metadataImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  metadataImageFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: AppColors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metadataInfo: {
    flex: 1,
    gap: 2,
  },
  metadataTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metadataTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  metadataPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },

  // ── Attachment & Voice Note Styles ──
  attachBtn: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  recordingRow: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingTrashBtn: {
    padding: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    flex: 1,
    marginLeft: 10,
  },
  recordingSendBtn: {
    padding: 2,
  },
  attachmentMediaCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
    marginTop: 2,
  },
  attachmentImage: {
    width: SCREEN_W * 0.55,
    height: 160,
    borderRadius: 12,
  },
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginBottom: 4,
    minWidth: 160,
  },
  voiceBubbleRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  voiceBubbleLeft: {
    backgroundColor: '#F3F4F6',
  },
  voicePlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  voicePlayBtnRight: {
    backgroundColor: '#FFFFFF',
  },
  voicePlayBtnLeft: {
    backgroundColor: AppColors.primary,
  },
  voiceTrack: {
    flex: 1,
    gap: 4,
  },
  voiceTrackBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    width: '100%',
  },
  voiceTrackBarActive: {
    backgroundColor: AppColors.primary,
  },
  voiceDurationText: {
    fontSize: 10,
    fontWeight: '700',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 6,
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  locationCoords: {
    fontSize: 10,
    color: '#7F1D1D',
    marginTop: 1,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 6,
    gap: 8,
  },
  documentName: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textDark,
    flex: 1,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingVertical: 16,
    gap: 16,
  },
  attachmentGridItem: {
    alignItems: 'center',
    width: '40%',
    paddingVertical: 12,
    backgroundColor: '#FAF9FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachmentIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  attachmentGridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  stagedAttachmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stagedAttachmentContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stagedThumbnail: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  stagedIconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stagedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  stagedSubtext: {
    fontSize: 10,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  stagedCloseBtn: {
    padding: 6,
  },
});
