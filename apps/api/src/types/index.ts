// =================================
// Re-export all types for easy importing
// =================================

// API Types (with specific imports to avoid conflicts)
export { 
  type Timeframe, 
  type LeaderboardType, 
  type Ecosystem, 
  type DataSource,
  type LeaderboardQuery as ApiLeaderboardQuery,
  type WalletTrackingRequest,
  type WalletTrackingResponse,
  type ApiResponse,
  type PaginationQuery,
  type TimestampRange,
  type ErrorDetails
} from './api.types.js'

// Dune Types
export * from './dune.types.js'

// Leaderboard Types (with specific imports)
export {
  type LeaderboardQuery as LeaderboardRequestQuery,
  type LeaderboardEntry,
  type KolLeaderboardEntry,
  type LeaderboardResponse,
  type WalletProfile,
  type WalletProfileResponse
} from './leaderboard.types.js'

// Wallet Types
export * from './wallet.types.js'

// Geyser Types
export * from './geyser.types.js'

// =================================
// DEX Program Constants
// =================================

export const DEX_PROGRAMS = {
  // Jupiter Aggregator V6
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  
  // Raydium V4
  RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  
  // Pump.fun
  PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  
  // Orca V1
  ORCA_V1: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  
  // Orca V2 
  ORCA_V2: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  
  // Lifinity V2
  LIFINITY_V2: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S',
  
  // Meteora
  METEORA: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
  
  // Phoenix
  PHOENIX: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY'
} as const

// =================================
// Message Queue Types
// =================================

export interface QueueMessage {
  id: string
  type: 'transaction' | 'pnl_update' | 'gem_discovery' | 'leaderboard_update' | 'feed_update'
  payload: any
  timestamp: Date
  attempts: number
  priority: number
}

export interface MessageQueueConfig {
  type: 'redis' | 'rabbitmq'
  host: string
  port: number
  username?: string
  password?: string
  database?: number
}

// =================================
// Redis Leaderboard Types
// =================================

export interface RedisLeaderboardEntry {
  walletAddress: string
  pnlUsd: number
  rank: number
  period: string
}

export interface RedisConfig {
  host: string
  port: number
  password?: string
  database: number
  keyPrefix: string
}

// =================================
// PNL Calculation Types
// =================================

export interface PnlCalculation {
  walletAddress: string
  tokenMintAddress: string
  realizedPnlUsd: number
  unrealizedPnlUsd: number
  totalPnlUsd: number
  averageCostBasisUsd: number
  currentPriceUsd: number
  holdingAmountRaw: string
  timestamp: Date
}

export interface TradeEvent {
  signature: string
  walletAddress: string
  inputMint: string
  outputMint: string
  inputAmount: string
  outputAmount: string
  inputAmountUsd: number
  outputAmountUsd: number
  blockTime: Date
  tradeType: 'buy' | 'sell'
}

// =================================
// Transaction Processing Types
// =================================

export interface ParsedTransaction {
  signature: string
  slot: number
  blockTime: Date
  feeLamports: number
  wasSuccessful: boolean
  programIds: string[]
  swaps: ParsedSwap[]
  walletAddress: string
}

export interface ParsedSwap {
  inputMint: string
  outputMint: string
  inputAmount: string
  outputAmount: string
  inputDecimals: number
  outputDecimals: number
  dexProgram: string
}

// =================================
// Gem Discovery Types
// =================================

export interface GemCandidate {
  tokenMintAddress: string
  discoveryTimestamp: Date
  discoveredByWallets: string[]
  totalBuyVolumeUsd: number
  uniqueBuyerCount: number
  averageTimeToDiscover: number
  confidenceScore: number
  metadata?: TokenMetadata
}

export interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  logoUri?: string
  description?: string
  verified: boolean
}

// =================================
// SSE (Server-Sent Events) Types
// =================================

export interface SSEConnection {
  id: string
  clientId: string
  walletAddress?: string
  channels: string[]
  lastActivity: Date
  isActive: boolean
}

export interface SSEMessage {
  type: 'transaction' | 'leaderboard' | 'position' | 'gem' | 'heartbeat' | 'system'
  channel: string
  data: any
  timestamp: Date
}

// =================================
// Monitoring Types
// =================================

export interface SystemMetrics {
  geyserStreamLag: number
  messageQueueDepth: number
  apiLatencyMs: number
  databaseLatencyMs: number
  redisLatencyMs: number
  activeConnections: number
  transactionsPerSecond: number
  pnlUpdatesPerSecond: number
}

export interface AlertConfig {
  metric: keyof SystemMetrics
  threshold: number
  operator: 'gt' | 'lt' | 'eq'
  enabled: boolean
}

// =================================
// Price Feed Types
// =================================

export interface PriceUpdate {
  mintAddress: string
  priceUsd: number
  timestamp: Date
  source: 'jupiter' | 'helius' | 'cache'
  confidence: number
}

export interface PriceCacheEntry {
  mintAddress: string
  priceUsd: number
  lastUpdated: Date
  expiresAt: Date
  source: string
}

// =================================
// Service Status Types
// =================================

export interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: Date
  uptime: number
  details?: Record<string, any>
}

export interface HealthCheck {
  services: ServiceStatus[]
  overall: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  version: string
} 