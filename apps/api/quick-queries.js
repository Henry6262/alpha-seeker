import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const queries = {
  // Show top KOL wallets by recent performance
  async topPerformers() {
    console.log('🏆 TOP PERFORMERS (Last 7 Days)\n');
    const topPerformers = await prisma.kolPnlSnapshot.findMany({
      where: { period: '7D' },
      include: { kolWallet: true },
      orderBy: { totalPnlUsd: 'desc' },
      take: 20
    });
    
    topPerformers.forEach((perf, i) => {
      console.log(`${i+1}. ${perf.kolWallet.curatedName}`);
      console.log(`   Total PnL: $${perf.totalPnlUsd}`);
      console.log(`   ROI: ${perf.roiPercentage}%`);
      console.log(`   Win Rate: ${perf.winRate}%`);
      console.log(`   Trades: ${perf.totalTrades}\n`);
    });
  },

  // Show wallet count and basic stats
  async quickStats() {
    console.log('📊 QUICK STATISTICS\n');
    const stats = await Promise.all([
      prisma.kolWallet.count(),
      prisma.kolTransaction.count(),
      prisma.kolTokenTransfer.count(),
      prisma.kolPosition.count(),
      prisma.kolPnlSnapshot.count(),
    ]);
    
    console.log(`👥 KOL Wallets: ${stats[0]}`);
    console.log(`💳 Transactions: ${stats[1]}`);
    console.log(`🪙 Token Transfers: ${stats[2]}`);
    console.log(`📈 Active Positions: ${stats[3]}`);
    console.log(`📊 PnL Snapshots: ${stats[4]}`);
  },

  // Show recent KOL wallets added
  async recentWallets() {
    console.log('🆕 RECENTLY ADDED WALLETS\n');
    const recent = await prisma.kolWallet.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    recent.forEach((wallet, i) => {
      console.log(`${i+1}. ${wallet.curatedName} (@${wallet.twitterHandle || 'N/A'})`);
      console.log(`   Address: ${wallet.address}`);
      console.log(`   Added: ${wallet.createdAt.toISOString()}\n`);
    });
  },

  // Search for specific wallet
  async searchWallet(searchTerm) {
    console.log(`🔍 SEARCHING FOR: "${searchTerm}"\n`);
    const results = await prisma.kolWallet.findMany({
      where: {
        OR: [
          { curatedName: { contains: searchTerm, mode: 'insensitive' } },
          { twitterHandle: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      include: {
        pnlSnapshots: {
          where: { period: '7D' },
          orderBy: { snapshotTimestamp: 'desc' },
          take: 1
        }
      }
    });
    
    if (results.length === 0) {
      console.log('No wallets found matching your search.');
      return;
    }
    
    results.forEach((wallet, i) => {
      console.log(`${i+1}. ${wallet.curatedName} (@${wallet.twitterHandle || 'N/A'})`);
      console.log(`   Address: ${wallet.address}`);
      if (wallet.pnlSnapshots[0]) {
        console.log(`   7D PnL: $${wallet.pnlSnapshots[0].totalPnlUsd}`);
        console.log(`   7D ROI: ${wallet.pnlSnapshots[0].roiPercentage}%`);
      }
      console.log('');
    });
  }
};

// Command line interface
const command = process.argv[2];
const searchTerm = process.argv[3];

switch (command) {
  case 'top':
    await queries.topPerformers();
    break;
  case 'stats':
    await queries.quickStats();
    break;
  case 'recent':
    await queries.recentWallets();
    break;
  case 'search':
    if (!searchTerm) {
      console.log('❌ Please provide a search term: node quick-queries.js search "search_term"');
    } else {
      await queries.searchWallet(searchTerm);
    }
    break;
  default:
    console.log('🔧 QUICK QUERIES USAGE:\n');
    console.log('node quick-queries.js top     - Show top performers');
    console.log('node quick-queries.js stats   - Show quick statistics');
    console.log('node quick-queries.js recent  - Show recently added wallets');
    console.log('node quick-queries.js search "term" - Search for wallets');
    console.log('\nExamples:');
    console.log('node quick-queries.js search "mert"');
    console.log('node quick-queries.js search "abc123"');
}

await prisma.$disconnect(); 