// =================================
// Wallet & Trading Types
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

export interface PnlSnapshot {
  id: string
  walletAddress: string
  period: string
  snapshotTimestamp: Date
  realizedPnlUsd: number
  roiPercentage?: number
  winRate?: number
  totalTrades: number
  dataSource: 'dune' | 'geyser'
  sourceMetadata?: string
  createdAt: Date
}

export interface WalletLeaderboardEntry {
  id: string
  walletAddress: string
  leaderboardType: 'pnl' | 'volume'
  timeframe: string
  ecosystem: 'all' | 'pump.fun' | 'letsbonk.fun'
  rank: number
  metric: number
  calculatedAt: Date
  expiresAt: Date
} 