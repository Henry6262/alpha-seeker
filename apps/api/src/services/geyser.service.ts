import Client, { SubscribeRequest } from '@triton-one/yellowstone-grpc'
import bs58 from 'bs58'
import { appConfig } from '../config/index.js'
import { logger } from './logger.service.js'
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

// CRITICAL: Define only the most important DEX programs for KOL tracking
const PRIORITY_DEX_PROGRAMS = {
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
} as const

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
  private messageQueue: MessageQueueService
  private isShuttingDown = false
  
  // Performance tracking
  private transactionCount = 0
  private relevantTransactionCount = 0
  private startTime = Date.now()

  constructor() {
    this.config = {
      endpoint: appConfig.geyser.endpoint || 'https://yellowstone-solana-mainnet.core.chainstack.com',
      token: appConfig.geyser.xToken || '',
      username: appConfig.geyser.username || '',
      password: appConfig.geyser.password || '',
      chainstackApiKey: appConfig.geyser.chainstackApiKey || '',
      pingIntervalMs: appConfig.geyser.pingIntervalMs || 30000, // Reduced ping frequency
      maxAccountsPerStream: appConfig.geyser.maxAccountsPerStream || 50,
      maxConcurrentStreams: 4, // Use 4 streams: 3 for KOL wallets + 1 for monitoring  
      reconnectMaxAttempts: appConfig.geyser.reconnectMaxAttempts || 3
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
    logger.success('🚀 Starting optimized Geyser service for KOL DEX tracking...', null, 'GEYSER')
    this.isShuttingDown = false
    await this.connect()
  }

  public async connect(): Promise<void> {
    try {
      await this.establishConnection()
      this.isConnected = true
      this.reconnectAttempts = 0
      this.startPingInterval()
      await this.setupOptimizedStreaming()
    } catch (error) {
      logger.logCriticalError('Failed to start optimized Geyser service', error, 'GEYSER')
      await this.handleReconnect()
    }
  }

  private async establishConnection(): Promise<void> {
    try {
      logger.info('🔗 Connecting to Chainstack Yellowstone gRPC...', null, 'GEYSER')
      
      if (!this.config.endpoint || !this.config.token) {
        throw new Error('Missing required configuration: endpoint and token')
      }

      this.client = new Client(this.config.endpoint, this.config.token, {
        'grpc.max_receive_message_length': 64 * 1024 * 1024,
        'grpc.max_send_message_length': 64 * 1024 * 1024,
        'grpc.keepalive_time_ms': 60000, // Increased keep-alive
        'grpc.keepalive_timeout_ms': 10000,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 30000, // Reduced ping frequency
        'grpc.http2.min_ping_interval_without_data_ms': 15000
      })
      
      // Test connection
      await this.client.ping(1)
      logger.success('✅ Connected to Chainstack Yellowstone gRPC!', null, 'GEYSER')
      
    } catch (error) {
      logger.logCriticalError('Failed to connect to Yellowstone gRPC', error, 'GEYSER')
      throw error
    }
  }

  private async setupOptimizedStreaming(): Promise<void> {
    try {
      logger.info('🏗️ Setting up optimized streaming for top 200 KOL wallets...', null, 'GEYSER')
      
      // Get exactly 200 KOL wallets (should be optimized by previous step)
      const kolWallets = await prisma.kolWallet.findMany({
        select: { address: true, curatedName: true },
        take: 200,
        orderBy: { createdAt: 'desc' } // Most recent = highest performing
      })
      
      if (kolWallets.length === 0) {
        logger.warn('⚠️ No KOL wallets found. Run bootstrap first.', null, 'GEYSER')
        return
      }
      
      logger.success(`📊 Tracking ${kolWallets.length} top KOL wallets`, null, 'GEYSER')
      
      // Validate addresses
      const walletAddresses = kolWallets.map(w => w.address)
      const validAddresses = validateWalletAddresses(walletAddresses, 'KOL wallet tracking')
      
      if (validAddresses.length === 0) {
        logger.logCriticalError('No valid wallet addresses found in database', null, 'GEYSER')
        return
      }
      
      // Allocate wallets efficiently across streams
      this.allocateWalletsOptimally(validAddresses)
      
      // Start optimized streaming
      await this.startOptimizedStreams()
      
    } catch (error) {
      logger.logCriticalError('Failed to setup optimized streaming', error, 'GEYSER')
      throw error
    }
  }

  private allocateWalletsOptimally(walletAddresses: string[]): void {
    const { maxAccountsPerStream } = this.config
    const maxKolStreams = 3 // Reserve 1 stream for DEX monitoring
    this.streamManager.allocations = []
    
    logger.info(`🔍 Optimally allocating ${walletAddresses.length} wallets...`, null, 'GEYSER')
    
    for (let i = 0; i < walletAddresses.length; i += maxAccountsPerStream) {
      const streamIndex = Math.floor(i / maxAccountsPerStream)
      if (streamIndex >= maxKolStreams) break // Don't exceed stream limits
      
      const streamId = `kol_stream_${streamIndex + 1}`
      const walletBatch = walletAddresses.slice(i, i + maxAccountsPerStream)
      
      this.streamManager.allocations.push({
        streamId,
        walletAddresses: walletBatch,
        accountCount: walletBatch.length,
        isActive: false,
        reconnectAttempts: 0
      })
      
      logger.info(`📋 ${streamId}: ${walletBatch.length} wallets`, null, 'GEYSER')
    }
    
    this.streamManager.totalWallets = this.streamManager.allocations.reduce(
      (sum, allocation) => sum + allocation.accountCount, 0
    )
    this.streamManager.totalStreams = this.streamManager.allocations.length
    
    logger.success(`📊 Optimal allocation: ${this.streamManager.totalWallets} wallets across ${this.streamManager.totalStreams} streams`, null, 'GEYSER')
  }

  private async startOptimizedStreams(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected')
    }
    
    logger.info('🚀 Starting optimized gRPC streams...', null, 'GEYSER')
    
    // Start KOL wallet streams with optimized filtering
    for (const allocation of this.streamManager.allocations) {
      try {
        await this.startOptimizedKolStream(allocation)
        allocation.isActive = true
        allocation.reconnectAttempts = 0
        logger.success(`✅ ${allocation.streamId} started`, null, 'GEYSER')
        
        // Brief delay between streams
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error) {
        logger.logCriticalError(`Failed to start ${allocation.streamId}`, error, 'GEYSER')
        allocation.lastError = error instanceof Error ? error.message : 'Unknown error'
      }
    }
    
    // Start focused DEX monitoring stream
    await this.startFocusedDexStream()
    
    logger.success(`🎯 Optimized streaming active: ${this.activeStreams.size} streams running`, null, 'GEYSER')
  }

  private async startOptimizedKolStream(allocation: StreamAllocation): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected')
    }
    
    logger.info(`🔄 Starting optimized ${allocation.streamId}...`, null, 'GEYSER')
    
    // Validate all addresses
    const validAddresses = allocation.walletAddresses.filter(addr => isValidSolanaAddress(addr))
    
    if (validAddresses.length === 0) {
      throw new Error(`No valid addresses in ${allocation.streamId}`)
    }
    
    // OPTIMIZED: Subscribe only to transactions involving KOL wallets AND DEX programs
    const subscriptionRequest: SubscribeRequest = {
      accounts: {},
      transactions: {
        [allocation.streamId]: {
          accountInclude: validAddresses,
          accountExclude: [],
          accountRequired: Object.values(PRIORITY_DEX_PROGRAMS), // CRITICAL: Only DEX transactions
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
      commitment: 1 // CONFIRMED for better reliability
    }
    
    const stream = await this.client.subscribe()
    stream.write(subscriptionRequest)
    
    // Handle stream events with optimized processing
    stream.on('data', (update: any) => {
      this.handleOptimizedUpdate(allocation.streamId, update)
    })
    
    stream.on('error', (error: any) => {
      logger.logCriticalError(`Stream error on ${allocation.streamId}`, error, 'GEYSER')
      allocation.isActive = false
      
      if (!this.isShuttingDown && allocation.reconnectAttempts < 2) {
        this.handleStreamReconnect(allocation)
      }
    })
    
    stream.on('end', () => {
      logger.warn(`🔚 Stream ended: ${allocation.streamId}`, null, 'GEYSER')
      allocation.isActive = false
      
      if (!this.isShuttingDown && allocation.reconnectAttempts < 2) {
        this.handleStreamReconnect(allocation)
      }
    })
    
    this.activeStreams.set(allocation.streamId, stream)
    allocation.stream = stream
    
    // Track subscribed accounts
    validAddresses.forEach(addr => this.subscribedAccounts.add(addr))
  }

  private async startFocusedDexStream(): Promise<void> {
    if (!this.client) return
    
    logger.info('🔄 Starting focused DEX monitoring for gem discovery...', null, 'GEYSER')
    
    // OPTIMIZED: Monitor only priority DEX programs with high-value filtering
    const subscriptionRequest: SubscribeRequest = {
      accounts: {},
      transactions: {
        'dex_focus': {
          accountInclude: [],
          accountExclude: [],
          accountRequired: Object.values(PRIORITY_DEX_PROGRAMS), // Only priority DEXs
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
      commitment: 1
    }
    
    const stream = await this.client.subscribe()
    stream.write(subscriptionRequest)
    
    stream.on('data', (update: any) => {
      this.handleOptimizedUpdate('dex_focus', update)
    })
    
    stream.on('error', (error: any) => {
      logger.logCriticalError('DEX monitoring stream error', error, 'GEYSER')
    })
    
    this.activeStreams.set('dex_focus', stream)
    logger.success('✅ Focused DEX monitoring started', null, 'GEYSER')
  }

    private async handleOptimizedUpdate(streamId: string, update: any): Promise<void> {
    try {
      if (!update.transaction) return
      
      this.transactionCount++
      
      // Extract signature efficiently
      const signatureBuffer = update.transaction.transaction.signature
      const signature = signatureBuffer ? bs58.encode(signatureBuffer) : null
      
      if (!signature) return
      
      // CRITICAL: Detailed logging for transaction analysis
      const accounts = update.transaction.transaction?.message?.account_keys || []
      const accountAddresses = accounts.map((key: any) => bs58.encode(key))
      
             // Check for KOL wallets
       const kolWallets = accountAddresses.filter((addr: string) => this.subscribedAccounts.has(addr))
       
       // Check for DEX programs
       const dexPrograms = accountAddresses.filter((addr: string) => 
         Object.values(PRIORITY_DEX_PROGRAMS).includes(addr as any)
       )
      
      // Log every transaction to see what we're getting
      logger.info(`📨 Geyser ${streamId}: ${signature.slice(0, 8)}... | KOL Wallets: ${kolWallets.length} | DEX Programs: ${dexPrograms.length} | Total Accounts: ${accountAddresses.length}`, {
        signature: signature.slice(0, 8),
        streamId,
                 kolWallets: kolWallets.map((w: string) => w.slice(0, 8)),
         dexPrograms: dexPrograms.map((d: string) => {
          const programNames = {
            'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
            '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun'
          }
          return programNames[d as keyof typeof programNames] || d.slice(0, 8)
        }),
        totalAccounts: accountAddresses.length,
                 allAccounts: accountAddresses.map((a: string) => a.slice(0, 8))
      }, 'GEYSER-DATA')
      
      // Only process transactions involving KOL wallets
      if (kolWallets.length === 0) {
        logger.debug(`⚠️ No KOL wallets in ${signature.slice(0, 8)}...`, null, 'GEYSER-FILTER')
        return // Skip non-KOL transactions
      }
      
      this.relevantTransactionCount++
      
      // Always log KOL transactions
             logger.success(`🎯 KOL TRANSACTION: ${signature.slice(0, 8)}... | Wallets: ${kolWallets.map((w: string) => w.slice(0, 8)).join(', ')} | DEX: ${dexPrograms.length > 0 ? 'Yes' : 'No'}`, {
         kolWallets: kolWallets.map((w: string) => w.slice(0, 8)),
        dexPrograms: dexPrograms.length,
        signature: signature.slice(0, 8)
      }, 'KOL-TX')
      
      // Create optimized transaction update
      const txUpdate: GeyserTransactionUpdate = {
        signature,
        slot: parseInt(update.transaction.slot) || 0,
        blockTime: update.transaction.block_time 
          ? new Date(update.transaction.block_time * 1000) 
          : new Date(),
        transaction: update.transaction,
        accounts: accountAddresses
      }
      
      // Queue for processing
      await this.messageQueue.publishRawTransaction(txUpdate)
      
      logger.success(`📤 Queued KOL transaction ${signature.slice(0, 8)}... for processing`, null, 'GEYSER-QUEUE')
      
    } catch (error) {
      logger.error(`❌ Error handling Geyser update for ${streamId}`, error, 'GEYSER')
      logger.incrementErrorCount()
    }
  }

  private async handleStreamReconnect(allocation: StreamAllocation): Promise<void> {
    if (this.isShuttingDown || allocation.reconnectAttempts >= 2) return
    
    allocation.reconnectAttempts++
    logger.warn(`🔄 Reconnecting ${allocation.streamId} (${allocation.reconnectAttempts}/2)...`, null, 'GEYSER')
    
    await this.cleanupStream(allocation.streamId)
    
    setTimeout(async () => {
      if (!this.isShuttingDown) {
        try {
          await this.startOptimizedKolStream(allocation)
          logger.success(`✅ Reconnected ${allocation.streamId}`, null, 'GEYSER')
        } catch (error) {
          logger.logCriticalError(`Failed to reconnect ${allocation.streamId}`, error, 'GEYSER')
        }
      }
    }, 3000 * allocation.reconnectAttempts)
  }

  private async cleanupStream(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId)
    if (stream) {
      try {
        stream.destroy()
        this.activeStreams.delete(streamId)
      } catch (error) {
        // Silent cleanup
      }
    }
    
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
          // Silent ping - no logging for performance
        }
      } catch (error) {
        logger.logCriticalError('Geyser ping failed', error, 'GEYSER')
        this.isConnected = false
        if (!this.isShuttingDown) {
          await this.handleReconnect()
        }
      }
    }, this.config.pingIntervalMs)
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || this.isShuttingDown) {
      logger.logCriticalError('Max reconnection attempts reached', null, 'GEYSER')
      this.stop()
      return
    }

    this.reconnectAttempts++
    const delay = 3000 * Math.pow(2, this.reconnectAttempts - 1)
    
    logger.warn(`🔄 Reconnecting to Geyser (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`, null, 'GEYSER')
    
    setTimeout(async () => {
      if (!this.isShuttingDown) {
        try {
          await this.connect()
        } catch (error) {
          await this.handleReconnect()
        }
      }
    }, delay)
  }

  public stop(): void {
    logger.warn('🛑 Stopping Geyser service...', null, 'GEYSER')
    this.isConnected = false
    this.isShuttingDown = true
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    
    for (const [streamId, stream] of this.activeStreams) {
      try {
        stream.destroy()
      } catch (error) {
        // Silent cleanup
      }
    }
    
    if (this.client) {
      this.client = null
    }
    
    this.activeStreams.clear()
    this.subscribedAccounts.clear()
    
    this.streamManager.allocations.forEach(allocation => {
      allocation.isActive = false
      allocation.stream = undefined
      allocation.reconnectAttempts = 0
    })
    
    logger.success('✅ Geyser service stopped', null, 'GEYSER')
  }

  public getStatus(): GeyserStatus {
    const uptime = (Date.now() - this.startTime) / 1000
    const tps = this.transactionCount / uptime
    const relevanceRate = this.transactionCount > 0 ? (this.relevantTransactionCount / this.transactionCount * 100) : 0
    
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      activeStreams: this.activeStreams.size,
      subscribedAccounts: this.subscribedAccounts.size,
      phase: 'Phase 2 - Real-time Streaming',
      endpoint: this.config.endpoint,
      performance: {
        totalTransactions: this.transactionCount,
        relevantTransactions: this.relevantTransactionCount,
        transactionsPerSecond: parseFloat(tps.toFixed(2)),
        relevanceRate: parseFloat(relevanceRate.toFixed(2)),
        uptime: parseFloat(uptime.toFixed(2))
      },
      streamManager: {
        allocations: this.streamManager.allocations.map(allocation => ({
          streamId: allocation.streamId,
          walletAddresses: allocation.walletAddresses,
          accountCount: allocation.accountCount,
          isActive: allocation.isActive,
          reconnectAttempts: allocation.reconnectAttempts,
          lastError: allocation.lastError
        })),
        totalWallets: this.streamManager.totalWallets,
        totalStreams: this.streamManager.allocations.filter(a => a.isActive).length,
        maxCapacity: this.streamManager.maxCapacity
      }
    }
  }

  // Simplified legacy methods for compatibility
  public async subscribeToWalletAccounts(): Promise<void> {
    // Handled by optimized multi-stream setup
  }

  public async subscribeToWalletTokenAccounts(): Promise<void> {
    // Handled by optimized transaction monitoring
  }

  public async trackWallet(address: string): Promise<void> {
    if (!isValidSolanaAddress(address)) {
      throw new Error(`Invalid Solana address: ${address}`)
    }
    this.subscribedAccounts.add(address)
  }

  public async untrackWallet(address: string): Promise<void> {
    this.subscribedAccounts.delete(address)
  }

  public getPhase(): 'Phase 1 - Dune Analytics' | 'Phase 2 - Real-time Streaming' {
    return 'Phase 2 - Real-time Streaming'
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
    performance: {
      totalTransactions: number
      relevantTransactions: number
      relevanceRate: number
      transactionsPerSecond: number
    }
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
    
    const uptime = (Date.now() - this.startTime) / 1000
    const tps = this.transactionCount / uptime
    const relevanceRate = this.transactionCount > 0 ? (this.relevantTransactionCount / this.transactionCount * 100) : 0
    
    return {
      totalStreams: this.streamManager.totalStreams,
      activeStreams: activeCount,
      inactiveStreams,
      totalWallets: this.streamManager.totalWallets,
      averageWalletsPerStream: this.streamManager.totalWallets / Math.max(this.streamManager.totalStreams, 1),
      streamDetails,
      performance: {
        totalTransactions: this.transactionCount,
        relevantTransactions: this.relevantTransactionCount,
        relevanceRate: parseFloat(relevanceRate.toFixed(2)),
        transactionsPerSecond: parseFloat(tps.toFixed(2))
      }
    }
  }
}

// Export singleton instance
export const geyserService = new GeyserService() 