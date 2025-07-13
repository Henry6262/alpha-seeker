const API_BASE_URL = 'http://localhost:3000';

export interface LeaderboardEntry {
  id: string;
  walletAddress: string;
  leaderboardType: string;
  timeframe: string;
  ecosystem: string;
  rank: number;
  metric: number;
  calculatedAt: string;
  expiresAt: string;
}

export interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardEntry[];
  filters: {
    timeframe: string;
    ecosystem: string;
    type: string;
  };
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: any;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async getHealth() {
    return this.request('/health');
  }

  // Leaderboard endpoints
  async getLeaderboard(params: {
    timeframe?: '1h' | '1d' | '7d' | '30d';
    ecosystem?: 'all' | 'pump.fun' | 'letsbonk.fun';
    type?: 'pnl' | 'volume';
    limit?: number;
  } = {}): Promise<LeaderboardResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.timeframe) searchParams.append('timeframe', params.timeframe);
    if (params.ecosystem) searchParams.append('ecosystem', params.ecosystem);
    if (params.type) searchParams.append('type', params.type);
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = `/api/v1/leaderboard${queryString ? `?${queryString}` : ''}`;
    
    return this.request<LeaderboardResponse>(endpoint);
  }

  // Bootstrap status
  async getBootstrapStatus() {
    return this.request('/api/v1/bootstrap/status');
  }

  // Wallet tracker summary
  async getWalletTrackerSummary() {
    return this.request('/api/v1/wallet-tracker/summary');
  }

  // Configuration
  async getConfig() {
    return this.request('/config');
  }
}

export const apiService = new ApiService();
export default apiService; 