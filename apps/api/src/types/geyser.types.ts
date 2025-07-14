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