-- CreateTable
CREATE TABLE "wallets" (
    "address" TEXT NOT NULL,
    "curated_name" TEXT,
    "twitter_handle" TEXT,
    "is_famous_trader" BOOLEAN NOT NULL DEFAULT false,
    "is_leaderboard_user" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "tokens" (
    "mint_address" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "decimals" INTEGER,
    "logo_uri" TEXT,
    "coingecko_id" TEXT,
    "is_meme_token" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "launch_date" TIMESTAMPTZ,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("mint_address")
);

-- CreateTable
CREATE TABLE "transactions" (
    "signature" TEXT NOT NULL,
    "block_time" TIMESTAMPTZ NOT NULL,
    "slot" BIGINT NOT NULL,
    "signer_address" TEXT NOT NULL,
    "fee_lamports" BIGINT NOT NULL,
    "was_successful" BOOLEAN NOT NULL DEFAULT true,
    "program_ids" TEXT[],
    "compute_units" BIGINT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "token_transfers" (
    "id" BIGSERIAL NOT NULL,
    "transaction_signature" TEXT NOT NULL,
    "block_time" TIMESTAMPTZ NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "token_mint_address" TEXT NOT NULL,
    "amount_change_raw" BIGINT NOT NULL,
    "pre_balance_raw" BIGINT NOT NULL,
    "post_balance_raw" BIGINT NOT NULL,
    "usd_value_at_time" DECIMAL(20,8),
    "instruction_index" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "wallet_address" TEXT NOT NULL,
    "token_mint_address" TEXT NOT NULL,
    "current_balance_raw" BIGINT NOT NULL,
    "total_cost_basis_usd" DECIMAL(20,8) NOT NULL,
    "weighted_avg_cost_usd" DECIMAL(20,8) NOT NULL,
    "unrealized_pnl_usd" DECIMAL(20,8),
    "last_updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("wallet_address","token_mint_address")
);

-- CreateTable
CREATE TABLE "pnl_snapshots" (
    "wallet_address" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "ecosystem" TEXT NOT NULL,
    "snapshot_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realized_pnl_usd" DECIMAL(20,8) NOT NULL,
    "unrealized_pnl_usd" DECIMAL(20,8),
    "total_pnl_usd" DECIMAL(20,8) NOT NULL,
    "roi_percentage" DECIMAL(8,4),
    "win_rate" DECIMAL(5,2),
    "total_trades" INTEGER NOT NULL,
    "total_volume_usd" DECIMAL(20,8),
    "data_source" TEXT NOT NULL DEFAULT 'dune',
    "source_metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pnl_snapshots_pkey" PRIMARY KEY ("wallet_address","period","ecosystem","snapshot_timestamp")
);

-- CreateTable
CREATE TABLE "leaderboard_cache" (
    "leaderboard_type" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "ecosystem" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "metric" DECIMAL(20,8) NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leaderboard_cache_pkey" PRIMARY KEY ("leaderboard_type","timeframe","ecosystem","rank")
);

-- CreateTable
CREATE TABLE "gems_feed" (
    "token_mint_address" TEXT NOT NULL,
    "discovery_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "num_famous_buyers" INTEGER NOT NULL,
    "famous_buyer_addresses" TEXT[],
    "total_famous_volume_usd" DECIMAL(20,8),
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "market_cap_at_discovery" DECIMAL(20,8),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata_json" JSONB,

    CONSTRAINT "gems_feed_pkey" PRIMARY KEY ("token_mint_address","discovery_timestamp")
);

-- CreateTable
CREATE TABLE "realized_pnl_events" (
    "id" BIGSERIAL NOT NULL,
    "wallet_address" TEXT NOT NULL,
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

    CONSTRAINT "realized_pnl_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallets_is_famous_trader_idx" ON "wallets"("is_famous_trader");

-- CreateIndex
CREATE INDEX "wallets_is_leaderboard_user_idx" ON "wallets"("is_leaderboard_user");

-- CreateIndex
CREATE INDEX "wallets_first_seen_at_idx" ON "wallets"("first_seen_at");

-- CreateIndex
CREATE INDEX "tokens_symbol_idx" ON "tokens"("symbol");

-- CreateIndex
CREATE INDEX "tokens_is_meme_token_idx" ON "tokens"("is_meme_token");

-- CreateIndex
CREATE INDEX "tokens_launch_date_idx" ON "tokens"("launch_date");

-- CreateIndex
CREATE INDEX "transactions_block_time_idx" ON "transactions"("block_time" DESC);

-- CreateIndex
CREATE INDEX "transactions_signer_address_block_time_idx" ON "transactions"("signer_address", "block_time" DESC);

-- CreateIndex
CREATE INDEX "transactions_slot_idx" ON "transactions"("slot");

-- CreateIndex
CREATE INDEX "token_transfers_wallet_address_block_time_idx" ON "token_transfers"("wallet_address", "block_time" DESC);

-- CreateIndex
CREATE INDEX "token_transfers_token_mint_address_block_time_idx" ON "token_transfers"("token_mint_address", "block_time" DESC);

-- CreateIndex
CREATE INDEX "token_transfers_wallet_address_token_mint_address_block_tim_idx" ON "token_transfers"("wallet_address", "token_mint_address", "block_time" DESC);

-- CreateIndex
CREATE INDEX "positions_wallet_address_idx" ON "positions"("wallet_address");

-- CreateIndex
CREATE INDEX "positions_token_mint_address_idx" ON "positions"("token_mint_address");

-- CreateIndex
CREATE INDEX "positions_last_updated_at_idx" ON "positions"("last_updated_at");

-- CreateIndex
CREATE INDEX "pnl_snapshots_period_ecosystem_total_pnl_usd_snapshot_times_idx" ON "pnl_snapshots"("period", "ecosystem", "total_pnl_usd" DESC, "snapshot_timestamp" DESC);

-- CreateIndex
CREATE INDEX "pnl_snapshots_period_ecosystem_total_volume_usd_snapshot_ti_idx" ON "pnl_snapshots"("period", "ecosystem", "total_volume_usd" DESC, "snapshot_timestamp" DESC);

-- CreateIndex
CREATE INDEX "leaderboard_cache_expires_at_idx" ON "leaderboard_cache"("expires_at");

-- CreateIndex
CREATE INDEX "gems_feed_is_active_confidence_score_discovery_timestamp_idx" ON "gems_feed"("is_active", "confidence_score" DESC, "discovery_timestamp" DESC);

-- CreateIndex
CREATE INDEX "realized_pnl_events_wallet_address_closed_at_idx" ON "realized_pnl_events"("wallet_address", "closed_at" DESC);

-- CreateIndex
CREATE INDEX "realized_pnl_events_token_mint_address_closed_at_idx" ON "realized_pnl_events"("token_mint_address", "closed_at" DESC);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_signer_address_fkey" FOREIGN KEY ("signer_address") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transfers" ADD CONSTRAINT "token_transfers_transaction_signature_fkey" FOREIGN KEY ("transaction_signature") REFERENCES "transactions"("signature") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transfers" ADD CONSTRAINT "token_transfers_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transfers" ADD CONSTRAINT "token_transfers_token_mint_address_fkey" FOREIGN KEY ("token_mint_address") REFERENCES "tokens"("mint_address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_token_mint_address_fkey" FOREIGN KEY ("token_mint_address") REFERENCES "tokens"("mint_address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pnl_snapshots" ADD CONSTRAINT "pnl_snapshots_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gems_feed" ADD CONSTRAINT "gems_feed_token_mint_address_fkey" FOREIGN KEY ("token_mint_address") REFERENCES "tokens"("mint_address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realized_pnl_events" ADD CONSTRAINT "realized_pnl_events_token_mint_address_fkey" FOREIGN KEY ("token_mint_address") REFERENCES "tokens"("mint_address") ON DELETE RESTRICT ON UPDATE CASCADE;
