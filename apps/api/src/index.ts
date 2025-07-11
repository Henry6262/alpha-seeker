import Fastify, { FastifyRequest, FastifyReply } from 'fastify'

const fastify = Fastify({
  logger: true
})

// Register CORS plugin
await fastify.register(import('@fastify/cors'), {
  origin: true // Allow all origins for development
})

// Health check endpoint
fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  return { status: 'ok', service: 'alpha-seeker-api', timestamp: new Date().toISOString() }
})

// API v1 routes placeholder
fastify.get('/api/v1/status', async (request: FastifyRequest, reply: FastifyReply) => {
  return { 
    message: 'Alpha Seeker API v1', 
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }
})

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000
    const host = process.env.HOST || '0.0.0.0'
    
    await fastify.listen({ port, host })
    console.log(`🚀 Alpha Seeker API running on http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start() 