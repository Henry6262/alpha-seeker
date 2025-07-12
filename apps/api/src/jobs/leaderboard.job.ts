import cron from 'node-cron'
import { DuneService } from '../services/dune.service.js'

/**
 * Leaderboard refresh job
 * Runs daily at 2 AM UTC to refresh all leaderboard data
 * Optimized to fetch data once per day for each timeframe
 */
export function startLeaderboardRefreshJob() {
  const duneService = new DuneService()
  
  // Run daily at 2:00 AM UTC (0 2 * * *)
  console.log('🕒 Starting daily leaderboard refresh job scheduled for 2 AM UTC')
  
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Running daily leaderboard refresh job...')
    
    try {
      // First, refresh with latest Dune data
      await duneService.bootstrapBonkLaunchpadData()
      
      // Then refresh all leaderboards with optimized timeframes
      await duneService.refreshAllLeaderboards()
      
      console.log('✅ Daily leaderboard refresh job completed successfully')
    } catch (error) {
      console.error('❌ Daily leaderboard refresh job failed:', error)
    }
  })
} 