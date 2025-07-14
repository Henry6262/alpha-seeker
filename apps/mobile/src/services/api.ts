/* eslint-env browser */
const API_BASE_URL = 'http://192.168.100.36:3000';

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

// KOL Leaderboard interfaces
export interface KolLeaderboardEntry {
  rank: number;
  wallet_address: string;
  curated_name: string;
  twitter_handle: string;
  total_pnl_usd: number;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  roi_percentage: number;
  win_rate: number;
  total_trades: number;
  total_volume_usd: number;
  snapshot_timestamp: string;
}

export interface KolLeaderboardResponse {
  success: boolean;
  data: KolLeaderboardEntry[];
  meta: {
    timeframe: string;
    count: number;
    source: string;
    last_updated: string;
  };
}

// Ecosystem Leaderboard interfaces
export interface EcosystemLeaderboardEntry {
  rank: number;
  wallet_address: string;
  pnl_usd: number;
  win_rate: number;
  total_trades: number;
  notable_wins: {
    biggest_win: number;
    best_roi: number;
  } | null;
  last_updated: string;
}

export interface EcosystemLeaderboardResponse {
  success: boolean;
  data: EcosystemLeaderboardEntry[];
  meta: {
    timeframe: string;
    count: number;
    source: string;
    last_updated: string;
  };
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

  // KOL Leaderboard (Live Engine)
  async getKolLeaderboard(params: {
    timeframe?: '1h' | '1d' | '7d' | '30d';
    limit?: number;
  } = {}): Promise<KolLeaderboardResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.timeframe) searchParams.append('timeframe', params.timeframe);
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = `/api/v1/leaderboard/kol${queryString ? `?${queryString}` : ''}`;
    
    return this.request<KolLeaderboardResponse>(endpoint);
  }

  // Ecosystem Leaderboard (Dune Analytics)
  async getEcosystemLeaderboard(params: {
    timeframe?: '1h' | '1d' | '7d' | '30d';
    limit?: number;
  } = {}): Promise<EcosystemLeaderboardResponse> {
    const searchParams = new URLSearchParams();
    
    // Convert timeframe to match API format
    const timeframeMap: { [key: string]: string } = {
      '1h': '1H',
      '1d': '1D',
      '7d': '7D',
      '30d': '30D'
    };
    
    if (params.timeframe) {
      const apiTimeframe = timeframeMap[params.timeframe] || params.timeframe;
      searchParams.append('timeframe', apiTimeframe);
    }
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = `/api/v1/leaderboard/ecosystem${queryString ? `?${queryString}` : ''}`;
    
    return this.request<EcosystemLeaderboardResponse>(endpoint);
  }

  // Legacy leaderboard endpoint (for backward compatibility)
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

  // System status
  async getSystemStatus() {
    return this.request('/api/v1/status');
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