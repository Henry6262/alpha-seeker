import Fastify, { FastifyRequest, FastifyReply } from 'fastify'
import { v1Routes } from './routes/v1/index'
import { startLeaderboardJob } from './jobs/leaderboard.job'

const fastify = Fastify({
  logger: true
})

// Register CORS plugin
await fastify.register(import('@fastify/cors'), {
  origin: true // Allow all origins for development
})

// Register WebSocket support
await fastify.register(import('@fastify/websocket'))

// Health check endpoint
fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  return { status: 'ok', service: 'alpha-seeker-api', timestamp: new Date().toISOString() }
})

// Register API v1 routes
await fastify.register(v1Routes)

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000
    const host = process.env.HOST || '0.0.0.0'
    
    // Start background jobs
    startLeaderboardJob()
    
    await fastify.listen({ port, host })
    console.log(`🚀 Alpha Seeker API running on http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start() 