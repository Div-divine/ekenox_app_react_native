import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { AppColors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

interface OnboardingPage {
  title: string;
  description: string;
  icon?: string;
  emoji?: string;
  color: string;
}

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Welcome to eKeNox',
    description: 'Join our community and make a positive impact on the environment.',
    icon: 'globe-outline',
    color: '#3B82F6', // Blue
  },
  {
    title: 'Discover Environmental Actions',
    description: 'Find and participate in local environmental initiatives and events.',
    emoji: '🌱',
    color: '#10B981', // Green
  },
  {
    title: 'Connect with Like-minded People',
    description: 'Build your network of environmentally conscious individuals.',
    icon: 'people-outline',
    color: '#8B5CF6', // Purple
  },
  {
    title: 'Track Your Impact',
    description: 'See how your actions contribute to a more sustainable future.',
    icon: 'stats-chart-outline',
    color: '#F59E0B', // Orange
  },
];

export const OnboardingScreen = () => {
  const { completeOnboarding } = useAuth();
  const [currentPage, setCurrentPage] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentPage < ONBOARDING_PAGES.length - 1) {
      const nextIndex = currentPage + 1;
      setCurrentPage(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      const prevIndex = currentPage - 1;
      setCurrentPage(prevIndex);
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await completeOnboarding();
    } catch (e) {
      console.error('Error during onboarding completion', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentPage(viewableItems[0].index ?? 0);
    }
  });

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  });

  const renderPage = ({ item }: { item: OnboardingPage }) => {
    return (
      <View style={styles.pageContainer}>
        <View style={styles.card}>
          <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
            {item.icon ? (
              <Ionicons name={item.icon as any} size={70} color={item.color} />
            ) : (
              <Text style={styles.emojiText}>{item.emoji}</Text>
            )}
          </View>

          <Text style={styles.pageTitle}>{item.title}</Text>
          <Text style={styles.pageDescription}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.primary} />

      {/* Top Header Row with Skip Option */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="leaf-outline" size={24} color="white" />
          <Text style={styles.logoText}>eKeNox</Text>
        </View>

        {currentPage < ONBOARDING_PAGES.length - 1 && (
          <TouchableOpacity onPress={handleSkip} disabled={isUpdating} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pages Carousel */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_PAGES}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        keyExtractor={(_, index) => index.toString()}
        style={styles.carousel}
      />

      {/* Navigation Footer */}
      <View style={styles.footer}>
        {/* Back Button */}
        <View style={styles.footerLeft}>
          {currentPage > 0 && (
            <TouchableOpacity onPress={handleBack} disabled={isUpdating} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color="white" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Page Indicators */}
        <View style={styles.indicatorContainer}>
          {ONBOARDING_PAGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                currentPage === index
                  ? styles.indicatorActive
                  : styles.indicatorInactive,
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started Button */}
        <View style={styles.footerRight}>
          <TouchableOpacity
            onPress={handleNext}
            disabled={isUpdating}
            style={[
              styles.nextBtn,
              currentPage === ONBOARDING_PAGES.length - 1 ? styles.startBtn : null,
            ]}
          >
            {isUpdating ? (
              <ActivityIndicator color={AppColors.primary} size="small" />
            ) : currentPage === ONBOARDING_PAGES.length - 1 ? (
              <Text style={styles.startBtnText}>Get Started</Text>
            ) : (
              <Ionicons name="arrow-forward" size={24} color={AppColors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primary,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  carousel: {
    flex: 1,
  },
  pageContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  emojiText: {
    fontSize: 60,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.textDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  pageDescription: {
    fontSize: 15,
    color: AppColors.textMedium,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  footerLeft: {
    width: 80,
  },
  footerRight: {
    width: 120,
    alignItems: 'flex-end',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  indicatorContainer: {
    flexDirection: 'row',
  },
  indicator: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  indicatorActive: {
    width: 24,
    backgroundColor: 'white',
  },
  indicatorInactive: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  nextBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtn: {
    width: '100%',
    paddingHorizontal: 16,
    borderRadius: 26,
  },
  startBtnText: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
