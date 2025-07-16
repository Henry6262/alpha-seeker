import { prisma } from '../lib/prisma.js'
import { MessageQueueService } from './message-queue.service.js'
import { SSEService } from './sse.service.js'
import { RedisLeaderboardService } from './redis-leaderboard.service.js'

interface GemCandidate {
  tokenMintAddress: string
  discoveryTimestamp: Date
  famousBuyerAddresses: string[]
  totalFamousVolumeUsd: number
  confidenceScore: number
  marketCapAtDiscovery?: number
  metadata?: any
}

interface TokenAnalytics {
  mintAddress: string
  kolBuyers: string[]
  totalVolume: number
  firstSeenTimestamp: Date
  averagePurchaseSize: number
  uniqueBuyerCount: number
  avgBuyerReputation: number
  timeWindow: string
}

export class GemFinderService {
  private messageQueue: MessageQueueService
  private sseService: SSEService
  private redisLeaderboard: RedisLeaderboardService
  private isRunning = false
  
  // Gem discovery parameters
  private readonly MIN_KOL_BUYERS = 2 // Minimum KOLs must buy before considering
  private readonly MIN_VOLUME_USD = 5000 // Minimum combined volume from KOLs
  private readonly MIN_CONFIDENCE_SCORE = 0.6 // Minimum confidence threshold
  private readonly DISCOVERY_WINDOW_HOURS = 24 // Look for patterns within 24 hours
  private readonly ANALYSIS_INTERVAL_MS = 30000 // Run analysis every 30 seconds
  
  // Token filters
  private readonly EXCLUDED_MINTS = new Set([
    'So11111111111111111111111111111111111111112', // SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
  ])
  
  private readonly SUSPICIOUS_PATTERNS = [
    'scam', 'rug', 'test', 'fake', 'spam', 'airdrop'
  ]
  
  private processedTokens = new Set<string>()
  private analysisTimer: any = null

  constructor() {
    this.messageQueue = new MessageQueueService()
    this.sseService = new SSEService()
    this.redisLeaderboard = new RedisLeaderboardService()
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting Gem Finder service...')
    
    try {
      // Initialize dependencies
      await this.messageQueue.start()
      await this.sseService.start()
      await this.redisLeaderboard.start()
      
      this.isRunning = true
      
      // Start periodic analysis
      this.startPeriodicAnalysis()
      
      console.log('✅ Gem Finder service started successfully')
      
    } catch (error) {
      console.error('❌ Failed to start Gem Finder service:', error)
      throw error
    }
  }

  /**
   * Start periodic gem discovery analysis
   */
  private startPeriodicAnalysis(): void {
    console.log('🔍 Starting periodic gem analysis...')
    
    this.analysisTimer = setInterval(async () => {
      try {
        await this.analyzeRecentActivity()
      } catch (error) {
        console.error('❌ Error in periodic gem analysis:', error)
      }
    }, this.ANALYSIS_INTERVAL_MS)
  }

  /**
   * Analyze recent KOL activity for gem patterns
   */
  public async analyzeRecentActivity(): Promise<GemCandidate[]> {
    console.log('🔬 Analyzing recent KOL activity for gem patterns...')
    
    try {
      // Get recent token transfers from KOLs (last 24 hours)
      const recentTransfers = await this.getRecentKolTransfers()
      
      // Group by token and analyze patterns
      const tokenAnalytics = await this.groupAndAnalyzeTokens(recentTransfers)
      
      // Score and filter potential gems
      const gemCandidates = await this.scoreGemCandidates(tokenAnalytics)
      
      // Process new discoveries
      for (const candidate of gemCandidates) {
        await this.processGemCandidate(candidate)
      }
      
      if (gemCandidates.length > 0) {
        console.log(`💎 Found ${gemCandidates.length} potential gems in this analysis cycle`)
      }
      
      return gemCandidates
      
    } catch (error) {
      console.error('❌ Error analyzing recent activity:', error)
      return []
    }
  }

  /**
   * Get recent token transfers from KOL wallets
   */
  private async getRecentKolTransfers(): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - (this.DISCOVERY_WINDOW_HOURS * 60 * 60 * 1000))
    
    return await prisma.kolTokenTransfer.findMany({
      where: {
        blockTime: { gte: cutoffTime },
        amountChangeRaw: { gt: 0 }, // Only buy transactions
        usdValueAtTime: { gt: 100 } // Minimum $100 purchase
      },
      include: {
        kolWallet: {
          select: {
            address: true,
            curatedName: true,
            twitterHandle: true
          }
        }
      },
      orderBy: {
        blockTime: 'desc'
      }
    })
  }

  /**
   * Group transfers by token and calculate analytics
   */
  private async groupAndAnalyzeTokens(transfers: any[]): Promise<TokenAnalytics[]> {
    const tokenGroups = new Map<string, any[]>()
    
    // Group transfers by token mint
    for (const transfer of transfers) {
      const mint = transfer.tokenMintAddress
      if (!tokenGroups.has(mint)) {
        tokenGroups.set(mint, [])
      }
      tokenGroups.get(mint)!.push(transfer)
    }
    
    const analytics: TokenAnalytics[] = []
    
    for (const [mintAddress, tokenTransfers] of tokenGroups) {
      // Skip excluded tokens
      if (this.EXCLUDED_MINTS.has(mintAddress)) continue
      
      // Skip if we've already processed this token recently
      if (this.processedTokens.has(mintAddress)) continue
      
      const uniqueBuyers = new Set(tokenTransfers.map(t => t.kolAddress))
      const totalVolume = tokenTransfers.reduce((sum, t) => 
        sum + Number(t.usdValueAtTime || 0), 0)
      
      // Apply minimum thresholds
      if (uniqueBuyers.size < this.MIN_KOL_BUYERS || totalVolume < this.MIN_VOLUME_USD) {
        continue
      }
      
      analytics.push({
        mintAddress,
        kolBuyers: Array.from(uniqueBuyers),
        totalVolume,
        firstSeenTimestamp: new Date(Math.min(...tokenTransfers.map(t => t.blockTime.getTime()))),
        averagePurchaseSize: totalVolume / tokenTransfers.length,
        uniqueBuyerCount: uniqueBuyers.size,
        avgBuyerReputation: await this.calculateAverageBuyerReputation(Array.from(uniqueBuyers)),
        timeWindow: `${this.DISCOVERY_WINDOW_HOURS}h`
      })
    }
    
    return analytics.sort((a, b) => b.totalVolume - a.totalVolume)
  }

  /**
   * Calculate average reputation score of buyers
   */
  private async calculateAverageBuyerReputation(buyerAddresses: string[]): Promise<number> {
    try {
      const kolData = await prisma.kolPnlSnapshot.findMany({
        where: {
          kolAddress: { in: buyerAddresses },
          period: '7D'
        },
        select: {
          totalPnlUsd: true,
          winRate: true,
          totalTrades: true
        }
      })
      
      if (kolData.length === 0) return 0.5 // Default neutral score
      
      const avgPnl = kolData.reduce((sum, d) => sum + Number(d.totalPnlUsd), 0) / kolData.length
      const avgWinRate = kolData.reduce((sum, d) => sum + Number(d.winRate || 0), 0) / kolData.length
      const avgTrades = kolData.reduce((sum, d) => sum + d.totalTrades, 0) / kolData.length
      
      // Normalize to 0-1 scale (simple heuristic)
      const pnlScore = Math.min(Math.max(avgPnl / 50000, 0), 1) // $50k max
      const winRateScore = avgWinRate / 100
      const activityScore = Math.min(avgTrades / 100, 1) // 100 trades max
      
      return (pnlScore * 0.4 + winRateScore * 0.4 + activityScore * 0.2)
      
    } catch (error) {
      console.error('❌ Error calculating buyer reputation:', error)
      return 0.5
    }
  }

  /**
   * Score gem candidates based on multiple factors
   */
  private async scoreGemCandidates(analytics: TokenAnalytics[]): Promise<GemCandidate[]> {
    const candidates: GemCandidate[] = []
    
    for (const token of analytics) {
      try {
        // Get token metadata for filtering
        const metadata = await this.getTokenMetadata(token.mintAddress)
        
        // Apply content filters
        if (this.isSuspiciousToken(metadata)) {
          console.log(`🚫 Filtering suspicious token: ${token.mintAddress}`)
          continue
        }
        
        // Calculate confidence score
        const confidenceScore = this.calculateConfidenceScore(token, metadata)
        
        if (confidenceScore >= this.MIN_CONFIDENCE_SCORE) {
          candidates.push({
            tokenMintAddress: token.mintAddress,
            discoveryTimestamp: new Date(),
            famousBuyerAddresses: token.kolBuyers,
            totalFamousVolumeUsd: token.totalVolume,
            confidenceScore: Number(confidenceScore.toFixed(2)),
            metadata: metadata
          })
        }
        
      } catch (error) {
        console.error(`❌ Error scoring token ${token.mintAddress}:`, error)
      }
    }
    
    return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore)
  }

  /**
   * Calculate confidence score for a token
   */
  private calculateConfidenceScore(token: TokenAnalytics, metadata: any): number {
    let score = 0.0
    
    // Factor 1: Number of KOL buyers (0.3 weight)
    const buyerScore = Math.min(token.uniqueBuyerCount / 5, 1) * 0.3
    score += buyerScore
    
    // Factor 2: Total volume (0.25 weight)
    const volumeScore = Math.min(token.totalVolume / 50000, 1) * 0.25
    score += volumeScore
    
    // Factor 3: Buyer reputation (0.25 weight)
    const reputationScore = token.avgBuyerReputation * 0.25
    score += reputationScore
    
    // Factor 4: Purchase timing concentration (0.1 weight)
    const timingScore = this.calculateTimingScore(token) * 0.1
    score += timingScore
    
    // Factor 5: Token metadata quality (0.1 weight)
    const metadataScore = this.calculateMetadataScore(metadata) * 0.1
    score += metadataScore
    
    return Math.min(score, 1.0)
  }

  /**
   * Calculate timing score based on purchase concentration
   */
  private calculateTimingScore(token: TokenAnalytics): number {
    // Higher score for purchases within shorter time windows
    const hoursAgo = (Date.now() - token.firstSeenTimestamp.getTime()) / (1000 * 60 * 60)
    return Math.max(1 - (hoursAgo / this.DISCOVERY_WINDOW_HOURS), 0)
  }

  /**
   * Calculate metadata quality score
   */
  private calculateMetadataScore(metadata: any): number {
    let score = 0.0
    
    if (metadata?.name && metadata.name.length > 2) score += 0.3
    if (metadata?.symbol && metadata.symbol.length > 1) score += 0.3
    if (metadata?.logoUri) score += 0.2
    if (metadata?.decimals && metadata.decimals > 0) score += 0.2
    
    return score
  }

  /**
   * Check if token appears suspicious
   */
  private isSuspiciousToken(metadata: any): boolean {
    if (!metadata) return true
    
    const name = (metadata.name || '').toLowerCase()
    const symbol = (metadata.symbol || '').toLowerCase()
    
    // Check for suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (name.includes(pattern) || symbol.includes(pattern)) {
        return true
      }
    }
    
    // Check for very long or very short names
    if (name.length > 50 || name.length < 2) return true
    if (symbol.length > 10 || symbol.length < 1) return true
    
    return false
  }

  /**
   * Get token metadata from database or external API
   */
  private async getTokenMetadata(mintAddress: string): Promise<any> {
    try {
      // Try database first
      const token = await prisma.token.findUnique({
        where: { mintAddress }
      })
      
      if (token) {
        return {
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          logoUri: token.logoUri,
          ...token.metadataJson as any
        }
      }
      
      // Return basic structure if not found
      return {
        mintAddress,
        name: `Token ${mintAddress.slice(0, 8)}...`,
        symbol: 'UNKNOWN',
        decimals: 9
      }
      
    } catch (error) {
      console.error(`❌ Error getting token metadata for ${mintAddress}:`, error)
      return null
    }
  }

  /**
   * Process and store a gem candidate
   */
  private async processGemCandidate(candidate: GemCandidate): Promise<void> {
    try {
      // Check if this gem was already discovered recently
      const existingGem = await prisma.gemsFeed.findFirst({
        where: {
          tokenMintAddress: candidate.tokenMintAddress,
          discoveryTimestamp: {
            gte: new Date(Date.now() - (24 * 60 * 60 * 1000)) // Last 24 hours
          }
        }
      })
      
      if (existingGem) {
        console.log(`💎 Gem ${candidate.tokenMintAddress} already discovered recently`)
        return
      }
      
      // Store in gems feed
      const gem = await prisma.gemsFeed.create({
        data: {
          tokenMintAddress: candidate.tokenMintAddress,
          discoveryTimestamp: candidate.discoveryTimestamp,
          numFamousBuyers: candidate.famousBuyerAddresses.length,
          famousBuyerAddresses: candidate.famousBuyerAddresses,
          totalFamousVolumeUsd: candidate.totalFamousVolumeUsd,
          confidenceScore: candidate.confidenceScore,
          marketCapAtDiscovery: candidate.marketCapAtDiscovery,
          metadataJson: candidate.metadata || {}
        }
      })
      
      // Mark as processed to avoid duplicate analysis
      this.processedTokens.add(candidate.tokenMintAddress)
      
      // Send real-time alert
      await this.sendGemAlert(gem)
      
      console.log(`💎 New gem discovered: ${candidate.tokenMintAddress} (score: ${candidate.confidenceScore})`)
      
    } catch (error) {
      console.error(`❌ Error processing gem candidate ${candidate.tokenMintAddress}:`, error)
    }
  }

  /**
   * Send real-time gem discovery alert
   */
  private async sendGemAlert(gem: any): Promise<void> {
    try {
      const alertData = {
        tokenMintAddress: gem.tokenMintAddress,
        confidenceScore: gem.confidenceScore,
        numFamousBuyers: gem.numFamousBuyers,
        totalFamousVolumeUsd: gem.totalFamousVolumeUsd,
        discoveryTimestamp: gem.discoveryTimestamp,
        metadata: gem.metadataJson,
        famousBuyers: gem.famousBuyerAddresses
      }
      
      // Send via SSE
      this.sseService.sendGemAlert(alertData)
      
      // Also publish to message queue for other services
      await this.messageQueue.publish('gem_discovery', {
        id: `gem-${gem.tokenMintAddress}-${Date.now()}`,
        type: 'gem_discovered',
        data: alertData,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('❌ Error sending gem alert:', error)
    }
  }

  /**
   * Get recent gem discoveries
   */
  public async getRecentGems(limit: number = 50): Promise<any[]> {
    return await prisma.gemsFeed.findMany({
      where: { isActive: true },
      orderBy: [
        { confidenceScore: 'desc' },
        { discoveryTimestamp: 'desc' }
      ],
      take: limit
    })
  }

  /**
   * Get gem statistics
   */
  public async getGemStats(): Promise<any> {
    const [
      totalGems,
      gemsToday,
      avgConfidenceScore,
      topGems
    ] = await Promise.all([
      prisma.gemsFeed.count({ where: { isActive: true } }),
      prisma.gemsFeed.count({
        where: {
          isActive: true,
          discoveryTimestamp: {
            gte: new Date(Date.now() - (24 * 60 * 60 * 1000))
          }
        }
      }),
      prisma.gemsFeed.aggregate({
        where: { isActive: true },
        _avg: { confidenceScore: true }
      }),
      prisma.gemsFeed.findMany({
        where: { isActive: true },
        orderBy: { confidenceScore: 'desc' },
        take: 5
      })
    ])
    
    return {
      totalGems,
      gemsToday,
      avgConfidenceScore: Number(avgConfidenceScore._avg.confidenceScore || 0),
      topGems,
      lastAnalysis: new Date(),
      processingStatus: this.isRunning ? 'active' : 'inactive'
    }
  }

  /**
   * Stop the service
   */
  public async stop(): Promise<void> {
    console.log('🛑 Stopping Gem Finder service...')
    
    this.isRunning = false
    
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer)
      this.analysisTimer = null
    }
    
    console.log('✅ Gem Finder service stopped')
  }
} 