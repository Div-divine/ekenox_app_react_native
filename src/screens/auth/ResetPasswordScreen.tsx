import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import authService from '../../services/authService';
import { AppColors } from '../../theme/colors';

interface ResetPasswordScreenProps {
  route: any;
  navigation: any;
}

export const ResetPasswordScreen = ({ route, navigation }: ResetPasswordScreenProps) => {
  // Check if token was passed as param
  const paramToken = route.params?.token || '';

  const [token, setToken] = useState(paramToken);
  const [isTokenValidated, setIsTokenValidated] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (paramToken) {
      handleValidateToken(paramToken);
    }
  }, [paramToken]);

  const handleValidateToken = async (tokenToValidate: string) => {
    if (!tokenToValidate.trim()) {
      Alert.alert('Error', 'Please enter a valid reset token.');
      return;
    }

    setIsValidatingToken(true);
    try {
      const result = await authService.validateResetToken(tokenToValidate.trim());
      if (result.success) {
        setIsTokenValidated(true);
        setToken(tokenToValidate.trim());
      } else {
        Alert.alert('Invalid Token', result.message || 'This reset token is invalid or has expired.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to validate reset token.');
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters.');
      return;
    }

    // Password pattern requirement check matching Flutter
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      Alert.alert(
        'Validation Error',
        'Password must contain at least one uppercase letter, one lowercase letter, and one number.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    setIsResetting(true);
    try {
      const result = await authService.resetPasswordWithToken(token, password);
      if (result.success) {
        Alert.alert(
          'Success',
          'Your password has been reset successfully. You can now sign in with your new credentials.',
          [
            {
              text: 'Go to Sign In',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      } else {
        Alert.alert('Reset Failed', result.message || 'Failed to reset password.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred during password reset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Reset Password</Text>
            
            {!isTokenValidated ? (
              // Step 1: Token Input / Validation Screen
              <View style={styles.section}>
                <Text style={styles.description}>
                  Enter the password reset token you received in your email to continue.
                </Text>
                
                <Text style={styles.label}>Reset Token</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Paste reset token here"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleValidateToken(token)}
                  disabled={isValidatingToken}
                >
                  {isValidatingToken ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.actionBtnText}>Validate Token</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // Step 2: New Password Form Screen
              <View style={styles.section}>
                <Text style={styles.description}>
                  Your token has been validated. Please choose a new secure password.
                </Text>

                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter new password"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    secureTextEntry={!isPasswordVisible}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={22}
                      color="rgba(255, 255, 255, 0.7)"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirm new password"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    secureTextEntry={!isConfirmPasswordVisible}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={isConfirmPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={22}
                      color="rgba(255, 255, 255, 0.7)"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleResetPassword}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.actionBtnText}>Save Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.backText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: AppColors.whiteTranslucent,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: AppColors.whiteTranslucentBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 16,
  },
  section: {
    width: '100%',
  },
  description: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    color: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    alignItems: 'center',
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    color: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeIcon: {
    paddingHorizontal: 12,
  },
  actionBtn: {
    backgroundColor: '#00A67E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  actionBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    alignItems: 'center',
    marginTop: 8,
  },
  backText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
