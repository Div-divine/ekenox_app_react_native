import React, { useState } from 'react';
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
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';

interface Post {
  id: string;
  authorName: string;
  authorAvatar: string;
  timeAgo: string;
  content: string;
  likes: number;
  comments: number;
  hasLiked: boolean;
  image?: string;
  tags?: string[];
}

interface Group {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  isJoined: boolean;
  privacy: 'Public' | 'Private';
  category: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  participants: number;
  image: string;
}

const INITIAL_POSTS: Post[] = [
  {
    id: 'post_1',
    authorName: 'Sarah Jenkins',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    timeAgo: '2 hrs ago',
    content: 'Just organized a beach cleanup drive! Collected over 40kg of plastic debris. Thanks to everyone who joined! 🌱🌊 #CleanOceans #EcoAction',
    likes: 24,
    comments: 6,
    hasLiked: false,
    image: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=600',
    tags: ['BeachCleanup', 'SaveThePlanet'],
  },
  {
    id: 'post_2',
    authorName: 'David Kojo',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    timeAgo: '5 hrs ago',
    content: 'Switched all lights in my house to solar-powered LEDs. Excited to see our household carbon footprint shrinking! ☀️🏠',
    likes: 18,
    comments: 3,
    hasLiked: true,
    tags: ['SolarEnergy', 'GreenLiving'],
  },
  {
    id: 'post_3',
    authorName: 'Elena Rostova',
    authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    timeAgo: '1 day ago',
    content: 'Started composting kitchen waste this week. Highly recommend! Here is a simple guide on what you can and cannot compost. 🍎🍂',
    likes: 42,
    comments: 12,
    hasLiked: false,
    tags: ['ZeroWaste', 'Compost'],
  },
];

const INITIAL_GROUPS: Group[] = [
  {
    id: 'group_1',
    name: 'Zero Waste Challengers',
    description: 'A community sharing daily tips, recipes, and hacks for a waste-free lifestyle.',
    membersCount: 1420,
    isJoined: true,
    privacy: 'Public',
    category: 'Lifestyle',
  },
  {
    id: 'group_2',
    name: 'Ocean Protectors',
    description: 'Focused on coastal cleanups, marine life conservation, and reducing plastics.',
    membersCount: 890,
    isJoined: false,
    privacy: 'Public',
    category: 'Conservation',
  },
  {
    id: 'group_3',
    name: 'Urban Gardeners',
    description: 'Grow your own food in small city balconies, rooftops, and backyards.',
    membersCount: 2310,
    isJoined: false,
    privacy: 'Private',
    category: 'Gardening',
  },
];

const EVENTS: Event[] = [
  {
    id: 'event_1',
    title: 'Community Tree Planting',
    date: 'June 5, 09:00 AM',
    location: 'Greenwood Park, Sector 4',
    participants: 45,
    image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=300',
  },
  {
    id: 'event_2',
    title: 'Upcycling DIY Workshop',
    date: 'June 12, 02:00 PM',
    location: 'Youth Center Auditorium',
    participants: 28,
    image: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=300',
  },
];

export const FeedScreen = () => {
  const { user, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState(0); // 0 = Feed, 1 = Groups
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [showTip, setShowTip] = useState(true);
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  const handleLogout = async () => {
    setShowProfilePanel(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleLikePost = (postId: string) => {
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            hasLiked: !post.hasLiked,
            likes: post.hasLiked ? post.likes - 1 : post.likes + 1,
          };
        }
        return post;
      })
    );
  };

  const handleToggleGroupJoin = (groupId: string) => {
    setGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === groupId) {
          const newJoined = !group.isJoined;
          if (group.privacy === 'Private' && newJoined) {
            Alert.alert('Request Sent', `Join request sent to private group "${group.name}".`);
            return { ...group, isJoined: false };
          }
          return {
            ...group,
            isJoined: newJoined,
            membersCount: newJoined ? group.membersCount + 1 : group.membersCount - 1,
          };
        }
        return group;
      })
    );
  };

  const handleCreateCTA = () => {
    Alert.alert('Create New Post', 'This feature is ready to be hooked to your camera roll and keyboard in the next phase! 📸✍️');
  };

  const renderStoryItem = ({ item }: { item: { name: string; avatar: string; isUser?: boolean } }) => (
    <View style={styles.storyItem}>
      <View style={[styles.storyBorder, item.isUser ? styles.storyUserBorder : null]}>
        <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
        {item.isUser && (
          <View style={styles.storyAddBadge}>
            <Ionicons name="add" size={12} color="white" />
          </View>
        )}
      </View>
      <Text style={styles.storyName} numberOfLines={1}>
        {item.name}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Navbar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerAvatarContainer} onPress={() => setShowProfilePanel(true)}>
          {user?.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.headerTitle}>eKeNox</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => Alert.alert('Messages', 'Chat & messaging inbox coming soon.')}>
            <Ionicons name="chatbubbles-outline" size={22} color={AppColors.textDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => Alert.alert('Notifications', 'Notification center coming soon.')}>
            <Ionicons name="notifications-outline" size={22} color={AppColors.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, currentTab === 0 ? styles.tabBtnActive : null]}
          onPress={() => setCurrentTab(0)}
        >
          <Text style={[styles.tabText, currentTab === 0 ? styles.tabTextActive : null]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, currentTab === 1 ? styles.tabBtnActive : null]}
          onPress={() => setCurrentTab(1)}
        >
          <Text style={[styles.tabText, currentTab === 1 ? styles.tabTextActive : null]}>Groups</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {currentTab === 0 ? (
        // Feed Scroll
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* Stories Section */}
          <View style={styles.storiesContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[
                { name: 'My Story', avatar: user?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', isUser: true },
                { name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
                { name: 'Nature Club', avatar: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=150' },
                { name: 'David', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
                { name: 'Eco Team', avatar: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=150' },
                { name: 'Elena', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' },
              ]}
              renderItem={renderStoryItem}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>

          {/* Daily Tip (Dismissible) */}
          {showTip && (
            <View style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <View style={styles.tipTitleRow}>
                  <Ionicons name="bulb" size={20} color={AppColors.accent} />
                  <Text style={styles.tipTitle}>Daily Green Tip</Text>
                </View>
                <TouchableOpacity onPress={() => setShowTip(false)}>
                  <Ionicons name="close" size={20} color={AppColors.textMedium} />
                </TouchableOpacity>
              </View>
              <Text style={styles.tipText}>
                Use a reusable water bottle today to reduce single-use plastic waste! Every small habit contributes to saving our ocean ecosystems. 🌱🌊
              </Text>
            </View>
          )}

          {/* Featured Events */}
          <View style={styles.eventsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Events</Text>
              <TouchableOpacity onPress={() => Alert.alert('Events', 'List of all nearby eco-events coming soon!')}>
                <Text style={styles.sectionAction}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsScroll}>
              {EVENTS.map(event => (
                <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => Alert.alert(event.title, `Event details at ${event.location}.`)}>
                  <Image source={{ uri: event.image }} style={styles.eventImage} />
                  <View style={styles.eventContent}>
                    <Text style={styles.eventCardTitle} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.eventInfoRow}>
                      <Ionicons name="calendar-outline" size={13} color={AppColors.textMedium} />
                      <Text style={styles.eventInfoText}>{event.date}</Text>
                    </View>
                    <View style={styles.eventInfoRow}>
                      <Ionicons name="location-outline" size={13} color={AppColors.textMedium} />
                      <Text style={styles.eventInfoText} numberOfLines={1}>{event.location}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Feed List Title */}
          <View style={styles.feedHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
          </View>

          {/* Posts List */}
          <View style={styles.postsList}>
            {posts.map(post => (
              <View key={post.id} style={styles.postCard}>
                {/* Author Info */}
                <View style={styles.postAuthorRow}>
                  <Image source={{ uri: post.authorAvatar }} style={styles.postAvatar} />
                  <View style={styles.postAuthorDetails}>
                    <Text style={styles.postAuthorName}>{post.authorName}</Text>
                    <Text style={styles.postTime}>{post.timeAgo}</Text>
                  </View>
                  <TouchableOpacity style={styles.postOptionBtn}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={AppColors.textMedium} />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <Text style={styles.postContent}>{post.content}</Text>

                {post.image && (
                  <Image source={{ uri: post.image }} style={styles.postImage} />
                )}

                {/* Footer Buttons */}
                <View style={styles.postFooter}>
                  <TouchableOpacity style={styles.postFooterBtn} onPress={() => handleLikePost(post.id)}>
                    <Ionicons
                      name={post.hasLiked ? 'heart' : 'heart-outline'}
                      size={20}
                      color={post.hasLiked ? AppColors.error : AppColors.textMedium}
                    />
                    <Text style={[styles.postFooterText, post.hasLiked ? styles.likedText : null]}>
                      {post.likes}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.postFooterBtn} onPress={() => Alert.alert('Comments', 'Comments section coming soon.')}>
                    <Ionicons name="chatbubble-outline" size={19} color={AppColors.textMedium} />
                    <Text style={styles.postFooterText}>{post.comments}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.postFooterBtn} onPress={() => Alert.alert('Share', 'Shared to system clipboard.')}>
                    <Ionicons name="share-social-outline" size={19} color={AppColors.textMedium} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        // Groups Tab List
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.groupsHeaderRow}>
            <Text style={styles.sectionTitle}>Explore Eco Groups</Text>
            <Text style={styles.groupsSubtitle}>Connect with local champions working in your field.</Text>
          </View>

          <View style={styles.groupsList}>
            {groups.map(group => (
              <View key={group.id} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupIconContainer}>
                    <Ionicons
                      name={
                        group.category === 'Lifestyle'
                          ? 'leaf'
                          : group.category === 'Conservation'
                            ? 'water'
                            : 'home'
                      }
                      size={24}
                      color={AppColors.primary}
                    />
                  </View>
                  <View style={styles.groupDetails}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupMeta}>
                      {group.category} • {group.privacy} • {group.membersCount} members
                    </Text>
                  </View>
                </View>

                <Text style={styles.groupDesc}>{group.description}</Text>

                <TouchableOpacity
                  style={[
                    styles.groupActionBtn,
                    group.isJoined ? styles.groupActionBtnJoined : null,
                  ]}
                  onPress={() => handleToggleGroupJoin(group.id)}
                >
                  <Text
                    style={[
                      styles.groupActionText,
                      group.isJoined ? styles.groupActionTextJoined : null,
                    ]}
                  >
                    {group.isJoined ? 'Joined' : 'Join Group'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCreateCTA}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* Sidebar / Profile Panel Overlay */}
      {showProfilePanel && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayCloseArea} onPress={() => setShowProfilePanel(false)} />
          <View style={styles.profilePanel}>
            <View style={styles.profilePanelHeader}>
              <Text style={styles.profilePanelTitle}>My Profile</Text>
              <TouchableOpacity onPress={() => setShowProfilePanel(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePanelCard}>
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.panelAvatar} />
              ) : (
                <View style={styles.panelAvatarPlaceholder}>
                  <Text style={styles.panelAvatarText}>
                    {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'EC'}
                  </Text>
                </View>
              )}
              <Text style={styles.panelName}>{user?.fullName || 'Eco Champion'}</Text>
              <Text style={styles.panelEmail}>{user?.email}</Text>

              {/* Stats Grid */}
              <View style={styles.panelStatsContainer}>
                <View style={styles.panelStatBox}>
                  <Text style={styles.panelStatVal}>{user?.level ?? 1}</Text>
                  <Text style={styles.panelStatLabel}>Level</Text>
                </View>
                <View style={styles.panelStatBox}>
                  <Text style={styles.panelStatVal}>{user?.points ?? 0}</Text>
                  <Text style={styles.panelStatLabel}>Points</Text>
                </View>
                <View style={styles.panelStatBox}>
                  <Text style={styles.panelStatVal}>{user?.xp ?? 0}</Text>
                  <Text style={styles.panelStatLabel}>XP</Text>
                </View>
              </View>
            </View>

            <View style={styles.panelMenuItems}>
              <TouchableOpacity style={styles.panelMenuItem} onPress={() => Alert.alert('My Impact', 'Carbon offset metrics & badges.')}>
                <Ionicons name="ribbon-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>My Impact Badges</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.panelMenuItem} onPress={() => Alert.alert('My Actions', 'Log of eco action initiatives.')}>
                <Ionicons name="checkmark-done-circle-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>Logged Eco Actions</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.panelMenuItem} onPress={() => Alert.alert('Settings', 'App configurations & keys.')}>
                <Ionicons name="settings-outline" size={20} color={AppColors.primary} />
                <Text style={styles.panelMenuText}>Settings & Privacy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.panelLogoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={AppColors.error} />
              <Text style={styles.panelLogoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    height: 60,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerAvatarContainer: {
    padding: 2,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: AppColors.primary,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionBtn: {
    marginLeft: 14,
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: AppColors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  tabTextActive: {
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  storiesContainer: {
    backgroundColor: 'white',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 18,
    width: 65,
  },
  storyBorder: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: AppColors.primaryLight,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 6,
  },
  storyUserBorder: {
    borderColor: '#D1D5DB',
  },
  storyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  storyAddBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: AppColors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  storyName: {
    fontSize: 11,
    color: AppColors.textDark,
    textAlign: 'center',
  },
  tipCard: {
    backgroundColor: '#EEFDFC',
    borderRadius: 14,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#CCFAF6',
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0D9488',
    marginLeft: 6,
  },
  tipText: {
    fontSize: 13,
    color: '#0F766E',
    lineHeight: 18,
  },
  eventsSection: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  sectionAction: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
  },
  eventsScroll: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  eventCard: {
    width: 200,
    backgroundColor: 'white',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  eventImage: {
    width: '100%',
    height: 100,
  },
  eventContent: {
    padding: 10,
  },
  eventCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  eventInfoText: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginLeft: 4,
  },
  feedHeaderRow: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  postsList: {
    paddingHorizontal: 16,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAuthorDetails: {
    marginLeft: 10,
    flex: 1,
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  postTime: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 1,
  },
  postOptionBtn: {
    padding: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: AppColors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  groupsHeaderRow: {
    padding: 16,
  },
  groupsSubtitle: {
    fontSize: 13,
    color: AppColors.textMedium,
    marginTop: 4,
  },
  groupsList: {
    paddingHorizontal: 16,
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupDetails: {
    marginLeft: 12,
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  groupMeta: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  groupDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 14,
  },
  groupActionBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  groupActionBtnJoined: {
    backgroundColor: '#F3F4F6',
  },
  groupActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  groupActionTextJoined: {
    color: AppColors.textDark,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: 'row',
    zIndex: 999,
  },
  overlayCloseArea: {
    flex: 1,
  },
  profilePanel: {
    width: '78%',
    backgroundColor: 'white',
    height: '100%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  profilePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: Platform.OS === 'ios' ? 40 : 10,
  },
  profilePanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  profilePanelCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  panelAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  panelAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  panelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  panelEmail: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 2,
    marginBottom: 16,
  },
  panelStatsContainer: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
    paddingTop: 12,
  },
  panelStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  panelStatVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  panelStatLabel: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 2,
  },
  panelMenuItems: {
    flex: 1,
  },
  panelMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  panelMenuText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.textDark,
    marginLeft: 12,
  },
  panelLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  panelLogoutText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: AppColors.error,
    marginLeft: 12,
  },
});
