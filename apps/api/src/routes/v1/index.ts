import { FastifyInstance } from 'fastify'
import { leaderboardRoutes } from './leaderboard'
import { DuneService } from '../../services/dune.service'
import { GeyserService } from '../../services/geyser.service'

// Global Geyser service instance
let geyserService: GeyserService | null = null

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

  // Geyser service endpoints for Phase 2
  fastify.post('/geyser/start', async (request, reply) => {
    try {
      const endpoint = process.env.CHAINSTACK_GEYSER_ENDPOINT
      const token = process.env.CHAINSTACK_API_KEY

      if (!endpoint) {
        return reply.status(400).send({
          success: false,
          error: 'Chainstack Geyser endpoint not configured',
          message: 'Please set CHAINSTACK_GEYSER_ENDPOINT environment variable'
        })
      }

      if (geyserService && geyserService.getStatus().connected) {
        return reply.status(409).send({
          success: false,
          error: 'Geyser service already running',
          status: geyserService.getStatus()
        })
      }

      console.log('🚀 Starting Geyser service for Phase 2 real-time streaming...')
      
      geyserService = new GeyserService({ endpoint, token })
      await geyserService.connect()

      // Start subscribing to DEX transactions
      const dexPrograms = [
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium V4
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpools
        'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Orca V1
        '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca V2
      ]

      // Start transaction subscription in background
      geyserService.subscribeToTransactions(dexPrograms).catch(error => {
        console.error('❌ Transaction subscription failed:', error)
      })

      return {
        success: true,
        message: 'Geyser service started successfully',
        timestamp: new Date().toISOString(),
        status: geyserService.getStatus(),
        subscribedPrograms: dexPrograms.length
      }
    } catch (error) {
      console.error('❌ Failed to start Geyser service:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to start Geyser service',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  fastify.post('/geyser/stop', async (request, reply) => {
    try {
      if (!geyserService) {
        return reply.status(404).send({
          success: false,
          error: 'Geyser service not running'
        })
      }

      console.log('🛑 Stopping Geyser service...')
      await geyserService.disconnect()
      geyserService = null

      return {
        success: true,
        message: 'Geyser service stopped successfully',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Failed to stop Geyser service:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to stop Geyser service',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  fastify.get('/geyser/status', async (request, reply) => {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        running: geyserService !== null,
        status: geyserService?.getStatus() || { connected: false, reconnectAttempts: 0 },
        phase: geyserService ? 'Phase 2 - Real-time Streaming' : 'Phase 1 - Dune Analytics',
        description: geyserService 
          ? 'Streaming real-time transactions from Chainstack Geyser'
          : 'Using historical data from Dune Analytics'
      }
    }
  })

  fastify.post('/geyser/subscribe-wallets', async (request, reply) => {
    try {
      const { wallets } = request.body as { wallets: string[] }

      if (!geyserService || !geyserService.getStatus().connected) {
        return reply.status(400).send({
          success: false,
          error: 'Geyser service not connected'
        })
      }

      if (!wallets || !Array.isArray(wallets)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid wallets array provided'
        })
      }

      console.log(`👥 Subscribing to ${wallets.length} wallets for real-time tracking...`)
      
      // Start wallet subscription in background
      geyserService.subscribeToWallets(wallets).catch(error => {
        console.error('❌ Wallet subscription failed:', error)
      })

      return {
        success: true,
        message: `Subscribed to ${wallets.length} wallets`,
        timestamp: new Date().toISOString(),
        wallets: wallets.length
      }
    } catch (error) {
      console.error('❌ Failed to subscribe to wallets:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to subscribe to wallets',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
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

  // New endpoint for bonk launchpad bootstrap
  fastify.post('/bootstrap/bonk-launchpad', async (request, reply) => {
    try {
      const duneService = new DuneService()
      const result = await duneService.bootstrapBonkLaunchpadData()
      reply.code(200).send({
        success: true,
        message: 'Bonk launchpad bootstrap completed successfully',
        data: result
      })
    } catch (error) {
      console.error('Bonk launchpad bootstrap failed:', error)
      reply.code(500).send({
        success: false,
        message: 'Bonk launchpad bootstrap failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Test endpoint for bonk launchpad query
  fastify.get('/bootstrap/test-bonk-query', async (request, reply) => {
    try {
      const duneService = new DuneService()
      // Test with 1 day timeframe
      const result = await duneService.queryBonkLaunchpadTraders('1d')
      reply.code(200).send({
        success: true,
        message: `Found ${result.length} bonk launchpad traders`,
        data: result.slice(0, 10) // Return first 10 for testing
      })
    } catch (error) {
      console.error('Bonk launchpad query test failed:', error)
      reply.code(500).send({
        success: false,
        message: 'Bonk launchpad query test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
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