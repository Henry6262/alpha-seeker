export default {
  expo: {
    name: "solana-mobile-expo-template",
    slug: "solana-mobile-expo-template",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    main: "./index.js",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.solana.mobile.expo.template"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.solana.mobile.expo.template"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    newArchEnabled: true,
    extra: {
      eas: {
        projectId: "07ab12fd-76db-40e7-8769-6883a80edd74"
      },
      // API Configuration - accessible via Constants.expoConfig.extra
      API_HOST: process.env.EXPO_PUBLIC_API_HOST || "localhost",
      API_PORT: process.env.EXPO_PUBLIC_API_PORT || "3001",
      API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3001",
    }
  }
}; 