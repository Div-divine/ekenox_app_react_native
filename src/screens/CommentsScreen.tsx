import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  StatusBar,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import feedService, { FeedComment, FeedCommentReply } from '../services/feedService';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Design tokens extracted from code.html (Material 3 green theme, Manrope type scale) ──
const C = {
  primary: '#006D40',
  primaryContainer: '#2BB673',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#004024',
  onSurface: '#1A1C1E',
  onSurfaceVariant: '#3D4A40',
  surface: '#F9F9FC',
  surfaceContainerLow: '#F3F3F6',
  surfaceVariant: '#E2E2E5',
  outlineVariant: '#BCCABD',
  background: '#F9F9FC',
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'now';
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

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Misinformation',
  'Other',
];

// Supported comment / reply reactions. Tapping the like button uses `like`;
// a long-press opens the picker to choose any other reaction.
const REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
];

const REACTION_EMOJI: Record<string, string> = Object.fromEntries(
  REACTIONS.map(r => [r.key, r.emoji])
);

export const CommentsScreen = () => {
  const route = useRoute<any>();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const feedId = route?.params?.feedId;
  const initialCount = route?.params?.commentsCount || 0;

  const handleShareComment = (text: string) => {
    Share.share({
      message: text,
    }).catch(err => console.log('Error sharing:', err));
  };

  const renderCommentContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[A-Z][a-z\u00C0-\u017F]+(?:\s+[A-Z][a-z\u00C0-\u017F]+)?)/g);
    return (
      <Text style={styles.bodyText}>
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            return (
              <Text key={index} style={{ color: C.primary, fontWeight: '600' }}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

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
  const [expandedComments, setExpandedComments] = useState<Set<string | number>>(new Set());
  const [commentReplies, setCommentReplies] = useState<Record<string | number, FeedCommentReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<string | number>>(new Set());

  // Optimistic reaction state for replies; persisted via feedService.toggleReplyReaction
  const [replyLiked, setReplyLiked] = useState<Record<number, boolean>>({});

  // Open reaction picker (long-press like button)
  const [reactionPicker, setReactionPicker] = useState<{
    kind: 'comment' | 'reply';
    commentId: string | number;
    replyId?: number;
  } | null>(null);

  const inputRef = useRef<TextInput>(null);

  const loadReplies = async (commentId: string | number) => {
    if (loadingReplies.has(commentId)) return;
    setLoadingReplies(prev => new Set([...prev, commentId]));
    try {
      const replies = await feedService.getCommentReplies(commentId);
      // Group flat replies under their parent so nested conversations render
      const tree = feedService.buildReplyTree(replies);
      setCommentReplies(prev => ({ ...prev, [commentId]: tree }));
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

  const loadComments = useCallback(async (pageNum = 1, refresh = false) => {
    if (loading && !refresh) return;
    if (refresh) { setRefreshing(true); setPage(1); }
    else setLoading(true);

    try {
      const result = await feedService.getComments(feedId, pageNum, 20);

      // Seed inline replies so they are immediately visible, and auto-load
      // replies for comments that report a count but carry no nested array.
      const seeded: Record<number, FeedCommentReply[]> = {};
      const toFetch: number[] = [];
      (result || []).forEach((c: any) => {
        const inline = c.nested_replies || c.replies || c.replies_array || [];
        if (Array.isArray(inline) && inline.length > 0) {
          seeded[c.id] = inline;
        } else if ((c.replies_count || 0) > 0) {
          toFetch.push(c.id);
        }
      });

      if (refresh || pageNum === 1) {
        setComments(result);
      } else {
        setComments(prev => [...prev, ...result]);
      }
      if (Object.keys(seeded).length > 0) {
        setCommentReplies(prev => ({ ...prev, ...seeded }));
        setExpandedComments(prev => new Set([...prev, ...Object.keys(seeded)]));
      }
      // Fire async loads outside the synchronous batch so list renders first
      toFetch.forEach(id => setTimeout(() => loadReplies(id), 0));
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
    setComments([]);
    setPage(1);
    setHasMore(true);
    setExpandedComments(new Set());
    setCommentReplies({});
    loadComments(1, true);
  }, [feedId]);

  const toggleReplies = (comment: FeedComment) => {
    const commentIdStr = String(comment.id);
    if (expandedComments.has(commentIdStr)) {
      setExpandedComments(prev => {
        const s = new Set(prev);
        s.delete(commentIdStr);
        return s;
      });
    } else {
      if (!commentReplies[commentIdStr]) {
        loadReplies(commentIdStr);
      } else {
        setExpandedComments(prev => new Set([...prev, commentIdStr]));
      }
    }
  };

  // Toggle a reaction on a comment (optimistic UI + persistence)
  const reactToComment = async (comment: FeedComment, reactionKey: string) => {
    const types = (comment.user_reaction_types || []);
    const hadType = types.includes(reactionKey);
    const nextTypes = hadType
      ? types.filter(t => t !== reactionKey)
      : [reactionKey, ...types.filter(t => t !== reactionKey)];

    setComments(prev =>
      prev.map(c =>
        c.id === comment.id
          ? {
            ...c,
            user_reaction_types: nextTypes,
            user_liked: nextTypes.length > 0,
            user_reacted: nextTypes.length > 0,
            reaction_type: nextTypes[0] ?? null,
            reactions_count: Math.max(0, (c.reactions_count ?? c.likes_count ?? 0) + (hadType ? -1 : 1)),
            likes_count: Math.max(0, (c.reactions_count ?? c.likes_count ?? 0) + (hadType ? -1 : 1)),
          }
          : c
      )
    );
    setReactionPicker(null);

    const res = await feedService.toggleCommentReaction(comment.id, reactionKey);
    if (res.success) {
      setComments(prev =>
        prev.map(c =>
          c.id === comment.id
            ? {
              ...c,
              user_liked: res.isLiked ?? c.user_liked,
              user_reacted: res.isLiked ?? c.user_reacted,
              reactions_count: res.reactionsCount ?? c.reactions_count ?? 0,
              likes_count: res.reactionsCount ?? c.reactions_count ?? 0,
              reaction_type: res.reaction_type ?? c.reaction_type ?? null,
              user_reaction_types: res.reaction_type
                ? [res.reaction_type, ...(c.user_reaction_types || []).filter(t => t !== res.reaction_type)]
                : c.user_reaction_types,
            }
            : c
        )
      );
    }
  };

  const reactToReply = async (reply: FeedCommentReply, commentId: number, reactionKey: string) => {
    const hadType = (reply.user_reaction_types || []).includes(reactionKey);
    const nextLiked = hadType ? reply.user_reaction_types!.length - 1 > 0 : true;
    const nextTypes = hadType
      ? (reply.user_reaction_types || []).filter(t => t !== reactionKey)
      : [reactionKey, ...(reply.user_reaction_types || []).filter(t => t !== reactionKey)];

    setReplyLiked(prev => ({ ...prev, [reply.id]: nextLiked }));
    setCommentReplies(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        const commentIdKey = k;
        const upd = (list: FeedCommentReply[]): FeedCommentReply[] =>
          list.map(r => {
            if (r.id !== reply.id) {
              return { ...r, nested_replies: r.nested_replies ? upd(r.nested_replies) : r.nested_replies };
            }
            return {
              ...r,
              user_reaction_types: nextTypes,
              user_liked: nextLiked,
              user_reacted: nextLiked,
              reaction_type: nextTypes[0] ?? null,
              reactions_count: Math.max(0, (r.reactions_count || 0) + (hadType ? -1 : 1)),
            };
          });
        next[commentIdKey] = upd(next[commentIdKey] || []);
      });
      return next;
    });
    setReactionPicker(null);

    const res = await feedService.toggleReplyReaction(reply.id, reactionKey);
    if (res.success) {
      setCommentReplies(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          const commentIdKey = k;
          const upd = (list: FeedCommentReply[]): FeedCommentReply[] =>
            list.map(r => {
              if (r.id === reply.id) {
                return {
                  ...r,
                  user_liked: res.isLiked ?? r.user_liked,
                  user_reacted: res.isLiked ?? r.user_reacted,
                  reactions_count: res.reactionsCount ?? r.reactions_count,
                  reaction_type: res.reaction_type ?? r.reaction_type ?? null,
                  user_reaction_types: res.reaction_type
                    ? [res.reaction_type, ...(r.user_reaction_types || []).filter(t => t !== res.reaction_type)]
                    : r.user_reaction_types,
                };
              }
              return { ...r, nested_replies: r.nested_replies ? upd(r.nested_replies) : r.nested_replies };
            });
          next[commentIdKey] = upd(next[commentIdKey] || []);
        });
        return next;
      });
    }
  };

  // The emoji to display on the like/reaction button, if the user reacted
  const activeReactionEmoji = (types: string[] | undefined, reacted: boolean) => {
    if (!reacted || !types || !types.length) return null;
    for (const t of types) if (REACTION_EMOJI[t]) return REACTION_EMOJI[t];
    return null;
  };

  const findReplyRecursive = (list: FeedCommentReply[], id: number): FeedCommentReply | null => {
    for (const r of list) {
      if (r.id === id) return r;
      if (r.nested_replies && r.nested_replies.length) {
        const found = findReplyRecursive(r.nested_replies, id);
        if (found) return found;
      }
    }
    return null;
  };

  const renderReactionPicker = (kind: 'comment' | 'reply', commentId: string | number, replyId?: number) => {
    if (!reactionPicker || reactionPicker.kind !== kind || String(reactionPicker.commentId) !== String(commentId) || reactionPicker.replyId !== replyId) {
      return null;
    }
    const targetReply = kind === 'reply'
      ? findReplyRecursive(commentReplies[String(commentId)] || [], replyId!)
      : null;
    if (kind === 'reply' && !targetReply) return null;
    return (
      <View style={styles.reactionPicker}>
        {REACTIONS.map(r => (
          <TouchableOpacity
            key={r.key}
            style={styles.reactionOption}
            onPress={() =>
              kind === 'comment'
                ? reactToComment(comments.find(c => c.id === commentId)!, r.key)
                : reactToReply(targetReply!, commentId, r.key)
            }
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleSubmitComment = async () => {
    const text = inputText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      if (replyingToComment) {
        const parentReplyId = replyingToReply?.id;
        const reply = await feedService.addCommentReply(replyingToComment.id, text, parentReplyId);
        if (reply) {
          const commentIdStr = String(replyingToComment.id);
          setCommentReplies(prev => ({
            ...prev,
            [commentIdStr]: feedService.buildReplyTree([
              ...(prev[commentIdStr] || []),
              reply,
            ]),
          }));
          setExpandedComments(prev => new Set([...prev, commentIdStr]));
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
        const result = await feedService.addComment(feedId, text);
        if (result.success && result.comment) {
          setComments(prev => [result.comment!, ...prev]);
          navigation.setParams({ commentsCount: (route?.params?.commentsCount || 0) + 1 });
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
              navigation.setParams({ commentsCount: Math.max(0, (route?.params?.commentsCount || 1) - 1) });
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

  const handleEditReply = async (reply: FeedCommentReply, commentId: string | number) => {
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

  const handleDeleteReply = (reply: FeedCommentReply, commentId: string | number) => {
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

  const showReplyOptions = (reply: FeedCommentReply, commentId: string | number) => {
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

  const renderReply = (reply: FeedCommentReply, commentId: string | number, depth: number, isLast: boolean) => {
    const isOwn = String(reply.user?.id) === String(user?.id);
    const isEditing = editingReplyId === reply.id;
    const reacted = reply.user_liked ?? replyLiked[reply.id] ?? false;
    const reactedTypes = reply.user_reaction_types || [];
    const reactionEmoji = activeReactionEmoji(reactedTypes, reacted);
    const likeCount = reply.reactions_count || 0;

    return (
      <View key={reply.id} style={[styles.replyContainer, depth > 1 && { marginLeft: 26 }]}>
        {/* Thread line under reply avatar */}
        {(!isLast || (reply.nested_replies && reply.nested_replies.length > 0)) && (
          <View
            style={[
              styles.replyThreadLine,
              depth > 1 ? { left: 13, top: 32 } : { left: 15, top: 36 }
            ]}
          />
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('Profile', { userId: reply.user?.id })}
          activeOpacity={0.7}
        >
          <Image source={{ uri: resolveMedia(reply.user?.profile_image) }} style={[styles.replyAvatar, depth > 1 && { width: 28, height: 28 }]} />
        </TouchableOpacity>
        <View style={styles.replyBody}>
          <View style={styles.replyNameRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile', { userId: reply.user?.id })}
              activeOpacity={0.7}
              style={{ flexShrink: 1 }}
            >
              <Text style={styles.replyAuthor} numberOfLines={1}>{reply.user?.full_name || 'User'}</Text>
            </TouchableOpacity>
            <Text style={styles.timeText}>{timeAgo(reply.created_at)}</Text>
            {reply.is_edited && <Text style={styles.editedTag}> · edited</Text>}
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => showReplyOptions(reply, commentId)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={C.onSurfaceVariant} />
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
            renderCommentContent(reply.content)
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.likeBtn, reacted && styles.likeBtnActive]}
              onPress={() => reactToReply(reply, commentId, 'like')}
              onLongPress={() => { setReactionPicker({ kind: 'reply', commentId, replyId: reply.id }); }}
              delayLongPress={350}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {reactionEmoji ? (
                <Text style={styles.reactionEmojiSmall}>{reactionEmoji}</Text>
              ) : (
                <Ionicons
                  name={reacted ? 'heart' : 'heart-outline'}
                  size={18}
                  color={reacted ? C.primary : C.onSurfaceVariant}
                />
              )}
              {likeCount > 0 && <Text style={[styles.likeCountText, reacted && { color: C.primary }]}>{likeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.replyBtn}
              onPress={() => {
                const parentComment = comments.find(c => String(c.id) === String(commentId));
                if (parentComment) {
                  setReplyingToComment(parentComment);
                  setReplyingToReply(reply);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.replyBtnText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.replyBtn}
              onPress={() => handleShareComment(reply.content)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.replyBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          {renderReactionPicker('reply', commentId, reply.id)}

          {reply.nested_replies && reply.nested_replies.length > 0 && (
            <View style={depth >= 5 ? styles.depthFlatContainer : styles.nestedRepliesContainer}>
              {reply.nested_replies.map((nr, index) => renderReply(nr, commentId, depth + 1, index === reply.nested_replies.length - 1))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderComment = ({ item: comment }: { item: FeedComment }) => {
    const isOwn = String(comment.user?.id) === String(user?.id);
    const isEditing = editingCommentId === comment.id;
    const commentIdStr = String(comment.id);
    const isExpanded = expandedComments.has(commentIdStr);
    const replies = commentReplies[commentIdStr] || [];
    const isLoadingReplies = loadingReplies.has(commentIdStr);
    const repliesCount = comment.replies_count || 0;
    const reacted = comment.user_reacted ?? comment.user_liked ?? false;
    const reactedTypes = comment.user_reaction_types || [];
    const reactionEmoji = activeReactionEmoji(reactedTypes, reacted);
    const likeCount = comment.reactions_count ?? comment.likes_count ?? 0;

    return (
      <View style={styles.commentBlock}>
        {/* Continuous thread line connecting comment to replies */}
        {isExpanded && replies.length > 0 && <View style={styles.commentThreadLine} />}

        <View style={styles.commentRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile', { userId: comment.user?.id })}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: resolveMedia(comment.user?.profile_image || comment.user?.avatar_url) }}
              style={styles.commentAvatar}
            />
          </TouchableOpacity>
          <View style={styles.commentBody}>
            <View style={styles.commentNameRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Profile', { userId: comment.user?.id })}
                activeOpacity={0.7}
                style={{ flexShrink: 1 }}
              >
                <Text style={styles.commentAuthor} numberOfLines={1}>{comment.user?.full_name || 'User'}</Text>
              </TouchableOpacity>
              <Text style={styles.timeText}>{timeAgo(comment.created_at)}</Text>
              {comment.is_edited && <Text style={styles.editedTag}> · edited</Text>}
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => showCommentOptions(comment)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={C.onSurfaceVariant} />
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
              renderCommentContent(comment.content)
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.likeBtn, reacted && styles.likeBtnActive]}
                onPress={() => reactToComment(comment, 'like')}
                onLongPress={() => setReactionPicker({ kind: 'comment', commentId: comment.id })}
                delayLongPress={350}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {reactionEmoji ? (
                  <Text style={styles.reactionEmojiSmall}>{reactionEmoji}</Text>
                ) : (
                  <Ionicons
                    name={reacted ? 'heart' : 'heart-outline'}
                    size={18}
                    color={reacted ? C.primary : C.onSurfaceVariant}
                  />
                )}
                {likeCount > 0 && <Text style={[styles.likeCountText, reacted && { color: C.primary }]}>{likeCount}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.replyBtn}
                onPress={() => {
                  setReplyingToComment(comment);
                  setReplyingToReply(null);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.replyBtnText}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.replyBtn}
                onPress={() => handleShareComment(comment.content)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.replyBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            {renderReactionPicker('comment', comment.id)}

            {repliesCount > 0 || replies.length > 0 ? (
              <TouchableOpacity
                style={styles.showRepliesBtn}
                onPress={() => toggleReplies(comment)}
                disabled={isLoadingReplies}
              >
                {isLoadingReplies ? (
                  <ActivityIndicator size="small" color={C.primary} />
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
                      color={C.primary}
                    />
                  </View>
                )}
              </TouchableOpacity>
            ) : null}

            {isExpanded && replies.length > 0 && (
              <View style={styles.repliesThread}>
                {replies.map((reply, index) => renderReply(reply, comment.id, 1, index === replies.length - 1))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSeparator = () => <View style={styles.commentSeparator} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

      {/* ── Top App Bar (code.html header) ── */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={C.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comments</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* ── Comments list ── */}
      {loading && comments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={item => String(item.id)}
          renderItem={renderComment}
          ItemSeparatorComponent={renderSeparator}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadComments(1, true)}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          onEndReached={() => {
            if (hasMore && !loading) {
              loadComments(page + 1);
            }
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color={C.outlineVariant} />
                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loading && comments.length > 0 ? (
              <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: 120 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Sticky Input Area (code.html input) ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        {replyingToComment && (
          <View style={styles.replyBanner}>
            <Ionicons name="return-down-forward-outline" size={14} color={C.primary} />
            <Text style={styles.replyBannerText} numberOfLines={1}>
              Replying to {replyingToReply ? replyingToReply.user?.full_name : replyingToComment.user?.full_name}
            </Text>
            <TouchableOpacity onPress={() => { setReplyingToComment(null); setReplyingToReply(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBox}>
          <Image
            source={{ uri: resolveMedia(user?.profileImage) }}
            style={styles.inputAvatar}
          />
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={replyingToComment ? 'Write a reply...' : 'Add a comment...'}
            placeholderTextColor={C.onSurfaceVariant}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.postBtn, (!inputText.trim() || submitting) && styles.postBtnDisabled]}
            onPress={handleSubmitComment}
            disabled={!inputText.trim() || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.onPrimaryContainer} />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },

  // Top App Bar
  topBar: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceVariant,
    zIndex: 10,
  },
  topBarRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    fontWeight: '700',
    color: C.onSurface,
  },
  headerSpacer: {
    width: 40,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: 'center',
  },
  commentSeparator: {
    height: 1,
    backgroundColor: C.surfaceVariant,
    marginVertical: 24,
  },

  // Comment (top level)
  commentBlock: {
    width: '100%',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 0.5,
    borderColor: C.outlineVariant,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  commentAuthor: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: C.onSurface,
  },
  timeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: C.onSurfaceVariant,
  },
  editedTag: {
    fontSize: 12,
    color: C.onSurfaceVariant,
    fontStyle: 'italic',
  },
  moreBtn: {
    marginLeft: 'auto',
    padding: 2,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 10,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeBtnActive: {
    backgroundColor: '#E4F2EA',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: -4,
  },
  reactionEmojiSmall: {
    fontSize: 16,
    lineHeight: 18,
  },
  reactionPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  reactionOption: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  reactionEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  likeCountText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: C.onSurfaceVariant,
  },
  replyBtn: {
    paddingVertical: 2,
  },
  replyBtnText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
  showRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  repliesLine: {
    width: 24,
    height: 1.5,
    backgroundColor: C.outlineVariant,
  },
  showRepliesText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
  },

  // Replies (thread with left line, indented — code.html pl-12, thread-line)
  repliesThread: {
    marginLeft: 20,
    paddingLeft: 28,
    marginTop: 12,
    gap: 24,
    position: 'relative',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    position: 'relative',
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    flexShrink: 0,
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 0.5,
    borderColor: C.outlineVariant,
  },
  replyBody: {
    flex: 1,
    minWidth: 0,
  },
  replyNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  replyAuthor: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: C.onSurface,
    flexShrink: 1,
  },
  nestedRepliesContainer: {
    marginTop: 16,
    paddingLeft: 20,
    gap: 16,
    position: 'relative',
  },
  commentThreadLine: {
    position: 'absolute',
    left: 19,
    top: 44,
    bottom: 0,
    width: 2,
    backgroundColor: C.surfaceVariant,
    zIndex: 0,
  },
  replyThreadLine: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    backgroundColor: C.surfaceVariant,
    zIndex: 0,
  },
  depthFlatContainer: {
    marginTop: 16,
    borderLeftWidth: 2,
    borderLeftColor: C.surfaceVariant,
    paddingLeft: 14,
    marginLeft: 0,
    gap: 16,
    position: 'relative',
  },
  nestedReplyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  nestedReplyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    flexShrink: 0,
    backgroundColor: C.surfaceContainerLow,
  },
  nestedReplyBody: {
    flex: 1,
    minWidth: 0,
  },

  // Inline edit
  inlineEditContainer: {
    marginTop: 4,
    gap: 6,
  },
  inlineEditInput: {
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: C.onSurface,
    backgroundColor: C.surface,
  },
  inlineEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelEditBtn: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    fontWeight: '600',
  },
  saveEditBtn: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '700',
  },

  // Sticky input
  inputArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(249, 249, 252, 0.95)',
    borderTopWidth: 1,
    borderTopColor: C.surfaceVariant,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  replyBannerText: {
    flex: 1,
    fontSize: 13,
    color: C.primary,
    fontWeight: '500',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: C.surfaceVariant,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 2,
    backgroundColor: C.surfaceContainerLow,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
  },
  postBtn: {
    backgroundColor: C.primaryContainer,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  postBtnDisabled: {
    opacity: 0.5,
  },
  postBtnText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: C.onPrimaryContainer,
  },
});

export default CommentsScreen;
