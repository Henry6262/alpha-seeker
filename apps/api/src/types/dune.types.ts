// =================================
// Dune Analytics Types
// =================================

export interface DuneQuery {
  query_id: number
  parameters?: Record<string, any>
}

export interface DuneResponse {
  execution_id: string
  query_id: number
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED'
  result?: {
    rows: any[]
    metadata: {
      column_names: string[]
      result_set_bytes: number
      total_row_count: number
    }
  }
}

// Updated interface to match actual Dune ecosystem leaderboard data
export interface DuneEcosystemTraderData {
  rank: number
  wallet: string
  total_realized_profit_usd: number
  total_realized_profit_sol: number
  roi_percentage: number
  win_rate: number
  total_trades: number
}

export interface DuneWalletMetadata {
  wallet_address: string
  curated_name?: string
  twitter_handle?: string
  is_famous_trader: boolean
  total_pnl_7d: number
  total_pnl_30d: number
}

export interface DuneBonkTraderData {
  rank: number
  wallet: string
  total_realized_profit_usd: number
  total_realized_profit_sol: number
  total_trades: number
  bonk_launchpad_trades: number
  raydium_trades: number
  unique_tokens_traded: number
} 