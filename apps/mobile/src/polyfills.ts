// React Native polyfills for Solana and crypto
import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";
import { Buffer } from "buffer";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Buffer polyfill
global.Buffer = Buffer;

// Crypto polyfill
class Crypto {
  getRandomValues = expoCryptoGetRandomValues;
}

const webCrypto = typeof crypto !== "undefined" ? crypto : new Crypto();

// React Native global polyfill (no window object)
if (typeof crypto === "undefined") {
  global.crypto = webCrypto;
}

// TextEncoder/TextDecoder polyfill for Solana
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("text-encoding");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
