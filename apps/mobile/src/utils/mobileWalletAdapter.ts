// Mobile Wallet Adapter wrapper that handles missing native module gracefully
import { NativeModules, Platform } from 'react-native';

// Re-export types that are always available
export type {
  Account as AuthorizedAccount,
  AuthorizationResult,
  AuthorizeAPI,
  AuthToken,
  Base64EncodedAddress,
  DeauthorizeAPI,
  SignInPayloadWithRequiredFields,
  SignInPayload,
} from '@solana-mobile/mobile-wallet-adapter-protocol';

// Check if the native module is available
const isMobileWalletAdapterAvailable = (): boolean => {
  try {
    // Try to access the native module
    const { SolanaMobileWalletAdapter } = NativeModules;
    return !!SolanaMobileWalletAdapter;
  } catch (error) {
    return false;
  }
};

// Type for the callback function
type TransactCallback<T> = (api: any) => Promise<T>;

// Create a mock transact function for when the native module is not available
const mockTransact = async <T>(callback: TransactCallback<T>): Promise<T> => {
  throw new Error('Mobile Wallet Adapter is not available in Expo Go. Please use a development build to access wallet functionality.');
};

// Export the transact function that handles both cases
export const transact = async <T>(callback: TransactCallback<T>): Promise<T> => {
  if (!isMobileWalletAdapterAvailable()) {
    return mockTransact(callback);
  }
  
  try {
    const { transact: actualTransact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    return actualTransact(callback);
  } catch (error) {
    console.warn('Failed to import Mobile Wallet Adapter:', error);
    return mockTransact(callback);
  }
};

// Check if we're running in Expo Go
export const isExpoGo = (): boolean => {
  return Platform.OS === 'android' && !isMobileWalletAdapterAvailable();
};

// Export availability check
export const isMWAAvailable = isMobileWalletAdapterAvailable(); 