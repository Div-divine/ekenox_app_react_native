import React, { useState } from 'react';
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
  Modal,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { AppColors } from '../../theme/colors';
import authService from '../../services/authService';

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const { login, resendVerificationEmail, socialLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Forgot password modal state
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Social SSO simulator modal state
  const [socialSimulatorVisible, setSocialSimulatorVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [socialToken, setSocialToken] = useState('');
  const [isSocialLoading, setIsSocialLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.success) {
        if (
          result.message.toLowerCase().includes('verify') ||
          result.message.toLowerCase().includes('verification')
        ) {
          Alert.alert(
            'Verification Required',
            'Your email is not verified yet. Would you like us to resend the verification email?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Resend',
                onPress: async () => {
                  if (result.userId) {
                    const resendResult = await resendVerificationEmail(result.userId);
                    Alert.alert(resendResult.success ? 'Success' : 'Error', resendResult.message);
                  } else {
                    Alert.alert('Error', 'Unable to resend verification. Please try registering again.');
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert('Login Failed', result.message);
        }
      } else {
        // Success handled by AuthContext updating the state!
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(forgotEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setIsForgotLoading(true);
    try {
      const result = await authService.forgotPassword(forgotEmail.trim());
      if (result.success) {
        Alert.alert(
          'Reset Link Sent',
          result.message || 'If this email is registered, we have sent a reset password link.',
          [
            {
              text: 'Enter Token Manually',
              onPress: () => {
                setForgotPasswordVisible(false);
                setForgotEmail('');
                navigation.navigate('ResetPassword');
              },
            },
            {
              text: 'OK',
              onPress: () => {
                setForgotPasswordVisible(false);
                setForgotEmail('');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to send reset link.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send reset link.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    setSelectedProvider(provider);
    setSocialToken(''); // Reset
    setSocialSimulatorVisible(true);
  };

  const handleSocialSubmit = async () => {
    if (!socialToken.trim()) {
      Alert.alert('Error', 'Please enter or select a test token.');
      return;
    }

    setIsSocialLoading(true);
    try {
      console.log(`🔄 Attempting simulated social SSO for: ${selectedProvider}`);
      const result = await socialLogin(selectedProvider.toLowerCase(), socialToken.trim());
      if (result.success) {
        setSocialSimulatorVisible(false);
      } else {
        Alert.alert('Social Auth Failed', result.message || 'Verification failed on backend.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'SSO authentication error.');
    } finally {
      setIsSocialLoading(false);
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
            <Text style={styles.title}>Sign In</Text>

            {/* Social Media Row */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: '#db4437' }]}
                onPress={() => handleSocialLogin('Google')}
              >
                <FontAwesome name="google" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: '#3b5998' }]}
                onPress={() => handleSocialLogin('Facebook')}
              >
                <FontAwesome name="facebook" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: '#1da1f2' }]}
                onPress={() => handleSocialLogin('Twitter')}
              >
                <FontAwesome name="twitter" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: '#c13584' }]}
                onPress={() => handleSocialLogin('Instagram')}
              >
                <FontAwesome name="instagram" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
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

              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(email);
                  setForgotPasswordVisible(true);
                }}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Login CTA */}
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.loginBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Switch to Signup */}
          <TouchableOpacity
            style={styles.switchContainer}
            onPress={() => navigation.navigate('Signup')}
          >
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchHighlight}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={forgotPasswordVisible}
        onRequestClose={() => setForgotPasswordVisible(false)}
      >
        <View style={styles.modalCentered}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalDescription}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="your@email.com"
              placeholderTextColor="#9ca3af"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setForgotPasswordVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleForgotPassword}
                disabled={isForgotLoading}
              >
                {isForgotLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Send Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Social SSO Simulator Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={socialSimulatorVisible}
        onRequestClose={() => setSocialSimulatorVisible(false)}
      >
        <View style={styles.modalCentered}>
          <View style={styles.modalView}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <FontAwesome
                name={selectedProvider.toLowerCase() as any}
                size={22}
                color={
                  selectedProvider === 'Google'
                    ? '#db4437'
                    : selectedProvider === 'Facebook'
                    ? '#3b5998'
                    : selectedProvider === 'Twitter'
                    ? '#1da1f2'
                    : '#c13584'
                }
              />
              <Text style={[styles.modalTitle, { marginBottom: 0, marginLeft: 8 }]}>
                {selectedProvider} SSO Simulator
              </Text>
            </View>
            <Text style={styles.modalDescription}>
              Input an OAuth access token to authenticate with the Symfony backend. (Tip: You can use any test string like "simulated_token" for local dev login).
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter OAuth access_token..."
              placeholderTextColor="#9ca3af"
              value={socialToken}
              onChangeText={setSocialToken}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Quick helper tokens */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#f3f4f6',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
                onPress={() => setSocialToken('dev_sso_bypass_token')}
              >
                <Text style={{ fontSize: 12, color: '#374151', fontWeight: '500' }}>Prefill Debug Token</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#f3f4f6',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
                onPress={() => setSocialToken('google_oauth_test_token')}
              >
                <Text style={{ fontSize: 12, color: '#374151', fontWeight: '500' }}>Prefill Google Token</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setSocialSimulatorVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleSocialSubmit}
                disabled={isSocialLoading}
              >
                {isSocialLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Authenticate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 24,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 24,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginHorizontal: 16,
    fontSize: 14,
  },
  form: {
    width: '100%',
  },
  label: {
    color: 'white',
    fontSize: 16,
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
    marginBottom: 12,
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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: '#00A67E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loginBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: 'white',
    fontSize: 14,
  },
  switchHighlight: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  modalCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.primary,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  modalBtnCancel: {
    backgroundColor: 'transparent',
  },
  modalBtnCancelText: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 15,
  },
  modalBtnSubmit: {
    backgroundColor: AppColors.primary,
  },
  modalBtnSubmitText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
