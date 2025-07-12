# Alpha-Seeker Implementation Plan

## Project Overview
Alpha-Seeker is a sophisticated Solana trading intelligence platform designed to provide users with a significant competitive edge through real-time insights into elite trader activities. The platform combines AI-driven analytics with curated human intelligence to deliver actionable trading alpha.

## Core Mission
**Provide traders with actionable intelligence by tracking and analyzing the activities of top-performing Solana traders in real-time.**

## Strategic Architecture: Two-Phase Approach

### Phase 1: Market Validation with Dune Analytics (Weeks 1-4)
**Objective**: Rapid feature deployment to test product-market fit

**Strategy**:
- Bootstrap historical leaderboard data using Dune Analytics
- Validate core value proposition with minimal infrastructure investment
- Gather crucial user feedback on core features

**Key Components**:
- Initial 1D, 7D, and 30D PNL leaderboards
- Basic wallet tracking and Twitter integration
- Foundation database schema

**Expected Outcome**: Proven demand for leaderboard features and clear business justification for Phase 2 investment

### Phase 2: Proprietary Moat with Chainstack Geyser (Weeks 5-8)
**Objective**: Build competitive advantage through proprietary data pipeline

**Strategy**:
- Deploy Chainstack Yellowstone gRPC Geyser for real-time data
- Implement live features (trades feed, gems discovery)
- Transition to independent data pipeline

**Key Components**:
- Real-time data ingestion service
- Live trades feed with WebSocket connections
- "Gems" discovery algorithm
- Advanced PNL calculation engine

**Expected Outcome**: Market-leading performance and unique competitive moat

## Feature Implementation Blueprint

### 1. Leaderboard System
**Primary Feature**: Multi-timeframe PNL leaderboards

**Implementation**:
- **Data Source**: Phase 1 (Dune) → Phase 2 (Geyser)
- **Backend**: Pre-calculated `pnl_snapshots` table for sub-second queries
- **Frontend**: Filterable timeframes with real-time updates
- **API**: `GET /api/v1/leaderboard?period=7d`

**Technical Details**:
```sql
-- Leaderboard Query (optimized for performance)
SELECT
    w.address,
    w.curatedName,
    w.twitterHandle,
    p.realizedPnlUsd,
    p.roiPercentage,
    p.winRate,
    p.totalTrades
FROM pnl_snapshots p
JOIN wallets w ON p.walletAddress = w.address
WHERE p.period = '7D'
  AND p.snapshotTimestamp = (SELECT MAX(snapshotTimestamp) FROM pnl_snapshots WHERE period = '7D')
ORDER BY p.realizedPnlUsd DESC
LIMIT 100;
```

### 2. Live Trades Feed
**Primary Feature**: Real-time feed of elite trader activities

**Implementation**:
- **Data Source**: Chainstack Geyser RPC streaming
- **Backend**: PostgreSQL NOTIFY/LISTEN for event-driven architecture
- **Frontend**: WebSocket connection for real-time updates
- **API**: `WebSocket /live-trades`

**Technical Details**:
```javascript
// PostgreSQL Trigger for Real-time Notifications
CREATE OR REPLACE FUNCTION notify_new_trade()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_trades', NEW.transactionSignature);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER new_trade_trigger
    AFTER INSERT ON token_transfers
    FOR EACH ROW EXECUTE FUNCTION notify_new_trade();
```

### 3. "Gems" Discovery System
**Primary Feature**: AI-powered identification of emerging opportunities

**Implementation**:
- **Algorithm**: Multi-signal detection based on famous trader activity
- **Data Source**: Real-time `token_transfers` analysis
- **Backend**: Automated gem discovery service
- **Frontend**: Curated gems feed with confidence scores

**Technical Details**:
```sql
-- Gem Discovery Query
SELECT
    t.tokenMintAddress,
    COUNT(DISTINCT t.walletAddress) AS numAlphaBuyers,
    ARRAY_AGG(DISTINCT w.curatedName) AS buyerNames
FROM token_transfers t
JOIN wallets w ON t.walletAddress = w.address
WHERE t.blockTime > NOW() - INTERVAL '30 minutes'
  AND w.isFamousTrader = TRUE
  AND t.amountChangeRaw > 0
  AND t.tokenMintAddress NOT IN (SELECT address FROM excluded_tokens)
GROUP BY t.tokenMintAddress
HAVING COUNT(DISTINCT t.walletAddress) >= 3
ORDER BY numAlphaBuyers DESC, MAX(t.blockTime) DESC;
```

### 4. Token Holdings Bubble Chart
**Primary Feature**: Visual portfolio composition analysis

**Implementation**:
- **Data Source**: Real-time `positions` table
- **Backend**: Portfolio aggregation service
- **Frontend**: Interactive bubble chart visualization
- **API**: `GET /api/v1/wallets/{address}/positions`

## PNL Calculation Engine

### Weighted Average Cost (WAC) Methodology
**Foundation**: All PNL calculations use WAC for accurate cost basis

**Formula**:
```
WAC_per_token = Total_Cost_of_Acquisition_USD / Total_Quantity_of_Token_Held
```

### Real-time PNL Calculation Algorithm
1. **Transaction Detection**: Geyser stream identifies swap transactions
2. **Balance Analysis**: Compare preTokenBalances vs postTokenBalances
3. **Trade Value Determination**:
   - Stablecoin trades: Use par value
   - Non-stablecoin: Query price oracle (Pyth/Birdeye)
4. **Position Updates**: Update `positions` table with new cost basis
5. **PNL Calculation**: Calculate realized PNL on position closure
6. **Event Recording**: Store in `realized_pnl_events` table

### Live Leaderboard Updates
**Capability**: Real-time leaderboard updates based on closed positions

**Implementation**:
- **Trigger**: Position closure detection
- **Calculation**: Immediate PNL calculation and recording
- **Aggregation**: Background job updates `pnl_snapshots` every 15 minutes
- **Notification**: WebSocket broadcast to connected clients

## Data Acquisition Strategy

### Wallet Discovery Sources
1. **Dune Analytics**: Initial seeding with historically profitable wallets
2. **Curated Lists**: Manual famous trader wallet additions
3. **Dynamic Discovery**: Algorithm-based identification of profitable wallets
4. **Community Submissions**: User-submitted wallet tracking (future)

### Data Pipeline Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Dune Analytics │    │ Chainstack      │    │   Database      │
│  (Historical)   │────│ Geyser RPC      │────│  (PostgreSQL)   │
│                 │    │ (Real-time)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Initial Backfill│    │ Live Ingestion  │    │ Event-Driven    │
│ Service         │    │ Service         │    │ Architecture    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Technical Implementation Details

### Database Schema Compliance
**Mandatory Protocol**: All development must reference `Docs/Database_Schema.md`

**Key Requirements**:
- Use optimized schema for high-performance queries
- Implement TimescaleDB for time-series data
- Maintain data source agnostic design
- Follow event-driven architecture patterns

### Geyser RPC Integration
**Technology**: Chainstack Yellowstone gRPC

**Configuration**:
```javascript
// Geyser Subscription Configuration
const subscriptionRequest = {
  slots: {},
  accounts: {},
  transactions: {
    accountInclude: trackedWalletAddresses,
    accountExclude: [],
    accountRequired: true,
    vote: false,
    failed: false
  },
  entry: {},
  blocks: {},
  blocksMeta: {},
  transactionStatus: {},
  accountDataSlice: []
};
```

**Benefits**:
- Sub-second latency for transaction data
- Structured, typed data objects
- Server-side filtering for efficiency
- Automatic failover capabilities

### Resilient "Agentic" Architecture
**Design Principle**: Autonomous, intelligent, and self-healing systems

**Key Components**:
1. **Health Monitoring**: Continuous system health checks
2. **Connection Management**: Automatic reconnection with exponential backoff
3. **Error Handling**: Intelligent error response and recovery
4. **Multi-Region Deployment**: Geographic redundancy for reliability

## Sprint-Based Development Plan

### Sprint 1: Foundation & Data Pipelines (Weeks 1-4)
**Status**: 90% Complete - **IMMEDIATE PRIORITY: Dune Integration**

**Completed** ✅:
- [x] Database schema design and implementation
- [x] Prisma ORM setup and migrations
- [x] **Phase 1 Bootstrap API endpoints** - `/api/v1/bootstrap/*`
- [x] **Curated traders system** - Famous trader wallet management
- [x] Basic leaderboard backend API
- [x] Comprehensive documentation
- [x] **Real Dune service implementation** - Ready for API key

**IMMEDIATE PRIORITY** 🚨:
- [ ] **Phase 1.4: Dune Analytics Integration** - Historical data bootstrap
  - **GET DUNE API KEY** - Required for production queries
  - **Execute wallet discovery** - `POST /api/v1/bootstrap/discover-wallets`
  - **Import historical PNL** - `POST /api/v1/bootstrap/historical-pnl`
  - **Complete Phase 1** - `POST /api/v1/bootstrap/phase1`

**Remaining**:
- [ ] **Phase 1.5**: Real-time data pipeline with Geyser RPC
- [ ] **Phase 1.6**: Live leaderboard updates

### Current Platform Status
**Database State** (as of latest check):
- ✅ **Wallets**: 3 curated famous traders added
- ❌ **PNL Snapshots 7D**: 0 entries - **NEEDS DUNE DATA**
- ❌ **PNL Snapshots 30D**: 0 entries - **NEEDS DUNE DATA**
- ❌ **Phase 1 Complete**: false - **WAITING FOR DUNE**

**Available Endpoints**:
- `GET /api/v1/bootstrap/status` - Check current bootstrap state
- `POST /api/v1/bootstrap/phase1` - Complete Phase 1 bootstrap ⚠️ *Requires Dune API key*
- `POST /api/v1/bootstrap/discover-wallets` - Discover profitable wallets ⚠️ *Requires Dune API key*
- `POST /api/v1/bootstrap/historical-pnl` - Import historical PNL ⚠️ *Requires Dune API key*
- `POST /api/v1/bootstrap/curated-traders` - Add famous traders ✅ *Working*

### Why Dune Integration is Critical Priority

**Business Justification**:
1. **Immediate Value**: Leaderboards with real historical data validate product-market fit
2. **Wallet Discovery**: Find 50+ profitable wallets to track (currently only 3 curated)
3. **Historical Context**: 7D and 30D PNL data provides baseline for growth
4. **Market Validation**: Real trader performance data proves platform value

**Technical Benefits**:
1. **Data Independence**: Phase 1 completes our data acquisition strategy
2. **User Engagement**: Real leaderboards drive immediate user interest
3. **Foundation**: Historical data provides context for Phase 2 real-time features
4. **Competitive Advantage**: First-mover advantage with comprehensive Solana trader data

### Dune Implementation Requirements

**1. Dune API Setup**:
```bash
# Set environment variable
export DUNE_API_KEY="your-dune-api-key-here"

# Or add to .env file
echo "DUNE_API_KEY=your-dune-api-key-here" >> apps/api/.env
```

**2. Dune Query Requirements**:
The system expects these Dune queries to exist (IDs can be updated in `dune.service.ts`):
- **PROFITABLE_TRADERS_7D**: Query ID 3875234 - Top profitable traders last 7 days
- **PROFITABLE_TRADERS_30D**: Query ID 3875235 - Top profitable traders last 30 days
- **WALLET_DISCOVERY**: Query ID 3875238 - Discover new profitable wallets

**3. Expected Query Results**:
```typescript
// Wallet Discovery Query Result
interface DuneWalletMetadata {
  wallet_address: string
  curated_name?: string
  twitter_handle?: string
  is_famous_trader: boolean
  total_pnl_7d: number
  total_pnl_30d: number
}

// PNL Data Query Result
interface DuneTraderData {
  wallet_address: string
  realized_pnl_usd: number
  total_trades: number
  win_rate: number
  total_volume_usd: number
  first_seen: string
  last_seen: string
}
```

### Next Steps After Dune Integration

**Phase 1 Completion Checklist**:
1. ✅ Get Dune API key
2. ✅ Execute wallet discovery → Expect 20-50 profitable wallets
3. ✅ Import historical PNL → Populate 7D and 30D leaderboards
4. ✅ Verify bootstrap status → `isBootstrapped: true`
5. ✅ Test leaderboard API → Real data in `/api/v1/leaderboard`

**Phase 2 Prerequisites**:
- **Historical Baseline**: 7D and 30D PNL snapshots for comparison
- **Tracked Wallets**: 50+ wallets for meaningful real-time analysis
- **Leaderboard Validation**: Proven engagement with historical data
- **Data Pipeline**: Smooth transition to Geyser RPC integration

### Action Items

**Immediate (Today)**:
1. **Obtain Dune Analytics API key**
2. **Set up Dune queries** for Solana trader PNL analysis
3. **Execute Phase 1 bootstrap**: `curl -X POST http://localhost:3000/api/v1/bootstrap/phase1`
4. **Verify results**: Check `/api/v1/bootstrap/status` for completion

**Short-term (This Week)**:
1. **Validate leaderboard data** - Ensure realistic PNL figures
2. **Test with users** - Get feedback on historical data quality
3. **Begin Phase 2 planning** - Chainstack Geyser RPC integration
4. **Mobile app updates** - Connect to real leaderboard API

**Medium-term (Next Sprint)**:
1. **Chainstack integration** - Real-time data pipeline
2. **Live features** - Trades feed and gems discovery
3. **Performance optimization** - Sub-second query response
4. **User feedback integration** - Platform improvements based on usage

---

**Note**: Phase 1 Dune integration is the critical blocker for platform launch. All subsequent features depend on having real historical data and a substantial number of tracked wallets. This should be the absolute priority before any other development work.

## Architecture Decisions

### Technology Stack
- **Frontend**: React Native + Expo Router + Tamagui
- **Backend**: Node.js + Fastify + Supabase
- **Database**: PostgreSQL + TimescaleDB
- **Real-time Data**: Chainstack Yellowstone gRPC Geyser
- **Historical Data**: Dune Analytics API
- **State Management**: Zustand
- **Payments**: Solana Pay SDK
- **Notifications**: Firebase Cloud Messaging

### Performance Optimization
- **Caching**: Pre-calculated aggregates in `pnl_snapshots`
- **Indexing**: Optimized database indexes for query performance
- **Event-Driven**: PostgreSQL NOTIFY/LISTEN for real-time updates
- **Load Balancing**: Multi-region deployment with failover

### Security & Reliability
- **Data Integrity**: Foreign key constraints and validation
- **Backup Strategy**: Point-in-time recovery capabilities
- **Monitoring**: Comprehensive health checks and alerting
- **Scaling**: Horizontal scaling with microservices architecture

## Success Metrics

### Phase 1 Success Criteria
- [ ] Functional leaderboard with 1D, 7D, 30D timeframes
- [ ] 50+ tracked wallets with historical PNL data
- [ ] Sub-second leaderboard query response times
- [ ] User engagement metrics and feedback validation

### Phase 2 Success Criteria
- [ ] Real-time trades feed with <1 second latency
- [ ] "Gems" discovery with 80%+ accuracy
- [ ] Live leaderboard updates within 15 minutes
- [ ] 10,000+ tracked transactions per day

### Platform Success Metrics
- [ ] 1,000+ active users within 30 days
- [ ] 90%+ uptime with real-time features
- [ ] Positive user feedback on alpha signal quality
- [ ] Solana Mobile Hackathon victory

## Risk Mitigation

### Technical Risks
- **Geyser Reliability**: Multi-region deployment with failover
- **Data Accuracy**: Multiple price oracle sources with validation
- **Performance**: Optimized queries and caching strategies
- **Scalability**: Microservices architecture for horizontal scaling

### Business Risks
- **Market Validation**: Phase 1 validation before Phase 2 investment
- **Competition**: Unique data pipeline creates competitive moat
- **Regulation**: Focus on public on-chain data and transparency

## Development Environment Standards

### Mandatory Pre-Development Checks
1. **Documentation Review**: Always consult `Docs/Database_Schema.md`
2. **Architecture Compliance**: Verify alignment with master plan
3. **Technology Stack**: Use approved stack components only
4. **Testing Strategy**: Implement comprehensive testing protocols

### Quality Assurance
- **Code Review**: All PRs require architectural review
- **Performance Testing**: Load testing for high-traffic scenarios
- **Security Audit**: Regular security reviews and penetration testing
- **Documentation**: Continuous documentation updates

## Future Roadmap

### Post-Launch Features
- **AI-Powered Insights**: Advanced pattern recognition
- **Social Features**: Community-driven wallet discovery
- **Advanced Analytics**: Risk metrics and portfolio optimization
- **Mobile Optimization**: Enhanced mobile experience

### Scaling Considerations
- **Enterprise Features**: White-label solutions for institutions
- **Multi-Chain Support**: Expansion to other blockchains
- **API Monetization**: Premium API access for developers
- **Advanced Subscriptions**: Tiered feature access

---

**Note**: This implementation plan serves as the definitive guide for Alpha-Seeker development. All development activities must align with this master plan to ensure cohesive execution and maximum impact in the Solana Mobile Hackathon competition. 