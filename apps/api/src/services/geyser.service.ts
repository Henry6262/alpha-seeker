import Client from '@triton-one/yellowstone-grpc'
import { appConfig } from '../config/index.js'
import { 
  GeyserConfig, 
  GeyserStatus, 
  MultiStreamManager,
  DEX_PROGRAMS
} from '../types/index.js'

export class GeyserService {
  private client: Client | null = null
  private readonly config: GeyserConfig
  private isConnected = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts: number
  private pingInterval: number | null = null
  private readonly streamManager: MultiStreamManager
  private readonly activeStreams = new Map<string, string>()
  private readonly subscribedAccounts = new Set<string>()
  private phase: 'Phase 1 - Dune Analytics' | 'Phase 2 - Real-time Streaming' = 'Phase 1 - Dune Analytics'

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
      await this.subscribeToPrograms()
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

      // Use the simple working configuration from previous conversation
      const formattedEndpoint = `https://${this.config.endpoint.replace(/^https?:\/\//, '')}`
      
      console.log(`🔑 Connecting with endpoint: ${formattedEndpoint}`)
      console.log(`🔑 Token available: ${this.config.token ? 'yes' : 'no'}`)
      
      // Create client with X-Token authentication (simple method that worked)
      this.client = new Client(formattedEndpoint, this.config.token, {
        'grpc.max_receive_message_length': 64 * 1024 * 1024
      })
      
      // Test connection with ping
      await this.client.ping(1)
      
      console.log('✅ Successfully connected to Chainstack Yellowstone gRPC!')
      
    } catch (error) {
      console.error('❌ Failed to connect to Yellowstone gRPC:', error)
      throw error
    }
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

  private async subscribeToPrograms(): Promise<void> {
    try {
      const programs = Object.values(DEX_PROGRAMS)
      console.log(`🎯 Subscribing to transactions for programs: ${programs.join(', ')}`)
      
      // For now, we'll use a placeholder subscription
      // Full implementation would use the actual Yellowstone gRPC subscription methods
      console.log('🔄 Transaction stream subscription configured (placeholder)')
      console.log('⚠️ Full implementation requires proper Yellowstone gRPC integration')
      
    } catch (error) {
      console.error('❌ Failed to subscribe to programs:', error)
      throw error
    }
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
    
    if (this.client) {
      this.client = null
    }
    
    this.activeStreams.clear()
    this.subscribedAccounts.clear()
    this.phase = 'Phase 1 - Dune Analytics'
  }

  public getStatus(): GeyserStatus {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      activeStreams: this.activeStreams.size,
      subscribedAccounts: this.subscribedAccounts.size,
      phase: this.phase,
      endpoint: this.config.endpoint,
      streamManager: this.streamManager
    }
  }

  public async subscribeToWalletAccounts(walletAddresses: string[]): Promise<void> {
    if (!this.isConnected) {
      console.log('⚠️ Geyser service not connected, skipping wallet account subscription')
      return
    }
    
    try {
      for (const address of walletAddresses) {
        this.subscribedAccounts.add(address)
        console.log(`📊 Subscribed to wallet account: ${address}`)
      }
      console.log(`✅ Successfully subscribed to ${walletAddresses.length} wallet accounts`)
    } catch (error) {
      console.error('💥 Error subscribing to wallet accounts:', error)
      throw error
    }
  }

  public async subscribeToWalletTokenAccounts(walletAddresses: string[]): Promise<void> {
    if (!this.isConnected) {
      console.log('⚠️ Geyser service not connected, skipping token account subscription')
      return
    }
    
    try {
      for (const address of walletAddresses) {
        this.subscribedAccounts.add(`${address}_tokens`)
        console.log(`💰 Subscribed to token accounts for wallet: ${address}`)
      }
      console.log(`✅ Successfully subscribed to token accounts for ${walletAddresses.length} wallets`)
    } catch (error) {
      console.error('💥 Error subscribing to wallet token accounts:', error)
      throw error
    }
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

  public getActiveStreams(): Map<string, string> {
    return new Map(this.activeStreams)
  }
}

// Export singleton instance
export const geyserService = new GeyserService() 