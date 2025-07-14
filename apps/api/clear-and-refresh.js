#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearAndRefreshEcosystemData() {
  console.log('🧹 Clearing all ecosystem leaderboard data...')
  
  try {
    // Delete all existing ecosystem leaderboard cache
    const deleted = await prisma.duneLeaderboardCache.deleteMany({})
    console.log(`✅ Deleted ${deleted.count} existing ecosystem leaderboard entries`)
    
    // Check current data
    const remainingCount = await prisma.duneLeaderboardCache.count()
    console.log(`📊 Remaining entries: ${remainingCount}`)
    
    // Refresh with new data
    console.log('🔄 Refreshing ecosystem leaderboard cache...')
    const response = await fetch('http://localhost:3000/api/v1/bootstrap/refresh-dune-cache', {
      method: 'POST'
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Refresh response:', JSON.stringify(result, null, 2))
    } else {
      console.error('❌ Failed to refresh cache:', response.status, response.statusText)
    }
    
    // Check the order of results for 7D timeframe
    console.log('\n📊 Checking 7D leaderboard order...')
    const leaderboard7d = await prisma.duneLeaderboardCache.findMany({
      where: { period: '7D' },
      orderBy: { rank: 'asc' },
      take: 10
    })
    
    console.log('Top 10 entries (should be ordered by PNL descending):')
    leaderboard7d.forEach((entry, index) => {
      console.log(`  ${entry.rank}. Wallet: ${entry.walletAddress.slice(0, 8)}... | PNL: $${entry.pnlUsd.toNumber().toFixed(2)} | WinRate: ${entry.winRate?.toNumber().toFixed(1)}%`)
    })
    
    // Check if PNL is actually descending
    const pnlValues = leaderboard7d.map(entry => entry.pnlUsd.toNumber())
    const isDescending = pnlValues.every((val, i) => i === 0 || pnlValues[i-1] >= val)
    console.log(`\n🔍 PNL is properly ordered (descending): ${isDescending ? '✅ YES' : '❌ NO'}`)
    
    if (!isDescending) {
      console.log('❌ ISSUE DETECTED: PNL values are not in descending order!')
      console.log('PNL Values:', pnlValues.slice(0, 5).map(v => `$${v.toFixed(2)}`))
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
clearAndRefreshEcosystemData() 