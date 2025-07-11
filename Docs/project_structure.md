# Alpha Seeker: Project Structure

**Source PRD:** Docs/project.md  
**Version:** 1.0

## 1. Root Directory Overview
This project uses a monorepo structure managed by pnpm workspaces to organize the frontend, backend, and shared packages efficiently.

```
/
├── .cursor-rules/          # Directory for Cursor AI rules
│   ├── generate.md         # One-time rule to generate docs
│   └── workflow.md         # Always-on rule for development
├── .github/                # CI/CD workflows (e.g., GitHub Actions)
├── apps/                   # Contains the runnable applications
│   ├── mobile/             # The React Native / Expo mobile app
│   └── api/                # The Node.js / Fastify backend API
├── docs/                   # All project documentation
├── packages/               # Shared libraries and utilities
│   ├── shared-types/       # TypeScript types shared between front/backend
│   └── ui/                 # Shared Tamagui UI components
├── .env.example            # Example environment variables
├── .gitignore
├── .cursorrules            # Always-on AI workflow rule
├── package.json            # Root package configuration
├── pnpm-workspace.yaml     # Defines the monorepo workspaces
└── tsconfig.base.json      # Base TypeScript configuration
```

## 2. Application Details (/apps)

### 2.1 Mobile App (/apps/mobile)
Built with React Native and Expo Router for file-based routing.

```
/apps/mobile
├── app/                    # Expo Router directory
│   ├── (tabs)/             # Main tab-based layout
│   │   ├── _layout.tsx     # Defines the tab navigator
│   │   ├── leaderboard.tsx # Leaderboard screen
│   │   ├── feed.tsx        # Live Trades Feed screen
│   │   ├── gems.tsx        # Gems Scan screen
│   │   └── profile.tsx     # User Profile & Settings screen
│   ├── _layout.tsx         # Root layout (providers, themes)
│   └── modal.tsx           # A global modal screen
├── assets/                 # Static assets (images, fonts, icons)
├── components/             # Screen-specific components
├── constants/              # App-wide constants (colors, styles)
├── hooks/                  # Custom React hooks
├── services/               # API clients, wallet services
├── store/                  # Zustand state management stores
└── utils/                  # Utility functions
```

### 2.2 Backend API (/apps/api)
A high-performance backend built with Node.js and Fastify.

```
/apps/api
├── src/
│   ├── plugins/            # Fastify plugins (e.g., auth, websockets, cors)
│   ├── routes/             # API route handlers, organized by feature
│   │   ├── v1/
│   │   │   ├── leaderboard.ts
│   │   │   ├── subscriptions.ts
│   │   │   └── index.ts    # Registers all v1 routes
│   │   └── index.ts
│   ├── services/           # Core business logic
│   │   ├── dune.service.ts
│   │   ├── geyser.service.ts
│   │   ├── payment.service.ts
│   │   └── notification.service.ts
│   ├── jobs/               # Scheduled cron jobs (e.g., leaderboard cache)
│   └── index.ts            # Server entry point
├── prisma/                 # Prisma ORM for database management
│   ├── migrations/
│   └── schema.prisma       # Database schema definition
└── package.json
```

## 3. Shared Packages (/packages)

### 3.1 Shared Types (/packages/shared-types)
Contains TypeScript interfaces and types shared between the mobile app and the backend API to ensure type safety across the stack.

### 3.2 UI Kit (/packages/ui)
Contains reusable, generic UI components built with Tamagui that can be used across the mobile app and potentially a future web app.

## 4. File Naming Conventions

### Components (React): 
PascalCase.tsx (e.g., LeaderboardCard.tsx)

### Hooks (React): 
useCamelCase.ts (e.g., useLeaderboardData.ts)

### Services/Utilities (TS): 
camelCase.ts (e.g., dune.service.ts)

### API Routes (Fastify): 
kebab-case.ts (e.g., leaderboard-routes.ts)

### Database Migrations: 
Timestamp-prefixed (e.g., 20240711_initial_schema.sql)

This simplified but powerful structure is optimized for rapid hackathon development while maintaining the ability to scale and add complexity as needed. The pnpm workspace approach allows for efficient dependency management and shared code reuse across the entire Alpha Seeker ecosystem. 