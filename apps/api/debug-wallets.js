import { prisma } from './src/lib/prisma.ts';

async function checkWallets() {
  try {
    console.log('Checking wallet addresses in database...\n');
    
    const wallets = await prisma.kolWallet.findMany({
      select: { address: true, curatedName: true, twitterHandle: true },
      take: 50
    });
    
    console.log(`Found ${wallets.length} wallets in database:\n`);
    
    const invalidAddresses = [];
    const validAddresses = [];
    
    wallets.forEach((w, i) => {
      const addr = w.address;
      const isValid = addr && 
                     typeof addr === 'string' && 
                     addr.length === 44 && 
                     /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr);
      
      if (!isValid) {
        invalidAddresses.push({
          index: i + 1,
          name: w.curatedName,
          twitter: w.twitterHandle,
          address: addr,
          length: addr?.length || 0,
          type: typeof addr
        });
      } else {
        validAddresses.push(addr);
      }
      
      if (i < 10 || !isValid) {
        console.log(`${i+1}. ${w.curatedName} (@${w.twitterHandle})`);
        console.log(`   Address: '${addr}' (length: ${addr?.length || 0}, valid: ${isValid})`);
        console.log('');
      }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total addresses: ${wallets.length}`);
    console.log(`Valid addresses: ${validAddresses.length}`);
    console.log(`Invalid addresses: ${invalidAddresses.length}`);
    
    if (invalidAddresses.length > 0) {
      console.log(`\n=== INVALID ADDRESSES ===`);
      invalidAddresses.forEach(inv => {
        console.log(`${inv.index}. ${inv.name} (@${inv.twitter})`);
        console.log(`   Address: '${inv.address}' (length: ${inv.length}, type: ${inv.type})`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWallets(); 