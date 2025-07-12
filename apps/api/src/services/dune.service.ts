import { prisma } from '../lib/prisma'

interface DuneQuery {
  query_id: number
  parameters?: Record<string, any>
}

interface DuneResponse {
  execution_id: string
  query_id: number
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED'
  result?: {
    rows: any[]
    metadata: {
      column_names: string[]
      result_set_bytes: number
      total_row_count: number
    }
  }
}

interface DuneTraderData {
  wallet_address: string
  realized_pnl_usd: number
  total_trades: number
  win_rate: number
  total_volume_usd: number
  first_seen: string
  last_seen: string
}

interface DuneWalletMetadata {
  wallet_address: string
  curated_name?: string
  twitter_handle?: string
  is_famous_trader: boolean
  total_pnl_7d: number
  total_pnl_30d: number
}

export class DuneService {
  private apiKey: string
  private baseUrl = 'https://api.dune.com/api/v1'
  
  // Dune query IDs for Solana trading data
  private readonly QUERIES = {
    PROFITABLE_TRADERS_7D: 3875234,  // Top profitable traders last 7 days
    PROFITABLE_TRADERS_30D: 3875235, // Top profitable traders last 30 days
    TRADER_DETAILED_PNL: 3875236,    // Detailed PNL for specific wallets
    DEX_TRADING_VOLUME: 3875237,     // Trading volume analysis
    WALLET_DISCOVERY: 3875238,       // Discover new profitable wallets
  }

  constructor() {
    this.apiKey = process.env.DUNE_API_KEY || ''
    if (!this.apiKey) {
      console.warn('DUNE_API_KEY not provided. Dune service will use limited functionality.')
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Dune API key required for production queries')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-Dune-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Dune API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async executeQuery(query: DuneQuery): Promise<DuneResponse> {
    console.log(`🔍 Executing Dune query ${query.query_id}...`)
    return this.makeRequest('/query/execute', {
      method: 'POST',
      body: JSON.stringify(query),
    })
  }

  async getQueryResults(executionId: string): Promise<DuneResponse> {
    return this.makeRequest(`/execution/${executionId}/results`)
  }

  private async waitForQueryCompletion(executionId: string, maxWaitMs: number = 300000): Promise<DuneResponse> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getQueryResults(executionId)
      
      if (result.state === 'QUERY_STATE_COMPLETED') {
        console.log(`✅ Query completed successfully`)
        return result
      } else if (result.state === 'QUERY_STATE_FAILED') {
        throw new Error('Dune query failed')
      }
      
      console.log(`⏳ Query still ${result.state.toLowerCase()}...`)
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
    }
    
    throw new Error('Query timeout')
  }

  /**
   * Bootstrap Phase 1: Discover and import historical profitable wallets
   */
  async bootstrapWalletDiscovery(): Promise<{ discovered: number, imported: number }> {
    console.log('🚀 Starting Phase 1: Wallet Discovery Bootstrap')
    
    try {
      // Execute wallet discovery query
      const execution = await this.executeQuery({
        query_id: this.QUERIES.WALLET_DISCOVERY,
        parameters: {
          min_pnl_usd: 1000,      // Minimum $1000 profit
          min_trades: 10,         // At least 10 trades
          days_lookback: 30       // Last 30 days
        }
      })

      const result = await this.waitForQueryCompletion(execution.execution_id)
      
      if (!result.result?.rows) {
        throw new Error('No data returned from wallet discovery query')
      }

      const discoveredWallets = result.result.rows as DuneWalletMetadata[]
      console.log(`📊 Discovered ${discoveredWallets.length} profitable wallets`)

      // Import wallets into our database
      let importedCount = 0
      for (const walletData of discoveredWallets) {
        try {
          await prisma.wallet.upsert({
            where: { address: walletData.wallet_address },
            update: {
              curatedName: walletData.curated_name,
              twitterHandle: walletData.twitter_handle,
              isFamousTrader: walletData.is_famous_trader,
              isLeaderboardUser: true,
              metadataJson: JSON.stringify({
                discoveredAt: new Date().toISOString(),
                duneData: {
                  pnl_7d: walletData.total_pnl_7d,
                  pnl_30d: walletData.total_pnl_30d
                }
              })
            },
            create: {
              address: walletData.wallet_address,
              curatedName: walletData.curated_name,
              twitterHandle: walletData.twitter_handle,
              isFamousTrader: walletData.is_famous_trader || false,
              isLeaderboardUser: true,
              firstSeenAt: new Date(),
              metadataJson: JSON.stringify({
                discoveredAt: new Date().toISOString(),
                duneData: {
                  pnl_7d: walletData.total_pnl_7d,
                  pnl_30d: walletData.total_pnl_30d
                }
              })
            }
          })
          importedCount++
        } catch (error) {
          console.error(`Failed to import wallet ${walletData.wallet_address}:`, error)
        }
      }

      console.log(`✅ Successfully imported ${importedCount}/${discoveredWallets.length} wallets`)
      return { discovered: discoveredWallets.length, imported: importedCount }

    } catch (error) {
      console.error('❌ Wallet discovery bootstrap failed:', error)
      throw error
    }
  }

  /**
   * Bootstrap Phase 1: Import historical PNL data for leaderboards
   */
  async bootstrapHistoricalPNL(): Promise<{ entries_7d: number, entries_30d: number }> {
    console.log('📈 Starting Historical PNL Data Bootstrap')
    
    try {
      const results = await Promise.all([
        this.importPNLData('7D', this.QUERIES.PROFITABLE_TRADERS_7D),
        this.importPNLData('30D', this.QUERIES.PROFITABLE_TRADERS_30D)
      ])

      const [entries_7d, entries_30d] = results
      console.log(`✅ Bootstrap complete: ${entries_7d} entries (7D), ${entries_30d} entries (30D)`)
      
      return { entries_7d, entries_30d }
    } catch (error) {
      console.error('❌ Historical PNL bootstrap failed:', error)
      throw error
    }
  }

  private async importPNLData(period: '7D' | '30D', queryId: number): Promise<number> {
    console.log(`📊 Importing ${period} PNL data...`)
    
    const execution = await this.executeQuery({
      query_id: queryId,
      parameters: {
        min_trades: 5,
        min_volume_usd: 5000
      }
    })

    const result = await this.waitForQueryCompletion(execution.execution_id)
    
    if (!result.result?.rows) {
      throw new Error(`No PNL data returned for ${period}`)
    }

    const traderData = result.result.rows as DuneTraderData[]
    console.log(`📈 Processing ${traderData.length} traders for ${period}`)

    // Clear existing snapshots for this period
    await prisma.pnlSnapshot.deleteMany({
      where: { period }
    })

    // Insert new PNL snapshots
    const snapshots = traderData.map(trader => ({
      walletAddress: trader.wallet_address,
      period,
      snapshotTimestamp: new Date(),
      realizedPnlUsd: trader.realized_pnl_usd,
      roiPercentage: trader.realized_pnl_usd > 0 ? (trader.realized_pnl_usd / trader.total_volume_usd) * 100 : 0,
      winRate: trader.win_rate,
      totalTrades: trader.total_trades
    }))

    await prisma.pnlSnapshot.createMany({
      data: snapshots
    })

    return snapshots.length
  }

  /**
   * Add curated famous traders to the database
   */
  async addCuratedTraders(famousTraders: Array<{
    address: string
    name: string
    twitterHandle?: string
  }>): Promise<number> {
    console.log('⭐ Adding curated famous traders...')
    
    let addedCount = 0
    for (const trader of famousTraders) {
      try {
        await prisma.wallet.upsert({
          where: { address: trader.address },
          update: {
            curatedName: trader.name,
            twitterHandle: trader.twitterHandle,
            isFamousTrader: true,
            isLeaderboardUser: true
          },
          create: {
            address: trader.address,
            curatedName: trader.name,
            twitterHandle: trader.twitterHandle,
            isFamousTrader: true,
            isLeaderboardUser: true,
            firstSeenAt: new Date(),
            metadataJson: JSON.stringify({
              addedAt: new Date().toISOString(),
              source: 'curated'
            })
          }
        })
        addedCount++
        console.log(`✅ Added curated trader: ${trader.name} (${trader.address})`)
      } catch (error) {
        console.error(`Failed to add curated trader ${trader.name}:`, error)
      }
    }

    return addedCount
  }

  /**
   * Complete Phase 1 Bootstrap Process
   */
  async executePhase1Bootstrap(): Promise<{
    walletsDiscovered: number
    walletsImported: number
    pnlEntries7d: number
    pnlEntries30d: number
    curatedTraders: number
  }> {
    console.log('🎯 Executing Complete Phase 1 Bootstrap')
    
    try {
      // Step 1: Discover profitable wallets from Dune
      const walletDiscovery = await this.bootstrapWalletDiscovery()
      
      // Step 2: Import historical PNL data
      const pnlData = await this.bootstrapHistoricalPNL()
      
      // Step 3: Add curated famous traders (example list)
      const famousTraders = [
        { address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', name: 'Ansem', twitterHandle: 'blknoiz06' },
        { address: 'GDfnEsia2WLAW5t8yx2X5j2mkfA74i5kwGdDuZHt7XmG', name: 'Cobie', twitterHandle: 'cobie' },
        { address: 'CKxTHwM9fPMRRvZmFnFoqKNd9pQR21c5Aq9bh5h9nQHA', name: 'Bonk CEO', twitterHandle: 'bonk_ceo' }
      ]
      const curatedCount = await this.addCuratedTraders(famousTraders)
      
      const summary = {
        walletsDiscovered: walletDiscovery.discovered,
        walletsImported: walletDiscovery.imported,
        pnlEntries7d: pnlData.entries_7d,
        pnlEntries30d: pnlData.entries_30d,
        curatedTraders: curatedCount
      }
      
      console.log('🎉 Phase 1 Bootstrap Summary:', summary)
      return summary
      
    } catch (error) {
      console.error('💥 Phase 1 Bootstrap failed:', error)
      throw error
    }
  }

  /**
   * Legacy method for compatibility - now uses real Dune data when available
   */
  async refreshLeaderboard(
    type: 'pnl' | 'volume',
    timeframe: '1h' | '1d' | '7d' | '30d' = '1d',
    ecosystem: 'all' | 'pump.fun' | 'letsbonk.fun' = 'all'
  ): Promise<void> {
    try {
      console.log(`Refreshing ${type} leaderboard for ${timeframe} ${ecosystem}`)
      
      // Use PNL snapshots if available, otherwise fall back to mock data
      if (type === 'pnl' && (timeframe === '7d' || timeframe === '30d')) {
        await this.refreshFromPnlSnapshots(timeframe, ecosystem)
      } else {
        await this.refreshWithMockData(type, timeframe, ecosystem)
      }
      
    } catch (error) {
      console.error(`Failed to refresh ${type} leaderboard:`, error)
      throw error
    }
  }

  private async refreshFromPnlSnapshots(timeframe: '7d' | '30d', ecosystem: string): Promise<void> {
    const period = timeframe === '7d' ? '7D' : '30D'
    
    // Get latest PNL snapshots
    const snapshots = await prisma.pnlSnapshot.findMany({
      where: { period },
      include: { wallet: true },
      orderBy: { realizedPnlUsd: 'desc' },
      take: 100
    })

    if (snapshots.length === 0) {
      console.log(`No PNL snapshots found for ${period}, using mock data`)
      return this.refreshWithMockData('pnl', timeframe, ecosystem)
    }

    // Clear existing cache
    await prisma.leaderboardCache.deleteMany({
      where: {
        leaderboardType: 'pnl',
        timeframe,
        ecosystem,
      },
    })

    // Insert new leaderboard data from snapshots
    const leaderboardEntries = snapshots.map((snapshot, index) => ({
      walletAddress: snapshot.walletAddress,
      leaderboardType: 'pnl' as const,
      timeframe,
      ecosystem,
      rank: index + 1,
      metric: snapshot.realizedPnlUsd,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // Expire in 15 minutes
    }))

    await prisma.leaderboardCache.createMany({
      data: leaderboardEntries,
    })

    console.log(`✅ Refreshed PNL leaderboard from snapshots: ${leaderboardEntries.length} entries`)
  }

  private async refreshWithMockData(type: string, timeframe: string, ecosystem: string): Promise<void> {
    const mockData = this.getMockLeaderboardData()
    
    // Clear existing cache
    await prisma.leaderboardCache.deleteMany({
      where: {
        leaderboardType: type,
        timeframe,
        ecosystem,
      },
    })

    // Insert mock leaderboard data
    const leaderboardEntries = mockData.rows.map((row: any, index: number) => ({
      walletAddress: row.wallet_address,
      leaderboardType: type,
      timeframe,
      ecosystem,
      rank: index + 1,
      metric: row[type] || 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Expire in 5 minutes
    }))

    await prisma.leaderboardCache.createMany({
      data: leaderboardEntries,
    })

    console.log(`✅ Refreshed ${type} leaderboard with mock data: ${leaderboardEntries.length} entries`)
  }

  private getMockLeaderboardData() {
    // Mock data for development/fallback
    const mockWallets = [
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      'GDfnEsia2WLAW5t8yx2X5j2mkfA74i5kwGdDuZHt7XmG',
      'CKxTHwM9fPMRRvZmFnFoqKNd9pQR21c5Aq9bh5h9nQHA',
      'BroadwayDJm8vvvgqpFyGWwHx1hpFfwuJYcVGzQwPVGu',
      '3LaWEVWW1pjvEy8gKaZ1b4kVDU8x7FnPGKJRUHaGPmM9',
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      'A1K9xPhgDbj5MNPSLtPKYznbVaM5GH7Xu9YA2GwWuJK1',
      'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    ]

    return {
      rows: mockWallets.map((wallet, index) => ({
        wallet_address: wallet,
        pnl: Math.random() * 50000 + 10000, // Random PNL between $10K-60K
        volume: Math.random() * 500000 + 100000, // Random volume between $100K-600K
      })),
    }
  }

  // Method to refresh all leaderboard combinations
  async refreshAllLeaderboards(): Promise<void> {
    const types: ('pnl' | 'volume')[] = ['pnl', 'volume']
    const timeframes: ('1h' | '1d' | '7d' | '30d')[] = ['1h', '1d', '7d', '30d']
    const ecosystems: ('all' | 'pump.fun' | 'letsbonk.fun')[] = ['all', 'pump.fun', 'letsbonk.fun']

    for (const type of types) {
      for (const timeframe of timeframes) {
        for (const ecosystem of ecosystems) {
          try {
            await this.refreshLeaderboard(type, timeframe, ecosystem)
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error) {
            console.error(`Failed to refresh ${type}/${timeframe}/${ecosystem}:`, error)
          }
        }
      }
    }
  }
} 