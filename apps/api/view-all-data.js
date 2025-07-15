import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function viewAllData() {
  try {
    console.log('🔍 Alpha Seeker Database Overview\n');
    console.log('=' .repeat(50));
    
    // 1. KOL Wallets
    console.log('\n📊 KOL WALLETS');
    console.log('-'.repeat(30));
    const kolWallets = await prisma.kolWallet.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Total KOL Wallets: ${kolWallets.length}\n`);
    kolWallets.forEach((wallet, i) => {
      console.log(`${i+1}. ${wallet.curatedName} (@${wallet.twitterHandle || 'N/A'})`);
      console.log(`   Address: ${wallet.address}`);
      console.log(`   Created: ${wallet.createdAt.toISOString()}`);
      console.log(`   Notes: ${wallet.notes || 'None'}\n`);
    });

    // 2. Transactions
    console.log('\n💳 TRANSACTIONS');
    console.log('-'.repeat(30));
    const transactionCount = await prisma.kolTransaction.count();
    const transactions = await prisma.kolTransaction.findMany({
      include: { kolWallet: true },
      orderBy: { blockTime: 'desc' },
      take: 10
    });
    
    console.log(`Total Transactions: ${transactionCount} (showing latest 10)\n`);
    transactions.forEach((tx, i) => {
      console.log(`${i+1}. ${tx.signature.slice(0, 12)}...`);
      console.log(`   KOL: ${tx.kolWallet.curatedName}`);
      console.log(`   Time: ${tx.blockTime.toISOString()}`);
      console.log(`   Fee: ${tx.feeLamports} lamports`);
      console.log(`   Success: ${tx.wasSuccessful}`);
      console.log(`   Programs: ${tx.programIds.join(', ')}\n`);
    });

    // 3. Token Transfers
    console.log('\n🪙 TOKEN TRANSFERS');
    console.log('-'.repeat(30));
    const transferCount = await prisma.kolTokenTransfer.count();
    const transfers = await prisma.kolTokenTransfer.findMany({
      include: { kolWallet: true },
      orderBy: { blockTime: 'desc' },
      take: 10
    });
    
    console.log(`Total Token Transfers: ${transferCount} (showing latest 10)\n`);
    transfers.forEach((transfer, i) => {
      console.log(`${i+1}. Transfer #${transfer.id}`);
      console.log(`   KOL: ${transfer.kolWallet.curatedName}`);
      console.log(`   Token: ${transfer.tokenMintAddress.slice(0, 12)}...`);
      console.log(`   Amount Change: ${transfer.amountChangeRaw}`);
      console.log(`   USD Value: $${transfer.usdValueAtTime || 'N/A'}`);
      console.log(`   Time: ${transfer.blockTime.toISOString()}\n`);
    });

    // 4. Current Positions
    console.log('\n📈 CURRENT POSITIONS');
    console.log('-'.repeat(30));
    const positionCount = await prisma.kolPosition.count();
    const positions = await prisma.kolPosition.findMany({
      include: { kolWallet: true },
      orderBy: { lastUpdatedAt: 'desc' },
      take: 20
    });
    
    console.log(`Total Positions: ${positionCount} (showing latest 20)\n`);
    positions.forEach((pos, i) => {
      console.log(`${i+1}. ${pos.kolWallet.curatedName}`);
      console.log(`   Token: ${pos.tokenMintAddress.slice(0, 12)}...`);
      console.log(`   Balance: ${pos.currentBalanceRaw}`);
      console.log(`   Cost Basis: $${pos.totalCostBasisUsd}`);
      console.log(`   Avg Cost: $${pos.weightedAvgCostUsd}`);
      console.log(`   Unrealized PnL: $${pos.unrealizedPnlUsd || 'N/A'}`);
      console.log(`   Updated: ${pos.lastUpdatedAt.toISOString()}\n`);
    });

    // 5. PnL Snapshots
    console.log('\n📊 PNL SNAPSHOTS');
    console.log('-'.repeat(30));
    const snapshotCount = await prisma.kolPnlSnapshot.count();
    const pnlSnapshots = await prisma.kolPnlSnapshot.findMany({
      include: { kolWallet: true },
      orderBy: { snapshotTimestamp: 'desc' },
      take: 10
    });
    
    console.log(`Total PnL Snapshots: ${snapshotCount} (showing latest 10)\n`);
    pnlSnapshots.forEach((snapshot, i) => {
      console.log(`${i+1}. ${snapshot.kolWallet.curatedName} - ${snapshot.period}`);
      console.log(`   Realized PnL: $${snapshot.realizedPnlUsd}`);
      console.log(`   Unrealized PnL: $${snapshot.unrealizedPnlUsd || 'N/A'}`);
      console.log(`   Total PnL: $${snapshot.totalPnlUsd}`);
      console.log(`   ROI: ${snapshot.roiPercentage || 'N/A'}%`);
      console.log(`   Win Rate: ${snapshot.winRate || 'N/A'}%`);
      console.log(`   Total Trades: ${snapshot.totalTrades}`);
      console.log(`   Snapshot: ${snapshot.snapshotTimestamp.toISOString()}\n`);
    });

    // 6. Realized PnL Events
    console.log('\n💰 REALIZED PNL EVENTS');
    console.log('-'.repeat(30));
    const realizedCount = await prisma.kolRealizedPnlEvent.count();
    const realizedEvents = await prisma.kolRealizedPnlEvent.findMany({
      include: { kolWallet: true },
      orderBy: { closedAt: 'desc' },
      take: 10
    });
    
    console.log(`Total Realized PnL Events: ${realizedCount} (showing latest 10)\n`);
    realizedEvents.forEach((event, i) => {
      console.log(`${i+1}. ${event.kolWallet.curatedName}`);
      console.log(`   Token: ${event.tokenMintAddress.slice(0, 12)}...`);
      console.log(`   Quantity Sold: ${event.quantitySold}`);
      console.log(`   Sale Value: $${event.saleValueUsd}`);
      console.log(`   Cost Basis: $${event.costBasisUsd}`);
      console.log(`   Realized PnL: $${event.realizedPnlUsd}`);
      console.log(`   ROI: ${event.roiPercentage || 'N/A'}%`);
      console.log(`   Hold Duration: ${event.holdDurationSeconds || 'N/A'} seconds`);
      console.log(`   Closed: ${event.closedAt.toISOString()}\n`);
    });

    // 7. Dune Leaderboard Cache
    console.log('\n🏆 DUNE LEADERBOARD CACHE');
    console.log('-'.repeat(30));
    const leaderboardCount = await prisma.duneLeaderboardCache.count();
    const leaderboard = await prisma.duneLeaderboardCache.findMany({
      orderBy: [{ period: 'desc' }, { rank: 'asc' }],
      take: 20
    });
    
    console.log(`Total Leaderboard Entries: ${leaderboardCount} (showing top 20)\n`);
    leaderboard.forEach((entry, i) => {
      console.log(`${i+1}. Rank ${entry.rank} (${entry.period})`);
      console.log(`   Wallet: ${entry.walletAddress.slice(0, 12)}...`);
      console.log(`   PnL: $${entry.pnlUsd}`);
      console.log(`   Win Rate: ${entry.winRate || 'N/A'}%`);
      console.log(`   Total Trades: ${entry.totalTrades || 'N/A'}`);
      console.log(`   Updated: ${entry.lastUpdated.toISOString()}\n`);
    });

    // 8. Tokens
    console.log('\n🪙 TOKENS');
    console.log('-'.repeat(30));
    const tokenCount = await prisma.token.count();
    const tokens = await prisma.token.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`Total Tokens: ${tokenCount} (showing latest 10)\n`);
    tokens.forEach((token, i) => {
      console.log(`${i+1}. ${token.symbol || 'Unknown'} - ${token.name || 'Unnamed'}`);
      console.log(`   Mint: ${token.mintAddress.slice(0, 12)}...`);
      console.log(`   Decimals: ${token.decimals || 'N/A'}`);
      console.log(`   Meme Token: ${token.isMemeToken}`);
      console.log(`   Verified: ${token.isVerified}`);
      console.log(`   Launch Date: ${token.launchDate?.toISOString() || 'N/A'}`);
      console.log(`   Created: ${token.createdAt.toISOString()}\n`);
    });

    // 9. Gems Feed
    console.log('\n💎 GEMS FEED');
    console.log('-'.repeat(30));
    const gemCount = await prisma.gemsFeed.count();
    const gems = await prisma.gemsFeed.findMany({
      orderBy: { discoveryTimestamp: 'desc' },
      take: 10
    });
    
    console.log(`Total Gems: ${gemCount} (showing latest 10)\n`);
    gems.forEach((gem, i) => {
      console.log(`${i+1}. Gem Discovery`);
      console.log(`   Token: ${gem.tokenMintAddress.slice(0, 12)}...`);
      console.log(`   Famous Buyers: ${gem.numFamousBuyers}`);
      console.log(`   Famous Volume: $${gem.totalFamousVolumeUsd || 'N/A'}`);
      console.log(`   Confidence: ${gem.confidenceScore}`);
      console.log(`   Market Cap: $${gem.marketCapAtDiscovery || 'N/A'}`);
      console.log(`   Active: ${gem.isActive}`);
      console.log(`   Discovered: ${gem.discoveryTimestamp.toISOString()}\n`);
    });

    // 10. Summary Stats
    console.log('\n📈 SUMMARY STATISTICS');
    console.log('-'.repeat(30));
    
    const stats = await Promise.all([
      prisma.kolWallet.count(),
      prisma.kolTransaction.count(),
      prisma.kolTokenTransfer.count(),
      prisma.kolPosition.count(),
      prisma.kolPnlSnapshot.count(),
      prisma.kolRealizedPnlEvent.count(),
      prisma.duneLeaderboardCache.count(),
      prisma.token.count(),
      prisma.gemsFeed.count()
    ]);

    console.log(`KOL Wallets: ${stats[0]}`);
    console.log(`Transactions: ${stats[1]}`);
    console.log(`Token Transfers: ${stats[2]}`);
    console.log(`Active Positions: ${stats[3]}`);
    console.log(`PnL Snapshots: ${stats[4]}`);
    console.log(`Realized PnL Events: ${stats[5]}`);
    console.log(`Leaderboard Entries: ${stats[6]}`);
    console.log(`Tokens: ${stats[7]}`);
    console.log(`Gems: ${stats[8]}`);

    console.log('\n✅ Database overview complete!');
    
  } catch (error) {
    console.error('❌ Error viewing database data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

viewAllData(); 