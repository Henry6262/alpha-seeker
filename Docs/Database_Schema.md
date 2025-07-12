# Alpha Seeker Database Schema Documentation

**Last Updated:** 2025-07-12  
**Database:** SQLite (Development) / PostgreSQL (Production)  
**ORM:** Prisma  
**Version:** 1.2.0

## Overview

This document serves as the comprehensive reference for Alpha Seeker's database structure. All database-related development should reference this document to ensure consistency and avoid conflicts.

## Core Tables

### 1. Users Table (`users`)
**Purpose:** Store user profile information, wallet addresses, and Twitter integration data

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | Primary Key, CUID | Unique user identifier |
| `walletAddress` | String | Unique, Required | Solana wallet address |
| `twitterHandle` | String | Unique, Optional | Twitter username without @ |
| `twitterId` | String | Unique, Optional | Twitter user ID for API consistency |
| `displayName` | String | Optional | User's display name for UI |
| `avatar` | String | Optional | Profile picture URL |
| `bio` | String | Optional | User bio/description |
| `subscriptionTier` | String | Default: "free" | Subscription level: free, degen, market_maker |
| `isVerified` | Boolean | Default: false | Twitter verified status |
| `followerCount` | Int | Optional | Twitter follower count for social proof |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Record last update timestamp |

**Relationships:**
- One-to-many: Subscriptions
- One-to-many: NotificationPreferences
- One-to-many: Trades

### 2. Tokens Table (`tokens`)
**Purpose:** Store token metadata and ecosystem information

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `address` | String | Primary Key | Token contract address |
| `symbol` | String | Required | Token symbol (e.g., SOL, BONK) |
| `name` | String | Required | Token full name |
| `decimals` | Int | Required | Token decimal places |
| `ecosystem` | String | Required | Token ecosystem: all, pump.fun, letsbonk.fun |
| `marketCap` | Float | Optional | Current market capitalization |
| `price` | Float | Optional | Current price in USD |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Record last update timestamp |

**Relationships:**
- One-to-many: Trades
- One-to-many: TokenHoldings

### 3. Trades Table (`trades`)
**Purpose:** Store individual trading transactions

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | Primary Key, CUID | Unique trade identifier |
| `signature` | String | Unique, Required | Solana transaction signature |
| `walletAddress` | String | Required, Foreign Key | Trader's wallet address |
| `tokenAddress` | String | Required, Foreign Key | Token contract address |
| `action` | String | Required | Trade action: buy, sell |
| `amountSol` | Float | Required | SOL amount involved |
| `amountToken` | Float | Required | Token amount involved |
| `price` | Float | Required | Price at time of trade |
| `timestamp` | DateTime | Required | Trade execution time |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |

**Relationships:**
- Many-to-one: User (via walletAddress)
- Many-to-one: Token (via tokenAddress)

### 4. Leaderboard Cache Table (`leaderboard_cache`)
**Purpose:** Cache leaderboard calculations for performance optimization

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | Primary Key, CUID | Unique cache entry identifier |
| `walletAddress` | String | Required | Wallet address being ranked |
| `leaderboardType` | String | Required | Type: pnl, volume |
| `timeframe` | String | Required | Period: 1h, 1d, 7d, 30d |
| `ecosystem` | String | Required | Ecosystem: all, pump.fun, letsbonk.fun |
| `rank` | Int | Required | Ranking position |
| `metric` | Float | Required | PNL or Volume in SOL |
| `calculatedAt` | DateTime | Auto-generated | Calculation timestamp |
| `expiresAt` | DateTime | Required | Cache expiration time |

**Unique Constraints:**
- `walletAddress + leaderboardType + timeframe + ecosystem`

### 5. Subscriptions Table (`subscriptions`)
**Purpose:** Manage user subscription payments and status

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | Primary Key, CUID | Unique subscription identifier |
| `userId` | String | Required, Foreign Key | User identifier |
| `tier` | String | Required | Subscription tier: free, degen, market_maker |
| `status` | String | Required | Status: active, inactive, expired |
| `solAmount` | Float | Optional | Amount paid in SOL |
| `signature` | String | Optional | Solana transaction signature |
| `startDate` | DateTime | Auto-generated | Subscription start date |
| `endDate` | DateTime | Optional | Subscription end date |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |

**Relationships:**
- Many-to-one: User (via userId)

### 6. Notification Preferences Table (`notification_preferences`)
**Purpose:** Store user notification settings and watched wallets

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | Primary Key, CUID | Unique preference identifier |
| `userId` | String | Required, Foreign Key | User identifier |
| `walletAddress` | String | Required | Wallet address to watch |
| `minSolAmount` | Float | Default: 0.01 | Minimum SOL amount for notifications |
| `minMarketCap` | Float | Optional | Minimum market cap filter |
| `maxMarketCap` | Float | Optional | Maximum market cap filter |
| `enabled` | Boolean | Default: true | Whether notifications are enabled |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Record last update timestamp |

**Relationships:**
- Many-to-one: User (via userId)

### 7. Notification History Table (`notification_history`)
**Purpose:** Track sent notifications for analytics and debugging

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | Primary Key, CUID | Unique notification identifier |
| `userId` | String | Required | User identifier |
| `walletAddress` | String | Required | Wallet that triggered notification |
| `tradeId` | String | Required | Reference to the trade |
| `message` | String | Required | Notification message content |
| `sent` | Boolean | Default: false | Whether notification was sent |
| `sentAt` | DateTime | Optional | Notification send timestamp |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |

### 8. Token Holdings Table (`token_holdings`)
**Purpose:** Store wallet token holdings for gems discovery

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | Primary Key, CUID | Unique holding identifier |
| `tokenAddress` | String | Required, Foreign Key | Token contract address |
| `walletAddress` | String | Required | Wallet address |
| `amount` | Float | Required | Token amount held |
| `valueSol` | Float | Required | Value in SOL |
| `lastUpdated` | DateTime | Auto-generated | Last update timestamp |

**Unique Constraints:**
- `tokenAddress + walletAddress`

**Relationships:**
- Many-to-one: Token (via tokenAddress)

## Subscription Tiers

### Free Tier
- Basic leaderboard access
- Limited notification preferences
- No real-time alerts

### Degen Tier ($5/month in SOL)
- Advanced filtering options
- Real-time notifications
- Priority support

### Market Maker Tier ($25/month in SOL)
- All features
- Custom notification rules
- API access
- Advanced analytics

## Indexing Strategy

### Primary Indexes
- `users.walletAddress` - Unique index for wallet lookups
- `users.twitterHandle` - Unique index for Twitter integration
- `trades.signature` - Unique index for transaction deduplication
- `leaderboard_cache.walletAddress + leaderboardType + timeframe + ecosystem` - Composite unique index

### Performance Indexes
- `trades.walletAddress` - For user trade history
- `trades.timestamp` - For time-based queries
- `leaderboard_cache.expiresAt` - For cache cleanup
- `tokens.ecosystem` - For ecosystem filtering

## Migration Strategy

### Development
- SQLite for local development
- Prisma migrations for schema changes
- Seed data for testing

### Production
- PostgreSQL for production
- Automated migrations via CI/CD
- Database backups and replication

## Data Retention Policy

### User Data
- User profiles: Indefinite (until deletion request)
- Trades: 2 years for analytics
- Notifications: 90 days for debugging

### Cache Data
- Leaderboard cache: 24 hours TTL
- Token holdings: 1 hour TTL

## Security Considerations

### Data Protection
- Wallet addresses are public data
- Twitter information follows platform ToS
- No private keys stored
- All sensitive operations logged

### Access Control
- API rate limiting
- Subscription tier validation
- User data isolation

## API Endpoints Related to Schema

### User Management
- `GET /api/v1/users/:walletAddress` - Get user profile
- `POST /api/v1/users` - Create/update user profile
- `PUT /api/v1/users/:id/twitter` - Link Twitter account

### Leaderboards
- `GET /api/v1/leaderboard` - Get cached leaderboard data
- `POST /api/v1/leaderboard/refresh` - Trigger cache refresh

### Notifications
- `GET /api/v1/notifications/preferences` - Get user preferences
- `POST /api/v1/notifications/preferences` - Update preferences
- `GET /api/v1/notifications/history` - Get notification history

### Subscriptions
- `POST /api/v1/subscriptions/payment` - Process subscription payment
- `GET /api/v1/subscriptions/status` - Check subscription status

## Change Log

### Version 1.2.0 (2025-07-12)
- Added Twitter integration fields to User model
- Enhanced user profile with social proof data
- Added comprehensive documentation

### Version 1.1.0 (2025-07-10)
- Initial schema with core tables
- Basic subscription and notification support
- Leaderboard caching system

### Version 1.0.0 (2025-07-08)
- Initial database schema
- Basic user and trade tracking 