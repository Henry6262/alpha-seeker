import { FastifyInstance } from 'fastify'
import { leaderboardRoutes } from './leaderboard'
import { DuneService } from '../../services/dune.service'

export async function v1Routes(fastify: FastifyInstance) {
  // Register leaderboard routes
  await fastify.register(leaderboardRoutes, { prefix: '/leaderboard' })

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      service: 'alpha-seeker-api',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  })

  // Phase 1 Bootstrap endpoint - Dune Analytics integration
  fastify.post('/bootstrap/phase1', async (request, reply) => {
    try {
      console.log('🚀 Phase 1 Bootstrap requested via API')
      
      const duneService = new DuneService()
      const result = await duneService.executePhase1Bootstrap()
      
      return {
        success: true,
        message: 'Phase 1 Bootstrap completed successfully',
        timestamp: new Date().toISOString(),
        data: result
      }
    } catch (error) {
      console.error('❌ Phase 1 Bootstrap failed:', error)
      
      return reply.status(500).send({
        success: false,
        error: 'Phase 1 Bootstrap failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Wallet discovery endpoint - discover profitable wallets only
  fastify.post('/bootstrap/discover-wallets', async (request, reply) => {
    try {
      console.log('🔍 Wallet discovery requested via API')
      
      const duneService = new DuneService()
      const result = await duneService.bootstrapWalletDiscovery()
      
      return {
        success: true,
        message: 'Wallet discovery completed successfully',
        timestamp: new Date().toISOString(),
        data: result
      }
    } catch (error) {
      console.error('❌ Wallet discovery failed:', error)
      
      return reply.status(500).send({
        success: false,
        error: 'Wallet discovery failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Historical PNL import endpoint
  fastify.post('/bootstrap/historical-pnl', async (request, reply) => {
    try {
      console.log('📈 Historical PNL import requested via API')
      
      const duneService = new DuneService()
      const result = await duneService.bootstrapHistoricalPNL()
      
      return {
        success: true,
        message: 'Historical PNL import completed successfully',
        timestamp: new Date().toISOString(),
        data: result
      }
    } catch (error) {
      console.error('❌ Historical PNL import failed:', error)
      
      return reply.status(500).send({
        success: false,
        error: 'Historical PNL import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Add curated traders endpoint
  fastify.post('/bootstrap/curated-traders', async (request, reply) => {
    try {
      const { traders } = request.body as {
        traders: Array<{
          address: string
          name: string
          twitterHandle?: string
        }>
      }

      if (!traders || !Array.isArray(traders)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          message: 'traders array is required',
          timestamp: new Date().toISOString()
        })
      }

      console.log(`⭐ Adding ${traders.length} curated traders via API`)
      
      const duneService = new DuneService()
      const count = await duneService.addCuratedTraders(traders)
      
      return {
        success: true,
        message: `Successfully added ${count} curated traders`,
        timestamp: new Date().toISOString(),
        data: { addedCount: count, totalRequested: traders.length }
      }
    } catch (error) {
      console.error('❌ Adding curated traders failed:', error)
      
      return reply.status(500).send({
        success: false,
        error: 'Adding curated traders failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Get bootstrap status endpoint
  fastify.get('/bootstrap/status', async (request, reply) => {
    try {
      const { prisma } = await import('../../lib/prisma')
      
      // Check current database state
      const [walletsCount, pnlSnapshots7d, pnlSnapshots30d, famousTraders] = await Promise.all([
        prisma.wallet.count(),
        prisma.pnlSnapshot.count({ where: { period: '7D' } }),
        prisma.pnlSnapshot.count({ where: { period: '30D' } }),
        prisma.wallet.count({ where: { isFamousTrader: true } })
      ])

      const isBootstrapped = walletsCount > 0 && (pnlSnapshots7d > 0 || pnlSnapshots30d > 0)
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          isBootstrapped,
          walletsCount,
          pnlSnapshots7d,
          pnlSnapshots30d,
          famousTraders,
          phase1Complete: isBootstrapped,
          recommendations: {
            needsWalletDiscovery: walletsCount === 0,
            needsHistoricalPNL: pnlSnapshots7d === 0 && pnlSnapshots30d === 0,
            needsFamousTraders: famousTraders === 0
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to get bootstrap status:', error)
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to get bootstrap status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })
} 