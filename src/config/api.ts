export const ApiConfig = {
  baseUrl: 'http://192.168.247.111:8000',
  apiUrl: 'http://192.168.247.111:8000/api',
  
  // Authentication endpoints
  authLogin: '/auth/login',
  authRegister: '/auth/register',
  authProfile: '/auth/profile',
  resendVerification: (userId: number) => `/verification/resend-verification/${userId}`,
  collectEmail: '/collect-email',
};
