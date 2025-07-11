# Alpha Seeker: Master Project Document (PRD)

**Version:** 1.0  
**Date:** 2024-07-11  
**Status:** Finalized for Hackathon MVP

## 1. Project Overview & Vision

Alpha Seeker is a mobile-first, institutional-grade Solana trading intelligence platform designed for the retail trader. It provides users with actionable, real-time data on the market's most profitable wallets, enabling them to discover new opportunities ("alpha") and make informed trading decisions.

Our vision is to democratize access to on-chain analytics, transforming complex data into a simple, intuitive, and indispensable mobile companion for anyone trading on Solana.

### 1.1. Hackathon Winning Strategy

This project is designed to win the Solana Mobile Hackathon by excelling in four key areas:

**Novelty & Impact:** The core "killer feature"—paid, customizable push notifications for top trader wallets—provides immediate, actionable utility that doesn't currently exist in a user-friendly mobile format.

**Exceptional UX:** By leveraging React Native and Tamagui, the app will feel native, fast, and polished, directly addressing the need for high-quality mobile experiences in web3.

**Crypto-Native Business Model:** Integrating Solana Pay for subscriptions demonstrates a seamless, low-friction, and ecosystem-aligned monetization strategy.

**Technical Excellence:** The architecture leverages high-performance tools like Chainstack's Geyser for real-time data and Dune Analytics for historical analysis, showcasing a robust and scalable backend.

## 2. Target Audience

**Primary:** Active retail traders on Solana ("degens") who frequently trade meme coins and new tokens on platforms like pump.fun and Raydium.

**Secondary:** Intermediate crypto investors looking to gain an edge by understanding the behavior of "smart money" on the Solana network.

**Tertiary:** Crypto analysts and researchers who need a quick, mobile way to track on-chain trends.

## 3. Core User Problems & Solutions

| Problem | Our Solution |
|---------|--------------|
| **Information Overload:** It's impossible to track thousands of tokens and wallets manually. | **Curated Leaderboards & Feeds:** We surface the most relevant wallets and trades, cutting through the noise. |
| **Missed Opportunities:** By the time a token is trending on social media, the initial opportunity is gone. | **Real-Time "Gems" Scan & Live Feed:** We show what top traders are buying as it happens, providing a critical time advantage. |
| **Lack of Trust:** It's hard to know which new tokens are legitimate and which are scams. | **Social Proof:** The "Gems" feature shows which top-performing wallets are invested in a token, providing a strong signal of legitimacy. |
| **Reactive vs. Proactive Trading:** Most tools show what has already happened. | **Custom Push Notifications:** Our killer feature allows users to become proactive, receiving alerts based on the actions of wallets they trust, enabling them to act instantly. |

## 4. Detailed Feature Requirements (MVP)

### 4.1. Feature: Leaderboards System

**Description:** Two distinct leaderboards to rank top-performing wallets. Data is sourced from Dune Analytics and cached on our backend for performance.

**User Story:** "As a trader, I want to see which wallets are the most profitable and the most active so I can identify wallets to follow."

**Leaderboard Types:**
- **Total PNL (in SOL):** Ranks wallets by realized profit and loss.
- **Total Volume (in SOL):** Ranks wallets by total SOL spent on trades.

**Time Filters (for both leaderboards):**
- 1 Hour
- 1 Day  
- 7 Days
- 30 Days

**Token Ecosystem Filters (for both leaderboards):**
- **All:** All Solana tokens.
- **pump.fun:** Only tokens created via the pump.fun program.
- **LetsBONK.fun:** Only tokens launched via the LetsBONK.fun/Raydium LaunchLab program.

**UI Display:** Each entry must show Rank, Wallet Address (truncated, with a copy button), and the primary metric (e.g., +1,234.56 SOL).

### 4.2. Feature: Live User Trades Feed

**Description:** A real-time, streaming feed of all trades made by the top 100 wallets from the general PNL leaderboard.

**User Story:** "As a trader, I want a live feed of what the best traders are buying and selling right now so I can stay on top of the market."

**Data Source:** Real-time subscription to wallet transactions via Chainstack Yellowstone gRPC Geyser.

**UI Display:** Each feed item must show:
- Wallet Address
- Action (Buy or Sell)
- Token Symbol & Name
- Amount (in SOL)
- Timestamp (e.g., "3s ago")

### 4.3. Feature: "Gems" Scan

**Description:** A discovery feed that highlights tokens being accumulated by top traders.

**User Story:** "As a trader, I want to discover promising new tokens by seeing what multiple top traders are holding."

**Core Logic:** A token appears in this section if one or more of the top 100 PNL wallets acquires a position valued at > 0.01 SOL.

**UI Display (Token Card):**
- Token Name & Symbol
- Current Price & Market Cap
- A list/count of top PNL wallets currently holding the token.

### 4.4. Feature: User Trading Profile & History

**Description:** A detailed performance screen for any Solana wallet, showing a breakdown of their recent trading activity.

**User Story:** "As a trader, I want to analyze my own performance or deep-dive into a top trader's strategy by viewing their detailed trade history."

**Scope:** The profile page should be viewable for the connected user's wallet and any other wallet address searched in the app.

**UI Display:** A list of cards, one for each token traded in the last 30 days, with the following metrics:
- **Realized PNL:** In both SOL and USD (e.g., +103.34 SOL ($16,991.20)).
- **Bought:** Total SOL spent and total token quantity (e.g., 55.20 SOL (25.2m)).
- **Sold:** Total SOL received and total token quantity (e.g., 158.54 SOL (25.2m)).
- **Hold:** Current quantity of the token held.
- **Realized ROI:** e.g., +187.2%.
- **Duration:** e.g., 1d.

### 4.5. Feature: Tiered Subscriptions & Custom Notifications (The Killer Feature)

**Description:** The app's core monetization and utility feature, allowing users to subscribe to receive push notifications for specific wallet activity.

**User Story:** "As a premium user, I want to get instant mobile alerts when a wallet I follow makes a significant trade, so I can act on the information immediately."

**Payment Integration:** All subscriptions are to be paid for using the Solana Pay SDK.

**Subscription Tiers:**
- **Free:** Subscribe to notifications for 1 wallet.
- **Degen:** Subscribe to notifications for 5 wallets.
- **Market Maker:** Subscribe to unlimited wallets.

**Custom Notification Dashboard:** For each wallet a user subscribes to, they can set the following filters:
- **Minimum SOL Amount:** Only receive a notification if the trade value is above a user-defined threshold.
- **Market Cap Range:** Only receive a notification if the token's market cap is within a user-defined min/max range.

**Notification Payload:** The push notification must contain the key trade details (e.g., "Wallet 1Ab2... just bought 15.5 SOL of TOKEN").

## 5. Non-Functional Requirements

### Performance:
- **App Launch Time:** < 2 seconds.
- **API Response Time:** < 200ms (p95).
- **Real-time Feed Latency:** < 1 second from on-chain confirmation to UI update.

### Security:
- Authentication must be handled via wallet message signing (Sign-In with Solana).
- All API communication must be over HTTPS.
- No private keys are ever stored or handled by the application.

### UI/UX:
- The application must be highly responsive and intuitive, following the guidelines in docs/UI_UX_doc.md.
- The design must be clean, professional, and optimized for mobile-first interaction.

### Scalability:
- The backend must handle at least 1,000 concurrent WebSocket connections for the live feed.
- Database queries must be optimized, and leaderboards heavily cached (e.g., with Redis) to handle user growth.

## 6. Success Metrics

### User Engagement:
- Daily Active Users (DAU)
- Session Duration
- Number of wallets followed/notifications configured.

### Business & Monetization:
- Subscription Conversion Rate (Free to Paid).
- Average Revenue Per User (ARPU).

### Technical Performance:
- App Crash Rate (< 0.1%).
- API Uptime (> 99.9%). 