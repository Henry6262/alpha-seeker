// =================================
// Type Exports
// =================================

// API Types
export * from './api.types.js'

// Dune Types  
export * from './dune.types.js'

// Geyser Types
export * from './geyser.types.js'

// Wallet Types
export * from './wallet.types.js'

// Leaderboard Types
export * from './leaderboard.types.js'

// DEX Program Types
export interface DEXProgram {
  name: string
  programId: string
  version?: string
}

export const DEX_PROGRAMS: Record<string, DEXProgram> = {
  JUPITER: {
    name: 'Jupiter',
    programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  },
  RAYDIUM_V4: {
    name: 'Raydium V4',
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  },
  ORCA_WHIRLPOOLS: {
    name: 'Orca Whirlpools',
    programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  },
  ORCA_V1: {
    name: 'Orca V1',
    programId: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
  },
  ORCA_V2: {
    name: 'Orca V2',
    programId: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  },
} 