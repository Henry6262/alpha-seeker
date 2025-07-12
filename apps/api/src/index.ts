import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { v1Routes } from './routes/v1/index.js'
import { startLeaderboardRefreshJob } from './jobs/leaderboard.job.js'

const fastify = Fastify({
  logger: true
})

// Register CORS
await fastify.register(cors, {
  origin: true
})

// Register WebSocket support
await fastify.register(websocket)

// Register v1 API routes
await fastify.register(v1Routes, { prefix: '/api/v1' })

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Start the daily leaderboard refresh job
startLeaderboardRefreshJob()

// Start server
const start = async () => {
  try {
    const host = process.env.HOST || '0.0.0.0'
    const port = parseInt(process.env.PORT || '3000')
    
    await fastify.listen({ host, port })
    
    console.log(`🚀 Alpha Seeker API running on http://${host}:${port}`)
    console.log('📊 API endpoints available at:')
    console.log(`   - Health: http://${host}:${port}/health`)
    console.log(`   - Bootstrap: http://${host}:${port}/api/v1/bootstrap/bonk-launchpad`)
    console.log(`   - Leaderboard: http://${host}:${port}/api/v1/leaderboard`)
    console.log(`   - Status: http://${host}:${port}/api/v1/bootstrap/status`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start() 