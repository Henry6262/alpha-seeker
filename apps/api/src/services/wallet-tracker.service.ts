import { GeyserService } from './geyser.service.js'
import { prisma } from '../lib/prisma.js'
import { appConfig } from '../config/index.js'

export type Timeframe = '7d' | '30d'

export interface WalletTrackingRequest {
  timeframe?: Timeframe
  limit?: number
}

export interface WalletTrackingResponse {
  totalWallets: number
  trackedWallets: string[]
  message: string
}

export class WalletTrackerService {
  private geyserService: GeyserService | null = null

  constructor(geyserService?: GeyserService) {
    this.geyserService = geyserService || null
  }

  /**
   * Get top wallets from leaderboard cache for tracking
   */
  async getLeaderboardWalletsForTracking(
    timeframe: Timeframe = appConfig.walletTracking.defaultTimeframe,
    limit: number = appConfig.walletTracking.maxWalletsToTrack
  ): Promise<string[]> {
    try {
      console.log(`🎯 Getting top ${limit} wallets from ${timeframe} leaderboard for real-time tracking...`)
      
      // Get current leaderboard entries from cache
      const leaderboardEntries = await prisma.duneLeaderboardCache.findMany({
        where: {
          period: timeframe === '7d' ? '7D' : '30D'
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

      const walletAddresses = leaderboardEntries.map((entry: any) => entry.walletAddress)
      
      console.log(`✅ Found ${walletAddresses.length} wallets from ${timeframe} leaderboard:`)
      walletAddresses.forEach((address: string, index: number) => {
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
    
    const snapshots = await prisma.kolPnlSnapshot.findMany({
      where: { period },
      orderBy: [
        { realizedPnlUsd: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      select: {
        kolAddress: true
      }
    })

    const walletAddresses = snapshots.map(snapshot => snapshot.kolAddress)
    
    console.log(`✅ Found ${walletAddresses.length} wallets from PNL snapshots:`)
    walletAddresses.forEach((address, index) => {
      console.log(`  ${index + 1}. ${address}`)
    })

    return walletAddresses
  }

  /**
   * Subscribe to real-time tracking for top leaderboard wallets
   */
  async subscribeToLeaderboardWallets(
    geyserService: GeyserService,
    options: WalletTrackingRequest = {}
  ): Promise<WalletTrackingResponse> {
    const { 
      timeframe = appConfig.walletTracking.defaultTimeframe,
      limit = appConfig.walletTracking.maxWalletsToTrack 
    } = options

    try {
      // Get top wallets from leaderboard
      const walletAddresses = await this.getLeaderboardWalletsForTracking(timeframe, limit)

      if (walletAddresses.length === 0) {
        return {
          totalWallets: 0,
          trackedWallets: [],
          message: `No wallets found for ${timeframe} timeframe`
        }
      }

      // Subscribe to wallet account changes
      console.log(`📡 Subscribing to ${walletAddresses.length} wallet accounts...`)
      await geyserService.subscribeToWalletAccounts(walletAddresses)

      // Subscribe to wallet token account changes
      console.log(`💰 Subscribing to ${walletAddresses.length} wallet token accounts...`)
      await geyserService.subscribeToWalletTokenAccounts(walletAddresses)

      // Update tracking status in database
      await this.updateWalletTrackingStatus(walletAddresses, true)

      return {
        totalWallets: walletAddresses.length,
        trackedWallets: walletAddresses,
        message: `Successfully subscribed to ${walletAddresses.length} wallets from ${timeframe} leaderboard`
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
    try {
      console.log(`🔄 Updating tracking status for ${walletAddresses.length} wallets...`)
      
      // Update each wallet's tracking status
      const updatePromises = walletAddresses.map(address =>
        prisma.kolWallet.upsert({
          where: { address },
          update: { 
            updatedAt: new Date()
          },
          create: {
            address,
            curatedName: `Tracked Wallet ${address.slice(0, 8)}...`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      )

      await Promise.all(updatePromises)
      console.log(`✅ Updated tracking status for ${walletAddresses.length} wallets`)
    } catch (error) {
      console.error('❌ Failed to update wallet tracking status:', error)
      throw error
    }
  }

  /**
   * Get summary of tracked wallets with their performance
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
      const trackedWallets = await prisma.kolWallet.findMany({
        include: {
          pnlSnapshots: {
            where: {
              period: {
                in: ['7D', '30D']
              }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 2
          }
        }
      })

      const leaderboardWallets = trackedWallets.map((wallet: any) => {
        const pnl7d = wallet.pnlSnapshots.find((s: any) => s.period === '7D')?.realizedPnlUsd
        const pnl30d = wallet.pnlSnapshots.find((s: any) => s.period === '30D')?.realizedPnlUsd
        
        return {
          address: wallet.address,
          curatedName: wallet.curatedName,
          pnl7d: pnl7d ? Number(pnl7d) : undefined,
          pnl30d: pnl30d ? Number(pnl30d) : undefined,
          isTracked: true
        }
      })

      return {
        totalTracked: trackedWallets.length,
        leaderboardWallets: leaderboardWallets.sort((a, b) => 
          (b.pnl7d || 0) - (a.pnl7d || 0)
        )
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
    // Implementation depends on how tracking is managed
    // For now, just log the action
    console.log(`🔄 Stopping tracking for ${walletAddresses.length} wallets:`)
    walletAddresses.forEach(address => {
      console.log(`  - ${address}`)
    })
  }
} 