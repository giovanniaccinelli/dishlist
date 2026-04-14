import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.giovanniaccinelli.dishlist',
  appName: 'DishList',
  webDir: 'public',
  server: {
    url: 'https://dishlist7.vercel.app',
    cleartext: false,
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
