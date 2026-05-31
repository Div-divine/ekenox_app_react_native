import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';

// Import our tab screens
import { FeedScreen } from '../screens/FeedScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { AssociationScreen } from '../screens/AssociationScreen';
import { EcoMarketScreen } from '../screens/EcoMarketScreen';
import { EcoChallengeScreen } from '../screens/EcoChallengeScreen';

type TabKey = 0 | 1 | 2 | 3 | 4;

const TAB_CONFIG: Array<{ label: string; icon: string }> = [
  { label: 'Home', icon: 'home' },
  { label: 'Events', icon: 'calendar' },
  { label: 'Association', icon: 'people' },
  { label: 'Eco Market', icon: 'cart' },
  { label: 'Challenge', icon: 'trophy' },
];

export const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>(0);

  const renderScreen = () => {
    switch (activeTab) {
      case 0: return <FeedScreen />;
      case 1: return <EventsScreen />;
      case 2: return <AssociationScreen />;
      case 3: return <EcoMarketScreen />;
      case 4: return <EcoChallengeScreen />;
      default: return <FeedScreen />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Screen Area */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Premium Bottom Nav Bar */}
      <View
        style={[
          styles.bottomTabBar,
          {
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
            height: Platform.OS === 'ios' ? 68 + insets.bottom : 74,
          },
        ]}
      >
        {TAB_CONFIG.map((tab, idx) => {
          const isActive = activeTab === idx;
          return (
            <TouchableOpacity
              key={tab.label}
              style={styles.tabBtn}
              onPress={() => setActiveTab(idx as TabKey)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                <Ionicons
                  name={(isActive ? tab.icon : `${tab.icon}-outline`) as any}
                  size={22}
                  color={isActive ? AppColors.primary : AppColors.textMedium}
                />
              </View>
              <Text
                style={[styles.tabLabel, isActive && styles.activeTabLabel]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  screenContainer: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingTop: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeIconContainer: {
    backgroundColor: AppColors.primary + '10',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  activeTabLabel: {
    color: AppColors.primary,
    fontWeight: '800',
  },
});
