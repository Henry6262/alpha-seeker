/*
  Warnings:

  - You are about to drop the `leaderboard_cache` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pnl_snapshots` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `positions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `realized_pnl_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `token_transfers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wallets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "gems_feed" DROP CONSTRAINT "gems_feed_token_mint_address_fkey";

-- DropForeignKey
ALTER TABLE "pnl_snapshots" DROP CONSTRAINT "pnl_snapshots_wallet_address_fkey";

-- DropForeignKey
ALTER TABLE "positions" DROP CONSTRAINT "positions_token_mint_address_fkey";

-- DropForeignKey
ALTER TABLE "positions" DROP CONSTRAINT "positions_wallet_address_fkey";

-- DropForeignKey
ALTER TABLE "realized_pnl_events" DROP CONSTRAINT "realized_pnl_events_token_mint_address_fkey";

-- DropForeignKey
ALTER TABLE "token_transfers" DROP CONSTRAINT "token_transfers_token_mint_address_fkey";

-- DropForeignKey
ALTER TABLE "token_transfers" DROP CONSTRAINT "token_transfers_transaction_signature_fkey";

-- DropForeignKey
ALTER TABLE "token_transfers" DROP CONSTRAINT "token_transfers_wallet_address_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_signer_address_fkey";

-- DropTable
DROP TABLE "leaderboard_cache";

-- DropTable
DROP TABLE "pnl_snapshots";

-- DropTable
DROP TABLE "positions";

-- DropTable
DROP TABLE "realized_pnl_events";

-- DropTable
DROP TABLE "token_transfers";

-- DropTable
DROP TABLE "transactions";

-- DropTable
DROP TABLE "wallets";

-- CreateTable
CREATE TABLE "kol_wallets" (
    "address" TEXT NOT NULL,
    "curated_name" TEXT NOT NULL,
    "twitter_handle" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kol_wallets_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "kol_transactions" (
    "signature" TEXT NOT NULL,
    "block_time" TIMESTAMPTZ NOT NULL,
    "slot" BIGINT NOT NULL,
    "kol_address" TEXT NOT NULL,
    "fee_lamports" BIGINT NOT NULL,
    "was_successful" BOOLEAN NOT NULL DEFAULT true,
    "program_ids" TEXT[],
    "compute_units" BIGINT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kol_transactions_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "kol_token_transfers" (
    "id" BIGSERIAL NOT NULL,
    "transaction_signature" TEXT NOT NULL,
    "block_time" TIMESTAMPTZ NOT NULL,
    "kol_address" TEXT NOT NULL,
    "token_mint_address" TEXT NOT NULL,
    "amount_change_raw" BIGINT NOT NULL,
    "pre_balance_raw" BIGINT NOT NULL,
    "post_balance_raw" BIGINT NOT NULL,
    "usd_value_at_time" DECIMAL(20,8),
    "instruction_index" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kol_token_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kol_positions" (
    "kol_address" TEXT NOT NULL,
    "token_mint_address" TEXT NOT NULL,
    "current_balance_raw" BIGINT NOT NULL,
    "total_cost_basis_usd" DECIMAL(20,8) NOT NULL,
    "weighted_avg_cost_usd" DECIMAL(20,8) NOT NULL,
    "unrealized_pnl_usd" DECIMAL(20,8),
    "last_updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kol_positions_pkey" PRIMARY KEY ("kol_address","token_mint_address")
);

-- CreateTable
CREATE TABLE "kol_pnl_snapshots" (
    "kol_address" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "snapshot_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realized_pnl_usd" DECIMAL(20,8) NOT NULL,
    "unrealized_pnl_usd" DECIMAL(20,8),
    "total_pnl_usd" DECIMAL(20,8) NOT NULL,
    "roi_percentage" DECIMAL(8,4),
    "win_rate" DECIMAL(5,2),
    "total_trades" INTEGER NOT NULL,
    "total_volume_usd" DECIMAL(20,8),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kol_pnl_snapshots_pkey" PRIMARY KEY ("kol_address","period","snapshot_timestamp")
);

-- CreateTable
CREATE TABLE "kol_realized_pnl_events" (
    "id" BIGSERIAL NOT NULL,
    "kol_address" TEXT NOT NULL,
    "token_mint_address" TEXT NOT NULL,
    "closing_transaction_signature" TEXT NOT NULL,
    "quantity_sold" BIGINT NOT NULL,
    "sale_value_usd" DECIMAL(20,8) NOT NULL,
    "cost_basis_usd" DECIMAL(20,8) NOT NULL,
    "realized_pnl_usd" DECIMAL(20,8) NOT NULL,
    "hold_duration_seconds" INTEGER,
    "roi_percentage" DECIMAL(8,4),
    "closed_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kol_realized_pnl_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dune_leaderboard_cache" (
    "period" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "pnl_usd" DECIMAL(20,8) NOT NULL,
    "win_rate" DECIMAL(5,2),
    "total_trades" INTEGER,
    "notable_wins" JSONB,
    "last_updated" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dune_leaderboard_cache_pkey" PRIMARY KEY ("period","rank")
);

-- CreateIndex
CREATE INDEX "kol_wallets_curated_name_idx" ON "kol_wallets"("curated_name");

-- CreateIndex
CREATE INDEX "kol_transactions_block_time_idx" ON "kol_transactions"("block_time" DESC);

-- CreateIndex
CREATE INDEX "kol_transactions_kol_address_block_time_idx" ON "kol_transactions"("kol_address", "block_time" DESC);

-- CreateIndex
CREATE INDEX "kol_transactions_slot_idx" ON "kol_transactions"("slot");

-- CreateIndex
CREATE INDEX "kol_token_transfers_kol_address_block_time_idx" ON "kol_token_transfers"("kol_address", "block_time" DESC);

-- CreateIndex
CREATE INDEX "kol_token_transfers_token_mint_address_block_time_idx" ON "kol_token_transfers"("token_mint_address", "block_time" DESC);

-- CreateIndex
CREATE INDEX "kol_positions_kol_address_idx" ON "kol_positions"("kol_address");

-- CreateIndex
CREATE INDEX "kol_positions_token_mint_address_idx" ON "kol_positions"("token_mint_address");

-- CreateIndex
CREATE INDEX "kol_positions_last_updated_at_idx" ON "kol_positions"("last_updated_at");

-- CreateIndex
CREATE INDEX "kol_pnl_snapshots_period_total_pnl_usd_snapshot_timestamp_idx" ON "kol_pnl_snapshots"("period", "total_pnl_usd" DESC, "snapshot_timestamp" DESC);

-- CreateIndex
CREATE INDEX "kol_pnl_snapshots_period_total_volume_usd_snapshot_timestam_idx" ON "kol_pnl_snapshots"("period", "total_volume_usd" DESC, "snapshot_timestamp" DESC);

-- CreateIndex
CREATE INDEX "kol_realized_pnl_events_kol_address_closed_at_idx" ON "kol_realized_pnl_events"("kol_address", "closed_at" DESC);

-- CreateIndex
CREATE INDEX "kol_realized_pnl_events_token_mint_address_closed_at_idx" ON "kol_realized_pnl_events"("token_mint_address", "closed_at" DESC);

-- CreateIndex
CREATE INDEX "dune_leaderboard_cache_period_rank_idx" ON "dune_leaderboard_cache"("period", "rank");

-- CreateIndex
CREATE INDEX "dune_leaderboard_cache_period_pnl_usd_idx" ON "dune_leaderboard_cache"("period", "pnl_usd" DESC);

-- CreateIndex
CREATE INDEX "dune_leaderboard_cache_last_updated_idx" ON "dune_leaderboard_cache"("last_updated");

-- AddForeignKey
ALTER TABLE "kol_transactions" ADD CONSTRAINT "kol_transactions_kol_address_fkey" FOREIGN KEY ("kol_address") REFERENCES "kol_wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_token_transfers" ADD CONSTRAINT "kol_token_transfers_transaction_signature_fkey" FOREIGN KEY ("transaction_signature") REFERENCES "kol_transactions"("signature") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_token_transfers" ADD CONSTRAINT "kol_token_transfers_kol_address_fkey" FOREIGN KEY ("kol_address") REFERENCES "kol_wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_positions" ADD CONSTRAINT "kol_positions_kol_address_fkey" FOREIGN KEY ("kol_address") REFERENCES "kol_wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_pnl_snapshots" ADD CONSTRAINT "kol_pnl_snapshots_kol_address_fkey" FOREIGN KEY ("kol_address") REFERENCES "kol_wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_realized_pnl_events" ADD CONSTRAINT "kol_realized_pnl_events_kol_address_fkey" FOREIGN KEY ("kol_address") REFERENCES "kol_wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
