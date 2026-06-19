/**
 * AI Match Predictor - Type Definitions
 */

export interface Match {
  id: string;
  homeTeam: string;
  homeShort: string;
  homeFlag: string;
  countryCode: string; // ISO 3166-1 alpha-2 for flag CDN (e.g. 'ar', 'us', 'gb-eng')
  awayTeam: string;
  awayShort: string;
  awayFlag: string;
  awayCountryCode: string; // ISO 3166-1 alpha-2 for flag CDN
  kickoffTime: string; // ISO String
  competition: string;
  status: 'upcoming' | 'completed';
  homeScore?: number;
  awayScore?: number;
  venue: string;
  /** ESPN team logo URLs for flag fallback */
  homeLogo?: string;
  awayLogo?: string;
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
  details: string; // Brief matchup context
}

export type PredictionChoice = 'home' | 'draw' | 'away';

export interface Prediction {
  id: string;
  matchId: string;
  choice: PredictionChoice;
  reasoning: string;
  timestamp: string; // ISO String
  isResolved: boolean;
  wasCorrect?: boolean;
  walletAddress?: string; // Sui wallet address of the predictor
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string; // ISO String
  matchId?: string; // Associated match context
  walletAddress?: string; // Sui wallet address of the sender
}

export interface MemWalData {
  predictions: Prediction[];
  chats: ChatMessage[];
}

export interface UserAccuracyStats {
  totalPredicted: number;
  totalResolved: number;
  correctPredictions: number;
  incorrectPredictions: number;
  accuracyRate: number; // Percentage 0-100
}

/** Sui wallet connection state */
export interface SuiWalletState {
  address: string | null;
  isConnected: boolean;
}

/** On-chain prediction config passed through the app */
export interface OnChainPredictionConfig {
  enabled: boolean;
  /** Whether currently submitting on-chain */
  isSubmitting: boolean;
  /** Last on-chain tx digest */
  lastTxDigest: string | null;
  /** Error message from last tx */
  lastTxError: string | null;
}
