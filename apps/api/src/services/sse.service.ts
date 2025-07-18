import { FastifyRequest, FastifyReply } from 'fastify'
import { SSEConnection, SSEMessage } from '../types/index.js'

export class SSEService {
  private connections: Map<string, SSEConnection> = new Map()
  private channels: Map<string, Set<string>> = new Map()
  private heartbeatInterval: any = null

  constructor() {
    this.startHeartbeat()
  }

  /**
   * Start the SSE service
   */
  public async start(): Promise<void> {
    console.log('🚀 Starting SSE service...')
    
    try {
      console.log('✅ SSE service started successfully')
    } catch (error) {
      console.error('❌ Failed to start SSE service:', error)
      throw error
    }
  }

  /**
   * Handle new SSE connection for live transaction feed
   */
  public async handleFeedConnection(
    request: FastifyRequest<{ Params: { walletAddress: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { walletAddress } = request.params
    const connectionId = this.generateConnectionId()
    const clientId = request.headers['x-client-id'] as string || 'anonymous'

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    })

    // Create connection object
    const connection: SSEConnection = {
      id: connectionId,
      clientId,
      walletAddress,
      channels: [`feed:${walletAddress}`],
      lastActivity: new Date(),
      isActive: true,
      reply
    }

    this.connections.set(connectionId, connection)
    this.subscribeToChannel(`feed:${walletAddress}`, connectionId)

    console.log(`✅ SSE connection established for wallet ${walletAddress}: ${connectionId}`)

    // Send connection confirmation
    this.sendMessageToConnection(connectionId, {
      type: 'heartbeat',
      channel: `feed:${walletAddress}`,
      data: {
        message: 'Connected to live feed',
        walletAddress,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    })

    // Handle client disconnect
    request.raw.on('close', () => {
      this.handleDisconnection(connectionId)
    })

    request.raw.on('error', () => {
      this.handleDisconnection(connectionId)
    })
  }

  /**
   * Handle SSE connection for live leaderboard updates
   */
  public async handleLeaderboardConnection(
    request: FastifyRequest<{ Querystring: { timeframe?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const timeframe = request.query.timeframe || '1d'
    const connectionId = this.generateConnectionId()
    const clientId = request.headers['x-client-id'] as string || 'anonymous'

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no'
    })

    // Create connection object
    const connection: SSEConnection = {
      id: connectionId,
      clientId,
      channels: [`leaderboard:${timeframe}`],
      lastActivity: new Date(),
      isActive: true,
      reply
    }

    this.connections.set(connectionId, connection)
    this.subscribeToChannel(`leaderboard:${timeframe}`, connectionId)

    console.log(`✅ SSE leaderboard connection established for ${timeframe}: ${connectionId}`)

    // Send connection confirmation
    this.sendMessageToConnection(connectionId, {
      type: 'heartbeat',
      channel: `leaderboard:${timeframe}`,
      data: {
        message: 'Connected to live leaderboard',
        timeframe,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    })

    // Handle client disconnect
    request.raw.on('close', () => {
      this.handleDisconnection(connectionId)
    })

    request.raw.on('error', () => {
      this.handleDisconnection(connectionId)
    })
  }

  /**
   * Handle SSE connection for gem discovery alerts
   */
  public async handleGemConnection(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const connectionId = this.generateConnectionId()
    const clientId = request.headers['x-client-id'] as string || 'anonymous'

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no'
    })

    // Create connection object
    const connection: SSEConnection = {
      id: connectionId,
      clientId,
      channels: ['gems'],
      lastActivity: new Date(),
      isActive: true,
      reply
    }

    this.connections.set(connectionId, connection)
    this.subscribeToChannel('gems', connectionId)

    console.log(`✅ SSE gem discovery connection established: ${connectionId}`)

    // Send connection confirmation
    this.sendMessageToConnection(connectionId, {
      type: 'heartbeat',
      channel: 'gems',
      data: {
        message: 'Connected to gem discovery feed',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    })

    // Handle client disconnect
    request.raw.on('close', () => {
      this.handleDisconnection(connectionId)
    })

    request.raw.on('error', () => {
      this.handleDisconnection(connectionId)
    })
  }

  /**
   * Broadcast a message to all connections in a channel
   */
  public broadcastToChannel(channel: string, message: Omit<SSEMessage, 'channel'>): void {
    const channelConnections = this.channels.get(channel)
    
    if (!channelConnections || channelConnections.size === 0) {
      return // No active connections for this channel
    }

    const sseMessage: SSEMessage = {
      ...message,
      channel
    }

    let sentCount = 0
    channelConnections.forEach(connectionId => {
      if (this.sendMessageToConnection(connectionId, sseMessage)) {
        sentCount++
      }
    })

    console.log(`📡 Broadcasted to channel ${channel}: ${sentCount}/${channelConnections.size} connections`)
  }

  /**
   * Send transaction update to specific wallet feed
   */
  public sendTransactionUpdate(walletAddress: string, transactionData: any): void {
    this.broadcastToChannel(`feed:${walletAddress}`, {
      type: 'transaction',
      data: {
        walletAddress,
        transaction: transactionData,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    })
  }

  /**
   * Send leaderboard update
   */
  public sendLeaderboardUpdate(timeframe: string, leaderboardData: any): void {
    this.broadcastToChannel(`leaderboard:${timeframe}`, {
      type: 'leaderboard',
      data: {
        timeframe,
        leaderboard: leaderboardData,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    })
  }

  /**
   * Send gem discovery alert
   */
  public sendGemAlert(gemData: any): void {
    this.broadcastToChannel('gems', {
      type: 'gem',
      data: {
        gem: gemData,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    })
  }

  /**
   * Send position update for a specific wallet
   */
  public sendPositionUpdate(walletAddress: string, positionData: any): void {
    this.broadcastToChannel(`feed:${walletAddress}`, {
      type: 'position',
      data: {
        walletAddress,
        position: positionData,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    })
  }

  /**
   * Send message to a specific connection
   */
  private sendMessageToConnection(connectionId: string, message: SSEMessage): boolean {
    const connection = this.connections.get(connectionId)
    
    if (!connection || !connection.isActive) {
      return false
    }

    try {
      const sseData = this.formatSSEMessage(message)
      
      // Write to the response stream using stored reply object
      if (connection.reply?.raw?.write) {
        connection.reply.raw.write(sseData)
        connection.lastActivity = new Date()
        return true
      }
    } catch (error) {
      console.error(`❌ Failed to send message to connection ${connectionId}:`, error)
      this.handleDisconnection(connectionId)
    }
    
    return false
  }

  /**
   * Format message as SSE data
   */
  private formatSSEMessage(message: SSEMessage): string {
    let sseData = ''
    
    if (message.type) {
      sseData += `event: ${message.type}\n`
    }
    
    sseData += `data: ${JSON.stringify(message.data)}\n\n`
    
    return sseData
  }

  /**
   * Subscribe connection to a channel
   */
  private subscribeToChannel(channel: string, connectionId: string): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set())
    }
    
    this.channels.get(channel)!.add(connectionId)
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    
    if (connection) {
      connection.isActive = false
      
      // Remove from all channels
      connection.channels.forEach(channel => {
        const channelConnections = this.channels.get(channel)
        if (channelConnections) {
          channelConnections.delete(connectionId)
          
          // Clean up empty channels
          if (channelConnections.size === 0) {
            this.channels.delete(channel)
          }
        }
      })
      
      this.connections.delete(connectionId)
      
      console.log(`🔌 SSE connection ${connectionId} disconnected`)
    }
  }

  /**
   * Start heartbeat to detect disconnected clients
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date()
      const staleConnections: string[] = []
      
      this.connections.forEach((connection, connectionId) => {
        const timeSinceActivity = now.getTime() - connection.lastActivity.getTime()
        
        // If no activity for 60 seconds, send heartbeat
        if (timeSinceActivity > 60000) {
          const heartbeatSent = this.sendMessageToConnection(connectionId, {
            type: 'heartbeat',
            channel: connection.channels[0] || 'system',
            data: { timestamp: now.toISOString() },
            timestamp: now
          })
          
          // If heartbeat failed, mark as stale
          if (!heartbeatSent) {
            staleConnections.push(connectionId)
          }
        }
      })
      
      // Clean up stale connections
      staleConnections.forEach(connectionId => {
        this.handleDisconnection(connectionId)
      })
      
    }, 30000) // Check every 30 seconds
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }



  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number
    activeConnections: number
    channelStats: { [channel: string]: number }
  } {
    const activeConnections = Array.from(this.connections.values()).filter(conn => conn.isActive).length
    
    const channelStats: { [channel: string]: number } = {}
    this.channels.forEach((connections, channel) => {
      channelStats[channel] = connections.size
    })
    
    return {
      totalConnections: this.connections.size,
      activeConnections,
      channelStats
    }
  }

  /**
   * Gracefully shutdown the SSE service
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down SSE service...')
    
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    // Notify all connections of shutdown
    this.connections.forEach((connection, connectionId) => {
      this.sendMessageToConnection(connectionId, {
        type: 'system',
        channel: 'system',
        data: { message: 'Server shutting down' },
        timestamp: new Date()
      })
    })
    
    // Clear all connections
    this.connections.clear()
    this.channels.clear()
    
    console.log('✅ SSE service shut down successfully')
  }
}

// Create and export singleton instance
export const sseService = new SSEService()
export default sseService 