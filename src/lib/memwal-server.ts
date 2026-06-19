/**
 * MemWal Server — Server-side Walrus Memory Client
 *
 * Initializes the MemWal SDK from server env vars (MEMWAL_ACCOUNT_ID,
 * MEMWAL_PRIVATE_KEY, etc.) and provides methods to:
 *
 * 1. `recallRelevantMemories(match)` — Query Walrus Memory for relevant
 *    past predictions and chat history about a specific match. Results
 *    are formatted as plaintext for injection into AI system prompts.
 *
 * 2. `saveChatMemory(text, matchId)` — Save an AI conversation turn
 *    to Walrus Memory so future sessions can recall it.
 *
 * 3. `getStatus()` — Returns whether the SDK is connected.
 *
 * This runs on the backend alongside the OpenAI-compatible DeepSeek
 * integration, giving the AI "wrapped" memory of past interactions.
 */

import { MemWal } from '@mysten-incubation/memwal';
import type { Match } from '../types';

// ─── Server-side Singleton ────────────────────────────────────────────────

let _memwal: MemWal | null = null;
let _ready: boolean = false;

/**
 * Initialize (or get) the singleton MemWal server client.
 * Reads config from environment variables.
 */
export async function getMemWalServer(): Promise<MemWal | null> {
  if (_memwal) return _memwal;

  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  const serverUrl = process.env.MEMWAL_SERVER_URL;
  const namespace = process.env.MEMWAL_NAMESPACE || 'ai-match-predictor';

  if (!key || !accountId) {
    console.warn('[MemWal Server] MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID missing. Memory-augmented AI unavailable.');
    return null;
  }

  try {
    _memwal = MemWal.create({
      key,
      accountId,
      serverUrl: serverUrl || 'https://relayer.memory.walrus.xyz',
      namespace,
    });

    // Health check to verify connectivity
    await _memwal.health();
    _ready = true;
    console.log('[MemWal Server] ✅ Connected to Walrus Memory for AI memory augmentation.');
    return _memwal;
  } catch (e) {
    console.warn('[MemWal Server] Failed to initialize MemWal SDK:', e);
    _memwal = null;
    return null;
  }
}

// ─── Memory Recall for AI Context ─────────────────────────────────────────

export interface MemoryRecallResult {
  /** Formatted chat history text for injection into the AI prompt */
  chatHistory: string;
  /** Formatted prediction history text for injection into the AI prompt */
  predictionHistory: string;
  /** Formatted user profile text for injection into the AI prompt */
  userProfile: string;
  /** Whether memory was successfully recalled from Walrus Memory (vs empty) */
  fromChain: boolean;
}

/**
 * Recall relevant memories from Walrus Memory to augment the AI system prompt.
 *
 * Queries three categories:
 * 1. Match-specific chat history
 * 2. Prediction history across all matches
 * 3. General user interaction profile
 */
export async function recallRelevantMemories(match: Match): Promise<MemoryRecallResult> {
  const mw = await getMemWalServer();

  const defaultResult: MemoryRecallResult = {
    chatHistory: '',
    predictionHistory: '',
    userProfile: '',
    fromChain: false,
  };

  if (!mw) return defaultResult;

  try {
    // Run three recall queries in parallel for different memory dimensions
    const [chatMemories, predictionMemories, profileMemories] = await Promise.all([
      // 1. Chat history about this specific match
      mw.recall({
        query: `${match.homeTeam} ${match.awayTeam} football match discussion chat AI pundit`,
        limit: 15,
        maxDistance: 0.5,
      }),
      // 2. Prediction history across all matches
      mw.recall({
        query: `football match prediction choice reasoning resolved correct`,
        limit: 15,
        maxDistance: 0.5,
      }),
      // 3. General user profile / interaction patterns
      mw.recall({
        query: `user prediction accuracy football analyst profile`,
        limit: 5,
        maxDistance: 0.6,
      }),
    ]);

    const chatHistory = formatChatMemories(chatMemories.results || []);
    const predictionHistory = formatPredictionMemories(predictionMemories.results || []);
    const userProfile = formatProfileMemories(profileMemories.results || []);

    const fromChain = chatMemories.total > 0 || predictionMemories.total > 0 || profileMemories.total > 0;

    console.log(
      `[MemWal Server] Recalled ${chatMemories.total} chats, ${predictionMemories.total} predictions, ${profileMemories.total} profile items from Walrus Memory.`
    );

    return { chatHistory, predictionHistory, userProfile, fromChain };
  } catch (e) {
    console.warn('[MemWal Server] recall() failed:', e);
    return defaultResult;
  }
}

/**
 * Format chat memories into a clean text block for the AI system prompt.
 */
function formatChatMemories(memories: Array<{ text: string; distance: number }>): string {
  if (memories.length === 0) return '';

  const lines = memories.map((m, i) => {
    // Parse structured [CHAT] memories if possible
    const text = m.text.replace(/\[CHAT\]/g, '').trim();
    return `  ${i + 1}. ${text}`;
  });

  return `\n[MEMWAL RECALL: Past Chat History]\n${lines.join('\n')}\n`;
}

/**
 * Format prediction memories into a clean text block for the AI system prompt.
 */
function formatPredictionMemories(memories: Array<{ text: string; distance: number }>): string {
  if (memories.length === 0) return '';

  const lines = memories.map((m, i) => {
    const text = m.text.replace(/\[PREDICTION\]/g, '').trim();
    // Show relevance score as an indicator of recency
    const relevance = Math.round((1 - m.distance) * 100);
    return `  ${i + 1}. [rel:${relevance}%] ${text}`;
  });

  return `\n[MEMWAL RECALL: Past Prediction History]\n${lines.join('\n')}\n`;
}

/**
 * Format user profile memories into a clean text block for the AI system prompt.
 */
function formatProfileMemories(memories: Array<{ text: string; distance: number }>): string {
  if (memories.length === 0) return '';

  const lines = memories.map((m, i) => {
    return `  ${i + 1}. ${m.text.replace(/\[(CHAT|PREDICTION)\]/g, '').trim()}`;
  });

  return `\n[MEMWAL RECALL: User Profile / Interaction Patterns]\n${lines.join('\n')}\n`;
}

// ─── Save AI Conversation to Memory ───────────────────────────────────────

/**
 * Save an AI conversation turn to Walrus Memory so future sessions can recall it.
 * Note: When withMemWal middleware is active (server.ts), auto-save handles this.
 * This function is available for manual/managed saving.
 */
export async function saveChatMemory(text: string, role: 'user' | 'ai', matchId: string, walletAddress?: string): Promise<boolean> {
  const mw = await getMemWalServer();
  if (!mw) return false;

  try {
    const memoryText = [
      `[CHAT]`,
      `matchId: ${matchId}`,
      `sender: ${role}`,
      `text: ${text}`,
      `timestamp: ${new Date().toISOString()}`,
      `wallet: ${walletAddress || 'anonymous'}`,
    ].join('\n');

    await mw.rememberAndWait(memoryText);
    console.log(`[MemWal Server] ✅ AI ${role} turn committed to Walrus Memory.`);
    return true;
  } catch (e) {
    console.warn('[MemWal Server] remember() failed for AI chat turn:', e);
    return false;
  }
}

/**
 * Save a prediction to Walrus Memory from the server side.
 */
export async function savePredictionMemory(predictionText: string): Promise<boolean> {
  const mw = await getMemWalServer();
  if (!mw) return false;

  try {
    await mw.rememberAndWait(predictionText);
    console.log('[MemWal Server] ✅ Prediction committed to Walrus Memory.');
    return true;
  } catch (e) {
    console.warn('[MemWal Server] remember() failed for prediction:', e);
    return false;
  }
}

// ─── Status ───────────────────────────────────────────────────────────────

export function isMemWalReady(): boolean {
  return _ready;
}

export async function getMemWalServerStatus(): Promise<{ connected: boolean; ready: boolean }> {
  if (!_memwal) return { connected: false, ready: false };
  try {
    await _memwal.health();
    return { connected: true, ready: _ready };
  } catch {
    return { connected: false, ready: _ready };
  }
}
