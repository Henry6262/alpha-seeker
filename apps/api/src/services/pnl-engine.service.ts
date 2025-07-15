import { prisma } from '../lib/prisma.js'
import { RedisLeaderboardService } from './redis-leaderboard.service.js'
import { SSEService } from './sse.service.js'
import { MessageQueueService } from './message-queue.service.js'

interface TokenPosition {
  walletAddress: string
  tokenMint: string
  currentBalance: number
  totalCostBasis: number
  weightedAvgCost: number
  unrealizedPnl: number
  lastUpdated: Date
}

interface PnlSnapshot {
  walletAddress: string
  period: string
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  roiPercentage: number
  winRate: number
  totalTrades: number
  totalVolume: number
}

interface TokenPrice {
  mint: string
  priceUsd: number
  timestamp: Date
  source: 'jupiter' | 'mock'
}

export class PnlEngineService {
  private redisLeaderboard: RedisLeaderboardService
  private sseService: SSEService
  private messageQueue: MessageQueueService
  private isRunning = false
  private calculationInterval: ReturnType<typeof setInterval> | null = null
  
  // Price cache for real-time price fetching
  private priceCache = new Map<string, TokenPrice>()
  private readonly PRICE_CACHE_TTL = 60000 // 1 minute
  
  // Performance metrics
  private calculationsCompleted = 0
  private errors = 0

  constructor() {
    this.redisLeaderboard = new RedisLeaderboardService()
    this.sseService = new SSEService()
    this.messageQueue = new MessageQueueService()
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting PNL Engine service...')
    
    try {
      // Initialize dependencies
      await this.redisLeaderboard.start()
      await this.sseService.start()
      await this.messageQueue.start()
      
      // Subscribe to PNL update messages
      await this.subscribeToPnlUpdates()
      
      // Start periodic unrealized PNL calculations
      this.startPeriodicCalculations()
      
      this.isRunning = true
      
      console.log('✅ PNL Engine service started successfully')
      
    } catch (error) {
      console.error('❌ Failed to start PNL Engine service:', error)
      throw error
    }
  }

  private async subscribeToPnlUpdates(): Promise<void> {
    console.log('📥 Subscribing to PNL update messages...')
    
    await this.messageQueue.subscribe('pnl-updates', async (updateData: any) => {
      try {
        await this.processPnlUpdate(updateData)
      } catch (error) {
        this.errors++
        console.error('❌ Error processing PNL update:', error)
      }
    })
  }

  private async processPnlUpdate(updateData: any): Promise<void> {
    const { walletAddress, tokenMint, tradeType, amount, priceUsd } = updateData
    
    console.log(`📊 Processing PNL update for ${walletAddress}: ${tradeType} ${amount} ${tokenMint}`)
    
    if (tradeType === 'buy') {
      await this.processBuyTransaction(walletAddress, tokenMint, amount, priceUsd)
    } else if (tradeType === 'sell') {
      await this.processSellTransaction(walletAddress, tokenMint, amount, priceUsd)
    }
    
    // Recalculate unrealized PNL for this wallet
    await this.calculateUnrealizedPnl(walletAddress)
    
    // Update leaderboard snapshots
    await this.updatePnlSnapshots(walletAddress)
  }

  private async processBuyTransaction(
    walletAddress: string,
    tokenMint: string,
    amount: number,
    priceUsd: number
  ): Promise<void> {
    try {
      // Get or create position
      let position = await prisma.kolPosition.findUnique({
        where: {
          kolAddress_tokenMintAddress: {
            kolAddress: walletAddress,
            tokenMintAddress: tokenMint
          }
        }
      })

      const costBasis = amount * priceUsd
      
      if (!position) {
        // Create new position
        position = await prisma.kolPosition.create({
          data: {
            kolAddress: walletAddress,
            tokenMintAddress: tokenMint,
            currentBalanceRaw: BigInt(amount * Math.pow(10, 9)), // Assume 9 decimals
            totalCostBasisUsd: costBasis,
            weightedAvgCostUsd: priceUsd,
            unrealizedPnlUsd: 0,
            lastUpdatedAt: new Date()
          }
        })
        
        console.log(`✅ Created new position: ${walletAddress} - ${amount} ${tokenMint} @ $${priceUsd}`)
      } else {
        // Update existing position using Average Cost Basis
        const currentBalance = Number(position.currentBalanceRaw) / Math.pow(10, 9)
        const newTotalBalance = currentBalance + amount
        const newTotalCostBasis = Number(position.totalCostBasisUsd) + costBasis
        const newWeightedAvgCost = newTotalCostBasis / newTotalBalance
        
        await prisma.kolPosition.update({
          where: {
            kolAddress_tokenMintAddress: {
              kolAddress: walletAddress,
              tokenMintAddress: tokenMint
            }
          },
          data: {
            currentBalanceRaw: BigInt(newTotalBalance * Math.pow(10, 9)),
            totalCostBasisUsd: newTotalCostBasis,
            weightedAvgCostUsd: newWeightedAvgCost,
            lastUpdatedAt: new Date()
          }
        })
        
        console.log(`✅ Updated position: ${walletAddress} - ${newTotalBalance} ${tokenMint} @ avg $${newWeightedAvgCost.toFixed(4)}`)
      }
      
    } catch (error) {
      console.error(`❌ Error processing buy transaction:`, error)
      throw error
    }
  }

  private async processSellTransaction(
    walletAddress: string,
    tokenMint: string,
    amount: number,
    priceUsd: number
  ): Promise<void> {
    try {
      // Get existing position
      const position = await prisma.kolPosition.findUnique({
        where: {
          kolAddress_tokenMintAddress: {
            kolAddress: walletAddress,
            tokenMintAddress: tokenMint
          }
        }
      })

      if (!position) {
        console.log(`⚠️ No position found for sell transaction: ${walletAddress} - ${tokenMint}`)
        return
      }

      const currentBalance = Number(position.currentBalanceRaw) / Math.pow(10, 9)
      const weightedAvgCost = Number(position.weightedAvgCostUsd)
      
      if (amount > currentBalance) {
        console.log(`⚠️ Sell amount (${amount}) exceeds current balance (${currentBalance})`)
        amount = currentBalance // Can't sell more than you have
      }

      // Calculate realized PNL using Average Cost Basis
      const costBasisForSale = amount * weightedAvgCost
      const saleValue = amount * priceUsd
      const realizedPnl = saleValue - costBasisForSale
      
      // Update position
      const newBalance = currentBalance - amount
      const newTotalCostBasis = Number(position.totalCostBasisUsd) - costBasisForSale
      
      if (newBalance > 0) {
        // Partial sale - update position
        await prisma.kolPosition.update({
          where: {
            kolAddress_tokenMintAddress: {
              kolAddress: walletAddress,
              tokenMintAddress: tokenMint
            }
          },
          data: {
            currentBalanceRaw: BigInt(newBalance * Math.pow(10, 9)),
            totalCostBasisUsd: newTotalCostBasis,
            lastUpdatedAt: new Date()
          }
        })
      } else {
        // Complete sale - delete position
        await prisma.kolPosition.delete({
          where: {
            kolAddress_tokenMintAddress: {
              kolAddress: walletAddress,
              tokenMintAddress: tokenMint
            }
          }
        })
      }
      
      // Record realized PNL event
      await prisma.kolRealizedPnlEvent.create({
        data: {
          kolAddress: walletAddress,
          tokenMintAddress: tokenMint,
          closingTransactionSignature: `mock_tx_${Date.now()}`, // Would use actual transaction signature
          quantitySold: BigInt(amount * Math.pow(10, 9)), // Convert to raw amount
          saleValueUsd: saleValue,
          costBasisUsd: costBasisForSale,
          realizedPnlUsd: realizedPnl,
          roiPercentage: (realizedPnl / costBasisForSale) * 100,
          closedAt: new Date()
        }
      })
      
      console.log(`💰 Realized PNL: ${walletAddress} - ${amount} ${tokenMint} = $${realizedPnl.toFixed(2)} (${((realizedPnl / costBasisForSale) * 100).toFixed(2)}%)`)
      
    } catch (error) {
      console.error(`❌ Error processing sell transaction:`, error)
      throw error
    }
  }

  private async calculateUnrealizedPnl(walletAddress: string): Promise<void> {
    try {
      // Get all current positions for the wallet
      const positions = await prisma.kolPosition.findMany({
        where: { kolAddress: walletAddress }
      })

      for (const position of positions) {
        const currentBalance = Number(position.currentBalanceRaw) / Math.pow(10, 9)
        const weightedAvgCost = Number(position.weightedAvgCostUsd)
        
        // Get current market price
        const currentPrice = await this.getCurrentTokenPrice(position.tokenMintAddress)
        
        if (currentPrice && currentBalance > 0) {
          // Calculate unrealized PNL
          const currentMarketValue = currentBalance * currentPrice
          const totalCostBasis = Number(position.totalCostBasisUsd)
          const unrealizedPnl = currentMarketValue - totalCostBasis
          
          // Update position with unrealized PNL
          await prisma.kolPosition.update({
            where: {
              kolAddress_tokenMintAddress: {
                kolAddress: position.kolAddress,
                tokenMintAddress: position.tokenMintAddress
              }
            },
            data: {
              unrealizedPnlUsd: unrealizedPnl,
              lastUpdatedAt: new Date()
            }
          })
          
          console.log(`📈 Unrealized PNL: ${walletAddress} - ${position.tokenMintAddress} = $${unrealizedPnl.toFixed(2)}`)
        }
      }
      
    } catch (error) {
      console.error(`❌ Error calculating unrealized PNL for ${walletAddress}:`, error)
    }
  }

  private async getCurrentTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      const now = Date.now()
      const cached = this.priceCache.get(tokenMint)
      
      // Check cache
      if (cached && (now - cached.timestamp.getTime()) < this.PRICE_CACHE_TTL) {
        return cached.priceUsd
      }
      
      // Fetch from Jupiter API (mock for now)
      const price = await this.fetchTokenPriceFromJupiter(tokenMint)
      
      if (price !== null) {
        this.priceCache.set(tokenMint, {
          mint: tokenMint,
          priceUsd: price,
          timestamp: new Date(),
          source: 'mock'
        })
      }
      
      return price
      
    } catch (error) {
      console.error(`❌ Error getting current token price for ${tokenMint}:`, error)
      return null
    }
  }

  private async fetchTokenPriceFromJupiter(tokenMint: string): Promise<number | null> {
    // Mock implementation - would use actual Jupiter Price API
    const mockPrices: { [key: string]: number } = {
      'So11111111111111111111111111111111111111112': 100, // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
    }
    
    return mockPrices[tokenMint] || Math.random() * 10 // Random price for other tokens
  }

  private async updatePnlSnapshots(walletAddress: string): Promise<void> {
    try {
      const timeframes = ['1H', '1D', '7D', '30D']
      
      for (const period of timeframes) {
        const snapshot = await this.calculatePnlSnapshot(walletAddress, period)
        
        if (snapshot) {
          // Upsert PNL snapshot
          await prisma.kolPnlSnapshot.upsert({
            where: {
              kolAddress_period_snapshotTimestamp: {
                kolAddress: walletAddress,
                period: period,
                snapshotTimestamp: new Date()
              }
            },
            create: {
              kolAddress: walletAddress,
              period: period,
              snapshotTimestamp: new Date(),
              realizedPnlUsd: snapshot.realizedPnl,
              unrealizedPnlUsd: snapshot.unrealizedPnl,
              totalPnlUsd: snapshot.totalPnl,
              roiPercentage: snapshot.roiPercentage,
              winRate: snapshot.winRate,
              totalTrades: snapshot.totalTrades,
              totalVolumeUsd: snapshot.totalVolume
            },
            update: {
              realizedPnlUsd: snapshot.realizedPnl,
              unrealizedPnlUsd: snapshot.unrealizedPnl,
              totalPnlUsd: snapshot.totalPnl,
              roiPercentage: snapshot.roiPercentage,
              winRate: snapshot.winRate,
              totalTrades: snapshot.totalTrades,
              totalVolumeUsd: snapshot.totalVolume
            }
          })
          
          // Update Redis leaderboard
          await this.redisLeaderboard.updateWalletPnl(
            walletAddress,
            snapshot.totalPnl,
            [this.mapPeriodToTimeframe(period)]
          )
        }
      }
      
    } catch (error) {
      console.error(`❌ Error updating PNL snapshots for ${walletAddress}:`, error)
    }
  }

  private async calculatePnlSnapshot(walletAddress: string, period: string): Promise<PnlSnapshot | null> {
    try {
      const periodDate = this.getPeriodStartDate(period)
      
      // Calculate realized PNL for the period
      const realizedPnlEvents = await prisma.kolRealizedPnlEvent.findMany({
        where: {
          kolAddress: walletAddress,
          closedAt: {
            gte: periodDate
          }
        }
      })
      
      const realizedPnl = realizedPnlEvents.reduce((sum, event) => 
        sum + Number(event.realizedPnlUsd), 0
      )
      
      // Calculate unrealized PNL from current positions
      const positions = await prisma.kolPosition.findMany({
        where: { kolAddress: walletAddress }
      })
      
      const unrealizedPnl = positions.reduce((sum, position) => 
        sum + Number(position.unrealizedPnlUsd || 0), 0
      )
      
      const totalPnl = realizedPnl + unrealizedPnl
      
      // Calculate win rate
      const winningTrades = realizedPnlEvents.filter(event => 
        Number(event.realizedPnlUsd) > 0
      ).length
      const totalTrades = realizedPnlEvents.length
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
      
      // Calculate total volume
      const totalVolume = realizedPnlEvents.reduce((sum, event) => 
        sum + Number(event.saleValueUsd), 0
      )
      
      // Calculate ROI percentage
      const totalCostBasis = positions.reduce((sum, position) => 
        sum + Number(position.totalCostBasisUsd), 0
      )
      const roiPercentage = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0
      
      return {
        walletAddress,
        period,
        realizedPnl,
        unrealizedPnl,
        totalPnl,
        roiPercentage,
        winRate,
        totalTrades,
        totalVolume
      }
      
    } catch (error) {
      console.error(`❌ Error calculating PNL snapshot:`, error)
      return null
    }
  }

  private getPeriodStartDate(period: string): Date {
    const now = new Date()
    
    switch (period) {
      case '1H':
        return new Date(now.getTime() - (60 * 60 * 1000))
      case '1D':
        return new Date(now.getTime() - (24 * 60 * 60 * 1000))
      case '7D':
        return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      case '30D':
        return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
      default:
        return new Date(now.getTime() - (24 * 60 * 60 * 1000))
    }
  }

  private mapPeriodToTimeframe(period: string): '1h' | '1d' | '7d' | '30d' {
    switch (period) {
      case '1H': return '1h'
      case '1D': return '1d'
      case '7D': return '7d'
      case '30D': return '30d'
      default: return '1d'
    }
  }

  private startPeriodicCalculations(): void {
    console.log('⏰ Starting periodic unrealized PNL calculations...')
    
    // Run unrealized PNL calculations every 60 seconds
    this.calculationInterval = setInterval(async () => {
      try {
        await this.runPeriodicCalculations()
        this.calculationsCompleted++
        
        if (this.calculationsCompleted % 10 === 0) {
          console.log(`📊 Completed ${this.calculationsCompleted} PNL calculation cycles (${this.errors} errors)`)
        }
        
      } catch (error) {
        this.errors++
        console.error('❌ Error in periodic PNL calculations:', error)
      }
    }, 60000) // Every 60 seconds
  }

  private async runPeriodicCalculations(): Promise<void> {
    // Get all KOL wallets with positions
    const walletsWithPositions = await prisma.kolWallet.findMany({
      include: {
        positions: true
      }
    })
    
    console.log(`🔄 Running periodic PNL calculations for ${walletsWithPositions.length} wallets...`)
    
    for (const wallet of walletsWithPositions) {
      if (wallet.positions.length > 0) {
        await this.calculateUnrealizedPnl(wallet.address)
        await this.updatePnlSnapshots(wallet.address)
      }
    }
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping PNL Engine service...')
    this.isRunning = false
    
    if (this.calculationInterval) {
      clearInterval(this.calculationInterval)
      this.calculationInterval = null
    }
    
    this.priceCache.clear()
  }

  public getStatus(): {
    isRunning: boolean
    calculationsCompleted: number
    errors: number
    priceCacheSize: number
  } {
    return {
      isRunning: this.isRunning,
      calculationsCompleted: this.calculationsCompleted,
      errors: this.errors,
      priceCacheSize: this.priceCache.size
    }
  }

  public async manualCalculateAllPnl(): Promise<void> {
    console.log('🔄 Manual PNL calculation triggered for all wallets...')
    await this.runPeriodicCalculations()
  }
}

// Export singleton instance
export const pnlEngineService = new PnlEngineService() 