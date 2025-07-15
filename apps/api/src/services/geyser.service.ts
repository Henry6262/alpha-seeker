import Client, { SubscribeRequest } from '@triton-one/yellowstone-grpc'
import bs58 from 'bs58'
import { appConfig } from '../config/index.js'
import { 
  GeyserConfig, 
  GeyserStatus, 
  MultiStreamManager,
  StreamAllocation,
  GeyserTransactionUpdate,
  DEX_PROGRAMS,
  validateWalletAddresses,
  isValidSolanaAddress
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
  private isShuttingDown = false

  constructor() {
    this.config = {
      endpoint: appConfig.geyser.endpoint || 'yellowstone-solana-mainnet.core.chainstack.com',
      token: appConfig.geyser.xToken || '',
      username: appConfig.geyser.username || '',
      password: appConfig.geyser.password || '',
      chainstackApiKey: appConfig.geyser.chainstackApiKey || '',
      pingIntervalMs: appConfig.geyser.pingIntervalMs || 10000,
      maxAccountsPerStream: appConfig.geyser.maxAccountsPerStream || 50,
      maxConcurrentStreams: appConfig.geyser.maxConcurrentStreams || 3, // Reduced to be safer with Chainstack limits
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
    this.isShuttingDown = false
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
      
      console.log(`🔑 Connecting to: ${this.config.endpoint}`)
      console.log(`🔑 Token configured: ${this.config.token ? 'Yes' : 'No'}`)
      
      // Create client with X-Token authentication
      this.client = new Client(this.config.endpoint, this.config.token, {
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
      console.log('🏗️ Setting up multi-stream architecture for KOL wallets...')
      
      // Get KOL wallets from database
      const kolWallets = await prisma.kolWallet.findMany({
        select: { address: true },
        take: this.config.maxConcurrentStreams * this.config.maxAccountsPerStream // Respect stream limits
      })
      
      if (kolWallets.length === 0) {
        console.log('⚠️ No KOL wallets found. Run bootstrap first.')
        return
      }
      
      console.log(`📊 Found ${kolWallets.length} KOL wallets to track`)
      
      // Extract and validate wallet addresses
      const walletAddresses = kolWallets.map(w => w.address)
      const validAddresses = validateWalletAddresses(walletAddresses, 'KOL wallet tracking')
      
      if (validAddresses.length === 0) {
        console.error('❌ No valid wallet addresses found in database')
        return
      }
      
      console.log(`🎯 Proceeding with ${validAddresses.length} valid wallet addresses`)
      
      // Allocate wallets across streams
      this.allocateWalletsToStreams(validAddresses)
      
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
    
    console.log(`🔍 Allocating ${walletAddresses.length} validated wallet addresses to streams...`)
    
    for (let i = 0; i < walletAddresses.length; i += maxAccountsPerStream) {
      const streamIndex = Math.floor(i / maxAccountsPerStream)
      const streamId = `stream_${streamIndex + 1}`
      const walletBatch = walletAddresses.slice(i, i + maxAccountsPerStream)
      
      if (streamIndex >= maxConcurrentStreams) {
        console.log(`⚠️ Reached max concurrent streams (${maxConcurrentStreams}). Total wallets: ${i}`)
        break
      }
      
      this.streamManager.allocations.push({
        streamId,
        walletAddresses: walletBatch,
        accountCount: walletBatch.length,
        isActive: false,
        reconnectAttempts: 0
      })
      
      console.log(`📋 ${streamId}: ${walletBatch.length} wallets`)
    }
    
    this.streamManager.totalWallets = this.streamManager.allocations.reduce(
      (sum, allocation) => sum + allocation.accountCount, 0
    )
    this.streamManager.totalStreams = this.streamManager.allocations.length
    
    console.log(`📊 Stream allocation complete: ${this.streamManager.totalWallets} wallets across ${this.streamManager.totalStreams} streams`)
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
        allocation.reconnectAttempts = 0
        console.log(`✅ ${allocation.streamId} started successfully`)
        
        // Add delay between stream starts to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`❌ Failed to start ${allocation.streamId}:`, error)
        allocation.lastError = error instanceof Error ? error.message : 'Unknown error'
      }
    }
    
    // Start DEX program monitoring stream only if we have capacity
    if (this.activeStreams.size < this.config.maxConcurrentStreams) {
      await this.startDexMonitoringStream()
    } else {
      console.log('⚠️ Skipping DEX monitoring stream - at concurrent stream limit')
    }
    
    console.log(`🎯 Multi-stream architecture active: ${this.activeStreams.size} streams running`)
  }

  private async startWalletStream(allocation: StreamAllocation): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected')
    }
    
    if (this.activeStreams.has(allocation.streamId)) {
      console.log(`⚠️ Stream ${allocation.streamId} already exists, cleaning up first...`)
      await this.cleanupStream(allocation.streamId)
    }
    
    console.log(`🔄 Starting ${allocation.streamId} for ${allocation.accountCount} wallets...`)
    
    // Double-check all addresses are valid before creating stream
    const validAddresses = allocation.walletAddresses.filter(addr => isValidSolanaAddress(addr))
    
    if (validAddresses.length === 0) {
      throw new Error(`No valid addresses in ${allocation.streamId}`)
    }
    
    if (validAddresses.length !== allocation.walletAddresses.length) {
      console.warn(`⚠️ ${allocation.streamId}: ${allocation.walletAddresses.length - validAddresses.length} invalid addresses filtered out`)
      allocation.walletAddresses = validAddresses
      allocation.accountCount = validAddresses.length
    }
    
    // Create subscription request for this batch of wallets
    const subscriptionRequest: SubscribeRequest = {
      accounts: {
        [allocation.streamId]: {
          account: validAddresses,
          owner: [],
          filters: []
        }
      },
      transactions: {
        [allocation.streamId]: {
          accountInclude: validAddresses,
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
      allocation.lastError = error.message
      
      // Only attempt reconnect if not shutting down and within limits
      if (!this.isShuttingDown && allocation.reconnectAttempts < 3) {
        this.handleStreamReconnect(allocation)
      } else {
        console.log(`🛑 Max reconnect attempts reached for ${allocation.streamId} or service shutting down`)
      }
    })
    
    stream.on('end', () => {
      console.log(`🔚 Stream ended: ${allocation.streamId}`)
      allocation.isActive = false
      
      // Only attempt reconnect if not shutting down
      if (!this.isShuttingDown && allocation.reconnectAttempts < 3) {
        this.handleStreamReconnect(allocation)
      }
    })
    
    // Store active stream
    this.activeStreams.set(allocation.streamId, stream)
    allocation.stream = stream
    
    // Add all wallet addresses to subscribed accounts
    validAddresses.forEach(addr => this.subscribedAccounts.add(addr))
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
      console.log('🔍 Debug - Stream update:', update)
      if (update.transaction) {
        // Extract signature from Buffer and convert to Base58
        const signatureBuffer = update.transaction.transaction.signature
        const signature = signatureBuffer ? bs58.encode(signatureBuffer) : undefined
        
        if (!signature) {
          console.log('⚠️ Transaction update missing signature, skipping...')
          return
        }
        
        // Process transaction update
        const txUpdate: GeyserTransactionUpdate = {
          signature,
          slot: parseInt(update.transaction.slot) || 0,
          blockTime: update.transaction.block_time 
            ? new Date(update.transaction.block_time * 1000) 
            : new Date(), // Use current time if block_time is missing
          transaction: update.transaction,
          accounts: update.transaction.transaction?.message?.account_keys || []
        }
        console.log('🔍 Debug - Transaction update:', txUpdate)
        // Push to message queue for processing
        await this.messageQueue.publishRawTransaction(txUpdate)
        
        console.log(`📨 Processed transaction ${signature.slice(0, 8)}... on ${streamId}`)
      }
      
      if (update.account) {
        // Process account update - convert pubkey Buffer to Base58
        const pubkeyBuffer = update.account.account.pubkey
        const pubkey = pubkeyBuffer ? bs58.encode(pubkeyBuffer) : 'unknown'
        console.log(`📊 Account update on ${streamId}: ${pubkey}`)
      }
      
    } catch (error) {
      console.error(`❌ Error handling stream update on ${streamId}:`, error)
    }
  }

  private async handleStreamReconnect(allocation: StreamAllocation): Promise<void> {
    if (this.isShuttingDown || allocation.reconnectAttempts >= 3) {
      return
    }
    
    allocation.reconnectAttempts++
    
    console.log(`🔄 Attempting to reconnect ${allocation.streamId} (attempt ${allocation.reconnectAttempts}/3)...`)
    
    // Clean up existing stream first
    await this.cleanupStream(allocation.streamId)
    
    const delay = 2000 * allocation.reconnectAttempts // Increasing delay
    
    setTimeout(async () => {
      try {
        if (!this.isShuttingDown) {
          await this.startWalletStream(allocation)
          console.log(`✅ Successfully reconnected ${allocation.streamId}`)
        }
      } catch (error) {
        console.error(`❌ Failed to reconnect ${allocation.streamId}:`, error)
        allocation.lastError = error instanceof Error ? error.message : 'Reconnection failed'
      }
    }, delay)
  }

  private async cleanupStream(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId)
    if (stream) {
      try {
        stream.destroy()
        this.activeStreams.delete(streamId)
        console.log(`🔚 Cleaned up stream: ${streamId}`)
      } catch (error) {
        console.error(`❌ Error cleaning up stream ${streamId}:`, error)
      }
    }
    
    // Update allocation status
    const allocation = this.streamManager.allocations.find(a => a.streamId === streamId)
    if (allocation) {
      allocation.isActive = false
      allocation.stream = undefined
    }
  }

  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    this.pingInterval = setInterval(async () => {
      try {
        if (this.client && this.isConnected && !this.isShuttingDown) {
          await this.client.ping(1)
          console.log('📡 Geyser ping successful')
        }
      } catch (error) {
        console.error('💥 Geyser ping failed:', error)
        this.isConnected = false
        if (!this.isShuttingDown) {
          await this.handleReconnect()
        }
      }
    }, this.config.pingIntervalMs)
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || this.isShuttingDown) {
      console.log('💀 Max reconnection attempts reached or shutting down. Stopping Geyser service.')
      this.stop()
      return
    }

    this.reconnectAttempts++
    const delay = 2000 * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`🔄 Attempting to reconnect to Geyser (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`)
    
    setTimeout(async () => {
      try {
        if (!this.isShuttingDown) {
          await this.connect()
        }
      } catch (error) {
        console.error('❌ Reconnection failed:', error)
        if (!this.isShuttingDown) {
          await this.handleReconnect()
        }
      }
    }, delay)
  }

  public stop(): void {
    console.log('🛑 Stopping Geyser service...')
    this.isConnected = false
    this.isShuttingDown = true
    
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
      allocation.stream = undefined
      allocation.reconnectAttempts = 0
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
        allocations: this.streamManager.allocations.map(allocation => ({
          streamId: allocation.streamId,
          walletAddresses: allocation.walletAddresses,
          accountCount: allocation.accountCount,
          isActive: allocation.isActive,
          reconnectAttempts: allocation.reconnectAttempts,
          lastError: allocation.lastError
          // Exclude 'stream' property to avoid circular references
        })),
        totalWallets: this.streamManager.totalWallets,
        totalStreams: activeAllocations,
        maxCapacity: this.streamManager.maxCapacity
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
    
    if (!isValidSolanaAddress(address)) {
      throw new Error(`Invalid Solana address: ${address}`)
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
    streamDetails: Array<{
      streamId: string
      isActive: boolean
      walletCount: number
      reconnectAttempts: number
      lastError?: string
    }>
  }> {
    const activeCount = this.streamManager.allocations.filter(a => a.isActive).length
    const inactiveStreams = this.streamManager.allocations
      .filter(a => !a.isActive)
      .map(a => a.streamId)
    
    const streamDetails = this.streamManager.allocations.map(allocation => ({
      streamId: allocation.streamId,
      isActive: allocation.isActive,
      walletCount: allocation.accountCount,
      reconnectAttempts: allocation.reconnectAttempts,
      lastError: allocation.lastError
    }))
    
    return {
      totalStreams: this.streamManager.totalStreams,
      activeStreams: activeCount,
      inactiveStreams,
      totalWallets: this.streamManager.totalWallets,
      averageWalletsPerStream: this.streamManager.totalWallets / Math.max(this.streamManager.totalStreams, 1),
      streamDetails
    }
  }
}

// Export singleton instance
export const geyserService = new GeyserService() 