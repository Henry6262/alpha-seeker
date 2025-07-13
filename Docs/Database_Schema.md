# Alpha-Seeker Database Schema Documentation

## Overview
This document defines the complete database schema for the Alpha-Seeker Solana trading intelligence platform. The schema is designed around **PostgreSQL with TimescaleDB extension** for superior time-series performance and implements a mature data warehousing pattern of **separating raw event data from aggregated state**.

**Current Implementation Status:**
- **Database**: PostgreSQL + TimescaleDB extension
- **Architecture**: Raw event data (normalized) + Aggregated state (denormalized performance caches)
- **Data Source**: Dune Analytics (implemented) + Chainstack Geyser (planned)
- **Tables**: Core relational model + Time-series optimized tables

## Architectural Principles

### Core Design Philosophy: Separation of Concerns
This architecture embodies the principle of **separating raw event data from aggregated state and analytical results**. This is a mature pattern borrowed from data warehousing that ensures:

1. **Data Integrity for Writes**: Normalized core tables serve as the system of record
2. **Performance for Reads**: Denormalized summary tables act as performance-enhancing caches
3. **Scalability**: Time-series optimization for blockchain transaction data
4. **Resilience**: Raw data preservation with computed aggregates

### Database Technology Stack
- **PostgreSQL**: Primary relational database for ACID compliance and complex queries
- **TimescaleDB Extension**: Superior handling of time-series data (blockchain transactions)
- **Hybrid Architecture**: Normalized core + Denormalized performance layers

### Data Flow Strategy
```
Raw Blockchain Data → Normalized Tables (System of Record) → Aggregated Tables (Performance Cache) → API Layer
```

## Core Schema Design

The following tables form the **relational core** of the Alpha-Seeker data model, implementing the normalized "system of record" layer.

### 1. wallets (Master Directory) ✅ IMPLEMENTED
**Purpose**: Central repository for every user account tracked by the platform, linking on-chain addresses to off-chain metadata and feature-specific flags.

**Schema**:
```sql
CREATE TABLE wallets (
    address VARCHAR(44) PRIMARY KEY,                    -- Base-58 encoded wallet public key
    curated_name TEXT,                                  -- Human-readable alias (e.g., "Ansem", "Cobie")  
    twitter_handle TEXT,                                -- Associated Twitter username
    is_famous_trader BOOLEAN DEFAULT FALSE,             -- Critical flag for "Gems" discovery feature
    is_leaderboard_user BOOLEAN DEFAULT TRUE,           -- Include/exclude from PNL calculations
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),            -- First indexed transaction timestamp
    metadata_json JSONB,                                -- Flexible unstructured data storage
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes on boolean flags for analytical queries
CREATE INDEX idx_wallets_famous_trader ON wallets(is_famous_trader) WHERE is_famous_trader = TRUE;
CREATE INDEX idx_wallets_leaderboard_user ON wallets(is_leaderboard_user) WHERE is_leaderboard_user = TRUE;
CREATE INDEX idx_wallets_first_seen ON wallets(first_seen_at);
```

**Key Features**:
- **Direct Address Primary Key**: No surrogate keys, address is the natural identifier
- **Snake_Case Naming**: Consistent with PostgreSQL conventions
- **Specific Data Types**: VARCHAR(44) for Solana addresses, TEXT for variable content, JSONB for metadata
- **Indexed Boolean Flags**: Optimized for "Gems" discovery and leaderboard filtering
- **Flexible Metadata**: JSONB field for future extensibility without schema changes

### 2. tokens (Token Registry) ✅ REQUIRED
**Purpose**: Master registry of all tokens encountered in the system with cached metadata.

**Schema**:
```sql
CREATE TABLE tokens (
    mint_address VARCHAR(44) PRIMARY KEY,               -- Token mint address
    symbol TEXT,                                        -- Token symbol (e.g., "BONK", "SOL")
    name TEXT,                                          -- Full token name
    decimals INTEGER,                                   -- Token decimal places
    logo_uri TEXT,                                      -- Token logo URL
    coingecko_id TEXT,                                  -- CoinGecko identifier for price data
    is_meme_token BOOLEAN DEFAULT FALSE,                -- Meme token classification
    is_verified BOOLEAN DEFAULT FALSE,                  -- Verified token status
    launch_date TIMESTAMPTZ,                            -- Token launch timestamp
    metadata_json JSONB,                                -- Additional token metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_tokens_is_meme ON tokens(is_meme_token) WHERE is_meme_token = TRUE;
CREATE INDEX idx_tokens_launch_date ON tokens(launch_date);
```

## Time-Series Tables (TimescaleDB Hypertables)

These tables leverage TimescaleDB's time-series optimizations for high-performance blockchain data ingestion and querying.

### 3. transactions (TimescaleDB Hypertable) ✅ IMPLEMENTED
**Purpose**: Immutable chronological log of all relevant blockchain transactions.

**Schema**:
```sql
-- Create the transactions table
CREATE TABLE transactions (
    signature VARCHAR(88) PRIMARY KEY,                  -- Base-58 transaction signature (unique identifier)
    block_time TIMESTAMPTZ NOT NULL,                    -- Confirmed timestamp (primary time dimension)
    slot BIGINT NOT NULL,                               -- Block slot number
    signer_address VARCHAR(44) NOT NULL,                -- Primary fee-paying account
    fee_lamports BIGINT NOT NULL,                       -- Transaction fee in lamports
    was_successful BOOLEAN DEFAULT TRUE,                -- Transaction success status
    program_ids TEXT[],                                 -- Array of program IDs involved
    compute_units BIGINT,                               -- Compute units consumed
    metadata_json JSONB,                                -- Additional transaction data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key to wallets
    CONSTRAINT fk_transactions_signer FOREIGN KEY (signer_address) REFERENCES wallets(address)
);

-- Convert to TimescaleDB hypertable (partitioned by block_time)
SELECT create_hypertable('transactions', 'block_time', chunk_time_interval => INTERVAL '1 day');

-- Optimized indexes for time-series queries
CREATE INDEX idx_transactions_block_time ON transactions(block_time DESC);
CREATE INDEX idx_transactions_signer ON transactions(signer_address, block_time DESC);
CREATE INDEX idx_transactions_slot ON transactions(slot);
```

**Key Features**:
- **TimescaleDB Hypertable**: Automatic time-based partitioning for performance
- **Transaction Signature PK**: Natural blockchain identifier
- **Time Optimization**: Primary queries by block_time with descending index
- **Program Tracking**: Array field for multi-program transaction analysis

### 4. token_transfers (TimescaleDB Hypertable) ✅ CRITICAL
**Purpose**: Granular record of every token balance change within transactions - the foundation for all PNL calculations.

**Schema**:
```sql
CREATE TABLE token_transfers (
    id BIGSERIAL,                                       -- Synthetic PK for performance
    transaction_signature VARCHAR(88) NOT NULL,         -- Parent transaction reference
    block_time TIMESTAMPTZ NOT NULL,                    -- Time dimension (copied for performance)
    wallet_address VARCHAR(44) NOT NULL,                -- Affected wallet
    token_mint_address VARCHAR(44) NOT NULL,            -- Token being transferred
    amount_change_raw BIGINT NOT NULL,                  -- Raw amount change (+ receive, - send)
    pre_balance_raw BIGINT NOT NULL,                    -- Balance before transaction
    post_balance_raw BIGINT NOT NULL,                   -- Balance after transaction
    usd_value_at_time NUMERIC(20,8),                   -- USD value at transaction time
    instruction_index INTEGER,                          -- Position within transaction
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_token_transfers_transaction FOREIGN KEY (transaction_signature) REFERENCES transactions(signature),
    CONSTRAINT fk_token_transfers_wallet FOREIGN KEY (wallet_address) REFERENCES wallets(address),
    CONSTRAINT fk_token_transfers_token FOREIGN KEY (token_mint_address) REFERENCES tokens(mint_address),
    
    PRIMARY KEY (id, block_time)  -- Composite PK for TimescaleDB
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('token_transfers', 'block_time', chunk_time_interval => INTERVAL '1 day');

-- Critical indexes for PNL calculations
CREATE INDEX idx_token_transfers_wallet_time ON token_transfers(wallet_address, block_time DESC);
CREATE INDEX idx_token_transfers_token_time ON token_transfers(token_mint_address, block_time DESC);
CREATE INDEX idx_token_transfers_wallet_token ON token_transfers(wallet_address, token_mint_address, block_time DESC);
```

**Key Features**:
- **Atomic Trade Representation**: Each swap = multiple rows (one per token)
- **Self-Contained**: Pre/post balances eliminate need for external state reconstruction
- **USD Value Capture**: Historical pricing data for accurate PNL calculations
- **Triple Indexing**: Optimized for wallet, token, and combined queries

## Aggregated State Tables (Performance Layer)

These denormalized tables serve as **performance-enhancing caches** computed from the raw event data.

### 5. positions (Current Holdings) ✅ IMPLEMENTED
**Purpose**: Real-time snapshot of current wallet holdings with cost basis for PNL calculations.

**Schema**:
```sql
CREATE TABLE positions (
    wallet_address VARCHAR(44),
    token_mint_address VARCHAR(44),
    current_balance_raw BIGINT NOT NULL,                -- Current token quantity
    total_cost_basis_usd NUMERIC(20,8) NOT NULL,       -- Total USD invested
    weighted_avg_cost_usd NUMERIC(20,8) NOT NULL,      -- Average cost per token
    unrealized_pnl_usd NUMERIC(20,8),                  -- Current unrealized P&L
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (wallet_address, token_mint_address),
    CONSTRAINT fk_positions_wallet FOREIGN KEY (wallet_address) REFERENCES wallets(address),
    CONSTRAINT fk_positions_token FOREIGN KEY (token_mint_address) REFERENCES tokens(mint_address)
);

CREATE INDEX idx_positions_wallet ON positions(wallet_address);
CREATE INDEX idx_positions_token ON positions(token_mint_address);
CREATE INDEX idx_positions_updated ON positions(last_updated_at);
```

### 6. pnl_snapshots (Leaderboard Performance Cache) ✅ IMPLEMENTED
**Purpose**: Pre-calculated PNL aggregates for sub-second leaderboard queries.

**Schema**:
```sql
CREATE TABLE pnl_snapshots (
    wallet_address VARCHAR(44),
    period VARCHAR(10),                                 -- '1H', '1D', '7D', '30D'
    ecosystem VARCHAR(20),                              -- 'all', 'pump.fun', 'letsbonk.fun'
    snapshot_timestamp TIMESTAMPTZ DEFAULT NOW(),
    realized_pnl_usd NUMERIC(20,8) NOT NULL,           -- Total realized P&L
    unrealized_pnl_usd NUMERIC(20,8),                  -- Current unrealized P&L
    total_pnl_usd NUMERIC(20,8) NOT NULL,              -- Combined P&L
    roi_percentage NUMERIC(8,4),                       -- Return on Investment
    win_rate NUMERIC(5,2),                             -- Percentage of profitable trades
    total_trades INTEGER NOT NULL,                     -- Number of trades in period
    total_volume_usd NUMERIC(20,8),                    -- Total trading volume
    data_source VARCHAR(20) DEFAULT 'dune',            -- 'dune' or 'geyser'
    source_metadata JSONB,                             -- Source-specific metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (wallet_address, period, ecosystem, snapshot_timestamp),
    CONSTRAINT fk_pnl_snapshots_wallet FOREIGN KEY (wallet_address) REFERENCES wallets(address)
);

-- Optimized for leaderboard queries
CREATE INDEX idx_pnl_snapshots_leaderboard ON pnl_snapshots(period, ecosystem, total_pnl_usd DESC, snapshot_timestamp DESC);
CREATE INDEX idx_pnl_snapshots_volume ON pnl_snapshots(period, ecosystem, total_volume_usd DESC, snapshot_timestamp DESC);
```

### 7. leaderboard_cache (API Performance Layer) ✅ IMPLEMENTED
**Purpose**: Pre-ranked leaderboard results for instant API responses.

**Schema**:
```sql
CREATE TABLE leaderboard_cache (
    leaderboard_type VARCHAR(20),                       -- 'pnl', 'volume'
    timeframe VARCHAR(10),                              -- '1h', '1d', '7d', '30d'
    ecosystem VARCHAR(20),                              -- 'all', 'pump.fun', 'letsbonk.fun'
    rank INTEGER,
    wallet_address VARCHAR(44),
    metric NUMERIC(20,8),                              -- PNL or Volume value
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    PRIMARY KEY (leaderboard_type, timeframe, ecosystem, rank),
    CONSTRAINT fk_leaderboard_cache_wallet FOREIGN KEY (wallet_address) REFERENCES wallets(address)
);

CREATE INDEX idx_leaderboard_cache_expires ON leaderboard_cache(expires_at);
```

## Supporting Tables

### 8. gems_feed (Discovery Algorithm Results) ✅ PLANNED
**Purpose**: Algorithmic discovery of tokens being accumulated by famous traders.

**Schema**:
```sql
CREATE TABLE gems_feed (
    token_mint_address VARCHAR(44),
    discovery_timestamp TIMESTAMPTZ DEFAULT NOW(),
    num_famous_buyers INTEGER NOT NULL,                -- Count of famous traders buying
    famous_buyer_addresses TEXT[],                     -- Array of buyer addresses
    total_famous_volume_usd NUMERIC(20,8),             -- Combined volume from famous traders
    confidence_score NUMERIC(3,2),                     -- Algorithm confidence (0.00-1.00)
    market_cap_at_discovery NUMERIC(20,8),             -- Market cap when discovered
    is_active BOOLEAN DEFAULT TRUE,
    metadata_json JSONB,
    
    PRIMARY KEY (token_mint_address, discovery_timestamp),
    CONSTRAINT fk_gems_feed_token FOREIGN KEY (token_mint_address) REFERENCES tokens(mint_address)
);

CREATE INDEX idx_gems_feed_active ON gems_feed(is_active, confidence_score DESC, discovery_timestamp DESC);
```

### 9. realized_pnl_events (Audit Trail) ✅ PLANNED
**Purpose**: Detailed record of every position closure for audit and analysis.

**Schema**:
```sql
CREATE TABLE realized_pnl_events (
    id BIGSERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL,
    token_mint_address VARCHAR(44) NOT NULL,
    closing_transaction_signature VARCHAR(88) NOT NULL,
    quantity_sold BIGINT NOT NULL,                     -- Amount sold in raw units
    sale_value_usd NUMERIC(20,8) NOT NULL,             -- USD value of sale
    cost_basis_usd NUMERIC(20,8) NOT NULL,             -- Original cost basis
    realized_pnl_usd NUMERIC(20,8) NOT NULL,           -- Calculated P&L
    hold_duration_seconds INTEGER,                     -- Time held in seconds
    roi_percentage NUMERIC(8,4),                       -- ROI for this specific trade
    closed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_realized_pnl_wallet FOREIGN KEY (wallet_address) REFERENCES wallets(address),
    CONSTRAINT fk_realized_pnl_token FOREIGN KEY (token_mint_address) REFERENCES tokens(mint_address)
);

CREATE INDEX idx_realized_pnl_wallet_time ON realized_pnl_events(wallet_address, closed_at DESC);
CREATE INDEX idx_realized_pnl_token_time ON realized_pnl_events(token_mint_address, closed_at DESC);
```

## PNL Calculation Engine

### Weighted Average Cost (WAC) Methodology
The system uses WAC for cost basis calculation:

```sql
-- WAC calculation for position updates
UPDATE positions 
SET 
    weighted_avg_cost_usd = total_cost_basis_usd / NULLIF(current_balance_raw, 0),
    unrealized_pnl_usd = (current_balance_raw * current_market_price) - total_cost_basis_usd
WHERE wallet_address = $1 AND token_mint_address = $2;
```

### Real-time PNL Calculation Algorithm
1. **Transaction Detection**: TimescaleDB trigger on token_transfers
2. **Position Update**: Recalculate weighted average cost
3. **Realized PNL**: Calculate on position reduction/closure
4. **Event Recording**: Store in realized_pnl_events
5. **Aggregate Update**: Update pnl_snapshots via background job

## TimescaleDB Optimization Features

### Automatic Data Lifecycle Management
```sql
-- Compress old data for storage efficiency
SELECT add_compression_policy('transactions', INTERVAL '7 days');
SELECT add_compression_policy('token_transfers', INTERVAL '3 days');

-- Archive very old data
SELECT add_retention_policy('transactions', INTERVAL '2 years');
SELECT add_retention_policy('token_transfers', INTERVAL '1 year');
```

### Continuous Aggregates for Performance
```sql
-- Pre-computed hourly aggregates
CREATE MATERIALIZED VIEW hourly_wallet_pnl
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', block_time) AS hour,
    wallet_address,
    SUM(CASE WHEN amount_change_raw > 0 THEN usd_value_at_time ELSE 0 END) AS inflow_usd,
    SUM(CASE WHEN amount_change_raw < 0 THEN usd_value_at_time ELSE 0 END) AS outflow_usd
FROM token_transfers
GROUP BY hour, wallet_address;
```

## Data Source Integration Architecture

### Phase 1: Dune Analytics (✅ IMPLEMENTED)
- **Historical Backfill**: Populate pnl_snapshots with Dune query results
- **Wallet Discovery**: Identify profitable wallets from historical data
- **Bootstrap Process**: One-time data import to establish baseline

### Phase 2: Chainstack Geyser (🔄 PLANNED)
- **Real-time Ingestion**: Direct blockchain transaction streaming
- **Incremental Updates**: Update positions and calculate PNL in real-time
- **Redundant Architecture**: Multi-region failover for reliability

## API Endpoint Alignment

### Current Implementation ✅
- `GET /api/v1/leaderboard` → leaderboard_cache query
- `GET /api/v1/leaderboard/wallet/:address` → positions + pnl_snapshots
- `POST /api/v1/bootstrap/*` → Data ingestion endpoints

### Planned Real-time Endpoints 🔄
- `WebSocket /live-trades` → token_transfers real-time stream
- `GET /api/v1/gems` → gems_feed active discoveries
- `GET /api/v1/wallets/:address/positions` → positions current state

## Performance Characteristics

### Read Performance
- **Leaderboard Queries**: Sub-100ms via leaderboard_cache
- **Wallet Profiles**: < 200ms via indexed position lookups
- **Historical Analysis**: Optimized via TimescaleDB compression

### Write Performance
- **Transaction Ingestion**: 10K+ TPS via TimescaleDB hypertables
- **Position Updates**: Batch processing for efficiency
- **Aggregate Refresh**: Background jobs with minimal lock contention

This schema design provides the foundation for a scalable, high-performance trading intelligence platform that can grow from thousands to millions of tracked wallets while maintaining sub-second query performance. 