import Client, { SubscribeRequest } from '@triton-one/yellowstone-grpc'
import { appConfig } from '../config/index.js'
import { 
  GeyserConfig, 
  GeyserStatus, 
  MultiStreamManager,
  StreamAllocation,
  GeyserTransactionUpdate,
  DEX_PROGRAMS
} from '../types/index.js'
import { MessageQueueService } from './message-queue.service.js'
import { prisma } from '../lib/prisma.js'

export class GeyserService {
  private client: Client | null = null
  private readonly config: GeyserConfig
  private isConnected = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts: number
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private readonly streamManager: MultiStreamManager
  private readonly activeStreams = new Map<string, any>()
  private readonly subscribedAccounts = new Set<string>()
  private phase: 'Phase 1 - Dune Analytics' | 'Phase 2 - Real-time Streaming' = 'Phase 1 - Dune Analytics'
  private messageQueue: MessageQueueService

  constructor() {
    this.config = {
      endpoint: appConfig.geyser.endpoint || 'yellowstone-solana-mainnet.core.chainstack.com',
      token: appConfig.geyser.xToken || '',
      username: appConfig.geyser.username || '',
      password: appConfig.geyser.password || '',
      chainstackApiKey: appConfig.geyser.chainstackApiKey || '',
      pingIntervalMs: appConfig.geyser.pingIntervalMs || 10000,
      maxAccountsPerStream: appConfig.geyser.maxAccountsPerStream || 50,
      maxConcurrentStreams: appConfig.geyser.maxConcurrentStreams || 5,
      reconnectMaxAttempts: appConfig.geyser.reconnectMaxAttempts || 5
    }
    
    this.maxReconnectAttempts = this.config.reconnectMaxAttempts
    this.streamManager = {
      allocations: [],
      totalWallets: 0,
      totalStreams: 0,
      maxCapacity: this.config.maxAccountsPerStream * this.config.maxConcurrentStreams
    }
    
    this.messageQueue = new MessageQueueService()
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting Geyser service for Phase 2 real-time streaming...')
    this.phase = 'Phase 2 - Real-time Streaming'
    await this.connect()
  }

  public async connect(): Promise<void> {
    try {
      await this.establishConnection()
      this.isConnected = true
      this.reconnectAttempts = 0
      this.startPingInterval()
      await this.setupMultiStreamArchitecture()
    } catch (error) {
      console.error('❌ Failed to start Geyser service:', error)
      await this.handleReconnect()
    }
  }

  private async establishConnection(): Promise<void> {
    try {
      console.log('🔗 Connecting to Chainstack Yellowstone gRPC...')
      
      if (!this.config.endpoint || !this.config.token) {
        throw new Error('Missing required configuration: endpoint and token')
      }

      // Format endpoint properly for Chainstack
      const formattedEndpoint = `https://${this.config.endpoint.replace(/^https?:\/\//, '')}`
      
      console.log(`🔑 Connecting to: ${formattedEndpoint}`)
      console.log(`🔑 Token configured: ${this.config.token ? 'Yes' : 'No'}`)
      
      // Create client with X-Token authentication
      this.client = new Client(formattedEndpoint, this.config.token, {
        'grpc.max_receive_message_length': 64 * 1024 * 1024,
        'grpc.max_send_message_length': 64 * 1024 * 1024,
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 5000,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 5000
      })
      
              // Test connection with ping
        await this.client.ping(1)
      
      console.log('✅ Successfully connected to Chainstack Yellowstone gRPC!')
      
    } catch (error) {
      console.error('❌ Failed to connect to Yellowstone gRPC:', error)
      throw error
    }
  }

  private async setupMultiStreamArchitecture(): Promise<void> {
    try {
      console.log('🏗️ Setting up multi-stream architecture for 200 KOL wallets...')
      
      // Get KOL wallets from database
      const kolWallets = await prisma.kolWallet.findMany({
        select: { address: true },
        take: 200 // Limit to 200 for Chainstack plan
      })
      
      if (kolWallets.length === 0) {
        console.log('⚠️ No KOL wallets found. Run bootstrap first.')
        return
      }
      
      console.log(`📊 Found ${kolWallets.length} KOL wallets to track`)
      
      // Allocate wallets across streams (50 wallets per stream max)
      const walletAddresses = kolWallets.map(w => w.address)
      this.allocateWalletsToStreams(walletAddresses)
      
      // Start streaming for each allocation
      await this.startAllStreams()
      
    } catch (error) {
      console.error('❌ Failed to setup multi-stream architecture:', error)
      throw error
    }
  }

  private allocateWalletsToStreams(walletAddresses: string[]): void {
    const { maxAccountsPerStream, maxConcurrentStreams } = this.config
    this.streamManager.allocations = []
    
    for (let i = 0; i < walletAddresses.length; i += maxAccountsPerStream) {
      const streamId = `stream_${Math.floor(i / maxAccountsPerStream) + 1}`
      const walletBatch = walletAddresses.slice(i, i + maxAccountsPerStream)
      
      if (this.streamManager.allocations.length >= maxConcurrentStreams) {
        console.log(`⚠️ Reached max concurrent streams (${maxConcurrentStreams}). Skipping remaining wallets.`)
        break
      }
      
      this.streamManager.allocations.push({
        streamId,
        walletAddresses: walletBatch,
        accountCount: walletBatch.length,
        isActive: false
      })
    }
    
    this.streamManager.totalWallets = this.streamManager.allocations.reduce(
      (sum, allocation) => sum + allocation.accountCount, 0
    )
    this.streamManager.totalStreams = this.streamManager.allocations.length
    
    console.log(`📋 Stream allocation plan:`)
    this.streamManager.allocations.forEach((allocation, index) => {
      console.log(`   ${allocation.streamId}: ${allocation.accountCount} wallets`)
    })
    console.log(`📊 Total: ${this.streamManager.totalWallets} wallets across ${this.streamManager.totalStreams} streams`)
  }

  private async startAllStreams(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected')
    }
    
    console.log('🚀 Starting all gRPC streams...')
    
    for (const allocation of this.streamManager.allocations) {
      try {
        await this.startWalletStream(allocation)
        allocation.isActive = true
        console.log(`✅ ${allocation.streamId} started successfully`)
      } catch (error) {
        console.error(`❌ Failed to start ${allocation.streamId}:`, error)
      }
    }
    
    // Also start DEX program monitoring stream
    await this.startDexMonitoringStream()
    
    console.log(`🎯 Multi-stream architecture active: ${this.activeStreams.size} streams running`)
  }

  private async startWalletStream(allocation: StreamAllocation): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected')
    }
    
    console.log(`🔄 Starting ${allocation.streamId} for ${allocation.accountCount} wallets...`)
    
    // Create subscription request for this batch of wallets
    const subscriptionRequest: SubscribeRequest = {
      accounts: {
        [allocation.streamId]: {
          account: allocation.walletAddresses,
          owner: [],
          filters: []
        }
      },
      transactions: {
        [allocation.streamId]: {
          accountInclude: allocation.walletAddresses,
          accountExclude: [],
          accountRequired: [],
          vote: false,
          failed: false
        }
      },
      slots: {},
      transactionsStatus: {},
      blocks: {},
      blocksMeta: {},
      entry: {},
      accountsDataSlice: [],
      commitment: 1 // CONFIRMED
    }
    
    // Subscribe to the stream
    const stream = await this.client.subscribe()
    
    // Send subscription request
    stream.write(subscriptionRequest)
    
    // Handle stream events
    stream.on('data', (update: any) => {
      this.handleStreamUpdate(allocation.streamId, update)
    })
    
    stream.on('error', (error: any) => {
      console.error(`❌ Stream error on ${allocation.streamId}:`, error)
      allocation.isActive = false
      this.handleStreamReconnect(allocation)
    })
    
    stream.on('end', () => {
      console.log(`🔚 Stream ended: ${allocation.streamId}`)
      allocation.isActive = false
      this.handleStreamReconnect(allocation)
    })
    
    // Store active stream
    this.activeStreams.set(allocation.streamId, stream)
    
    // Add all wallet addresses to subscribed accounts
    allocation.walletAddresses.forEach(addr => this.subscribedAccounts.add(addr))
  }

  private async startDexMonitoringStream(): Promise<void> {
    if (!this.client) return
    
    console.log('🔄 Starting DEX monitoring stream for gem discovery...')
    
    const dexPrograms = Object.values(DEX_PROGRAMS)
    
    const subscriptionRequest: SubscribeRequest = {
      accounts: {},
      transactions: {
        'dex_monitor': {
          accountInclude: [],
          accountExclude: [],
          accountRequired: dexPrograms,
          vote: false,
          failed: false
        }
      },
      slots: {},
      transactionsStatus: {},
      blocks: {},
      blocksMeta: {},
      entry: {},
      accountsDataSlice: [],
      commitment: 1 // CONFIRMED
    }
    
    const stream = await this.client.subscribe()
    
    stream.write(subscriptionRequest)
    
    stream.on('data', (update: any) => {
      this.handleStreamUpdate('dex_monitor', update)
    })
    
    stream.on('error', (error: any) => {
      console.error('❌ DEX monitor stream error:', error)
    })
    
    this.activeStreams.set('dex_monitor', stream)
  }

  private async handleStreamUpdate(streamId: string, update: any): Promise<void> {
    try {
      if (update.transaction) {
        // Process transaction update
        const txUpdate: GeyserTransactionUpdate = {
          signature: update.transaction.signature,
          slot: update.transaction.slot,
          blockTime: new Date(update.transaction.block_time * 1000),
          transaction: update.transaction,
          accounts: update.transaction.transaction?.message?.account_keys || []
        }
        
        // Push to message queue for processing
        await this.messageQueue.publishRawTransaction(txUpdate)
        
        console.log(`📨 Processed transaction ${txUpdate.signature.slice(0, 8)}... on ${streamId}`)
      }
      
      if (update.account) {
        // Process account update
        console.log(`📊 Account update on ${streamId}: ${update.account.pubkey}`)
      }
      
    } catch (error) {
      console.error(`❌ Error handling stream update on ${streamId}:`, error)
    }
  }

  private async handleStreamReconnect(allocation: StreamAllocation): Promise<void> {
    console.log(`🔄 Attempting to reconnect ${allocation.streamId}...`)
    
    setTimeout(async () => {
      try {
        await this.startWalletStream(allocation)
        console.log(`✅ Successfully reconnected ${allocation.streamId}`)
      } catch (error) {
        console.error(`❌ Failed to reconnect ${allocation.streamId}:`, error)
        // Try again with exponential backoff
        this.handleStreamReconnect(allocation)
      }
    }, 5000)
  }

  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

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
    }, this.config.pingIntervalMs)
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('💀 Max reconnection attempts reached. Stopping Geyser service.')
      this.stop()
      return
    }

    this.reconnectAttempts++
    const delay = 2000 * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`🔄 Attempting to reconnect to Geyser (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`)
    
    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('❌ Reconnection failed:', error)
        await this.handleReconnect()
      }
    }, delay)
  }

  public stop(): void {
    console.log('🛑 Stopping Geyser service...')
    this.isConnected = false
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    
    // Close all active streams
    for (const [streamId, stream] of this.activeStreams) {
      try {
        stream.destroy()
        console.log(`🔚 Closed stream: ${streamId}`)
      } catch (error) {
        console.error(`❌ Error closing stream ${streamId}:`, error)
      }
    }
    
    if (this.client) {
      this.client = null
    }
    
    this.activeStreams.clear()
    this.subscribedAccounts.clear()
    this.phase = 'Phase 1 - Dune Analytics'
    
    // Reset stream manager
    this.streamManager.allocations.forEach(allocation => {
      allocation.isActive = false
    })
  }

  public getStatus(): GeyserStatus {
    const activeAllocations = this.streamManager.allocations.filter(a => a.isActive).length
    
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      activeStreams: this.activeStreams.size,
      subscribedAccounts: this.subscribedAccounts.size,
      phase: this.phase,
      endpoint: this.config.endpoint,
      streamManager: {
        ...this.streamManager,
        totalStreams: activeAllocations
      }
    }
  }

  public async subscribeToWalletAccounts(walletAddresses: string[]): Promise<void> {
    console.log('📊 Using multi-stream architecture for wallet tracking')
    // Wallets are already being tracked via multi-stream setup
    // This method is kept for compatibility
  }

  public async subscribeToWalletTokenAccounts(walletAddresses: string[]): Promise<void> {
    console.log('💰 Token accounts tracked via transaction monitoring')
    // Token accounts are tracked via transaction monitoring
    // This method is kept for compatibility
  }

  public async trackWallet(address: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Geyser service not connected')
    }
    
    this.subscribedAccounts.add(address)
    console.log(`📊 Now tracking wallet: ${address}`)
  }

  public async untrackWallet(address: string): Promise<void> {
    this.subscribedAccounts.delete(address)
    console.log(`🗑️ Stopped tracking wallet: ${address}`)
  }

  public getPhase(): 'Phase 1 - Dune Analytics' | 'Phase 2 - Real-time Streaming' {
    return this.phase
  }

  public getStreamManager(): MultiStreamManager {
    return this.streamManager
  }

  public getSubscribedAccounts(): string[] {
    return Array.from(this.subscribedAccounts)
  }

  public getActiveStreams(): Map<string, any> {
    return new Map(this.activeStreams)
  }

  public async getStreamHealth(): Promise<{
    totalStreams: number
    activeStreams: number
    inactiveStreams: string[]
    totalWallets: number
    averageWalletsPerStream: number
  }> {
    const activeCount = this.streamManager.allocations.filter(a => a.isActive).length
    const inactiveStreams = this.streamManager.allocations
      .filter(a => !a.isActive)
      .map(a => a.streamId)
    
    return {
      totalStreams: this.streamManager.totalStreams,
      activeStreams: activeCount,
      inactiveStreams,
      totalWallets: this.streamManager.totalWallets,
      averageWalletsPerStream: this.streamManager.totalWallets / Math.max(this.streamManager.totalStreams, 1)
    }
  }
}

// Export singleton instance
export const geyserService = new GeyserService() 