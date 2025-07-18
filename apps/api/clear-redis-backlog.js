#!/usr/bin/env node

import Redis from 'redis';
import chalk from 'chalk';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function clearRedisBacklog() {
  console.log(chalk.blue('🧹 Alpha Seeker Redis Backlog Cleaner'));
  console.log(chalk.gray('─'.repeat(50)));

  const redis = Redis.createClient({ url: REDIS_URL });
  
  try {
    await redis.connect();
    console.log(chalk.green('✅ Connected to Redis'));

    // Get initial stats
    const info = await redis.info('memory');
    const memoryUsed = info.match(/used_memory_human:(.+)/)?.[1]?.trim();
    console.log(chalk.blue(`📊 Current Redis Memory: ${memoryUsed}`));

    // Define all possible queue keys that might have backlog
    const queueKeys = [
      'raw-transactions',        // Main transaction queue
      'parsed-transactions',     // Processed transactions
      'pnl-calculations',        // PNL calculation queue
      'leaderboard-updates',     // Leaderboard update queue
      'token-metadata',          // Token metadata queue
      'price-updates',           // Price update queue
      'wallet-tracking',         // Wallet tracking queue
      'gem-finder',              // Gem finder queue
      'sse-updates',             // SSE broadcast queue
      'geyser-messages',         // Geyser message queue
      'transaction-validation',  // Transaction validation queue
      'metadata-enrichment',     // Metadata enrichment queue
      'database-writes',         // Database write queue
      'error-handling',          // Error handling queue
      'retry-queue',             // Retry queue
      'dead-letter-queue'        // Dead letter queue
    ];

    let totalDeleted = 0;
    let queuesCleared = 0;

    console.log(chalk.yellow('🔍 Scanning for queues with backlog...'));

    for (const queueKey of queueKeys) {
      try {
        // Check both list and stream versions
        const listLength = await redis.lLen(queueKey);
        const streamLength = await redis.xLen(`${queueKey}:stream`).catch(() => 0);
        
        if (listLength > 0) {
          console.log(chalk.red(`📦 Found ${listLength.toLocaleString()} messages in ${queueKey}`));
          await redis.del(queueKey);
          totalDeleted += listLength;
          queuesCleared++;
          console.log(chalk.green(`✅ Cleared ${queueKey} list`));
        }

        if (streamLength > 0) {
          console.log(chalk.red(`📦 Found ${streamLength.toLocaleString()} messages in ${queueKey}:stream`));
          await redis.del(`${queueKey}:stream`);
          totalDeleted += streamLength;
          queuesCleared++;
          console.log(chalk.green(`✅ Cleared ${queueKey}:stream`));
        }

        // Also clear any consumer groups
        try {
          await redis.del(`${queueKey}:consumers`);
          await redis.del(`${queueKey}:processing`);
          await redis.del(`${queueKey}:failed`);
        } catch (e) {
          // Ignore if these don't exist
        }

      } catch (error) {
        // Queue doesn't exist, skip
      }
    }

    // Clear any pattern-based keys
    console.log(chalk.yellow('🔍 Scanning for pattern-based queue keys...'));
    
    const patterns = [
      'queue:*',
      'bull:*',
      'worker:*',
      'job:*',
      'processing:*',
      'failed:*',
      'completed:*',
      'delayed:*'
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        console.log(chalk.red(`📦 Found ${keys.length} keys matching ${pattern}`));
        await redis.del(...keys);
        totalDeleted += keys.length;
        queuesCleared++;
        console.log(chalk.green(`✅ Cleared ${keys.length} keys matching ${pattern}`));
      }
    }

    // Clear any remaining cache/temporary data
    console.log(chalk.yellow('🔍 Clearing cache and temporary data...'));
    
    const cachePatterns = [
      'cache:*',
      'temp:*',
      'session:*',
      'lock:*',
      'semaphore:*'
    ];

    for (const pattern of cachePatterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(chalk.green(`✅ Cleared ${keys.length} cache keys matching ${pattern}`));
      }
    }

    // Get final stats
    const finalInfo = await redis.info('memory');
    const finalMemoryUsed = finalInfo.match(/used_memory_human:(.+)/)?.[1]?.trim();

    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('🎉 Redis Backlog Cleanup Complete!'));
    console.log(chalk.blue(`📊 Total Messages Deleted: ${totalDeleted.toLocaleString()}`));
    console.log(chalk.blue(`📦 Queues Cleared: ${queuesCleared}`));
    console.log(chalk.blue(`💾 Memory Before: ${memoryUsed}`));
    console.log(chalk.blue(`💾 Memory After: ${finalMemoryUsed}`));
    console.log(chalk.gray('─'.repeat(50)));

    if (totalDeleted > 0) {
      console.log(chalk.green('✅ System is now ready for fresh data ingestion!'));
      console.log(chalk.yellow('💡 Restart your API server to begin clean processing'));
    } else {
      console.log(chalk.blue('ℹ️  No backlog found - Redis was already clean'));
    }

  } catch (error) {
    console.error(chalk.red('❌ Error clearing Redis backlog:'), error);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

// Run the cleanup
clearRedisBacklog().catch(console.error); 