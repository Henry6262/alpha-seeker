import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { 
  LeaderboardQuery, 
  LeaderboardResponse, 
  LeaderboardEntry, 
  WalletProfileResponse, 
  WalletProfile 
} from '../../types/leaderboard.types.js'

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // Get leaderboard data
  fastify.get('/', async (
    request: FastifyRequest<{ Querystring: LeaderboardQuery }>, 
    reply: FastifyReply
  ): Promise<LeaderboardResponse<LeaderboardEntry>> => {
    const { 
      timeframe = '1d', 
      ecosystem = 'all', 
      type = 'pnl',
      limit = '100' 
    } = request.query
    
    // Validate type - only PNL supported in MVP
    if (request.query.type === 'volume') {
      return reply.status(400).send({
        success: false,
        error: 'Volume leaderboard has been removed from MVP. Only PNL leaderboard is supported.',
        timestamp: new Date().toISOString()
      })
    }
    
    // Convert limit to integer
    const limitNumber = parseInt(limit, 10) || 100

    try {
      const leaderboard = await prisma.duneLeaderboardCache.findMany({
        where: {
          period: timeframe.toUpperCase()
        },
        orderBy: {
          rank: 'asc'
        },
        take: limitNumber
      })

      const leaderboardData: LeaderboardEntry[] = leaderboard.map((entry: any) => ({
        rank: entry.rank,
        wallet_address: entry.walletAddress,
        pnl_usd: entry.pnlUsd.toNumber(),
        win_rate: entry.winRate?.toNumber() || 0,
        total_trades: entry.totalTrades || 0,
        notable_wins: entry.notableWins,
        last_updated: entry.lastUpdated?.toISOString()
      }))

      return {
        success: true,
        data: leaderboardData,
        filters: {
          timeframe,
          ecosystem,
          type
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch leaderboard data',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Get wallet profile
  fastify.get('/wallet/:address', async (
    request: FastifyRequest<{ Params: { address: string } }>, 
    reply: FastifyReply
  ): Promise<WalletProfileResponse> => {
    const { address } = request.params

    try {
      // Get wallet with recent transactions from PNL snapshots
      const wallet = await prisma.kolWallet.findUnique({
        where: { address },
        include: {
          pnlSnapshots: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 10
          }
        }
      })

      if (!wallet) {
        reply.status(404)
        return {
          success: false,
          error: 'Wallet not found',
          timestamp: new Date().toISOString()
        }
      }

      // Get recent PNL data
      const recentPnl = wallet.pnlSnapshots.length > 0 ? wallet.pnlSnapshots[0] : null

      const walletProfile: WalletProfile = {
        address: wallet.address,
        curatedName: wallet.curatedName,
        twitterHandle: wallet.twitterHandle || undefined,
        totalPnl: recentPnl?.realizedPnlUsd?.toNumber() || 0,
        roiPercentage: recentPnl?.roiPercentage?.toNumber() || 0,
        winRate: recentPnl?.winRate?.toNumber() || 0,
        totalTrades: recentPnl?.totalTrades || 0,
        recentSnapshots: wallet.pnlSnapshots.slice(0, 5)
      }

      return {
        success: true,
        data: walletProfile,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      request.log.error(error)
      reply.status(500)
      return {
        success: false,
        error: 'Failed to fetch wallet profile',
        timestamp: new Date().toISOString()
      }
    }
  })
} 