import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { v1Routes } from './routes/v1/index.js'
import { startLeaderboardRefreshJob } from './jobs/leaderboard.job.js'
import { appConfig, configHelpers } from './config/index.js'

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
fastify.get('/health', async (request, reply) => {
  return { 
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
  }
})

// Configuration endpoint
fastify.get('/config', async (request, reply) => {
  // Return safe configuration (no sensitive data)
  return {
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
  }
})

// Start the daily leaderboard refresh job
startLeaderboardRefreshJob()

// Start server
const start = async () => {
  try {
    const host = process.env.HOST || '0.0.0.0'
    const port = appConfig.server.port
    
    await fastify.listen({ host, port })
    
    console.log(`🚀 Alpha Seeker API running on http://${host}:${port}`)
    console.log('📊 API endpoints available at:')
    console.log(`   - Health: http://${host}:${port}/health`)
    console.log(`   - Config: http://${host}:${port}/config`)
    console.log(`   - Bootstrap: http://${host}:${port}/api/v1/bootstrap/bonk-launchpad`)
    console.log(`   - Leaderboard: http://${host}:${port}/api/v1/leaderboard`)
    console.log(`   - Status: http://${host}:${port}/api/v1/bootstrap/status`)
    console.log(`   - Wallet Tracker: http://${host}:${port}/api/v1/wallet-tracker/summary`)
    
    if (appConfig.walletTracking.enableRealTimeTracking) {
      console.log(`   - Geyser Control: http://${host}:${port}/api/v1/geyser/status`)
    }
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start() 