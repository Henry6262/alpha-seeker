// =================================
// API Request/Response Types
// =================================

export type Timeframe = '1d' | '7d' | '30d'
export type LeaderboardType = 'pnl' | 'volume'
export type Ecosystem = 'all' | 'pump.fun' | 'letsbonk.fun'
export type DataSource = 'dune' | 'geyser'

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