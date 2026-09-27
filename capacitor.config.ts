import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rexcvc.app',
  appName: 'Rexcvc',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
};

export default config;
