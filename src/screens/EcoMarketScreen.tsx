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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  title: string;
  price: string;
  seller: string;
  image: string;
  badge: string;
  description: string;
}

interface RepairItem {
  id: string;
  title: string;
  type: 'offer' | 'request';
  author: string;
  location: string;
  description: string;
  date: string;
  category: string;
}

interface Workshop {
  id: string;
  title: string;
  host: string;
  date: string;
  time: string;
  price: string;
  image: string;
  spotsLeft: number;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    title: 'Reusable Bamboo Flask',
    price: '$24.99',
    seller: 'Green Earth Alliance',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    badge: 'Zero Waste',
    description: 'Double-walled thermal insulation flask made of 100% natural, sustainable bamboo and stainless steel.',
  },
  {
    id: 'p2',
    title: 'Organic Solid Shampoo Bar',
    price: '$12.50',
    seller: 'EcoCycle Cleaners',
    image: 'https://images.unsplash.com/photo-1607006342411-9a3363e6394e?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    badge: '100% Organic',
    description: 'All-natural vegan shampoo bar, completely plastic-free packaging, designed to last up to 80 washes.',
  },
  {
    id: 'p3',
    title: 'Upcycled Denim Tote Bag',
    price: '$18.00',
    seller: 'Marine Shield Foundation',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    badge: 'Upcycled',
    description: 'Fashionable, highly durable tote bag stitched entirely from recycled denim jeans and organic cotton threads.',
  },
  {
    id: 'p4',
    title: 'Eco Beeswax Food Wraps (Pack of 3)',
    price: '$15.99',
    seller: 'Solar Futures',
    image: 'https://images.unsplash.com/photo-1610555356070-d0efb6505f81?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    badge: 'Plastic Free',
    description: 'Washable, reusable, and biodegradable food wraps made of organic cotton, beeswax, and jojoba oils.',
  },
];

const MOCK_REPAIR_ITEMS: RepairItem[] = [
  {
    id: 'r1',
    title: 'Household Appliance Repairs',
    type: 'offer',
    author: 'Eco Repair Collective',
    location: 'Downtown Hub',
    description: 'We offer free diagnostics and simple fixes for old electronics, blenders, fans, and mixers to avoid e-waste.',
    date: 'Active daily',
    category: 'Electronics',
  },
  {
    id: 'r2',
    title: 'Broken Toaster Heating Element',
    type: 'request',
    author: 'Sarah Jenkins',
    location: 'North Suburbs',
    description: 'Looking for a volunteer electrician or repair expert to help fix my dual-slot metal toaster that suddenly stopped heating.',
    date: 'Posted 2h ago',
    category: 'Home Appliances',
  },
  {
    id: 'r3',
    title: 'Textile Upcycling & Sewing',
    type: 'offer',
    author: 'Threads of Hope',
    location: 'Community Center',
    description: 'Bring your torn clothing, jeans, or bags. We will stitch, repair, or redesign them into stylish upcycled items!',
    date: 'Saturdays 10:00 - 14:00',
    category: 'Textiles & Clothes',
  },
  {
    id: 'r4',
    title: 'Wooden Chair Leg Refitting',
    type: 'request',
    author: 'Marc Dubois',
    location: 'East Side',
    description: 'I have two beautiful dining room chairs made of oak, but the legs are unstable. Need a woodworker or hobbyist to help reinforce them.',
    date: 'Posted 1d ago',
    category: 'Furniture',
  },
];

const MOCK_WORKSHOPS: Workshop[] = [
  {
    id: 'w1',
    title: 'Composting & Soil Science 101',
    host: 'Green Earth Alliance',
    date: 'June 6, 2026',
    time: '14:00 - 16:30',
    price: 'Free',
    image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    spotsLeft: 8,
  },
  {
    id: 'w2',
    title: 'DIY Solar Phone Charger Building',
    host: 'Solar Futures',
    date: 'June 13, 2026',
    time: '10:00 - 13:00',
    price: '$20.00',
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    spotsLeft: 3,
  },
  {
    id: 'w3',
    title: 'Sustainable Living & Zero Waste',
    host: 'Climate Action Network',
    date: 'June 20, 2026',
    time: '18:00 - 19:30',
    price: 'Free',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    spotsLeft: 24,
  },
];

export const EcoMarketScreen = () => {
  const insets = useSafeAreaInsets();
  const [activeMainTab, setActiveMainTab] = useState<'products' | 'repair' | 'workshops'>('products');
  const [repairFilter, setRepairFilter] = useState<'all' | 'offer' | 'request'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle post repair request or offer
  const handlePostRepair = () => {
    Alert.alert(
      'New Repair Listing',
      'Create a listing to offer or request repair assistance.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Offer Repair Service', onPress: () => Alert.alert('Success', 'Listing setup initiated.') },
        { text: 'Request Repair Help', onPress: () => Alert.alert('Success', 'Request setup initiated.') },
      ]
    );
  };

  const handleRegisterWorkshop = (workshop: Workshop) => {
    Alert.alert(
      'Register Workshop',
      `Would you like to register for "${workshop.title}" on ${workshop.date}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Register',
          onPress: () => Alert.alert('Registered Successfully!', `We have reserved your spot for "${workshop.title}". Check your profile events page for details.`),
        },
      ]
    );
  };

  const handleBuyProduct = (product: Product) => {
    Alert.alert(
      'Order Product',
      `Would you like to order "${product.title}" for ${product.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Order',
          onPress: () => Alert.alert('Order Success!', `Your purchase of ${product.title} has been recorded! Secure checkout handled via Ekenox Eco Shop.`),
        },
      ]
    );
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <Image source={{ uri: item.image }} style={styles.productImg} />
      <View style={styles.productBadge}>
        <Text style={styles.productBadgeText}>{item.badge}</Text>
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productSeller}>{item.seller}</Text>
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.productPrice}>{item.price}</Text>
        <TouchableOpacity style={styles.buyBtn} onPress={() => handleBuyProduct(item)}>
          <Ionicons name="cart" size={14} color="#FFFFFF" />
          <Text style={styles.buyBtnText}>Purchase</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRepairItem = ({ item }: { item: RepairItem }) => {
    const isOffer = item.type === 'offer';
    return (
      <View style={styles.repairCard}>
        <View style={styles.repairCardHeader}>
          <View style={[styles.repairBadge, isOffer ? styles.badgeOffer : styles.badgeRequest]}>
            <Text style={[styles.repairBadgeText, isOffer ? styles.textOffer : styles.textRequest]}>
              {isOffer ? 'Repair Offer' : 'Help Requested'}
            </Text>
          </View>
          <Text style={styles.repairCategory}>{item.category}</Text>
        </View>

        <Text style={styles.repairTitle}>{item.title}</Text>
        <Text style={styles.repairDesc}>{item.description}</Text>

        <View style={styles.repairFooter}>
          <View style={styles.repairAuthorRow}>
            <Ionicons name="person-circle-outline" size={16} color={AppColors.textMedium} />
            <Text style={styles.repairAuthorText} numberOfLines={1}>{item.author}</Text>
          </View>
          <View style={styles.repairMetaRow}>
            <Text style={styles.repairMetaItem}>
              <Ionicons name="location-outline" size={12} color={AppColors.textMedium} /> {item.location}
            </Text>
            <Text style={styles.repairMetaItem}>
              <Ionicons name="time-outline" size={12} color={AppColors.textMedium} /> {item.date}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.repairContactBtn}
          onPress={() => Alert.alert('Contact', `Contacting ${item.author} for "${item.title}"...`)}
        >
          <Ionicons name="chatbubbles" size={16} color={AppColors.primary} />
          <Text style={styles.repairContactText}>Connect & Chat</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderWorkshopItem = ({ item }: { item: Workshop }) => (
    <View style={styles.workshopCard}>
      <Image source={{ uri: item.image }} style={styles.workshopImg} />
      <View style={styles.workshopBody}>
        <Text style={styles.workshopHost}>{item.host}</Text>
        <Text style={styles.workshopTitle}>{item.title}</Text>

        <View style={styles.workshopDetailRow}>
          <View style={styles.workshopDetailItem}>
            <Ionicons name="calendar-outline" size={14} color={AppColors.textMedium} />
            <Text style={styles.workshopDetailText}>{item.date}</Text>
          </View>
          <View style={styles.workshopDetailItem}>
            <Ionicons name="time-outline" size={14} color={AppColors.textMedium} />
            <Text style={styles.workshopDetailText}>{item.time}</Text>
          </View>
        </View>

        <View style={styles.workshopFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceVal}>{item.price}</Text>
          </View>
          <View style={styles.spotsContainer}>
            <Text style={styles.spotsText}>{item.spotsLeft} seats left</Text>
            <TouchableOpacity style={styles.registerBtn} onPress={() => handleRegisterWorkshop(item)}>
              <Text style={styles.registerBtnText}>Book Seat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  // Filters depending on active main tab
  const getFilteredData = () => {
    if (activeMainTab === 'products') {
      return MOCK_PRODUCTS.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else if (activeMainTab === 'repair') {
      return MOCK_REPAIR_ITEMS.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = repairFilter === 'all' || item.type === repairFilter;
        return matchesSearch && matchesType;
      });
    } else {
      return MOCK_WORKSHOPS.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.host.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Navbar */}
      <View style={[styles.header, { paddingTop: insets.top, height: 60 + insets.top }]}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Eco Market</Text>
        <TouchableOpacity
          style={styles.headerInfoIcon}
          onPress={() => Alert.alert('Eco Market & Services', 'A green marketplace supporting sustainable organizations and community repair networks. Purchase eco-friendly products, get assistance in the Repair Hub, or sign up for interactive green workshops.')}
        >
          <Ionicons name="help-circle-outline" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
      </View>

      {/* Main Tab Controls */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeMainTab === 'products' ? styles.tabBtnActive : null]}
          onPress={() => {
            setActiveMainTab('products');
            setSearchQuery('');
          }}
        >
          <Ionicons name="leaf" size={16} color={activeMainTab === 'products' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.tabText, activeMainTab === 'products' ? styles.tabTextActive : null]}>Products</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeMainTab === 'repair' ? styles.tabBtnActive : null]}
          onPress={() => {
            setActiveMainTab('repair');
            setSearchQuery('');
          }}
        >
          <Ionicons name="build" size={16} color={activeMainTab === 'repair' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.tabText, activeMainTab === 'repair' ? styles.tabTextActive : null]}>Repair Hub</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeMainTab === 'workshops' ? styles.tabBtnActive : null]}
          onPress={() => {
            setActiveMainTab('workshops');
            setSearchQuery('');
          }}
        >
          <Ionicons name="school" size={16} color={activeMainTab === 'workshops' ? AppColors.primary : AppColors.textMedium} />
          <Text style={[styles.tabText, activeMainTab === 'workshops' ? styles.tabTextActive : null]}>Workshops</Text>
        </TouchableOpacity>
      </View>

      {/* Filter and search row */}
      <View style={styles.searchBarSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={AppColors.textMedium} style={styles.searchIcon} />
          <TextInput
            placeholder={
              activeMainTab === 'products'
                ? "Search eco-products..."
                : activeMainTab === 'repair'
                ? "Search repair services..."
                : "Search workshops..."
            }
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

        {/* Custom filters for Repair Hub */}
        {activeMainTab === 'repair' && (
          <View style={styles.repairFilterRow}>
            <View style={styles.subFilters}>
              <TouchableOpacity
                style={[styles.subFilterBtn, repairFilter === 'all' ? styles.subFilterBtnActive : null]}
                onPress={() => setRepairFilter('all')}
              >
                <Text style={[styles.subFilterText, repairFilter === 'all' ? styles.subFilterTextActive : null]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subFilterBtn, repairFilter === 'offer' ? styles.subFilterBtnActive : null]}
                onPress={() => setRepairFilter('offer')}
              >
                <Text style={[styles.subFilterText, repairFilter === 'offer' ? styles.subFilterTextActive : null]}>Offers</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subFilterBtn, repairFilter === 'request' ? styles.subFilterBtnActive : null]}
                onPress={() => setRepairFilter('request')}
              >
                <Text style={[styles.subFilterText, repairFilter === 'request' ? styles.subFilterTextActive : null]}>Requests</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.createListingBtn} onPress={handlePostRepair}>
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.createListingText}>Create</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Display FlatLists */}
      {activeMainTab === 'products' ? (
        <FlatList
          data={getFilteredData() as Product[]}
          renderItem={renderProductItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridColumnWrapper}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="leaf-outline" size={48} color={AppColors.textMedium} />
              <Text style={styles.emptyText}>No green products available matching search.</Text>
            </View>
          }
        />
      ) : activeMainTab === 'repair' ? (
        <FlatList
          data={getFilteredData() as RepairItem[]}
          renderItem={renderRepairItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="build-outline" size={48} color={AppColors.textMedium} />
              <Text style={styles.emptyText}>No repair listings available matching search.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={getFilteredData() as Workshop[]}
          renderItem={renderWorkshopItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={48} color={AppColors.textMedium} />
              <Text style={styles.emptyText}>No eco-workshops available matching search.</Text>
            </View>
          }
        />
      )}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    height: 48,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: AppColors.primary,
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
  searchBarSection: {
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
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textDark,
    height: '100%',
  },
  clearIcon: {
    padding: 4,
  },
  repairFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 10,
  },
  subFilters: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  subFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  subFilterBtnActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  subFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  subFilterTextActive: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  createListingBtn: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    gap: 4,
  },
  createListingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gridContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: (width - 44) / 2,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
    overflow: 'hidden',
  },
  productImg: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  productBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(11, 110, 79, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  productBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  productBody: {
    padding: 12,
  },
  productSeller: {
    fontSize: 10,
    color: AppColors.textMedium,
    fontWeight: '600',
    marginBottom: 2,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.primary,
    marginTop: 4,
    marginBottom: 10,
  },
  buyBtn: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: 6,
    gap: 4,
  },
  buyBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  repairCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  repairCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  repairBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOffer: {
    backgroundColor: AppColors.primaryLight + '20',
  },
  badgeRequest: {
    backgroundColor: '#FF9800' + '20',
  },
  repairBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textOffer: {
    color: AppColors.primary,
  },
  textRequest: {
    color: '#FF9800',
  },
  repairCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  repairTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 6,
  },
  repairDesc: {
    fontSize: 13,
    color: AppColors.textMedium,
    lineHeight: 18,
    marginBottom: 12,
  },
  repairFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
    marginBottom: 12,
    gap: 6,
  },
  repairAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  repairAuthorText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textDark,
  },
  repairMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  repairMetaItem: {
    fontSize: 11,
    color: AppColors.textMedium,
  },
  repairContactBtn: {
    backgroundColor: AppColors.primaryLight + '15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.primary + '30',
  },
  repairContactText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '700',
  },
  workshopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  workshopImg: {
    width: '100%',
    height: 140,
  },
  workshopBody: {
    padding: 16,
  },
  workshopHost: {
    fontSize: 10,
    color: AppColors.textMedium,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  workshopTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textDark,
    marginBottom: 8,
  },
  workshopDetailRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  workshopDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workshopDetailText: {
    fontSize: 12,
    color: AppColors.textMedium,
  },
  workshopFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    justifyContent: 'center',
  },
  priceLabel: {
    fontSize: 10,
    color: AppColors.textMedium,
  },
  priceVal: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.primary,
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spotsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  registerBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
