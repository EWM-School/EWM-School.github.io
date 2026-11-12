import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Hybrid Configuration — EWM Keep practicing
 * Ready for Web/PWA + Native Android (@capacitor/android) & iOS (@capacitor/ios) builds.
 */
const config: CapacitorConfig = {
  appId: 'com.ewm.keeppracticing',
  appName: 'EWM - Keep practicing',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#28665E',
    },
  },
};

export default config;
