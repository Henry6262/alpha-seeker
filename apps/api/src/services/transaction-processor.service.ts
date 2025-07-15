import { Connection, PublicKey, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js'
import { MessageQueueService } from './message-queue.service.js'
import { RedisLeaderboardService } from './redis-leaderboard.service.js'
import { SSEService } from './sse.service.js'
import { prisma } from '../lib/prisma.js'
import { GeyserTransactionUpdate, DEX_PROGRAMS } from '../types/index.js'

interface SwapData {
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

interface TokenMetadata {
  mint: string
  name: string
  symbol: string
  decimals: number
  logoUri?: string
  [key: string]: any // Index signature for Prisma JSON compatibility
}

interface PnlUpdate {
  walletAddress: string
  tokenMint: string
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
}

export class TransactionProcessorService {
  private messageQueue: MessageQueueService
  private redisLeaderboard: RedisLeaderboardService
  private sseService: SSEService
  private connection: Connection
  private isProcessing = false
  private processedCount = 0
  private errorCount = 0

  // Token metadata cache
  private tokenCache = new Map<string, TokenMetadata>()
  
  // Price cache (simple in-memory cache for now)
  private priceCache = new Map<string, { price: number, timestamp: number }>()
  private readonly PRICE_CACHE_TTL = 60000 // 1 minute

  constructor() {
    this.messageQueue = new MessageQueueService()
    this.redisLeaderboard = new RedisLeaderboardService()
    this.sseService = new SSEService()
    
    // Use public RPC for now (can be upgraded to paid RPC later)
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting Transaction Processor service...')
    
    try {
      // Initialize dependencies
      await this.messageQueue.start()
      await this.redisLeaderboard.start()
      await this.sseService.start()
      
      // Subscribe to transaction queue
      await this.subscribeToTransactionQueue()
      
      this.isProcessing = true
      
      // Start periodic token metadata refresh
      this.startTokenMetadataRefresh()
      
      console.log('✅ Transaction Processor service started successfully')
      
    } catch (error) {
      console.error('❌ Failed to start Transaction Processor service:', error)
      throw error
    }
  }

  private async subscribeToTransactionQueue(): Promise<void> {
    console.log('📥 Subscribing to raw transaction queue...')
    
    await this.messageQueue.subscribe('raw-transactions', async (transactionData: GeyserTransactionUpdate) => {
      if (!this.isProcessing) return
      
      try {
        await this.processTransaction(transactionData)
        this.processedCount++
        
        if (this.processedCount % 100 === 0) {
          console.log(`📊 Processed ${this.processedCount} transactions (${this.errorCount} errors)`)
        }
        
      } catch (error) {
        this.errorCount++
        console.error('❌ Error processing transaction:', error)
      }
    })
  }

  private async processTransaction(txUpdate: GeyserTransactionUpdate): Promise<void> {
    try {
      // Parse transaction for DEX swaps
      const swaps = await this.parseTransactionForSwaps(txUpdate)
      
      if (swaps.length === 0) {
        return // No swaps found, skip processing
      }
      
      console.log(`🔍 Found ${swaps.length} swaps in transaction ${txUpdate.signature.slice(0, 8)}...`)
      
      // Process each swap
      for (const swap of swaps) {
        await this.processSwap(swap)
      }
      
    } catch (error) {
      console.error(`❌ Error processing transaction ${txUpdate.signature}:`, error)
      throw error
    }
  }

  private async parseTransactionForSwaps(txUpdate: GeyserTransactionUpdate): Promise<SwapData[]> {
    const swaps: SwapData[] = []
    
    try {
      // Get transaction details from Solana RPC
      const txDetails = await this.connection.getParsedTransaction(txUpdate.signature, {
        maxSupportedTransactionVersion: 0
      })
      
      if (!txDetails || !txDetails.meta || txDetails.meta.err) {
        return swaps // Transaction failed or not found
      }
      
      const { transaction, meta } = txDetails
      const accountKeys = transaction.message.accountKeys.map(key => 
        typeof key === 'string' ? key : key.pubkey.toString()
      )
      
      // Look for DEX program interactions
      const involvedPrograms = accountKeys.filter(addr => 
        Object.values(DEX_PROGRAMS).includes(addr)
      )
      
      if (involvedPrograms.length === 0) {
        return swaps // No DEX programs involved
      }
      
      // Parse instructions for swap patterns
      for (const instruction of transaction.message.instructions) {
        const programId = accountKeys[instruction.programIdIndex]
        
        if (Object.values(DEX_PROGRAMS).includes(programId)) {
          const swap = await this.parseSwapInstruction(
            instruction,
            accountKeys,
            meta,
            txUpdate,
            programId
          )
          
          if (swap) {
            swaps.push(swap)
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Error parsing transaction ${txUpdate.signature}:`, error)
    }
    
    return swaps
  }

  private async parseSwapInstruction(
    instruction: any,
    accountKeys: string[],
    meta: any,
    txUpdate: GeyserTransactionUpdate,
    dexProgram: string
  ): Promise<SwapData | null> {
    try {
      // Extract wallet address (transaction signer)
      const walletAddress = accountKeys[0] // First account is usually the signer
      
      // Check if this wallet is one of our tracked KOL wallets
      const kolWallet = await prisma.kolWallet.findUnique({
        where: { address: walletAddress }
      })
      
      if (!kolWallet) {
        return null // Not a tracked KOL wallet
      }
      
      // Analyze token balance changes to identify swap
      const preBalances = meta.preTokenBalances || []
      const postBalances = meta.postTokenBalances || []
      
      const swapData = this.analyzeTokenBalanceChanges(
        preBalances,
        postBalances,
        walletAddress,
        txUpdate,
        dexProgram
      )
      
      return swapData
      
    } catch (error) {
      console.error('❌ Error parsing swap instruction:', error)
      return null
    }
  }

  private analyzeTokenBalanceChanges(
    preBalances: any[],
    postBalances: any[],
    walletAddress: string,
    txUpdate: GeyserTransactionUpdate,
    dexProgram: string
  ): SwapData | null {
    try {
      // Find balance changes for the wallet
      const walletPreBalances = preBalances.filter(b => b.owner === walletAddress)
      const walletPostBalances = postBalances.filter(b => b.owner === walletAddress)
      
      let inputMint = ''
      let outputMint = ''
      let inputAmount = 0
      let outputAmount = 0
      
      // Identify input token (balance decreased)
      for (const preBal of walletPreBalances) {
        const postBal = walletPostBalances.find(p => p.mint === preBal.mint)
        
        if (postBal && postBal.uiTokenAmount.uiAmount < preBal.uiTokenAmount.uiAmount) {
          inputMint = preBal.mint
          inputAmount = preBal.uiTokenAmount.uiAmount - postBal.uiTokenAmount.uiAmount
          break
        }
      }
      
      // Identify output token (balance increased)
      for (const postBal of walletPostBalances) {
        const preBal = walletPreBalances.find(p => p.mint === postBal.mint)
        
        if (!preBal || postBal.uiTokenAmount.uiAmount > preBal.uiTokenAmount.uiAmount) {
          outputMint = postBal.mint
          outputAmount = postBal.uiTokenAmount.uiAmount - (preBal?.uiTokenAmount.uiAmount || 0)
          break
        }
      }
      
      if (!inputMint || !outputMint || inputAmount <= 0 || outputAmount <= 0) {
        return null // Could not identify swap pattern
      }
      
      return {
        signature: txUpdate.signature,
        walletAddress,
        inputMint,
        outputMint,
        inputAmount,
        outputAmount,
        timestamp: txUpdate.blockTime,
        slot: txUpdate.slot,
        dexProgram
      }
      
    } catch (error) {
      console.error('❌ Error analyzing token balance changes:', error)
      return null
    }
  }

  private async processSwap(swap: SwapData): Promise<void> {
    try {
      console.log(`💱 Processing swap: ${swap.inputAmount} ${swap.inputMint.slice(0, 8)} → ${swap.outputAmount} ${swap.outputMint.slice(0, 8)}`)
      
      // Enrich with token metadata
      const [inputToken, outputToken] = await Promise.all([
        this.getTokenMetadata(swap.inputMint),
        this.getTokenMetadata(swap.outputMint)
      ])
      
      // Get current token prices
      const [inputPrice, outputPrice] = await Promise.all([
        this.getTokenPrice(swap.inputMint),
        this.getTokenPrice(swap.outputMint)
      ])
      
      // Calculate USD value of the swap
      const inputUsdValue = (inputPrice || 0) * swap.inputAmount
      const outputUsdValue = (outputPrice || 0) * swap.outputAmount
      swap.usdValue = Math.max(inputUsdValue, outputUsdValue) // Use higher value for volume calculation
      
      // Store transaction in database
      await this.storeTransactionData(swap, inputToken, outputToken)
      
      // Calculate PNL updates
      const pnlUpdate = await this.calculatePnlUpdate(swap, inputToken, outputToken, inputPrice, outputPrice)
      
      if (pnlUpdate) {
        // Update Redis leaderboard
        await this.updateLeaderboard(pnlUpdate)
        
        // Push live updates via SSE
        await this.pushLiveUpdates(swap, pnlUpdate)
      }
      
    } catch (error) {
      console.error(`❌ Error processing swap ${swap.signature}:`, error)
      throw error
    }
  }

  private async getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
    try {
      // Check cache first
      if (this.tokenCache.has(mint)) {
        return this.tokenCache.get(mint)!
      }
      
      // Check database
      const dbToken = await prisma.token.findUnique({
        where: { mintAddress: mint }
      })
      
      if (dbToken) {
        const metadata: TokenMetadata = {
          mint: dbToken.mintAddress,
          name: dbToken.name || 'Unknown',
          symbol: dbToken.symbol || 'UNK',
          decimals: dbToken.decimals || 9,
          logoUri: dbToken.logoUri || undefined
        }
        
        this.tokenCache.set(mint, metadata)
        return metadata
      }
      
      // Fetch from Helius API (mock for now - would implement actual API call)
      const metadata = await this.fetchTokenMetadataFromHelius(mint)
      
      if (metadata) {
        // Store in database
        await prisma.token.upsert({
          where: { mintAddress: mint },
          create: {
            mintAddress: mint,
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            logoUri: metadata.logoUri
          },
          update: {
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            logoUri: metadata.logoUri
          }
        })
        
        this.tokenCache.set(mint, metadata)
      }
      
      return metadata
      
    } catch (error) {
      console.error(`❌ Error getting token metadata for ${mint}:`, error)
      return null
    }
  }

  private async fetchTokenMetadataFromHelius(mint: string): Promise<TokenMetadata | null> {
    // Mock implementation - would use actual Helius DAS API
    console.log(`🔍 Fetching metadata for token ${mint} (mock)`)
    
    return {
      mint,
      name: `Token ${mint.slice(0, 8)}`,
      symbol: `TKN${mint.slice(0, 4)}`,
      decimals: 9,
      logoUri: undefined
    }
  }

  private async getTokenPrice(mint: string): Promise<number | null> {
    try {
      const now = Date.now()
      const cached = this.priceCache.get(mint)
      
      // Check cache
      if (cached && (now - cached.timestamp) < this.PRICE_CACHE_TTL) {
        return cached.price
      }
      
      // Fetch from Jupiter API (mock for now)
      const price = await this.fetchTokenPriceFromJupiter(mint)
      
      if (price !== null) {
        this.priceCache.set(mint, { price, timestamp: now })
      }
      
      return price
      
    } catch (error) {
      console.error(`❌ Error getting token price for ${mint}:`, error)
      return null
    }
  }

  private async fetchTokenPriceFromJupiter(mint: string): Promise<number | null> {
    // Mock implementation - would use actual Jupiter Price API
    console.log(`💰 Fetching price for token ${mint} (mock)`)
    
    // Mock prices for common tokens
    const mockPrices: { [key: string]: number } = {
      'So11111111111111111111111111111111111111112': 100, // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
    }
    
    return mockPrices[mint] || Math.random() * 10 // Random price for other tokens
  }

  private async storeTransactionData(
    swap: SwapData,
    inputToken: TokenMetadata | null,
    outputToken: TokenMetadata | null
  ): Promise<void> {
    try {
      // Store transaction
      await prisma.kolTransaction.upsert({
        where: { signature: swap.signature },
        create: {
          signature: swap.signature,
          blockTime: swap.timestamp,
          slot: BigInt(swap.slot),
          kolAddress: swap.walletAddress,
          feeLamports: BigInt(5000), // Mock fee
          wasSuccessful: true,
          programIds: [swap.dexProgram],
          computeUnits: BigInt(200000), // Mock compute units
          metadataJson: {
            dex_program: swap.dexProgram,
            input_token: inputToken,
            output_token: outputToken
          }
        },
        update: {} // Don't update if exists
      })
      
      // Store token transfer
      await prisma.kolTokenTransfer.create({
        data: {
          transactionSignature: swap.signature,
          blockTime: swap.timestamp,
          kolAddress: swap.walletAddress,
          tokenMintAddress: swap.outputMint, // Focus on output token for PNL calculation
          amountChangeRaw: BigInt(swap.outputAmount * Math.pow(10, outputToken?.decimals || 9)),
          preBalanceRaw: BigInt(0), // Would need to track balances
          postBalanceRaw: BigInt(swap.outputAmount * Math.pow(10, outputToken?.decimals || 9)),
          usdValueAtTime: swap.usdValue ? Number(swap.usdValue) : null,
          instructionIndex: 0
        }
      })
      
      console.log(`✅ Stored transaction data for ${swap.signature}`)
      
    } catch (error) {
      console.error(`❌ Error storing transaction data:`, error)
      throw error
    }
  }

  private async calculatePnlUpdate(
    swap: SwapData,
    inputToken: TokenMetadata | null,
    outputToken: TokenMetadata | null,
    inputPrice: number | null,
    outputPrice: number | null
  ): Promise<PnlUpdate | null> {
    try {
      // Simple PNL calculation (would implement full Average Cost Basis later)
      const inputValue = (inputPrice || 0) * swap.inputAmount
      const outputValue = (outputPrice || 0) * swap.outputAmount
      const realizedPnl = outputValue - inputValue
      
      console.log(`📊 PNL for ${swap.walletAddress}: $${realizedPnl.toFixed(2)} (${inputValue.toFixed(2)} → ${outputValue.toFixed(2)})`)
      
      return {
        walletAddress: swap.walletAddress,
        tokenMint: swap.outputMint,
        realizedPnl,
        unrealizedPnl: 0, // Would calculate based on current holdings
        totalPnl: realizedPnl
      }
      
    } catch (error) {
      console.error('❌ Error calculating PNL update:', error)
      return null
    }
  }

  private async updateLeaderboard(pnlUpdate: PnlUpdate): Promise<void> {
    try {
      // Update Redis leaderboard for multiple timeframes
      await this.redisLeaderboard.updateWalletPnl(
        pnlUpdate.walletAddress,
        pnlUpdate.totalPnl,
        ['1h', '1d', '7d', '30d']
      )
      
      console.log(`📊 Updated leaderboard for ${pnlUpdate.walletAddress}: $${pnlUpdate.totalPnl.toFixed(2)}`)
      
    } catch (error) {
      console.error('❌ Error updating leaderboard:', error)
    }
  }

  private async pushLiveUpdates(swap: SwapData, pnlUpdate: PnlUpdate): Promise<void> {
    try {
      // Push transaction feed update
      await this.sseService.broadcastToChannel('transaction-feed', {
        type: 'transaction',
        timestamp: new Date(),
        data: {
          signature: swap.signature,
          wallet: swap.walletAddress,
          inputAmount: swap.inputAmount,
          outputAmount: swap.outputAmount,
          inputMint: swap.inputMint,
          outputMint: swap.outputMint,
          usdValue: swap.usdValue,
          timestamp: swap.timestamp,
          dex: swap.dexProgram
        }
      })
      
      // Push PNL update
      await this.sseService.broadcastToChannel('leaderboard-updates', {
        type: 'position',
        timestamp: new Date(),
        data: pnlUpdate
      })
      
      console.log(`📡 Pushed live updates for ${swap.signature}`)
      
    } catch (error) {
      console.error('❌ Error pushing live updates:', error)
    }
  }

  private startTokenMetadataRefresh(): void {
    // Refresh token metadata cache every 5 minutes
    setInterval(() => {
      this.tokenCache.clear()
      console.log('🔄 Cleared token metadata cache')
    }, 5 * 60 * 1000)
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping Transaction Processor service...')
    this.isProcessing = false
    
    await this.messageQueue.shutdown()
    await this.redisLeaderboard.shutdown()
    await this.sseService.shutdown()
    
    this.tokenCache.clear()
    this.priceCache.clear()
  }

  public getStatus(): {
    isProcessing: boolean
    processedCount: number
    errorCount: number
    cacheSize: number
    priceCache: number
  } {
    return {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      cacheSize: this.tokenCache.size,
      priceCache: this.priceCache.size
    }
  }
}

// Export singleton instance
export const transactionProcessorService = new TransactionProcessorService() 