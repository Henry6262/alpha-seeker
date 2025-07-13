// Core API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

// User and Wallet Types
export interface User {
  id: string
  walletAddress: string
  subscriptionTier: SubscriptionTier
  createdAt: string
  updatedAt: string
}

export interface WalletProfile {
  address: string
  totalPnl: number
  totalVolume: number
  rank?: number
  tradeCount: number
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number
  walletAddress: string
  metric: number // PNL or Volume in SOL
  timeframe: TimeFilter
  ecosystem: EcosystemFilter
}

export interface LeaderboardFilters {
  timeframe: TimeFilter
  ecosystem: EcosystemFilter
  leaderboardType: LeaderboardType
}

export type TimeFilter = '1h' | '1d' | '7d' | '30d'
export type EcosystemFilter = 'all' | 'pump.fun' | 'letsbonk.fun'
export type LeaderboardType = 'pnl' | 'volume'

// Trading and Token Types
export interface TradeEvent {
  id: string
  walletAddress: string
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  action: 'buy' | 'sell'
  amountSol: number
  amountToken: number
  timestamp: string
  signature: string
}

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  currentPrice?: number
  marketCap?: number
  ecosystem: EcosystemFilter
}

export interface TokenHolding {
  tokenAddress: string
  token: Token
  amount: number
  valueSol: number
  holderWallets: string[] // Top wallet addresses holding this token
}

// Subscription and Payment Types
export interface SubscriptionTier {
  id: string
  name: 'free' | 'degen' | 'market_maker'
  displayName: string
  maxWallets: number
  price: number // in SOL
  features: string[]
}

export interface NotificationPreference {
  id: string
  userId: string
  walletAddress: string
  minSolAmount: number
  minMarketCap?: number
  maxMarketCap?: number
  enabled: boolean
}

// WebSocket Message Types
export interface WebSocketMessage<T = any> {
  type: 'trade' | 'leaderboard_update' | 'error' | 'ping' | 'pong'
  data: T
  timestamp: string
}

export interface LiveTradeMessage extends WebSocketMessage<TradeEvent> {
  type: 'trade'
}

export interface LeaderboardUpdateMessage extends WebSocketMessage<LeaderboardEntry[]> {
  type: 'leaderboard_update'
} 