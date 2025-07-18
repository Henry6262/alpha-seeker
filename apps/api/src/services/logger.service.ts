import chalk from 'chalk'

export interface TransactionLifecycle {
  signature: string
  walletAddress: string
  startTime: number
  stages: {
    [stage: string]: {
      timestamp: number
      duration?: number
      status: 'pending' | 'success' | 'error' | 'skipped'
      details?: any
      error?: string
    }
  }
}

export interface PerformanceMetrics {
  transactionsProcessed: number
  transactionsPerSecond: number
  averageProcessingTime: number
  errorRate: number
  geyserMessages: number
  pnlCalculations: number
  sseUpdates: number
  queueDepth: {
    rawTransactions: number
    pnlUpdates: number
    feedUpdates: number
    gemDiscovery: number
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success' | 'transaction' | 'performance'

export class LoggerService {
  private static instance: LoggerService
  private transactionLifecycles = new Map<string, TransactionLifecycle>()
  private performanceMetrics: PerformanceMetrics = {
    transactionsProcessed: 0,
    transactionsPerSecond: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    geyserMessages: 0,
    pnlCalculations: 0,
    sseUpdates: 0,
    queueDepth: {
      rawTransactions: 0,
      pnlUpdates: 0,
      feedUpdates: 0,
      gemDiscovery: 0
    }
  }
  private readonly MAX_LIFECYCLE_ENTRIES = 1000
  private readonly PERFORMANCE_RESET_INTERVAL = 60000 // 1 minute
  private lastMetricsReset = Date.now()

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService()
    }
    return LoggerService.instance
  }

  private constructor() {
    // Start performance monitoring
    setInterval(() => this.logPerformanceMetrics(), 30000) // Every 30 seconds
    
    // Cleanup old transaction lifecycles
    setInterval(() => this.cleanupOldLifecycles(), 120000) // Every 2 minutes
  }

  /**
   * Main logging method with visual formatting
   */
  public log(level: LogLevel, message: string, data?: any, service?: string): void {
    const timestamp = new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
    const serviceTag = service ? chalk.cyan(`[${service}]`) : ''
    
    let icon = ''
    let coloredMessage = message
    
    switch (level) {
      case 'debug':
        icon = chalk.gray('🔍')
        coloredMessage = chalk.gray(message)
        break
      case 'info':
        icon = chalk.blue('ℹ️')
        coloredMessage = chalk.white(message)
        break
      case 'warn':
        icon = chalk.yellow('⚠️')
        coloredMessage = chalk.yellow(message)
        break
      case 'error':
        icon = chalk.red('❌')
        coloredMessage = chalk.red(message)
        break
      case 'success':
        icon = chalk.green('✅')
        coloredMessage = chalk.green(message)
        break
      case 'transaction':
        icon = chalk.magenta('💱')
        coloredMessage = chalk.magenta(message)
        break
      case 'performance':
        icon = chalk.cyan('📊')
        coloredMessage = chalk.cyan(message)
        break
    }

    const logLine = `${chalk.gray(timestamp)} ${icon} ${serviceTag} ${coloredMessage}`
    console.log(logLine)
    
    if (data) {
      console.log(chalk.gray('    └─'), JSON.stringify(data, null, 2).split('\n').join('\n       '))
    }
  }

  /**
   * Start tracking a transaction lifecycle
   */
  public startTransaction(signature: string, walletAddress: string): void {
    // Prevent memory growth by limiting entries
    if (this.transactionLifecycles.size >= this.MAX_LIFECYCLE_ENTRIES) {
      const oldestKey = this.transactionLifecycles.keys().next().value
      if (oldestKey) {
        this.transactionLifecycles.delete(oldestKey)
      }
    }

    this.transactionLifecycles.set(signature, {
      signature,
      walletAddress,
      startTime: Date.now(),
      stages: {}
    })

    this.log('transaction', 
      `Started tracking ${chalk.bold(signature.slice(0, 8))}... for wallet ${chalk.blue(walletAddress.slice(0, 8))}...`,
      null, 'LIFECYCLE'
    )
  }

  /**
   * Update transaction stage
   */
  public updateTransactionStage(
    signature: string, 
    stage: string, 
    status: 'pending' | 'success' | 'error' | 'skipped',
    details?: any,
    error?: string
  ): void {
    const lifecycle = this.transactionLifecycles.get(signature)
    if (!lifecycle) return

    const now = Date.now()
    const duration = now - lifecycle.startTime

    // Calculate stage duration from previous stage or start
    const previousStages = Object.keys(lifecycle.stages)
    const lastStageTime = previousStages.length > 0 
      ? Math.max(...previousStages.map(s => lifecycle.stages[s]?.timestamp || lifecycle.startTime))
      : lifecycle.startTime
    const stageDuration = now - lastStageTime

    lifecycle.stages[stage] = {
      timestamp: now,
      duration: stageDuration,
      status,
      details,
      error
    }

    // Visual stage update
    let statusIcon = ''
    let statusColor = chalk.white
    
    switch (status) {
      case 'pending':
        statusIcon = '⏳'
        statusColor = chalk.yellow
        break
      case 'success':
        statusIcon = '✅'
        statusColor = chalk.green
        break
      case 'error':
        statusIcon = '❌'
        statusColor = chalk.red
        break
      case 'skipped':
        statusIcon = '⏭️'
        statusColor = chalk.gray
        break
    }

    this.log('transaction',
      `${statusIcon} ${chalk.bold(signature.slice(0, 8))}... │ ${statusColor(stage)} ${chalk.gray(`(${stageDuration}ms)`)}`,
      status === 'error' ? { error, details } : details,
      'LIFECYCLE'
    )

    // Update metrics
    if (status === 'error') {
      this.performanceMetrics.errorRate++
    }
  }

  /**
   * Complete transaction processing
   */
  public completeTransaction(signature: string, success: boolean = true): void {
    const lifecycle = this.transactionLifecycles.get(signature)
    if (!lifecycle) return

    const totalDuration = Date.now() - lifecycle.startTime
    const stages = Object.keys(lifecycle.stages).length

    // Update performance metrics
    this.performanceMetrics.transactionsProcessed++
    this.updateAverageProcessingTime(totalDuration)

    const statusIcon = success ? '🎉' : '💥'
    const statusColor = success ? chalk.green : chalk.red
    
    this.log('transaction',
      `${statusIcon} ${chalk.bold(signature.slice(0, 8))}... │ ${statusColor('COMPLETED')} │ ${stages} stages │ ${chalk.gray(`${totalDuration}ms total`)}`,
      null, 'LIFECYCLE'
    )

    // Optional: Remove completed transaction from memory
    this.transactionLifecycles.delete(signature)
  }

  /**
   * Log DEX swap details
   */
  public logSwap(
    signature: string,
    inputToken: string,
    outputToken: string, 
    inputAmount: number,
    outputAmount: number,
    usdValue: number,
    dex: string
  ): void {
    this.log('transaction',
      `💱 ${chalk.bold(signature.slice(0, 8))}... │ ${chalk.green(dex)} │ ${inputAmount.toFixed(4)} ${inputToken} → ${outputAmount.toFixed(4)} ${outputToken} │ ${chalk.yellow(`$${usdValue.toFixed(2)}`)}`,
      null, 'SWAP'
    )
  }

  /**
   * Log PNL calculation
   */
  public logPnl(
    walletAddress: string,
    tokenSymbol: string,
    type: 'buy' | 'sell' | 'swap',
    realizedPnl: number,
    unrealizedPnl: number,
    totalPnl: number
  ): void {
    const pnlIcon = realizedPnl >= 0 ? '📈' : '📉'
    const pnlColor = realizedPnl >= 0 ? chalk.green : chalk.red
    
    this.log('success',
      `${pnlIcon} ${chalk.blue(walletAddress.slice(0, 8))}... │ ${type.toUpperCase()} ${tokenSymbol} │ Realized: ${pnlColor(`$${realizedPnl.toFixed(2)}`)} │ Total: ${pnlColor(`$${totalPnl.toFixed(2)}`)}`,
      null, 'PNL'
    )

    this.performanceMetrics.pnlCalculations++
  }

  /**
   * Log validation failures with detailed reasons
   */
  public logValidationFailure(
    signature: string,
    reason: string,
    details?: any
  ): void {
    this.log('warn',
      `⚠️ ${chalk.bold(signature.slice(0, 8))}... │ VALIDATION FAILED │ ${reason}`,
      details, 'VALIDATION'
    )
  }

  /**
   * Log queue status
   */
  public logQueueStatus(queueName: string, depth: number, processing: boolean = false): void {
    const icon = processing ? '🔄' : depth > 0 ? '📦' : '📭'
    const color = depth > 100 ? chalk.red : depth > 50 ? chalk.yellow : chalk.green
    
    this.log('info',
      `${icon} Queue ${chalk.bold(queueName)} │ ${color(`${depth} messages`)} ${processing ? '│ PROCESSING' : ''}`,
      null, 'QUEUE'
    )

    // Update queue depth metrics
    if (queueName === 'raw-transactions') this.performanceMetrics.queueDepth.rawTransactions = depth
    if (queueName === 'pnl-updates') this.performanceMetrics.queueDepth.pnlUpdates = depth
    if (queueName === 'feed-updates') this.performanceMetrics.queueDepth.feedUpdates = depth
    if (queueName === 'gem-discovery') this.performanceMetrics.queueDepth.gemDiscovery = depth
  }

  /**
   * Log SSE updates
   */
  public logSSEUpdate(channel: string, eventType: string, recipients: number): void {
    this.log('info',
      `📡 SSE │ ${chalk.magenta(channel)} │ ${eventType} │ ${chalk.cyan(`${recipients} recipients`)}`,
      null, 'SSE'
    )

    this.performanceMetrics.sseUpdates++
  }

  /**
   * Log Geyser stream events
   */
  public logGeyserEvent(streamId: string, eventType: 'transaction' | 'account', signature?: string): void {
    const icon = eventType === 'transaction' ? '📨' : '📊'
    
    this.log('debug',
      `${icon} Geyser ${chalk.blue(streamId)} │ ${eventType.toUpperCase()} ${signature ? `│ ${signature.slice(0, 8)}...` : ''}`,
      null, 'GEYSER'
    )

    this.performanceMetrics.geyserMessages++
  }

  /**
   * Display comprehensive performance metrics
   */
  private logPerformanceMetrics(): void {
    const now = Date.now()
    const timeSinceReset = now - this.lastMetricsReset
    const tps = this.performanceMetrics.transactionsProcessed / (timeSinceReset / 1000)
    
    console.log(chalk.cyan('\n' + '═'.repeat(80)))
    console.log(chalk.cyan.bold('                    🚀 ALPHA SEEKER PERFORMANCE DASHBOARD 🚀'))
    console.log(chalk.cyan('═'.repeat(80)))
    
    // Transaction metrics
    console.log(chalk.white.bold('📊 TRANSACTION PROCESSING'))
    console.log(`   ├─ Processed: ${chalk.green(this.performanceMetrics.transactionsProcessed.toLocaleString())} transactions`)
    console.log(`   ├─ Speed: ${chalk.yellow(tps.toFixed(2))} TPS`)
    console.log(`   ├─ Avg Time: ${chalk.blue(this.performanceMetrics.averageProcessingTime.toFixed(0))}ms`)
    console.log(`   └─ Error Rate: ${chalk.red(this.performanceMetrics.errorRate.toLocaleString())} errors`)
    
    // Pipeline metrics
    console.log(chalk.white.bold('\n🔄 PIPELINE ACTIVITY'))
    console.log(`   ├─ Geyser Messages: ${chalk.cyan(this.performanceMetrics.geyserMessages.toLocaleString())}`)
    console.log(`   ├─ PNL Calculations: ${chalk.green(this.performanceMetrics.pnlCalculations.toLocaleString())}`)
    console.log(`   └─ SSE Updates: ${chalk.magenta(this.performanceMetrics.sseUpdates.toLocaleString())}`)
    
    // Queue status
    console.log(chalk.white.bold('\n📦 QUEUE STATUS'))
    console.log(`   ├─ Raw Transactions: ${this.getQueueStatusColor(this.performanceMetrics.queueDepth.rawTransactions)}`)
    console.log(`   ├─ PNL Updates: ${this.getQueueStatusColor(this.performanceMetrics.queueDepth.pnlUpdates)}`)
    console.log(`   ├─ Feed Updates: ${this.getQueueStatusColor(this.performanceMetrics.queueDepth.feedUpdates)}`)
    console.log(`   └─ Gem Discovery: ${this.getQueueStatusColor(this.performanceMetrics.queueDepth.gemDiscovery)}`)
    
    // Active lifecycles
    console.log(chalk.white.bold('\n🔍 ACTIVE PROCESSING'))
    console.log(`   └─ Tracking: ${chalk.blue(this.transactionLifecycles.size)} active transactions`)
    
    console.log(chalk.cyan('═'.repeat(80) + '\n'))
  }

  private getQueueStatusColor(depth: number): string {
    if (depth > 100) return chalk.red(`${depth} messages (HIGH)`)
    if (depth > 50) return chalk.yellow(`${depth} messages (MEDIUM)`)
    if (depth > 0) return chalk.green(`${depth} messages (LOW)`)
    return chalk.gray(`${depth} messages (EMPTY)`)
  }

  private updateAverageProcessingTime(newTime: number): void {
    const count = this.performanceMetrics.transactionsProcessed
    const currentAvg = this.performanceMetrics.averageProcessingTime
    this.performanceMetrics.averageProcessingTime = ((currentAvg * (count - 1)) + newTime) / count
  }

  private cleanupOldLifecycles(): void {
    const cutoffTime = Date.now() - 300000 // 5 minutes
    let cleanedCount = 0
    
    for (const [signature, lifecycle] of this.transactionLifecycles.entries()) {
      if (lifecycle.startTime < cutoffTime) {
        this.transactionLifecycles.delete(signature)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.log('debug', `Cleaned up ${cleanedCount} old transaction lifecycles`, null, 'CLEANUP')
    }
  }

  /**
   * Convenience methods for different log levels
   */
  public debug(message: string, data?: any, service?: string): void {
    this.log('debug', message, data, service)
  }

  public info(message: string, data?: any, service?: string): void {
    this.log('info', message, data, service)
  }

  public warn(message: string, data?: any, service?: string): void {
    this.log('warn', message, data, service)
  }

  public error(message: string, data?: any, service?: string): void {
    this.log('error', message, data, service)
  }

  public success(message: string, data?: any, service?: string): void {
    this.log('success', message, data, service)
  }

  public transaction(message: string, data?: any, service?: string): void {
    this.log('transaction', message, data, service)
  }

  public performance(message: string, data?: any, service?: string): void {
    this.log('performance', message, data, service)
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance() 