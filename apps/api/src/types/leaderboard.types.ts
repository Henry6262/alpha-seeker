// =================================
// Leaderboard Types
// =================================

// LeaderboardQuery is now exported from api.types.ts to avoid duplicates

export interface LeaderboardEntry {
  rank: number
  wallet_address: string
  pnl_usd: number
  win_rate?: number
  total_trades?: number
  notable_wins?: any
  last_updated?: string
}

export interface KolLeaderboardEntry {
  rank: number
  wallet_address: string
  curated_name?: string
  twitter_handle?: string
  total_pnl_usd: number
  realized_pnl_usd: number
  unrealized_pnl_usd: number
  roi_percentage: number
  win_rate: number
  total_trades: number
  total_volume_usd: number
  snapshot_timestamp?: Date
}

export interface LeaderboardResponse<T = any> {
  success: boolean
  data: T[]
  meta?: {
    timeframe: string
    count: number
    source: string
    auto_populated?: boolean
    last_updated: string
  }
  filters?: {
    timeframe: string
    ecosystem: string
    type: string
  }
  timestamp?: string
}

export interface WalletProfile {
  address: string
  curatedName?: string
  twitterHandle?: string
  totalPnl: number
  roiPercentage: number
  winRate: number
  totalTrades: number
  recentSnapshots: any[]
}

export interface WalletProfileResponse {
  success: boolean
  data?: WalletProfile
  error?: string
  timestamp: string
} 