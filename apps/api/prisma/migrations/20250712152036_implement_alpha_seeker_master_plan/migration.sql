/*
  Warnings:

  - You are about to drop the `token_holdings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trades` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `tradeId` on the `notification_history` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `notification_history` table. All the data in the column will be lost.
  - You are about to drop the column `walletAddress` on the `notification_history` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `notification_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `walletAddress` on the `notification_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `subscriptions` table. All the data in the column will be lost.
  - Added the required column `targetAddress` to the `notification_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tradeSignature` to the `notification_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `notification_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetAddress` to the `notification_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `notification_preferences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "token_holdings_tokenAddress_walletAddress_key";

-- DropIndex
DROP INDEX "trades_signature_key";

-- DropIndex
DROP INDEX "users_twitterId_key";

-- DropIndex
DROP INDEX "users_twitterHandle_key";

-- DropIndex
DROP INDEX "users_walletAddress_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "token_holdings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "tokens";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "trades";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "users";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "curatedName" TEXT,
    "twitterHandle" TEXT,
    "displayName" TEXT,
    "isFamousTrader" BOOLEAN NOT NULL DEFAULT false,
    "isLeaderboardUser" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "blockTime" DATETIME NOT NULL,
    "slot" BIGINT NOT NULL,
    "signerAddress" TEXT NOT NULL,
    "feeLamports" BIGINT NOT NULL,
    "wasSuccessful" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_signerAddress_fkey" FOREIGN KEY ("signerAddress") REFERENCES "wallets" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "token_transfers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionSignature" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tokenMintAddress" TEXT NOT NULL,
    "amountChangeRaw" TEXT NOT NULL,
    "preBalanceRaw" TEXT NOT NULL,
    "postBalanceRaw" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "tokenName" TEXT,
    "tokenDecimals" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "token_transfers_transactionSignature_fkey" FOREIGN KEY ("transactionSignature") REFERENCES "transactions" ("signature") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "token_transfers_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "wallets" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "tokenMintAddress" TEXT NOT NULL,
    "currentBalanceRaw" TEXT NOT NULL,
    "totalCostBasisUsd" REAL NOT NULL,
    "weightedAvgCostUsd" REAL NOT NULL,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "positions_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "wallets" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pnl_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "snapshotTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realizedPnlUsd" REAL NOT NULL,
    "roiPercentage" REAL,
    "winRate" REAL,
    "totalTrades" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pnl_snapshots_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "wallets" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gems_feed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenMintAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "tokenName" TEXT,
    "numAlphaBuyers" INTEGER NOT NULL,
    "buyerNames" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "realized_pnl_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "transactionSignature" TEXT NOT NULL,
    "tokenMintAddress" TEXT NOT NULL,
    "quantitySold" TEXT NOT NULL,
    "saleValueUsd" REAL NOT NULL,
    "costBasisUsd" REAL NOT NULL,
    "realizedPnlUsd" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notification_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "targetAddress" TEXT NOT NULL,
    "tradeSignature" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_notification_history" ("createdAt", "id", "message", "sent", "sentAt") SELECT "createdAt", "id", "message", "sent", "sentAt" FROM "notification_history";
DROP TABLE "notification_history";
ALTER TABLE "new_notification_history" RENAME TO "notification_history";
CREATE TABLE "new_notification_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "targetAddress" TEXT NOT NULL,
    "minSolAmount" REAL NOT NULL DEFAULT 0.01,
    "minMarketCap" REAL,
    "maxMarketCap" REAL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "notification_preferences_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_notification_preferences" ("createdAt", "enabled", "id", "maxMarketCap", "minMarketCap", "minSolAmount", "updatedAt") SELECT "createdAt", "enabled", "id", "maxMarketCap", "minMarketCap", "minSolAmount", "updatedAt" FROM "notification_preferences";
DROP TABLE "notification_preferences";
ALTER TABLE "new_notification_preferences" RENAME TO "notification_preferences";
CREATE TABLE "new_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "solAmount" REAL,
    "signature" TEXT,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_subscriptions" ("createdAt", "endDate", "id", "signature", "solAmount", "startDate", "status", "tier") SELECT "createdAt", "endDate", "id", "signature", "solAmount", "startDate", "status", "tier" FROM "subscriptions";
DROP TABLE "subscriptions";
ALTER TABLE "new_subscriptions" RENAME TO "subscriptions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_signature_key" ON "transactions"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "positions_walletAddress_tokenMintAddress_key" ON "positions"("walletAddress", "tokenMintAddress");

-- CreateIndex
CREATE UNIQUE INDEX "pnl_snapshots_walletAddress_period_snapshotTimestamp_key" ON "pnl_snapshots"("walletAddress", "period", "snapshotTimestamp");
