import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';

interface SavedPost {
  id: string;
  author: string;
  avatar: string;
  content: string;
  date: string;
  likes: number;
}

interface SavedEvent {
  id: string;
  title: string;
  banner: string;
  date: string;
  location: string;
}

const initialSavedPosts: SavedPost[] = [
  {
    id: '101',
    author: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    content: 'Just participated in the city-wide trash cleanup event! Over 200 bags of plastic collected today. Proud of Ekenox team!',
    date: 'June 8, 2026',
    likes: 42,
  },
  {
    id: '102',
    author: 'David Chen',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    content: 'My daily commute carbon tracking report. Saved 12kg of CO2 today by riding with 3 coworkers. Car sharing rocks!',
    date: 'June 5, 2026',
    likes: 19,
  },
];

const initialSavedEvents: SavedEvent[] = [
  {
    id: '201',
    title: 'Recycling Workshop 101',
    banner: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600',
    date: 'June 15, 2026',
    location: 'Green Community Center, NY',
  },
  {
    id: '202',
    title: 'Forest Re-planting Drive',
    banner: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=600',
    date: 'July 2, 2026',
    location: 'Bear Mountain Woods',
  },
];

export default function SavedItemsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'posts' | 'events'>('posts');
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>(initialSavedPosts);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>(initialSavedEvents);

  const handleUnsavePost = (id: string) => {
    Alert.alert('Unsave Item', 'Are you sure you want to remove this post from your saved list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setSavedPosts((prev) => prev.filter((p) => p.id !== id));
        },
      },
    ]);
  };

  const handleUnsaveEvent = (id: string) => {
    Alert.alert('Unsave Event', 'Are you sure you want to remove this event from your saved list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setSavedEvents((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  };

  const renderPostItem = ({ item }: { item: SavedPost }) => {
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Image source={{ uri: item.avatar }} style={styles.authorAvatar} />
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{item.author}</Text>
            <Text style={styles.postDate}>{item.date}</Text>
          </View>
          <TouchableOpacity onPress={() => handleUnsavePost(item.id)} style={styles.unsaveBtn}>
            <Ionicons name="bookmark" size={20} color={AppColors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.postContent} numberOfLines={3}>
          {item.content}
        </Text>

        <View style={styles.postFooter}>
          <View style={styles.stat}>
            <Ionicons name="heart-outline" size={16} color={AppColors.textMedium} />
            <Text style={styles.statText}>{item.likes}</Text>
          </View>
          <TouchableOpacity style={styles.viewDetailsBtn}>
            <Text style={styles.viewDetailsText}>View Post</Text>
            <Ionicons name="arrow-forward" size={12} color={AppColors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEventItem = ({ item }: { item: SavedEvent }) => {
    return (
      <TouchableOpacity
        style={styles.eventCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      >
        <Image source={{ uri: item.banner }} style={styles.eventBanner} />
        <TouchableOpacity onPress={() => handleUnsaveEvent(item.id)} style={styles.floatingUnsaveBtn}>
          <Ionicons name="bookmark" size={18} color="white" />
        </TouchableOpacity>

        <View style={styles.eventDetails}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.eventMetaRow}>
            <Ionicons name="calendar-outline" size={14} color={AppColors.textMedium} />
            <Text style={styles.eventMetaText}>{item.date}</Text>
          </View>
          <View style={styles.eventMetaRow}>
            <Ionicons name="location-outline" size={14} color={AppColors.textMedium} />
            <Text style={styles.eventMetaText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const currentList = activeTab === 'posts' ? savedPosts : savedEvents;
  const isEmpty = currentList.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Items</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Ionicons
            name="document-text"
            size={18}
            color={activeTab === 'posts' ? AppColors.primary : AppColors.textMedium}
          />
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>Posts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'events' && styles.tabBtnActive]}
          onPress={() => setActiveTab('events')}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={activeTab === 'events' ? AppColors.primary : AppColors.textMedium}
          />
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>Events</Text>
        </TouchableOpacity>
      </View>

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={48} color={AppColors.textLight} />
          <Text style={styles.emptyText}>No saved {activeTab} found.</Text>
        </View>
      ) : (
        <FlatList
          data={currentList as any[]}
          renderItem={activeTab === 'posts' ? (renderPostItem as any) : (renderEventItem as any)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: {
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 6,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#E6F4EA',
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: AppColors.textMedium,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorDetails: {
    marginLeft: 10,
    flex: 1,
  },
  authorName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  postDate: {
    fontSize: 11,
    color: AppColors.textLight,
    marginTop: 1,
  },
  unsaveBtn: {
    padding: 4,
  },
  postContent: {
    fontSize: 13,
    color: AppColors.textDark,
    lineHeight: 18,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 12,
    paddingTop: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: AppColors.textMedium,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  eventBanner: {
    width: '100%',
    height: 120,
  },
  floatingUnsaveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventDetails: {
    padding: 12,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  eventMetaText: {
    fontSize: 11,
    color: AppColors.textMedium,
  },
});
