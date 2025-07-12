import * as cron from 'node-cron'
import { DuneService } from '../services/dune.service'

const duneService = new DuneService()

// Refresh leaderboards every 5 minutes for development (every hour in production)
const schedule = process.env.NODE_ENV === 'production' ? '0 * * * *' : '*/5 * * * *'

export function startLeaderboardJob() {
  console.log(`🕒 Starting leaderboard refresh job with schedule: ${schedule}`)
  
  cron.schedule(schedule, async () => {
    console.log('⏰ Running leaderboard refresh job...')
    try {
      await duneService.refreshAllLeaderboards()
      console.log('✅ Leaderboard refresh job completed successfully')
    } catch (error) {
      console.error('❌ Leaderboard refresh job failed:', error)
    }
  })

  // Run once on startup
  duneService.refreshAllLeaderboards().catch(error => {
    console.error('❌ Initial leaderboard refresh failed:', error)
  })
} 