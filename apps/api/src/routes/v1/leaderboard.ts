import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'

interface LeaderboardQuery {
  timeframe?: '1h' | '1d' | '7d' | '30d'
  ecosystem?: 'all' | 'pump.fun' | 'letsbonk.fun'
  type?: 'pnl' | 'volume'
  limit?: number
}

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // Get leaderboard data
  fastify.get('/leaderboard', async (request: FastifyRequest<{ Querystring: LeaderboardQuery }>, reply: FastifyReply) => {
    const { 
      timeframe = '1d', 
      ecosystem = 'all', 
      type = 'pnl',
      limit = 100 
    } = request.query

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
        take: limit
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
      // Get user with their trades
      const user = await prisma.user.findUnique({
        where: { walletAddress: address },
        include: {
          trades: {
            include: {
              token: true
            },
            orderBy: {
              timestamp: 'desc'
            },
            take: 50
          }
        }
      })

      if (!user) {
        reply.status(404)
        return {
          success: false,
          error: 'Wallet not found',
          timestamp: new Date().toISOString()
        }
      }

      // Calculate basic stats
      const totalPnl = user.trades.reduce((sum, trade) => {
        return sum + (trade.action === 'sell' ? trade.amountSol : -trade.amountSol)
      }, 0)

      const totalVolume = user.trades.reduce((sum, trade) => sum + trade.amountSol, 0)

      return {
        success: true,
        data: {
          address: user.walletAddress,
          totalPnl,
          totalVolume,
          tradeCount: user.trades.length,
          recentTrades: user.trades.slice(0, 10)
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