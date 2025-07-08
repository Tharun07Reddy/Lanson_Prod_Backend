import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiration: process.env.JWT_EXPIRATION || '15m',
    refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
    refreshTokenRotation: process.env.JWT_REFRESH_ROTATION === 'true',
    issuer: process.env.JWT_ISSUER || 'landson-api',
    audience: process.env.JWT_AUDIENCE || 'landson-client',
  },

  // Session Configuration
  session: {
    durationSeconds: parseInt(process.env.SESSION_DURATION_SECONDS || '604800', 10), // 7 days
    inactivityTimeout: parseInt(process.env.SESSION_INACTIVITY_TIMEOUT || '86400', 10), // 1 day
    maxActiveSessions: parseInt(process.env.MAX_ACTIVE_SESSIONS || '5', 10),
    enforceMaxSessions: process.env.ENFORCE_MAX_SESSIONS === 'true',
    cleanupIntervalSeconds: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '3600', 10), // 1 hour
  },

  // Password Configuration
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
    saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),
    passwordHistoryLimit: parseInt(process.env.PASSWORD_HISTORY_LIMIT || '5', 10),
  },

  // Verification Configuration
  verification: {
    emailVerificationRequired: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false',
    phoneVerificationRequired: process.env.PHONE_VERIFICATION_REQUIRED !== 'false',
    emailVerificationExpiration: parseInt(process.env.EMAIL_VERIFICATION_EXPIRATION || '86400', 10), // 24 hours
    phoneVerificationExpiration: parseInt(process.env.PHONE_VERIFICATION_EXPIRATION || '300', 10), // 5 minutes
    emailVerificationTokenLength: parseInt(process.env.EMAIL_VERIFICATION_TOKEN_LENGTH || '64', 10),
    phoneVerificationCodeLength: parseInt(process.env.PHONE_VERIFICATION_CODE_LENGTH || '6', 10),
  },

  // Rate Limiting Configuration
  rateLimiting: {
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
    loginWindowSeconds: parseInt(process.env.LOGIN_WINDOW_SECONDS || '300', 10), // 5 minutes
    verificationMaxAttempts: parseInt(process.env.VERIFICATION_MAX_ATTEMPTS || '3', 10),
    verificationWindowSeconds: parseInt(process.env.VERIFICATION_WINDOW_SECONDS || '300', 10), // 5 minutes
  },

  // Security Configuration
  security: {
    enableDeviceFingerprinting: process.env.ENABLE_DEVICE_FINGERPRINTING !== 'false',
    enableGeoLocationCheck: process.env.ENABLE_GEOLOCATION_CHECK === 'true',
    enableBruteForceProtection: process.env.ENABLE_BRUTE_FORCE_PROTECTION !== 'false',
    enableAnomalyDetection: process.env.ENABLE_ANOMALY_DETECTION === 'true',
    enableTwoFactorAuth: process.env.ENABLE_TWO_FACTOR_AUTH === 'true',
    defaultTwoFactorMethod: process.env.DEFAULT_TWO_FACTOR_METHOD || 'sms',
  },

  // OAuth Configuration
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackUrl: process.env.FACEBOOK_CALLBACK_URL,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      callbackUrl: process.env.APPLE_CALLBACK_URL,
    },
  },
})); 