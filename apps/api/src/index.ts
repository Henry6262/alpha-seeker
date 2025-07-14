import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { v1Routes } from './routes/v1/index.js'
import { startLeaderboardRefreshJob } from './jobs/leaderboard.job.js'
import { appConfig, configHelpers } from './config/index.js'
import { ApiResponse } from './types/index.js'

const fastify = Fastify({
  logger: true
})

// Validate configuration at startup
configHelpers.validateConfig()

// Register CORS
await fastify.register(cors, {
  origin: true
})

// Register WebSocket support
await fastify.register(websocket)

// Register v1 API routes
await fastify.register(v1Routes, { prefix: '/api/v1' })

// Health check endpoint with configuration info
fastify.get('/health', async (request, reply): Promise<ApiResponse> => {
  return { 
    success: true,
    data: {
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: appConfig.server.nodeEnv,
      features: {
        kolTraders: appConfig.walletTracking.enableKolTraders,
        realTimeTracking: appConfig.walletTracking.enableRealTimeTracking,
        duneIntegration: appConfig.dataSources.enableDuneIntegration,
        mockData: appConfig.dataSources.enableMockData
      },
      limits: {
        maxTrackableWallets: configHelpers.getMaxTrackableWallets(),
        maxWalletsConfigured: appConfig.walletTracking.maxWalletsToTrack,
        maxConcurrentStreams: appConfig.geyser.maxConcurrentStreams,
        maxAccountsPerStream: appConfig.geyser.maxAccountsPerStream
      }
    },
    timestamp: new Date().toISOString()
  }
})

// Configuration endpoint
fastify.get('/config', async (request, reply): Promise<ApiResponse> => {
  // Return safe configuration (no sensitive data)
  return {
    success: true,
    data: {
      walletTracking: {
        maxWalletsToTrack: appConfig.walletTracking.maxWalletsToTrack,
        defaultTimeframe: appConfig.walletTracking.defaultTimeframe,
        enableKolTraders: appConfig.walletTracking.enableKolTraders,
        enableRealTimeTracking: appConfig.walletTracking.enableRealTimeTracking,
      },
      leaderboard: {
        defaultLimit: appConfig.leaderboard.defaultLimit,
        maxLimit: appConfig.leaderboard.maxLimit,
        cacheTtlMinutes: appConfig.leaderboard.cacheTtlMinutes,
      },
      geyser: {
        maxAccountsPerStream: appConfig.geyser.maxAccountsPerStream,
        maxConcurrentStreams: appConfig.geyser.maxConcurrentStreams,
        reconnectMaxAttempts: appConfig.geyser.reconnectMaxAttempts,
        pingIntervalMs: appConfig.geyser.pingIntervalMs,
      },
      features: {
        kolTraders: appConfig.walletTracking.enableKolTraders,
        realTimeTracking: appConfig.walletTracking.enableRealTimeTracking,
        duneIntegration: appConfig.dataSources.enableDuneIntegration,
        mockData: appConfig.dataSources.enableMockData,
      },
      limits: {
        maxTrackableWallets: configHelpers.getMaxTrackableWallets(),
        canTrack200Wallets: configHelpers.canTrackWalletCount(200),
        requiredStreamsFor200: configHelpers.calculateRequiredStreams(200),
      }
    },
    timestamp: new Date().toISOString()
  }
})

// Start the daily leaderboard refresh job
startLeaderboardRefreshJob()

// Start server
const start = async () => {
  try {
    const host = process.env.HOST || 'localhost'
    const port = appConfig.server.port
    
    await fastify.listen({ host, port })
    
    console.log(`🚀 Alpha Seeker API running on http://${host}:${port}`)
    console.log('📊 API endpoints available at:')
    console.log(`   - Health: http://${host}:${port}/health`)
    console.log(`   - Config: http://${host}:${port}/config`)
    console.log(`   - Status: http://${host}:${port}/api/v1/status`)
    console.log(`   - KOL Leaderboard: http://${host}:${port}/api/v1/leaderboard/kol`)
    console.log(`   - Ecosystem Leaderboard: http://${host}:${port}/api/v1/leaderboard/ecosystem`)
    console.log('')
    console.log('🔧 Bootstrap & Data Management:')
    console.log(`   - Complete Bootstrap: http://${host}:${port}/api/v1/bootstrap/decoupled-bootstrap`)
    console.log(`   - Refresh Dune Cache: http://${host}:${port}/api/v1/bootstrap/refresh-dune-cache`)
    console.log(`   - Setup KOL Wallets: http://${host}:${port}/api/v1/bootstrap/setup-kol-wallets`)
    console.log(`   - Populate KOL from Dune: http://${host}:${port}/api/v1/bootstrap/populate-kol-from-dune`)
    console.log('')
    console.log('💡 To update Dune cache, run these commands:')
    console.log(`   curl -X POST http://${host}:${port}/api/v1/bootstrap/refresh-dune-cache`)
    console.log(`   curl -X POST http://${host}:${port}/api/v1/bootstrap/setup-kol-wallets`)
    console.log('')
    console.log('🚀 One-command complete setup:')
    console.log(`   curl -X POST http://${host}:${port}/api/v1/bootstrap/decoupled-bootstrap`)
    
    if (appConfig.walletTracking.enableRealTimeTracking) {
      console.log(`   - Geyser Control: http://${host}:${port}/api/v1/geyser/status`)
    }
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start() 