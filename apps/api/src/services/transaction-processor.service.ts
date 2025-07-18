import { Connection, PublicKey } from '@solana/web3.js'
import { MessageQueueService } from './message-queue.service.js'
import { RedisLeaderboardService } from './redis-leaderboard.service.js'
import { sseService } from './sse.service.js'
import { logger } from './logger.service.js'
import { prisma } from '../lib/prisma.js'
import { GeyserTransactionUpdate, DEX_PROGRAMS } from '../types/index.js'
import { extract } from '@jup-ag/instruction-parser'

// Simplified interfaces for high-performance processing
interface KolSwapData {
  signature: string
  walletAddress: string
  inputMint: string
  outputMint: string
  inputAmount: number
  outputAmount: number
  timestamp: Date
  slot: number
  dexProgram: string
  usdValue?: number
}

interface TokenCache {
  mint: string
  symbol: string
  name: string
  decimals: number
}

export class TransactionProcessorService {
  private messageQueue: MessageQueueService
  private redisLeaderboard: RedisLeaderboardService
  private connection: Connection
  private isProcessing = false
  
  // High-performance caches
  private kolWalletCache = new Set<string>()
  private tokenCache = new Map<string, TokenCache>()
  private priceCache = new Map<string, { price: number, timestamp: number }>()
  
  // Performance metrics
  private processedCount = 0
  private swapCount = 0
  private errorCount = 0
  private startTime = Date.now()
  
  // Processing configuration  
  private readonly BATCH_SIZE = 25 // Optimized batch size
  private readonly PRICE_CACHE_TTL = 60000 // 1 minute cache
  private processingQueue: GeyserTransactionUpdate[] = []
  private isProcessingBatch = false

  constructor() {
    this.messageQueue = new MessageQueueService()
    this.redisLeaderboard = new RedisLeaderboardService()
    
    // Use optimized RPC endpoint
    const rpcEndpoint = process.env.CHAINSTACK_RPC_ENDPOINT || 
                       'https://solana-mainnet.core.chainstack.com/b78715330157d1f67b31ade41d9f5972' ||
                       'https://api.mainnet-beta.solana.com'
    
    this.connection = new Connection(rpcEndpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 10000, // Reduced timeout
      disableRetryOnRateLimit: false
    })
  }

  public async start(): Promise<void> {
    logger.success('🚀 Starting optimized Transaction Processor...', null, 'TX-PROCESSOR')
    
    try {
      // Initialize caches first
      await this.initializeCaches()
      
      // Start core services
      await this.messageQueue.start()
      await this.redisLeaderboard.start()
      await sseService.start()
      
      // Subscribe to optimized queue
      await this.subscribeToOptimizedQueue()
      
      this.isProcessing = true
      
      logger.success('✅ Optimized Transaction Processor started', {
        kolWallets: this.kolWalletCache.size,
        cachedTokens: this.tokenCache.size,
        batchSize: this.BATCH_SIZE
      }, 'TX-PROCESSOR')
      
    } catch (error) {
      logger.logCriticalError('Failed to start Transaction Processor', error, 'TX-PROCESSOR')
      throw error
    }
  }

  private async initializeCaches(): Promise<void> {
    logger.info('⚡ Initializing performance caches...', null, 'TX-PROCESSOR')
    
    try {
      // Load KOL wallets into memory for ultra-fast lookup
      const kolWallets = await prisma.kolWallet.findMany({
        select: { address: true }
      })
      
      this.kolWalletCache = new Set(kolWallets.map(w => w.address))
      
      // Load common tokens into cache
      const tokens = await prisma.token.findMany({
        select: {
          mintAddress: true,
          symbol: true,
          name: true,
          decimals: true
        },
        take: 1000 // Cache top 1000 tokens
      })
      
      tokens.forEach(token => {
        this.tokenCache.set(token.mintAddress, {
          mint: token.mintAddress,
          symbol: token.symbol || 'UNKNOWN',
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 9
        })
      })
      
      logger.success(`⚡ Caches initialized: ${this.kolWalletCache.size} KOL wallets, ${this.tokenCache.size} tokens`, null, 'TX-PROCESSOR')
      
    } catch (error) {
      logger.logCriticalError('Failed to initialize caches', error, 'TX-PROCESSOR')
      throw error
    }
  }

  private async subscribeToOptimizedQueue(): Promise<void> {
    logger.info('📡 Subscribing to optimized transaction queue...', null, 'TX-PROCESSOR')
    
    // Subscribe to filtered transactions
    await this.messageQueue.subscribe('raw-transactions', async (messageData: any) => {
      if (!this.isProcessing) return
      
      try {
        const transactionData: GeyserTransactionUpdate = messageData.payload || messageData
        
        // Quick validation
        if (!transactionData.signature) {
          return // Skip invalid transactions silently
        }
        
        // Add to batch processing queue
        this.processingQueue.push(transactionData)
        
        // Process batch when ready
        if (this.processingQueue.length >= this.BATCH_SIZE && !this.isProcessingBatch) {
          await this.processBatch()
        }
        
      } catch (error) {
        this.errorCount++
        // Silent error handling for performance
      }
    })
    
    // Start periodic batch processing for smaller batches
    setInterval(async () => {
      if (this.processingQueue.length > 0 && !this.isProcessingBatch) {
        await this.processBatch()
      }
    }, 2000) // Process every 2 seconds
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessingBatch || this.processingQueue.length === 0) return
    
    this.isProcessingBatch = true
    const batch = this.processingQueue.splice(0, this.BATCH_SIZE)
    
    try {
      const kolSwaps: KolSwapData[] = []
      
      // Process transactions in parallel
      await Promise.allSettled(
        batch.map(async (txData) => {
          const swap = await this.processOptimizedTransaction(txData)
          if (swap) {
            kolSwaps.push(swap)
          }
        })
      )
      
      // Batch database operations
      if (kolSwaps.length > 0) {
        await this.batchInsertSwaps(kolSwaps)
        
        // Update metrics
        this.swapCount += kolSwaps.length
        
        // Log significant batches only
        if (kolSwaps.length >= 5) {
          logger.success(`💱 Processed ${kolSwaps.length} KOL swaps in batch`, null, 'TX-PROCESSOR')
        }
      }
      
      this.processedCount += batch.length
      
    } catch (error) {
      logger.logCriticalError('Batch processing failed', error, 'TX-PROCESSOR')
      this.errorCount++
    } finally {
      this.isProcessingBatch = false
    }
  }

  private async processOptimizedTransaction(txData: GeyserTransactionUpdate): Promise<KolSwapData | null> {
    try {
      // Quick KOL wallet check
      const kolWallet = this.findKolWalletInTransaction(txData)
      if (!kolWallet) {
        return null // Not a KOL transaction
      }
      
      // Parse swap instruction efficiently
      const swapData = await this.parseSwapInstruction(txData)
      if (!swapData) {
        return null // Not a swap transaction
      }
      
      // Enrich with USD value (cached)
      const usdValue = await this.getUsdValue(swapData.outputMint, swapData.outputAmount)
      
      return {
        signature: txData.signature,
        walletAddress: kolWallet,
        inputMint: swapData.inputMint,
        outputMint: swapData.outputMint,
        inputAmount: swapData.inputAmount,
        outputAmount: swapData.outputAmount,
        timestamp: txData.blockTime,
        slot: txData.slot,
        dexProgram: swapData.dexProgram,
        usdValue
      }
      
    } catch (error) {
      // Silent error handling for performance
      return null
    }
  }

  private findKolWalletInTransaction(txData: GeyserTransactionUpdate): string | null {
    // Ultra-fast KOL wallet lookup using Set
    for (const account of txData.accounts) {
      if (this.kolWalletCache.has(account)) {
        return account
      }
    }
    return null
  }

     private async parseSwapInstruction(txData: GeyserTransactionUpdate): Promise<{
     inputMint: string
     outputMint: string
     inputAmount: number
     outputAmount: number
     dexProgram: string
   } | null> {
     try {
       // CRITICAL FIX: Actually parse transactions instead of returning null
       logger.debug(`🔍 Parsing transaction ${txData.signature.slice(0, 8)}...`, null, 'TX-PARSER')
       
       if (!txData.signature) {
         logger.warn('❌ Transaction missing signature', null, 'TX-PARSER')
         return null
       }
       
       // Get full transaction details from RPC
       const txDetails = await this.connection.getParsedTransaction(txData.signature, {
         maxSupportedTransactionVersion: 0
       })
       
       if (!txDetails || !txDetails.meta || txDetails.meta.err) {
         logger.debug(`⚠️ Transaction ${txData.signature.slice(0, 8)}... failed or not found`, null, 'TX-PARSER')
         return null
       }
       
       // Analyze token balance changes to detect swaps
       const preBalances = txDetails.meta.preTokenBalances || []
       const postBalances = txDetails.meta.postTokenBalances || []
       
       // Find the KOL wallet involved in this transaction
       const accountKeys = txDetails.transaction.message.accountKeys.map((key: any) => 
         typeof key === 'string' ? key : key.pubkey.toString()
       )
       
       let kolWallet = null
       for (const addr of accountKeys) {
         if (this.kolWalletCache.has(addr)) {
           kolWallet = addr
           break
         }
       }
       
       if (!kolWallet) {
         logger.debug(`⚠️ No KOL wallet found in transaction ${txData.signature.slice(0, 8)}...`, null, 'TX-PARSER')
         return null
       }
       
       logger.success(`🎯 Found KOL wallet ${kolWallet.slice(0, 8)}... in transaction ${txData.signature.slice(0, 8)}...`, null, 'TX-PARSER')
       
       // Analyze balance changes for this wallet
       const walletPreBalances = preBalances.filter((b: any) => b.owner === kolWallet)
       const walletPostBalances = postBalances.filter((b: any) => b.owner === kolWallet)
       
       let inputMint = ''
       let outputMint = ''
       let inputAmount = 0
       let outputAmount = 0
       
               // Find input token (balance decreased)
        for (const preBal of walletPreBalances) {
          const postBal = walletPostBalances.find((p: any) => p.mint === preBal.mint)
          
          const preAmount = preBal.uiTokenAmount?.uiAmount || 0
          const postAmount = postBal?.uiTokenAmount?.uiAmount || 0
          
          if (postBal && postAmount < preAmount && preAmount > 0) {
            inputMint = preBal.mint
            inputAmount = preAmount - postAmount
            break
          }
        }
        
        // Find output token (balance increased)
        for (const postBal of walletPostBalances) {
          const preBal = walletPreBalances.find((p: any) => p.mint === postBal.mint)
          
          const postAmount = postBal.uiTokenAmount?.uiAmount || 0
          const preAmount = preBal?.uiTokenAmount?.uiAmount || 0
          
          if (postAmount > preAmount && postAmount > 0) {
            outputMint = postBal.mint
            outputAmount = postAmount - preAmount
            break
          }
        }
       
       if (!inputMint || !outputMint || inputAmount <= 0 || outputAmount <= 0) {
         logger.debug(`⚠️ Could not identify swap pattern in ${txData.signature.slice(0, 8)}...`, {
           inputMint: inputMint || 'none',
           outputMint: outputMint || 'none',
           inputAmount,
           outputAmount
         }, 'TX-PARSER')
         return null
       }
       
       // Determine DEX program
       let dexProgram = 'Unknown'
       const knownDexPrograms = {
         'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
         '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
         '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun'
       }
       
       for (const addr of accountKeys) {
         if (knownDexPrograms[addr as keyof typeof knownDexPrograms]) {
           dexProgram = knownDexPrograms[addr as keyof typeof knownDexPrograms]
           break
         }
       }
       
       const result = {
         inputMint,
         outputMint,
         inputAmount,
         outputAmount,
         dexProgram
       }
       
       logger.success(`💱 SWAP DETECTED: ${kolWallet.slice(0, 8)}... ${inputAmount.toFixed(4)} ${inputMint.slice(0, 8)}... → ${outputAmount.toFixed(4)} ${outputMint.slice(0, 8)}... on ${dexProgram}`, result, 'SWAP-DETECTED')
       
       return result
       
     } catch (error) {
       logger.error(`❌ Error parsing transaction ${txData.signature}`, error, 'TX-PARSER')
       return null
     }
   }

  private async getUsdValue(tokenMint: string, amount: number): Promise<number | undefined> {
    try {
      // Check cache first
      const cached = this.priceCache.get(tokenMint)
      if (cached && (Date.now() - cached.timestamp) < this.PRICE_CACHE_TTL) {
        return cached.price * amount
      }
      
      // For performance, only fetch prices for known tokens
      const tokenData = this.tokenCache.get(tokenMint)
      if (!tokenData) {
        return undefined
      }
      
      // Simplified price fetching (you can implement actual price API here)
      // For now, return undefined to avoid external API calls that slow down processing
      return undefined
      
    } catch (error) {
      return undefined
    }
  }

  private async batchInsertSwaps(swaps: KolSwapData[]): Promise<void> {
    try {
      // Build optimized batch insert query
      const insertData = swaps.map(swap => ({
        signature: swap.signature,
        blockTime: swap.timestamp,
        slot: BigInt(swap.slot),
        kolAddress: swap.walletAddress,
        feeLamports: BigInt(0), // Default fee
        wasSuccessful: true,
        programIds: [swap.dexProgram],
        computeUnits: null,
        metadataJson: {
          swapData: {
            inputMint: swap.inputMint,
            outputMint: swap.outputMint,
            inputAmount: swap.inputAmount,
            outputAmount: swap.outputAmount,
            usdValue: swap.usdValue
          }
        }
      }))
      
      // Use upsert for performance
      await prisma.$transaction(async (tx) => {
        for (const data of insertData) {
          await tx.kolTransaction.upsert({
            where: { signature: data.signature },
            update: data,
            create: data
          })
        }
      })
      
      // Update leaderboard asynchronously
      this.updateLeaderboardAsync(swaps)
      
    } catch (error) {
      logger.logCriticalError('Failed to batch insert swaps', error, 'TX-PROCESSOR')
      throw error
    }
  }

  private async updateLeaderboardAsync(swaps: KolSwapData[]): Promise<void> {
    // Group swaps by wallet for efficient leaderboard updates
    const walletSwaps = new Map<string, KolSwapData[]>()
    
    swaps.forEach(swap => {
      if (!walletSwaps.has(swap.walletAddress)) {
        walletSwaps.set(swap.walletAddress, [])
      }
      walletSwaps.get(swap.walletAddress)!.push(swap)
    })
    
    // Update each wallet's leaderboard position
    for (const [walletAddress, walletSwapData] of walletSwaps) {
      try {
        const totalUsdValue = walletSwapData.reduce((sum, swap) => sum + (swap.usdValue || 0), 0)
        
                 if (totalUsdValue > 0) {
           await this.redisLeaderboard.updateWalletPnl(walletAddress, totalUsdValue, ['1d'])
           logger.logPnlCalculation(walletAddress, totalUsdValue)
         }
        
      } catch (error) {
        // Silent error handling for async updates
      }
    }
  }

  public getStatus() {
    const uptime = (Date.now() - this.startTime) / 1000
    const tps = this.processedCount / uptime
    const swapRate = this.swapCount / uptime
    const errorRate = this.processedCount > 0 ? (this.errorCount / this.processedCount * 100) : 0
    
    return {
      isProcessing: this.isProcessing,
      performance: {
        processed: this.processedCount,
        swaps: this.swapCount,
        errors: this.errorCount,
        transactionsPerSecond: parseFloat(tps.toFixed(2)),
        swapsPerSecond: parseFloat(swapRate.toFixed(2)),
        errorRate: parseFloat(errorRate.toFixed(2)),
        uptime: parseFloat(uptime.toFixed(2))
      },
      caches: {
        kolWallets: this.kolWalletCache.size,
        tokens: this.tokenCache.size,
        prices: this.priceCache.size
      },
      queue: {
        pending: this.processingQueue.length,
        batchSize: this.BATCH_SIZE,
        isProcessingBatch: this.isProcessingBatch
      }
    }
  }

  public stop(): void {
    logger.warn('🛑 Stopping Transaction Processor...', null, 'TX-PROCESSOR')
    this.isProcessing = false
    
    // Process remaining queue
    if (this.processingQueue.length > 0) {
      logger.info(`Processing final ${this.processingQueue.length} transactions...`, null, 'TX-PROCESSOR')
      this.processBatch().catch(() => {}) // Silent cleanup
    }
    
    logger.success('✅ Transaction Processor stopped', null, 'TX-PROCESSOR')
  }
}

// Export singleton instance
export const transactionProcessorService = new TransactionProcessorService() 