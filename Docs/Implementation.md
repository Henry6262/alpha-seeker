# Alpha Seeker: The Official AI-Driven Implementation Plan

**Source PRD:** Docs/project.md  
**Methodology:** Context-Driven Development (CDD) with an AI Agent  
**Timeline:** 20 Days

## ✅ Major Milestone Completed
**Date:** 2025-07-12  
**Achievement:** Successfully transitioned from single-app to monorepo structure
- ✅ Complete monorepo restructure with apps/ and packages/ directories
- ✅ Functional API server with Fastify + Prisma + SQLite
- ✅ Working mobile app with React Native + Expo + React Navigation
- ✅ React Navigation compatibility issues resolved
- ✅ All changes committed and pushed to main branch
- ✅ Old main branch safely backed up to `backup/old-main-structure`

**Current Development Status:**
- API Server: ✅ Running on port 3000 with leaderboard data
- Mobile App: ✅ Running on port 8081 with QR code ready for testing
- Git Repository: ✅ Clean main branch with monorepo structure

## Feature Analysis

### Core Features (Extracted from PRD):
1. **Leaderboards System** - Rank top-performing wallets by PNL and volume
2. **Live User Trades Feed** - Real-time trades from top 100 wallets  
3. **"Gems" Scan** - Token discovery based on top trader holdings
4. **User Trading Profile & History** - Detailed performance analysis
5. **Tiered Subscriptions & Notifications** - The killer feature with Solana Pay

### Feature Prioritization:
- **Must-Have (MVP):** Leaderboards, Live Feed, Basic Gems Scan, Solana Pay Subscriptions
- **Should-Have:** Advanced filtering, Push notifications, User profiles
- **Nice-to-Have:** Social features, Advanced analytics

## Recommended Tech Stack

### Frontend:
- **Framework:** React Native + Expo Router - Mobile-first with file-based routing
- **Documentation:** https://docs.solanamobile.com/react-native/quickstart
- **UI Library:** React Native Paper - Material Design components for React Native
- **Documentation:** https://callstack.github.io/react-native-paper/

### Backend:
- **Framework:** Node.js + Fastify - High-performance, low overhead
- **Documentation:** https://www.fastify.io/docs/latest/
- **Database:** Supabase (Managed PostgreSQL) - Backend-as-a-service for rapid development
- **Documentation:** https://supabase.com/docs

### Real-Time Data:
- **Streaming:** Chainstack Yellowstone gRPC Geyser
- **Documentation:** https://chainstack.com/real-time-solana-data-websocket-vs-yellowstone-grpc-geyser/

### Historical Data:
- **Analytics:** Dune Analytics API
- **Documentation:** https://docs.dune.com/api-reference/overview/introduction

### Payments & Notifications:
- **Payments:** Solana Pay SDK
- **Documentation:** https://docs.solanapay.com/
- **Notifications:** Firebase Cloud Messaging
- **Documentation:** https://firebase.google.com/docs/cloud-messaging

## Sprint Implementation Plan

### Sprint 1 (Days 1-7): Foundation & The Data Pipelines
**Goal:** Establish project skeleton, get data flowing from both Dune and Geyser, and display a cached leaderboard.

#### Phase 1.1: Project Scaffolding & AI Priming (Days 1-2)
- [x] Set up pnpm workspace monorepo structure as defined in project_structure.md
- [x] Initialize React Native app with Expo Router in /apps/mobile
- [x] Initialize Fastify backend in /apps/api
- [ ] Configure Supabase project and connect backend
- [x] Set up shared TypeScript types in /packages/shared-types

#### Phase 1.2: Database & Core Infrastructure (Days 3-4)  
- [x] Generate Supabase database schema (users, subscriptions, leaderboard_cache, notification_preferences)
- [x] Set up Prisma ORM with Supabase connection
- [x] Create initial database migrations
- [ ] Implement basic Solana wallet authentication in React Native
- [x] Set up environment configuration for all apps

#### Phase 1.3: Leaderboard Data Pipeline (Day 5)
- [x] Create Dune Analytics service at /apps/api/src/services/dune.service.ts
- [x] Implement PNL and Volume leaderboard queries
- [x] Create scheduled cron job (node-cron) to cache results every hour
- [x] Build /api/v1/leaderboard endpoint serving cached data
- [x] Test end-to-end data flow from Dune to API

#### Phase 1.4: Real-Time Data Pipeline (Days 6-7)
- [ ] Create Chainstack Yellowstone Geyser service at /apps/api/src/services/geyser.service.ts
- [ ] Implement gRPC connection and transaction subscription logic
- [ ] Set up WebSocket server using fastify-websocket
- [ ] Log structured trade data to console for verification
- [ ] Test Geyser connection stability and data quality

### Sprint 2 (Days 8-14): Core Features & Frontend Implementation  
**Goal:** Functional UI for core features with real-time data integration.

#### Phase 2.1: Leaderboard UI & User Onboarding (Days 8-9)
- [ ] Build Leaderboard screen UI in /apps/mobile/app/(tabs)/leaderboard.tsx
- [ ] Implement time filters (1h, 1d, 7d, 30d) and token ecosystem filters
- [ ] Connect frontend to /api/v1/leaderboard endpoint
- [ ] Implement Solana Wallet Adapter for authentication
- [ ] Create onboarding flow with wallet connection

#### Phase 2.2: Live Feed Implementation (Days 10-12)
- [ ] Modify geyser.service.ts to push trades to WebSocket instead of console
- [ ] Filter trades to only include top-100 wallets from leaderboard
- [ ] Build Live Feed UI in /apps/mobile/app/(tabs)/feed.tsx  
- [ ] Implement WebSocket client in React Native
- [ ] Display real-time trade stream with proper formatting
- [ ] Add connection status indicators and error handling

#### Phase 2.3: Gems Scan & Profile Features (Days 13-14)
- [ ] Build /api/v1/wallets/{address}/holdings endpoint using Solana RPC
- [ ] Implement gems discovery logic (holdings > 0.01 SOL from top traders)
- [ ] Build Gems Scan UI in /apps/mobile/app/(tabs)/gems.tsx
- [ ] Create token cards showing holder information and social proof
- [ ] Build basic User Profile screen framework
- [ ] Implement wallet address lookup and trading history display

### Sprint 3 (Days 15-20): Monetization, Polish & Submission
**Goal:** Integrate killer feature (notifications), polish to professional standard, prepare winning submission.

#### Phase 3.1: Solana Pay & Subscriptions (Days 15-16)
- [ ] Implement Solana Pay backend logic for subscription tiers
- [ ] Create subscription plans table and payment verification
- [ ] Build subscription modal UI with plan selection
- [ ] Integrate Solana Pay QR code generation and payment flow
- [ ] Create webhook listener for payment confirmations
- [ ] Update user subscription status after successful payments

#### Phase 3.2: Push Notifications (Day 17)
- [ ] Configure Firebase Cloud Messaging project
- [ ] Implement FCM device token registration in React Native
- [ ] Create notification service in backend (/apps/api/src/services/notification.service.ts)
- [ ] Implement notification filtering logic (SOL amount, market cap)
- [ ] Set up notification triggering when subscribed wallet trades
- [ ] Test end-to-end notification flow

#### Phase 3.3: Final Polish & Testing (Days 18-19)
- [ ] Conduct comprehensive testing across all features and devices
- [ ] Fix critical bugs and performance issues
- [ ] Implement proper error boundaries and loading states
- [ ] Add animations and micro-interactions for polish
- [ ] Optimize bundle size and app performance
- [ ] Test Solana Pay flow on real devices
- [ ] Verify push notifications work reliably

#### Phase 3.4: Hackathon Submission (Day 20)
- [ ] Record compelling 3-minute demo video
- [ ] Create presentation deck highlighting novelty and technical excellence
- [ ] Polish GitHub repository with comprehensive README
- [ ] Prepare live demo environment
- [ ] Submit project to hackathon platform
- [ ] Create social media content showcasing the app

## Resource Links

### Official Documentation:
- [Solana Mobile React Native Quickstart](https://docs.solanamobile.com/react-native/quickstart)
- [Yellowstone gRPC Documentation](https://www.helius.dev/docs/grpc)
- [Dune Analytics API Reference](https://docs.dune.com/api-reference/overview/introduction)
- [Solana Pay Specification](https://docs.solanapay.com/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

### Development Tools:
- [Expo React Native Documentation](https://docs.expo.dev/)
- [Prisma ORM Documentation](https://www.prisma.io/docs/)
- [React Native Paper Documentation](https://callstack.github.io/react-native-paper/)
- [Zustand State Management](https://zustand-demo.pmnd.rs/)

### Best Practices:
- [React Native Performance Guide](https://reactnative.dev/docs/performance)
- [Solana Web3.js Best Practices](https://solana-labs.github.io/solana-web3.js/)
- [Mobile App Security Guidelines](https://owasp.org/www-project-mobile-app-security-testing-guide/)

## Database Schema Overview

### Core Tables:
- **Users**: Wallet addresses, subscription tiers, preferences
- **Tokens**: Token metadata, platform identification, pricing data
- **Trades**: Transaction records with SOL amounts and timestamps
- **Leaderboard_Cache**: Pre-computed rankings for fast access
- **Subscriptions**: Payment records and subscription management
- **Notifications**: User notification preferences and history

### Key Relationships:
- Users → Subscriptions (one-to-many)
- Users → Notification_Preferences (one-to-many)
- Tokens → Trades (one-to-many)
- Users → Trades (one-to-many via wallet_address)

## API Architecture

### RESTful Endpoints:
- `/api/leaderboards` - PNL and volume rankings
- `/api/trades/live` - WebSocket endpoint for real-time trades
- `/api/gems` - Token discovery and holdings analysis
- `/api/users/profile` - User trading statistics
- `/api/subscriptions` - Payment and subscription management
- `/api/notifications` - Push notification configuration

### Real-Time Connections:
- WebSocket for live trade feeds
- Server-sent events for leaderboard updates
- Push notifications for subscription alerts

## Security Considerations

### Authentication:
- Wallet-based authentication using message signing
- JWT tokens for session management
- Rate limiting on all API endpoints

### Data Protection:
- Encrypt sensitive user preferences
- Secure payment processing through Solana Pay
- Input validation and sanitization

### Infrastructure:
- HTTPS everywhere with proper certificate management
- Database connection encryption
- Secure environment variable management

## Performance Targets

### Mobile App:
- App launch time: <2 seconds
- Navigation response: <100ms
- Real-time update latency: <1 second

### Backend:
- API response time: <200ms (95th percentile)
- Leaderboard refresh rate: Every 5 minutes
- Live trade processing: <500ms end-to-end

### Data Processing:
- Historical data sync: Every 4 hours
- Real-time stream processing: <100ms
- Notification delivery: <5 seconds

## Deployment Strategy

### Development:
- Local development with Docker Compose
- Staging environment on Vercel/Railway
- Automated testing with GitHub Actions

### Production:
- Mobile app deployment via Expo Application Services
- Backend deployment on Railway or AWS
- Database hosting on PlanetScale or Supabase
- CDN integration for static assets

## Risk Mitigation

### Technical Risks:
- Yellowstone gRPC rate limits → Implement caching and fallbacks
- Database performance → Proper indexing and query optimization
- Mobile performance → Code splitting and lazy loading

### Business Risks:
- API cost scaling → Implement usage monitoring and optimization
- User adoption → Focus on core value proposition first
- Competition → Rapid iteration and unique features

## Success Metrics

### User Engagement:
- Daily active users
- Session duration
- Feature usage rates

### Technical Performance:
- API response times
- App crash rates
- Real-time data accuracy

### Business Metrics:
- Subscription conversion rates
- Revenue per user
- User retention rates 