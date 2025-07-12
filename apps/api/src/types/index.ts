// =================================
// Core Types
// =================================

export type Timeframe = '1d' | '7d' | '30d'
export type LeaderboardType = 'pnl' | 'volume'
export type Ecosystem = 'all' | 'pump.fun' | 'letsbonk.fun'
export type DataSource = 'dune' | 'geyser'

// =================================
// Wallet Types
// =================================

export interface Wallet {
  id: string
  address: string
  curatedName?: string
  twitterHandle?: string
  displayName?: string
  isKolTrader: boolean
  isLeaderboardUser: boolean
  firstSeenAt: Date
  metadataJson?: string
  createdAt: Date
  updatedAt: Date
}

export interface WalletMetadata {
  realTimeTracking?: boolean
  trackingStartedAt?: string
  trackingSource?: string
  discoveredAt?: string
  bonkLaunchpadTrader?: boolean
  source?: string
  lastDuneUpdate?: string
}

// =================================
// Trading Types
// =================================

export interface Transaction {
  id: string
  signature: string
  blockTime: Date
  slot: bigint
  signerAddress: string
  feeLamports: bigint
  wasSuccessful: boolean
  createdAt: Date
}

export interface TokenTransfer {
  id: string
  transactionSignature: string
  walletAddress: string
  tokenMintAddress: string
  amountChangeRaw: string
  preBalanceRaw: string
  postBalanceRaw: string
  tokenSymbol?: string
  tokenName?: string
  tokenDecimals?: number
  createdAt: Date
}

export interface Position {
  id: string
  walletAddress: string
  tokenMintAddress: string
  currentBalanceRaw: string
  totalCostBasisUsd: number
  weightedAvgCostUsd: number
  lastUpdatedAt: Date
}

// =================================
// PNL Types
// =================================

export interface PnlSnapshot {
  id: string
  walletAddress: string
  period: string
  snapshotTimestamp: Date
  realizedPnlUsd: number
  roiPercentage?: number
  winRate?: number
  totalTrades: number
  dataSource: DataSource
  sourceMetadata?: string
  createdAt: Date
}

export interface LeaderboardEntry {
  id: string
  walletAddress: string
  leaderboardType: LeaderboardType
  timeframe: string
  ecosystem: Ecosystem
  rank: number
  metric: number
  calculatedAt: Date
  expiresAt: Date
}

// =================================
// Geyser Stream Types
// =================================

export interface GeyserConnection {
  id: string
  endpoint: string
  isConnected: boolean
  reconnectAttempts: number
  lastPingTime?: Date
}

export interface GeyserStream {
  id: string
  connectionId: string
  streamType: 'transaction' | 'account'
  subscribedAccounts: string[]
  isActive: boolean
  createdAt: Date
}

export interface GeyserTransactionUpdate {
  signature: string
  slot: number
  blockTime: Date
  transaction: any // Raw transaction data
  accounts: string[]
}

export interface GeyserAccountUpdate {
  pubkey: string
  lamports: number
  data: string
  owner: string
  executable: boolean
  rentEpoch: number
}

// =================================
// API Request/Response Types
// =================================

export interface LeaderboardQuery {
  timeframe?: Timeframe
  ecosystem?: Ecosystem
  type?: LeaderboardType
  limit?: number
}

export interface WalletTrackingRequest {
  timeframe?: Timeframe
  limit?: number
  includeTransactions?: boolean
  includeAccountUpdates?: boolean
}

export interface WalletTrackingResponse {
  success: boolean
  subscribedWallets: string[]
  transactionSubscription?: boolean
  accountSubscription?: boolean
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

// =================================
// Dune Analytics Types
// =================================

export interface DuneWalletMetadata {
  wallet_address: string
  curated_name?: string
  twitter_handle?: string
  is_famous_trader: boolean
  total_pnl_7d: number
  total_pnl_30d: number
}

export interface DuneTraderData {
  wallet_address: string
  realized_pnl_usd: number
  total_trades: number
  win_rate: number
  total_volume_usd: number
  first_seen: string
  last_seen: string
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

// =================================
// Service Configuration Types
// =================================

export interface GeyserConfig {
  endpoint: string
  token?: string
  username?: string
  password?: string
  chainstackApiKey?: string
  maxAccountsPerStream: number
  maxConcurrentStreams: number
  reconnectMaxAttempts: number
  pingIntervalMs: number
}

export interface GeyserStatus {
  connected: boolean
  reconnectAttempts: number
  activeStreams: number
  subscribedAccounts: number
  lastPingTime?: Date
  phase?: 'Phase 1 - Dune Analytics' | 'Phase 2 - Real-time Streaming'
  endpoint?: string
  streamManager?: MultiStreamManager
}

export interface WalletTrackerConfig {
  maxWalletsToTrack: number
  defaultTimeframe: Timeframe
  enableKolTraders: boolean
  enableRealTimeTracking: boolean
}

// =================================
// DEX Program Types
// =================================

export interface DEXProgram {
  name: string
  programId: string
  version?: string
}

export const DEX_PROGRAMS: Record<string, DEXProgram> = {
  JUPITER: {
    name: 'Jupiter',
    programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  },
  RAYDIUM_V4: {
    name: 'Raydium V4',
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  },
  ORCA_WHIRLPOOLS: {
    name: 'Orca Whirlpools',
    programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  },
  ORCA_V1: {
    name: 'Orca V1',
    programId: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
  },
  ORCA_V2: {
    name: 'Orca V2',
    programId: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  },
}

// =================================
// Utility Types
// =================================

export interface PaginationQuery {
  page?: number
  limit?: number
  offset?: number
}

export interface TimestampRange {
  startTime?: Date
  endTime?: Date
}

export interface ErrorDetails {
  code: string
  message: string
  details?: any
  timestamp: Date
}

// =================================
// Stream Management Types
// =================================

export interface StreamAllocation {
  streamId: string
  walletAddresses: string[]
  accountCount: number
  isActive: boolean
}

export interface MultiStreamManager {
  allocations: StreamAllocation[]
  totalWallets: number
  totalStreams: number
  maxCapacity: number
}

// =================================
// Type Guards
// =================================

export function isValidTimeframe(value: string): value is Timeframe {
  return ['1d', '7d', '30d'].includes(value)
}

export function isValidLeaderboardType(value: string): value is LeaderboardType {
  return ['pnl', 'volume'].includes(value)
}

export function isValidEcosystem(value: string): value is Ecosystem {
  return ['all', 'pump.fun', 'letsbonk.fun'].includes(value)
}

export function isValidDataSource(value: string): value is DataSource {
  return ['dune', 'geyser'].includes(value)
} 