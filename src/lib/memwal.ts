/**
 * MemWal Client — Proxy-based Walrus Memory Integration
 *
 * All MemWal SDK calls are proxied through the Express backend (/api/memwal/*)
 * to avoid CORS issues with the Walrus Memory relayer in the browser.
 * Falls back to IndexedDB + REST fallback when the backend is unreachable.
 */

import type { Prediction, ChatMessage, MemWalData } from '../types';

// ─── IndexedDB Fallback Store ──────────────────────────────────────────────

const DB_NAME = 'MemWal_Football_Predictor_DB';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error('Failed to open local IndexedDB fallback store.'));
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('predictions')) {
        db.createObjectStore('predictions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chats')) {
        db.createObjectStore('chats', { keyPath: 'id' });
      }
    };
  });
}

export const localStore = {
  async getPredictions(): Promise<Prediction[]> {
    try {
      const db = await openDB();
      return new Promise<Prediction[]>((resolve, reject) => {
        const transaction = db.transaction('predictions', 'readonly');
        const store = transaction.objectStore('predictions');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('IndexedDB read failed, falling back to localStorage', e);
      const cached = localStorage.getItem('memwal_predictions');
      return cached ? JSON.parse(cached) : [];
    }
  },

  async savePrediction(prediction: Prediction): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction('predictions', 'readwrite');
      transaction.objectStore('predictions').put(prediction);
      const all = await this.getPredictions();
      const exists = all.findIndex((p) => p.id === prediction.id);
      if (exists >= 0) all[exists] = prediction; else all.push(prediction);
      localStorage.setItem('memwal_predictions', JSON.stringify(all));
    } catch (e) {
      console.error('IndexedDB save failed', e);
    }
  },

  async getChats(): Promise<ChatMessage[]> {
    try {
      const db = await openDB();
      return new Promise<ChatMessage[]>((resolve, reject) => {
        const transaction = db.transaction('chats', 'readonly');
        const store = transaction.objectStore('chats');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('IndexedDB read failed, falling back to localStorage', e);
      const cached = localStorage.getItem('memwal_chats');
      return cached ? JSON.parse(cached) : [];
    }
  },

  async saveChat(chat: ChatMessage): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction('chats', 'readwrite');
      transaction.objectStore('chats').put(chat);
      const all = await this.getChats();
      const exists = all.findIndex((c) => c.id === chat.id);
      if (exists >= 0) all[exists] = chat; else all.push(chat);
      localStorage.setItem('memwal_chats', JSON.stringify(all));
    } catch (e) {
      console.error('IndexedDB chat save failed', e);
    }
  },

  async clearAll(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(['predictions', 'chats'], 'readwrite');
      tx.objectStore('predictions').clear();
      tx.objectStore('chats').clear();
      localStorage.removeItem('memwal_predictions');
      localStorage.removeItem('memwal_chats');
    } catch (e) {
      console.error('Failed to clear local DB stores', e);
    }
  },
};

// ─── Backend Proxy Helpers ──────────────────────────────────────────────
//
// All Walrus Memory SDK calls go through the Express backend (/api/memwal/*)
// so CORS is not an issue — the server makes HTTP requests directly.

/** Check MemWal SDK health via backend proxy */
async function proxyHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/memwal/health');
    if (!res.ok) return false;
    const data = await res.json();
    return data.connected === true;
  } catch {
    return false;
  }
}

/** Write a memory to Walrus via backend proxy */
async function proxyRemember(text: string): Promise<boolean> {
  try {
    const res = await fetch('/api/memwal/remember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Recall memories from Walrus via backend proxy */
async function proxyRecall(
  query: string,
  limit?: number,
  maxDistance?: number,
): Promise<Array<{ text: string }>> {
  try {
    const res = await fetch('/api/memwal/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit, maxDistance }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []) as Array<{ text: string }>;
  } catch {
    return [];
  }
}

// ─── Unified MemWal Client (SDK + Fallback) ───────────────────────────────

export const memwalClient = {
  /**
   * Save a prediction.
   * Primary: proxy remember() writes to Walrus chain via backend.
   * Fallback: IndexedDB + server REST API.
   */
  async savePrediction(prediction: Prediction): Promise<boolean> {
    // Always mirror to IndexedDB for instant offline access
    await localStore.savePrediction(prediction);

    // Try Walrus via backend proxy
    try {
      const memoryText = [
        `[PREDICTION]`,
        `id: ${prediction.id}`,
        `matchId: ${prediction.matchId}`,
        `choice: ${prediction.choice}`,
        `reasoning: ${prediction.reasoning || 'none'}`,
        `timestamp: ${prediction.timestamp}`,
        `resolved: ${prediction.isResolved}`,
        `correct: ${prediction.wasCorrect ?? 'pending'}`,
        `wallet: ${prediction.walletAddress || 'anonymous'}`,
      ].join('\n');

      const ok = await proxyRemember(memoryText);
      if (ok) {
        console.log('[MemWal Proxy] ✅ Prediction committed to chain:', prediction.id);
        return true;
      }
    } catch (e) {
      console.warn('[MemWal Proxy] remember() failed, using REST fallback:', e);
    }

    // REST API fallback
    try {
      const res = await fetch('/api/memwal/prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prediction),
      });
      if (res.ok) {
        console.log('[MemWal REST] Sync successful for prediction:', prediction.id);
        return true;
      }
    } catch (error) {
      console.warn('[MemWal REST] Server link unavailable. Retained in IndexedDB.', error);
    }
    return false;
  },

  /**
   * Save a chat message.
   * Primary: proxy remember() via backend.
   * Fallback: IndexedDB + server REST API.
   */
  async saveChat(chat: ChatMessage): Promise<boolean> {
    await localStore.saveChat(chat);

    // Try Walrus via backend proxy
    try {
      const memoryText = [
        `[CHAT]`,
        `id: ${chat.id}`,
        `matchId: ${chat.matchId || 'global'}`,
        `sender: ${chat.sender}`,
        `timestamp: ${chat.timestamp}`,
        `text: ${chat.text}`,
        `wallet: ${chat.walletAddress || 'anonymous'}`,
      ].join('\n');

      const ok = await proxyRemember(memoryText);
      if (ok) {
        console.log('[MemWal Proxy] ✅ Chat committed to chain:', chat.id);
        return true;
      }
    } catch (e) {
      console.warn('[MemWal Proxy] remember() failed, using REST fallback:', e);
    }

    // REST API fallback
    try {
      const res = await fetch('/api/memwal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chat),
      });
      if (res.ok) {
        console.log('[MemWal REST] Sync successful for chat:', chat.id);
        return true;
      }
    } catch (e) {
      console.warn('[MemWal REST] Server link unavailable.', e);
    }
    return false;
  },

  /**
   * Load all predictions and chats.
   * Primary: proxy recall() from Walrus via backend.
   * Fallback: REST server → IndexedDB.
   */
  async syncLoadAll(): Promise<MemWalData> {
    // Try Walrus recall via backend proxy
    try {
      const [predMemories, chatMemories] = await Promise.all([
        proxyRecall('football match prediction choice reasoning resolved correct', 10, 0.5),
        proxyRecall('chat message football match discussion AI pundit', 10, 0.5),
      ]);

      const predictions = parsePredictionsFromMemories(predMemories);
      const chats = parseChatsFromMemories(chatMemories);

      if (predictions.length > 0 || chats.length > 0) {
        console.log(`[MemWal Proxy] ✅ Recalled ${predictions.length} predictions, ${chats.length} chats from chain.`);
        // Backfill local store
        for (const p of predictions) await localStore.savePrediction(p);
        for (const c of chats) await localStore.saveChat(c);
        return { predictions, chats };
      }
    } catch (e) {
      console.warn('[MemWal Proxy] recall() failed, using REST fallback:', e);
    }

    // REST API fallback
    try {
      const res = await fetch('/api/memwal/data');
      if (res.ok) {
        const serverData: MemWalData = await res.json();
        console.log('[MemWal REST] Server-synchronization completed.');
        for (const pred of serverData.predictions) await localStore.savePrediction(pred);
        for (const ch of serverData.chats) await localStore.saveChat(ch);
        return serverData;
      }
    } catch (e) {
      console.warn('[MemWal REST] Sync failed. Loading offline IndexedDB data.', e);
    }

    // Final offline fallback: IndexedDB
    const localPredictions = await localStore.getPredictions();
    const localChats = await localStore.getChats();
    return { predictions: localPredictions, chats: localChats };
  },

  /**
   * Trigger server-side match resolution (unchanged REST endpoint)
   */
  async simulateMatchResult(matchId: string, homeScore: number, awayScore: number): Promise<boolean> {
    try {
      const res = await fetch('/api/memwal/resolve-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, homeScore, awayScore }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to communicate match resolution to server', e);
      return false;
    }
  },

  /**
   * Expose SDK health/status for UI display via backend proxy.
   */
  async getStatus(): Promise<{ sdk: boolean; offline: boolean }> {
    const connected = await proxyHealth();
    if (connected) return { sdk: true, offline: false };
    return { sdk: false, offline: true };
  },
};

// ─── Memory Parsers ────────────────────────────────────────────────────────

/**
 * Parse free-text MemWal memories back into Prediction objects.
 * Memories were stored in a structured key: value format.
 */
function parsePredictionsFromMemories(memories: Array<{ text: string }>): Prediction[] {
  const results: Prediction[] = [];

  for (const mem of memories) {
    try {
      if (!mem.text.includes('[PREDICTION]')) continue;

      const lines: Record<string, string> = {};
      for (const line of mem.text.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const k = line.slice(0, colonIdx).trim();
          const v = line.slice(colonIdx + 1).trim();
          lines[k] = v;
        }
      }

      if (!lines['id'] || !lines['matchId'] || !lines['choice']) continue;

      const choice = lines['choice'] as 'home' | 'draw' | 'away';
      if (!['home', 'draw', 'away'].includes(choice)) continue;

      results.push({
        id: lines['id'],
        matchId: lines['matchId'],
        choice,
        reasoning: lines['reasoning'] === 'none' ? '' : (lines['reasoning'] || ''),
        timestamp: lines['timestamp'] || new Date().toISOString(),
        isResolved: lines['resolved'] === 'true',
        wasCorrect: lines['correct'] === 'true' ? true
          : lines['correct'] === 'false' ? false
          : undefined,
      });
    } catch {
      // Skip malformed memories silently
    }
  }

  // Deduplicate by id (keep latest)
  const seen = new Map<string, Prediction>();
  for (const p of results) seen.set(p.id, p);
  return Array.from(seen.values());
}

/**
 * Parse free-text MemWal memories back into ChatMessage objects.
 */
function parseChatsFromMemories(memories: Array<{ text: string }>): ChatMessage[] {
  const results: ChatMessage[] = [];

  for (const mem of memories) {
    try {
      if (!mem.text.includes('[CHAT]')) continue;

      const lines: Record<string, string> = {};
      for (const line of mem.text.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const k = line.slice(0, colonIdx).trim();
          const v = line.slice(colonIdx + 1).trim();
          lines[k] = v;
        }
      }

      if (!lines['id'] || !lines['sender'] || !lines['text']) continue;

      const sender = lines['sender'] as 'user' | 'ai';
      if (!['user', 'ai'].includes(sender)) continue;

      results.push({
        id: lines['id'],
        sender,
        text: lines['text'],
        timestamp: lines['timestamp'] || new Date().toISOString(),
        matchId: lines['matchId'] !== 'global' ? lines['matchId'] : undefined,
      });
    } catch {
      // Skip malformed memories silently
    }
  }

  const seen = new Map<string, ChatMessage>();
  for (const c of results) seen.set(c.id, c);
  return Array.from(seen.values());
}
