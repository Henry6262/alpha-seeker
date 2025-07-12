import { PrismaClient } from '@prisma/client'
import { GeyserService } from './geyser.service.js'
import { appConfig } from '../config/index.js'
import { 
  Timeframe, 
  WalletTrackingRequest, 
  WalletTrackingResponse, 
  WalletMetadata,
  isValidTimeframe 
} from '../types/index.js'

const prisma = new PrismaClient()

export class WalletTrackerService {
  private geyserService: GeyserService | null = null

  constructor(geyserService?: GeyserService) {
    this.geyserService = geyserService || null
  }

  /**
   * Get wallets from 7-day PNL leaderboard for real-time tracking
   * This is the bridge between historical performance and live tracking
   */
  async getLeaderboardWalletsForTracking(
    timeframe: Timeframe = appConfig.walletTracking.defaultTimeframe,
    limit: number = appConfig.walletTracking.maxWalletsToTrack
  ): Promise<string[]> {
    try {
      console.log(`🎯 Getting top ${limit} wallets from ${timeframe} leaderboard for real-time tracking...`)
      
      // Get current leaderboard entries from cache
      const leaderboardEntries = await prisma.leaderboardCache.findMany({
        where: {
          leaderboardType: 'pnl',
          timeframe: timeframe,
          ecosystem: 'all',
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          rank: 'asc'
        },
        take: limit
      })

      if (leaderboardEntries.length === 0) {
        console.log('⚠️ No leaderboard entries found, falling back to PNL snapshots...')
        return await this.getWalletsFromPnlSnapshots(timeframe as '7d' | '30d', limit)
      }

      const walletAddresses = leaderboardEntries.map(entry => entry.walletAddress)
      
      console.log(`✅ Found ${walletAddresses.length} wallets from ${timeframe} leaderboard:`)
      walletAddresses.forEach((address, index) => {
        console.log(`  ${index + 1}. ${address}`)
      })

      return walletAddresses
    } catch (error) {
      console.error('❌ Failed to get leaderboard wallets:', error)
      throw error
    }
  }

  /**
   * Fallback: Get wallets directly from PNL snapshots
   */
  private async getWalletsFromPnlSnapshots(
    timeframe: '7d' | '30d',
    limit: number
  ): Promise<string[]> {
    const period = timeframe === '7d' ? '7D' : '30D'
    
    const snapshots = await prisma.pnlSnapshot.findMany({
      where: { period },
      orderBy: [
        { realizedPnlUsd: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit
    })

    // Deduplicate by wallet address, keeping highest PNL entry
    const deduplicatedWallets = new Map<string, typeof snapshots[0]>()
    for (const snapshot of snapshots) {
      const existing = deduplicatedWallets.get(snapshot.walletAddress)
      if (!existing || snapshot.realizedPnlUsd > existing.realizedPnlUsd) {
        deduplicatedWallets.set(snapshot.walletAddress, snapshot)
      }
    }

    const walletAddresses = Array.from(deduplicatedWallets.keys())
    console.log(`✅ Found ${walletAddresses.length} wallets from ${period} PNL snapshots`)
    
    return walletAddresses
  }

  /**
   * Subscribe to real-time tracking for leaderboard wallets using multi-stream allocation
   * This is the key integration point between historical data and live tracking
   */
  async subscribeToLeaderboardWallets(
    geyserService: GeyserService,
    options: WalletTrackingRequest = {}
  ): Promise<WalletTrackingResponse> {
    try {
      const { 
        timeframe = appConfig.walletTracking.defaultTimeframe,
        limit = appConfig.walletTracking.maxWalletsToTrack,
        includeTransactions = true,
        includeAccountUpdates = true
      } = options

      console.log(`🚀 Starting multi-stream leaderboard wallet subscription for ${timeframe} top ${limit} traders...`)

      if (!geyserService.getStatus().connected) {
        throw new Error('Geyser service not connected')
      }

      // Validate that we can track the requested number of wallets
      const maxTrackable = appConfig.geyser.maxConcurrentStreams * appConfig.geyser.maxAccountsPerStream
      if (limit > maxTrackable) {
        throw new Error(
          `Cannot track ${limit} wallets. Maximum trackable with current Chainstack plan: ${maxTrackable} ` +
          `(${appConfig.geyser.maxConcurrentStreams} streams × ${appConfig.geyser.maxAccountsPerStream} accounts)`
        )
      }

      // Get top performing wallets from leaderboard
      const walletAddresses = await this.getLeaderboardWalletsForTracking(timeframe, limit)

      if (walletAddresses.length === 0) {
        console.log('⚠️ No wallets found to subscribe to')
        return {
          success: false,
          subscribedWallets: []
        }
      }

      console.log(`📊 Planning to track ${walletAddresses.length} wallets across multiple streams...`)

      // Update wallet tracking status in database
      await this.updateWalletTrackingStatus(walletAddresses, true)

      let transactionSubscription = false
      let accountSubscription = false

      // Use multi-stream subscription for account updates (primary tracking method)
      if (includeAccountUpdates) {
        console.log('🎯 Setting up multi-stream wallet tracking...')
        
        // Track wallets using existing trackWallet method
        const trackingPromises = walletAddresses.map(address => 
          geyserService.trackWallet(address).catch(error => {
            console.error(`Failed to track wallet ${address}:`, error)
            return null
          })
        )
        
        const results = await Promise.allSettled(trackingPromises)
        const successfulTracking = results.filter(result => result.status === 'fulfilled').length
        
        if (successfulTracking > 0) {
          accountSubscription = true
          console.log(`✅ Multi-stream setup successful:`)
          console.log(`   - Wallets tracked: ${successfulTracking}/${walletAddresses.length}`)
          console.log(`   - Stream utilization: ${((successfulTracking / appConfig.geyser.maxAccountsPerStream) * 100).toFixed(1)}%`)
        }
      }

      // Optional: Subscribe to wallet transactions for trade detection
      if (includeTransactions) {
        console.log('📈 Subscribing to wallet transactions...')
        // For now, we'll just log this as transaction tracking is handled by the existing trackWallet method
        console.log('ℹ️ Transaction tracking is included in wallet tracking')
        transactionSubscription = true
      }

      console.log(`✅ Successfully subscribed to ${walletAddresses.length} leaderboard wallets`)
      console.log(`📋 Subscription details:`)
      console.log(`   - Timeframe: ${timeframe}`)
      console.log(`   - Wallet count: ${walletAddresses.length}`)
      console.log(`   - Multi-stream tracking: ${accountSubscription}`)
      console.log(`   - Transaction tracking: ${transactionSubscription}`)

      return {
        success: true,
        subscribedWallets: walletAddresses,
        transactionSubscription,
        accountSubscription
      }
    } catch (error) {
      console.error('❌ Failed to subscribe to leaderboard wallets:', error)
      throw error
    }
  }

  /**
   * Update wallet tracking status in database
   */
  private async updateWalletTrackingStatus(
    walletAddresses: string[],
    isTracked: boolean
  ): Promise<void> {
    const updates = walletAddresses.map(address =>
      prisma.wallet.upsert({
        where: { address },
        update: {
          isLeaderboardUser: true,
          metadataJson: JSON.stringify({
            realTimeTracking: isTracked,
            trackingStartedAt: new Date().toISOString(),
            trackingSource: 'leaderboard_7d'
          })
        },
        create: {
          address,
          isLeaderboardUser: true,
          isFamousTrader: false,
          firstSeenAt: new Date(),
          metadataJson: JSON.stringify({
            realTimeTracking: isTracked,
            trackingStartedAt: new Date().toISOString(),
            trackingSource: 'leaderboard_7d'
          })
        }
      })
    )

    await Promise.all(updates)
    console.log(`✅ Updated tracking status for ${walletAddresses.length} wallets`)
  }

  /**
   * Get currently tracked wallets with their leaderboard performance
   */
  async getTrackedWalletsSummary(): Promise<{
    totalTracked: number
    leaderboardWallets: Array<{
      address: string
      curatedName?: string
      rank?: number
      pnl7d?: number
      pnl30d?: number
      isTracked: boolean
    }>
  }> {
    try {
      const trackedWallets = await prisma.wallet.findMany({
        where: {
          isLeaderboardUser: true
        },
        include: {
          pnlSnapshots: {
            where: {
              period: { in: ['7D', '30D'] }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 2
          }
        }
      })

      const leaderboardWallets = trackedWallets.map(wallet => {
        const pnl7d = wallet.pnlSnapshots.find(s => s.period === '7D')?.realizedPnlUsd
        const pnl30d = wallet.pnlSnapshots.find(s => s.period === '30D')?.realizedPnlUsd
        
        let isTracked = false
        try {
          const metadata = wallet.metadataJson ? JSON.parse(wallet.metadataJson) : {}
          isTracked = metadata.realTimeTracking || false
        } catch (e) {
          // Ignore JSON parse errors
        }

        return {
          address: wallet.address,
          curatedName: wallet.curatedName || undefined,
          pnl7d,
          pnl30d,
          isTracked
        }
      })

      return {
        totalTracked: trackedWallets.length,
        leaderboardWallets
      }
    } catch (error) {
      console.error('❌ Failed to get tracked wallets summary:', error)
      throw error
    }
  }

  /**
   * Stop tracking specific wallets
   */
  async stopTrackingWallets(walletAddresses: string[]): Promise<void> {
    await this.updateWalletTrackingStatus(walletAddresses, false)
    console.log(`🛑 Stopped tracking ${walletAddresses.length} wallets`)
  }
} 