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
  transaction: any // Raw transaction data from Yellowstone
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
  stream?: any // Store the actual stream reference
  lastError?: string
  reconnectAttempts: number
}

export interface MultiStreamManager {
  allocations: StreamAllocation[]
  totalWallets: number
  totalStreams: number
  maxCapacity: number
}

// =================================
// Wallet Address Validation
// =================================

/**
 * Validates if a string is a valid Solana wallet address (Base58 public key)
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false
  }
  
  // Solana public keys are exactly 44 characters in Base58
  if (address.length !== 44) {
    return false
  }
  
  // Check if it's valid Base58 (contains only valid Base58 characters)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/
  if (!base58Regex.test(address)) {
    return false
  }
  
  // Additional check: try to decode as Base58 to ensure it's valid
  try {
    // Simple Base58 validation - in production, you might want to use a library
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    for (const char of address) {
      if (!base58Chars.includes(char)) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

/**
 * Filters an array of addresses to only include valid Solana addresses
 */
export function filterValidAddresses(addresses: string[]): {
  valid: string[]
  invalid: string[]
} {
  const valid: string[] = []
  const invalid: string[] = []
  
  for (const address of addresses) {
    if (isValidSolanaAddress(address)) {
      valid.push(address)
    } else {
      invalid.push(address)
    }
  }
  
  return { valid, invalid }
}

/**
 * Validates wallet addresses with detailed logging
 */
export function validateWalletAddresses(addresses: string[], context: string): string[] {
  console.log(`🔍 Validating ${addresses.length} wallet addresses for ${context}...`)
  
  const { valid, invalid } = filterValidAddresses(addresses)
  
  if (invalid.length > 0) {
    console.warn(`⚠️ Found ${invalid.length} invalid wallet addresses in ${context}:`)
    invalid.forEach((addr, index) => {
      console.warn(`   ${index + 1}. "${addr}" (length: ${addr?.length || 0}, type: ${typeof addr})`)
    })
  }
  
  console.log(`✅ ${valid.length}/${addresses.length} addresses are valid for ${context}`)
  
  return valid
} 