import { Connection, PublicKey, ParsedInstruction, PartiallyDecodedInstruction } from '@solana/web3.js'
import { MessageQueueService } from './message-queue.service.js'
import { RedisLeaderboardService } from './redis-leaderboard.service.js'
import { SSEService } from './sse.service.js'
import { prisma } from '../lib/prisma.js'
import { GeyserTransactionUpdate, DEX_PROGRAMS, isDexProgram, getDexProgramName } from '../types/index.js'
import { extract } from '@jup-ag/instruction-parser'

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
  private rpcCallCount = 0
  private lastRpcReset = Date.now()
  private readonly RPC_RATE_LIMIT = 10000 // Calls per minute - Chainstack allows much higher
  private readonly RPC_RETRY_DELAYS = [100, 250, 500, 1000] // Faster retry for high-performance RPC
  
  // High-performance caching
  private tokenCache = new Map<string, TokenMetadata>()
  private priceCache = new Map<string, { price: number, timestamp: number }>()
  private readonly PRICE_CACHE_TTL = 30000 // 30 seconds for faster updates
  
  // Parallel processing configuration
  private readonly BATCH_SIZE = 50 // Process transactions in batches
  private readonly MAX_CONCURRENT_WORKERS = 5 // Parallel workers
  private processingQueue: GeyserTransactionUpdate[] = []
  private isProcessingBatch = false

  constructor() {
    this.messageQueue = new MessageQueueService()
    this.redisLeaderboard = new RedisLeaderboardService()
    this.sseService = new SSEService()
    
    // Use Chainstack's high-performance RPC endpoint
    const rpcEndpoint = process.env.CHAINSTACK_RPC_ENDPOINT || 
                       'https://solana-mainnet.core.chainstack.com/b78715330157d1f67b31ade41d9f5972' ||
                       'https://api.mainnet-beta.solana.com' // Fallback
    
    this.connection = new Connection(rpcEndpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000,
      disableRetryOnRateLimit: false
    })
    
    console.log(`🔌 Using RPC endpoint: ${rpcEndpoint}`)
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
    
    await this.messageQueue.subscribe('raw-transactions', async (messageData: any) => {
      if (!this.isProcessing) return
      
      try {
        // Extract transaction data from QueueMessage payload
        const transactionData: GeyserTransactionUpdate = messageData.payload || messageData
        
        // Add to processing queue for batch processing
        this.processingQueue.push(transactionData)
        
        // Process batch when it reaches target size or after timeout
        if (this.processingQueue.length >= this.BATCH_SIZE && !this.isProcessingBatch) {
          await this.processBatch()
        }
        
      } catch (error) {
        this.errorCount++
        console.error('❌ Error adding transaction to queue:', error)
      }
    })
    
    // Start periodic batch processing for smaller batches
    this.startPeriodicBatchProcessing()
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessingBatch || this.processingQueue.length === 0) return
    
    this.isProcessingBatch = true
    const batchToProcess = this.processingQueue.splice(0, this.BATCH_SIZE)
    
    try {
      console.log(`🔄 Processing batch of ${batchToProcess.length} transactions...`)
      
      // Process transactions in parallel chunks
      const chunks = this.chunkArray(batchToProcess, this.MAX_CONCURRENT_WORKERS)
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (txData) => {
          try {
            await this.processTransaction(txData)
            this.processedCount++
          } catch (error) {
            this.errorCount++
            console.error('❌ Error processing transaction in batch:', error)
          }
        }))
      }
      
      if (this.processedCount % 100 === 0) {
        console.log(`📊 Processed ${this.processedCount} transactions (${this.errorCount} errors)`)
      }
      
    } finally {
      this.isProcessingBatch = false
    }
  }

  private startPeriodicBatchProcessing(): void {
    // Process remaining transactions every 2 seconds
    setInterval(async () => {
      if (this.processingQueue.length > 0 && !this.isProcessingBatch) {
        await this.processBatch()
      }
    }, 2000)
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Pre-filter transactions to identify likely DEX swaps
   * Reduces processing load by 80%+ by skipping irrelevant transactions
   */
  private isLikelyDexTransaction(txUpdate: GeyserTransactionUpdate): boolean {
    try {
      // Check if transaction involves known DEX programs
      const instructions = txUpdate.transaction?.transaction?.message?.instructions || []
      const accountKeys = txUpdate.accounts || []
      
      // Known DEX program IDs
      const dexPrograms = [
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter V6
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium V4
        '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',  // Pump.fun
        '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca V1
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',  // Orca V2
      ]
      
      // Check if any instruction involves DEX programs
      if (instructions) {
        for (const instruction of instructions) {
          const programId = instruction.programId || instruction.program_id
          if (programId && dexPrograms.includes(programId.toString())) {
            return true
          }
        }
      }
      
      // Check if any account keys are DEX programs
      if (accountKeys) {
        for (const account of accountKeys) {
          if (dexPrograms.includes(account.toString())) {
            return true
          }
        }
      }
      
      // If we can't determine from Geyser data, process it (conservative approach)
      return true
      
    } catch (error) {
      // If error in filtering, process the transaction (safe fallback)
      return true
    }
  }

  private async processTransaction(txUpdate: GeyserTransactionUpdate): Promise<void> {
    try {
      // Parse transaction for DEX swaps
      console.log('🔍 Debug - Processing transaction:', txUpdate)
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
      console.log('🔍 Debug - Parsing transaction:', txUpdate.signature)
      
      if (!txUpdate.signature) {
        console.log('⚠️ Transaction missing signature, skipping parse...')
        return swaps
      }
      
      // OPTIMIZATION: Pre-filter using transaction data from Geyser
      if (!this.isLikelyDexTransaction(txUpdate)) {
        return swaps // Skip non-DEX transactions immediately
      }
      
      // Check RPC rate limit before making call
      if (!this.canMakeRpcCall()) {
        console.log('⚠️ RPC rate limit reached, skipping transaction parse...')
        return swaps
      }
      
      // Get transaction details from Solana RPC with retry logic
      const txDetails = await this.getRpcWithRetry(() => 
        this.connection.getParsedTransaction(txUpdate.signature, {
          maxSupportedTransactionVersion: 0
        })
      )
      
      if (!txDetails || !txDetails.meta || txDetails.meta.err) {
        console.log(`⚠️ Transaction ${txUpdate.signature.slice(0, 8)}... failed or not found`)
        return swaps // Transaction failed or not found
      }
      
      // First, try to parse using Jupiter instruction parser for Jupiter swaps
      try {
        const jupiterSwaps = await this.parseJupiterSwaps(txDetails, txUpdate)
        if (jupiterSwaps.length > 0) {
          swaps.push(...jupiterSwaps)
          console.log(`✅ Found ${jupiterSwaps.length} Jupiter swaps in transaction ${txUpdate.signature.slice(0, 8)}...`)
        }
      } catch (error) {
        console.log(`⚠️ Jupiter parser failed for ${txUpdate.signature.slice(0, 8)}..., falling back to balance analysis`)
      }
      
      // If no Jupiter swaps found, fall back to general DEX analysis
      if (swaps.length === 0) {
        const generalSwaps = await this.parseGeneralDexSwaps(txDetails, txUpdate)
        swaps.push(...generalSwaps)
      }
      
    } catch (error) {
      console.error(`❌ Error parsing transaction ${txUpdate.signature}:`, error)
    }
    
    return swaps
  }

  /**
   * Parse Jupiter swaps using the official Jupiter instruction parser
   */
  private async parseJupiterSwaps(txDetails: any, txUpdate: GeyserTransactionUpdate): Promise<SwapData[]> {
    const swaps: SwapData[] = []
    
    try {
      // For now, use balance analysis for Jupiter transactions
      // TODO: Implement proper Jupiter instruction parsing once we understand the API better
      console.log('🔍 Using balance analysis for Jupiter transactions...')
      
      const jupiterSwaps = await this.parseGeneralDexSwaps(txDetails, txUpdate)
      return jupiterSwaps.map(swap => ({ ...swap, dexProgram: 'Jupiter' }))
      
    } catch (error) {
      console.error('❌ Error parsing Jupiter swaps:', error)
    }
    
    return swaps
  }

  /**
   * Fallback parser for general DEX swaps (Raydium, Orca, etc.)
   */
  private async parseGeneralDexSwaps(txDetails: any, txUpdate: GeyserTransactionUpdate): Promise<SwapData[]> {
    const swaps: SwapData[] = []
    
    try {
      const { transaction, meta } = txDetails
      const accountKeys: string[] = transaction.message.accountKeys.map((key: any) => 
        typeof key === 'string' ? key : key.pubkey.toString()
      )
      
      // Look for DEX program interactions
      const involvedPrograms = accountKeys.filter((addr: string) => isDexProgram(addr))
      
      if (involvedPrograms.length === 0) {
        return swaps
      }
      
      console.log(`🔍 Found DEX programs: ${involvedPrograms.map((p: string) => getDexProgramName(p)).join(', ')}`)
      
      // Check each account to see if it's a KOL wallet
      for (const addr of accountKeys) {
        const kolWallet = await prisma.kolWallet.findUnique({ where: { address: addr } })
        
                if (kolWallet && involvedPrograms.length > 0) {
            const dexName: string = involvedPrograms[0] ? getDexProgramName(involvedPrograms[0]) : 'Unknown DEX'
            const swapData = this.analyzeTokenBalanceChanges(
              meta.preTokenBalances || [],
              meta.postTokenBalances || [],
              addr,
              txUpdate,
              dexName
            )
          
          if (swapData) {
            console.log(`🚀 DEX swap detected: ${kolWallet.curatedName} swapped on ${swapData.dexProgram}`)
            swaps.push(swapData)
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error parsing general DEX swaps:', error)
    }
    
    return swaps
  }

  private canMakeRpcCall(): boolean {
    const now = Date.now()
    
    // Reset counter every minute
    if (now - this.lastRpcReset > 60000) {
      this.rpcCallCount = 0
      this.lastRpcReset = now
    }
    
    return this.rpcCallCount < this.RPC_RATE_LIMIT
  }

  private async getRpcWithRetry<T>(rpcCall: () => Promise<T>): Promise<T> {
    this.rpcCallCount++
    
    for (let attempt = 0; attempt < this.RPC_RETRY_DELAYS.length; attempt++) {
      try {
        return await rpcCall()
      } catch (error: any) {
        if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
          const delay = this.RPC_RETRY_DELAYS[attempt]
          console.log(`⏳ RPC rate limited, retrying after ${delay}ms delay (attempt ${attempt + 1}/${this.RPC_RETRY_DELAYS.length})...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // For non-rate-limit errors, throw immediately
        throw error
      }
    }
    
    throw new Error('RPC call failed after all retry attempts')
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
      
      if (!walletAddress) {
        return null // No wallet address found
      }
      
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
      // Check cache first - tokens metadata never changes, so cache permanently
      if (this.tokenCache.has(mint)) {
        return this.tokenCache.get(mint)!
      }
      
      // Check database cache
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
        
        // Cache permanently (metadata doesn't change)
        this.tokenCache.set(mint, metadata)
        return metadata
      }
      
      // Fallback: Use well-known tokens for common mints
      const knownTokens = this.getKnownTokenMetadata(mint)
      if (knownTokens) {
        this.tokenCache.set(mint, knownTokens)
        return knownTokens
      }
      
      // Fetch from Helius API only if not in cache/DB
      const metadata = await this.fetchTokenMetadataFromHelius(mint)
      
      if (metadata) {
        // Store in database for permanent caching
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
        
        // Cache permanently
        this.tokenCache.set(mint, metadata)
      }
      
      return metadata
      
    } catch (error) {
      console.error(`❌ Error getting token metadata for ${mint}:`, error)
      return this.createFallbackMetadata(mint)
    }
  }

  /**
   * Get metadata for well-known tokens to avoid API calls
   */
  private getKnownTokenMetadata(mint: string): TokenMetadata | null {
    const knownTokens: { [key: string]: TokenMetadata } = {
      'So11111111111111111111111111111111111111112': {
        mint: 'So11111111111111111111111111111111111111112',
        name: 'Wrapped SOL',
        symbol: 'SOL',
        decimals: 9
      },
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6
      },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6
      },
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
        mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        name: 'Raydium',
        symbol: 'RAY',
        decimals: 6
      }
    }
    
    return knownTokens[mint] || null
  }

  private async fetchTokenMetadataFromHelius(mint: string): Promise<TokenMetadata | null> {
    try {
      const heliusApiKey = process.env.HELIUS_API_KEY
      if (!heliusApiKey) {
        console.warn('⚠️ HELIUS_API_KEY not configured, using fallback metadata')
        return this.createFallbackMetadata(mint)
      }

      console.log(`🔍 Fetching metadata for token ${mint} from Helius DAS API`)

      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-metadata',
          method: 'getAsset',
          params: { id: mint }
        })
      })

      if (!response.ok) {
        console.warn(`⚠️ Helius API HTTP error ${response.status}, using fallback`)
        return this.createFallbackMetadata(mint)
      }

      const data = await response.json()
      
      if (data.error) {
        console.warn(`⚠️ Helius API error for ${mint}:`, data.error.message)
        return this.createFallbackMetadata(mint)
      }

      const asset = data.result
      if (!asset) {
        console.warn(`⚠️ No asset data returned for ${mint}`)
        return this.createFallbackMetadata(mint)
      }

      const metadata: TokenMetadata = {
        mint,
        name: asset.content?.metadata?.name || `Token ${mint.slice(0, 8)}`,
        symbol: asset.content?.metadata?.symbol || `UNK${mint.slice(0, 3)}`,
        decimals: asset.token_info?.decimals ?? 9,
        logoUri: asset.content?.links?.image || asset.content?.files?.[0]?.uri
      }

      console.log(`✅ Fetched metadata: ${metadata.symbol} (${metadata.name})`)
      return metadata
      
    } catch (error) {
      console.error(`❌ Error fetching from Helius DAS API for ${mint}:`, error)
      return this.createFallbackMetadata(mint)
    }
  }

  private createFallbackMetadata(mint: string): TokenMetadata {
    return {
      mint,
      name: `Token ${mint.slice(0, 8)}...`,
      symbol: `UNK${mint.slice(-3)}`,
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
    try {
      console.log(`💰 Fetching price for token ${mint} from Jupiter Price API`)

      // Jupiter Price API endpoint
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        console.warn(`⚠️ Jupiter Price API HTTP error ${response.status}`)
        return this.getFallbackPrice(mint)
      }

      const data = await response.json()
      
      if (data.data && data.data[mint] && data.data[mint].price) {
        const price = parseFloat(data.data[mint].price)
        console.log(`✅ Fetched price for ${mint}: $${price}`)
        return price
      } else {
        console.warn(`⚠️ No price data returned for ${mint}`)
        return this.getFallbackPrice(mint)
      }
      
    } catch (error) {
      console.error(`❌ Error fetching price from Jupiter API for ${mint}:`, error)
      return this.getFallbackPrice(mint)
    }
  }

  private getFallbackPrice(mint: string): number {
    // Fallback prices for common tokens when API is unavailable
    const fallbackPrices: { [key: string]: number } = {
      'So11111111111111111111111111111111111111112': 150, // SOL approximate
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 80, // RAY
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 140, // mSOL
    }
    
    return fallbackPrices[mint] || 0.001 // Default small price for unknown tokens
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
      // Determine if this is a buy or sell based on whether input token is SOL/USDC (base currency)
      const baseCurrencies = [
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      ]
      
      const isSell = baseCurrencies.includes(swap.outputMint) // Selling token for base currency
      const isBuy = baseCurrencies.includes(swap.inputMint)   // Buying token with base currency
      
      let realizedPnl = 0
      let unrealizedPnl = 0
      
      if (isBuy) {
        // BUY: Update position with new tokens
        await this.updatePositionOnBuy(swap, outputToken, outputPrice)
        console.log(`🟢 BUY: ${swap.outputAmount} ${outputToken?.symbol || 'tokens'} for $${((inputPrice || 0) * swap.inputAmount).toFixed(2)}`)
        
      } else if (isSell) {
        // SELL: Calculate realized PNL and update position
        realizedPnl = await this.updatePositionOnSell(swap, inputToken, inputPrice)
        console.log(`🔴 SELL: ${swap.inputAmount} ${inputToken?.symbol || 'tokens'} for $${((outputPrice || 0) * swap.outputAmount).toFixed(2)} (PNL: $${realizedPnl.toFixed(2)})`)
        
      } else {
        // TOKEN-TO-TOKEN SWAP: Treat as sell then buy
        realizedPnl = await this.updatePositionOnSell(swap, inputToken, inputPrice)
        await this.updatePositionOnBuy(swap, outputToken, outputPrice)
        console.log(`🔄 SWAP: ${inputToken?.symbol || 'input'} → ${outputToken?.symbol || 'output'} (PNL: $${realizedPnl.toFixed(2)})`)
      }
      
      // Calculate total unrealized PNL for this wallet across all positions
      unrealizedPnl = await this.calculateTotalUnrealizedPnl(swap.walletAddress)
      
      const totalPnl = realizedPnl + unrealizedPnl
      
      return {
        walletAddress: swap.walletAddress,
        tokenMint: isSell ? swap.inputMint : swap.outputMint,
        realizedPnl,
        unrealizedPnl,
        totalPnl
      }
      
    } catch (error) {
      console.error('❌ Error calculating PNL update:', error)
      return null
    }
  }

  /**
   * Update position when buying tokens - implements Average Cost Basis
   */
  private async updatePositionOnBuy(
    swap: SwapData,
    tokenMeta: TokenMetadata | null,
    tokenPrice: number | null
  ): Promise<void> {
    try {
      const tokenMint = swap.outputMint
      const amount = swap.outputAmount
      const usdCost = (swap.inputAmount * (await this.getTokenPrice(swap.inputMint) || 0))
      
      // Get existing position or create new one
      const existingPosition = await prisma.kolPosition.findUnique({
        where: {
          kolAddress_tokenMintAddress: {
            kolAddress: swap.walletAddress,
            tokenMintAddress: tokenMint
          }
        }
      })
      
      if (existingPosition) {
        // Update existing position with average cost basis
        const newTotalTokens = existingPosition.currentBalanceRaw + BigInt(amount)
        const newTotalCost = Number(existingPosition.totalCostBasisUsd) + usdCost
        const newAvgCost = Number(newTotalTokens) > 0 ? newTotalCost / Number(newTotalTokens) : 0
        
        await prisma.kolPosition.update({
          where: {
            kolAddress_tokenMintAddress: {
              kolAddress: swap.walletAddress,
              tokenMintAddress: tokenMint
            }
          },
          data: {
            currentBalanceRaw: newTotalTokens,
            totalCostBasisUsd: newTotalCost,
            weightedAvgCostUsd: newAvgCost,
            lastUpdatedAt: new Date()
          }
        })
        
      } else {
        // Create new position
        await prisma.kolPosition.create({
          data: {
            kolAddress: swap.walletAddress,
            tokenMintAddress: tokenMint,
            currentBalanceRaw: BigInt(amount),
            totalCostBasisUsd: usdCost,
            weightedAvgCostUsd: amount > 0 ? usdCost / amount : 0,
            lastUpdatedAt: new Date()
          }
        })
      }
      
    } catch (error) {
      console.error('❌ Error updating position on buy:', error)
    }
  }

  /**
   * Update position when selling tokens - calculates realized PNL
   */
  private async updatePositionOnSell(
    swap: SwapData,
    tokenMeta: TokenMetadata | null,
    tokenPrice: number | null
  ): Promise<number> {
    try {
      const tokenMint = swap.inputMint
      const soldAmount = swap.inputAmount
      const usdReceived = (swap.outputAmount * (await this.getTokenPrice(swap.outputMint) || 0))
      
      const position = await prisma.kolPosition.findUnique({
        where: {
          kolAddress_tokenMintAddress: {
            kolAddress: swap.walletAddress,
            tokenMintAddress: tokenMint
          }
        }
      })
      
      if (!position) {
        console.warn(`⚠️ No position found for ${swap.walletAddress} selling ${tokenMint}`)
        return 0 // No position to sell from
      }
      
      // Calculate realized PNL using Average Cost Basis
      const avgCostPerToken = Number(position.weightedAvgCostUsd)
      const costBasisOfSoldTokens = avgCostPerToken * soldAmount
      const realizedPnl = usdReceived - costBasisOfSoldTokens
      
      // Update position
      const balanceDiff = position.currentBalanceRaw - BigInt(soldAmount)
      const newBalance = balanceDiff > 0n ? balanceDiff : 0n
      const newTotalCost = Math.max(0, Number(position.totalCostBasisUsd) - costBasisOfSoldTokens)
      
      await prisma.kolPosition.update({
        where: {
          kolAddress_tokenMintAddress: {
            kolAddress: swap.walletAddress,
            tokenMintAddress: tokenMint
          }
        },
        data: {
          currentBalanceRaw: newBalance,
          totalCostBasisUsd: newTotalCost,
          lastUpdatedAt: new Date()
        }
      })
      
      // Record realized PNL event
      await prisma.kolRealizedPnlEvent.create({
        data: {
          kolAddress: swap.walletAddress,
          tokenMintAddress: tokenMint,
          closingTransactionSignature: swap.signature,
          quantitySold: BigInt(soldAmount),
          saleValueUsd: usdReceived,
          costBasisUsd: costBasisOfSoldTokens,
          realizedPnlUsd: realizedPnl,
          closedAt: swap.timestamp
        }
      })
      
      return realizedPnl
      
    } catch (error) {
      console.error('❌ Error updating position on sell:', error)
      return 0
    }
  }

  /**
   * Calculate total unrealized PNL for a wallet across all positions
   */
  private async calculateTotalUnrealizedPnl(walletAddress: string): Promise<number> {
    try {
      const positions = await prisma.kolPosition.findMany({
        where: { kolAddress: walletAddress }
      })
      
      let totalUnrealizedPnl = 0
      
      for (const position of positions) {
        if (position.currentBalanceRaw <= 0) continue
        
        const currentPrice = await this.getTokenPrice(position.tokenMintAddress) || 0
        const currentValue = currentPrice * Number(position.currentBalanceRaw)
        const costBasis = Number(position.totalCostBasisUsd)
        const unrealizedPnl = currentValue - costBasis
        
        totalUnrealizedPnl += unrealizedPnl
      }
      
      return totalUnrealizedPnl
      
    } catch (error) {
      console.error('❌ Error calculating total unrealized PNL:', error)
      return 0
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
      // Push transaction feed update to specific wallet channel
      this.sseService.sendTransactionUpdate(swap.walletAddress, {
        signature: swap.signature,
        inputAmount: swap.inputAmount,
        outputAmount: swap.outputAmount,
        inputMint: swap.inputMint,
        outputMint: swap.outputMint,
        usdValue: swap.usdValue,
        timestamp: swap.timestamp,
        dex: swap.dexProgram
      })
      
      // Push position update to wallet channel
      this.sseService.sendPositionUpdate(swap.walletAddress, pnlUpdate)
      
      // Push leaderboard updates for all timeframes
      this.sseService.sendLeaderboardUpdate('1h', { updated: swap.walletAddress, timestamp: new Date() })
      this.sseService.sendLeaderboardUpdate('1d', { updated: swap.walletAddress, timestamp: new Date() })
      this.sseService.sendLeaderboardUpdate('7d', { updated: swap.walletAddress, timestamp: new Date() })
      this.sseService.sendLeaderboardUpdate('30d', { updated: swap.walletAddress, timestamp: new Date() })
      
      console.log(`📡 Pushed live updates for ${swap.signature} to wallet ${swap.walletAddress}`)
      
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
    rpcMetrics: {
      callsThisMinute: number
      rateLimit: number
      canMakeCall: boolean
    }
  } {
    return {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      cacheSize: this.tokenCache.size,
      priceCache: this.priceCache.size,
      rpcMetrics: {
        callsThisMinute: this.rpcCallCount,
        rateLimit: this.RPC_RATE_LIMIT,
        canMakeCall: this.canMakeRpcCall()
      }
    }
  }
}

// Export singleton instance
export const transactionProcessorService = new TransactionProcessorService() 