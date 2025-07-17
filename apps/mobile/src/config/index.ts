import Constants from 'expo-constants';

interface AppConfig {
  apiHost: string;
  apiPort: string;
  apiBaseUrl: string;
}

/**
 * Get configuration from Expo Constants
 * This properly handles environment variables in React Native/Expo
 */
function getConfig(): AppConfig {
  const extra = Constants.expoConfig?.extra;
  
  return {
    apiHost: extra?.API_HOST || 'localhost',
    apiPort: extra?.API_PORT || '3001',
    apiBaseUrl: extra?.API_BASE_URL || 'http://localhost:3001',
  };
}

export const config = getConfig();

// Helper to get full API URL with path
export function getApiUrl(path: string = ''): string {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

// Helper to get SSE URL
export function getSSEUrl(path: string = ''): string {
  return getApiUrl(`/api/v1/sse${path}`);
}

export default config; 