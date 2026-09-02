import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import authService from '../services/authService';

export const AdminAccessButton = () => {
  const navigation = useNavigation<any>();
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await authService.getStoredUser();
        if (
          user &&
          (user.roles?.includes('ROLE_ADMIN') ||
           user.roles?.includes('ROLE_SUPER_ADMIN') ||
           (user as any).user_roles?.some((r: any) => r.name === 'ROLE_ADMIN' || r === 'ROLE_ADMIN') ||
           (user as any).userRoles?.some((r: any) => r.name === 'ROLE_ADMIN' || r === 'ROLE_ADMIN') ||
           (user as any).is_admin ||
           (user as any).isAdmin)
        ) {
          setIsAdmin(true);
        }
      } catch (e) {
        console.warn('checkAdmin error', e);
      }
    };
    checkAdmin();
  }, []);

  if (!isAdmin) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('AdminDashboard')}
        activeOpacity={0.85}
      >
        <Ionicons name="shield-half-outline" size={20} color="white" style={{ marginRight: 8 }} />
        <Text style={styles.text}>Admin Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default AdminAccessButton;
