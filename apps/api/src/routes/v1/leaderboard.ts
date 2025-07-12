import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'

interface LeaderboardQuery {
  timeframe?: '1h' | '1d' | '7d' | '30d'
  ecosystem?: 'all' | 'pump.fun' | 'letsbonk.fun'
  type?: 'pnl' | 'volume'
  limit?: string
}

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // Get leaderboard data
  fastify.get('/', async (request: FastifyRequest<{ Querystring: LeaderboardQuery }>, reply: FastifyReply) => {
    const { 
      timeframe = '1d', 
      ecosystem = 'all', 
      type = 'pnl',
      limit = '100' 
    } = request.query
    
    // Convert limit to integer
    const limitNumber = parseInt(limit, 10) || 100

    try {
      const leaderboard = await prisma.leaderboardCache.findMany({
        where: {
          leaderboardType: type,
          timeframe: timeframe,
          ecosystem: ecosystem,
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          rank: 'asc'
        },
        take: limitNumber
      })

      return {
        success: true,
        data: leaderboard,
        filters: {
          timeframe,
          ecosystem,
          type
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      request.log.error(error)
      reply.status(500)
      return {
        success: false,
        error: 'Failed to fetch leaderboard data',
        timestamp: new Date().toISOString()
      }
    }
  })

  // Get wallet profile
  fastify.get('/wallet/:address', async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    const { address } = request.params

    try {
      // Get wallet with recent transactions from PNL snapshots
      const wallet = await prisma.wallet.findUnique({
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

      return {
        success: true,
        data: {
          address: wallet.address,
          curatedName: wallet.curatedName,
          twitterHandle: wallet.twitterHandle,
          isFamousTrader: wallet.isFamousTrader,
          totalPnl: recentPnl?.realizedPnlUsd || 0,
          roiPercentage: recentPnl?.roiPercentage || 0,
          winRate: recentPnl?.winRate || 0,
          totalTrades: recentPnl?.totalTrades || 0,
          recentSnapshots: wallet.pnlSnapshots.slice(0, 5)
        },
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