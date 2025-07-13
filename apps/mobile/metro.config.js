// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add polyfill resolvers
config.resolver.extraNodeModules.crypto = require.resolve("expo-crypto");

// Configure for standard npm structure
const projectRoot = __dirname;

// Fix module resolution for npm
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// Add platforms to resolve React Native modules properly
config.resolver.platforms = ["native", "android", "ios", "web"];

// Ensure proper resolver for source files
config.resolver.sourceExts = ["js", "jsx", "ts", "tsx", "json", "cjs", "mjs"];

// Fix asset resolution
config.resolver.assetExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ttf", "otf", "woff", "woff2"];

// Handle .cjs files
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

module.exports = config;
