import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { OnboardingScreen } from './src/screens/auth/OnboardingScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { GroupDetailScreen } from './src/screens/GroupDetailScreen';
import { AppColors } from './src/theme/colors';

const AppStack = createStackNavigator();

const AuthenticatedNavigator = () => {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Feed" component={FeedScreen} />
      <AppStack.Screen name="GroupDetail" component={GroupDetailScreen} />
    </AppStack.Navigator>
  );
};

const RootApp = () => {
  const { token, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {token ? (
        user?.hasSeenOnboarding ? (
          <AuthenticatedNavigator />
        ) : (
          <OnboardingScreen />
        )
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
