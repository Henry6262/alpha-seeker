// Re-export types from other modules for convenience
export * from './geyser.types.js'
export * from './dune.types.js'
export * from './wallet.types.js'
export * from './leaderboard.types.js'
export * from './api.types.js'

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

// Export program IDs as array for type-safe includes checks
export const DEX_PROGRAM_IDS = Object.values(DEX_PROGRAMS)

// Type-safe helper function to check if a string is a known DEX program
export function isDexProgram(programId: string): boolean {
  return DEX_PROGRAM_IDS.includes(programId as any)
}

// Type-safe helper to get DEX program name from ID
export function getDexProgramName(programId: string): string {
  const entry = Object.entries(DEX_PROGRAMS).find(([, id]) => id === programId)
  return entry ? entry[0] : 'UNKNOWN'
}

// =================================
// Common Data Processing Types
// =================================

export interface TokenMetadata {
  address: string
  symbol: string
  name: string
  decimals: number
  logoUri?: string
  coingeckoId?: string
}

export interface SwapData {
  signature: string
  walletAddress: string
  dexProgram: string
  inputToken: TokenMetadata
  outputToken: TokenMetadata
  inputAmountRaw: string
  outputAmountRaw: string
  inputAmountUsd: number
  outputAmountUsd: number
  timestamp: Date
  slot: number
  priceImpact?: number
  fee?: number
}

export interface PnlCalculation {
  walletAddress: string
  tokenMint: string
  realizedPnlUsd: number
  unrealizedPnlUsd: number
  totalBuyVolumeUsd: number
  totalSellVolumeUsd: number
  avgBuyPrice: number
  avgSellPrice: number
  currentPrice: number
  holdingAmount: number
  firstBuyTime: Date
  lastTradeTime: Date
  tradeCount: number
  winningTrades: number
  losingTrades: number
}

export interface TradeHistory {
  signature: string
  walletAddress: string
  tokenMint: string
  side: 'buy' | 'sell'
  amountUsd: number
  priceUsd: number
  quantity: number
  timestamp: Date
  dexProgram: string
}

// =================================
// Real-time Processing Types
// =================================

export interface QueueMessage {
  id: string
  type: 'transaction' | 'account' | 'price' | 'leaderboard' | 'feed_update' | 'pnl_update' | 'gem_discovery'
  data?: any // Optional for backwards compatibility
  payload?: any // Primary data field
  timestamp: Date
  priority: number
  retryCount: number
}

// Redis configuration interface
export interface RedisConfig {
  url: string
  host?: string
  port?: number
  password?: string
  db?: number
}

// Redis leaderboard entry type alias (import from leaderboard.types.ts)
export type RedisLeaderboardEntry = import('./leaderboard.types.js').LeaderboardEntry

export interface ProcessingMetrics {
  processedCount: number
  errorCount: number
  avgProcessingTime: number
  queueDepth: number
  lastProcessedTime: Date
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

// =================================
// SSE (Server-Sent Events) Types
// =================================

export interface SSEConnection {
  id: string
  clientId: string
  walletAddress?: string // Make optional since not all connections need a wallet
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