import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('🔍 Alpha Seeker Database Explorer');
  console.log('================================\n');
  
  while (true) {
    console.log('Available commands:');
    console.log('1. show wallets [limit] - Show KOL wallets');
    console.log('2. show transactions [limit] - Show transactions');
    console.log('3. show positions [limit] - Show positions');
    console.log('4. show snapshots [limit] - Show PnL snapshots');
    console.log('5. search [term] - Search wallets');
    console.log('6. stats - Show database statistics');
    console.log('7. exit - Exit explorer\n');
    
    const input = await ask('Enter command: ');
    const [command, ...args] = input.trim().split(' ');
    
    try {
      switch (command.toLowerCase()) {
        case 'show':
          await handleShow(args[0], parseInt(args[1]) || 10);
          break;
        case 'search':
          await handleSearch(args.join(' '));
          break;
        case 'stats':
          await handleStats();
          break;
        case 'exit':
          console.log('👋 Goodbye!');
          process.exit(0);
        default:
          console.log('❌ Unknown command. Try again.\n');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    console.log(''); // Add spacing
  }
}

async function handleShow(table, limit) {
  switch (table?.toLowerCase()) {
    case 'wallets':
      const wallets = await prisma.kolWallet.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      console.log(`\n📊 KOL Wallets (showing ${wallets.length}):`);
      wallets.forEach((w, i) => {
        console.log(`${i+1}. ${w.curatedName} (@${w.twitterHandle || 'N/A'})`);
        console.log(`   ${w.address}`);
      });
      break;
      
    case 'transactions':
      const txCount = await prisma.kolTransaction.count();
      console.log(`\n💳 Transactions: ${txCount} total`);
      if (txCount === 0) {
        console.log('   No transactions yet. Start the real-time streaming to see data here.');
      }
      break;
      
    case 'positions':
      const posCount = await prisma.kolPosition.count();
      console.log(`\n📈 Positions: ${posCount} total`);
      if (posCount === 0) {
        console.log('   No positions yet. Start the real-time streaming to see data here.');
      }
      break;
      
    case 'snapshots':
      const snapshots = await prisma.kolPnlSnapshot.findMany({
        take: limit,
        include: { kolWallet: true },
        orderBy: { snapshotTimestamp: 'desc' }
      });
      console.log(`\n📊 PnL Snapshots (showing ${snapshots.length}):`);
      snapshots.forEach((s, i) => {
        console.log(`${i+1}. ${s.kolWallet.curatedName} - ${s.period}`);
        console.log(`   PnL: $${s.totalPnlUsd}, ROI: ${s.roiPercentage}%`);
      });
      break;
      
    default:
      console.log('❌ Unknown table. Use: wallets, transactions, positions, snapshots');
  }
}

async function handleSearch(term) {
  if (!term) {
    console.log('❌ Please provide a search term');
    return;
  }
  
  const results = await prisma.kolWallet.findMany({
    where: {
      OR: [
        { curatedName: { contains: term, mode: 'insensitive' } },
        { twitterHandle: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } }
      ]
    },
    take: 10
  });
  
  console.log(`\n🔍 Search results for "${term}" (${results.length} found):`);
  results.forEach((w, i) => {
    console.log(`${i+1}. ${w.curatedName} (@${w.twitterHandle || 'N/A'})`);
    console.log(`   ${w.address}`);
  });
}

async function handleStats() {
  const stats = await Promise.all([
    prisma.kolWallet.count(),
    prisma.kolTransaction.count(),
    prisma.kolTokenTransfer.count(),
    prisma.kolPosition.count(),
    prisma.kolPnlSnapshot.count(),
  ]);
  
  console.log('\n📈 Database Statistics:');
  console.log(`   KOL Wallets: ${stats[0]}`);
  console.log(`   Transactions: ${stats[1]}`);
  console.log(`   Token Transfers: ${stats[2]}`);
  console.log(`   Positions: ${stats[3]}`);
  console.log(`   PnL Snapshots: ${stats[4]}`);
}

main().catch(console.error); 