# Alpha-Seeker Database Schema Documentation

## Overview
This document defines the complete database schema for the Alpha-Seeker Solana trading intelligence platform. The schema is designed to support real-time data ingestion from Chainstack's Geyser RPC, accurate PNL calculations using weighted average cost basis, and high-performance leaderboard queries.

## Architectural Principles

### Data Flow Strategy
The database follows a **hybrid two-phase approach**:
- **Phase 1**: Bootstrap historical data using Dune Analytics for immediate platform launch
- **Phase 2**: Real-time ingestion via Chainstack Geyser RPC for live data and independence

### Schema Design Philosophy
1. **Separation of Concerns**: Raw event data (transactions, token_transfers) separate from aggregated state (positions, pnl_snapshots)
2. **Performance Optimization**: Pre-calculated aggregates for fast read operations
3. **Data Source Agnostic**: Schema supports both Dune and Geyser data sources
4. **Event-Driven Architecture**: PostgreSQL NOTIFY/LISTEN for real-time updates

## Core Tables

### 1. wallets
**Purpose**: Central repository for tracked wallet addresses and their metadata

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| address | String | UNIQUE | Base-58 encoded wallet address |
| curatedName | String | NULLABLE | Human-readable name (e.g., "Ansem", "Cobie") |
| twitterHandle | String | NULLABLE | Twitter username without @ |
| displayName | String | NULLABLE | Display name for UI |
| isFamousTrader | Boolean | DEFAULT FALSE, INDEXED | Flag for "Gems" discovery feature |
| isLeaderboardUser | Boolean | DEFAULT TRUE, INDEXED | Include in leaderboard calculations |
| firstSeenAt | DateTime | DEFAULT now() | First indexed transaction timestamp |
| metadataJson | String | NULLABLE | JSON field for additional unstructured data |

**Key Features**:
- Indexed boolean flags for efficient filtering in analytical jobs
- Flexible metadata storage for future extensibility
- Supports both curated famous traders and dynamic wallet discovery

### 2. transactions
**Purpose**: Immutable chronological log of transaction events (TimescaleDB hypertable)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| signature | String | UNIQUE | Base-58 transaction signature |
| blockTime | DateTime | INDEXED | Confirmed timestamp (primary dimension) |
| slot | BigInt | INDEXED | Block slot number |
| signerAddress | String | FK to wallets.address | Primary fee-paying account |
| feeLamports | BigInt | | Transaction fee in lamports |
| wasSuccessful | Boolean | DEFAULT TRUE | Transaction success flag |

**Key Features**:
- Optimized for high-speed inserts
- TimescaleDB partitioning by blockTime for performance
- Lean structure to minimize storage overhead

### 3. token_transfers
**Purpose**: Granular token balance changes within transactions (most critical for PNL)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| transactionSignature | String | FK to transactions.signature | Links to parent transaction |
| walletAddress | String | FK to wallets.address | Wallet affected |
| tokenMintAddress | String | | Token mint address |
| amountChangeRaw | String | NOT NULL | Raw amount change (+ receive, - send) |
| preBalanceRaw | String | NOT NULL | Balance before transaction |
| postBalanceRaw | String | NOT NULL | Balance after transaction |
| tokenSymbol | String | NULLABLE | Cached token symbol |
| tokenName | String | NULLABLE | Cached token name |
| tokenDecimals | Int | NULLABLE | Cached token decimals |

**Key Features**:
- **Atomic representation**: Single swap = two rows (one negative, one positive)
- **Self-contained**: Includes cached token metadata to avoid external lookups
- **PostgreSQL triggers**: NOTIFY on insert for real-time WebSocket updates

### 4. positions
**Purpose**: Current wallet holdings and weighted average cost basis

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| walletAddress | String | FK to wallets.address | Wallet owner |
| tokenMintAddress | String | | Token mint address |
| currentBalanceRaw | String | NOT NULL | Current token quantity in raw units |
| totalCostBasisUsd | Float | NOT NULL | Total USD cost of current holdings |
| weightedAvgCostUsd | Float | NOT NULL | Average cost per token unit |
| lastUpdatedAt | DateTime | DEFAULT now() | Last update timestamp |

**Key Features**:
- **Real-time updates**: Updated on every trade by ingestion service
- **Weighted Average Cost**: Basis for accurate PNL calculations
- **Performance critical**: Powers real-time portfolio views

### 5. pnl_snapshots
**Purpose**: Pre-calculated PNL aggregates for high-performance leaderboards

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| walletAddress | String | FK to wallets.address | Wallet being measured |
| period | String | NOT NULL | Time window ('1D', '7D', '30D') |
| snapshotTimestamp | DateTime | DEFAULT now() | Snapshot generation time |
| realizedPnlUsd | Float | NOT NULL | Total realized P&L in USD |
| roiPercentage | Float | NULLABLE | Return on Investment percentage |
| winRate | Float | NULLABLE | Percentage of profitable trades |
| totalTrades | Int | NOT NULL | Total number of trades |

**Key Features**:
- **Background job populated**: Every 15 minutes by analytics service
- **Sub-second queries**: Leaderboard API becomes simple SELECT with ORDER BY
- **Multiple timeframes**: Supports 1D, 7D, and 30D leaderboards

## Supporting Tables

### 6. realized_pnl_events
**Purpose**: Detailed tracking of individual trade P&L for audit and analysis

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| walletAddress | String | | Wallet that made the trade |
| transactionSignature | String | | Reference to closing transaction |
| tokenMintAddress | String | | Token that was sold |
| quantitySold | String | | Amount sold in raw units |
| saleValueUsd | Float | | Total USD value of sale |
| costBasisUsd | Float | | Original cost basis |
| realizedPnlUsd | Float | | Calculated P&L |

### 7. gems_feed
**Purpose**: Discovered "gem" tokens showing alpha trader activity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| tokenMintAddress | String | | Token discovered as gem |
| tokenSymbol | String | NULLABLE | Cached token symbol |
| tokenName | String | NULLABLE | Cached token name |
| numAlphaBuyers | Int | | Number of famous traders buying |
| buyerNames | String | | JSON array of buyer names |
| firstSeenAt | DateTime | DEFAULT now() | Discovery timestamp |
| confidence | Float | | Confidence score for gem signal |
| isActive | Boolean | DEFAULT TRUE | Active gem flag |

### 8. leaderboard_cache
**Purpose**: Performance optimization for leaderboard queries

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | PRIMARY KEY | Unique identifier |
| walletAddress | String | | Wallet address |
| leaderboardType | String | | pnl, volume |
| timeframe | String | | 1h, 1d, 7d, 30d |
| ecosystem | String | | all, pump.fun, letsbonk.fun |
| rank | Int | | Leaderboard ranking |
| metric | Float | | PNL or Volume in USD |
| calculatedAt | DateTime | DEFAULT now() | Calculation timestamp |
| expiresAt | DateTime | | Cache expiration |

## PNL Calculation Engine

### Weighted Average Cost (WAC) Methodology
The system uses WAC for cost basis calculation:

```
WAC_per_token = Total_Cost_of_Acquisition_USD / Total_Quantity_of_Token_Held
```

### PNL Calculation Algorithm
1. **Identify Swap**: Analyze token_transfers for transaction signature
2. **Determine Trade Value**: 
   - Stablecoin case: Use par value
   - Non-stablecoin: Query external price oracle (Pyth/Birdeye)
3. **Process Buy Leg**: Update positions table with new cost basis
4. **Process Sell Leg**: Calculate realized PNL and update positions
5. **Record Event**: Store in realized_pnl_events table

### Real-time Leaderboard Updates
- **Background Analytics Job**: Runs every 15 minutes
- **Aggregation Logic**: SUM(realized_pnl_usd) from realized_pnl_events
- **Win Rate Calculation**: Profitable disposals / Total disposals
- **Snapshot Storage**: Results stored in pnl_snapshots table

## Data Source Integration

### Phase 1: Dune Analytics Bootstrap
- **Historical Backfill**: One-time import of historical PNL data
- **Wallet Discovery**: Identify profitable wallets from Dune queries
- **Data Mapping**: Transform Dune results to fit schema

### Phase 2: Chainstack Geyser RPC
- **Real-time Ingestion**: Yellowstone gRPC streaming
- **Subscription Filters**: Program IDs (Jupiter, Orca) and wallet addresses
- **Data Enrichment**: preTokenBalances and postTokenBalances analysis
- **Automatic Failover**: Multiple geographic regions for reliability

## Performance Optimization

### Indexing Strategy
- **Primary Keys**: All tables have optimized primary keys
- **Boolean Flags**: isFamousTrader and isLeaderboardUser indexed
- **Time-based Queries**: blockTime indexed for TimescaleDB partitioning
- **Composite Indexes**: (walletAddress, tokenMintAddress) for positions

### Caching Strategy
- **Token Metadata**: Cached in token_transfers to avoid external lookups
- **Leaderboard Results**: Pre-calculated in pnl_snapshots
- **Expiration Logic**: TTL-based cache invalidation

### Event-Driven Architecture
- **PostgreSQL Triggers**: NOTIFY on token_transfers INSERT
- **WebSocket Integration**: LISTEN for real-time updates
- **Decoupled Services**: Database as central event source

## Migration Strategy

### Development to Production
1. **Schema Evolution**: Prisma migrations for schema changes
2. **Data Validation**: Checksums and consistency checks
3. **Zero-Downtime Deployment**: Blue-green deployment strategy
4. **Rollback Procedures**: Automated rollback on validation failure

### Scaling Considerations
- **TimescaleDB**: Automatic time-based partitioning
- **Read Replicas**: Separate read/write workloads
- **Horizontal Scaling**: Microservices architecture support
- **Archive Strategy**: Historical data archival policies

## Security Considerations

### Data Privacy
- **Wallet Anonymization**: Optional anonymous tracking
- **Metadata Encryption**: Sensitive data encryption at rest
- **Access Control**: Role-based database access

### Data Integrity
- **Constraint Validation**: Foreign key constraints enforced
- **Audit Trails**: All changes logged with timestamps
- **Backup Strategy**: Point-in-time recovery capabilities

## API Endpoint Alignment

### Leaderboard Endpoints
- `GET /api/v1/leaderboard?period=7d` → pnl_snapshots query
- `GET /api/v1/leaderboard/volume?period=1d` → leaderboard_cache query

### Live Data Endpoints
- `WebSocket /live-trades` → token_transfers NOTIFY/LISTEN
- `GET /api/v1/wallets/{address}/positions` → positions query
- `GET /api/v1/gems` → gems_feed query

### Analytics Endpoints
- `GET /api/v1/analytics/pnl/{address}` → realized_pnl_events query
- `GET /api/v1/analytics/performance/{address}` → pnl_snapshots query

## Monitoring and Maintenance

### Database Health
- **Connection Monitoring**: Active connection tracking
- **Query Performance**: Slow query identification
- **Storage Monitoring**: Disk usage and growth tracking

### Data Quality
- **Consistency Checks**: Regular data validation jobs
- **Gap Detection**: Missing data identification
- **Anomaly Detection**: Unusual pattern identification

---

**Note**: This schema is designed to support the Alpha-Seeker platform's core mission of providing actionable trading intelligence through real-time data analysis and accurate PNL calculations. The architecture supports both the initial Dune Analytics bootstrap phase and the long-term Chainstack Geyser RPC integration for maximum performance and scalability. 