import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.genz.quest',
  appName: 'Quest',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com']
    },
    SplashScreen: {
      // ✅ 0 = لا تعرض شاشة native منفصلة → تختفي الداكنة المربعة
      launchShowDuration: 0,
      launchAutoHide: true,
      // لون احتياطي إن ظهرت لحظة، مطابق للـ HTML splash الفاتح
      backgroundColor: '#F8FAFC',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;