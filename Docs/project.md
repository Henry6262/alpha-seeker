# Alpha Seeker - Decoupled Architecture Implementation

## System Overview

Alpha Seeker now implements a **decoupled architecture** with two completely separate systems:

- **System A: Live Engine** - Real-time KOL wallet tracking
- **System B: Info Cache** - Dune Analytics data cache

This design provides **radical simplicity**, **total isolation**, and **maximum flexibility**.

## Architecture Components

### System A: Live Engine (Real-time KOL Tracking)

**Purpose**: Track a curated list of KOL wallets in real-time for high-value trading insights.

**Database Tables**:
- `kol_wallets` - Simple, manually-managed KOL wallet list
- `kol_transactions` - Transaction data only for KOL wallets
- `kol_positions` - Current holdings for KOL wallets
- `kol_pnl_snapshots` - Pre-calculated PNL aggregates for KOL leaderboards
- `kol_realized_pnl_events` - Trade closure events for KOL wallets
- `kol_token_transfers` - Token movement data for KOL wallets

**API Endpoints**:
- `GET /api/v1/leaderboard/kol` - Real-time KOL leaderboard
- `POST /api/v1/bootstrap/setup-kol-wallets` - Initialize KOL wallet list

**Workflow**:
1. Geyser service tracks wallets from `kol_wallets` table
2. Analytics engine processes transactions in real-time
3. PNL calculations update `kol_pnl_snapshots`
4. WebSocket broadcasts live updates to UI

### System B: Info Cache (Dune Analytics)

**Purpose**: Provide ecosystem-wide leaderboard data from Dune Analytics.

**Database Tables**:
- `dune_leaderboard_cache` - Simple, flat cache for Dune data

**API Endpoints**:
- `GET /api/v1/leaderboard/ecosystem` - Ecosystem leaderboard from Dune data
- `POST /api/v1/bootstrap/refresh-dune-cache` - Daily refresh job

**Workflow**:
1. Daily scheduled job runs
2. `TRUNCATE TABLE dune_leaderboard_cache` - Clear old data
3. Fetch fresh data from Dune API
4. `INSERT` new leaderboard data
5. API serves cached data instantly

## Key Benefits

### 1. **Radical Simplicity**
- Dead simple logic to write, understand, and maintain
- No complex joins between KOL and ecosystem data
- Clear separation of concerns

### 2. **Total Isolation**
- KOL system cannot interfere with ecosystem data
- Dune import failures don't affect real-time KOL tracking
- Independent scaling and optimization

### 3. **Optimized Performance**
- Live database stays lean and fast
- Only essential data for real-time features
- Pre-calculated aggregates for instant responses

### 4. **Maximum Flexibility**
- Can switch Dune to any provider without touching KOL system
- Easy to add new data sources
- Independent deployment and updates

## API Structure

```
/api/v1/
├── leaderboard/
│   ├── kol          # System A - Real-time KOL leaderboard
│   └── ecosystem    # System B - Dune Analytics ecosystem data
├── bootstrap/
│   ├── setup-kol-wallets     # Initialize KOL wallet list
│   └── refresh-dune-cache    # Daily Dune data refresh
└── status          # System health check
```

## Database Schema

### System A Tables (kol_*)
```sql
-- Simple KOL wallet management
CREATE TABLE kol_wallets (
    address VARCHAR(44) PRIMARY KEY,
    curated_name TEXT NOT NULL,
    twitter_handle TEXT,
    notes TEXT
);

-- Real-time KOL PNL snapshots
CREATE TABLE kol_pnl_snapshots (
    kol_address VARCHAR(44),
    period VARCHAR(10),
    snapshot_timestamp TIMESTAMPTZ,
    total_pnl_usd DECIMAL(20,8),
    realized_pnl_usd DECIMAL(20,8),
    unrealized_pnl_usd DECIMAL(20,8),
    roi_percentage DECIMAL(8,4),
    win_rate DECIMAL(5,2),
    total_trades INTEGER,
    total_volume_usd DECIMAL(20,8),
    PRIMARY KEY (kol_address, period, snapshot_timestamp)
);
```

### System B Tables (dune_*)
```sql
-- Simple Dune data cache
CREATE TABLE dune_leaderboard_cache (
    period VARCHAR(10),
    rank INTEGER,
    wallet_address VARCHAR(44),
    pnl_usd DECIMAL(20,8),
    win_rate DECIMAL(5,2),
    total_trades INTEGER,
    notable_wins JSONB,
    last_updated TIMESTAMPTZ,
    PRIMARY KEY (period, rank)
);
```

## Implementation Status

### ✅ Completed
- [x] New decoupled database schema design
- [x] PostgreSQL migration to new structure
- [x] Separate API endpoints for KOL and Ecosystem leaderboards
- [x] KOL wallet management system
- [x] Dune data refresh workflow
- [x] System status monitoring

### 🔄 In Progress
- [ ] Fix API server startup issues
- [ ] Test new endpoints with real data
- [ ] WebSocket integration for real-time updates
- [ ] Mobile app integration with new APIs

### 📋 Next Steps
1. Resolve API server startup issues
2. Test KOL wallet setup and data flow
3. Test Dune cache refresh workflow
4. Integrate with mobile app
5. Deploy to production

## Data Flow

### KOL Leaderboard Flow
```
KOL Wallets → Geyser Service → Analytics Engine → kol_pnl_snapshots → API → Mobile App
```

### Ecosystem Leaderboard Flow
```
Dune API → Daily Job → dune_leaderboard_cache → API → Mobile App
```

This decoupled architecture ensures that Alpha Seeker can provide both real-time KOL insights and comprehensive ecosystem data without any interference between the two systems. 