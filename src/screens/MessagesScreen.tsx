import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { AppColors } from '../theme/colors';
import chatService from '../services/chatService';
import { UrlHelper } from '../utils/urlHelper';

export const MessagesScreen = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [conversations, setConversations] = useState<any[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await chatService.getConversations();
      const list = data.conversations ?? [];
      setConversations(list);
      filterList(searchQuery, list);
    } catch (e) {
      console.error('Failed to load conversations in screen:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isFocused) {
      loadConversations();
    }
  }, [isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations(true);
  };

  const filterList = (query: string, rawList = conversations) => {
    if (!query.trim()) {
      setFilteredConversations(rawList);
      return;
    }
    const filtered = rawList.filter(c => {
      const displayName = c.displayName || c.name || '';
      return displayName.toLowerCase().includes(query.toLowerCase());
    });
    setFilteredConversations(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterList(text);
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const resolveAvatar = (item: any) => {
    if (item.profileImage) {
      return UrlHelper.convertPathToUrl(item.profileImage);
    }
    return null;
  };

  const renderConversationItem = ({ item }: { item: any }) => {
    const hasUnread = item.unreadCount > 0;
    const isOnline = item.contact?.isOnline || item.isOnline;
    const avatarUrl = resolveAvatar(item);

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('ChatRoom', {
            chatRoomId: item.id,
            name: item.displayName || item.name,
            logo: item.profileImage,
          });
        }}
      >
        {/* Avatar Area */}
        <View>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.fallbackAvatar]}>
              <Ionicons
                name={item.isGroup ? 'people-sharp' : 'person-sharp'}
                size={22}
                color={AppColors.primary}
              />
            </View>
          )}
          {isOnline && !item.isGroup && (
            <View style={styles.onlineBadge} />
          )}
        </View>

        {/* Message Preview Area */}
        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <Text style={[styles.displayName, hasUnread && styles.unreadName]} numberOfLines={1}>
              {item.displayName || item.name || 'Secure Chat'}
            </Text>
            <Text style={styles.timeText}>{formatTimestamp(item.lastMessageTime || item.createdAt)}</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.lastMsgText, hasUnread && styles.unreadMsgText]} numberOfLines={1}>
              {item.lastMessage ? item.lastMessage.content : 'No messages yet.'}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* AppBar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Field */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={AppColors.textLight} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search conversations..."
            placeholderTextColor={AppColors.textLight}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubble-ellipses-outline" size={60} color={AppColors.textLight} />
          <Text style={styles.emptyTitle}>No chats found</Text>
          <Text style={styles.emptySub}>Start a conversation inside an eco association group!</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderConversationItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBackBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: AppColors.textDark },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: AppColors.textDark, paddingVertical: 0 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: AppColors.textMedium, fontSize: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: AppColors.textDark, marginTop: 16 },
  emptySub: { fontSize: 13, color: AppColors.textMedium, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  chatRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3F4F6' },
  fallbackAvatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: AppColors.primary + '20' },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  rowContent: { flex: 1, marginLeft: 14 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  displayName: { fontSize: 15, fontWeight: '700', color: AppColors.textDark, flex: 1, marginRight: 8 },
  unreadName: { color: '#000000', fontWeight: '800' },
  timeText: { fontSize: 11, color: AppColors.textLight },
  rowBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsgText: { fontSize: 13, color: AppColors.textMedium, flex: 1, marginRight: 12 },
  unreadMsgText: { color: AppColors.textDark, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: AppColors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
});
