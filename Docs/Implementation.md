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
- ✅ Comprehensive database schema documentation created

**Current Development Status:**
- API Server: ✅ Running on port 3000 with leaderboard data
- Mobile App: ✅ Running on port 8081 with QR code ready for testing
- Git Repository: ✅ Clean main branch with monorepo structure
- Database Schema: ✅ Documented with Twitter integration support

## 📋 **Updated Development Workflow**

### **Before Starting Any Task:**
1. **Consult Documentation in Order:**
   - `Docs/project.md` - Master PRD and requirements
   - `Docs/Database_Schema.md` - **NEW** Database structure reference
   - `Docs/Implementation.md` - Current sprint tasks and progress
   - `Docs/project_structure.md` - Code organization guidelines
   - `Docs/UI_UX_doc.md` - Design system requirements
   - `Docs/Bug_tracking.md` - Known issues and solutions

2. **Database-Related Tasks:**
   - **ALWAYS** reference `Docs/Database_Schema.md` before any database work
   - **NEVER** modify Prisma schema without updating schema documentation
   - **MANDATORY** update schema version and changelog for any database changes
   - **VERIFY** API endpoints align with documented schema

3. **Task Dependencies:**
   - Check implementation dependencies in current phase
   - Verify all prerequisite tasks are completed
   - Ensure database schema supports planned features

### **Enhanced Task Execution Protocol:**

#### **1. Database Schema Compliance**
- **Before any database work:** Check `Docs/Database_Schema.md`
- **Schema changes:** Update both Prisma schema AND documentation
- **API development:** Ensure endpoints match documented schema
- **Migration planning:** Follow documented migration strategy

#### **2. Architecture Compliance**
- Check `Docs/project_structure.md` for monorepo organization
- Verify new files follow established patterns
- Ensure dependency management follows pnpm workspace rules

#### **3. API Development Standards**
- All endpoints must align with database schema documentation
- Follow established naming conventions from schema docs
- Implement proper error handling and validation
- Document new endpoints in schema documentation

#### **4. Testing & Validation**
- **Database testing:** Verify schema constraints work correctly
- **API testing:** Test with documented field requirements
- **Integration testing:** Ensure frontend/backend schema alignment
- **Performance testing:** Validate indexing strategy effectiveness

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
- [x] Configure Supabase project and connect backend
- [x] Set up shared TypeScript types in /packages/shared-types
- [x] **NEW:** Create comprehensive database schema documentation

#### Phase 1.2: Database & Core Infrastructure (Days 3-4)  
- [x] Generate Supabase database schema (users, subscriptions, leaderboard_cache, notification_preferences)
- [x] Set up Prisma ORM with Supabase connection
- [x] Create initial database migrations
- [x] **NEW:** Add Twitter integration fields to User model
- [ ] **UPDATED:** Implement Solana wallet authentication with Twitter linking
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
**Goal:** Functional UI for core features with real-time data integration and Twitter integration.

#### Phase 2.1: User Authentication & Profile Management (Days 8-9)
- [ ] **UPDATED:** Build user registration with wallet + Twitter authentication
- [ ] Implement Twitter OAuth integration for profile enhancement
- [ ] Create user profile management endpoints aligned with schema
- [ ] Build user profile UI with Twitter integration features
- [ ] Test Twitter data synchronization and validation

#### Phase 2.2: Leaderboard UI & Social Features (Days 10-11)
- [ ] Build Leaderboard screen UI in /apps/mobile/app/(tabs)/leaderboard.tsx
- [ ] Implement time filters (1h, 1d, 7d, 30d) and ecosystem filters
- [ ] Connect frontend to /api/v1/leaderboard endpoint
- [ ] **NEW:** Add Twitter handles and social proof to leaderboard display
- [ ] Implement user profile cards with Twitter integration

#### Phase 2.3: Live Feed & Social Context (Days 12-13)
- [ ] Modify geyser.service.ts to push trades to WebSocket
- [ ] Filter trades to only include top-100 wallets from leaderboard
- [ ] Build Live Feed UI with Twitter profile information
- [ ] **NEW:** Display trader Twitter handles and verification status
- [ ] Add social context to trade notifications

#### Phase 2.4: Enhanced User Experience (Day 14)
- [ ] **NEW:** Implement user discovery via Twitter handles
- [ ] Add social proof indicators throughout UI
- [ ] Build notification preferences with Twitter integration
- [ ] Test complete user flow with Twitter authentication

### Sprint 3 (Days 15-20): Monetization, Polish & Social Features
**Goal:** Integrate killer features, leverage Twitter data for engagement, prepare winning submission.

#### Phase 3.1: Solana Pay & Enhanced Subscriptions (Days 15-16)
- [ ] Implement Solana Pay backend logic for subscription tiers
- [ ] **NEW:** Add Twitter verification bonus for subscription pricing
- [ ] Create subscription plans with social features
- [ ] Build subscription modal with Twitter profile integration
- [ ] Test payment flow with Twitter-enhanced user profiles

#### Phase 3.2: Social Notifications & Discovery (Days 17-18)
- [ ] Configure Firebase Cloud Messaging project
- [ ] **NEW:** Implement Twitter-based notification preferences
- [ ] Add social discovery features (find traders by Twitter handle)
- [ ] Create notification templates with Twitter profile data
- [ ] Test social notification system end-to-end

#### Phase 3.3: Final Polish & Social Features (Day 19)
- [ ] **NEW:** Implement Twitter share functionality for trades
- [ ] Add social proof elements throughout the app
- [ ] Test Twitter integration across all features
- [ ] Optimize performance with Twitter data caching
- [ ] Conduct comprehensive testing with Twitter authentication

#### Phase 3.4: Hackathon Submission (Day 20)
- [ ] Record demo video highlighting Twitter integration
- [ ] **NEW:** Showcase social features as competitive advantage
- [ ] Create presentation deck emphasizing social proof elements
- [ ] Submit project with comprehensive Twitter integration
- [ ] Prepare social media campaign leveraging Twitter features

## Updated Resource Links

### **Database & Schema:**
- **NEW:** `Docs/Database_Schema.md` - Complete database reference
- [Prisma Schema Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

### **Twitter Integration:**
- **NEW:** [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)
- **NEW:** [Twitter OAuth 2.0 Flow](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- **NEW:** [Twitter User Profile Data](https://developer.twitter.com/en/docs/twitter-api/users/lookup/api-reference)

### **Official Documentation:**
- [Solana Mobile React Native Quickstart](https://docs.solanamobile.com/react-native/quickstart)
- [Yellowstone gRPC Documentation](https://www.helius.dev/docs/grpc)
- [Dune Analytics API Reference](https://docs.dune.com/api-reference/overview/introduction)
- [Solana Pay Specification](https://docs.solanapay.com/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

## **Critical Rules - MANDATORY**
- **NEVER** modify database schema without updating `Docs/Database_Schema.md`
- **ALWAYS** check database schema documentation before API development
- **MANDATORY** update schema version and changelog for any database changes
- **VERIFY** all Twitter integration follows documented field constraints
- **ENSURE** API endpoints align with documented database schema
- **TEST** database constraints and relationships before deployment

Remember: The database schema documentation is now the single source of truth for all database-related development. Any deviation must be documented and approved. 