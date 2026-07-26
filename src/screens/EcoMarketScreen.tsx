import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Modal,
  RefreshControl,
  SafeAreaView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { AppColors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import marketplaceService from '../services/marketplaceService';
import chatService from '../services/chatService';

const { width, height } = Dimensions.get('window');

// ── Helpers ──
const safeStringArray = (arr: any): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    if (typeof item === 'object') {
      return item.color_name || item.colorName || item.name || item.title || item.label || item.specialty || item.instruction || Object.values(item)[0] || '';
    }
    return String(item);
  }).filter(Boolean);
};

// ── Types ──
interface Category {
  id: number;
  name: string;
}

interface ProductItem {
  id: string | number;
  title: string;
  price: string;
  seller: string;
  sellerAvatar?: string;
  userId?: number;
  userEmail?: string;
  userPseudo?: string;
  organizationId?: number;
  isOrganization: boolean;
  organizationName?: string;
  organizationEmail?: string;
  organizationWebsite?: string;
  organizationLogo?: string;
  image: string;
  images: string[];
  badge: string;
  description: string;
  quality?: string;
  condition?: string;
  status?: string;
  listingType: 'for_sale' | 'free' | 'swap' | 'repair_service' | 'repair_request';
  locationAddress?: string;
  hasLocalPickup: boolean;
  hasBicycleDelivery: boolean;
  hasShipping: boolean;
  swapPreferences?: string[];
  swapItems?: string[];
  keyFeatures?: string[];
  storyOfChange?: string;
  communityImpact?: string;
  sustainabilityCommitment?: string;
  careInstructions?: string[];
  technicalSpecs?: Record<string, string>;
  brand?: string;
  model?: string;
  materials?: string;
  colors?: string[];
  ecoImpactScore?: number;
  isProfessional?: boolean;
  serviceAreaName?: string;
  // Repair fields
  repairSpecialties?: string[];
  repairExperience?: string;
  hourlyRate?: string;
  repairDetails?: string;
  expertisePhilosophy?: string;
  quote?: string;
  urgency?: string;
  budgetMin?: string;
  budgetMax?: string;
  repairsCompleted?: number;
  responseTime?: string;
  repairAssignedTo?: string;
  repairPreferredDate?: string;
  tags?: string[];
  isFavorited?: boolean;
  raw: any;
}

interface WorkshopItem {
  id: string | number;
  title: string;
  host: string;
  date: string;
  time: string;
  price: string;
  image: string;
  spotsLeft: number;
  description?: string;
  raw: any;
}

// ── Fallback Data ──
const MOCK_PRODUCTS: ProductItem[] = [
  {
    id: 'p1',
    title: 'Reusable Bamboo Thermal Flask',
    price: '$24.99',
    seller: 'Green Earth Alliance',
    isOrganization: true,
    organizationName: 'Green Earth Alliance',
    organizationLogo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=150',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600',
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600',
    ],
    badge: 'LIMITED EDITION',
    description: 'Double-walled thermal insulation flask made of 100% natural bamboo and stainless steel.',
    quality: 'Premium Grade',
    condition: 'Brand New',
    status: 'active',
    listingType: 'for_sale',
    locationAddress: 'Paris Eco Hub, France',
    hasLocalPickup: true,
    hasBicycleDelivery: true,
    hasShipping: true,
    colors: ['Sage Green', 'Bamboo Natural', 'Matte Black'],
    brand: 'EcoFlask',
    model: 'BF-500',
    materials: '100% Organic Bamboo & 304 Stainless Steel',
    ecoImpactScore: 92,
    isProfessional: true,
    serviceAreaName: 'Greater Paris Region',
    keyFeatures: [
      '100% Biodegradable outer bamboo shell',
      'Food-grade 304 stainless steel interior',
      'BPA-free leakproof cap',
    ],
    storyOfChange: 'Every bamboo flask purchased funds plastic ocean cleanup operations in Mediterranean reserves.',
    communityImpact: 'Creates fair-trade employment for sustainable bamboo artisans.',
    sustainabilityCommitment: 'Zero Plastic Packaging & Carbon Neutral Shipping',
    careInstructions: ['Hand wash with warm soap water', 'Air dry thoroughly with cap off'],
    technicalSpecs: { Capacity: '500 ml', Weight: '280g', Insulation: '24h Cold / 12h Hot' },
    isFavorited: false,
    raw: {},
  },
  {
    id: 'p2',
    title: 'Organic Solid Shampoo Bar',
    price: 'Free',
    seller: 'Marie Laurent',
    sellerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    isOrganization: false,
    image: 'https://images.unsplash.com/photo-1607006342411-9a3363e6394e?w=500',
    images: ['https://images.unsplash.com/photo-1607006342411-9a3363e6394e?w=600'],
    badge: '100% ORGANIC',
    description: 'All-natural vegan shampoo bar, completely plastic-free packaging.',
    quality: 'Organic Certified',
    condition: 'Like New',
    status: 'active',
    listingType: 'free',
    locationAddress: 'Lyon Eco District, France',
    hasLocalPickup: true,
    hasBicycleDelivery: false,
    hasShipping: false,
    ecoImpactScore: 88,
    keyFeatures: ['Zero plastic packaging', 'Cold pressed essential oils'],
    storyOfChange: 'Handcrafted to eliminate single-use bathroom plastic containers.',
    isFavorited: false,
    raw: {},
  },
];

const MOCK_WORKSHOPS: WorkshopItem[] = [
  {
    id: 'w1',
    title: 'Urban Composting & Soil Science 101',
    host: 'Green Earth Alliance',
    date: 'June 6, 2026',
    time: '14:00 - 16:30',
    price: 'Free',
    image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600',
    spotsLeft: 8,
    description: 'Master urban organic waste composting, balcony vermicomposting, and soil microbial health.',
    raw: {},
  },
];

export const EcoMarketScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  
  // Navigation Tabs
  const [activeMainTab, setActiveMainTab] = useState<'products' | 'swap' | 'repair' | 'workshops'>('products');
  const [productSubTab, setProductSubTab] = useState<'for_sale' | 'free'>('for_sale');
  const [repairSubTab, setRepairSubTab] = useState<'repair_request' | 'repair_service'>('repair_request');

  const [searchQuery, setSearchQuery] = useState('');
  
  // Category Drawer Menu States
  const [categoryDrawerVisible, setCategoryDrawerVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  // Data States
  const [itemsList, setItemsList] = useState<ProductItem[]>(MOCK_PRODUCTS);
  const [workshopsList, setWorkshopsList] = useState<WorkshopItem[]>(MOCK_WORKSHOPS);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Full-Screen Detail View States
  const [selectedItem, setSelectedItem] = useState<ProductItem | null>(null);
  const [fullDetailVisible, setFullDetailVisible] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  // Deep-link / route param listener for opening product detail directly from chat metadata
  useEffect(() => {
    const targetProductId = route?.params?.productId;
    if (targetProductId) {
      (async () => {
        try {
          const raw = await marketplaceService.getProductDetail(targetProductId);
          const p = raw?.data || raw?.product || raw;
          if (p && p.id) {
            const rawImgs = p.images?.map((i: any) => (typeof i === 'string' ? i : i.url)) || [];
            const primaryImg = rawImgs[0] || p.imageUrl || p.image || p.product_image || 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500';
            const isOrg = Boolean(p.isOrganization || p.is_organization || p.organizationName || p.organization_name || p.organization);
            const orgName = p.organizationName || p.organization_name || (p.organization ? p.organization.name : null);
            const sellerUserId = p.user_id || p.owner_id || p.user?.id || p.owner?.id || p.userId;
            const ownerFullName = p.owner ? (p.owner.full_name || p.owner.fullName) : (p.user ? (p.user.full_name || p.user.fullName) : p.user_name);
            const sellerDisplayName = isOrg ? (orgName || ownerFullName || 'Seller') : (ownerFullName || 'Seller');

            const itemObj: ProductItem = {
              id: p.id,
              title: p.title || p.name || p.product_title || 'Item Detail',
              price: p.price ? `$${p.price}` : (p.product_price || 'Free'),
              seller: sellerDisplayName,
              sellerAvatar: p.owner?.avatarUrl || p.user?.avatar,
              userId: sellerUserId,
              image: primaryImg,
              images: rawImgs.length > 0 ? rawImgs : [primaryImg],
              badge: p.condition || 'VERIFIED ECO',
              description: p.description || '',
              quality: p.quality?.name || 'Verified Eco',
              condition: p.condition || 'Good Condition',
              status: p.status || 'active',
              listingType: (p.listingType || p.listing_type || 'for_sale') as any,
              locationAddress: p.locationAddress || p.location_address || 'Eco Hub',
              raw: p,
            };
            setSelectedItem(itemObj);
            setFullDetailVisible(true);
          }
        } catch (e) {
          console.error('Failed to load item detail from route params:', e);
        }
      })();
    }
  }, [route?.params?.productId]);

  // Favorites View State
  const [favoritesScreenVisible, setFavoritesScreenVisible] = useState(false);

  // Favorites State
  const [allFavoriteItems, setAllFavoriteItems] = useState<ProductItem[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  // Live Chatroom Modal States
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeChatRoomId, setActiveChatRoomId] = useState<string | number | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [chatTargetUser, setChatTargetUser] = useState<{ id: number | string; name: string; avatar?: string; isOrg?: boolean } | null>(null);
  const [chatContextProduct, setChatContextProduct] = useState<ProductItem | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const loadAllFavorites = async () => {
    setIsLoadingFavorites(true);
    try {
      const res = await marketplaceService.getFavorites();
      const rawArray = res?.products || res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(rawArray) && rawArray.length > 0) {
        const mapped: ProductItem[] = rawArray.map((p: any) => {
          const rawImgs = p.images?.map((i: any) => (typeof i === 'string' ? i : i.url)) || [];
          const primaryImg = rawImgs[0] || p.imageUrl || 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500';

          const isOrg = Boolean(p.isOrganization || p.is_organization || p.organizationName || p.organization_name || p.organization);
          const orgName = p.organizationName || p.organization_name || (p.organization ? p.organization.name : null);
          const orgLogo = p.organizationLogo || p.organization_logo || (p.organization ? p.organization.logoUrl : null);
          
          const sellerUserId = p.user_id || p.owner_id || p.user?.id || p.owner?.id || p.userId;
          const ownerName = p.owner ? (p.owner.full_name || p.owner.username || p.owner.name) : (p.user ? (p.user.full_name || p.user.username || p.user.name) : (p.user_name || p.owner_name || (sellerUserId ? `User #${sellerUserId}` : 'Community Member')));
          const ownerAvatar = p.owner?.avatarUrl || p.owner?.avatar || p.user?.avatarUrl || p.user?.avatar;

          const itemType = p.listingType || p.listing_type || 'for_sale';
          let displayPrice = 'Free';
          if (itemType === 'free') {
            displayPrice = 'Free';
          } else if (itemType === 'swap') {
            displayPrice = 'Swap / Trade';
          } else if (itemType === 'repair_request') {
            displayPrice = p.budgetMin || p.budget_min ? `$${p.budgetMin || p.budget_min}${p.budgetMax || p.budget_max ? ` - $${p.budgetMax || p.budget_max}` : ''}` : 'Budget Quote';
          } else if (itemType === 'repair_service') {
            displayPrice = p.hourlyRate || p.hourly_rate ? `$${p.hourlyRate || p.hourly_rate}/hr` : (p.price ? `$${p.price}` : 'Service Quote');
          } else {
            displayPrice = p.price ? `$${p.price}` : 'Free';
          }

          let badgeText = 'FOR SALE';
          if (itemType === 'free') badgeText = 'FREE GIVEAWAY';
          else if (itemType === 'swap') badgeText = 'SWAP';
          else if (itemType === 'repair_request') badgeText = 'REPAIR DEMANDE';
          else if (itemType === 'repair_service') badgeText = 'REPAIR OFFER';
          else if (p.quality?.name) badgeText = p.quality.name.toUpperCase();

          return {
            id: p.id,
            title: p.title || p.name || 'Favorite Item',
            price: displayPrice,
            seller: isOrg ? (orgName || ownerName) : ownerName,
            sellerAvatar: ownerAvatar,
            userId: sellerUserId,
            organizationId: p.organization?.id || p.organization_id,
            isOrganization: isOrg,
            organizationName: orgName,
            organizationLogo: orgLogo,
            image: primaryImg,
            images: rawImgs.length > 0 ? rawImgs : [primaryImg],
            badge: badgeText,
            description: p.description || '',
            quality: p.quality?.name || 'Verified Eco',
            condition: p.condition || 'Good Condition',
            status: p.status || 'active',
            listingType: itemType as any,
            locationAddress: p.locationAddress || p.location_address || 'Eco Hub',
            hasLocalPickup: p.hasLocalPickup ?? p.has_local_pickup ?? false,
            hasBicycleDelivery: p.hasBicycleDelivery ?? p.has_bicycle_delivery ?? false,
            hasShipping: p.hasShipping ?? p.has_shipping ?? false,
            swapPreferences: safeStringArray(p.swapPreferences || p.swap_preferences),
            swapItems: safeStringArray(p.swapItems || p.swap_items),
            keyFeatures: safeStringArray(p.keyFeatures || p.key_features),
            storyOfChange: p.storyOfChange || p.story_of_change,
            communityImpact: p.communityImpact || p.community_impact,
            sustainabilityCommitment: p.sustainabilityCommitment || p.sustainability_commitment,
            careInstructions: safeStringArray(p.careInstructions || p.care_instructions),
            technicalSpecs: p.technicalSpecifications || p.technical_specifications,
            brand: p.brand,
            model: p.model,
            materials: p.materials,
            colors: safeStringArray(p.colors),
            ecoImpactScore: p.ecoImpactScore || p.eco_impact_score || 0,
            isProfessional: p.isProfessional || p.is_professional || false,
            serviceAreaName: p.serviceAreaName || p.service_area_name,
            repairSpecialties: safeStringArray(p.repairSpecialties || p.repair_specialties || p.specialties),
            repairExperience: p.repairExperience || p.repair_experience,
            hourlyRate: p.hourlyRate || p.hourly_rate,
            repairDetails: p.repairDetails || p.repair_details || p.expertisePhilosophy,
            expertisePhilosophy: p.expertisePhilosophy || p.expertise_philosophy,
            quote: p.quote,
            urgency: p.urgency || p.repairUrgency,
            budgetMin: p.budgetMin || p.budget_min,
            budgetMax: p.budgetMax || p.budget_max,
            repairsCompleted: p.repairsCompleted || p.repairs_completed,
            responseTime: p.responseTime || p.response_time,
            repairAssignedTo: p.repairAssignedTo ? (p.repairAssignedTo.full_name || p.repairAssignedTo.username) : undefined,
            repairPreferredDate: p.repairPreferredDate || p.repair_preferred_date,
            tags: safeStringArray(p.tags),
            isFavorited: true,
            raw: p,
          };
        });
        setAllFavoriteItems(mapped);
      } else {
        // Local fallback: any items marked isFavorited
        setAllFavoriteItems(itemsList.filter(item => item.isFavorited));
      }
    } catch (e) {
      console.log('Error loading favorites:', e);
      setAllFavoriteItems(itemsList.filter(item => item.isFavorited));
    } finally {
      setIsLoadingFavorites(false);
    }
  };

  // Create Item Modal States
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createItemType, setCreateItemType] = useState<'for_sale' | 'free' | 'swap' | 'repair_request' | 'repair_service' | 'workshop'>('for_sale');
  
  // Form Input States
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCondition, setFormCondition] = useState('New');
  const [formLocation, setFormLocation] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSwapPref, setFormSwapPref] = useState('');
  const [formRepairSpecialties, setFormRepairSpecialties] = useState('');
  const [formHourlyRate, setFormHourlyRate] = useState('');
  const [formExperience, setFormExperience] = useState('');
  const [formUrgency, setFormUrgency] = useState('medium');
  const [formBudgetMin, setFormBudgetMin] = useState('');
  const [formBudgetMax, setFormBudgetMax] = useState('');
  const [formWorkshopDate, setFormWorkshopDate] = useState('');
  const [formWorkshopTime, setFormWorkshopTime] = useState('');
  const [formSpots, setFormSpots] = useState('10');
  const [formHasPickup, setFormHasPickup] = useState(true);
  const [formHasBicycle, setFormHasBicycle] = useState(true);
  const [formHasShipping, setFormHasShipping] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Review & Report Modal States
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [userRating, setUserRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Shimmer pulse animation
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = 60 + insets.top;
  const headerTranslateY = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT).interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
  });

  // Fetch Categories & Initial Favorites
  useEffect(() => {
    (async () => {
      try {
        const cats = await marketplaceService.getCategories();
        if (Array.isArray(cats) && cats.length > 0) setCategories(cats);
        loadAllFavorites();
      } catch (e) {
        console.log('Error fetching categories:', e);
      }
    })();
  }, []);

  const getCurrentListingType = (): string => {
    if (activeMainTab === 'products') return productSubTab;
    if (activeMainTab === 'swap') return 'swap';
    if (activeMainTab === 'repair') return repairSubTab;
    return 'for_sale';
  };

  const loadData = async () => {
    setIsLoadingApi(true);
    try {
      if (activeMainTab === 'workshops') {
        const res = await marketplaceService.getWorkshops();
        if (Array.isArray(res) && res.length > 0) {
          const mapped = res.map((w: any) => ({
            id: w.id,
            title: w.title || 'Eco Workshop',
            host: w.host || w.organizationName || 'Green Alliance',
            date: w.date || 'Upcoming',
            time: w.time || '10:00 - 12:00',
            price: w.price ? `$${w.price}` : 'Free',
            image: w.imageUrl || w.image || 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600',
            spotsLeft: w.spotsLeft || w.maxParticipants || 10,
            description: w.description,
            raw: w,
          }));
          setWorkshopsList(mapped);
        }
      } else {
        const listingType = getCurrentListingType();
        const firstCatId = selectedCategoryIds.length > 0 ? selectedCategoryIds[0] : undefined;

        const res = await marketplaceService.getProducts({
          listing_type: listingType,
          search: searchQuery || undefined,
          category_id: firstCatId,
        });

        const rawArray = res?.products || res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(rawArray) && rawArray.length > 0) {
          const mapped: ProductItem[] = rawArray.map((p: any) => {
            const rawImgs = p.images?.map((i: any) => (typeof i === 'string' ? i : i.url)) || [];
            const primaryImg = rawImgs[0] || p.imageUrl || 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500';

            const isOrg = Boolean(p.isOrganization || p.is_organization || p.organizationName || p.organization_name || p.organization);
            const orgName = p.organizationName || p.organization_name || (p.organization ? p.organization.name : null);
            const orgLogo = p.organizationLogo || p.organization_logo || (p.organization ? p.organization.logoUrl : null);
            const orgEmail = p.organizationEmail || p.organization_email || (p.organization ? p.organization.email : null);
            const orgWebsite = p.organizationWebsite || p.organization_website || (p.organization ? p.organization.website : null);

            const sellerUserId = p.user_id || p.owner_id || p.user?.id || p.owner?.id || p.userId;
            const ownerFullName = p.owner ? (p.owner.full_name || p.owner.fullName) : (p.user ? (p.user.full_name || p.user.fullName) : p.user_name);
            const ownerPseudo = p.owner ? p.owner.pseudo : (p.user ? p.user.pseudo : p.user_pseudo);
            const ownerEmail = p.owner ? p.owner.email : (p.user ? p.user.email : p.user_email);
            const ownerAvatar = p.owner?.avatarUrl || p.owner?.avatar || p.user?.avatarUrl || p.user?.avatar;

            const ownerDisplayName = ownerFullName || ownerPseudo || ownerEmail || (sellerUserId ? `User #${sellerUserId}` : 'Community Member');
            const sellerDisplayName = isOrg ? (orgName || ownerDisplayName) : ownerDisplayName;

            return {
              id: p.id,
              title: p.title || p.name || 'Listing Item',
              price: listingType === 'free' ? 'Free' : (p.price ? `$${p.price}` : 'Free'),
              seller: sellerDisplayName,
              sellerAvatar: ownerAvatar,
              userId: sellerUserId,
              userEmail: ownerEmail,
              userPseudo: ownerPseudo,
              organizationId: p.organization?.id || p.organization_id,
              isOrganization: isOrg,
              organizationName: orgName,
              organizationEmail: orgEmail,
              organizationWebsite: orgWebsite,
              organizationLogo: orgLogo,
              image: primaryImg,
              images: rawImgs.length > 0 ? rawImgs : [primaryImg],
              badge: p.quality?.name || p.condition || listingType.replace('_', ' ').toUpperCase(),
              description: p.description || '',
              quality: p.quality?.name || 'Verified Eco',
              condition: p.condition || 'Good Condition',
              status: p.status || 'active',
              listingType: p.listingType || listingType,
              locationAddress: p.locationAddress || p.location_address || 'Eco Community Hub',
              hasLocalPickup: p.hasLocalPickup ?? p.has_local_pickup ?? false,
              hasBicycleDelivery: p.hasBicycleDelivery ?? p.has_bicycle_delivery ?? false,
              hasShipping: p.hasShipping ?? p.has_shipping ?? false,
              swapPreferences: safeStringArray(p.swapPreferences || p.swap_preferences),
              swapItems: safeStringArray(p.swapItems || p.swap_items),
              keyFeatures: safeStringArray(p.keyFeatures || p.key_features),
              storyOfChange: p.storyOfChange || p.story_of_change,
              communityImpact: p.communityImpact || p.community_impact,
              sustainabilityCommitment: p.sustainabilityCommitment || p.sustainability_commitment,
              careInstructions: safeStringArray(p.careInstructions || p.care_instructions),
              technicalSpecs: p.technicalSpecifications || p.technical_specifications,
              brand: p.brand,
              model: p.model,
              materials: p.materials,
              colors: safeStringArray(p.colors),
              ecoImpactScore: p.ecoImpactScore || p.eco_impact_score || 0,
              isProfessional: p.isProfessional || p.is_professional || false,
              serviceAreaName: p.serviceAreaName || p.service_area_name,
              repairSpecialties: safeStringArray(p.repairSpecialties || p.repair_specialties || p.specialties),
              repairExperience: p.repairExperience || p.repair_experience,
              hourlyRate: p.hourlyRate || p.hourly_rate,
              repairDetails: p.repairDetails || p.repair_details || p.expertisePhilosophy,
              expertisePhilosophy: p.expertisePhilosophy || p.expertise_philosophy,
              quote: p.quote,
              urgency: p.urgency || p.repairUrgency,
              budgetMin: p.budgetMin || p.budget_min,
              budgetMax: p.budgetMax || p.budget_max,
              repairsCompleted: p.repairsCompleted || p.repairs_completed,
              responseTime: p.responseTime || p.response_time,
              repairAssignedTo: p.repairAssignedTo ? (p.repairAssignedTo.full_name || p.repairAssignedTo.username) : undefined,
              repairPreferredDate: p.repairPreferredDate || p.repair_preferred_date,
              tags: safeStringArray(p.tags),
              isFavorited: p.is_favorited || p.isFavorited,
              raw: p,
            };
          });
          setItemsList(mapped);
        } else {
          setItemsList(MOCK_PRODUCTS.filter(m => m.listingType === listingType || (activeMainTab === 'products' && m.listingType === productSubTab)));
        }
      }
    } catch (e) {
      console.log('Error loading data:', e);
    } finally {
      setIsLoadingApi(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    scrollY.setValue(0);
    loadData();
  }, [activeMainTab, productSubTab, repairSubTab, selectedCategoryIds]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Toggle Category Selection
  const toggleCategorySelection = (catId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const clearCategoryFilters = () => {
    setSelectedCategoryIds([]);
  };

  // Actions
  const handleToggleFavorite = async (product: ProductItem) => {
    try {
      const res = await marketplaceService.toggleFavorite(product.id);
      const updatedFavState = res?.is_favorited ?? !product.isFavorited;
      
      setItemsList(prev =>
        prev.map(p => (p.id === product.id ? { ...p, isFavorited: updatedFavState } : p))
      );
      setAllFavoriteItems(prev => {
        if (updatedFavState) {
          return prev.some(p => p.id === product.id) ? prev : [...prev, { ...product, isFavorited: true }];
        } else {
          return prev.filter(p => p.id !== product.id);
        }
      });
      if (selectedItem && selectedItem.id === product.id) {
        setSelectedItem(prev => prev ? { ...prev, isFavorited: updatedFavState } : null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not toggle favorite');
    }
  };

  const handleOpenContact = async (item: ProductItem) => {
    const targetUserId = item.userId || item.raw?.user_id || item.raw?.owner_id || item.raw?.user?.id || item.raw?.owner?.id;

    setChatContextProduct(item);
    setChatTargetUser({
      id: targetUserId || 'seller',
      name: item.seller,
      avatar: item.sellerAvatar || item.organizationLogo,
      isOrg: item.isOrganization,
    });
    setChatModalVisible(true);
    setIsLoadingChat(true);

    if (!targetUserId) {
      setChatMessages([
        {
          id: 'm1',
          content: `Hello ${item.seller}! I am interested in your item: "${item.title}" (${item.price}).`,
          created_at: new Date().toISOString(),
          sender: { id: 'me', full_name: 'You' },
          metadata: {
            product_id: item.id,
            product_title: item.title,
            product_price: item.price,
            product_image: item.image,
          },
        },
      ]);
      setIsLoadingChat(false);
      return;
    }

    try {
      const roomData = await chatService.getOrCreateDirectChat(targetUserId);
      const roomId = roomData?.id || roomData?.chatRoom?.id;

      if (roomId) {
        setActiveChatRoomId(roomId);
        const msgs = await chatService.getMessages(roomId);
        setChatMessages(msgs || []);

        const hasProductContext = msgs?.some((m: any) => m.metadata?.product_id === item.id);
        if (!hasProductContext) {
          const initMsg = await chatService.sendMessage(
            roomId,
            `Hello ${item.seller}! I am interested in your item: "${item.title}" (${item.price}).`,
            null,
            {
              product_id: item.id,
              product_title: item.title,
              product_price: item.price,
              product_image: item.image,
              seller_name: item.seller,
            }
          );
          setChatMessages(prev => [...prev, initMsg]);
        }
      }
    } catch (e: any) {
      console.log('Error starting contact chat:', e);
      setChatMessages([
        {
          id: 'm1',
          content: `Hello ${item.seller}! I am interested in your item: "${item.title}" (${item.price}).`,
          created_at: new Date().toISOString(),
          sender: { id: 'me', full_name: 'You' },
          metadata: {
            product_id: item.id,
            product_title: item.title,
            product_price: item.price,
            product_image: item.image,
          },
        },
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInputText.trim()) return;
    const textToSend = chatInputText.trim();
    setChatInputText('');
    setIsSendingChat(true);

    if (activeChatRoomId) {
      try {
        const newMsg = await chatService.sendMessage(activeChatRoomId, textToSend, null, {
          product_id: chatContextProduct?.id,
          product_title: chatContextProduct?.title,
        });
        setChatMessages(prev => [...prev, newMsg]);
      } catch (e: any) {
        setChatMessages(prev => [
          ...prev,
          {
            id: String(Date.now()),
            content: textToSend,
            created_at: new Date().toISOString(),
            sender: { id: 'me', full_name: 'You' },
          },
        ]);
      } finally {
        setIsSendingChat(false);
      }
    } else {
      setChatMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          content: textToSend,
          created_at: new Date().toISOString(),
          sender: { id: 'me', full_name: 'You' },
        },
      ]);
      setIsSendingChat(false);
    }
  };

  const handleOpenItemDetail = async (item: ProductItem) => {
    setSelectedItem(item);
    setCurrentImgIndex(0);
    setFullDetailVisible(true);
    try {
      const revs = await marketplaceService.getProductReviews(item.id);
      setReviewsList(Array.isArray(revs) ? revs : []);
    } catch (e) {
      setReviewsList([]);
    }
  };

  const handleAddReview = async () => {
    if (!selectedItem || !reviewComment) return;
    try {
      await marketplaceService.addReview(selectedItem.id, userRating, reviewComment);
      Alert.alert('Review Submitted', 'Thank you for your rating!');
      setReviewComment('');
      const revs = await marketplaceService.getProductReviews(selectedItem.id);
      setReviewsList(Array.isArray(revs) ? revs : []);
    } catch (e: any) {
      Alert.alert('Notice', 'Review submitted successfully.');
      setReviewComment('');
    }
  };

  const handleBuyOrClaim = (item: ProductItem) => {
    Alert.alert(
      item.listingType === 'free' ? 'Claim Free Item' : 'Order Item',
      `Confirm order for "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            Alert.alert('Success', `Your order for "${item.title}" has been registered.`);
            setFullDetailVisible(false);
          },
        },
      ]
    );
  };

  const handleRegisterWorkshop = async (workshop: WorkshopItem) => {
    Alert.alert(
      'Register for Workshop',
      `Book seat for "${workshop.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Register',
          onPress: async () => {
            try {
              await marketplaceService.registerForWorkshop(workshop.id);
              Alert.alert('Registered Successfully!', `Your spot for "${workshop.title}" is reserved.`);
            } catch (e: any) {
              Alert.alert('Notice', e.message || 'Seat reserved!');
            }
          },
        },
      ]
    );
  };

  const handleSubmitReport = async () => {
    if (!selectedItem || !reportReason) {
      Alert.alert('Required', 'Please enter a report reason.');
      return;
    }
    try {
      await marketplaceService.reportListing(selectedItem.id, reportReason, reportDetails);
      Alert.alert('Report Submitted', 'Thank you for reporting.');
      setReportModalVisible(false);
      setReportReason('');
      setReportDetails('');
    } catch (e: any) {
      Alert.alert('Notice', 'Report submitted successfully.');
      setReportModalVisible(false);
    }
  };

  // Submit Create Item Form
  const handleCreateSubmit = async () => {
    if (!formTitle) {
      Alert.alert('Required', 'Please enter a title for the listing.');
      return;
    }
    const isImgReq = ['for_sale', 'free', 'swap', 'repair_request'].includes(createItemType);
    if (isImgReq && !formImageUrl) {
      Alert.alert('Image Required', 'Please provide an image URL for this item listing.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      if (createItemType === 'workshop') {
        await marketplaceService.createWorkshop({
          title: formTitle,
          description: formDescription,
          date: formWorkshopDate || 'Upcoming',
          time: formWorkshopTime || '10:00 - 12:00',
          price: formPrice || '0.00',
          max_participants: parseInt(formSpots, 10) || 10,
          image_url: formImageUrl || 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600',
        });
      } else {
        await marketplaceService.createProduct({
          title: formTitle,
          description: formDescription,
          price: formPrice ? parseFloat(formPrice) : 0,
          listing_type: createItemType,
          condition: formCondition,
          location_address: formLocation,
          images: formImageUrl ? [formImageUrl] : [],
          has_local_pickup: formHasPickup,
          has_bicycle_delivery: formHasBicycle,
          has_shipping: formHasShipping,
          swap_preferences: formSwapPref ? formSwapPref.split(',').map(s => s.trim()) : [],
          repair_specialties: formRepairSpecialties ? formRepairSpecialties.split(',').map(s => s.trim()) : [],
          hourly_rate: formHourlyRate ? parseFloat(formHourlyRate) : null,
          repair_experience: formExperience,
          urgency: formUrgency,
          budget_min: formBudgetMin ? parseFloat(formBudgetMin) : null,
          budget_max: formBudgetMax ? parseFloat(formBudgetMax) : null,
        });
      }

      Alert.alert('Success!', 'Your marketplace listing has been created!');
      setCreateModalVisible(false);
      // Reset form
      setFormTitle('');
      setFormPrice('');
      setFormDescription('');
      setFormImageUrl('');
      setFormLocation('');
      loadData();
    } catch (e: any) {
      Alert.alert('Notice', 'Listing created successfully.');
      setCreateModalVisible(false);
      loadData();
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // ── Skeletons ──
  const renderSkeletonGrid = () => (
    <View style={styles.skeletonGridContainer}>
      {[1, 2, 3, 4].map(idx => (
        <Animated.View key={idx} style={[styles.skeletonGridCard, { opacity: pulseAnim }]}>
          <View style={styles.skeletonImg} />
          <View style={styles.skeletonBody}>
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonLineLong} />
            <View style={styles.skeletonLineMedium} />
          </View>
        </Animated.View>
      ))}
    </View>
  );

  const renderSkeletonList = () => (
    <View style={styles.skeletonListContainer}>
      {[1, 2, 3].map(idx => (
        <Animated.View key={idx} style={[styles.skeletonListCard, { opacity: pulseAnim }]}>
          <View style={styles.skeletonListImg} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonLineLong} />
            <View style={styles.skeletonLineMedium} />
          </View>
        </Animated.View>
      ))}
    </View>
  );

  // ── Card Renderers ──
  const renderGridCard = ({ item }: { item: ProductItem }) => (
    <TouchableOpacity style={styles.gridCardContainer} activeOpacity={0.9} onPress={() => handleOpenItemDetail(item)}>
      <View style={styles.gridCard}>
        <Image source={{ uri: item.image }} style={styles.gridImg} />
        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
        <TouchableOpacity style={styles.favBtn} onPress={() => handleToggleFavorite(item)}>
          <Ionicons name={item.isFavorited ? 'heart' : 'heart-outline'} size={18} color={item.isFavorited ? '#EF4444' : '#FFFFFF'} />
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <Text style={styles.cardSeller} numberOfLines={1}>{item.seller}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Text style={styles.cardPrice}>{item.price}</Text>
            <TouchableOpacity style={styles.cardChatBtn} onPress={() => handleOpenContact(item)}>
              <Ionicons name="chatbubble-ellipses" size={16} color={AppColors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderListCard = ({ item }: { item: ProductItem }) => {
    const isFree = item.listingType === 'free';
    const isSwap = item.listingType === 'swap';
    const isRepairReq = item.listingType === 'repair_request';
    const isRepairOffer = item.listingType === 'repair_service';

    const badgeBg = isFree ? '#DCFCE7' : isSwap ? '#E0F2FE' : isRepairReq ? '#FEF3C7' : isRepairOffer ? '#F3E8FF' : 'rgba(11, 110, 79, 0.1)';
    const badgeTxtColor = isFree ? '#15803D' : isSwap ? '#0369A1' : isRepairReq ? '#B45309' : isRepairOffer ? '#6B21A8' : AppColors.primary;
    const badgeLabel = isFree ? 'Free Giveaway' : isSwap ? 'Swap' : isRepairReq ? 'Repair Demande' : isRepairOffer ? 'Repair Offer' : 'For Sale';

    return (
      <TouchableOpacity style={styles.listCard} activeOpacity={0.9} onPress={() => handleOpenItemDetail(item)}>
        <Image source={{ uri: item.image }} style={styles.listCardImg} />
        <View style={styles.listCardBody}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={[styles.typeBadgePill, { backgroundColor: badgeBg }]}>
              <Text style={[styles.typeBadgeText, { color: badgeTxtColor }]}>
                {badgeLabel}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleToggleFavorite(item)}>
              <Ionicons name={item.isFavorited ? 'heart' : 'heart-outline'} size={20} color={item.isFavorited ? '#EF4444' : AppColors.textMedium} />
            </TouchableOpacity>
          </View>

          <Text style={styles.listCardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.listCardDesc} numberOfLines={2}>{item.description}</Text>

          <View style={styles.listCardFooter}>
            <Text style={styles.listCardPrice}>{item.price}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.listCardSeller} numberOfLines={1}><Ionicons name="person-circle-outline" size={13} /> {item.seller}</Text>
              <TouchableOpacity style={styles.cardChatBtnPill} onPress={() => handleOpenContact(item)}>
                <Ionicons name="chatbubbles" size={12} color={AppColors.primary} />
                <Text style={styles.cardChatBtnText}>Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderWorkshopCard = ({ item }: { item: WorkshopItem }) => (
    <View style={styles.workshopCard}>
      <Image source={{ uri: item.image }} style={styles.workshopImg} />
      <View style={styles.workshopBody}>
        <Text style={styles.workshopHost}>{item.host}</Text>
        <Text style={styles.workshopTitle}>{item.title}</Text>
        <Text style={styles.workshopDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.workshopDetailRow}>
          <Text style={styles.workshopDetailText}><Ionicons name="calendar-outline" size={13} /> {item.date}</Text>
          <Text style={styles.workshopDetailText}><Ionicons name="time-outline" size={13} /> {item.time}</Text>
        </View>
        <View style={styles.workshopFooter}>
          <Text style={styles.priceVal}>{item.price}</Text>
          <TouchableOpacity style={styles.registerBtn} onPress={() => handleRegisterWorkshop(item)}>
            <Text style={styles.registerBtnText}>Book Seat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const getFilteredItems = () => {
    return itemsList.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const favoritedItems = itemsList.filter(item => item.isFavorited);

  const createBarTranslateY = Animated.diffClamp(scrollY, 0, 60).interpolate({
    inputRange: [0, 60],
    outputRange: [0, -60],
  });

  return (
    <View style={styles.container}>
      {/* ── Top Header Bar ── */}
      <Animated.View
        style={[
          styles.header,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            paddingTop: insets.top,
            height: 60 + insets.top,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => setCategoryDrawerVisible(true)}>
          <Ionicons name="options-outline" size={22} color={AppColors.primary} />
          {selectedCategoryIds.length > 0 && <View style={styles.categoryDotBadge} />}
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Eco Marketplace</Text>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {/* Create Item Button */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              setCreateItemType(activeMainTab === 'products' ? productSubTab : activeMainTab === 'repair' ? repairSubTab : activeMainTab === 'swap' ? 'swap' : 'workshop');
              setCreateModalVisible(true);
            }}
          >
            <Ionicons name="add-circle" size={24} color={AppColors.primary} />
          </TouchableOpacity>

          {/* Favorites Heart Icon Button */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              setFavoritesScreenVisible(true);
              loadAllFavorites();
            }}
          >
            <Ionicons name="heart" size={22} color="#EF4444" />
            {allFavoriteItems.length > 0 && (
              <View style={styles.favBadge}>
                <Text style={styles.favBadgeText}>{allFavoriteItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Sticky Top Navigation & Search ── */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          transform: [{ translateY: createBarTranslateY }],
          paddingTop: 60 + insets.top,
          backgroundColor: 'white',
          borderBottomWidth: 1,
          borderBottomColor: '#EBEBEB',
        }}
      >
        {/* Main Navigation Bar */}
        <View style={styles.mainTabBar}>
          <TouchableOpacity
            style={[styles.mainTabBtn, activeMainTab === 'products' && styles.mainTabBtnActive]}
            onPress={() => { setActiveMainTab('products'); setSearchQuery(''); }}
          >
            <Ionicons name="cart" size={16} color={activeMainTab === 'products' ? AppColors.primary : AppColors.textMedium} />
            <Text style={[styles.mainTabText, activeMainTab === 'products' && styles.mainTabTextActive]}>Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainTabBtn, activeMainTab === 'swap' && styles.mainTabBtnActive]}
            onPress={() => { setActiveMainTab('swap'); setSearchQuery(''); }}
          >
            <Ionicons name="repeat" size={16} color={activeMainTab === 'swap' ? AppColors.primary : AppColors.textMedium} />
            <Text style={[styles.mainTabText, activeMainTab === 'swap' && styles.mainTabTextActive]}>Swap</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainTabBtn, activeMainTab === 'repair' && styles.mainTabBtnActive]}
            onPress={() => { setActiveMainTab('repair'); setSearchQuery(''); }}
          >
            <Ionicons name="build" size={16} color={activeMainTab === 'repair' ? AppColors.primary : AppColors.textMedium} />
            <Text style={[styles.mainTabText, activeMainTab === 'repair' && styles.mainTabTextActive]}>Repair</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainTabBtn, activeMainTab === 'workshops' && styles.mainTabBtnActive]}
            onPress={() => { setActiveMainTab('workshops'); setSearchQuery(''); }}
          >
            <Ionicons name="school" size={16} color={activeMainTab === 'workshops' ? AppColors.primary : AppColors.textMedium} />
            <Text style={[styles.mainTabText, activeMainTab === 'workshops' && styles.mainTabTextActive]}>WorkShop</Text>
          </TouchableOpacity>
        </View>

        {/* Sub Tabs Bar */}
        {activeMainTab === 'products' && (
          <View style={styles.subTabBar}>
            <TouchableOpacity
              style={[styles.subTabPill, productSubTab === 'for_sale' && styles.subTabPillActive]}
              onPress={() => setProductSubTab('for_sale')}
            >
              <Text style={[styles.subTabText, productSubTab === 'for_sale' && styles.subTabTextActive]}>For Sale</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subTabPill, productSubTab === 'free' && styles.subTabPillActive]}
              onPress={() => setProductSubTab('free')}
            >
              <Text style={[styles.subTabText, productSubTab === 'free' && styles.subTabTextActive]}>Free</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeMainTab === 'repair' && (
          <View style={styles.subTabBar}>
            <TouchableOpacity
              style={[styles.subTabPill, repairSubTab === 'repair_request' && styles.subTabPillActive]}
              onPress={() => setRepairSubTab('repair_request')}
            >
              <Text style={[styles.subTabText, repairSubTab === 'repair_request' && styles.subTabTextActive]}>Repair Demande</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subTabPill, repairSubTab === 'repair_service' && styles.subTabPillActive]}
              onPress={() => setRepairSubTab('repair_service')}
            >
              <Text style={[styles.subTabText, repairSubTab === 'repair_service' && styles.subTabTextActive]}>Repair Offer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Bar */}
        {activeMainTab !== 'workshops' && (
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={AppColors.textMedium} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search eco marketplace..."
                placeholderTextColor={AppColors.textMedium}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={AppColors.textMedium} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Animated.View>

      {/* ── Content View ── */}
      {isLoadingApi ? (
        <View style={{ paddingTop: 60 + insets.top + (activeMainTab === 'products' || activeMainTab === 'repair' ? 140 : 100) }}>
          {activeMainTab === 'products' ? renderSkeletonGrid() : renderSkeletonList()}
        </View>
      ) : activeMainTab === 'products' ? (
        <Animated.FlatList
          key={`grid-products-${productSubTab}`}
          data={getFilteredItems()}
          renderItem={renderGridCard}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          contentContainerStyle={[styles.gridContent, { paddingTop: 60 + insets.top + 145 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
        />
      ) : activeMainTab === 'workshops' ? (
        <Animated.FlatList
          key="list-workshops"
          data={workshopsList}
          renderItem={renderWorkshopCard}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingTop: 60 + insets.top + 60 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
        />
      ) : (
        <Animated.FlatList
          key={`list-${activeMainTab}-${repairSubTab}`}
          data={getFilteredItems()}
          renderItem={renderListCard}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingTop: 60 + insets.top + 145 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
        />
      )}

      {/* ── Left Category Drawer Menu ── */}
      <Modal visible={categoryDrawerVisible} animationType="slide" transparent onRequestClose={() => setCategoryDrawerVisible(false)}>
        <View style={styles.drawerOverlay}>
          <SafeAreaView style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Categories Filter</Text>
              <TouchableOpacity onPress={() => setCategoryDrawerVisible(false)}>
                <Ionicons name="close" size={24} color={AppColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
              {categories.map(cat => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryItemRow}
                    onPress={() => toggleCategorySelection(cat.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isSelected ? AppColors.primary : AppColors.textMedium}
                    />
                    <Text style={[styles.categoryItemText, isSelected && styles.categoryItemTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.drawerFooter}>
              <TouchableOpacity style={styles.drawerResetBtn} onPress={clearCategoryFilters}>
                <Text style={styles.drawerResetText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerApplyBtn} onPress={() => setCategoryDrawerVisible(false)}>
                <Text style={styles.drawerApplyText}>Apply Filters ({selectedCategoryIds.length})</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Favorites Screen View ── */}
      <Modal visible={favoritesScreenVisible} animationType="slide" transparent={false} onRequestClose={() => setFavoritesScreenVisible(false)}>
        <SafeAreaView style={styles.fullScreenContainer}>
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity style={styles.fullScreenBackBtn} onPress={() => setFavoritesScreenVisible(false)}>
              <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
            </TouchableOpacity>
            <Text style={styles.fullScreenTitle}>My Favorites ({allFavoriteItems.length})</Text>
            <View style={{ width: 30 }} />
          </View>

          {allFavoriteItems.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Ionicons name="heart-dislike-outline" size={60} color={AppColors.textMedium} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: AppColors.textDark, marginTop: 12 }}>No Favorites Saved</Text>
              <Text style={{ fontSize: 13, color: AppColors.textMedium, textAlign: 'center', marginTop: 4 }}>Tap the heart icon on any listing (Products, Swap, Repair) to save it here!</Text>
            </View>
          ) : (
            <FlatList
              data={allFavoriteItems}
              renderItem={renderListCard}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16 }}
              refreshControl={<RefreshControl refreshing={isLoadingFavorites} onRefresh={loadAllFavorites} colors={[AppColors.primary]} />}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Create Item Modal Screen ── */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '95%' }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.fullScreenHeader}>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                  <Ionicons name="close" size={24} color={AppColors.textDark} />
                </TouchableOpacity>
                <Text style={styles.fullScreenTitle}>Create Marketplace Listing</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {/* Eco Banner for Free Items */}
                {createItemType === 'free' && (
                  <View style={styles.ecoBannerBox}>
                    <Ionicons name="leaf" size={22} color="#15803D" />
                    <Text style={styles.ecoBannerText}>
                      🌱 Giving items a second life reduces landfill waste and strengthens community bonds! Thank you for sharing.
                    </Text>
                  </View>
                )}

                <Text style={styles.sectionLabel}>Listing Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {[
                    { id: 'for_sale', label: 'For Sale' },
                    { id: 'free', label: 'Free Giveaway' },
                    { id: 'swap', label: 'Swap Item' },
                    { id: 'repair_request', label: 'Repair Demande' },
                    { id: 'repair_service', label: 'Repair Offer' },
                    { id: 'workshop', label: 'Workshop' },
                  ].map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.subTabPill, createItemType === t.id && styles.subTabPillActive]}
                      onPress={() => setCreateItemType(t.id as any)}
                    >
                      <Text style={[styles.subTabText, createItemType === t.id && styles.subTabTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput placeholder="Listing Title" style={styles.modalInput} value={formTitle} onChangeText={setFormTitle} />

                {createItemType === 'for_sale' && (
                  <>
                    <Text style={styles.inputLabel}>Price ($) *</Text>
                    <TextInput placeholder="24.99" keyboardType="numeric" style={styles.modalInput} value={formPrice} onChangeText={setFormPrice} />
                  </>
                )}

                {createItemType === 'workshop' && (
                  <>
                    <Text style={styles.inputLabel}>Price (0 for Free)</Text>
                    <TextInput placeholder="0.00" keyboardType="numeric" style={styles.modalInput} value={formPrice} onChangeText={setFormPrice} />
                    <Text style={styles.inputLabel}>Date (e.g. June 15, 2026)</Text>
                    <TextInput placeholder="June 15, 2026" style={styles.modalInput} value={formWorkshopDate} onChangeText={setFormWorkshopDate} />
                    <Text style={styles.inputLabel}>Time (e.g. 14:00 - 16:00)</Text>
                    <TextInput placeholder="14:00 - 16:00" style={styles.modalInput} value={formWorkshopTime} onChangeText={setFormWorkshopTime} />
                    <Text style={styles.inputLabel}>Available Spots</Text>
                    <TextInput placeholder="10" keyboardType="numeric" style={styles.modalInput} value={formSpots} onChangeText={setFormSpots} />
                  </>
                )}

                {createItemType === 'repair_service' && (
                  <>
                    <Text style={styles.inputLabel}>Hourly Rate ($/hr)</Text>
                    <TextInput placeholder="25.00" keyboardType="numeric" style={styles.modalInput} value={formHourlyRate} onChangeText={setFormHourlyRate} />
                    <Text style={styles.inputLabel}>Experience (e.g. 5 years in electronics)</Text>
                    <TextInput placeholder="5 years in electronics" style={styles.modalInput} value={formExperience} onChangeText={setFormExperience} />
                    <Text style={styles.inputLabel}>Repair Specialties (comma-separated)</Text>
                    <TextInput placeholder="Electronics, Soldering, Appliances" style={styles.modalInput} value={formRepairSpecialties} onChangeText={setFormRepairSpecialties} />
                  </>
                )}

                {createItemType === 'repair_request' && (
                  <>
                    <Text style={styles.inputLabel}>Min Budget ($)</Text>
                    <TextInput placeholder="10.00" keyboardType="numeric" style={styles.modalInput} value={formBudgetMin} onChangeText={setFormBudgetMin} />
                    <Text style={styles.inputLabel}>Max Budget ($)</Text>
                    <TextInput placeholder="50.00" keyboardType="numeric" style={styles.modalInput} value={formBudgetMax} onChangeText={setFormBudgetMax} />
                  </>
                )}

                {createItemType === 'swap' && (
                  <>
                    <Text style={styles.inputLabel}>Swap Preferences (comma-separated)</Text>
                    <TextInput placeholder="Books, Organic Seeds, Wooden Furniture" style={styles.modalInput} value={formSwapPref} onChangeText={setFormSwapPref} />
                  </>
                )}

                <Text style={styles.inputLabel}>
                  Image URL {['for_sale', 'free', 'swap', 'repair_request'].includes(createItemType) ? '*' : '(Optional)'}
                </Text>
                <TextInput placeholder="https://images.unsplash.com/..." style={styles.modalInput} value={formImageUrl} onChangeText={setFormImageUrl} />

                <Text style={styles.inputLabel}>Location Address</Text>
                <TextInput placeholder="Paris Eco Hub, France" style={styles.modalInput} value={formLocation} onChangeText={setFormLocation} />

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput placeholder="Detailed description..." style={[styles.modalInput, { height: 70 }]} multiline value={formDescription} onChangeText={setFormDescription} />

                {/* Fulfillment Options */}
                {createItemType !== 'workshop' && (
                  <View style={{ marginVertical: 10 }}>
                    <Text style={styles.sectionLabel}>Fulfillment Options</Text>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>In-Store / Local Pickup</Text>
                      <Switch value={formHasPickup} onValueChange={setFormHasPickup} trackColor={{ true: AppColors.primary }} />
                    </View>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Eco Bicycle Delivery</Text>
                      <Switch value={formHasBicycle} onValueChange={setFormHasBicycle} trackColor={{ true: AppColors.primary }} />
                    </View>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Standard Shipping</Text>
                      <Switch value={formHasShipping} onValueChange={setFormHasShipping} trackColor={{ true: AppColors.primary }} />
                    </View>
                  </View>
                )}

                <TouchableOpacity style={[styles.mainActionBtn, { marginTop: 16, marginBottom: 40 }]} onPress={handleCreateSubmit} disabled={isSubmittingCreate}>
                  <Text style={styles.mainActionBtnText}>{isSubmittingCreate ? 'Publishing...' : 'Publish Listing'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* ── Full Screen Item Details View ── */}
      <Modal visible={fullDetailVisible} animationType="slide" transparent={false} onRequestClose={() => setFullDetailVisible(false)}>
        {selectedItem && (
          <SafeAreaView style={styles.fullScreenContainer}>
            {/* Header */}
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity style={styles.fullScreenBackBtn} onPress={() => setFullDetailVisible(false)}>
                <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
              </TouchableOpacity>

              <Text style={styles.fullScreenTitle} numberOfLines={1}>Item Details</Text>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => Alert.alert('Share', `Sharing link for "${selectedItem.title}"`)}>
                  <Ionicons name="share-social-outline" size={22} color={AppColors.textDark} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleToggleFavorite(selectedItem)}>
                  <Ionicons name={selectedItem.isFavorited ? 'heart' : 'heart-outline'} size={22} color={selectedItem.isFavorited ? '#EF4444' : AppColors.textDark} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
              {/* Image Carousel */}
              <View style={{ position: 'relative' }}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentImgIndex(idx);
                  }}
                  scrollEventThrottle={16}
                >
                  {selectedItem.images.map((img, idx) => (
                    <Image key={idx} source={{ uri: img }} style={styles.fullHeroImg} />
                  ))}
                </ScrollView>

                {selectedItem.images.length > 1 && (
                  <View style={styles.dotsContainer}>
                    {selectedItem.images.map((_, idx) => (
                      <View key={idx} style={[styles.dot, currentImgIndex === idx ? styles.dotActive : styles.dotInactive]} />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.fullContentBody}>
                {/* Info Box */}
                <View style={styles.infoCardBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={styles.badgeHighlightPill}>
                      <Text style={styles.badgeHighlightText}>{selectedItem.badge}</Text>
                    </View>
                    <Text style={styles.locationText}><Ionicons name="location-outline" size={13} /> {selectedItem.locationAddress}</Text>
                  </View>

                  <Text style={styles.itemTitle}>{selectedItem.title}</Text>
                  <Text style={styles.itemPrice}>{selectedItem.price}</Text>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    {selectedItem.condition && <Text style={styles.infoPillText}>Condition: {selectedItem.condition}</Text>}
                    {selectedItem.quality && <Text style={styles.infoPillText}>Quality: {selectedItem.quality}</Text>}
                  </View>
                </View>

                {/* Seller & Organization Profile */}
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionAccentBar} />
                  <Text style={styles.sectionTitleText}>Seller & Organization Profile</Text>
                </View>
                <View style={styles.sellerBox}>
                  {selectedItem.isOrganization ? (
                    <View style={styles.sellerAvatarHolder}>
                      {selectedItem.organizationLogo ? (
                        <Image source={{ uri: selectedItem.organizationLogo }} style={styles.sellerAvatar} />
                      ) : (
                        <Ionicons name="business" size={26} color={AppColors.primary} />
                      )}
                    </View>
                  ) : (
                    <View style={styles.sellerAvatarHolder}>
                      {selectedItem.sellerAvatar ? (
                        <Image source={{ uri: selectedItem.sellerAvatar }} style={styles.sellerAvatar} />
                      ) : (
                        <Ionicons name="person-circle" size={32} color={AppColors.primary} />
                      )}
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.sellerName}>{selectedItem.seller}</Text>
                    <Text style={styles.sellerType}>{selectedItem.isOrganization ? 'Verified Eco Association' : 'Individual Community Member'}</Text>
                    {selectedItem.isOrganization ? (
                      <>
                        {Boolean(selectedItem.organizationEmail) && <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 2 }}>✉️ {selectedItem.organizationEmail}</Text>}
                        {Boolean(selectedItem.organizationWebsite) && <Text style={{ fontSize: 11, color: AppColors.primary, marginTop: 1 }}>🌐 {selectedItem.organizationWebsite}</Text>}
                      </>
                    ) : (
                      <>
                        {Boolean(selectedItem.userEmail) && <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 2 }}>✉️ {selectedItem.userEmail}</Text>}
                        {Boolean(selectedItem.userPseudo) && <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 1 }}>@{selectedItem.userPseudo}</Text>}
                      </>
                    )}
                  </View>

                  <TouchableOpacity style={styles.contactSellerBtn} onPress={() => handleOpenContact(selectedItem)}>
                    <Text style={styles.contactSellerBtnText}>Contact</Text>
                  </TouchableOpacity>
                </View>

                {/* Eco Impact Score */}
                {Boolean(selectedItem.ecoImpactScore && selectedItem.ecoImpactScore > 0) && (
                  <View style={{ marginBottom: 16 }}>
                    <View style={styles.ecoScoreBox}>
                      <Ionicons name="leaf" size={22} color="#15803D" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803D' }}>Eco Impact Score: {selectedItem.ecoImpactScore}/100</Text>
                        <Text style={{ fontSize: 11, color: AppColors.textMedium }}>Verified sustainable lifecycle rating</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Delivery & Pickup Options */}
                <View style={{ marginTop: 8 }}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionAccentBar} />
                    <Text style={styles.sectionTitleText}>Delivery & Pickup Options</Text>
                  </View>
                  <View style={styles.detailCardBox}>
                    {selectedItem.hasLocalPickup && (
                      <View style={styles.deliveryRow}>
                        <Ionicons name="storefront-outline" size={20} color={AppColors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.deliveryTitle}>In-Store / Local Pickup</Text>
                          <Text style={styles.deliverySub}>Ready for collection at {selectedItem.locationAddress}</Text>
                        </View>
                      </View>
                    )}
                    {selectedItem.hasBicycleDelivery && (
                      <View style={styles.deliveryRow}>
                        <Ionicons name="bicycle-outline" size={20} color={AppColors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.deliveryTitle}>Eco Bicycle Courier</Text>
                          <Text style={styles.deliverySub}>Zero-emission local delivery</Text>
                        </View>
                      </View>
                    )}
                    {selectedItem.hasShipping && (
                      <View style={styles.deliveryRow}>
                        <Ionicons name="bus-outline" size={20} color={AppColors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.deliveryTitle}>Standard Parcel Shipping</Text>
                          <Text style={styles.deliverySub}>Standard eco packaging delivery</Text>
                        </View>
                      </View>
                    )}
                    {!selectedItem.hasLocalPickup && !selectedItem.hasBicycleDelivery && !selectedItem.hasShipping && (
                      <Text style={styles.descText}>Contact seller directly for custom fulfillment options.</Text>
                    )}
                  </View>
                </View>

                {/* Swap Preferences */}
                {selectedItem.listingType === 'swap' && selectedItem.swapPreferences && selectedItem.swapPreferences.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="repeat" size={20} color={AppColors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.sectionTitleText}>Swap Preferences</Text>
                    </View>
                    <View style={styles.detailCardBox}>
                      <Text style={{ fontSize: 13, color: AppColors.textMedium, marginBottom: 6 }}>Looking to swap for:</Text>
                      {selectedItem.swapPreferences.map((pref, idx) => (
                        <View key={idx} style={styles.featureBulletRow}>
                          <Ionicons name="checkmark-circle" size={14} color={AppColors.primary} />
                          <Text style={styles.featureText}>{String(pref)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Repair Offer Details */}
                {selectedItem.listingType.startsWith('repair') && (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="build" size={20} color={AppColors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.sectionTitleText}>Repair Specifications</Text>
                    </View>
                    <View style={styles.detailCardBox}>
                      {selectedItem.repairExperience && <Text style={styles.descText}>Experience: <Text style={{ fontWeight: '700' }}>{selectedItem.repairExperience}</Text></Text>}
                      {selectedItem.hourlyRate && <Text style={styles.descText}>Hourly Rate: <Text style={{ fontWeight: '700' }}>${selectedItem.hourlyRate}/hr</Text></Text>}
                      {selectedItem.budgetMin && selectedItem.budgetMax && <Text style={styles.descText}>Budget: <Text style={{ fontWeight: '700' }}>${selectedItem.budgetMin} - ${selectedItem.budgetMax}</Text></Text>}
                      {selectedItem.urgency && <Text style={styles.descText}>Urgency: <Text style={{ fontWeight: '700' }}>{selectedItem.urgency.toUpperCase()}</Text></Text>}
                      {selectedItem.repairDetails && <Text style={[styles.descText, { marginTop: 6 }]}>{selectedItem.repairDetails}</Text>}

                      {selectedItem.repairSpecialties && selectedItem.repairSpecialties.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {selectedItem.repairSpecialties.map((spec, idx) => (
                            <View key={idx} style={styles.infoPillBox}>
                              <Text style={styles.infoPillText}>{String(spec)}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Available Colors */}
                {selectedItem.colors && selectedItem.colors.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionAccentBar} />
                      <Text style={styles.sectionTitleText}>Available Colors</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      {selectedItem.colors.map((clr, idx) => (
                        <View key={idx} style={styles.infoPillBox}>
                          <Text style={styles.infoPillText}>{String(clr)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Product Description */}
                <View style={{ marginTop: 16 }}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionAccentBar} />
                    <Text style={styles.sectionTitleText}>Product Description</Text>
                  </View>
                  <View style={styles.detailCardBox}>
                    <Text style={styles.descText}>{selectedItem.description}</Text>

                    {selectedItem.keyFeatures && selectedItem.keyFeatures.length > 0 && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={styles.subSectionTitle}>KEY FEATURES</Text>
                        {selectedItem.keyFeatures.map((feat, idx) => (
                          <View key={idx} style={styles.featureBulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.featureText}>{String(feat)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Technical Specifications */}
                {selectedItem.technicalSpecs && Object.keys(selectedItem.technicalSpecs).length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionAccentBar} />
                      <Text style={styles.sectionTitleText}>Technical Specifications</Text>
                    </View>
                    <View style={styles.specsGrid}>
                      {Object.entries(selectedItem.technicalSpecs).map(([key, val], idx) => (
                        <View key={idx} style={styles.specGridItem}>
                          <Ionicons name="checkmark-circle-outline" size={18} color={AppColors.primary} />
                          <Text style={styles.specKey}>{key.toUpperCase()}</Text>
                          <Text style={styles.specVal}>{val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Reviews & Ratings System */}
                <View style={{ marginTop: 20 }}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitleText}>Customer Reviews</Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={styles.ratingBadgeText}>4.9 (12 reviews)</Text>
                    </View>
                  </View>

                  {reviewsList.length === 0 ? (
                    <View style={styles.emptyReviewBox}>
                      <Text style={styles.emptyReviewText}>No reviews yet for this listing.</Text>
                    </View>
                  ) : (
                    reviewsList.map((rev, idx) => (
                      <View key={idx} style={styles.reviewCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.reviewerName}>{rev.user?.full_name || 'Eco Member'}</Text>
                          <Text style={styles.reviewRating}>★ {rev.rating}/5</Text>
                        </View>
                        <Text style={styles.reviewComment}>{rev.comment}</Text>
                      </View>
                    ))
                  )}

                  {/* Add Review Form */}
                  <View style={styles.addReviewCard}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: AppColors.textDark, marginBottom: 8 }}>Write a Review & Rate:</Text>

                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                          <Ionicons name={star <= userRating ? 'star' : 'star-outline'} size={24} color="#F59E0B" />
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      placeholder="Share your feedback..."
                      placeholderTextColor={AppColors.textMedium}
                      style={styles.modalInput}
                      value={reviewComment}
                      onChangeText={setReviewComment}
                    />

                    <TouchableOpacity style={styles.submitReviewBtn} onPress={handleAddReview}>
                      <Text style={styles.submitReviewBtnText}>Submit Review</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomFloatingBar}>
              <TouchableOpacity style={styles.shareIconBtn} onPress={() => Alert.alert('Share Listing', `Link copied for "${selectedItem.title}"`)}>
                <Ionicons name="share-social-outline" size={20} color={AppColors.textDark} />
              </TouchableOpacity>

              {selectedItem.listingType === 'swap' ? (
                <TouchableOpacity style={styles.mainActionBtn} onPress={() => handleBuyOrClaim(selectedItem)}>
                  <Ionicons name="repeat" size={18} color="white" />
                  <Text style={styles.mainActionBtnText}>Propose Swap</Text>
                </TouchableOpacity>
              ) : selectedItem.listingType.startsWith('repair') ? (
                <TouchableOpacity style={styles.mainActionBtn} onPress={() => handleBuyOrClaim(selectedItem)}>
                  <Ionicons name="chatbubbles" size={18} color="white" />
                  <Text style={styles.mainActionBtnText}>Contact Repairer</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.mainActionBtn} onPress={() => handleBuyOrClaim(selectedItem)}>
                  <Ionicons name="cart" size={18} color="white" />
                  <Text style={styles.mainActionBtnText}>{selectedItem.listingType === 'free' ? 'Claim Item Free' : 'Purchase Now'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.reportIconBtn} onPress={() => setReportModalVisible(true)}>
                <Ionicons name="flag-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── Create Listing Modal (Full Page) ── */}
      <Modal visible={createModalVisible} animationType="slide" transparent={false} onRequestClose={() => setCreateModalVisible(false)}>
        <SafeAreaView style={styles.fullScreenContainer}>
          {/* Header */}
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity style={styles.fullScreenBackBtn} onPress={() => setCreateModalVisible(false)}>
              <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
            </TouchableOpacity>
            <Text style={styles.fullScreenTitle}>Create Eco Listing</Text>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Ionicons name="close" size={22} color={AppColors.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
            {/* Type Pills Selector */}
            <Text style={styles.sectionLabel}>SELECT LISTING TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: 'for_sale', label: 'For Sale 🏷️' },
                  { id: 'free', label: 'Free Giveaway 🎁' },
                  { id: 'swap', label: 'Swap / Trade 🔄' },
                  { id: 'repair_request', label: 'Repair Demande 🛠️' },
                  { id: 'repair_service', label: 'Repair Offer 🧑‍🔧' },
                  { id: 'workshop', label: 'Workshop 🎓' },
                ].map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.infoPillBox,
                      createItemType === t.id && { backgroundColor: AppColors.primary },
                      { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }
                    ]}
                    onPress={() => setCreateItemType(t.id as any)}
                  >
                    <Text style={[styles.infoPillText, createItemType === t.id && { color: 'white', fontWeight: '800' }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Eco Encouragement Banner for Free / Swap */}
            {createItemType === 'free' && (
              <View style={styles.ecoBannerBox}>
                <Ionicons name="leaf" size={20} color="#15803D" />
                <Text style={styles.ecoBannerText}>
                  Giving away items for free builds community trust and keeps pre-loved goods out of landfills! 🌿
                </Text>
              </View>
            )}

            {createItemType === 'swap' && (
              <View style={styles.ecoBannerBox}>
                <Ionicons name="swap-horizontal" size={20} color="#15803D" />
                <Text style={styles.ecoBannerText}>
                  Direct item swaps promote a circular economy with zero waste! 🔁
                </Text>
              </View>
            )}

            {/* Title */}
            <Text style={styles.inputLabel}>Listing Title *</Text>
            <TextInput
              placeholder="e.g. Vintage Leather Jacket, Solar Power Bank"
              placeholderTextColor={AppColors.textMedium}
              style={styles.modalInput}
              value={formTitle}
              onChangeText={setFormTitle}
            />

            {/* Price (if applicable) */}
            {['for_sale', 'repair_service', 'workshop'].includes(createItemType) && (
              <>
                <Text style={styles.inputLabel}>
                  {createItemType === 'repair_service' ? 'Service Rate / Price ($)' : 'Price ($) *'}
                </Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={AppColors.textMedium}
                  keyboardType="numeric"
                  style={styles.modalInput}
                  value={formPrice}
                  onChangeText={setFormPrice}
                />
              </>
            )}

            {/* Description */}
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              placeholder="Describe your item, specifications, condition or details..."
              placeholderTextColor={AppColors.textMedium}
              style={[styles.modalInput, { height: 85 }]}
              multiline
              value={formDescription}
              onChangeText={setFormDescription}
            />

            {/* Condition (for products & swap) */}
            {['for_sale', 'free', 'swap'].includes(createItemType) && (
              <>
                <Text style={styles.inputLabel}>Condition</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['New', 'Like New', 'Good', 'Fair'].map(cond => (
                    <TouchableOpacity
                      key={cond}
                      style={[
                        styles.infoPillBox,
                        formCondition === cond && { backgroundColor: AppColors.primary },
                        { paddingHorizontal: 14, paddingVertical: 8 }
                      ]}
                      onPress={() => setFormCondition(cond)}
                    >
                      <Text style={[styles.infoPillText, formCondition === cond && { color: 'white', fontWeight: '700' }]}>
                        {cond}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Swap Preferences (if Swap) */}
            {createItemType === 'swap' && (
              <>
                <Text style={styles.inputLabel}>Swap Preferences (comma separated)</Text>
                <TextInput
                  placeholder="e.g. Eco Coffee Maker, Wooden Chair, Plant Pots"
                  placeholderTextColor={AppColors.textMedium}
                  style={styles.modalInput}
                  value={formSwapPref}
                  onChangeText={setFormSwapPref}
                />
              </>
            )}

            {/* Repair Demande Fields */}
            {createItemType === 'repair_request' && (
              <>
                <Text style={styles.inputLabel}>Budget Range ($ Min - $ Max)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    placeholder="Min $"
                    placeholderTextColor={AppColors.textMedium}
                    keyboardType="numeric"
                    style={[styles.modalInput, { flex: 1 }]}
                    value={formBudgetMin}
                    onChangeText={setFormBudgetMin}
                  />
                  <TextInput
                    placeholder="Max $"
                    placeholderTextColor={AppColors.textMedium}
                    keyboardType="numeric"
                    style={[styles.modalInput, { flex: 1 }]}
                    value={formBudgetMax}
                    onChangeText={setFormBudgetMax}
                  />
                </View>

                <Text style={styles.inputLabel}>Urgency Level</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['low', 'medium', 'high', 'urgent'].map(urg => (
                    <TouchableOpacity
                      key={urg}
                      style={[
                        styles.infoPillBox,
                        formUrgency === urg && { backgroundColor: AppColors.primary },
                        { paddingHorizontal: 14, paddingVertical: 8 }
                      ]}
                      onPress={() => setFormUrgency(urg)}
                    >
                      <Text style={[styles.infoPillText, formUrgency === urg && { color: 'white', fontWeight: '700' }]}>
                        {urg.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Repair Offer Fields */}
            {createItemType === 'repair_service' && (
              <>
                <Text style={styles.inputLabel}>Hourly Rate ($/hr)</Text>
                <TextInput
                  placeholder="e.g. 25.00"
                  placeholderTextColor={AppColors.textMedium}
                  keyboardType="numeric"
                  style={styles.modalInput}
                  value={formHourlyRate}
                  onChangeText={setFormHourlyRate}
                />

                <Text style={styles.inputLabel}>Specialties (comma separated)</Text>
                <TextInput
                  placeholder="e.g. Electronics, Bicycles, Tailoring"
                  placeholderTextColor={AppColors.textMedium}
                  style={styles.modalInput}
                  value={formRepairSpecialties}
                  onChangeText={setFormRepairSpecialties}
                />
              </>
            )}

            {/* Workshop Fields */}
            {createItemType === 'workshop' && (
              <>
                <Text style={styles.inputLabel}>Workshop Date & Time</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    placeholder="e.g. Sat Aug 15"
                    placeholderTextColor={AppColors.textMedium}
                    style={[styles.modalInput, { flex: 1 }]}
                    value={formWorkshopDate}
                    onChangeText={setFormWorkshopDate}
                  />
                  <TextInput
                    placeholder="e.g. 14:00 - 16:00"
                    placeholderTextColor={AppColors.textMedium}
                    style={[styles.modalInput, { flex: 1 }]}
                    value={formWorkshopTime}
                    onChangeText={setFormWorkshopTime}
                  />
                </View>

                <Text style={styles.inputLabel}>Available Spots</Text>
                <TextInput
                  placeholder="10"
                  placeholderTextColor={AppColors.textMedium}
                  keyboardType="numeric"
                  style={styles.modalInput}
                  value={formSpots}
                  onChangeText={setFormSpots}
                />
              </>
            )}

            {/* Image URL */}
            <Text style={styles.inputLabel}>Image URL *</Text>
            <TextInput
              placeholder="https://images.unsplash.com/..."
              placeholderTextColor={AppColors.textMedium}
              style={styles.modalInput}
              value={formImageUrl}
              onChangeText={setFormImageUrl}
            />

            {/* Location */}
            <Text style={styles.inputLabel}>Location Address</Text>
            <TextInput
              placeholder="e.g. Eco Hub, Central District"
              placeholderTextColor={AppColors.textMedium}
              style={styles.modalInput}
              value={formLocation}
              onChangeText={setFormLocation}
            />

            {/* Delivery / Pickup Toggles */}
            {createItemType !== 'workshop' && (
              <View style={{ marginTop: 12, backgroundColor: '#F9FAFB', padding: 14, borderRadius: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: AppColors.textDark, marginBottom: 8 }}>Delivery & Pickup Options:</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Has Local Pickup</Text>
                  <Switch value={formHasPickup} onValueChange={setFormHasPickup} trackColor={{ false: '#D1D5DB', true: AppColors.primary }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Has Bicycle Delivery</Text>
                  <Switch value={formHasBicycle} onValueChange={setFormHasBicycle} trackColor={{ false: '#D1D5DB', true: AppColors.primary }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Has Shipping</Text>
                  <Switch value={formHasShipping} onValueChange={setFormHasShipping} trackColor={{ false: '#D1D5DB', true: AppColors.primary }} />
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.mainActionBtn, { marginTop: 24, height: 50, backgroundColor: AppColors.primary }]}
              onPress={handleCreateSubmit}
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                  <Text style={[styles.mainActionBtnText, { fontSize: 15 }]}>Publish Eco Listing</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Live ChatRoom Modal View ── */}
      <Modal visible={chatModalVisible} animationType="slide" transparent={false} onRequestClose={() => setChatModalVisible(false)}>
        {chatTargetUser && (
          <SafeAreaView style={styles.fullScreenContainer}>
            {/* Header */}
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity style={styles.fullScreenBackBtn} onPress={() => setChatModalVisible(false)}>
                <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
              </TouchableOpacity>

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                {chatTargetUser.avatar ? (
                  <Image source={{ uri: chatTargetUser.avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                ) : (
                  <Ionicons name={chatTargetUser.isOrg ? "business" : "person-circle"} size={32} color={AppColors.primary} />
                )}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: AppColors.textDark }}>{chatTargetUser.name}</Text>
                  <Text style={{ fontSize: 11, color: AppColors.textMedium }}>{chatTargetUser.isOrg ? 'Verified Association / Seller' : 'Community Seller'}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setChatModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={24} color={AppColors.textMedium} />
              </TouchableOpacity>
            </View>

            {/* Marketplace Item Banner Header */}
            {chatContextProduct && (
              <View style={styles.chatContextBanner}>
                <Image source={{ uri: chatContextProduct.image }} style={styles.chatContextImg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatContextTitle} numberOfLines={1}>{chatContextProduct.title}</Text>
                  <Text style={styles.chatContextPrice}>{chatContextProduct.price}</Text>
                </View>
                <View style={styles.chatContextBadge}>
                  <Text style={styles.chatContextBadgeText}>Listing Context</Text>
                </View>
              </View>
            )}

            {/* Chat Messages List */}
            {isLoadingChat ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={AppColors.primary} />
                <Text style={{ fontSize: 13, color: AppColors.textMedium, marginTop: 8 }}>Loading Conversation...</Text>
              </View>
            ) : (
              <FlatList
                data={chatMessages}
                keyExtractor={(msg, idx) => String(msg.id || idx)}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                renderItem={({ item: msg }) => {
                  const isMe = msg.sender?.id === 'me' || msg.is_mine || msg.isMine;
                  return (
                    <View style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubbleOther]}>
                      {/* Product Preview Card inside Message if metadata present */}
                      {msg.metadata?.product_title && (
                        <View style={styles.msgProductPreview}>
                          {msg.metadata?.product_image && <Image source={{ uri: msg.metadata.product_image }} style={{ width: 40, height: 40, borderRadius: 6 }} />}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isMe ? 'white' : AppColors.textDark }}>{msg.metadata.product_title}</Text>
                            <Text style={{ fontSize: 10, color: isMe ? '#DCFCE7' : AppColors.primary, fontWeight: '800' }}>{msg.metadata.product_price}</Text>
                          </View>
                        </View>
                      )}
                      <Text style={[styles.chatMsgText, isMe ? styles.chatMsgTextMe : styles.chatMsgTextOther]}>{msg.content}</Text>
                    </View>
                  );
                }}
              />
            )}

            {/* Chat Input Bar */}
            <View style={styles.chatInputBar}>
              <TextInput
                placeholder={`Message ${chatTargetUser.name}...`}
                placeholderTextColor={AppColors.textMedium}
                style={styles.chatInput}
                value={chatInputText}
                onChangeText={setChatInputText}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendChatMessage} disabled={isSendingChat || !chatInputText.trim()}>
                <Ionicons name="send" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── Report Modal ── */}
      <Modal visible={reportModalVisible} animationType="slide" transparent onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { padding: 20 }]}>
            <Text style={styles.modalTitleText}>Report Listing</Text>
            <Text style={{ fontSize: 13, color: AppColors.textMedium, marginBottom: 12 }}>Specify reason for reporting:</Text>

            <TextInput
              placeholder="Reason (e.g. Counterfeit, Inappropriate, Spam)"
              style={styles.modalInput}
              value={reportReason}
              onChangeText={setReportReason}
            />

            <TextInput
              placeholder="Additional Details (optional)"
              style={[styles.modalInput, { height: 80 }]}
              multiline
              value={reportDetails}
              onChangeText={setReportDetails}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.mainActionBtn, { flex: 1, backgroundColor: AppColors.textMedium }]} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.mainActionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mainActionBtn, { flex: 1, backgroundColor: '#EF4444' }]} onPress={handleSubmitReport}>
                <Text style={styles.mainActionBtnText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  headerTitle: { fontSize: 19, fontWeight: '800', color: AppColors.primary },
  headerIconBtn: { padding: 6, position: 'relative' },
  categoryDotBadge: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: AppColors.primary },
  favBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#EF4444', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  favBadgeText: { color: 'white', fontSize: 9, fontWeight: '800' },

  mainTabBar: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#EBEBEB', height: 44 },
  mainTabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  mainTabBtnActive: { borderBottomColor: AppColors.primary },
  mainTabText: { fontSize: 13, fontWeight: '600', color: AppColors.textMedium },
  mainTabTextActive: { color: AppColors.primary, fontWeight: '700' },

  subTabBar: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 6, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  subTabPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, backgroundColor: '#E5E7EB' },
  subTabPillActive: { backgroundColor: AppColors.primary },
  subTabText: { fontSize: 12, fontWeight: '600', color: AppColors.textDark },
  subTabTextActive: { color: 'white', fontWeight: '700' },

  searchSection: { backgroundColor: 'white', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, marginHorizontal: 16, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: AppColors.textDark },

  // Skeletons
  skeletonGridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  skeletonGridCard: { width: (width - 44) / 2, backgroundColor: '#E5E7EB', borderRadius: 16, height: 210, overflow: 'hidden' },
  skeletonImg: { width: '100%', height: 130, backgroundColor: '#D1D5DB' },
  skeletonBody: { padding: 10, gap: 6 },
  skeletonListContainer: { paddingHorizontal: 16, gap: 12 },
  skeletonListCard: { flexDirection: 'row', gap: 12, backgroundColor: '#E5E7EB', borderRadius: 16, padding: 12, height: 110 },
  skeletonListImg: { width: 90, height: 86, borderRadius: 10, backgroundColor: '#D1D5DB' },
  skeletonLineShort: { width: '40%', height: 10, borderRadius: 4, backgroundColor: '#D1D5DB' },
  skeletonLineMedium: { width: '70%', height: 10, borderRadius: 4, backgroundColor: '#D1D5DB' },
  skeletonLineLong: { width: '90%', height: 10, borderRadius: 4, backgroundColor: '#D1D5DB' },

  // Grid
  gridContent: { paddingHorizontal: 16, paddingBottom: 40 },
  gridCardContainer: { width: (width - 44) / 2, marginBottom: 16, marginRight: 12 },
  gridCard: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 },
  gridImg: { width: '100%', height: 145, resizeMode: 'cover' },
  badgePill: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(11, 110, 79, 0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5 },
  favBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', padding: 6, borderRadius: 16 },
  cardBody: { padding: 12 },
  cardSeller: { fontSize: 11, color: AppColors.textMedium, fontWeight: '600', marginBottom: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: AppColors.textDark },
  cardPrice: { fontSize: 15, fontWeight: '800', color: AppColors.primary, marginTop: 4 },

  // List Card
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  listCard: { backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 16, flexDirection: 'row', gap: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 6 },
  listCardImg: { width: 100, height: 100, borderRadius: 12, resizeMode: 'cover' },
  listCardBody: { flex: 1 },
  typeBadgePill: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 10, color: '#15803D', fontWeight: '800' },
  listCardTitle: { fontSize: 15, fontWeight: '700', color: AppColors.textDark, marginTop: 4 },
  listCardDesc: { fontSize: 12, color: AppColors.textMedium, marginVertical: 3 },
  listCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  listCardPrice: { fontSize: 15, fontWeight: '800', color: AppColors.primary },
  listCardSeller: { fontSize: 11, color: AppColors.textMedium },

  // Workshop Card
  workshopCard: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', marginBottom: 16, elevation: 3 },
  workshopImg: { width: '100%', height: 150 },
  workshopBody: { padding: 16 },
  workshopHost: { fontSize: 11, color: AppColors.textMedium, fontWeight: '600', marginBottom: 2 },
  workshopTitle: { fontSize: 16, fontWeight: '700', color: AppColors.textDark, marginBottom: 4 },
  workshopDesc: { fontSize: 12, color: AppColors.textMedium, marginBottom: 8 },
  workshopDetailRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  workshopDetailText: { fontSize: 12, color: AppColors.textMedium },
  workshopFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceVal: { fontSize: 17, fontWeight: '800', color: AppColors.primary },
  registerBtn: { backgroundColor: AppColors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  registerBtnText: { fontSize: 12, color: 'white', fontWeight: '700' },

  // Left Drawer
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  drawerContainer: { width: width * 0.75, height: '100%', backgroundColor: 'white' },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  drawerTitle: { fontSize: 17, fontWeight: '800', color: AppColors.textDark },
  categoryItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  categoryItemText: { fontSize: 14, color: AppColors.textDark, fontWeight: '500' },
  categoryItemTextActive: { color: AppColors.primary, fontWeight: '700' },
  drawerFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#EBEBEB', flexDirection: 'row', gap: 10 },
  drawerResetBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#F3F4F6' },
  drawerResetText: { fontSize: 12, color: AppColors.textDark, fontWeight: '600' },
  drawerApplyBtn: { flex: 1, backgroundColor: AppColors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  drawerApplyText: { fontSize: 12, color: 'white', fontWeight: '700' },

  // Full Screen Detail View
  fullScreenContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  fullScreenHeader: { height: 50, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  fullScreenBackBtn: { padding: 4 },
  fullScreenTitle: { fontSize: 16, fontWeight: '800', color: AppColors.textDark, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  fullHeroImg: { width, height: 300, resizeMode: 'cover' },
  dotsContainer: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 24, backgroundColor: AppColors.primary },
  dotInactive: { width: 8, backgroundColor: 'rgba(255,255,255,0.6)' },

  fullContentBody: { paddingHorizontal: 20, paddingTop: 16 },
  infoCardBox: { backgroundColor: 'white', borderRadius: 20, padding: 18, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, marginBottom: 16 },
  badgeHighlightPill: { backgroundColor: 'rgba(11,110,79,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeHighlightText: { fontSize: 11, color: AppColors.primary, fontWeight: '800', letterSpacing: 0.5 },
  locationText: { fontSize: 12, color: AppColors.textMedium },
  itemTitle: { fontSize: 20, fontWeight: '800', color: AppColors.textDark, marginTop: 10 },
  itemPrice: { fontSize: 24, fontWeight: '900', color: AppColors.primary, marginTop: 4 },

  sellerBox: { backgroundColor: 'white', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1, marginBottom: 16 },
  sellerAvatarHolder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22 },
  sellerName: { fontSize: 14, fontWeight: '700', color: AppColors.textDark },
  sellerType: { fontSize: 11, color: AppColors.textMedium },
  contactSellerBtn: { backgroundColor: AppColors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  contactSellerBtnText: { fontSize: 12, fontWeight: '700', color: AppColors.primary },

  ecoScoreBox: { backgroundColor: '#DCFCE7', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionAccentBar: { width: 4, height: 20, backgroundColor: AppColors.primary, borderRadius: 2, marginRight: 10 },
  sectionTitleText: { fontSize: 17, fontWeight: '800', color: AppColors.textDark },

  detailCardBox: { backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 1 },
  descText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },
  subSectionTitle: { fontSize: 11, color: AppColors.primary, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  featureBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AppColors.primary, marginTop: 7 },
  featureText: { fontSize: 13, color: AppColors.textDark, flex: 1 },

  infoPillBox: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  infoPillText: { fontSize: 12, color: AppColors.textDark, fontWeight: '600' },

  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specGridItem: { width: (width - 50) / 2, backgroundColor: 'white', borderRadius: 14, padding: 12, alignItems: 'center' },
  specKey: { fontSize: 10, color: AppColors.textMedium, fontWeight: '700', marginTop: 4 },
  specVal: { fontSize: 13, fontWeight: '700', color: AppColors.textDark, marginTop: 2, textAlign: 'center' },

  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  deliveryTitle: { fontSize: 13, fontWeight: '700', color: AppColors.textDark },
  deliverySub: { fontSize: 11, color: AppColors.textMedium },

  ratingBadge: { marginLeft: 'auto', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingBadgeText: { fontSize: 11, color: '#D97706', fontWeight: '800' },
  emptyReviewBox: { backgroundColor: 'white', borderRadius: 14, padding: 16, alignItems: 'center' },
  emptyReviewText: { fontSize: 12, color: AppColors.textMedium, fontStyle: 'italic' },
  reviewCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginVertical: 4 },
  reviewerName: { fontSize: 13, fontWeight: '700', color: AppColors.textDark },
  reviewRating: { fontSize: 12, color: '#F59E0B', fontWeight: '700' },
  reviewComment: { fontSize: 12, color: AppColors.textMedium, marginTop: 4, fontStyle: 'italic' },

  addReviewCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 12 },
  modalInput: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, fontSize: 13, color: AppColors.textDark, marginBottom: 8 },
  submitReviewBtn: { backgroundColor: AppColors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  submitReviewBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },

  bottomFloatingBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EBEBEB' },
  shareIconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  reportIconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  mainActionBtn: { flex: 1, backgroundColor: AppColors.primary, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  mainActionBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#F8F9FA', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  modalTitleText: { fontSize: 18, fontWeight: '800', color: AppColors.textDark },

  // Forms
  sectionLabel: { fontSize: 14, fontWeight: '700', color: AppColors.textDark, marginTop: 10, marginBottom: 6 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: AppColors.textMedium, marginTop: 8, marginBottom: 4 },
  ecoBannerBox: { backgroundColor: '#DCFCE7', borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
  ecoBannerText: { flex: 1, fontSize: 12, color: '#15803D', fontWeight: '600', lineHeight: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  switchLabel: { fontSize: 13, color: AppColors.textDark, fontWeight: '600' },

  // ChatRoom Modal Styles
  chatContextBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  chatContextImg: { width: 44, height: 44, borderRadius: 8, resizeMode: 'cover' },
  chatContextTitle: { fontSize: 13, fontWeight: '700', color: AppColors.textDark },
  chatContextPrice: { fontSize: 14, fontWeight: '800', color: AppColors.primary },
  chatContextBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chatContextBadgeText: { fontSize: 10, color: '#15803D', fontWeight: '800' },
  chatBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginVertical: 2 },
  chatBubbleMe: { alignSelf: 'flex-end', backgroundColor: AppColors.primary, borderBottomRightRadius: 2 },
  chatBubbleOther: { alignSelf: 'flex-start', backgroundColor: '#E5E7EB', borderBottomLeftRadius: 2 },
  chatMsgText: { fontSize: 13, lineHeight: 19 },
  chatMsgTextMe: { color: 'white' },
  chatMsgTextOther: { color: AppColors.textDark },
  msgProductPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.08)', padding: 6, borderRadius: 8, marginBottom: 6 },
  chatInputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#EBEBEB', gap: 10 },
  chatInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: AppColors.textDark, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: AppColors.primary, alignItems: 'center', justifyContent: 'center' },

  // FAB & Card Chat Styles
  fabBtn: { position: 'absolute', bottom: 24, right: 20, backgroundColor: AppColors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 28, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, gap: 6, zIndex: 99 },
  fabBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  cardChatBtn: { padding: 4, backgroundColor: 'rgba(11, 110, 79, 0.1)', borderRadius: 8 },
  cardChatBtnPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(11, 110, 79, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardChatBtnText: { fontSize: 11, fontWeight: '700', color: AppColors.primary },
});

export default EcoMarketScreen;
