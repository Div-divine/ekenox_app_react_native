import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import { ApiConfig } from '../config/api';
import feedService, { Feed, Group, Event } from '../services/feedService';

interface GroupDetailScreenProps {
  route: any;
  navigation: any;
}

export const GroupDetailScreen = ({ route, navigation }: GroupDetailScreenProps) => {
  const { groupId } = route.params;

  const [group, setGroup] = useState<Group | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [groupFeeds, setGroupFeeds] = useState<Feed[]>([]);
  const [groupEvents, setGroupEvents] = useState<Event[]>([]);
  
  const [activeSubTab, setActiveSubTab] = useState(0); // 0 = Posts, 1 = Events
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadGroupDetails = async () => {
    try {
      console.log(`🔄 Fetching group details for ID: ${groupId}`);
      const data = await feedService.getGroupDetails(groupId);
      if (data) {
        setGroup(data.group);
        setStats(data.stats);
      }

      // Fetch group feed posts
      const posts = await feedService.getFeeds(1, 15, groupId);
      setGroupFeeds(posts);

      // Fetch group events
      const eventsList = await feedService.getGroupEvents(groupId);
      setGroupEvents(eventsList);

    } catch (error) {
      console.error('❌ Failed to fetch group detail data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadGroupDetails();
  }, [groupId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroupDetails();
  }, [groupId]);

  // Toggle group membership state
  const handleToggleJoin = async () => {
    if (!group) return;
    setIsActionLoading(true);

    const isJoined = group.user_membership && group.user_membership.status === 'active';
    try {
      if (isJoined) {
        const result = await feedService.leaveGroup(group.id);
        if (result.success) {
          Alert.alert('Left Group', `You have left "${group.name}".`);
          loadGroupDetails();
        } else {
          Alert.alert('Error', result.message || 'Failed to leave group.');
        }
      } else {
        const result = await feedService.joinGroup(group.id);
        if (result.success) {
          if (result.data?.status === 'pending') {
            Alert.alert('Request Sent', 'Join request sent successfully.');
          } else {
            Alert.alert('Success', `You joined "${group.name}"!`);
          }
          loadGroupDetails();
        } else {
          Alert.alert('Error', result.message || 'Failed to join group.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Like reaction toggle on group posts
  const handleLikePost = async (postId: number) => {
    setGroupFeeds(prevPosts =>
      prevPosts.map(post => {
        if (post.id === postId) {
          const newIsLiked = !post.is_liked;
          return {
            ...post,
            is_liked: newIsLiked,
            likes_count: newIsLiked ? post.likes_count + 1 : Math.max(0, post.likes_count - 1),
          };
        }
        return post;
      })
    );

    const result = await feedService.toggleReaction(postId);
    if (result.success) {
      setGroupFeeds(prevPosts =>
        prevPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              is_liked: result.isLiked,
              likes_count: result.likesCount,
            };
          }
          return post;
        })
      );
    }
  };

  // Resolve cover image path
  const getCoverImageUrl = () => {
    if (group?.cover_image_url) {
      return `${ApiConfig.baseUrl}/uploads/groups/covers/${group.cover_image_url}`;
    }
    return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800';
  };

  // Resolve profile image path
  const getProfileImageUrl = () => {
    if (group?.profile_image_url) {
      return `${ApiConfig.baseUrl}/uploads/groups/profiles/${group.profile_image_url}`;
    }
    return null;
  };

  const getPostImageUrl = (post: Feed) => {
    if (post.media && post.media.length > 0) {
      const mediaItem = post.media[0];
      return `${ApiConfig.baseUrl}/uploads/feeds/images/${mediaItem.file_path}`;
    }
    return null;
  };

  const getEventImageUrl = (event: Event) => {
    if (event.bannerImage) {
      return `${ApiConfig.baseUrl}/uploads/events/${event.bannerImage}`;
    }
    return 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=300';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={AppColors.primary} size="large" />
        <Text style={styles.loadingText}>Loading group detail...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={AppColors.error} />
          <Text style={styles.errorText}>Group details not found or deleted.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isJoined = group.user_membership && group.user_membership.status === 'active';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />
        }
      >
        {/* Cover Banner */}
        <View style={styles.bannerContainer}>
          <Image source={{ uri: getCoverImageUrl() }} style={styles.bannerImage} />
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Group Info Profile Summary */}
        <View style={styles.detailsHeader}>
          <View style={styles.avatarRow}>
            {getProfileImageUrl() ? (
              <Image source={{ uri: getProfileImageUrl()! }} style={styles.groupAvatar} />
            ) : (
              <View style={styles.groupAvatarPlaceholder}>
                <Ionicons name="people" size={32} color={AppColors.primary} />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.joinActionBtn,
                isJoined ? styles.joinActionBtnJoined : null,
              ]}
              onPress={handleToggleJoin}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator color={isJoined ? AppColors.textDark : 'white'} size="small" />
              ) : (
                <Text style={[styles.joinActionText, isJoined ? styles.joinActionTextJoined : null]}>
                  {isJoined ? 'Joined' : 'Join Group'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {group.privacy_level.toUpperCase()} GROUP • {group.members_count} MEMBERS
          </Text>
          {group.creator && (
            <Text style={styles.groupCreator}>Organized by {group.creator.full_name}</Text>
          )}

          <Text style={styles.groupDescription}>{group.description}</Text>
        </View>

        {/* Tab Selection */}
        <View style={styles.tabSelectorRow}>
          <TouchableOpacity
            style={[styles.subTabBtn, activeSubTab === 0 ? styles.subTabActive : null]}
            onPress={() => setActiveSubTab(0)}
          >
            <Text style={[styles.subTabText, activeSubTab === 0 ? styles.subTabTextActive : null]}>
              Posts ({groupFeeds.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTabBtn, activeSubTab === 1 ? styles.subTabActive : null]}
            onPress={() => setActiveSubTab(1)}
          >
            <Text style={[styles.subTabText, activeSubTab === 1 ? styles.subTabTextActive : null]}>
              Events ({groupEvents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sub-tab Content Area */}
        {activeSubTab === 0 ? (
          /* Group Feed Posts List */
          <View style={styles.tabContentArea}>
            {groupFeeds.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbox-ellipses-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.emptyText}>No posts shared in this group yet.</Text>
              </View>
            ) : (
              groupFeeds.map(post => {
                const postImage = getPostImageUrl(post);
                return (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postAuthorRow}>
                      {post.author?.profile_image ? (
                        <Image source={{ uri: post.author.profile_image }} style={styles.postAvatar} />
                      ) : (
                        <View style={[styles.postAvatar, { backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ color: AppColors.primary, fontWeight: 'bold', fontSize: 13 }}>
                            {(post.author?.full_name || 'Anonymous').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.postAuthorDetails}>
                        <Text style={styles.postAuthorName}>{post.author?.full_name || 'Anonymous'}</Text>
                        <Text style={styles.postTime}>{new Date(post.created_at).toLocaleDateString()}</Text>
                      </View>
                    </View>

                    <Text style={styles.postContent}>{post.content}</Text>

                    {postImage && (
                      <Image source={{ uri: postImage }} style={styles.postImage} />
                    )}

                    <View style={styles.postFooter}>
                      <TouchableOpacity style={styles.postFooterBtn} onPress={() => handleLikePost(post.id)}>
                        <Ionicons
                          name={post.is_liked ? 'heart' : 'heart-outline'}
                          size={20}
                          color={post.is_liked ? AppColors.error : AppColors.textMedium}
                        />
                        <Text style={[styles.postFooterText, post.is_liked ? styles.likedText : null]}>
                          {post.likes_count}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.postFooterBtn} onPress={() => Alert.alert('Comments', 'Comments are in read-only mode.')}>
                        <Ionicons name="chatbubble-outline" size={19} color={AppColors.textMedium} />
                        <Text style={styles.postFooterText}>{post.comments_count}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* Group Events List */
          <View style={styles.tabContentArea}>
            {groupEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.emptyText}>No events scheduled by this group.</Text>
              </View>
            ) : (
              groupEvents.map(event => (
                <View key={event.id} style={styles.eventCard}>
                  <Image source={{ uri: getEventImageUrl(event) }} style={styles.eventCardImage} />
                  <View style={styles.eventCardContent}>
                    <Text style={styles.eventCardTitle}>{event.title}</Text>
                    <Text style={styles.eventCardDesc} numberOfLines={2}>
                      {event.description || 'Join us for this group environmental action.'}
                    </Text>

                    <View style={styles.eventInfoRow}>
                      <Ionicons name="calendar-outline" size={14} color={AppColors.primary} />
                      <Text style={styles.eventInfoText}>
                        {new Date(event.startTime).toLocaleDateString()} at {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.eventInfoRow}>
                      <Ionicons name="location-outline" size={14} color={AppColors.primary} />
                      <Text style={styles.eventInfoText} numberOfLines={1}>
                        {event.location}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.eventRegisterBtn}
                      onPress={() => Alert.alert('Registered', `You are registered for event "${event.title}"!`)}
                    >
                      <Text style={styles.eventRegisterBtnText}>Register Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    marginTop: 12,
    color: AppColors.textMedium,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: AppColors.textMedium,
    textAlign: 'center',
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  bannerContainer: {
    position: 'relative',
    height: 180,
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  headerBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 24,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 8,
    borderRadius: 20,
  },
  detailsHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -40,
    marginBottom: 14,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: '#FAFAFA',
  },
  groupAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinActionBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 1,
    minWidth: 110,
    alignItems: 'center',
  },
  joinActionBtnJoined: {
    backgroundColor: '#F3F4F6',
  },
  joinActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  joinActionTextJoined: {
    color: AppColors.textDark,
  },
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  groupMeta: {
    fontSize: 11,
    color: AppColors.textMedium,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  groupCreator: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: AppColors.textMedium,
    lineHeight: 20,
    marginTop: 12,
  },
  tabSelectorRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  subTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: AppColors.primary,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  subTabTextActive: {
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  tabContentArea: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 10,
    color: AppColors.textMedium,
    fontSize: 13,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postAuthorDetails: {
    marginLeft: 10,
    flex: 1,
  },
  postAuthorName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  postTime: {
    fontSize: 11,
    color: AppColors.textLight,
  },
  postContent: {
    fontSize: 14,
    color: AppColors.textDark,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
    justifyContent: 'space-between',
  },
  postFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postFooterText: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginLeft: 6,
  },
  likedText: {
    color: AppColors.error,
    fontWeight: 'bold',
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECECEC',
    marginBottom: 14,
  },
  eventCardImage: {
    width: '100%',
    height: 140,
  },
  eventCardContent: {
    padding: 14,
  },
  eventCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  eventCardDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 12,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventInfoText: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginLeft: 6,
  },
  eventRegisterBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  eventRegisterBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
