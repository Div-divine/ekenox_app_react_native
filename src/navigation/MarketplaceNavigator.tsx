// src/navigation/MarketplaceNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { EcoMarketScreen } from '../screens/EcoMarketScreen';

export type MarketplaceStackParamList = {
  MarketplaceHome: undefined;
};

const Stack = createStackNavigator<MarketplaceStackParamList>();

const MarketplaceNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MarketplaceHome" component={EcoMarketScreen} />
  </Stack.Navigator>
);

export default MarketplaceNavigator;
