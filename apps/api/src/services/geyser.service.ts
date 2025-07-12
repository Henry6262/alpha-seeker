import Client from '@triton-one/yellowstone-grpc'
import { prisma } from '../lib/prisma'

interface GeyserConfig {
  endpoint: string
  token?: string
}

export class GeyserService {
  private client: Client | null = null
  private config: GeyserConfig
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private pingInterval: NodeJS.Timeout | null = null

  constructor(config: GeyserConfig) {
    this.config = config
  }

  /**
   * Connect to Chainstack Yellowstone gRPC endpoint
   */
  async connect(): Promise<void> {
    try {
      console.log('🔗 Connecting to Chainstack Geyser...')
      
      this.client = new Client(this.config.endpoint, this.config.token, {})
      
      // Test connection with ping
      await this.client.ping(1)
      this.isConnected = true
      this.reconnectAttempts = 0
      
      console.log('✅ Connected to Chainstack Geyser successfully')
      
      // Start ping interval to maintain connection
      this.startPingInterval()
      
    } catch (error) {
      console.error('❌ Failed to connect to Geyser:', error)
      this.isConnected = false
      await this.handleReconnect()
      throw error
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(async () => {
      try {
        if (this.client && this.isConnected) {
          await this.client.ping(1)
          console.log('📡 Geyser ping successful')
        }
      } catch (error) {
        console.error('💥 Geyser ping failed:', error)
        this.isConnected = false
        await this.handleReconnect()
      }
    }, 10000) // Ping every 10 seconds
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('💀 Max reconnection attempts reached. Stopping Geyser service.')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000) // Exponential backoff

    console.log(`🔄 Attempting to reconnect to Geyser (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`)
    
    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('❌ Reconnection failed:', error)
      }
    }, delay)
  }

  /**
   * Subscribe to DEX transactions for PNL tracking
   */
  async subscribeToTransactions(programIds: string[]): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Geyser client not connected')
    }

    console.log(`🎯 Subscribing to transactions for programs: ${programIds.join(', ')}`)

    try {
      // Basic subscription request - will be enhanced based on actual API
      const request = {
        transactions: {
          accountInclude: programIds,
          accountExclude: [],
          accountRequired: []
        }
      }

      const stream = await (this.client as any).subscribe(request)
      
      console.log('🔄 Transaction stream started')

      for await (const update of stream) {
        if (update.transaction) {
          await this.processTransactionUpdate(update.transaction)
        }
      }
    } catch (error) {
      console.error('❌ Transaction subscription failed:', error)
      this.isConnected = false
      await this.handleReconnect()
    }
  }

  /**
   * Process incoming transaction updates
   */
  private async processTransactionUpdate(transactionUpdate: any): Promise<void> {
    try {
      const signature = transactionUpdate.transaction?.signatures?.[0]
      const slot = transactionUpdate.slot

      if (!signature) {
        console.log('⚠️ Transaction missing signature, skipping')
        return
      }

      console.log(`📈 Processing transaction: ${signature} at slot ${slot}`)

      // Parse transaction for DEX activity
      const dexData = this.parseDEXTransaction(transactionUpdate.transaction)
      
      if (dexData) {
        // Store transaction in database
        await this.storeTransaction(dexData, signature, slot)
        
        // Update PNL calculations in real-time
        await this.updateWalletPNL(dexData.wallet, dexData.tokenMint)
        
        console.log(`✅ Processed DEX transaction for wallet: ${dexData.wallet}`)
      }
    } catch (error) {
      console.error('❌ Failed to process transaction update:', error)
    }
  }

  /**
   * Parse DEX transaction data
   */
  private parseDEXTransaction(transaction: any): any | null {
    try {
      const logs = transaction.meta?.log_messages || []
      const accounts = transaction.message?.account_keys || []

      // Look for DEX-related log messages
      const isDEXTransaction = logs.some((log: string) => 
        log.includes('swap') || 
        log.includes('Raydium') || 
        log.includes('Jupiter') ||
        log.includes('Orca')
      )

      if (!isDEXTransaction) {
        return null
      }

      // Extract wallet address (typically the fee payer)
      const wallet = accounts[0]
      
      // Extract token information from pre/post token balances
      const preTokenBalances = transaction.meta?.pre_token_balances || []
      const postTokenBalances = transaction.meta?.post_token_balances || []

      // Determine trade type and amounts (simplified)
      const tokenMint = preTokenBalances[0]?.mint || postTokenBalances[0]?.mint

      return {
        wallet,
        tokenMint,
        preTokenBalances,
        postTokenBalances,
        logMessages: logs,
        fee: transaction.meta?.fee
      }
    } catch (error) {
      console.error('❌ Failed to parse DEX transaction:', error)
      return null
    }
  }

  /**
   * Store transaction in database
   */
  private async storeTransaction(dexData: any, signature: string, slot: number): Promise<void> {
    try {
      // Ensure wallet exists
      await prisma.wallet.upsert({
        where: { address: dexData.wallet },
        update: { 
          isLeaderboardUser: true
        },
        create: {
          address: dexData.wallet,
          firstSeenAt: new Date(),
          isLeaderboardUser: true
        }
      })

      // Store transaction (simplified - using available fields)
      await prisma.transaction.create({
        data: {
          signature,
          slot: BigInt(slot), 
          blockTime: new Date(),
          signerAddress: dexData.wallet,
          feeLamports: BigInt(dexData.fee || 0),
          wasSuccessful: true
        }
      })
    } catch (error) {
      console.error('❌ Failed to store transaction:', error)
    }
  }

  /**
   * Update wallet PNL in real-time
   */
  private async updateWalletPNL(walletAddress: string, tokenMint: string): Promise<void> {
    try {
      console.log(`🔄 Updating PNL for wallet ${walletAddress} and token ${tokenMint}`)
      
      // In production, this would:
      // 1. Calculate position changes from token balance deltas
      // 2. Update positions table
      // 3. Calculate new PNL snapshots with dataSource: 'geyser'
      // 4. Trigger leaderboard cache refresh
      // 5. Emit WebSocket events for live updates
      
    } catch (error) {
      console.error('❌ Failed to update wallet PNL:', error)
    }
  }

  /**
   * Subscribe to specific wallet accounts for position tracking
   */
  async subscribeToWallets(walletAddresses: string[]): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Geyser client not connected')
    }

    console.log(`👥 Subscribing to ${walletAddresses.length} wallet accounts`)

    try {
      const request = {
        accounts: {
          account: walletAddresses,
          owner: [],
          filters: []
        }
      }

      const stream = await (this.client as any).subscribe(request)
      
      console.log('🔄 Wallet account stream started')

      for await (const update of stream) {
        if (update.account) {
          await this.processAccountUpdate(update.account)
        }
      }
    } catch (error) {
      console.error('❌ Wallet subscription failed:', error)
      this.isConnected = false
      await this.handleReconnect()
    }
  }

  /**
   * Process account updates for position tracking
   */
  private async processAccountUpdate(accountUpdate: any): Promise<void> {
    try {
      console.log(`📊 Processing account update for: ${accountUpdate.account?.pubkey}`)
      
      // Process account balance changes
      // This would update position tracking in real-time
      
    } catch (error) {
      console.error('❌ Failed to process account update:', error)
    }
  }

  /**
   * Disconnect from Geyser
   */
  async disconnect(): Promise<void> {
    try {
      if (this.pingInterval) {
        clearInterval(this.pingInterval)
        this.pingInterval = null
      }

      if (this.client) {
        this.client = null
      }

      this.isConnected = false
      console.log('🔌 Disconnected from Chainstack Geyser')
    } catch (error) {
      console.error('❌ Error during Geyser disconnect:', error)
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean, reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    }
  }
} 