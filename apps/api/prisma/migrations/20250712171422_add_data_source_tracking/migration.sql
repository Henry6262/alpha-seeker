-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pnl_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "snapshotTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realizedPnlUsd" REAL NOT NULL,
    "roiPercentage" REAL,
    "winRate" REAL,
    "totalTrades" INTEGER NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'dune',
    "sourceMetadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pnl_snapshots_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "wallets" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_pnl_snapshots" ("createdAt", "id", "period", "realizedPnlUsd", "roiPercentage", "snapshotTimestamp", "totalTrades", "walletAddress", "winRate") SELECT "createdAt", "id", "period", "realizedPnlUsd", "roiPercentage", "snapshotTimestamp", "totalTrades", "walletAddress", "winRate" FROM "pnl_snapshots";
DROP TABLE "pnl_snapshots";
ALTER TABLE "new_pnl_snapshots" RENAME TO "pnl_snapshots";
CREATE UNIQUE INDEX "pnl_snapshots_walletAddress_period_snapshotTimestamp_dataSource_key" ON "pnl_snapshots"("walletAddress", "period", "snapshotTimestamp", "dataSource");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
