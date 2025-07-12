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

export class DuneService {
  private apiKey: string
  private baseUrl = 'https://api.dune.com/api/v1'

  constructor() {
    this.apiKey = process.env.DUNE_API_KEY || ''
    if (!this.apiKey) {
      console.warn('DUNE_API_KEY not provided. Dune service will use mock data.')
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.apiKey) {
      // Return mock data for development
      return this.getMockLeaderboardData()
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
    return this.makeRequest('/query/execute', {
      method: 'POST',
      body: JSON.stringify(query),
    })
  }

  async getQueryResults(executionId: string): Promise<DuneResponse> {
    return this.makeRequest(`/execution/${executionId}/results`)
  }

  async refreshLeaderboard(
    type: 'pnl' | 'volume',
    timeframe: '1h' | '1d' | '7d' | '30d' = '1d',
    ecosystem: 'all' | 'pump.fun' | 'letsbonk.fun' = 'all'
  ): Promise<void> {
    try {
      console.log(`Refreshing ${type} leaderboard for ${timeframe} ${ecosystem}`)
      
      // For now, generate mock data until Dune queries are set up
      const mockData = this.getMockLeaderboardData()
      
      // Clear existing cache for this combination
      await prisma.leaderboardCache.deleteMany({
        where: {
          leaderboardType: type,
          timeframe,
          ecosystem,
        },
      })

      // Insert new leaderboard data
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

      console.log(`✅ Refreshed ${type} leaderboard: ${leaderboardEntries.length} entries`)
    } catch (error) {
      console.error(`Failed to refresh ${type} leaderboard:`, error)
      throw error
    }
  }

  private getMockLeaderboardData() {
    // Mock data for development
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
        pnl: Math.random() * 1000 + 100, // Random PNL between 100-1100 SOL
        volume: Math.random() * 5000 + 1000, // Random volume between 1000-6000 SOL
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