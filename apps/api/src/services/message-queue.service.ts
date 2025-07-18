import Redis from 'ioredis'
import { appConfig } from '../config/index.js'
import { logger } from './logger.service.js'
import { QueueMessage } from '../types/index.js'

export class MessageQueueService {
  private redis: Redis
  private subscriberRedis: Redis
  private readonly connectionConfig: {
    host: string
    port: number
    password?: string
    database: number
  }
  private subscribers: Map<string, Set<(message: any) => void>> = new Map()
  private isListening = false

  constructor() {
    // Use environment variables for Redis configuration
    this.connectionConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DATABASE || '0')
    }

    this.redis = new Redis(this.connectionConfig)
    this.subscriberRedis = new Redis(this.connectionConfig)
  }

  /**
   * Start the message queue service and initialize Redis connections
   */
  public async start(): Promise<void> {
    console.log('🚀 Starting Message Queue service...')
    
    try {
      // Test Redis connection
      await this.redis.ping()
      await this.subscriberRedis.ping()
      console.log('✅ Connected to Redis successfully')
      
      // Start monitoring queue health
      this.startQueueMonitoring()
      
      console.log('✅ Message Queue service started successfully')
    } catch (error) {
      console.error('❌ Failed to start Message Queue service:', error)
      throw error
    }
  }

  /**
   * Publish raw transaction data from Geyser to processing queue
   */
  public async publishRawTransaction(transactionData: any): Promise<void> {
    const message: QueueMessage = {
      id: `tx-${transactionData.signature || Date.now()}`,
      type: 'transaction',
      payload: transactionData,
      timestamp: new Date(),
      retryCount: 0,
      priority: 1
    }

    // Use Redis List as a queue (LPUSH/RPOP pattern)
    await this.redis.lpush('queue:raw-transactions', JSON.stringify(message))
    
    // Also publish to subscribers for real-time processing
    await this.redis.publish('channel:raw-transactions', JSON.stringify(message))
  }

  /**
   * Publish processed trade data for real-time feed updates
   */
  public async publishFeedUpdate(walletAddress: string, tradeData: any): Promise<void> {
    const message: QueueMessage = {
      id: `feed-${walletAddress}-${Date.now()}`,
      type: 'feed_update',
      payload: {
        walletAddress,
        tradeData,
        timestamp: new Date()
      },
      timestamp: new Date(),
      retryCount: 0,
      priority: 1
    }

    await this.redis.lpush('queue:feed-updates', JSON.stringify(message))
    await this.redis.publish('channel:feed-updates', JSON.stringify(message))
  }

  /**
   * Publish PNL calculation updates for leaderboard refresh
   */
  public async publishPnlUpdate(walletAddress: string, pnlData: any): Promise<void> {
    const message: QueueMessage = {
      id: `pnl-${walletAddress}-${Date.now()}`,
      type: 'pnl_update',
      payload: {
        walletAddress,
        pnlData,
        timestamp: new Date()
      },
      timestamp: new Date(),
      retryCount: 0,
      priority: 2 // Higher priority for PNL updates
    }

    await this.redis.lpush('queue:pnl-updates', JSON.stringify(message))
    await this.redis.publish('channel:pnl-updates', JSON.stringify(message))
  }

  /**
   * Publish gem discovery events
   */
  public async publishGemDiscovery(tokenData: any): Promise<void> {
    const message: QueueMessage = {
      id: `gem-${tokenData.mintAddress}-${Date.now()}`,
      type: 'gem_discovery',
      payload: tokenData,
      timestamp: new Date(),
      retryCount: 0,
      priority: 3 // Lower priority for gem discovery
    }

    await this.redis.lpush('queue:gem-discovery', JSON.stringify(message))
    await this.redis.publish('channel:gem-discovery', JSON.stringify(message))
  }

  /**
   * Subscribe to a specific channel for real-time message processing
   */
  public async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
      
      // Subscribe to Redis channel
      await this.subscriberRedis.subscribe(`channel:${channel}`)
    }
    
    this.subscribers.get(channel)!.add(callback)
    
    if (!this.isListening) {
      this.startMessageListener()
    }
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const channelSubscribers = this.subscribers.get(channel)
    if (channelSubscribers) {
      channelSubscribers.delete(callback)
      
      if (channelSubscribers.size === 0) {
        this.subscribers.delete(channel)
        await this.subscriberRedis.unsubscribe(`channel:${channel}`)
      }
    }
  }

  /**
   * Process messages from queue (blocking pop operation)
   */
  public async processQueue(queueName: string, processorFunction: (message: any) => Promise<void>): Promise<void> {
    const fullQueueName = `queue:${queueName}`
    
    while (true) {
      try {
        // Blocking right pop with 1 second timeout
        const result = await this.redis.brpop(fullQueueName, 1)
        
        if (result) {
          const [, messageStr] = result
          const message = JSON.parse(messageStr)
          
          try {
            await processorFunction(message)
            console.log(`✅ Processed message from ${queueName}: ${message.id}`)
          } catch (error) {
            console.error(`❌ Failed to process message from ${queueName}: ${message.id}`, error)
            
            // Retry logic - put back in queue with increased attempt count
            message.attempts = (message.attempts || 0) + 1
            if (message.attempts < 3) {
              await this.redis.lpush(fullQueueName, JSON.stringify(message))
            } else {
              console.error(`❌ Max attempts reached for message: ${message.id}`)
              // Could store in dead letter queue here
              await this.redis.lpush(`${fullQueueName}:failed`, JSON.stringify(message))
            }
          }
        }
      } catch (error) {
        console.error(`❌ Queue processing error for ${queueName}:`, error)
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  /**
   * Start listening for Redis pub/sub messages
   */
  private startMessageListener(): void {
    this.isListening = true
    
    this.subscriberRedis.on('message', (channel: string, message: string) => {
      try {
        const queueMessage = JSON.parse(message)
        const channelName = channel.replace('channel:', '')
        
        const callbacks = this.subscribers.get(channelName)
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              // Pass the payload data, not the entire QueueMessage wrapper
              callback(queueMessage.payload)
            } catch (error) {
              console.error(`❌ Callback error for channel ${channelName}:`, error)
            }
          })
        }
      } catch (error) {
        console.error(`❌ Message parsing error for channel ${channel}:`, error)
      }
    })
  }

  /**
   * Monitor queue health and depth
   */
  private startQueueMonitoring(): void {
    setInterval(async () => {
      try {
        const rawTxLength = await this.redis.llen('queue:raw-transactions')
        const feedLength = await this.redis.llen('queue:feed-updates')
        const pnlLength = await this.redis.llen('queue:pnl-updates')
        const gemLength = await this.redis.llen('queue:gem-discovery')

        // Only log if there are messages to avoid spam
        if (rawTxLength > 0 || feedLength > 0 || pnlLength > 0 || gemLength > 0) {
          logger.debug(`📦 Queue Status: raw=${rawTxLength}, feed=${feedLength}, pnl=${pnlLength}, gem=${gemLength}`, null, 'QUEUE-MONITOR')
        }

        // Log warnings for high queue depths
        if (rawTxLength > 100) {
          logger.warn(`High queue depth - Raw transactions: ${rawTxLength} waiting`, null, 'QUEUE-MONITOR')
        }

        if (feedLength > 50) {
          logger.warn(`High queue depth - Feed updates: ${feedLength} waiting`, null, 'QUEUE-MONITOR')
        }

        if (pnlLength > 25) {
          logger.warn(`High queue depth - PNL updates: ${pnlLength} waiting`, null, 'QUEUE-MONITOR')
        }

      } catch (error) {
        logger.error('Queue monitoring error', error, 'QUEUE-MONITOR')
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Get queue statistics for monitoring
   */
  public async getQueueStats(): Promise<any> {
    const rawTxLength = await this.redis.llen('queue:raw-transactions')
    const feedLength = await this.redis.llen('queue:feed-updates')
    const pnlLength = await this.redis.llen('queue:pnl-updates')
    const gemLength = await this.redis.llen('queue:gem-discovery')
    
    const rawTxFailed = await this.redis.llen('queue:raw-transactions:failed')
    const feedFailed = await this.redis.llen('queue:feed-updates:failed')
    const pnlFailed = await this.redis.llen('queue:pnl-updates:failed')
    const gemFailed = await this.redis.llen('queue:gem-discovery:failed')

    return {
      rawTransactions: {
        waiting: rawTxLength,
        failed: rawTxFailed
      },
      feedUpdates: {
        waiting: feedLength,
        failed: feedFailed
      },
      pnlUpdates: {
        waiting: pnlLength,
        failed: pnlFailed
      },
      gemDiscovery: {
        waiting: gemLength,
        failed: gemFailed
      }
    }
  }

  /**
   * Get queue depth for monitoring
   */
  public async getQueueDepth(queueName: string): Promise<number> {
    return await this.redis.llen(`queue:${queueName}`)
  }

  /**
   * Pop message from Redis list queue (RPOP)
   */
  public async popMessage(queueName: string): Promise<any | null> {
    const fullQueueName = `queue:${queueName}`
    const messageStr = await this.redis.rpop(fullQueueName)
    
    if (!messageStr) {
      return null
    }
    
    try {
      return JSON.parse(messageStr)
    } catch (error) {
      logger.error(`Failed to parse message from ${queueName}`, error, 'MESSAGE-QUEUE')
      return null
    }
  }

  /**
   * Bulk pop messages for batch processing
   */
  public async popMessages(queueName: string, count: number = 10): Promise<any[]> {
    const fullQueueName = `queue:${queueName}`
    const messages: any[] = []
    
    for (let i = 0; i < count; i++) {
      const messageStr = await this.redis.rpop(fullQueueName)
      if (!messageStr) break
      
      try {
        messages.push(JSON.parse(messageStr))
      } catch (error) {
        logger.error(`Failed to parse bulk message from ${queueName}`, error, 'MESSAGE-QUEUE')
      }
    }
    
    return messages
  }

  /**
   * Clear all queues (useful for development/testing)
   */
  public async clearAllQueues(): Promise<void> {
    const queues = [
      'queue:raw-transactions',
      'queue:feed-updates', 
      'queue:pnl-updates',
      'queue:gem-discovery',
      'queue:raw-transactions:failed',
      'queue:feed-updates:failed',
      'queue:pnl-updates:failed',
      'queue:gem-discovery:failed'
    ]
    
    for (const queue of queues) {
      await this.redis.del(queue)
    }
    
    logger.success('All queues cleared', { clearedQueues: queues.length }, 'MESSAGE-QUEUE')
  }

  /**
   * Emergency queue clearing for specific queue
   */
  public async clearQueue(queueName: string): Promise<number> {
    const fullQueueName = `queue:${queueName}`
    const deletedCount = await this.redis.del(fullQueueName)
    
    logger.warn(`Cleared queue ${queueName}`, { deletedEntries: deletedCount }, 'MESSAGE-QUEUE')
    return deletedCount
  }

  /**
   * Generic publish method for backward compatibility
   */
  public async publish(queueName: string, data: any): Promise<void> {
    const message: QueueMessage = {
      id: `${queueName}-${Date.now()}`,
      type: 'gem_discovery', // Default to gem_discovery for backward compatibility
      payload: data,
      timestamp: new Date(),
      retryCount: 0,
      priority: 1
    }

    // Use Redis List as a queue (LPUSH pattern)
    await this.redis.lpush(`queue:${queueName}`, JSON.stringify(message))
    
    // Also publish to subscribers for real-time processing
    await this.redis.publish(`channel:${queueName}`, JSON.stringify(message))
  }

  /**
   * Gracefully shutdown the message queue service
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Message Queue service...')
    
    // Unsubscribe from all channels
    if (this.subscriberRedis.status === 'ready') {
      await this.subscriberRedis.unsubscribe()
    }
    
    // Disconnect Redis connections
    await this.redis.disconnect()
    await this.subscriberRedis.disconnect()
    
    this.isListening = false
    this.subscribers.clear()
    
    console.log('✅ Message Queue service shut down successfully')
  }
} 