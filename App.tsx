import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { OnboardingScreen } from './src/screens/auth/OnboardingScreen';
import { MainTabNavigator } from './src/navigation/MainTabNavigator';
import { FeedScreen } from './src/screens/FeedScreen';
import { GroupDetailScreen } from './src/screens/GroupDetailScreen';
import { EventsScreen } from './src/screens/EventsScreen';
import { EventDetailScreen } from './src/screens/EventDetailScreen';
import { AssociationDetailScreen } from './src/screens/AssociationDetailScreen';
import { CreateAssociationScreen } from './src/screens/CreateAssociationScreen';
import { ChatRoomScreen } from './src/screens/ChatRoomScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { JoinRequestsScreen } from './src/screens/JoinRequestsScreen';
import { AppColors } from './src/theme/colors';

const AppStack = createStackNavigator();

const AuthenticatedNavigator = () => {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="MainTabs" component={MainTabNavigator} />
      <AppStack.Screen name="Feed" component={FeedScreen} />
      <AppStack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <AppStack.Screen name="Events" component={EventsScreen} />
      <AppStack.Screen name="EventDetail" component={EventDetailScreen} />
      <AppStack.Screen name="AssociationDetail" component={AssociationDetailScreen} />
      <AppStack.Screen name="CreateAssociation" component={CreateAssociationScreen} />
      <AppStack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <AppStack.Screen name="Messages" component={MessagesScreen} />
      <AppStack.Screen name="JoinRequests" component={JoinRequestsScreen} />
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
    <SafeAreaProvider>
      <AuthProvider>
        <RootApp />
      </AuthProvider>
    </SafeAreaProvider>
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
