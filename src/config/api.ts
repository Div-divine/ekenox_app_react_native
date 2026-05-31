export const ApiConfig = {
  baseUrl: 'http://192.168.28.224:8000',
  apiUrl: 'http://192.168.28.224:8000/api',

  // Authentication endpoints
  authLogin: '/auth/login',
  authRegister: '/auth/register',
  authProfile: '/auth/profile',
  forgotPassword: '/auth/forgot-password',
  validateResetToken: '/auth/validate-reset-token',
  resetPassword: '/auth/reset-password',
  updateOnboarding: '/auth/update-onboarding',
  resendVerification: (userId: number) => `/verification/resend-verification/${userId}`,
  collectEmail: '/collect-email',

  // User endpoints
  userInfo: '/users/me/user-info',
};
