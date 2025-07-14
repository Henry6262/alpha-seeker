import Redis from 'ioredis'
import { RedisLeaderboardEntry, RedisConfig } from '../types/index.js'

export class RedisLeaderboardService {
  private redis: Redis
  private readonly connectionConfig: {
    host: string
    port: number
    password?: string
    database: number
  }

  // Leaderboard keys for different timeframes
  private readonly LEADERBOARD_KEYS = {
    '1h': 'leaderboard:pnl:1h',
    '1d': 'leaderboard:pnl:1d', 
    '7d': 'leaderboard:pnl:7d',
    '30d': 'leaderboard:pnl:30d'
  } as const

  constructor() {
    // Use environment variables for Redis configuration
    this.connectionConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DATABASE || '1') // Use DB 1 for leaderboard
    }

    this.redis = new Redis(this.connectionConfig)
  }

  /**
   * Start the Redis Leaderboard service
   */
  public async start(): Promise<void> {
    console.log('🚀 Starting Redis Leaderboard service...')
    
    try {
      // Test Redis connection
      await this.redis.ping()
      console.log('✅ Connected to Redis for leaderboard successfully')
      
      // Initialize leaderboard keys if they don't exist
      await this.initializeLeaderboards()
      
      console.log('✅ Redis Leaderboard service started successfully')
    } catch (error) {
      console.error('❌ Failed to start Redis Leaderboard service:', error)
      throw error
    }
  }

  /**
   * Update a wallet's PNL score in the leaderboard
   */
  public async updateWalletPnl(
    walletAddress: string, 
    pnlUsd: number, 
    timeframes: ('1h' | '1d' | '7d' | '30d')[] = ['1h', '1d', '7d', '30d']
  ): Promise<void> {
    try {
      // Use pipeline for atomic updates across multiple timeframes
      const pipeline = this.redis.pipeline()
      
      for (const timeframe of timeframes) {
        const key = this.LEADERBOARD_KEYS[timeframe]
        // ZADD adds member with score (PNL value)
        pipeline.zadd(key, pnlUsd, walletAddress)
      }
      
      await pipeline.exec()
      
      console.log(`✅ Updated PNL for ${walletAddress}: $${pnlUsd.toFixed(2)}`)
    } catch (error) {
      console.error(`❌ Failed to update PNL for ${walletAddress}:`, error)
      throw error
    }
  }

  /**
   * Get top wallets from leaderboard (highest PNL first)
   */
  public async getTopWallets(
    timeframe: '1h' | '1d' | '7d' | '30d' = '1d',
    limit: number = 100
  ): Promise<RedisLeaderboardEntry[]> {
    try {
      const key = this.LEADERBOARD_KEYS[timeframe]
      
      // ZREVRANGE gets members in descending order (highest PNL first)
      // WITHSCORES includes the PNL values
      const results = await this.redis.zrevrange(key, 0, limit - 1, 'WITHSCORES')
      
      const leaderboard: RedisLeaderboardEntry[] = []
      
      // Redis returns [member, score, member, score, ...]
      for (let i = 0; i < results.length; i += 2) {
        const walletAddress = results[i] as string
        const pnlUsd = parseFloat(results[i + 1] as string)
        const rank = Math.floor(i / 2) + 1
        
        leaderboard.push({
          walletAddress,
          pnlUsd,
          rank,
          period: timeframe
        })
      }
      
      return leaderboard
    } catch (error) {
      console.error(`❌ Failed to get top wallets for ${timeframe}:`, error)
      throw error
    }
  }

  /**
   * Get a specific wallet's rank and PNL
   */
  public async getWalletRank(
    walletAddress: string,
    timeframe: '1h' | '1d' | '7d' | '30d' = '1d'
  ): Promise<RedisLeaderboardEntry | null> {
    try {
      const key = this.LEADERBOARD_KEYS[timeframe]
      
      // Get wallet's score (PNL)
      const pnlUsd = await this.redis.zscore(key, walletAddress)
      
      if (pnlUsd === null) {
        return null // Wallet not found in leaderboard
      }
      
      // Get wallet's rank (1-based)
      const rank = await this.redis.zrevrank(key, walletAddress)
      
      return {
        walletAddress,
        pnlUsd: parseFloat(pnlUsd),
        rank: rank !== null ? rank + 1 : 0, // ZREVRANK returns 0-based index
        period: timeframe
      }
    } catch (error) {
      console.error(`❌ Failed to get rank for ${walletAddress}:`, error)
      throw error
    }
  }

  /**
   * Get wallets within a specific rank range
   */
  public async getWalletsByRankRange(
    startRank: number,
    endRank: number,
    timeframe: '1h' | '1d' | '7d' | '30d' = '1d'
  ): Promise<RedisLeaderboardEntry[]> {
    try {
      const key = this.LEADERBOARD_KEYS[timeframe]
      
      // Convert 1-based ranks to 0-based indices
      const startIndex = startRank - 1
      const endIndex = endRank - 1
      
      const results = await this.redis.zrevrange(key, startIndex, endIndex, 'WITHSCORES')
      
      const leaderboard: RedisLeaderboardEntry[] = []
      
      for (let i = 0; i < results.length; i += 2) {
        const walletAddress = results[i] as string
        const pnlUsd = parseFloat(results[i + 1] as string)
        const rank = startRank + Math.floor(i / 2)
        
        leaderboard.push({
          walletAddress,
          pnlUsd,
          rank,
          period: timeframe
        })
      }
      
      return leaderboard
    } catch (error) {
      console.error(`❌ Failed to get wallets by rank range ${startRank}-${endRank}:`, error)
      throw error
    }
  }

  /**
   * Get total number of wallets in leaderboard
   */
  public async getLeaderboardSize(timeframe: '1h' | '1d' | '7d' | '30d' = '1d'): Promise<number> {
    try {
      const key = this.LEADERBOARD_KEYS[timeframe]
      return await this.redis.zcard(key)
    } catch (error) {
      console.error(`❌ Failed to get leaderboard size for ${timeframe}:`, error)
      throw error
    }
  }

  /**
   * Remove a wallet from all leaderboards
   */
  public async removeWallet(walletAddress: string): Promise<void> {
    try {
      const pipeline = this.redis.pipeline()
      
      Object.values(this.LEADERBOARD_KEYS).forEach(key => {
        pipeline.zrem(key, walletAddress)
      })
      
      await pipeline.exec()
      
      console.log(`✅ Removed ${walletAddress} from all leaderboards`)
    } catch (error) {
      console.error(`❌ Failed to remove ${walletAddress} from leaderboards:`, error)
      throw error
    }
  }

  /**
   * Batch update multiple wallets' PNL scores
   */
  public async batchUpdatePnl(
    updates: Array<{ walletAddress: string; pnlUsd: number }>,
    timeframes: ('1h' | '1d' | '7d' | '30d')[] = ['1h', '1d', '7d', '30d']
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline()
      
      for (const timeframe of timeframes) {
        const key = this.LEADERBOARD_KEYS[timeframe]
        
        // Add all updates for this timeframe
        const zaddArgs: (string | number)[] = [key]
        updates.forEach(({ walletAddress, pnlUsd }) => {
          zaddArgs.push(pnlUsd, walletAddress)
        })
        
        pipeline.zadd(zaddArgs[0] as string, ...zaddArgs.slice(1) as (string | number)[])
      }
      
      await pipeline.exec()
      
      console.log(`✅ Batch updated ${updates.length} wallets across ${timeframes.length} timeframes`)
    } catch (error) {
      console.error(`❌ Failed to batch update PNL:`, error)
      throw error
    }
  }

  /**
   * Get leaderboard statistics
   */
  public async getLeaderboardStats(): Promise<{
    [K in keyof typeof this.LEADERBOARD_KEYS]: {
      totalWallets: number
      topPnl: number | null
      bottomPnl: number | null
      averagePnl: number | null
    }
  }> {
    try {
      const stats = {} as any
      
      for (const [timeframe, key] of Object.entries(this.LEADERBOARD_KEYS)) {
        const totalWallets = await this.redis.zcard(key)
        
        let topPnl = null
        let bottomPnl = null
        let averagePnl = null
        
        if (totalWallets > 0) {
          // Get highest PNL (rank 0 in reverse order)
          const topResult = await this.redis.zrevrange(key, 0, 0, 'WITHSCORES')
          topPnl = topResult.length > 1 ? parseFloat(topResult[1] as string) : null
          
          // Get lowest PNL (rank -1 in reverse order)
          const bottomResult = await this.redis.zrevrange(key, -1, -1, 'WITHSCORES')
          bottomPnl = bottomResult.length > 1 ? parseFloat(bottomResult[1] as string) : null
          
          // Calculate average PNL
          if (topPnl !== null && bottomPnl !== null) {
            averagePnl = (topPnl + bottomPnl) / 2 // Simplified average
          }
        }
        
        stats[timeframe] = {
          totalWallets,
          topPnl,
          bottomPnl,
          averagePnl
        }
      }
      
      return stats
    } catch (error) {
      console.error('❌ Failed to get leaderboard stats:', error)
      throw error
    }
  }

  /**
   * Clear all leaderboards (useful for development/testing)
   */
  public async clearAllLeaderboards(): Promise<void> {
    try {
      const pipeline = this.redis.pipeline()
      
      Object.values(this.LEADERBOARD_KEYS).forEach(key => {
        pipeline.del(key)
      })
      
      await pipeline.exec()
      
      console.log('✅ All leaderboards cleared')
    } catch (error) {
      console.error('❌ Failed to clear leaderboards:', error)
      throw error
    }
  }

  /**
   * Initialize leaderboard keys with empty sorted sets
   */
  private async initializeLeaderboards(): Promise<void> {
    try {
      for (const [timeframe, key] of Object.entries(this.LEADERBOARD_KEYS)) {
        const exists = await this.redis.exists(key)
        if (!exists) {
          // Initialize empty sorted set
          await this.redis.zadd(key, 0, 'placeholder')
          await this.redis.zrem(key, 'placeholder')
          console.log(`✅ Initialized leaderboard for ${timeframe}`)
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize leaderboards:', error)
      throw error
    }
  }

  /**
   * Gracefully shutdown the Redis Leaderboard service
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Redis Leaderboard service...')
    
    try {
      await this.redis.disconnect()
      console.log('✅ Redis Leaderboard service shut down successfully')
    } catch (error) {
      console.error('❌ Error shutting down Redis Leaderboard service:', error)
    }
  }
} 