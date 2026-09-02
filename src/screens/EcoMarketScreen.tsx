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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { AppColors } from '../theme/colors';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import marketplaceService from '../services/marketplaceService';
import chatService from '../services/chatService';
import { UrlHelper } from '../utils/urlHelper';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const resolveMediaUrl = (url?: string) => {
  if (!url) return '';
  return UrlHelper.convertPathToUrl(url);
};

// â”€â”€ Helpers â”€â”€
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

// â”€â”€ Types â”€â”€
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
  image?: string;
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
  image?: string;
  spotsLeft: number;
  description?: string;
  raw: any;
}

// No mock data - using API only

export const EcoMarketScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { user } = useAuth();

  // Navigation Tabs
  const [activeMainTab, setActiveMainTab] = useState<'products' | 'swap' | 'repair' | 'workshops'>('products');
  const [productSubTab, setProductSubTab] = useState<'for_sale' | 'free'>('for_sale');
  const [repairSubTab, setRepairSubTab] = useState<'repair_request' | 'repair_service'>('repair_request');

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Category Drawer Menu States
  const [categoryDrawerVisible, setCategoryDrawerVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  // Data States
  const [itemsList, setItemsList] = useState<ProductItem[]>([]);
  const [workshopsList, setWorkshopsList] = useState<WorkshopItem[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination states
  const [marketPage, setMarketPage] = useState(1);
  const [hasMoreMarket, setHasMoreMarket] = useState(true);
  const [loadingMoreMarket, setLoadingMoreMarket] = useState(false);

  // Full-Screen Detail View States
  const [selectedItem, setSelectedItem] = useState<ProductItem | null>(null);
  const [fullDetailVisible, setFullDetailVisible] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  // Deep-link / route param listener for opening product detail directly from chat metadata
  useEffect(() => {
    const targetProductId = route?.params?.productId || route?.params?.params?.productId;
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
            const orgLogo = p.organizationLogo || p.organization_logo || (p.organization ? p.organization.logoUrl : null);
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
              isOrganization: isOrg,
              organizationId: p.organization?.id || p.organization_id || p.organizationId,
              organizationName: orgName,
              organizationLogo: orgLogo ? resolveMediaUrl(orgLogo) : undefined,
              image: primaryImg,
              images: rawImgs.length > 0 ? rawImgs : [primaryImg],
              badge: p.condition || 'VERIFIED ECO',
              description: p.description || '',
              quality: p.quality?.name || 'Verified Eco',
              condition: p.condition || 'Good Condition',
              status: p.status || 'active',
              listingType: (p.listingType || p.listing_type || 'for_sale') as any,
              locationAddress: p.locationAddress || p.location_address || 'Eco Hub',
              hasLocalPickup: Boolean(p.hasLocalPickup ?? p.has_local_pickup),
              hasBicycleDelivery: Boolean(p.hasBicycleDelivery ?? p.has_bicycle_delivery),
              hasShipping: Boolean(p.hasShipping ?? p.has_shipping),
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
  }, [route?.params?.productId, route?.params?.params?.productId]);

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
          const primaryImg = rawImgs[0] ? resolveMediaUrl(rawImgs[0]) : (p.imageUrl || p.image || p.product_image ? resolveMediaUrl(p.imageUrl || p.image || p.product_image) : undefined);

          const isOrg = Boolean(p.isOrganization || p.is_organization || p.organizationName || p.organization_name || p.organization);
          const orgName = p.organizationName || p.organization_name || (p.organization ? p.organization.name : null);
          const orgLogo = p.organizationLogo || p.organization_logo || (p.organization ? p.organization.logoUrl : null);

          const sellerUserId = p.user_id || p.owner_id || p.user?.id || p.owner?.id || p.userId;
          const ownerFullName = p.owner_full_name || p.ownerFullName || (p.owner ? (p.owner.full_name || p.owner.fullName) : (p.user ? (p.user.full_name || p.user.fullName) : p.user_name));
          const ownerPseudo = p.owner_pseudo || p.ownerPseudo || (p.owner ? p.owner.pseudo : (p.user ? p.user.pseudo : p.user_pseudo));
          const ownerEmail = p.owner_email || p.ownerEmail || (p.owner ? p.owner.email : (p.user ? p.user.email : p.user_email));
          const ownerAvatar = p.owner?.avatarUrl || p.owner?.avatar || p.user?.avatarUrl || p.user?.avatar;

          const ownerDisplayName = ownerFullName || ownerPseudo || ownerEmail || (sellerUserId ? `User #${sellerUserId}` : 'Community Member');
          const sellerDisplayName = isOrg ? (orgName || ownerDisplayName) : ownerDisplayName;

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
            seller: sellerDisplayName,
            sellerAvatar: ownerAvatar ? resolveMediaUrl(ownerAvatar) : undefined,
            userId: sellerUserId,
            organizationId: p.organization?.id || p.organization_id,
            isOrganization: isOrg,
            organizationName: orgName,
            organizationLogo: orgLogo,
            image: primaryImg,
            images: rawImgs.length > 0 ? rawImgs.map(resolveMediaUrl) : (primaryImg ? [primaryImg] : []),
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
        setAllFavoriteItems([]);
      }
    } catch (e) {
      console.log('Error loading favorites:', e);
      setAllFavoriteItems([]);
    } finally {
      setIsLoadingFavorites(false);
    }
  };

  // Create Item Modal States
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createItemType, setCreateItemType] = useState<'for_sale' | 'free' | 'swap' | 'repair_request' | 'repair_service' | 'workshop'>('for_sale');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formAllowComments, setFormAllowComments] = useState(true);
  const [formAllowReviews, setFormAllowReviews] = useState(true);
  const [formReviewsRestriction, setFormReviewsRestriction] = useState<'anyone' | 'buyers'>('anyone');

  // Form Input States
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCondition, setFormCondition] = useState('used'); // 'new', 'used', 'refurbished'
  const [formLocation, setFormLocation] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSwapPref, setFormSwapPref] = useState('');
  const [formRepairSpecialties, setFormRepairSpecialties] = useState('');
  const [formHourlyRate, setFormHourlyRate] = useState('');
  const [formExperience, setFormExperience] = useState('');
  const [formUrgency, setFormUrgency] = useState('medium'); // 'low', 'medium', 'high', 'urgent'
  const [formBudgetMin, setFormBudgetMin] = useState('');
  const [formBudgetMax, setFormBudgetMax] = useState('');
  const [formWorkshopDate, setFormWorkshopDate] = useState('');
  const [formWorkshopTime, setFormWorkshopTime] = useState('');
  const [formSpots, setFormSpots] = useState('10');
  const [formHasPickup, setFormHasPickup] = useState(true);
  const [formHasBicycle, setFormHasBicycle] = useState(true);
  const [formHasShipping, setFormHasShipping] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // New Product fields mapping to database Product entity
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formSustainabilityCommitment, setFormSustainabilityCommitment] = useState('');
  const [formStoryOfChange, setFormStoryOfChange] = useState('');
  const [formCommunityImpact, setFormCommunityImpact] = useState('');
  const [formEcoImpactScore, setFormEcoImpactScore] = useState('0');
  const [formServiceAreaName, setFormServiceAreaName] = useState('');
  const [formIsProfessional, setFormIsProfessional] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState<string | number>('');

  // Lists/arrays states
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [formKeyFeatures, setFormKeyFeatures] = useState<string[]>([]);
  const [keyFeatureInput, setKeyFeatureInput] = useState('');

  const [formCareInstructions, setFormCareInstructions] = useState<string[]>([]);
  const [careInstructionInput, setCareInstructionInput] = useState('');

  const [formSwapItemsList, setFormSwapItemsList] = useState<string[]>([]);
  const [swapItemInput, setSwapItemInput] = useState('');

  const [formSwapPreferencesList, setFormSwapPreferencesList] = useState<string[]>([]);
  const [swapPreferenceInput, setSwapPreferenceInput] = useState('');

  const [formColorsList, setFormColorsList] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');

  // Tag add/remove helpers
  const addTag = (text: string) => {
    const val = text.trim();
    if (val && !formTags.includes(val)) {
      setFormTags(prev => [...prev, val]);
      setTagInput('');
    }
  };
  const removeTag = (val: string) => {
    setFormTags(prev => prev.filter(t => t !== val));
  };

  const addKeyFeature = (text: string) => {
    const val = text.trim();
    if (val && !formKeyFeatures.includes(val)) {
      setFormKeyFeatures(prev => [...prev, val]);
      setKeyFeatureInput('');
    }
  };
  const removeKeyFeature = (val: string) => {
    setFormKeyFeatures(prev => prev.filter(f => f !== val));
  };

  const addCareInstruction = (text: string) => {
    const val = text.trim();
    if (val && !formCareInstructions.includes(val)) {
      setFormCareInstructions(prev => [...prev, val]);
      setCareInstructionInput('');
    }
  };
  const removeCareInstruction = (val: string) => {
    setFormCareInstructions(prev => prev.filter(c => c !== val));
  };

  const addSwapItem = (text: string) => {
    const val = text.trim();
    if (val && !formSwapItemsList.includes(val)) {
      setFormSwapItemsList(prev => [...prev, val]);
      setSwapItemInput('');
    }
  };
  const removeSwapItem = (val: string) => {
    setFormSwapItemsList(prev => prev.filter(i => i !== val));
  };

  const addSwapPreference = (text: string) => {
    const val = text.trim();
    if (val && !formSwapPreferencesList.includes(val)) {
      setFormSwapPreferencesList(prev => [...prev, val]);
      setSwapPreferenceInput('');
    }
  };
  const removeSwapPreference = (val: string) => {
    setFormSwapPreferencesList(prev => prev.filter(p => p !== val));
  };

  const addColor = (text: string) => {
    const val = text.trim();
    if (val && !formColorsList.includes(val)) {
      setFormColorsList(prev => [...prev, val]);
      setColorInput('');
    }
  };
  const removeColor = (val: string) => {
    setFormColorsList(prev => prev.filter(c => c !== val));
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormPrice('');
    setFormDescription('');
    setFormImageUrl('');
    setFormSwapPref('');
    setFormRepairSpecialties('');
    setFormHourlyRate('');
    setFormExperience('');
    setFormUrgency('medium');
    setFormBudgetMin('');
    setFormBudgetMax('');
    setFormWorkshopDate('');
    setFormWorkshopTime('');
    setFormSpots('10');
    setFormHasPickup(true);
    setFormHasBicycle(true);
    setFormHasShipping(false);
    setFormBrand('');
    setFormModel('');
    setFormSustainabilityCommitment('');
    setFormStoryOfChange('');
    setFormCommunityImpact('');
    setFormEcoImpactScore('0');
    setFormServiceAreaName('');
    setFormIsProfessional(false);
    setFormCategoryId('');
    setFormTags([]);
    setFormKeyFeatures([]);
    setFormCareInstructions([]);
    setFormSwapItemsList([]);
    setFormSwapPreferencesList([]);
    setFormColorsList([]);
    setFormAllowComments(true);
    setFormAllowReviews(true);
    setFormReviewsRestriction('buyers');
  };

  const populateFormForEdit = (item: any) => {
    setEditingItem(item);
    setCreateItemType(item.listingType || 'for_sale');
    setFormTitle(item.title || '');
    setFormPrice(item.price ? String(item.price).replace(/[^0-9.]/g, '') : '');
    setFormDescription(item.description || '');
    setFormImageUrl(item.image || '');
    setFormSwapPref(item.swapPreferences?.[0] || '');
    setFormRepairSpecialties(item.repairSpecialties?.join(', ') || '');
    setFormHourlyRate(item.hourlyRate ? String(item.hourlyRate) : '');
    setFormExperience(item.repairExperience || '');
    setFormUrgency(item.urgency || 'medium');
    setFormBudgetMin(item.budgetMin ? String(item.budgetMin) : '');
    setFormBudgetMax(item.budgetMax ? String(item.budgetMax) : '');
    setFormWorkshopDate(item.workshopDate || '');
    setFormWorkshopTime(item.workshopTime || '');
    setFormSpots(item.maxParticipants ? String(item.maxParticipants) : '10');
    setFormHasPickup(item.hasLocalPickup ?? true);
    setFormHasBicycle(item.hasBicycleDelivery ?? true);
    setFormHasShipping(item.hasShipping ?? false);
    setFormBrand(item.brand || '');
    setFormModel(item.model || '');
    setFormSustainabilityCommitment(item.sustainabilityCommitment || '');
    setFormStoryOfChange(item.storyOfChange || '');
    setFormCommunityImpact(item.communityImpact || '');
    setFormEcoImpactScore(item.ecoImpactScore ? String(item.ecoImpactScore) : '0');
    setFormServiceAreaName(item.serviceAreaName || '');
    setFormIsProfessional(item.isProfessional ?? false);
    setFormCategoryId(item.categoryId || '');
    setFormTags(item.tags || []);
    setFormKeyFeatures(item.keyFeatures || []);
    setFormCareInstructions(item.careInstructions || []);
    setFormSwapItemsList(item.swapItems || []);
    setFormSwapPreferencesList(item.swapPreferences || []);
    setFormColorsList(item.colors || []);
    setFormAllowComments(item.allowComments ?? true);
    setFormAllowReviews(item.allowReviews ?? true);
    setFormReviewsRestriction(item.reviewsRestriction || 'buyers');
  };

  const handleDeleteItem = (item: ProductItem) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to permanently delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await marketplaceService.deleteProduct(item.id);
              Alert.alert('Deleted', 'Your listing has been deleted.');
              setFullDetailVisible(false);
               loadData(true);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete listing.');
            }
          }
        }
      ]
    );
  };

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

  const loadData = async (isReset = false) => {
    const currentPage = isReset ? 1 : marketPage;
    if (isReset) {
      setIsLoadingApi(true);
      setMarketPage(1);
      setHasMoreMarket(true);
    } else {
      if (!hasMoreMarket || loadingMoreMarket) return;
      setLoadingMoreMarket(true);
    }

    try {
      if (activeMainTab === 'workshops') {
        const res = await marketplaceService.getWorkshops();
        if (Array.isArray(res) && res.length > 0) {
          const mapped = res.map((w: any) => ({
            id: w.id,
            title: w.title || 'Eco Workshop',
            host: w.host || w.organizer_name || 'Green Alliance',
            date: w.workshop_date ? new Date(w.workshop_date).toLocaleDateString() : 'Upcoming',
            time: w.time || '10:00 - 12:00',
            price: parseFloat(w.price) === 0 ? 'Free' : `$${w.price}`,
            image: w.image_url ? resolveMediaUrl(w.image_url) : undefined,
            spotsLeft: w.max_participants || 10,
            description: w.description,
            raw: w,
          }));

          if (isReset) {
            setWorkshopsList(mapped);
          } else {
            setWorkshopsList(prev => [...prev, ...mapped]);
          }
          setHasMoreMarket(false); // workshops don't paginate on backend yet, so set hasMoreMarket to false
        } else {
          setWorkshopsList([]);
        }
      } else {
        const listingType = getCurrentListingType();
        const res = await marketplaceService.getProducts({
          listing_type: listingType,
          search: searchQuery || undefined,
          category_id: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          page: currentPage,
          limit: 12,
        });

        const rawArray = res?.products || res?.data || (Array.isArray(res) ? res : []);

        const mapped: ProductItem[] = Array.isArray(rawArray) ? rawArray.map((p: any) => {
          const rawImgs = p.images?.map((i: any) => (typeof i === 'string' ? i : i.url)) || [];
          const primaryImg = rawImgs[0] ? resolveMediaUrl(rawImgs[0]) : (p.imageUrl || p.image || p.product_image ? resolveMediaUrl(p.imageUrl || p.image || p.product_image) : undefined);

          const isOrg = Boolean(p.isOrganization || p.is_organization || p.organizationName || p.organization_name || p.organization);
          const orgName = p.organizationName || p.organization_name || (p.organization ? p.organization.name : null);
          const orgLogo = p.organizationLogo || p.organization_logo || (p.organization ? p.organization.logoUrl : null);
          const orgEmail = p.organizationEmail || p.organization_email || (p.organization ? p.organization.email : null);
          const orgWebsite = p.organizationWebsite || p.organization_website || (p.organization ? p.organization.website : null);

          const sellerUserId = p.user_id || p.owner_id || p.user?.id || p.owner?.id || p.userId;
          const ownerFullName = p.owner_full_name || p.ownerFullName || (p.owner ? (p.owner.full_name || p.owner.fullName) : (p.user ? (p.user.full_name || p.user.fullName) : p.user_name));
          const ownerPseudo = p.owner_pseudo || p.ownerPseudo || (p.owner ? p.owner.pseudo : (p.user ? p.user.pseudo : p.user_pseudo));
          const ownerEmail = p.owner_email || p.ownerEmail || (p.owner ? p.owner.email : (p.user ? p.user.email : p.user_email));
          const ownerAvatar = p.owner?.avatarUrl || p.owner?.avatar || p.user?.avatarUrl || p.user?.avatar;

          const ownerDisplayName = ownerFullName || ownerPseudo || ownerEmail || (sellerUserId ? `User #${sellerUserId}` : 'Community Member');
          const sellerDisplayName = isOrg ? (orgName || ownerDisplayName) : ownerDisplayName;

          return {
            id: p.id,
            title: p.title || p.name || 'Listing Item',
            price: listingType === 'free' ? 'Free' : (p.price ? `$${p.price}` : 'Free'),
            seller: sellerDisplayName,
            sellerAvatar: ownerAvatar ? resolveMediaUrl(ownerAvatar) : undefined,
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
            images: rawImgs.length > 0 ? rawImgs.map(resolveMediaUrl) : (primaryImg ? [primaryImg] : []),
            badge: listingType === 'free' ? 'FREE' : listingType === 'swap' ? 'SWAP' : listingType === 'repair_request' ? 'REPAIR DEMANDE' : listingType === 'repair_service' ? 'REPAIR SERVICE' : 'FOR SALE',
            description: p.description || '',
            quality: p.quality?.name || 'Verified Eco',
            condition: p.condition || 'Good Condition',
            status: p.status || 'active',
            listingType: listingType as any,
            locationAddress: p.locationAddress || p.location_address || 'Eco Hub',
            hasLocalPickup: p.hasLocalPickup ?? p.has_local_pickup ?? false,
            hasBicycleDelivery: p.hasBicycleDelivery ?? p.has_bicycle_delivery ?? false,
            hasShipping: p.hasShipping ?? p.has_shipping ?? false,
            swapPreferences: p.swapPreferences || p.swap_preferences || [],
            swapItems: p.swapItems || p.swap_items || [],
            keyFeatures: p.keyFeatures || p.key_features || [],
            storyOfChange: p.storyOfChange || p.story_of_change,
            communityImpact: p.communityImpact || p.community_impact,
            sustainabilityCommitment: p.sustainabilityCommitment || p.sustainability_commitment,
            careInstructions: p.careInstructions || p.care_instructions || [],
            technicalSpecs: p.technicalSpecifications || p.technical_specifications,
            brand: p.brand,
            model: p.model,
            materials: p.materials,
            colors: p.colors || [],
            ecoImpactScore: p.ecoImpactScore || p.eco_impact_score || 0,
            isProfessional: p.isProfessional || p.is_professional || false,
            serviceAreaName: p.serviceAreaName || p.service_area_name,
            repairSpecialties: p.repairSpecialties || p.repair_specialties || [],
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
            tags: p.tags || [],
            isFavorited: p.is_favorited || p.isFavorited,
            raw: p,
          };
        }) : [];

        if (isReset) {
          setItemsList(mapped);
        } else {
          setItemsList(prev => [...prev, ...mapped]);
        }
        setHasMoreMarket(mapped.length === 12);
      }
    } catch (e) {
      console.log('Error loading data:', e);
    } finally {
      setIsLoadingApi(false);
      setLoadingMoreMarket(false);
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMoreMarket && hasMoreMarket) {
      setMarketPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (marketPage > 1) {
      loadData(false);
    }
  }, [marketPage]);

  // Debounced search query reload
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    scrollY.setValue(0);
    loadData(true);
  }, [activeMainTab, productSubTab, repairSubTab, selectedCategoryIds]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
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
      const errMsg = e?.response?.data?.message || e?.message || 'Failed to submit review.';
      Alert.alert('Error', errMsg);
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

  const pickMarketplaceImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Gallery access is required to select an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      setFormImageUrl(result.assets[0].uri);
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
      Alert.alert('Image Required', 'Please select an image for this item listing.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      if (createItemType === 'workshop') {
        const payloadData = {
          title: formTitle,
          description: formDescription,
          workshop_date: formWorkshopDate || new Date().toISOString().substring(0, 10) + ' 14:00:00',
          time: formWorkshopTime || '10:00 - 12:00',
          price: formPrice || '0.00',
          max_participants: parseInt(formSpots, 10) || 10,
        };
        if (editingItem) {
          // If editing workshop
          await marketplaceService.updateProduct(editingItem.id, payloadData);
        } else {
          await marketplaceService.createWorkshop(payloadData, formImageUrl);
        }
      } else {
        const payloadData = {
          title: formTitle,
          description: formDescription,
          price: formPrice ? parseFloat(formPrice) : 0,
          listing_type: createItemType,
          condition: formCondition,
          location_address: formLocation,
          has_local_pickup: formHasPickup,
          has_bicycle_delivery: formHasBicycle,
          has_shipping: formHasShipping,
          swap_preferences: formSwapPreferencesList,
          swap_items: formSwapItemsList,
          repair_specialties: formRepairSpecialties ? formRepairSpecialties.split(',').map(s => s.trim()) : [],
          hourly_rate: formHourlyRate ? parseFloat(formHourlyRate) : null,
          repair_experience: formExperience,
          urgency: formUrgency,
          budget_min: formBudgetMin ? parseFloat(formBudgetMin) : null,
          budget_max: formBudgetMax ? parseFloat(formBudgetMax) : null,

          category_id: formCategoryId ? parseInt(String(formCategoryId), 10) : undefined,
          brand: formBrand || null,
          model: formModel || null,
          sustainability_commitment: formSustainabilityCommitment || null,
          story_of_change: formStoryOfChange || null,
          community_impact: formCommunityImpact || null,
          eco_impact_score: parseInt(formEcoImpactScore, 10) || 0,
          service_area_name: formServiceAreaName || null,
          is_professional: formIsProfessional,

          tags: formTags,
          key_features: formKeyFeatures,
          care_instructions: formCareInstructions,
          colors: formColorsList,
          allow_comments: formAllowComments,
          allow_reviews: formAllowReviews,
          reviews_restriction: formReviewsRestriction,
        };
        if (editingItem) {
          await marketplaceService.updateProduct(editingItem.id, payloadData);
        } else {
          await marketplaceService.createProduct(payloadData, formImageUrl);
        }
      }

      Alert.alert('Success!', editingItem ? 'Your listing has been updated!' : 'Your marketplace listing has been created!');
      setCreateModalVisible(false);
      resetForm();
      loadData(true);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e.message || 'Action completed successfully.';
      Alert.alert('Notice', msg);
      setCreateModalVisible(false);
      resetForm();
      loadData(true);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // â”€â”€ Skeletons â”€â”€
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

  // â”€â”€ Card Renderers â”€â”€
  const renderGridCard = ({ item }: { item: ProductItem }) => (
    <TouchableOpacity style={styles.gridCardContainer} activeOpacity={0.9} onPress={() => handleOpenItemDetail(item)}>
      <View style={styles.gridCard}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.gridImg} />
        ) : (
          <View style={[styles.gridImg, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="image-outline" size={32} color={AppColors.textMedium} />
          </View>
        )}
        <TouchableOpacity style={styles.favBtn} onPress={() => handleToggleFavorite(item)}>
          <Ionicons name={item.isFavorited ? 'heart' : 'heart-outline'} size={18} color={item.isFavorited ? '#EF4444' : '#FFFFFF'} />
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Text style={styles.cardPrice}>{item.price}</Text>
            <View style={{ backgroundColor: AppColors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, fontWeight: '800', color: AppColors.primary, textTransform: 'uppercase' }}>{item.badge}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}
            onPress={() => {
              if (item.isOrganization) {
                (navigation as any).navigate('AssociationDetail', { associationId: item.organizationId });
              } else if (item.userId) {
                (navigation as any).navigate('Profile', { userId: item.userId });
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={13} color={AppColors.textMedium} style={{ marginRight: 4 }} />
            <Text style={[styles.cardSeller, { marginBottom: 0, flex: 1 }]} numberOfLines={1}>Owner: {item.seller}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cardChatBtnPillVertical} onPress={() => handleOpenContact(item)}>
            <Ionicons name="chatbubbles" size={12} color={AppColors.primary} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: AppColors.primary }}>Chat</Text>
          </TouchableOpacity>
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
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.listCardImg} />
        ) : (
          <View style={[styles.listCardImg, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="image-outline" size={28} color={AppColors.textMedium} />
          </View>
        )}
        <View style={styles.listCardBody}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={[styles.listCardTitle, { flex: 1, marginTop: 0 }]} numberOfLines={1}>{item.title}</Text>
            <TouchableOpacity onPress={() => handleToggleFavorite(item)} style={{ paddingLeft: 8 }}>
              <Ionicons name={item.isFavorited ? 'heart' : 'heart-outline'} size={20} color={item.isFavorited ? '#EF4444' : AppColors.textMedium} />
            </TouchableOpacity>
          </View>

          <Text style={styles.listCardDesc} numberOfLines={2}>{item.description}</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Text style={styles.listCardPrice}>{item.price}</Text>
            <View style={[styles.typeBadgePill, { backgroundColor: badgeBg }]}>
              <Text style={[styles.typeBadgeText, { color: badgeTxtColor }]}>
                {badgeLabel}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}
            onPress={() => {
              if (item.isOrganization) {
                (navigation as any).navigate('AssociationDetail', { associationId: item.organizationId });
              } else if (item.userId) {
                (navigation as any).navigate('Profile', { userId: item.userId });
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={13} color={AppColors.textMedium} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: AppColors.textMedium }} numberOfLines={1}>Owner: {item.seller}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cardChatBtnPillVertical} onPress={() => handleOpenContact(item)}>
            <Ionicons name="chatbubbles" size={12} color={AppColors.primary} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: AppColors.primary }}>Chat with Owner</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderWorkshopCard = ({ item }: { item: WorkshopItem }) => (
    <View style={styles.workshopCard}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.workshopImg} />
      ) : null}
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

  const renderListFooter = () => {
    if (!loadingMoreMarket) return null;
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator color={AppColors.primary} size="small" />
        <Text style={{ fontSize: 12, color: AppColors.textMedium, marginTop: 6 }}>Loading more eco listings...</Text>
      </View>
    );
  };

  const getFilteredItems = () => {
    return itemsList;
  };

  const favoritedItems = itemsList.filter(item => item.isFavorited);

  const createBarTranslateY = Animated.diffClamp(scrollY, 0, 60).interpolate({
    inputRange: [0, 60],
    outputRange: [0, -60],
  });

  return (
    <View style={styles.container}>
      {/* â”€â”€ Top Header Bar â”€â”€ */}
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
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image
            source={{
              uri: resolveMediaUrl(user?.profileImage || user?.avatarUrl) || 'https://lh3.googleusercontent.com/aida-public/AB6AXuD902TkYI0b6_KRKtnLv9ekUyPn_e1-iyS3F9Mt8-jOxUbE_1FI8UooP95XuIbGDhFd1ELMSlDE4LDvXawkcdg80li_VvGAmUAAb22zzMsqO98JD_YzW5TxohR_wEZEphVly-CeasRgVMSsXhkjHccqEHuB9C3XhNA0C8_32DACGAIVUOl4vxTVhCoGxybxC9Zl-Wq93MJxUJRYk6jV_9VbWczwGRwpix7oGK86KoEx2-VlgW9qO4k2',
            }}
            style={{ width: 32, height: 32, borderRadius: 16 }}
          />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#006D40' }}>Ekenox</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setCategoryDrawerVisible(true)}>
            <Ionicons name="options-outline" size={22} color={AppColors.primary} />
            {selectedCategoryIds.length > 0 && <View style={styles.categoryDotBadge} />}
          </TouchableOpacity>

          {/* Search Icon Toggle */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              if (showSearch) { setShowSearch(false); setSearchQuery(''); }
              else setShowSearch(true);
            }}
          >
            <Ionicons name={showSearch ? 'close' : 'search-outline'} size={22} color={AppColors.primary} />
          </TouchableOpacity>

          {/* Create Item Button */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              resetForm();
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

      {/* â”€â”€ Sticky Top Navigation & Search â”€â”€ */}
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
        {showSearch && activeMainTab !== 'workshops' && (
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={AppColors.textMedium} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search eco marketplace..."
                placeholderTextColor={AppColors.textMedium}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
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

      {/* â”€â”€ Content View â”€â”€ */}
      {isLoadingApi ? (
        <View style={{ paddingTop: 60 + insets.top + (activeMainTab === 'products' || activeMainTab === 'repair' ? 140 : 100) }}>
          {activeMainTab === 'products' ? renderSkeletonGrid() : renderSkeletonList()}
        </View>
      ) : activeMainTab === 'products' ? (
        <Animated.FlatList
          key={`grid-products-${productSubTab}`}
          data={itemsList}
          renderItem={renderGridCard}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          contentContainerStyle={[styles.gridContent, { paddingTop: 60 + insets.top + 145 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderListFooter}
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
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderListFooter}
        />
      ) : (
        <Animated.FlatList
          key={`list-${activeMainTab}-${repairSubTab}`}
          data={itemsList}
          renderItem={renderListCard}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingTop: 60 + insets.top + 145 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderListFooter}
        />
      )}

      {/* â”€â”€ Left Category Drawer Menu â”€â”€ */}
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

      {/* â”€â”€ Favorites Screen View â”€â”€ */}
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

      {/* â”€â”€ Create Eco Listing Modal â”€â”€ */}
      <Modal visible={createModalVisible} animationType="slide" transparent={false} onRequestClose={() => setCreateModalVisible(false)}>
        <SafeAreaView style={styles.fullScreenContainer}>
          {/* Header */}
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity style={styles.fullScreenBackBtn} onPress={() => setCreateModalVisible(false)}>
              <Ionicons name="close" size={24} color={AppColors.textDark} />
            </TouchableOpacity>
            <Text style={styles.fullScreenTitle}>Create Eco Listing</Text>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

            {/* Eco Banner for Free Items */}
            {createItemType === 'free' && (
              <View style={styles.ecoBannerBox}>
                <Ionicons name="leaf" size={22} color="#15803D" />
                <Text style={styles.ecoBannerText}>
                  ðŸŒ± Giving items a second life reduces landfill waste and strengthens our community!
                </Text>
              </View>
            )}

            {/* â”€â”€ Section 1: Listing Type â”€â”€ */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="pricetag-outline" size={16} color={AppColors.primary} /> Listing Type
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { id: 'for_sale', label: 'For Sale' },
                  { id: 'free', label: 'Free Giveaway' },
                  { id: 'swap', label: 'Swap Item' },
                  { id: 'repair_request', label: 'Repair Request' },
                  { id: 'repair_service', label: 'Repair Service' },
                  { id: 'workshop', label: 'Workshop' },
                ].map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.categoryChip,
                      { width: '31%', minWidth: 95, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginVertical: 2 },
                      createItemType === t.id && styles.categoryChipActive
                    ]}
                    onPress={() => setCreateItemType(t.id as any)}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.categoryChipText, { fontSize: 12 }, createItemType === t.id && styles.categoryChipTextActive]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* â”€â”€ Section 2: Basic Information â”€â”€ */}
            <View style={[styles.sectionCard, { marginTop: 12 }]}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="information-circle-outline" size={16} color={AppColors.primary} /> Basic Information
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Title <Text style={{ color: AppColors.error }}>*</Text></Text>
                <TextInput
                  placeholder={createItemType === 'repair_service' ? 'e.g. Expert Phone Repair Service' : createItemType === 'workshop' ? 'e.g. Urban Composting Workshop' : 'e.g. Reusable Thermal Flask'}
                  style={styles.input}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholderTextColor={AppColors.textLight}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Description <Text style={{ color: AppColors.error }}>*</Text></Text>
                <TextInput
                  placeholder="Describe your item, its condition, dimensions, story..."
                  style={[styles.input, { height: 90, paddingTop: 10 }]}
                  multiline
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholderTextColor={AppColors.textLight}
                />
              </View>

              {/* Price */}
              {(createItemType === 'for_sale' || createItemType === 'workshop') && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Price (â‚¬) {createItemType === 'for_sale' && <Text style={{ color: AppColors.error }}>*</Text>}</Text>
                  <TextInput placeholder="e.g. 24.99" keyboardType="numeric" style={styles.input} value={formPrice} onChangeText={setFormPrice} placeholderTextColor={AppColors.textLight} />
                </View>
              )}

              {createItemType === 'repair_service' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Hourly Rate (â‚¬/hr)</Text>
                  <TextInput placeholder="e.g. 25.00" keyboardType="numeric" style={styles.input} value={formHourlyRate} onChangeText={setFormHourlyRate} placeholderTextColor={AppColors.textLight} />
                </View>
              )}

              {/* Condition */}
              {['for_sale', 'free', 'swap', 'repair_request'].includes(createItemType) && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Condition</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {['new', 'used', 'refurbished'].map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.categoryChip, formCondition === c && styles.categoryChipActive]}
                        onPress={() => setFormCondition(c)}
                      >
                        <Text style={[styles.categoryChipText, formCondition === c && styles.categoryChipTextActive]}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Brand & Model */}
              {['for_sale', 'free', 'swap', 'repair_request'].includes(createItemType) && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Brand</Text>
                    <TextInput placeholder="e.g. Apple" style={styles.input} value={formBrand} onChangeText={setFormBrand} placeholderTextColor={AppColors.textLight} />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Model</Text>
                    <TextInput placeholder="e.g. iPhone 13" style={styles.input} value={formModel} onChangeText={setFormModel} placeholderTextColor={AppColors.textLight} />
                  </View>
                </View>
              )}

              {/* Workshop-specific */}
              {createItemType === 'workshop' && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Workshop Date</Text>
                    <TextInput placeholder="e.g. 2026-08-15" style={styles.input} value={formWorkshopDate} onChangeText={setFormWorkshopDate} placeholderTextColor={AppColors.textLight} />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Time Slot</Text>
                    <TextInput placeholder="e.g. 14:00 â€“ 16:00" style={styles.input} value={formWorkshopTime} onChangeText={setFormWorkshopTime} placeholderTextColor={AppColors.textLight} />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Available Spots</Text>
                    <TextInput placeholder="e.g. 10" keyboardType="numeric" style={styles.input} value={formSpots} onChangeText={setFormSpots} placeholderTextColor={AppColors.textLight} />
                  </View>
                </>
              )}

              {/* Repair service specific */}
              {createItemType === 'repair_service' && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Experience</Text>
                    <TextInput placeholder="e.g. 5 years in electronics repair" style={styles.input} value={formExperience} onChangeText={setFormExperience} placeholderTextColor={AppColors.textLight} />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Specialties (comma-separated)</Text>
                    <TextInput placeholder="e.g. Phones, Laptops, Audio" style={styles.input} value={formRepairSpecialties} onChangeText={setFormRepairSpecialties} placeholderTextColor={AppColors.textLight} />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Service Area</Text>
                    <TextInput placeholder="e.g. Paris 11e, ÃŽle-de-France" style={styles.input} value={formServiceAreaName} onChangeText={setFormServiceAreaName} placeholderTextColor={AppColors.textLight} />
                  </View>
                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Professional Repairer</Text>
                      <Text style={styles.switchDesc}>Certified professional service provider.</Text>
                    </View>
                    <Switch value={formIsProfessional} onValueChange={setFormIsProfessional} trackColor={{ true: AppColors.primary }} />
                  </View>
                </>
              )}

              {/* Repair request specific */}
              {createItemType === 'repair_request' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Min Budget (â‚¬)</Text>
                      <TextInput placeholder="e.g. 10.00" keyboardType="numeric" style={styles.input} value={formBudgetMin} onChangeText={setFormBudgetMin} placeholderTextColor={AppColors.textLight} />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Max Budget (â‚¬)</Text>
                      <TextInput placeholder="e.g. 50.00" keyboardType="numeric" style={styles.input} value={formBudgetMax} onChangeText={setFormBudgetMax} placeholderTextColor={AppColors.textLight} />
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Urgency</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                      {['low', 'medium', 'high', 'urgent'].map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.categoryChip, formUrgency === u && styles.categoryChipActive]}
                          onPress={() => setFormUrgency(u)}
                        >
                          <Text style={[styles.categoryChipText, formUrgency === u && styles.categoryChipTextActive]}>
                            {u.charAt(0).toUpperCase() + u.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </>
              )}
            </View>

            {/* â”€â”€ Section 3: Cover Image â”€â”€ */}
            <View style={[styles.sectionCard, { marginTop: 12 }]}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="images-outline" size={16} color={AppColors.primary} /> Listing Media
              </Text>
              <Text style={styles.label}>
                Cover Photo {['for_sale', 'free', 'swap', 'repair_request'].includes(createItemType) ? <Text style={{ color: AppColors.error }}>*</Text> : '(Optional)'}
              </Text>
              <TouchableOpacity style={styles.coverPickerBox} onPress={pickMarketplaceImage}>
                {formImageUrl ? (
                  <Image source={{ uri: formImageUrl }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.coverPickerPlaceholder}>
                    <Ionicons name="cloud-upload-outline" size={36} color={AppColors.textMedium} />
                    <Text style={styles.coverPickerText}>Tap to select a photo from gallery</Text>
                    <Text style={[styles.coverPickerText, { fontSize: 11, marginTop: 2, opacity: 0.6 }]}>JPG / PNG Â· 4:3 recommended</Text>
                  </View>
                )}
                <View style={styles.coverPickerOverlay}>
                  <Ionicons name="camera" size={18} color="white" />
                </View>
              </TouchableOpacity>
            </View>

            {/* â”€â”€ Section 4: Location & Delivery â”€â”€ */}
            {createItemType !== 'workshop' && (
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="map-outline" size={16} color={AppColors.primary} /> Location & Delivery
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Location Address</Text>
                  <TextInput placeholder="e.g. Paris Eco Hub, France" style={styles.input} value={formLocation} onChangeText={setFormLocation} placeholderTextColor={AppColors.textLight} />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Local Pickup</Text>
                    <Text style={styles.switchDesc}>Buyers can collect directly from you.</Text>
                  </View>
                  <Switch value={formHasPickup} onValueChange={setFormHasPickup} trackColor={{ true: AppColors.primary }} />
                </View>

                <View style={[styles.switchRow, { marginTop: 14 }]}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Eco Bicycle Delivery</Text>
                    <Text style={styles.switchDesc}>Eco-friendly courier within local zones.</Text>
                  </View>
                  <Switch value={formHasBicycle} onValueChange={setFormHasBicycle} trackColor={{ true: AppColors.primary }} />
                </View>

                <View style={[styles.switchRow, { marginTop: 14 }]}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Standard Shipping</Text>
                    <Text style={styles.switchDesc}>Ship items nationally or internationally.</Text>
                  </View>
                  <Switch value={formHasShipping} onValueChange={setFormHasShipping} trackColor={{ true: AppColors.primary }} />
                </View>
              </View>
            )}

            {/* â”€â”€ Section 5: Swap Details â”€â”€ */}
            {createItemType === 'swap' && (
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="swap-horizontal-outline" size={16} color={AppColors.primary} /> Swap Details
                </Text>

                <Text style={styles.label}>What are you offering?</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={swapItemInput} onChangeText={setSwapItemInput} placeholder="e.g. Wooden bookshelf" placeholderTextColor={AppColors.textLight} onSubmitEditing={() => addSwapItem(swapItemInput)} returnKeyType="done" />
                  <TouchableOpacity style={styles.addBtn} onPress={() => addSwapItem(swapItemInput)}>
                    <Ionicons name="add" size={22} color="white" />
                  </TouchableOpacity>
                </View>
                {formSwapItemsList.length > 0 && (
                  <View style={styles.tagsList}>
                    {formSwapItemsList.map(item => (
                      <View key={item} style={styles.tag}>
                        <Text style={styles.tagText}>{item}</Text>
                        <TouchableOpacity onPress={() => removeSwapItem(item)} style={styles.tagRemove}>
                          <Ionicons name="close" size={14} color={AppColors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.label, { marginTop: 12 }]}>What would you accept in return?</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={swapPreferenceInput} onChangeText={setSwapPreferenceInput} placeholder="e.g. Books, Toys, Seeds" placeholderTextColor={AppColors.textLight} onSubmitEditing={() => addSwapPreference(swapPreferenceInput)} returnKeyType="done" />
                  <TouchableOpacity style={styles.addBtn} onPress={() => addSwapPreference(swapPreferenceInput)}>
                    <Ionicons name="add" size={22} color="white" />
                  </TouchableOpacity>
                </View>
                {formSwapPreferencesList.length > 0 && (
                  <View style={styles.tagsList}>
                    {formSwapPreferencesList.map(pref => (
                      <View key={pref} style={styles.tag}>
                        <Text style={styles.tagText}>{pref}</Text>
                        <TouchableOpacity onPress={() => removeSwapPreference(pref)} style={styles.tagRemove}>
                          <Ionicons name="close" size={14} color={AppColors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* â”€â”€ Section 6: Product Details (colors, key features, care) â”€â”€ */}
            {['for_sale', 'free', 'swap'].includes(createItemType) && (
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="list-outline" size={16} color={AppColors.primary} /> Product Details
                </Text>

                {/* Colors */}
                <Text style={styles.label}>Colors Available</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={colorInput} onChangeText={setColorInput} placeholder="e.g. Forest Green" placeholderTextColor={AppColors.textLight} onSubmitEditing={() => addColor(colorInput)} returnKeyType="done" />
                  <TouchableOpacity style={styles.addBtn} onPress={() => addColor(colorInput)}>
                    <Ionicons name="add" size={22} color="white" />
                  </TouchableOpacity>
                </View>
                {formColorsList.length > 0 && (
                  <View style={styles.tagsList}>
                    {formColorsList.map(c => (
                      <View key={c} style={styles.tag}>
                        <Text style={styles.tagText}>{c}</Text>
                        <TouchableOpacity onPress={() => removeColor(c)} style={styles.tagRemove}>
                          <Ionicons name="close" size={14} color={AppColors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Key Features */}
                <Text style={[styles.label, { marginTop: 12 }]}>Key Features</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={keyFeatureInput} onChangeText={setKeyFeatureInput} placeholder="e.g. BPA-free, stainless steel" placeholderTextColor={AppColors.textLight} onSubmitEditing={() => addKeyFeature(keyFeatureInput)} returnKeyType="done" />
                  <TouchableOpacity style={styles.addBtn} onPress={() => addKeyFeature(keyFeatureInput)}>
                    <Ionicons name="add" size={22} color="white" />
                  </TouchableOpacity>
                </View>
                {formKeyFeatures.length > 0 && (
                  <View style={styles.tagsList}>
                    {formKeyFeatures.map(f => (
                      <View key={f} style={styles.tag}>
                        <Text style={styles.tagText}>{f}</Text>
                        <TouchableOpacity onPress={() => removeKeyFeature(f)} style={styles.tagRemove}>
                          <Ionicons name="close" size={14} color={AppColors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Care Instructions */}
                <Text style={[styles.label, { marginTop: 12 }]}>Care Instructions</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={careInstructionInput} onChangeText={setCareInstructionInput} placeholder="e.g. Hand wash only" placeholderTextColor={AppColors.textLight} onSubmitEditing={() => addCareInstruction(careInstructionInput)} returnKeyType="done" />
                  <TouchableOpacity style={styles.addBtn} onPress={() => addCareInstruction(careInstructionInput)}>
                    <Ionicons name="add" size={22} color="white" />
                  </TouchableOpacity>
                </View>
                {formCareInstructions.length > 0 && (
                  <View style={styles.tagsList}>
                    {formCareInstructions.map(ci => (
                      <View key={ci} style={styles.tag}>
                        <Text style={styles.tagText}>{ci}</Text>
                        <TouchableOpacity onPress={() => removeCareInstruction(ci)} style={styles.tagRemove}>
                          <Ionicons name="close" size={14} color={AppColors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* â”€â”€ Section 7: Eco Impact & Story â”€â”€ */}
            {createItemType !== 'workshop' && (
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="leaf-outline" size={16} color={AppColors.primary} /> Eco Impact & Story
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Sustainability Commitment</Text>
                  <TextInput placeholder="e.g. This item was made from 100% recycled materials..." style={[styles.input, { height: 75, paddingTop: 10 }]} multiline value={formSustainabilityCommitment} onChangeText={setFormSustainabilityCommitment} placeholderTextColor={AppColors.textLight} />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Story of Change</Text>
                  <TextInput placeholder="Share the journey of this item â€” its second life..." style={[styles.input, { height: 75, paddingTop: 10 }]} multiline value={formStoryOfChange} onChangeText={setFormStoryOfChange} placeholderTextColor={AppColors.textLight} />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Community Impact</Text>
                  <TextInput placeholder="How does listing this help the local community?" style={[styles.input, { height: 75, paddingTop: 10 }]} multiline value={formCommunityImpact} onChangeText={setFormCommunityImpact} placeholderTextColor={AppColors.textLight} />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Eco Impact Score (0â€“100)</Text>
                  <TextInput placeholder="e.g. 85" keyboardType="numeric" style={styles.input} value={formEcoImpactScore} onChangeText={setFormEcoImpactScore} placeholderTextColor={AppColors.textLight} />
                </View>
              </View>
            )}

            {/* â”€â”€ Section 8: Tags â”€â”€ */}
            <View style={[styles.sectionCard, { marginTop: 12 }]}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="pricetags-outline" size={16} color={AppColors.primary} /> Tags
              </Text>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={tagInput} onChangeText={setTagInput} placeholder="e.g. eco, vintage, upcycled" placeholderTextColor={AppColors.textLight} onSubmitEditing={() => addTag(tagInput)} returnKeyType="done" />
                <TouchableOpacity style={styles.addBtn} onPress={() => addTag(tagInput)}>
                  <Ionicons name="add" size={22} color="white" />
                </TouchableOpacity>
              </View>
              {formTags.length > 0 && (
                <View style={styles.tagsList}>
                  {formTags.map(tag => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                      <TouchableOpacity onPress={() => removeTag(tag)} style={styles.tagRemove}>
                        <Ionicons name="close" size={14} color={AppColors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Section: Listing Settings ── */}
            {createItemType !== 'workshop' && (
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="settings-outline" size={16} color={AppColors.primary} /> Listing Settings
                </Text>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Allow Comments</Text>
                    <Text style={styles.switchDesc}>Enable users to leave questions on this listing.</Text>
                  </View>
                  <Switch value={formAllowComments} onValueChange={setFormAllowComments} trackColor={{ true: AppColors.primary }} />
                </View>

                <View style={[styles.switchRow, { marginTop: 14 }]}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Allow Reviews</Text>
                    <Text style={styles.switchDesc}>Enable ratings and feedback on this listing.</Text>
                  </View>
                  <Switch value={formAllowReviews} onValueChange={setFormAllowReviews} trackColor={{ true: AppColors.primary }} />
                </View>

                {formAllowReviews && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.label}>Who can review?</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[
                          styles.categoryChip,
                          formReviewsRestriction === 'anyone' && styles.categoryChipActive
                        ]}
                        onPress={() => setFormReviewsRestriction('anyone')}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          formReviewsRestriction === 'anyone' && styles.categoryChipTextActive
                        ]}>Anyone</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.categoryChip,
                          formReviewsRestriction === 'buyers' && styles.categoryChipActive
                        ]}
                        onPress={() => setFormReviewsRestriction('buyers')}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          formReviewsRestriction === 'buyers' && styles.categoryChipTextActive
                        ]}>Only Buyers / Serviced Users</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* â”€â”€ Publish Button â”€â”€ */}
            <TouchableOpacity style={[styles.createBtn, { marginTop: 20 }]} onPress={handleCreateSubmit} disabled={isSubmittingCreate}>
              {isSubmittingCreate ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.createBtnText}>Publish Listing</Text>
              )}
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </Modal>


      {/* â”€â”€ Full Screen Item Details View â”€â”€ */}
      <Modal visible={fullDetailVisible} animationType="slide" transparent={false} onRequestClose={() => setFullDetailVisible(false)}>
        {selectedItem && (
          <SafeAreaView style={styles.fullScreenContainer}>
            {/* Header */}
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity style={styles.fullScreenBackBtn} onPress={() => setFullDetailVisible(false)}>
                <Ionicons name="arrow-back" size={22} color={AppColors.textDark} />
              </TouchableOpacity>

              <Text style={styles.fullScreenTitle} numberOfLines={1}>Item Details</Text>

              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {(user && (String(user.id) === String(selectedItem.userId) || user.roles?.includes('ROLE_ADMIN'))) && (
                  <>
                    <TouchableOpacity onPress={() => {
                      populateFormForEdit(selectedItem);
                      setFullDetailVisible(false);
                      setCreateModalVisible(true);
                    }}>
                      <Ionicons name="create-outline" size={22} color={AppColors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteItem(selectedItem)}>
                      <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </>
                )}

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
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => {
                      if (selectedItem.isOrganization) {
                        (navigation as any).navigate('AssociationDetail', { associationId: selectedItem.organizationId });
                      } else if (selectedItem.userId) {
                        (navigation as any).navigate('Profile', { userId: selectedItem.userId });
                      }
                      setFullDetailVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
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

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.sellerName}>{selectedItem.seller}</Text>
                      <Text style={styles.sellerType}>{selectedItem.isOrganization ? 'Verified Eco Association' : 'Individual Community Member'}</Text>
                      {selectedItem.isOrganization ? (
                        <>
                          {Boolean(selectedItem.organizationEmail) && <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 2 }}>Email: {selectedItem.organizationEmail}</Text>}
                          {Boolean(selectedItem.organizationWebsite) && <Text style={{ fontSize: 11, color: AppColors.primary, marginTop: 1 }}>Website:{selectedItem.organizationWebsite}</Text>}
                        </>
                      ) : (
                        <>
                          {Boolean(selectedItem.userEmail) && <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 2 }}>Email: {selectedItem.userEmail}</Text>}
                          {Boolean(selectedItem.userPseudo) && <Text style={{ fontSize: 11, color: AppColors.textMedium, marginTop: 1 }}>@{selectedItem.userPseudo}</Text>}
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

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
                          <Text style={styles.reviewRating}>â˜… {rev.rating}/5</Text>
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

      {/* â”€â”€ Live ChatRoom Modal View â”€â”€ */}
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

      {/* â”€â”€ Report Modal â”€â”€ */}
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

  // Right Drawer
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'flex-end' },
  drawerContainer: { width: width * 0.80, height: '100%', backgroundColor: 'white', borderTopLeftRadius: 20, borderBottomLeftRadius: 20, elevation: 10 },
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
  cardChatBtnPillVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 110, 79, 0.1)',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
  },

  // Create Listing Page Styles matching CreateAssociationScreen
  label: { fontSize: 13, fontWeight: '600', color: AppColors.textMedium, marginBottom: 6, marginTop: 2 },
  fieldGroup: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: AppColors.textDark,
    backgroundColor: '#FAFAFA',
  },
  coverPickerBox: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    marginBottom: 14,
    position: 'relative',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverPickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverPickerText: { fontSize: 13, color: AppColors.textMedium, textAlign: 'center' },
  coverPickerOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: AppColors.textMedium },
  categoryChipTextActive: { color: 'white' },
  switchInfo: { flex: 1 },
  switchDesc: { fontSize: 12, color: AppColors.textMedium, marginTop: 4, lineHeight: 17 },
  createBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.textDark,
    marginBottom: 14,
  },

  // Tag/list editor styles (matching CreateAssociationScreen)
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: AppColors.primary },
  tagRemove: { padding: 2 },
});

export default EcoMarketScreen;
