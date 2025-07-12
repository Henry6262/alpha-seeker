import { FastifyInstance } from 'fastify'
import { leaderboardRoutes } from './leaderboard'

export async function v1Routes(fastify: FastifyInstance) {
  // Register API routes with /api/v1 prefix
  await fastify.register(leaderboardRoutes, { prefix: '/api/v1' })
  
  // Health check for v1 API
  fastify.get('/api/v1/health', async () => {
    return {
      success: true,
      message: 'Alpha Seeker API v1 is healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  })
} 