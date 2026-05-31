import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Association {
  id: string;
  name: string;
  category: string;
  description: string;
  followers: number;
  logo: string;
  verified: boolean;
  website: string;
}

const MOCK_ASSOCIATIONS: Association[] = [
  {
    id: '1',
    name: 'Green Earth Alliance',
    category: 'Conservation',
    description: 'Promoting global reforestation, tree planting initiatives, and active forest preservation campaigns.',
    followers: 1240,
    logo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    verified: true,
    website: 'https://greenearth.org',
  },
  {
    id: '2',
    name: 'EcoCycle Cleaners',
    category: 'Recycling',
    description: 'Community-led waste management programs and urban circular economy solutions for modern cities.',
    followers: 890,
    logo: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    verified: true,
    website: 'https://ecocycle.org',
  },
  {
    id: '3',
    name: 'Solar Futures',
    category: 'Clean Energy',
    description: 'Bringing localized solar grid installations and renewable energy education to underprivileged communities.',
    followers: 1850,
    logo: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    verified: true,
    website: 'https://solarfutures.net',
  },
  {
    id: '4',
    name: 'Marine Shield Foundation',
    category: 'Ocean Rescue',
    description: 'Combating ocean plastic waste through coastal cleanups and marine ecosystem restoration programs.',
    followers: 2430,
    logo: 'https://images.unsplash.com/photo-1484821541296-5a1d016b339f?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    verified: false,
    website: 'https://marineshield.org',
  },
  {
    id: '5',
    name: 'Climate Action Network',
    category: 'Advocacy',
    description: 'Grassroots lobbying for eco-conscious legislative reforms and local carbon footprint reduction awareness.',
    followers: 3100,
    logo: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    verified: true,
    website: 'https://climateaction.net',
  },
];

const CATEGORIES = ['All', 'Conservation', 'Recycling', 'Clean Energy', 'Ocean Rescue', 'Advocacy'];

export const AssociationScreen = () => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [followedIds, setFollowedIds] = useState<string[]>(['1', '3']);

  const toggleFollow = (id: string) => {
    if (followedIds.includes(id)) {
      setFollowedIds(followedIds.filter(item => item !== id));
      Alert.alert('Unfollowed', 'You have unfollowed this association.');
    } else {
      setFollowedIds([...followedIds, id]);
      Alert.alert('Followed!', 'You are now following this association. You will receive their updates on your feed.');
    }
  };

  const filteredAssociations = MOCK_ASSOCIATIONS.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderAssociationCard = ({ item }: { item: Association }) => {
    const isFollowing = followedIds.includes(item.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: item.logo }} style={styles.logo} />
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.name}</Text>
              {item.verified && (
                <Ionicons name="checkmark-circle" size={16} color={AppColors.primary} style={styles.verifiedIcon} />
              )}
            </View>
            <View style={styles.metaRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
              <Text style={styles.followers}>
                <Ionicons name="people" size={12} color={AppColors.textMedium} /> {item.followers + (isFollowing ? 1 : 0)} followers
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.description}>{item.description}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.detailsBtn]}
            onPress={() => Alert.alert(item.name, `Website: ${item.website}\n\n${item.description}`)}
          >
            <Ionicons name="information-circle-outline" size={18} color={AppColors.primary} />
            <Text style={styles.detailsBtnText}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.chatBtn]}
            onPress={() => Alert.alert('Chat Room', `Opening official secure chat room for ${item.name}...`)}
          >
            <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" />
            <Text style={styles.chatBtnText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              isFollowing ? styles.followingBtn : styles.followBtn,
            ]}
            onPress={() => toggleFollow(item.id)}
          >
            <Ionicons
              name={isFollowing ? "checkmark-outline" : "add-outline"}
              size={18}
              color={isFollowing ? AppColors.primary : "#FFFFFF"}
            />
            <Text style={isFollowing ? styles.followingBtnText : styles.followBtnText}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header Navbar */}
      <View style={[styles.header, { paddingTop: insets.top, height: 60 + insets.top }]}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Eco Associations</Text>
        <TouchableOpacity
          style={styles.headerInfoIcon}
          onPress={() => Alert.alert('Eco Associations', 'Discover registered ecological organizations and green networks in Ekenox. Join their official community boards to follow events and activities.')}
        >
          <Ionicons name="help-circle-outline" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
      </View>

      {/* Search and Category Filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={AppColors.textMedium} style={styles.searchIcon} />
          <TextInput
            placeholder="Search organizations..."
            placeholderTextColor={AppColors.textMedium}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
              <Ionicons name="close-circle" size={18} color={AppColors.textMedium} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map(category => {
            const isActive = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.catBtn, isActive ? styles.catBtnActive : null]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.catBtnText, isActive ? styles.catBtnTextActive : null]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List */}
      <FlatList
        data={filteredAssociations}
        renderItem={renderAssociationCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={AppColors.textMedium} />
            <Text style={styles.emptyText}>No organizations found matching search criteria.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerSpacer: {
    width: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.primary,
  },
  headerInfoIcon: {
    padding: 4,
  },
  filterSection: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: AppColors.textDark,
    height: '100%',
  },
  clearIcon: {
    padding: 4,
  },
  categoriesScroll: {
    marginTop: 10,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  catBtnActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  catBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  catBtnTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
    marginRight: 4,
  },
  verifiedIcon: {
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: AppColors.primaryLight + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    color: AppColors.primary,
    fontWeight: '700',
  },
  followers: {
    fontSize: 12,
    color: AppColors.textMedium,
  },
  description: {
    fontSize: 14,
    color: AppColors.textMedium,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 8,
    gap: 4,
  },
  detailsBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },
  chatBtn: {
    backgroundColor: AppColors.primaryLight,
  },
  chatBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followBtn: {
    backgroundColor: AppColors.primary,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: AppColors.divider,
  },
  followingBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.textMedium,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 250,
  },
});
