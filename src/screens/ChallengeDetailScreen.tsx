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
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons, FontAwesome, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppColors } from '../theme/colors';
import challengeService, { Challenge } from '../services/challengeService';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import feedService from '../services/feedService';
import { useSafeVideoPlayer } from '../hooks/useSafeVideoPlayer';
import { VideoView } from 'expo-video';
import { UrlHelper } from '../utils/urlHelper';

const resolveMediaUrl = (url?: string) => {
  return UrlHelper.convertPathToUrl(url);
};

const ChallengeVideoPlayer = ({ videoUrl }: { videoUrl: string }) => {
  const player = useSafeVideoPlayer(videoUrl, p => {
    if (p) {
      p.loop = true;
      p.muted = false;
    }
  });
  return (
    <View style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 12 }}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={true}
      />
    </View>
  );
};

const { width } = Dimensions.get('window');

const getCategoryDetails = (category: any) => {
  return {
    icon: category?.icon || 'leaf',
    color: category?.color || '#4CAF50',
    iconType: category?.icon_type || 'ionicons',
    name: category?.display_name || category?.name || 'General',
  };
};

const CategoryIcon = ({ icon, type, size, color }: { icon: string; type: string; size: number; color: string }) => {
  const libType = (type || 'ionicons').toLowerCase();
  switch (libType) {
    case 'fontawesome':
    case 'font-awesome':
      return <FontAwesome name={icon as any} size={size} color={color} />;
    case 'material':
    case 'materialicons':
      return <MaterialIcons name={icon as any} size={size} color={color} />;
    case 'materialcommunity':
    case 'materialcommunityicons':
      return <MaterialCommunityIcons name={icon as any} size={size} color={color} />;
    case 'ionicons':
    default:
      return <Ionicons name={icon as any} size={size} color={color} />;
  }
};

export const ChallengeDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { refreshProfile } = useAuth();

  const routeChallenge = route.params?.challenge;
  const challengeId = route.params?.challengeId || routeChallenge?.id;
  const initialIsActive = route.params?.isActive ?? routeChallenge?.is_active ?? false;

  const [challenge, setChallenge] = useState<any>(routeChallenge || null);
  const [tips, setTips] = useState<any[]>(routeChallenge?.tips || []);
  const [loading, setLoading] = useState<boolean>(!routeChallenge);
  const [isActive, setIsActive] = useState<boolean>(initialIsActive);
  const [joining, setJoining] = useState<boolean>(false);

  // Duration join modal states
  const [durationModalVisible, setDurationModalVisible] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(7);
  const [customDays, setCustomDays] = useState<string>('7');
  const [kickOffDate, setKickOffDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Tab & Community Feeds state
  const initialTab = route.params?.initialTab === 'community' ? 'community' : 'info';
  const [activeTab, setActiveTab] = useState<'info' | 'community'>(initialTab);
  const [feeds, setFeeds] = useState<any[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [feedsPage, setFeedsPage] = useState(1);
  const [hasMoreFeeds, setHasMoreFeeds] = useState(true);

  // Creation State
  const [postContent, setPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'image' | 'video'; name: string } | null>(null);
  const [posting, setPosting] = useState(false);

  const loadFeeds = async (page = 1, isRefresh = false) => {
    if (feedsLoading) return;
    setFeedsLoading(true);
    try {
      const list = await feedService.getChallengeFeeds(challengeId, page, 10);
      if (isRefresh || page === 1) {
        setFeeds(list);
        setFeedsPage(1);
        setHasMoreFeeds(list.length === 10);
      } else {
        if (list.length > 0) {
          setFeeds(prev => [...prev, ...list]);
          setFeedsPage(page);
          setHasMoreFeeds(list.length === 10);
        } else {
          setHasMoreFeeds(false);
        }
      }
    } catch (err) {
      console.error('Failed to load challenge feeds:', err);
    } finally {
      setFeedsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'community' && challengeId) {
      loadFeeds(1, true);
    }
  }, [activeTab, challengeId]);

  const pickProofMedia = async (type: 'image' | 'video') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type,
        name: asset.fileName || `${type}_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`,
      });
    }
  };

  const captureProofMedia = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setSelectedMedia({
        uri: asset.uri,
        type: isVideo ? 'video' : 'image',
        name: asset.fileName || `capture_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      });
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() && !selectedMedia) {
      Alert.alert('Empty Post', 'Please write a comment or add an image/video.');
      return;
    }
    setPosting(true);
    try {
      const result = await feedService.createFeedFull({
        content: postContent.trim() || ' ',
        postType: 'challenge',
        mediaFiles: selectedMedia ? [selectedMedia] : undefined,
        challengeId: challenge?.id || challengeId,
        privacyLevel: 'public',
      });

      if (result.success) {
        Alert.alert('Posted!', 'Your challenge progress proof has been shared!');
        setPostContent('');
        setSelectedMedia(null);
        loadFeeds(1, true);
      } else {
        Alert.alert('Error', result.message || 'Failed to post progress proof.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setPosting(false);
    }
  };

  const handleLikePost = async (postId: string | number) => {
    setFeeds(prev => prev.map(p => {
      if (p.id === postId) {
        const newIsLiked = !p.is_liked;
        return {
          ...p,
          is_liked: newIsLiked,
          likes_count: newIsLiked ? (p.likes_count + 1) : Math.max(0, p.likes_count - 1),
        };
      }
      return p;
    }));
    await feedService.toggleReaction(postId);
  };

  useEffect(() => {
    let isMounted = true;
    if (challengeId) {
      (async () => {
        try {
          const fetched = await challengeService.getChallenge(challengeId);
          if (isMounted && fetched) {
            setChallenge(fetched);
            if (fetched.tips && fetched.tips.length > 0) {
              setTips(fetched.tips);
            }
            if (fetched.is_active !== undefined) {
              setIsActive(fetched.is_active);
            }
          }
        } catch (err) {
          console.error('Failed to load challenge details:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
    return () => { isMounted = false; };
  }, [challengeId]);

  const catDetails = getCategoryDetails(challenge?.category);

  const handleOpenJoin = () => {
    setSelectedDuration(7);
    setCustomDays('7');
    setKickOffDate(new Date().toISOString().split('T')[0]);
    setDurationModalVisible(true);
  };

  const handleJoin = async (actionType = 'start') => {
    if (!challenge) return;
    setDurationModalVisible(false);
    setJoining(true);

    try {
      const res = await challengeService.joinChallenge(
        challenge.id,
        selectedDuration,
        actionType,
        kickOffDate
      );

      if (res.success) {
        setIsActive(true);
        Alert.alert(
          '🎉 Challenge Started!',
          `You have joined "${challenge.title}" for ${selectedDuration} days. Let's make an impact!`
        );
        refreshProfile();
      }
    } catch (err: any) {
      if (err.response && err.response.status === 409 && err.response.data?.requires_choice) {
        Alert.alert(
          'Previous Attempt Found',
          'You have a previous attempt at this challenge. Would you like to resume where you left off or restart fresh?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setJoining(false) },
            { text: 'Resume', onPress: () => handleJoin('resume') },
            { text: 'Restart Fresh', style: 'destructive', onPress: () => handleJoin('restart') },
          ]
        );
        return;
      }
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to join challenge');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading Challenge Details...</Text>
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={AppColors.textLight} />
        <Text style={styles.errorText}>Challenge not found.</Text>
        <TouchableOpacity style={styles.backBtnTextHolder} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Top Header Navigation Bar ── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Challenge Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={[styles.heroIconCircle, { backgroundColor: catDetails.color + '18' }]}>
            <CategoryIcon icon={catDetails.icon} type={catDetails.iconType} size={36} color={catDetails.color} />
          </View>

          <Text style={styles.heroTitle}>{challenge.title}</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: catDetails.color + '15' }]}>
              <Text style={[styles.badgeText, { color: catDetails.color }]}>{catDetails.name}</Text>
            </View>
            <View style={[styles.badge, styles.levelBadge]}>
              <Ionicons name="ribbon-outline" size={12} color="#0284C7" />
              <Text style={styles.levelBadgeText}>Level {challenge.level || 1}</Text>
            </View>
            {challenge.participants_count !== undefined && (
              <View style={[styles.badge, styles.participantsBadge]}>
                <Ionicons name="people-outline" size={12} color={AppColors.textMedium} />
                <Text style={styles.participantsBadgeText}>{challenge.participants_count} Joined</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'info' && styles.tabButtonActive]}
            onPress={() => setActiveTab('info')}
          >
            <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>Info & Tips</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'community' && styles.tabButtonActive]}
            onPress={() => setActiveTab('community')}
          >
            <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>Community Hub</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'info' ? (
          <>
            {/* Section: Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this Challenge</Text>
              <View style={styles.infoCard}>
                <Text style={styles.descriptionText}>
                  {challenge.description || 'Take on this eco challenge to lower your environmental footprint and build sustainable daily habits.'}
                </Text>
              </View>
            </View>

            {/* Section: Environmental Impact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Environmental Impact</Text>
              <Text style={styles.sectionSubTitle}>Estimated savings for every day you complete this challenge:</Text>

              <View style={styles.impactGrid}>
                <View style={[styles.impactCard, { borderColor: '#4CAF5030', backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="leaf" size={24} color="#4CAF50" />
                  <Text style={styles.impactValue}>
                    {challenge.co2_reduction_per_day || challenge.co2ReductionPerDay || 0} kg
                  </Text>
                  <Text style={styles.impactLabel}>CO₂ Saved / day</Text>
                </View>

                <View style={[styles.impactCard, { borderColor: '#2196F330', backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="water" size={24} color="#2196F3" />
                  <Text style={styles.impactValue}>
                    {challenge.water_saving_per_day || challenge.waterSavingPerDay || 0} L
                  </Text>
                  <Text style={styles.impactLabel}>Water Saved / day</Text>
                </View>

                <View style={[styles.impactCard, { borderColor: '#FF980030', backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="flash" size={24} color="#FF9800" />
                  <Text style={styles.impactValue}>
                    {challenge.energy_saving_per_day || challenge.energySavingPerDay || 0.5} kWh
                  </Text>
                  <Text style={styles.impactLabel}>Energy Saved / day</Text>
                </View>
              </View>
            </View>

            {/* Section: Challenge Tips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Challenge Tips & Best Practices</Text>
              {tips && tips.length > 0 ? (
                tips.map((t: any, index: number) => (
                  <View key={t.id || index} style={styles.tipCard}>
                    <View style={styles.tipIconHolder}>
                      <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
                    </View>
                    <View style={styles.tipContent}>
                      <Text style={styles.tipHeader}>Tip #{index + 1}</Text>
                      <Text style={styles.tipBody}>{t.tip || t}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyTipCard}>
                  <Ionicons name="bulb-outline" size={24} color="#F59E0B" />
                  <Text style={styles.emptyTipText}>
                    Consistency is key! Set a daily reminder to log your progress every evening. Small actions repeated daily create massive environmental impact.
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            {/* Section: Community Hub */}
            {/* Share Proof Form */}
            {isActive && (
              <View style={styles.shareContainer}>
                <Text style={styles.shareTitle}>Share Your Challenge Progress</Text>
                <TextInput
                  style={styles.shareInput}
                  placeholder="Tell others how you did today! E.g. 'Just commuted to work by bicycle! Day 3 check-in...'"
                  placeholderTextColor={AppColors.textLight}
                  value={postContent}
                  onChangeText={setPostContent}
                  multiline
                />
                
                {selectedMedia && (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: selectedMedia.uri }} style={styles.previewImage} />
                    {selectedMedia.type === 'video' && (
                      <View style={styles.previewVideoOverlay}>
                        <Ionicons name="play" size={24} color="#FFF" />
                      </View>
                    )}
                    <TouchableOpacity style={styles.removePreviewBtn} onPress={() => setSelectedMedia(null)}>
                      <Ionicons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.attachmentRow}>
                  <TouchableOpacity style={styles.attachmentBtn} onPress={() => pickProofMedia('image')}>
                    <Ionicons name="image-outline" size={16} color={AppColors.primary} />
                    <Text style={styles.attachmentBtnText}>Image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachmentBtn} onPress={() => pickProofMedia('video')}>
                    <Ionicons name="videocam-outline" size={16} color={AppColors.primary} />
                    <Text style={styles.attachmentBtnText}>Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachmentBtn} onPress={captureProofMedia}>
                    <Ionicons name="camera-outline" size={16} color={AppColors.primary} />
                    <Text style={styles.attachmentBtnText}>Camera</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.postButton, posting && { opacity: 0.7 }]} 
                  onPress={handleCreatePost}
                  disabled={posting}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.postButtonText}>Post Progress Proof</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Feeds List */}
            {feedsLoading && feeds.length === 0 ? (
              <ActivityIndicator size="large" color={AppColors.primary} style={{ marginTop: 24 }} />
            ) : feeds.length === 0 ? (
              <View style={styles.noPostsContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color={AppColors.textLight} />
                <Text style={styles.noPostsText}>No posts shared for this challenge yet. Be the first to share your progress!</Text>
              </View>
            ) : (
              feeds.map(post => {
                const authorName = post.user?.full_name || post.author?.full_name || 'Anonymous';
                const authorImage = post.user?.profile_image || post.user?.avatar_url || post.author?.profile_image;
                const isLiked = post.is_liked || post.user_reacted;
                const likes = post.likes_count ?? 0;
                const comments = post.comments_count ?? 0;
                const hasMedia = post.media && post.media.length > 0;

                return (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      {authorImage ? (
                        <Image source={{ uri: resolveMediaUrl(authorImage) }} style={styles.postAvatar} />
                      ) : (
                        <View style={styles.postAvatarPlaceholder}>
                          <Text style={styles.postAvatarText}>
                            {authorName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.postAuthorInfo}>
                        <Text style={styles.postAuthorName}>{authorName}</Text>
                        <Text style={styles.postTime}>
                          {new Date(post.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.postBody}>{post.content}</Text>

                    {hasMedia && post.media.map((media: any) => {
                      const isVideo = media.type === 'video' || media.url.endsWith('.mp4');
                      if (isVideo) {
                        return (
                          <ChallengeVideoPlayer key={media.id} videoUrl={resolveMediaUrl(media.url)} />
                        );
                      }
                      return (
                        <Image
                          key={media.id}
                          source={{ uri: resolveMediaUrl(media.url) }}
                          style={styles.postMedia}
                          resizeMode="cover"
                        />
                      );
                    })}

                    <View style={styles.postActions}>
                      <TouchableOpacity style={styles.postActionBtn} onPress={() => handleLikePost(post.id)}>
                        <Ionicons 
                          name={isLiked ? "heart" : "heart-outline"} 
                          size={18} 
                          color={isLiked ? AppColors.error : AppColors.textMedium} 
                        />
                        <Text style={[styles.postActionText, isLiked && { color: AppColors.error }]}>{likes}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.postActionBtn} 
                        onPress={() => navigation.navigate('Comments', { feedId: post.id })}
                      >
                        <Ionicons name="chatbubble-outline" size={18} color={AppColors.textMedium} />
                        <Text style={styles.postActionText}>{comments}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            
            {hasMoreFeeds && feeds.length >= 10 && (
              <TouchableOpacity 
                style={{ paddingVertical: 12, alignItems: 'center' }} 
                onPress={() => loadFeeds(feedsPage + 1)}
                disabled={feedsLoading}
              >
                {feedsLoading ? (
                  <ActivityIndicator size="small" color={AppColors.primary} />
                ) : (
                  <Text style={{ fontSize: 13, color: AppColors.primary, fontWeight: '700' }}>Load More Posts</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Fixed Bottom Action Bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isActive ? (
          <View style={styles.alreadyActiveBtn}>
            <Ionicons name="checkmark-circle" size={20} color={AppColors.primary} />
            <Text style={styles.alreadyActiveText}>Already Active Challenge</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={handleOpenJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="rocket-outline" size={20} color="#FFFFFF" />
                <Text style={styles.acceptBtnText}>Accept Challenge</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Duration Selector Modal ── */}
      <Modal visible={durationModalVisible} animationType="fade" transparent onRequestClose={() => setDurationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Challenge Duration</Text>
              <TouchableOpacity onPress={() => setDurationModalVisible(false)}>
                <Ionicons name="close" size={22} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>Select how many days you commit to this eco habit:</Text>

            <View style={styles.presetContainer}>
              {[7, 14, 21, 30].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.presetChip, selectedDuration === d && styles.presetChipActive]}
                  onPress={() => {
                    setSelectedDuration(d);
                    setCustomDays(String(d));
                  }}
                >
                  <Text style={[styles.presetText, selectedDuration === d && styles.presetTextActive]}>
                    {d} Days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Or enter custom duration (days):</Text>
            <TextInput
              style={styles.customInput}
              keyboardType="number-pad"
              value={customDays}
              onChangeText={val => {
                setCustomDays(val);
                const num = parseInt(val, 10);
                if (!isNaN(num) && num > 0 && num <= 365) {
                  setSelectedDuration(num);
                }
              }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDurationModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => handleJoin('start')}>
                <Text style={styles.confirmText}>Start Challenge</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: AppColors.textMedium,
  },
  errorText: {
    fontSize: 16,
    color: AppColors.textDark,
    marginTop: 12,
  },
  backBtnTextHolder: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: AppColors.primary,
    borderRadius: 8,
  },
  backBtnText: {
    color: 'white',
    fontWeight: '700',
  },
  header: {
    height: 60,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerBackBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.textDark,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.textDark,
    textAlign: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  levelBadge: {
    backgroundColor: '#E0F2FE',
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  participantsBadge: {
    backgroundColor: '#F3F4F6',
  },
  participantsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 4,
  },
  sectionSubTitle: {
    fontSize: 12,
    color: AppColors.textLight,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: AppColors.textDark,
  },
  impactGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  impactCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  impactValue: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    marginTop: 6,
  },
  impactLabel: {
    fontSize: 10,
    color: AppColors.textMedium,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  tipIconHolder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
    marginBottom: 2,
  },
  tipBody: {
    fontSize: 13,
    color: AppColors.textDark,
    lineHeight: 18,
  },
  emptyTipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  emptyTipText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  acceptBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  alreadyActiveBtn: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#4CAF5040',
  },
  alreadyActiveText: {
    color: AppColors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  modalSub: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginBottom: 16,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: AppColors.primary,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  customInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: AppColors.textDark,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  tabTextActive: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  shareContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 10,
  },
  shareInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: AppColors.textDark,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  attachmentBtnText: {
    fontSize: 11,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  previewContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePreviewBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  postButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  postAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  postAvatarText: {
    color: AppColors.primary,
    fontWeight: 'bold',
    fontSize: 11,
  },
  postAuthorInfo: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  postTime: {
    fontSize: 10,
    color: AppColors.textLight,
    marginTop: 2,
  },
  postBody: {
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.textDark,
    marginBottom: 12,
  },
  postMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  postActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postActionText: {
    fontSize: 12,
    color: AppColors.textMedium,
    fontWeight: '600',
  },
  noPostsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPostsText: {
    marginTop: 10,
    fontSize: 13,
    color: AppColors.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
});
