import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import feedService, { FeedComment, FeedCommentReply } from '../services/feedService';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function resolveMedia(url?: string | null): string {
  if (!url) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80';
  if (url.startsWith('http')) return url;
  return `${ApiConfig.baseUrl}${url}`;
}

interface CommentsScreenProps {
  visible: boolean;
  feedId: string | number;
  feedAuthorId?: string | number;
  commentsCount: number;
  onClose: () => void;
  onCommentAdded?: () => void;
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Misinformation',
  'Other',
];

export const CommentsScreen: React.FC<CommentsScreenProps> = ({
  visible,
  feedId,
  feedAuthorId,
  commentsCount,
  onClose,
  onCommentAdded,
}) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Editing state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editingReplyText, setEditingReplyText] = useState('');

  // Reply state
  const [replyingToComment, setReplyingToComment] = useState<FeedComment | null>(null);
  const [replyingToReply, setReplyingToReply] = useState<FeedCommentReply | null>(null);

  // Expanded replies
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentReplies, setCommentReplies] = useState<Record<number, FeedCommentReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());

  const inputRef = useRef<TextInput>(null);

  const loadComments = useCallback(async (pageNum = 1, refresh = false) => {
    if (loading && !refresh) return;
    if (refresh) { setRefreshing(true); setPage(1); }
    else setLoading(true);

    try {
      const result = await feedService.getComments(feedId, pageNum, 20);
      if (refresh || pageNum === 1) {
        setComments(result);
      } else {
        setComments(prev => [...prev, ...result]);
      }
      setHasMore(result.length === 20);
      setPage(pageNum);
    } catch (e) {
      console.error('Error loading comments:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feedId]);

  useEffect(() => {
    if (visible) {
      setComments([]);
      setPage(1);
      setHasMore(true);
      setExpandedComments(new Set());
      setCommentReplies({});
      loadComments(1, true);
    }
  }, [visible, feedId]);

  const loadReplies = async (commentId: number) => {
    if (loadingReplies.has(commentId)) return;
    setLoadingReplies(prev => new Set([...prev, commentId]));
    try {
      const replies = await feedService.getCommentReplies(commentId);
      setCommentReplies(prev => ({ ...prev, [commentId]: replies }));
      setExpandedComments(prev => new Set([...prev, commentId]));
    } catch (e) {
      console.error('Error loading replies:', e);
    } finally {
      setLoadingReplies(prev => {
        const s = new Set(prev);
        s.delete(commentId);
        return s;
      });
    }
  };

  const toggleReplies = (comment: FeedComment) => {
    if (expandedComments.has(comment.id)) {
      setExpandedComments(prev => {
        const s = new Set(prev);
        s.delete(comment.id);
        return s;
      });
    } else {
      if (!commentReplies[comment.id]) {
        loadReplies(comment.id);
      } else {
        setExpandedComments(prev => new Set([...prev, comment.id]));
      }
    }
  };

  const handleSubmitComment = async () => {
    const text = inputText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      if (replyingToComment) {
        // Reply to comment or nested reply to reply
        const parentReplyId = replyingToReply?.id;
        const reply = await feedService.addCommentReply(replyingToComment.id, text, parentReplyId);
        if (reply) {
          setCommentReplies(prev => ({
            ...prev,
            [replyingToComment.id]: [...(prev[replyingToComment.id] || []), reply],
          }));
          setExpandedComments(prev => new Set([...prev, replyingToComment.id]));
          setComments(prev =>
            prev.map(c =>
              c.id === replyingToComment.id
                ? { ...c, replies_count: (c.replies_count || 0) + 1 }
                : c
            )
          );
        }
        setReplyingToComment(null);
        setReplyingToReply(null);
      } else {
        // Top level comment
        const result = await feedService.addComment(feedId, text);
        if (result.success && result.comment) {
          setComments(prev => [result.comment!, ...prev]);
          onCommentAdded?.();
        } else {
          Alert.alert('Error', result.message || 'Failed to add comment');
        }
      }
      setInputText('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (comment: FeedComment) => {
    const text = editingText.trim();
    if (!text) return;
    const updated = await feedService.updateComment(feedId, comment.id, text);
    if (updated) {
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, content: text, is_edited: true } : c));
    }
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleDeleteComment = (comment: FeedComment) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const ok = await feedService.deleteComment(feedId, comment.id);
            if (ok) {
              setComments(prev => prev.filter(c => c.id !== comment.id));
              onCommentAdded?.();
            } else {
              Alert.alert('Error', 'Could not delete comment');
            }
          },
        },
      ]
    );
  };

  const handleReportComment = (comment: FeedComment) => {
    Alert.alert(
      'Report Comment',
      'Why are you reporting this comment?',
      [
        ...REPORT_REASONS.map(reason => ({
          text: reason,
          onPress: async () => {
            const ok = await feedService.reportComment(comment.id, reason);
            Alert.alert(ok ? 'Reported' : 'Error', ok ? 'Comment has been reported.' : 'Could not report. Try again.');
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleEditReply = async (reply: FeedCommentReply, commentId: number) => {
    const text = editingReplyText.trim();
    if (!text) return;
    const ok = await feedService.updateCommentReply(reply.id, text);
    if (ok) {
      setCommentReplies(prev => ({
        ...prev,
        [commentId]: (prev[commentId] || []).map(r =>
          r.id === reply.id ? { ...r, content: text, is_edited: true } : r
        ),
      }));
    }
    setEditingReplyId(null);
    setEditingReplyText('');
  };

  const handleDeleteReply = (reply: FeedCommentReply, commentId: number) => {
    Alert.alert(
      'Delete Reply',
      'Delete this reply?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const ok = await feedService.deleteCommentReply(reply.id);
            if (ok) {
              setCommentReplies(prev => ({
                ...prev,
                [commentId]: (prev[commentId] || []).filter(r => r.id !== reply.id),
              }));
              setComments(prev =>
                prev.map(c =>
                  c.id === commentId
                    ? { ...c, replies_count: Math.max((c.replies_count || 1) - 1, 0) }
                    : c
                )
              );
            }
          },
        },
      ]
    );
  };

  const showCommentOptions = (comment: FeedComment) => {
    const isOwn = String(comment.user?.id) === String(user?.id);
    const options = isOwn
      ? [
          {
            text: 'Edit',
            onPress: () => {
              setEditingCommentId(comment.id);
              setEditingText(comment.content);
            },
          },
          {
            text: 'Delete',
            style: 'destructive' as const,
            onPress: () => handleDeleteComment(comment),
          },
          { text: 'Cancel', style: 'cancel' as const },
        ]
      : [
          { text: 'Report', onPress: () => handleReportComment(comment) },
          { text: 'Cancel', style: 'cancel' as const },
        ];
    Alert.alert('Comment Options', undefined, options);
  };

  const showReplyOptions = (reply: FeedCommentReply, commentId: number) => {
    const isOwn = String(reply.user?.id) === String(user?.id);
    const options = isOwn
      ? [
          {
            text: 'Edit',
            onPress: () => {
              setEditingReplyId(reply.id);
              setEditingReplyText(reply.content);
            },
          },
          {
            text: 'Delete',
            style: 'destructive' as const,
            onPress: () => handleDeleteReply(reply, commentId),
          },
          { text: 'Cancel', style: 'cancel' as const },
        ]
      : [
          { text: 'Cancel', style: 'cancel' as const },
        ];
    Alert.alert('Reply Options', undefined, options);
  };

  const renderReply = (reply: FeedCommentReply, commentId: number) => {
    const isOwn = String(reply.user?.id) === String(user?.id);
    const isEditing = editingReplyId === reply.id;

    return (
      <View key={reply.id} style={styles.replyContainer}>
        <Image
          source={{ uri: resolveMedia(reply.user?.profile_image) }}
          style={styles.replyAvatar}
        />
        <View style={styles.replyBubble}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyAuthor}>{reply.user?.full_name || 'User'}</Text>
            {reply.is_edited && <Text style={styles.editedTag}> · edited</Text>}
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => showReplyOptions(reply, commentId)}
            >
              <Ionicons name="ellipsis-horizontal" size={14} color={AppColors.textLight} />
            </TouchableOpacity>
          </View>
          {isEditing ? (
            <View style={styles.inlineEditContainer}>
              <TextInput
                style={styles.inlineEditInput}
                value={editingReplyText}
                onChangeText={setEditingReplyText}
                multiline
                autoFocus
              />
              <View style={styles.inlineEditActions}>
                <TouchableOpacity onPress={() => { setEditingReplyId(null); setEditingReplyText(''); }}>
                  <Text style={styles.cancelEditBtn}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleEditReply(reply, commentId)}>
                  <Text style={styles.saveEditBtn}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.replyContent}>{reply.content}</Text>
          )}
          <View style={styles.replyActions}>
            <Text style={styles.commentTime}>{timeAgo(reply.created_at)}</Text>
            <TouchableOpacity
              style={styles.replyActionBtn}
              onPress={() => {
                const parentComment = comments.find(c => c.id === commentId);
                if (parentComment) {
                  setReplyingToComment(parentComment);
                  setReplyingToReply(reply);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }
              }}
            >
              <Text style={styles.replyActionText}>Reply</Text>
            </TouchableOpacity>
          </View>

          {/* Nested replies */}
          {reply.nested_replies && reply.nested_replies.length > 0 && (
            <View style={styles.nestedRepliesContainer}>
              {reply.nested_replies.map(nr => (
                <View key={nr.id} style={styles.nestedReplyRow}>
                  <Image
                    source={{ uri: resolveMedia(nr.user?.profile_image) }}
                    style={styles.nestedReplyAvatar}
                  />
                  <View style={styles.nestedReplyBubble}>
                    <Text style={styles.replyAuthor}>{nr.user?.full_name || 'User'}</Text>
                    <Text style={styles.replyContent}>{nr.content}</Text>
                    <Text style={styles.commentTime}>{timeAgo(nr.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderComment = ({ item: comment }: { item: FeedComment }) => {
    const isOwn = String(comment.user?.id) === String(user?.id);
    const isEditing = editingCommentId === comment.id;
    const isExpanded = expandedComments.has(comment.id);
    const replies = commentReplies[comment.id] || [];
    const isLoadingReplies = loadingReplies.has(comment.id);
    const repliesCount = comment.replies_count || 0;

    return (
      <View style={styles.commentCard}>
        <Image
          source={{ uri: resolveMedia(comment.user?.profile_image || comment.user?.avatar_url) }}
          style={styles.commentAvatar}
        />
        <View style={styles.commentBody}>
          <View style={styles.commentBubble}>
            <View style={styles.commentBubbleHeader}>
              <Text style={styles.commentAuthor}>{comment.user?.full_name || 'User'}</Text>
              {comment.is_edited && <Text style={styles.editedTag}> · edited</Text>}
              <TouchableOpacity style={styles.moreBtn} onPress={() => showCommentOptions(comment)}>
                <Ionicons name="ellipsis-horizontal" size={16} color={AppColors.textLight} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <View style={styles.inlineEditContainer}>
                <TextInput
                  style={styles.inlineEditInput}
                  value={editingText}
                  onChangeText={setEditingText}
                  multiline
                  autoFocus
                />
                <View style={styles.inlineEditActions}>
                  <TouchableOpacity onPress={() => { setEditingCommentId(null); setEditingText(''); }}>
                    <Text style={styles.cancelEditBtn}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleEditComment(comment)}>
                    <Text style={styles.saveEditBtn}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.commentContent}>{comment.content}</Text>
            )}
          </View>

          <View style={styles.commentActions}>
            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
            <TouchableOpacity
              style={styles.replyActionBtn}
              onPress={() => {
                setReplyingToComment(comment);
                setReplyingToReply(null);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
            >
              <Text style={styles.replyActionText}>Reply</Text>
            </TouchableOpacity>
          </View>

          {/* Show/Hide replies toggle */}
          {repliesCount > 0 || replies.length > 0 ? (
            <TouchableOpacity
              style={styles.showRepliesBtn}
              onPress={() => toggleReplies(comment)}
              disabled={isLoadingReplies}
            >
              {isLoadingReplies ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={styles.repliesLine} />
                  <Text style={styles.showRepliesText}>
                    {isExpanded
                      ? 'Hide replies'
                      : `View ${repliesCount || replies.length} ${repliesCount === 1 ? 'reply' : 'replies'}`}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={AppColors.primary}
                  />
                </View>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Replies list */}
          {isExpanded && replies.map(reply => renderReply(reply, comment.id))}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>
              Comments {commentsCount > 0 ? `(${commentsCount})` : ''}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={AppColors.textDark} />
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          {loading && comments.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => String(item.id)}
              renderItem={renderComment}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadComments(1, true)}
                  colors={[AppColors.primary]}
                />
              }
              onEndReached={() => {
                if (hasMore && !loading) {
                  loadComments(page + 1);
                }
              }}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubble-outline" size={48} color={AppColors.textLight} />
                  <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                </View>
              }
              ListFooterComponent={
                loading && comments.length > 0 ? (
                  <ActivityIndicator size="small" color={AppColors.primary} style={{ marginVertical: 16 }} />
                ) : null
              }
              contentContainerStyle={styles.listContent}
            />
          )}

          {/* Reply banner */}
          {replyingToComment && (
            <View style={styles.replyBanner}>
              <Ionicons name="return-down-forward-outline" size={16} color={AppColors.primary} />
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Replying to {replyingToReply ? replyingToReply.user?.full_name : replyingToComment.user?.full_name}
              </Text>
              <TouchableOpacity onPress={() => { setReplyingToComment(null); setReplyingToReply(null); }}>
                <Ionicons name="close-circle" size={18} color={AppColors.textMedium} />
              </TouchableOpacity>
            </View>
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
            <Image
              source={{ uri: resolveMedia(user?.profileImage) }}
              style={styles.inputAvatar}
            />
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={replyingToComment ? 'Write a reply...' : 'Add a comment...'}
              placeholderTextColor={AppColors.textLight}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || submitting) && styles.sendBtnDisabled]}
              onPress={handleSubmitComment}
              disabled={!inputText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={18} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  overlayDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dragHandle: {
    position: 'absolute',
    top: 6,
    left: '50%',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    marginLeft: -20,
  },
  sheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.textMedium,
    textAlign: 'center',
  },

  // Comment card
  commentCard: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    flexShrink: 0,
    backgroundColor: AppColors.primaryLight,
  },
  commentBody: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
    flex: 1,
  },
  editedTag: {
    fontSize: 11,
    color: AppColors.textLight,
    fontStyle: 'italic',
  },
  moreBtn: {
    padding: 4,
  },
  commentContent: {
    fontSize: 14,
    color: AppColors.textDark,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  commentTime: {
    fontSize: 12,
    color: AppColors.textLight,
  },
  replyActionBtn: {
    paddingVertical: 2,
  },
  replyActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },

  // Show replies toggle
  showRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
    gap: 4,
  },
  repliesLine: {
    width: 24,
    height: 1.5,
    backgroundColor: AppColors.textLight,
  },
  showRepliesText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },

  // Reply item
  replyContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginLeft: 8,
    gap: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.primaryLight,
    flexShrink: 0,
  },
  replyBubble: {
    flex: 1,
    backgroundColor: '#EEFAF5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textDark,
    flex: 1,
  },
  replyContent: {
    fontSize: 13,
    color: AppColors.textDark,
    lineHeight: 18,
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 3,
  },

  // Nested replies
  nestedRepliesContainer: {
    marginTop: 6,
    gap: 6,
  },
  nestedReplyRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  nestedReplyAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppColors.primaryLight,
    flexShrink: 0,
  },
  nestedReplyBubble: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  // Inline edit
  inlineEditContainer: {
    gap: 6,
  },
  inlineEditInput: {
    borderWidth: 1,
    borderColor: AppColors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: AppColors.textDark,
    backgroundColor: 'white',
  },
  inlineEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelEditBtn: {
    fontSize: 13,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  saveEditBtn: {
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '700',
  },

  // Reply banner
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EFF9F4',
    borderTopWidth: 1,
    borderTopColor: '#E0F5EA',
  },
  replyBannerText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '500',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: 'white',
  },
  inputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primaryLight,
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: AppColors.textDark,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: '#BDBDBD',
  },
});

export default CommentsScreen;
