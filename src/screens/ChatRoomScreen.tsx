import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
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
import collaborationService from '../services/collaborationService';
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
  type?: 'direct' | 'group' | 'collaboration';
  isGroup?: boolean;
  collaborationData?: {
    inquiryId: number;
    subject: string;
    collaborationType: string;
    budgetAmount?: string | null;
    currency?: string;
    compensationType?: string;
    status: string;
    targetDate?: string | null;
    sender?: any;
    receiver?: any;
  };
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

  // Collaboration Workspace State
  const [collabData, setCollabData] = useState<any>(route.params?.collaborationData || null);
  const [collabAgreementModalVisible, setCollabAgreementModalVisible] = useState(false);
  const [inviteCollabModalVisible, setInviteCollabModalVisible] = useState(false);
  const [completeCollabModalVisible, setCompleteCollabModalVisible] = useState(false);
  const [inviteTab, setInviteTab] = useState<'mutual' | 'email' | 'logs'>('mutual');
  const [mutualFollowers, setMutualFollowers] = useState<any[]>([]);
  const [isLoadingMutual, setIsLoadingMutual] = useState(false);
  const [mutualSearchQuery, setMutualSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [invitationLogs, setInvitationLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'CHATROOM_MEMBER' | 'CHATROOM_ADMIN'>('CHATROOM_MEMBER');
  const [completeNote, setCompleteNote] = useState('');
  const [isSubmittingCollabAction, setIsSubmittingCollabAction] = useState(false);

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

      // Auto-populate collaboration data from system banner message if not present
      if (!collabData) {
        const collabMsg = sorted.find(
          (m: any) =>
            m.metadata?.type === 'collaboration_agreement_banner' ||
            m.metadata?.type === 'collaboration_completed_banner' ||
            m.metadata?.inquiry_id
        );
        if (collabMsg?.metadata) {
          setCollabData({
            inquiryId: collabMsg.metadata.inquiry_id,
            subject: collabMsg.metadata.subject,
            collaborationType: collabMsg.metadata.collaboration_type,
            budgetAmount: collabMsg.metadata.budget,
            currency: collabMsg.metadata.currency,
            status: collabMsg.metadata.status || 'accepted',
          });
        }
      }
    } catch (e: any) {
      console.error('Failed to load messages:', e.message);
    } finally {
      setIsLoading(false);
    }
  }, [chatRoomId, collabData]);

  const handleCompleteCollaboration = async () => {
    if (!collabData?.inquiryId) return;
    setIsSubmittingCollabAction(true);
    try {
      await collaborationService.completeInquiry(collabData.inquiryId, completeNote);
      setCollabData((prev: any) => (prev ? { ...prev, status: 'completed' } : prev));
      setCompleteCollabModalVisible(false);
      setCompleteNote('');
      loadMessages(false);
      Alert.alert('Success', 'Collaboration marked as Completed! 🎉');
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.message || 'Failed to complete collaboration.'
      );
    } finally {
      setIsSubmittingCollabAction(false);
    }
  };

  const loadMutualFollowers = async (query?: string) => {
    if (!collabData?.inquiryId) return;
    setIsLoadingMutual(true);
    try {
      const res = await collaborationService.getMutualFollowers(collabData.inquiryId, query);
      setMutualFollowers(res.mutual_followers || []);
    } catch (e) {
      console.warn('Failed to load mutual followers for invite:', e);
    } finally {
      setIsLoadingMutual(false);
    }
  };

  const loadInvitationLogs = async () => {
    if (!collabData?.inquiryId) return;
    setIsLoadingLogs(true);
    try {
      const res = await collaborationService.getInvitations(collabData.inquiryId);
      setInvitationLogs(res.invitations || []);
    } catch (e) {
      console.warn('Failed to load invitation logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleOpenInviteModal = () => {
    setInviteCollabModalVisible(true);
    setInviteTab('mutual');
    loadMutualFollowers();
    loadInvitationLogs();
  };

  const handleInviteMutualFollower = async (targetUser: any) => {
    if (!collabData?.inquiryId) return;
    setIsSubmittingCollabAction(true);
    try {
      await collaborationService.inviteMember(collabData.inquiryId, {
        userId: targetUser.id,
        role: inviteRole,
        message: inviteMessage.trim() || undefined,
      });
      Alert.alert('Invitation Sent! ✉️', `Invitation sent to ${targetUser.full_name || targetUser.pseudo}.`);
      loadMutualFollowers(mutualSearchQuery);
      loadInvitationLogs();
      loadMessages(false);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.message || 'Failed to send invitation.'
      );
    } finally {
      setIsSubmittingCollabAction(false);
    }
  };

  const handleInviteEmail = async () => {
    if (!collabData?.inquiryId) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setIsSubmittingCollabAction(true);
    try {
      const res = await collaborationService.inviteMember(collabData.inquiryId, {
        email: cleanEmail,
        role: inviteRole,
        message: inviteMessage.trim() || undefined,
      });
      Alert.alert('Success 🎉', res.message || 'Invitation sent successfully!');
      setInviteEmail('');
      setInviteMessage('');
      setInviteTab('logs');
      loadInvitationLogs();
      loadMessages(false);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.message || 'Failed to send invitation.'
      );
    } finally {
      setIsSubmittingCollabAction(false);
    }
  };

  const handleCancelInvitation = (invite: any) => {
    setCancelInviteTarget(invite);
    setCancelReason('');
  };

  const handleConfirmCancelInvite = async () => {
    if (!cancelInviteTarget) return;
    setIsSubmittingCollabAction(true);
    try {
      await collaborationService.cancelInvitation(
        cancelInviteTarget.id,
        cancelReason.trim() || undefined
      );
      Alert.alert('Invitation Cancelled', 'The collaboration invitation has been cancelled.');
      setCancelInviteTarget(null);
      setCancelReason('');
      loadInvitationLogs();
      loadMutualFollowers(mutualSearchQuery);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.message || 'Failed to cancel invitation.'
      );
    } finally {
      setIsSubmittingCollabAction(false);
    }
  };

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

    // ── Collaboration Agreement / Completion System Banner ──
    if (
      metadata.type === 'collaboration_agreement_banner' ||
      metadata.type === 'collaboration_completed_banner'
    ) {
      const isCompleted =
        metadata.type === 'collaboration_completed_banner' || metadata.status === 'completed';
      return (
        <View
          style={[
            styles.collabBannerCard,
            isCompleted ? styles.collabCompletedCard : styles.collabActiveCard,
          ]}
        >
          <View style={styles.collabBannerHeader}>
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : 'briefcase'}
              size={18}
              color={isCompleted ? '#059669' : '#4F46E5'}
            />
            <Text
              style={[
                styles.collabBannerTitle,
                { color: isCompleted ? '#065F46' : '#312E81' },
              ]}
            >
              {isCompleted ? 'Collaboration Completed' : 'Collaboration Agreement'}
            </Text>
            <View
              style={[
                styles.collabBannerBadge,
                { backgroundColor: isCompleted ? '#D1FAE5' : '#EEF2FF' },
              ]}
            >
              <Text
                style={[
                  styles.collabBannerBadgeText,
                  { color: isCompleted ? '#065F46' : '#4338CA' },
                ]}
              >
                {(metadata.status || (isCompleted ? 'COMPLETED' : 'ACCEPTED')).toUpperCase()}
              </Text>
            </View>
          </View>
          {metadata.subject ? (
            <Text style={styles.collabBannerSubject}>{metadata.subject}</Text>
          ) : null}
          {metadata.budget ? (
            <Text style={styles.collabBannerBudget}>
              💰 Budget: {metadata.budget} {metadata.currency || 'EUR'}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.collabBannerBtn}
            onPress={() => setCollabAgreementModalVisible(true)}
          >
            <Text style={styles.collabBannerBtnText}>View Workspace Agreement</Text>
            <Ionicons name="chevron-forward" size={14} color="#4F46E5" />
          </TouchableOpacity>
        </View>
      );
    }

    // ── Collaboration Invitation / Acceptance / Member Metadata Card ──
    const isCollaboration =
      (typeof metadata.type === 'string' && metadata.type.startsWith('collaboration')) ||
      metadata.inquiry_id ||
      (typeof metadata.tag === 'string' && metadata.tag.toLowerCase().includes('collaboration'));

    if (isCollaboration) {
      const tagText = metadata.tag || 'Collaboration Invitation';
      const titleText = metadata.title || metadata.subject || 'Collaboration Workspace';
      const roleText =
        metadata.role_label ||
        (metadata.role ? (metadata.role === 'CHATROOM_ADMIN' ? 'Admin' : 'Collaborator') : '');
      const subtitleText =
        metadata.subtitle ||
        (roleText
          ? `Role: ${roleText}`
          : metadata.collaboration_type
          ? metadata.collaboration_type.replace(/_/g, ' ')
          : '');
      const statusText = metadata.status ? String(metadata.status).toUpperCase() : '';

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.metadataCard,
            isCurrentUser ? styles.metadataCardRight : styles.metadataCardLeft,
            { borderColor: '#C7D2FE', backgroundColor: '#F8FAFC' },
          ]}
          onPress={() => setCollabAgreementModalVisible(true)}
        >
          <View style={styles.metadataCardInner}>
            <View style={[styles.metadataImageFallback, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="briefcase" size={20} color="#4F46E5" />
            </View>
            <View style={styles.metadataInfo}>
              <View style={styles.metadataTagRow}>
                <Ionicons name="people" size={11} color="#4F46E5" />
                <Text style={[styles.metadataTagText, { color: '#4F46E5' }]}>
                  {tagText}
                </Text>
              </View>
              <Text style={styles.metadataTitle} numberOfLines={1}>
                {titleText}
              </Text>
              {subtitleText ? (
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  {subtitleText}
                </Text>
              ) : null}
            </View>
            {statusText ? (
              <View
                style={{
                  backgroundColor: statusText === 'ACCEPTED' ? '#D1FAE5' : '#EEF2FF',
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '800',
                    color: statusText === 'ACCEPTED' ? '#065F46' : '#4F46E5',
                  }}
                >
                  {statusText}
                </Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // ── Marketplace Item Check ──
    const isMarketplace =
      metadata.type === 'marketplace_item' ||
      metadata.type === 'product' ||
      metadata.product_id ||
      metadata.productId ||
      metadata.product ||
      metadata.product_title ||
      metadata.seller_name ||
      metadata.sellerName;

    if (!isMarketplace) {
      return null;
    }

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

      {/* ─── Pinned Collaboration Workspace Banner ─── */}
      {collabData && (
        <View style={styles.collabPinnedBar}>
          <View style={styles.collabPinnedTop}>
            <View style={styles.collabPinnedTitleRow}>
              <Ionicons name="briefcase" size={15} color="#4F46E5" />
              <Text style={styles.collabPinnedTitle} numberOfLines={1}>
                {collabData.subject || 'Collaboration Workspace'}
              </Text>
            </View>
            <View
              style={[
                styles.collabStatusBadge,
                {
                  backgroundColor:
                    collabData.status === 'completed' ? '#EEF2FF' : '#ECFDF5',
                },
              ]}
            >
              <Text
                style={[
                  styles.collabStatusText,
                  {
                    color:
                      collabData.status === 'completed' ? '#4F46E5' : '#059669',
                  },
                ]}
              >
                {(collabData.status || 'ACCEPTED').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.collabPinnedBottom}>
            <Text style={styles.collabPinnedSub} numberOfLines={1}>
              🏷️ {collabData.collaborationType?.replace(/_/g, ' ') || 'Collaboration'} •{' '}
              {collabData.budgetAmount
                ? `💰 ${collabData.budgetAmount} ${collabData.currency || 'EUR'}`
                : (collabData.compensationType || 'Negotiable')}
            </Text>

            <View style={styles.collabActionButtonsRow}>
              <TouchableOpacity
                style={styles.collabMiniBtn}
                onPress={() => setCollabAgreementModalVisible(true)}
              >
                <Ionicons name="document-text-outline" size={12} color="#4F46E5" />
                <Text style={styles.collabMiniBtnText}>Agreement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.collabMiniBtn}
                onPress={handleOpenInviteModal}
              >
                <Ionicons name="person-add-outline" size={12} color="#4F46E5" />
                <Text style={styles.collabMiniBtnText}>Invite</Text>
              </TouchableOpacity>

              {collabData.status === 'accepted' && (
                <TouchableOpacity
                  style={[styles.collabMiniBtn, styles.collabCompleteMiniBtn]}
                  onPress={() => setCompleteCollabModalVisible(true)}
                >
                  <Ionicons name="checkmark-done" size={12} color="#FFF" />
                  <Text style={[styles.collabMiniBtnText, { color: '#FFF' }]}>Complete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

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

      {/* ─── Collaboration Agreement Details Modal ─── */}
      <Modal
        visible={collabAgreementModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCollabAgreementModalVisible(false)}
      >
        <SafeAreaView style={styles.collabModalContainer} edges={['top', 'bottom']}>
          <View style={styles.collabModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="briefcase" size={20} color="#4F46E5" />
              <Text style={styles.collabModalTitle}>Collaboration Agreement</Text>
            </View>
            <TouchableOpacity
              onPress={() => setCollabAgreementModalVisible(false)}
              style={styles.collabModalCloseBtn}
            >
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {collabData && (
            <View style={{ flex: 1, padding: 20 }}>
              <View style={styles.collabModalCard}>
                <Text style={styles.collabModalCardSubject}>{collabData.subject}</Text>
                <View style={styles.collabModalMetaRow}>
                  <View style={styles.collabModalTag}>
                    <Text style={styles.collabModalTagText}>
                      🏷️ {collabData.collaborationType?.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.collabModalStatusBadge,
                      { backgroundColor: collabData.status === 'completed' ? '#EEF2FF' : '#ECFDF5' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.collabModalStatusText,
                        { color: collabData.status === 'completed' ? '#4F46E5' : '#059669' },
                      ]}
                    >
                      {(collabData.status || 'ACCEPTED').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.collabModalSection}>
                <Text style={styles.collabModalSectionHeader}>Compensation & Timeline</Text>
                <Text style={styles.collabModalSectionText}>
                  💰 Budget: {collabData.budgetAmount ? `${collabData.budgetAmount} ${collabData.currency || 'EUR'}` : (collabData.compensationType || 'Negotiable')}
                </Text>
                {collabData.targetDate ? (
                  <Text style={styles.collabModalSectionText}>
                    📅 Target Date: {new Date(collabData.targetDate).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>

              <View style={styles.collabModalSection}>
                <Text style={styles.collabModalSectionHeader}>Workspace Tools</Text>
                <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 12 }}>
                  Use this dedicated workspace to exchange media, coordinate deliverables, invite team members, and finalize project execution.
                </Text>
              </View>

              <View style={{ marginTop: 'auto', gap: 10 }}>
                {collabData.status === 'accepted' && (
                  <TouchableOpacity
                    style={styles.collabModalCompleteBtn}
                    onPress={() => {
                      setCollabAgreementModalVisible(false);
                      setCompleteCollabModalVisible(true);
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                    <Text style={styles.collabModalCompleteBtnText}>Mark as Completed</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.collabModalInviteBtn}
                  onPress={() => {
                    setCollabAgreementModalVisible(false);
                    handleOpenInviteModal();
                  }}
                >
                  <Ionicons name="person-add-outline" size={18} color="#4F46E5" />
                  <Text style={styles.collabModalInviteBtnText}>Invite Stakeholder / Team Member</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ─── Invite Collaborator Modal (Mutual Followers / Email / Logs) ─── */}
      <Modal
        visible={inviteCollabModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteCollabModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setInviteCollabModalVisible(false)}
          />
          <View
            style={[
              styles.collabActionModalBox,
              {
                width: '100%',
                maxWidth: '100%',
                maxHeight: '90%',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                padding: 0,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            {/* Modal Handle Bar */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />

            {/* Modal Header */}
            <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="person-add" size={20} color="#4F46E5" />
                  <Text style={styles.collabActionModalTitle}>Invite Collaborators</Text>
                </View>
                <TouchableOpacity onPress={() => setInviteCollabModalVisible(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Segmented Tab Controls */}
              <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, marginTop: 12 }}>
                <TouchableOpacity
                  style={[{ flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center' }, inviteTab === 'mutual' && { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }]}
                  onPress={() => setInviteTab('mutual')}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '700', color: '#64748B' }, inviteTab === 'mutual' && { color: '#4F46E5' }]}>👥 Mutuals</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[{ flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center' }, inviteTab === 'email' && { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }]}
                  onPress={() => setInviteTab('email')}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '700', color: '#64748B' }, inviteTab === 'email' && { color: '#4F46E5' }]}>✉️ Email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[{ flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center' }, inviteTab === 'logs' && { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }]}
                  onPress={() => {
                    setInviteTab('logs');
                    loadInvitationLogs();
                  }}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '700', color: '#64748B' }, inviteTab === 'logs' && { color: '#4F46E5' }]}>
                    📋 Logs {invitationLogs.length > 0 ? `(${invitationLogs.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tab 1: Mutual Followers */}
            {inviteTab === 'mutual' && (
              <View style={{ padding: 16, maxHeight: 420 }}>
                <TextInput
                  style={[styles.collabTextInput, { marginBottom: 10 }]}
                  placeholder="🔍 Search mutual friends..."
                  placeholderTextColor="#94A3B8"
                  value={mutualSearchQuery}
                  onChangeText={txt => {
                    setMutualSearchQuery(txt);
                    loadMutualFollowers(txt);
                  }}
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Select Role to Assign:</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' }, inviteRole === 'CHATROOM_MEMBER' && { backgroundColor: '#4F46E5' }]}
                      onPress={() => setInviteRole('CHATROOM_MEMBER')}
                    >
                      <Text style={[{ fontSize: 11, fontWeight: '700', color: '#64748B' }, inviteRole === 'CHATROOM_MEMBER' && { color: '#FFF' }]}>Member</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' }, inviteRole === 'CHATROOM_ADMIN' && { backgroundColor: '#4F46E5' }]}
                      onPress={() => setInviteRole('CHATROOM_ADMIN')}
                    >
                      <Text style={[{ fontSize: 11, fontWeight: '700', color: '#64748B' }, inviteRole === 'CHATROOM_ADMIN' && { color: '#FFF' }]}>Admin</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isLoadingMutual ? (
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>Loading mutual followers...</Text>
                  </View>
                ) : mutualFollowers.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center' }}>
                      No mutual followers found. You can invite anyone by typing their email in the Email tab!
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={mutualFollowers}
                    keyExtractor={item => String(item.id)}
                    showsVerticalScrollIndicator={false}
                    style={{ maxHeight: 280 }}
                    renderItem={({ item }) => {
                      const avatarUri = item.profile_image ? UrlHelper.convertPathToUrl(item.profile_image) : null;
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 }}>
                            {avatarUri ? (
                              <Image source={{ uri: avatarUri }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                            ) : (
                              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#4F46E5' }}>{(item.full_name || item.pseudo || 'U').charAt(0)}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{item.full_name || item.pseudo}</Text>
                              <Text style={{ fontSize: 11, color: '#64748B' }} numberOfLines={1}>{item.email}</Text>
                            </View>
                          </View>

                          {item.is_member ? (
                            <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669' }}>JOINED</Text>
                            </View>
                          ) : item.has_pending_invitation ? (
                            <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#D97706' }}>PENDING</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' }}
                              onPress={() => handleInviteMutualFollower(item)}
                              disabled={isSubmittingCollabAction}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#4F46E5' }}>Invite</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            )}

            {/* Tab 2: Invite by Email */}
            {inviteTab === 'email' && (
              <ScrollView style={{ padding: 16, maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.collabInputLabel}>Recipient Email Address *</Text>
                <TextInput
                  style={styles.collabTextInput}
                  placeholder="e.g. partner@brand.com"
                  placeholderTextColor="#94A3B8"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.collabInputLabel}>Workspace Role</Text>
                <View style={styles.collabRoleRow}>
                  <TouchableOpacity
                    style={[styles.collabRoleChip, inviteRole === 'CHATROOM_MEMBER' && styles.collabRoleChipActive]}
                    onPress={() => setInviteRole('CHATROOM_MEMBER')}
                  >
                    <Text style={[styles.collabRoleChipText, inviteRole === 'CHATROOM_MEMBER' && styles.collabRoleChipTextActive]}>Member / Contributor</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.collabRoleChip, inviteRole === 'CHATROOM_ADMIN' && styles.collabRoleChipActive]}
                    onPress={() => setInviteRole('CHATROOM_ADMIN')}
                  >
                    <Text style={[styles.collabRoleChipText, inviteRole === 'CHATROOM_ADMIN' && styles.collabRoleChipTextActive]}>Admin / Co-Host</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.collabInputLabel}>Personal Note (Optional)</Text>
                <TextInput
                  style={[styles.collabTextInput, { height: 64, textAlignVertical: 'top' }]}
                  placeholder="Add a friendly note or instructions..."
                  placeholderTextColor="#94A3B8"
                  value={inviteMessage}
                  onChangeText={setInviteMessage}
                  multiline
                />

                <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, color: '#64748B', lineHeight: 16 }}>
                    💡 If the user already has an EkeNox account, they'll receive an instant in-app invitation & email. If not registered, they'll receive an invitation email with full project details and an onboarding link.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.collabModalConfirm, { width: '100%', paddingVertical: 12, marginBottom: 10 }, isSubmittingCollabAction && { opacity: 0.6 }]}
                  onPress={handleInviteEmail}
                  disabled={isSubmittingCollabAction}
                >
                  {isSubmittingCollabAction ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.collabModalConfirmText}>Send Email Invitation</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Tab 3: Invitation Logs & Status */}
            {inviteTab === 'logs' && (
              <View style={{ padding: 16, maxHeight: 420 }}>
                {isLoadingLogs ? (
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>Loading invitation logs...</Text>
                  </View>
                ) : invitationLogs.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="mail-unread-outline" size={32} color="#CBD5E1" />
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center' }}>
                      No invitations have been sent yet for this collaboration.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={invitationLogs}
                    keyExtractor={item => String(item.id)}
                    showsVerticalScrollIndicator={false}
                    style={{ maxHeight: 320 }}
                    renderItem={({ item }) => {
                      const isPending = item.status === 'pending';
                      const isAccepted = item.status === 'accepted';
                      const isDeclined = item.status === 'declined';
                      const statusColor = isAccepted ? '#059669' : isPending ? '#D97706' : isDeclined ? '#DC2626' : '#64748B';
                      const statusBg = isAccepted ? '#ECFDF5' : isPending ? '#FFFBEB' : isDeclined ? '#FEF2F2' : '#F1F5F9';

                      return (
                        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 }} numberOfLines={1}>
                              {item.invited_user?.full_name || item.email}
                            </Text>
                            <View style={{ backgroundColor: statusBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: statusColor }}>
                                {item.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                            {item.email} • Role: <Text style={{ fontWeight: '700', color: '#4F46E5' }}>{item.role === 'CHATROOM_ADMIN' ? 'Admin' : 'Member'}</Text>
                          </Text>

                          {item.message ? (
                            <Text style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginBottom: 6 }}>
                              "{item.message}"
                            </Text>
                          ) : null}

                          {item.cancellation_reason ? (
                            <View style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6, marginVertical: 4 }}>
                              <Text style={{ fontSize: 11, color: '#991B1B' }}>
                                Cancelled Reason: "{item.cancellation_reason}"
                              </Text>
                            </View>
                          ) : null}

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                              Invited by {item.invited_by?.full_name || 'Owner'}
                            </Text>
                            {isPending && (
                              <TouchableOpacity onPress={() => handleCancelInvitation(item)}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>Cancel Invite</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Cancel Invitation Modal with Optional Reason ─── */}
      <Modal
        visible={cancelInviteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelInviteTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCancelInviteTarget(null)}
        >
          <View style={styles.collabActionModalBox} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="alert-circle-outline" size={22} color="#EF4444" />
              <Text style={styles.collabActionModalTitle}>Cancel Invitation</Text>
            </View>

            <Text style={styles.collabActionModalSubtitle}>
              Are you sure you want to cancel the invitation sent to{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                {cancelInviteTarget?.invited_user?.full_name || cancelInviteTarget?.email}
              </Text>?
            </Text>

            <Text style={styles.collabInputLabel}>Reason for Cancellation (Optional)</Text>
            <TextInput
              style={[styles.collabTextInput, { height: 60, textAlignVertical: 'top' }]}
              placeholder="e.g. Position filled, date conflict, or invited by mistake..."
              placeholderTextColor="#94A3B8"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />

            <View style={styles.collabModalActions}>
              <TouchableOpacity
                style={styles.collabModalCancel}
                onPress={() => setCancelInviteTarget(null)}
              >
                <Text style={styles.collabModalCancelText}>Keep Invite</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.collabModalConfirm,
                  { backgroundColor: '#EF4444' },
                  isSubmittingCollabAction && { opacity: 0.6 },
                ]}
                onPress={handleConfirmCancelInvite}
                disabled={isSubmittingCollabAction}
              >
                {isSubmittingCollabAction ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.collabModalConfirmText}>Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Mark Collaboration Complete Modal ─── */}
      <Modal
        visible={completeCollabModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompleteCollabModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCompleteCollabModalVisible(false)}
        >
          <View style={styles.collabActionModalBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="checkmark-done-circle" size={22} color="#059669" />
              <Text style={styles.collabActionModalTitle}>Mark as Completed</Text>
            </View>
            <Text style={styles.collabActionModalSubtitle}>
              Have all deliverables been fulfilled? Marking this collaboration as completed will update the project state for all participants.
            </Text>

            <Text style={styles.collabInputLabel}>Completion Note (Optional)</Text>
            <TextInput
              style={[styles.collabTextInput, { height: 70, textAlignVertical: 'top' }]}
              placeholder="e.g. Deliverables submitted and verified..."
              placeholderTextColor="#94A3B8"
              value={completeNote}
              onChangeText={setCompleteNote}
              multiline
            />

            <View style={styles.collabModalActions}>
              <TouchableOpacity
                style={styles.collabModalCancel}
                onPress={() => setCompleteCollabModalVisible(false)}
              >
                <Text style={styles.collabModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.collabModalConfirm,
                  { backgroundColor: '#059669' },
                  isSubmittingCollabAction && { opacity: 0.6 },
                ]}
                onPress={handleCompleteCollaboration}
                disabled={isSubmittingCollabAction}
              >
                {isSubmittingCollabAction ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.collabModalConfirmText}>Confirm Complete</Text>
                )}
              </TouchableOpacity>
            </View>
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

  // ── Pinned Collaboration Workspace Bar ──
  collabPinnedBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  collabPinnedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  collabPinnedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  collabPinnedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  collabStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  collabStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  collabPinnedBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  collabPinnedSub: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    marginRight: 6,
  },
  collabActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collabMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  collabMiniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  collabCompleteMiniBtn: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },

  // ── Collaboration Banner Message Bubble Card ──
  collabBannerCard: {
    padding: 14,
    borderRadius: 14,
    marginVertical: 4,
    borderWidth: 1,
  },
  collabActiveCard: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  collabCompletedCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  collabBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  collabBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  collabBannerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  collabBannerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  collabBannerSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  collabBannerBudget: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  collabBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  collabBannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // ── Collaboration Modals ──
  collabModalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  collabModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  collabModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  collabModalCloseBtn: {
    padding: 4,
  },
  collabModalCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  collabModalCardSubject: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
  },
  collabModalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collabModalTag: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  collabModalTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'capitalize',
  },
  collabModalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  collabModalStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  collabModalSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  collabModalSectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  collabModalSectionText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 4,
  },
  collabModalCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 10,
  },
  collabModalCompleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  collabModalInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  collabModalInviteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  collabActionModalBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  collabActionModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  collabActionModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  collabInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  collabTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  collabRoleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  collabRoleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  collabRoleChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  collabRoleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  collabRoleChipTextActive: {
    color: '#FFF',
  },
  collabModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  collabModalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  collabModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  collabModalConfirm: {
    flex: 1.5,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
  },
  collabModalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

