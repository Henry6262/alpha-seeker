# Alpha Seeker Configuration Guide

## Overview

Alpha Seeker now features a comprehensive configuration system that allows you to customize every aspect of the platform's behavior. This guide covers all configuration options, environment variables, and best practices for different deployment scenarios.

## Configuration Architecture

### 🎯 **Key Features**
- **Environment-based configuration** with validation
- **TypeScript type safety** for all configuration options
- **Smart defaults** for different deployment scenarios
- **Chainstack limit awareness** for optimal stream allocation
- **Feature toggles** for easy customization
- **Automatic validation** at startup

### 🔧 **Configuration Sources**
1. **Environment variables** (highest priority)
2. **Default values** (fallback)
3. **Runtime validation** with helpful error messages

## Environment Variables

### Core Configuration

```bash
# Database
DATABASE_URL="file:./dev.db"

# External APIs
DUNE_API_KEY="your_dune_api_key_here"

# Yellowstone gRPC Configuration (Chainstack)
YELLOWSTONE_GRPC_ENDPOINT="yellowstone-solana-mainnet.core.chainstack.com"
YELLOWSTONE_X_TOKEN="b78715330157d1f67b31ade41d9f5972"
YELLOWSTONE_USERNAME="vigorous-wilson"
YELLOWSTONE_PASSWORD="your_password_here"

# Server
PORT=3000
NODE_ENV="development"  # development | production | test
```

### Leaderboard Configuration

```bash
# Default number of items to return in leaderboard API calls
LEADERBOARD_DEFAULT_LIMIT=100

# Maximum number of items allowed in leaderboard API calls  
LEADERBOARD_MAX_LIMIT=500

# Leaderboard cache TTL in minutes
LEADERBOARD_CACHE_TTL_MINUTES=15
```

### Wallet Tracking Configuration

```bash
# Default number of wallets to track from leaderboard
WALLET_TRACKER_DEFAULT_COUNT=50

# Maximum number of wallets that can be tracked
WALLET_TRACKER_MAX_COUNT=200

# Default timeframe for selecting wallets ('7d' | '30d')
WALLET_TRACKER_DEFAULT_TIMEFRAME="7d"
```

### Chainstack Geyser Limits

```bash
# Maximum Solana accounts per stream (Chainstack limit: 50)
GEYSER_MAX_ACCOUNTS_PER_STREAM=50

# Maximum concurrent streams (Chainstack $149/month plan: 5)
GEYSER_MAX_CONCURRENT_STREAMS=5

# Maximum reconnection attempts before giving up
GEYSER_RECONNECT_MAX_ATTEMPTS=5

# Ping interval to keep connection alive (milliseconds)
GEYSER_PING_INTERVAL_MS=10000
```

### Feature Toggles

```bash
# Enable KOL (Key Opinion Leader) trader tracking
ENABLE_KOL_TRADERS="true"

# Enable real-time wallet tracking via Geyser
ENABLE_REAL_TIME_TRACKING="true"

# Enable Dune Analytics integration for historical data
ENABLE_DUNE_INTEGRATION="true"

# Enable mock data when real data is unavailable
ENABLE_MOCK_DATA="true"

# Prioritize Geyser (real-time) data over Dune (historical) data
PRIORITIZE_GEYSER_DATA="true"
```

### Cron Job Schedules

```bash
# Leaderboard refresh schedule (daily at 2 AM UTC)
LEADERBOARD_REFRESH_CRON="0 2 * * *"

# Dune data refresh schedule (daily at 2 AM UTC)  
DUNE_REFRESH_CRON="0 2 * * *"
```

## Multi-Stream Wallet Tracking

### 🎯 **Chainstack Plan Optimization**

**$149/month Plan Limits:**
- 5 concurrent streams maximum
- 50 accounts per stream maximum
- **Total capacity: 250 wallets**

**Optimal Configuration for 200+ Wallets:**
```bash
WALLET_TRACKER_MAX_COUNT=200          # Track 200 wallets
GEYSER_MAX_ACCOUNTS_PER_STREAM=50     # 50 wallets per stream
GEYSER_MAX_CONCURRENT_STREAMS=5       # 5 streams available

# Required streams for 200 wallets: 4 (200 ÷ 50 = 4)
# Remaining capacity: 1 stream (for overhead/failover)
```

### 📊 **Stream Allocation Example**

For 200 wallets with 50 accounts per stream:
- **Stream 1**: Wallets 1-50 (50 accounts)
- **Stream 2**: Wallets 51-100 (50 accounts)  
- **Stream 3**: Wallets 101-150 (50 accounts)
- **Stream 4**: Wallets 151-200 (50 accounts)
- **Stream 5**: Available for failover/expansion

## API Endpoints

### Configuration Endpoints

```bash
# Get current configuration (safe, no secrets)
GET /config

# Enhanced health check with configuration info
GET /health
```

### Multi-Stream Wallet Tracking

```bash
# Get wallets from leaderboard for tracking
GET /api/v1/wallet-tracker/leaderboard-wallets?timeframe=7d&limit=200

# Subscribe to leaderboard wallets with multi-stream allocation
POST /api/v1/wallet-tracker/subscribe-leaderboard
{
  "timeframe": "7d",
  "limit": 200,
  "includeTransactions": true,
  "includeAccountUpdates": true
}

# Get tracking summary with stream allocation details
GET /api/v1/wallet-tracker/summary
```

### Geyser Control

```bash
# Start Geyser service with configuration
POST /api/v1/geyser/start

# Get Geyser status with stream details
GET /api/v1/geyser/status

# Stop all active streams
POST /api/v1/geyser/stop
```

## Configuration Validation

### 🔍 **Startup Validation**

The system automatically validates your configuration at startup:

```typescript
// Automatic validation checks:
✅ Wallet tracking limits vs Chainstack capacity
✅ Required API keys for enabled features  
✅ Environment variable types and ranges
✅ Cron schedule syntax
✅ Feature flag dependencies
```

### ⚠️ **Common Warnings**

```bash
# Wallet count exceeds Chainstack limits
⚠️ Warning: WALLET_TRACKER_MAX_COUNT (300) exceeds Chainstack limits (250)
   Consider upgrading Chainstack plan or reducing wallet count

# Missing API keys for enabled features
⚠️ Warning: Real-time tracking enabled but CHAINSTACK_GEYSER_ENDPOINT not configured
⚠️ Warning: Dune integration enabled but DUNE_API_KEY not configured
```

## Configuration Examples

### Development Setup

```bash
# .env.development
NODE_ENV="development"
PORT=3000
DATABASE_URL="file:./dev.db"

# Conservative limits for development
WALLET_TRACKER_MAX_COUNT=25
GEYSER_MAX_CONCURRENT_STREAMS=2

# Enable all features with mock data
ENABLE_KOL_TRADERS="true"
ENABLE_REAL_TIME_TRACKING="true"
ENABLE_DUNE_INTEGRATION="true"
ENABLE_MOCK_DATA="true"
```

### Production Setup (200+ Wallets)

```bash
# .env.production
NODE_ENV="production"
PORT=3000
DATABASE_URL="postgresql://user:pass@host:5432/alphaSeeker"

# Chainstack API credentials
DUNE_API_KEY="dqe_your_actual_key_here"
CHAINSTACK_GEYSER_ENDPOINT="grpc://your-chainstack-endpoint"
CHAINSTACK_API_KEY="your_chainstack_api_key"

# Optimized for 200 wallet tracking
WALLET_TRACKER_MAX_COUNT=200
WALLET_TRACKER_DEFAULT_COUNT=200
GEYSER_MAX_ACCOUNTS_PER_STREAM=50
GEYSER_MAX_CONCURRENT_STREAMS=5

# Production features
ENABLE_KOL_TRADERS="true"
ENABLE_REAL_TIME_TRACKING="true"
ENABLE_DUNE_INTEGRATION="true"
ENABLE_MOCK_DATA="false"
PRIORITIZE_GEYSER_DATA="true"

# Optimized refresh schedule
LEADERBOARD_REFRESH_CRON="0 2 * * *"
DUNE_REFRESH_CRON="0 2 * * *"
```

### Testing Setup

```bash
# .env.test
NODE_ENV="test"
PORT=3001
DATABASE_URL="file:./test.db"

# Minimal limits for testing
WALLET_TRACKER_MAX_COUNT=10
GEYSER_MAX_CONCURRENT_STREAMS=1

# Disable external dependencies
ENABLE_REAL_TIME_TRACKING="false"
ENABLE_DUNE_INTEGRATION="false"
ENABLE_MOCK_DATA="true"
```

## KOL Traders vs Famous Traders

### 🎯 **Terminology Update**

**Old**: "Famous Traders"  
**New**: "KOL (Key Opinion Leader) Traders"

**Why the change?**
- More professional terminology
- Better suited for institutional audience
- Encompasses broader range of influential traders
- Industry-standard terminology

### 📊 **KOL Trader Features**

```bash
# Enable KOL trader tracking
ENABLE_KOL_TRADERS="true"

# Database field update
isKolTrader: boolean  // Previously: isFamousTrader
```

## Performance Tuning

### 🚀 **Optimal Settings for Different Scales**

**Small Scale (< 50 wallets):**
```bash
WALLET_TRACKER_MAX_COUNT=50
GEYSER_MAX_CONCURRENT_STREAMS=1
LEADERBOARD_CACHE_TTL_MINUTES=30
```

**Medium Scale (50-100 wallets):**
```bash
WALLET_TRACKER_MAX_COUNT=100
GEYSER_MAX_CONCURRENT_STREAMS=2
LEADERBOARD_CACHE_TTL_MINUTES=15
```

**Large Scale (200+ wallets):**
```bash
WALLET_TRACKER_MAX_COUNT=200
GEYSER_MAX_CONCURRENT_STREAMS=4
LEADERBOARD_CACHE_TTL_MINUTES=5
GEYSER_PING_INTERVAL_MS=5000
```

## Monitoring & Observability

### 📊 **Configuration Metrics**

Access real-time configuration status:

```bash
# Configuration summary
curl http://localhost:3000/config

# Health check with limits
curl http://localhost:3000/health

# Stream allocation status  
curl http://localhost:3000/api/v1/wallet-tracker/summary
```

### 🔍 **Key Metrics to Monitor**

```typescript
interface ConfigMetrics {
  // Capacity utilization
  utilizationPercentage: number
  totalWallets: number
  maxCapacity: number
  
  // Stream allocation
  activeStreams: number
  maxStreams: number
  
  // Performance
  avgResponseTime: number
  errorRate: number
}
```

## Troubleshooting

### ❌ **Common Issues**

**1. Wallet Count Exceeds Limits**
```bash
Error: Cannot track 300 wallets. Maximum trackable: 250
Solution: Reduce WALLET_TRACKER_MAX_COUNT or upgrade Chainstack plan
```

**2. Missing API Keys**
```bash
Warning: Real-time tracking enabled but CHAINSTACK_GEYSER_ENDPOINT not configured
Solution: Add CHAINSTACK_GEYSER_ENDPOINT and CHAINSTACK_API_KEY
```

**3. Invalid Cron Schedule**
```bash
Error: Invalid cron schedule format
Solution: Use valid cron syntax (e.g., "0 2 * * *")
```

### 🔧 **Configuration Validation Tool**

```bash
# Start the API to validate configuration
npm run dev

# Check startup logs for validation results
✅ Configuration validated successfully
📊 Max trackable wallets: 250 (5 streams × 50 accounts)
🎯 Current wallet tracking limit: 200
⚙️ Environment: development
```

---

## Next Steps

1. **Copy `env-example.txt` to `.env`**
2. **Set your API keys and preferred limits**
3. **Run `npm run dev` to validate configuration**
4. **Start with conservative limits and scale up**
5. **Monitor stream utilization in production**

For optimal 200+ wallet tracking, ensure you have:
- Chainstack $149/month plan
- Properly configured environment variables
- Adequate system resources for multi-stream processing 