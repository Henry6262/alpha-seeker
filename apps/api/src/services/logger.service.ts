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
  swapsDetected: number
  pnlCalculations: number
  queueDepth: {
    rawTransactions: number
    pnlUpdates: number
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success' | 'performance'

export class LoggerService {
  private static instance: LoggerService
  private transactionLifecycles = new Map<string, TransactionLifecycle>()
  private performanceMetrics: PerformanceMetrics = {
    transactionsProcessed: 0,
    transactionsPerSecond: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    swapsDetected: 0,
    pnlCalculations: 0,
    queueDepth: {
      rawTransactions: 0,
      pnlUpdates: 0
    }
  }
  
  private readonly isProduction = process.env.NODE_ENV === 'production'
  private readonly enableDebugLogs = process.env.ENABLE_DEBUG_LOGS === 'true'
  private readonly MAX_LIFECYCLE_ENTRIES = 100 // Reduced from 1000
  private lastMetricsLog = Date.now()
  private readonly METRICS_LOG_INTERVAL = 60000 // Only log metrics every minute

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService()
    }
    return LoggerService.instance
  }

  private constructor() {
    // Only start performance monitoring in development or when explicitly enabled
    if (!this.isProduction || this.enableDebugLogs) {
      setInterval(() => this.logPerformanceMetrics(), 300000) // Every 5 minutes instead of 30 seconds
    }
    
    // Cleanup old transaction lifecycles more frequently
    setInterval(() => this.cleanupOldLifecycles(), 60000) // Every minute
  }

  /**
   * High-performance logging method with production optimizations
   */
  public log(level: LogLevel, message: string, data?: any, service?: string): void {
    // Skip debug logs in production unless explicitly enabled
    if (level === 'debug' && this.isProduction && !this.enableDebugLogs) {
      return
    }
    
    // Skip verbose info logs in production
    if (level === 'info' && this.isProduction && !this.enableDebugLogs) {
      return
    }
    
    const timestamp = new Date().toISOString().slice(11, 19) // HH:mm:ss only
    const serviceTag = service ? chalk.cyan(`[${service}]`) : ''
    
    let icon = ''
    let coloredMessage = message
    
    switch (level) {
      case 'debug':
        return // Skip all debug logs for performance
      case 'info':
        if (this.isProduction) return // Skip info logs in production
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
      case 'performance':
        icon = chalk.magenta('📊')
        coloredMessage = chalk.magenta(message)
        break
    }
    
    // Simplified output format for better performance
    console.log(`${timestamp} ${icon} ${serviceTag} ${coloredMessage}`)
    
    // Only log data for errors and critical events
    if (data && (level === 'error' || level === 'warn')) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)))
    }
  }

  // Simplified convenience methods
  public debug(message: string, data?: any, service?: string): void {
    // No-op in production for maximum performance
    if (this.isProduction && !this.enableDebugLogs) return
    this.log('debug', message, data, service)
  }

  public info(message: string, data?: any, service?: string): void {
    // No-op in production for maximum performance  
    if (this.isProduction && !this.enableDebugLogs) return
    this.log('info', message, data, service)
  }

  public warn(message: string, data?: any, service?: string): void {
    this.log('warn', message, data, service)
  }

  public error(message: string, error?: any, service?: string): void {
    this.log('error', message, error, service)
  }

  public success(message: string, data?: any, service?: string): void {
    this.log('success', message, data, service)
  }

  // REMOVED: Geyser event logging (too noisy)
  // REMOVED: Detailed transaction lifecycle tracking (performance killer)
  // REMOVED: Validation failure logging (floods logs)

  /**
   * Simplified transaction tracking for critical events only
   */
  public logSwapDetected(signature: string, walletAddress: string, inputMint: string, outputMint: string): void {
    if (this.isProduction && !this.enableDebugLogs) return
    
    this.performanceMetrics.swapsDetected++
    this.log('success', `💱 KOL SWAP: ${walletAddress.slice(0, 8)}... ${inputMint.slice(0, 8)}→${outputMint.slice(0, 8)}`, null, 'SWAP')
  }

  public logPnlCalculation(walletAddress: string, pnl: number): void {
    this.performanceMetrics.pnlCalculations++
    this.log('performance', `💰 PNL: ${walletAddress.slice(0, 8)}... $${pnl.toFixed(2)}`, null, 'PNL')
  }

  public logCriticalError(message: string, error: any, service?: string): void {
    this.log('error', `🚨 CRITICAL: ${message}`, error, service)
  }

  /**
   * Streamlined performance metrics (only essentials)
   */
  private logPerformanceMetrics(): void {
    const now = Date.now()
    if (now - this.lastMetricsLog < this.METRICS_LOG_INTERVAL) {
      return // Rate limit metrics logging
    }
    
    this.lastMetricsLog = now
    
    const metrics = {
      swaps: this.performanceMetrics.swapsDetected,
      pnl: this.performanceMetrics.pnlCalculations,
      tps: this.performanceMetrics.transactionsPerSecond.toFixed(1),
      errors: this.performanceMetrics.errorRate.toFixed(2) + '%'
    }
    
    this.log('performance', `Metrics: ${JSON.stringify(metrics)}`, null, 'SYSTEM')
  }

  /**
   * Aggressive cleanup for production performance
   */
  private cleanupOldLifecycles(): void {
    if (this.transactionLifecycles.size > this.MAX_LIFECYCLE_ENTRIES) {
      const entries = Array.from(this.transactionLifecycles.keys())
      const toDelete = entries.slice(0, entries.length - this.MAX_LIFECYCLE_ENTRIES)
      toDelete.forEach(key => this.transactionLifecycles.delete(key))
    }
  }

  /**
   * Essential metrics updating (no logging overhead)
   */
  public incrementTransactionCount(): void {
    this.performanceMetrics.transactionsProcessed++
  }

  public incrementErrorCount(): void {
    this.performanceMetrics.errorRate = 
      (this.performanceMetrics.errorRate * 0.9) + 0.1 // Simple moving average
  }

  public updateQueueDepth(queueName: 'rawTransactions' | 'pnlUpdates', depth: number): void {
    this.performanceMetrics.queueDepth[queueName] = depth
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance() 