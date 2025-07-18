import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllData() {
  console.log('🗑️  Starting database cleanup...');
  
  try {
    // Delete in reverse dependency order to avoid foreign key constraint errors
    
    console.log('Deleting KolTokenTransfer records...');
    const deletedTransfers = await prisma.kolTokenTransfer.deleteMany({});
    console.log(`✅ Deleted ${deletedTransfers.count} KolTokenTransfer records`);
    
    console.log('Deleting KolRealizedPnlEvent records...');
    const deletedPnlEvents = await prisma.kolRealizedPnlEvent.deleteMany({});
    console.log(`✅ Deleted ${deletedPnlEvents.count} KolRealizedPnlEvent records`);
    
    console.log('Deleting KolPosition records...');
    const deletedPositions = await prisma.kolPosition.deleteMany({});
    console.log(`✅ Deleted ${deletedPositions.count} KolPosition records`);
    
    console.log('Deleting KolPnlSnapshot records...');
    const deletedSnapshots = await prisma.kolPnlSnapshot.deleteMany({});
    console.log(`✅ Deleted ${deletedSnapshots.count} KolPnlSnapshot records`);
    
    console.log('Deleting KolTransaction records...');
    const deletedTransactions = await prisma.kolTransaction.deleteMany({});
    console.log(`✅ Deleted ${deletedTransactions.count} KolTransaction records`);
    
    console.log('Deleting KolWallet records...');
    const deletedWallets = await prisma.kolWallet.deleteMany({});
    console.log(`✅ Deleted ${deletedWallets.count} KolWallet records`);
    
    console.log('Deleting DuneLeaderboardCache records...');
    const deletedDuneCache = await prisma.duneLeaderboardCache.deleteMany({});
    console.log(`✅ Deleted ${deletedDuneCache.count} DuneLeaderboardCache records`);
    
    console.log('Deleting GemsFeed records...');
    const deletedGems = await prisma.gemsFeed.deleteMany({});
    console.log(`✅ Deleted ${deletedGems.count} GemsFeed records`);
    
    console.log('Deleting Token records...');
    const deletedTokens = await prisma.token.deleteMany({});
    console.log(`✅ Deleted ${deletedTokens.count} Token records`);
    
    console.log('🎉 Database cleanup completed successfully!');
    
    // Verify all tables are empty
    console.log('\n🔍 Verifying all tables are empty...');
    const counts = await Promise.all([
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
    
    const tableNames = [
      'KolWallet',
      'KolTransaction', 
      'KolTokenTransfer',
      'KolPosition',
      'KolPnlSnapshot',
      'KolRealizedPnlEvent',
      'DuneLeaderboardCache',
      'Token',
      'GemsFeed'
    ];
    
    let allEmpty = true;
    for (let i = 0; i < counts.length; i++) {
      const count = counts[i];
      const status = count === 0 ? '✅' : '❌';
      console.log(`${status} ${tableNames[i]}: ${count} records`);
      if (count > 0) allEmpty = false;
    }
    
    if (allEmpty) {
      console.log('\n🎉 All tables are empty! Database successfully cleared.');
    } else {
      console.log('\n⚠️  Some tables still contain data. Check for any constraints or issues.');
    }
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
clearAllData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 