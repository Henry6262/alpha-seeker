import { z } from 'zod'

// Environment validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().default('file:./dev.db'),
  
  // External APIs
  DUNE_API_KEY: z.string().optional(),
  
  // Yellowstone gRPC Configuration
  YELLOWSTONE_GRPC_ENDPOINT: z.string().optional(),
  YELLOWSTONE_X_TOKEN: z.string().optional(),
  YELLOWSTONE_USERNAME: z.string().optional(),
  YELLOWSTONE_PASSWORD: z.string().optional(),
  
  // Chainstack Configuration
  CHAINSTACK_API_KEY: z.string().optional(),
  
  // Server Configuration
  PORT: z.string().transform(Number).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Leaderboard Configuration
  LEADERBOARD_DEFAULT_LIMIT: z.string().transform(Number).default(100),
  LEADERBOARD_MAX_LIMIT: z.string().transform(Number).default(500),
  LEADERBOARD_CACHE_TTL_MINUTES: z.string().transform(Number).default(15),
  
  // Wallet Tracking Configuration
  WALLET_TRACKER_DEFAULT_COUNT: z.string().transform(Number).default(50),
  WALLET_TRACKER_MAX_COUNT: z.string().transform(Number).default(200),
  WALLET_TRACKER_DEFAULT_TIMEFRAME: z.enum(['7d', '30d']).default('7d'),
  
  // Geyser Stream Configuration
  GEYSER_MAX_ACCOUNTS_PER_STREAM: z.string().transform(Number).default(50),
  GEYSER_MAX_CONCURRENT_STREAMS: z.string().transform(Number).default(5),
  GEYSER_RECONNECT_MAX_ATTEMPTS: z.string().transform(Number).default(5),
  GEYSER_PING_INTERVAL_MS: z.string().transform(Number).default(10000),
  
  // Feature Toggles
  ENABLE_KOL_TRADERS: z.string().transform((val: string) => val === 'true').default(true),
  ENABLE_REAL_TIME_TRACKING: z.string().transform((val: string) => val === 'true').default(true),
  ENABLE_DUNE_INTEGRATION: z.string().transform((val: string) => val === 'true').default(true),
  USE_MOCK_DATA: z.string().transform((val: string) => val === 'true').default(false),
  
  // Data Source Priority
  PRIORITIZE_GEYSER_DATA: z.string().transform((val: string) => val === 'true').default(true),
  
  // Refresh Schedules
  LEADERBOARD_REFRESH_CRON: z.string().default('0 2 * * *'), // Daily at 2 AM UTC
  DUNE_REFRESH_CRON: z.string().default('0 2 * * *'), // Daily at 2 AM UTC
})

// Parse and validate environment variables
function validateEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment configuration:', error)
    process.exit(1)
  }
}

// Configuration object with validated environment variables
export const config = validateEnv()

// TypeScript types for configuration
export type Config = z.infer<typeof envSchema>

// Wallet tracking configuration
export interface WalletTrackingConfig {
  maxWalletsToTrack: number
  defaultTimeframe: '7d' | '30d'
  maxAccountsPerStream: number
  maxConcurrentStreams: number
  enableKolTraders: boolean
  enableRealTimeTracking: boolean
}

// Geyser streaming configuration
export interface GeyserStreamConfig {
  endpoint?: string
  xToken?: string
  username?: string
  password?: string
  chainstackApiKey?: string
  maxAccountsPerStream: number
  maxConcurrentStreams: number
  reconnectMaxAttempts: number
  pingIntervalMs: number
}

// Leaderboard configuration
export interface LeaderboardConfig {
  defaultLimit: number
  maxLimit: number
  cacheTtlMinutes: number
  refreshCron: string
}

// Data source configuration
export interface DataSourceConfig {
  enableDuneIntegration: boolean
  enableMockData: boolean
  prioritizeGeyserData: boolean
  duneApiKey?: string
  duneRefreshCron: string
}

// Main configuration object with all settings
export const appConfig = {
  server: {
    port: config.PORT,
    nodeEnv: config.NODE_ENV,
  },
  
  database: {
    url: config.DATABASE_URL,
  },
  
  redis: {
    url: config.REDIS_URL,
  },
  
  walletTracking: {
    maxWalletsToTrack: config.WALLET_TRACKER_MAX_COUNT,
    defaultWalletsToTrack: config.WALLET_TRACKER_DEFAULT_COUNT,
    defaultTimeframe: config.WALLET_TRACKER_DEFAULT_TIMEFRAME,
    maxAccountsPerStream: config.GEYSER_MAX_ACCOUNTS_PER_STREAM,
    maxConcurrentStreams: config.GEYSER_MAX_CONCURRENT_STREAMS,
    enableKolTraders: config.ENABLE_KOL_TRADERS,
    enableRealTimeTracking: config.ENABLE_REAL_TIME_TRACKING,
  } as WalletTrackingConfig,
  
  geyser: {
    endpoint: config.YELLOWSTONE_GRPC_ENDPOINT,
    xToken: config.YELLOWSTONE_X_TOKEN,
    username: config.YELLOWSTONE_USERNAME,
    password: config.YELLOWSTONE_PASSWORD,
    chainstackApiKey: config.CHAINSTACK_API_KEY,
    maxAccountsPerStream: config.GEYSER_MAX_ACCOUNTS_PER_STREAM,
    maxConcurrentStreams: config.GEYSER_MAX_CONCURRENT_STREAMS,
    reconnectMaxAttempts: config.GEYSER_RECONNECT_MAX_ATTEMPTS,
    pingIntervalMs: config.GEYSER_PING_INTERVAL_MS,
  } as GeyserStreamConfig,
  
  leaderboard: {
    defaultLimit: config.LEADERBOARD_DEFAULT_LIMIT,
    maxLimit: config.LEADERBOARD_MAX_LIMIT,
    cacheTtlMinutes: config.LEADERBOARD_CACHE_TTL_MINUTES,
    refreshCron: config.LEADERBOARD_REFRESH_CRON,
  } as LeaderboardConfig,
  
  dataSources: {
    enableDuneIntegration: config.ENABLE_DUNE_INTEGRATION,
    enableMockData: config.USE_MOCK_DATA,
    prioritizeGeyserData: config.PRIORITIZE_GEYSER_DATA,
    duneApiKey: config.DUNE_API_KEY,
    duneRefreshCron: config.DUNE_REFRESH_CRON,
  } as DataSourceConfig,
}

// Helper functions for configuration
export const configHelpers = {
  // Calculate number of streams needed for given wallet count
  calculateRequiredStreams: (walletCount: number): number => {
    return Math.ceil(walletCount / appConfig.geyser.maxAccountsPerStream)
  },
  
  // Check if wallet count is within limits
  canTrackWalletCount: (walletCount: number): boolean => {
    const requiredStreams = configHelpers.calculateRequiredStreams(walletCount)
    return requiredStreams <= appConfig.geyser.maxConcurrentStreams
  },
  
  // Get maximum trackable wallets based on stream limits
  getMaxTrackableWallets: (): number => {
    return appConfig.geyser.maxConcurrentStreams * appConfig.geyser.maxAccountsPerStream
  },
  
  // Validate configuration at startup
  validateConfig: (): void => {
    const maxTrackable = configHelpers.getMaxTrackableWallets()
    
    if (appConfig.walletTracking.maxWalletsToTrack > maxTrackable) {
      console.warn(`⚠️ Warning: WALLET_TRACKER_MAX_COUNT (${appConfig.walletTracking.maxWalletsToTrack}) exceeds Chainstack limits (${maxTrackable})`)
      console.warn(`   Consider upgrading Chainstack plan or reducing wallet count`)
    }
    
    if (!appConfig.geyser.endpoint && appConfig.walletTracking.enableRealTimeTracking) {
      console.warn('⚠️ Warning: Real-time tracking enabled but YELLOWSTONE_GRPC_ENDPOINT not configured')
    }
    
    if (!appConfig.dataSources.duneApiKey && appConfig.dataSources.enableDuneIntegration) {
      console.warn('⚠️ Warning: Dune integration enabled but DUNE_API_KEY not configured')
    }
    
    console.log('✅ Configuration validated successfully')
    console.log(`📊 Max trackable wallets: ${maxTrackable} (${appConfig.geyser.maxConcurrentStreams} streams × ${appConfig.geyser.maxAccountsPerStream} accounts)`)
    console.log(`🎯 Current wallet tracking limit: ${appConfig.walletTracking.maxWalletsToTrack}`)
    console.log(`⚙️ Environment: ${appConfig.server.nodeEnv}`)
  }
}

// Types are already exported above as interfaces 