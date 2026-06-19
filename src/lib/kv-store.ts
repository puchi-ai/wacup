/**
 * KV Store — Persistent Storage Adapter
 *
 * Production (Vercel): Uses Upstash Redis via @upstash/redis SDK with Redis.fromEnv().
 * Development (local):   Uses filesystem-backed JSON files.
 *
 * Environment variables for production:
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — set via Upstash Vercel Integration
 *
 * On Vercel, KV credentials are auto-injected when you add the
 * Upstash Redis integration via the Vercel Marketplace.
 */

import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

// ─── Upstash Redis Implementation (Production) ────────────────────────────

function createUpstashStore(): KVStore | null {
  try {
    const redis = Redis.fromEnv();
    // Quick connectivity check
    return {
      async get<T>(key: string): Promise<T | null> {
        try {
          const val = await redis.get(key);
          if (val === null) return null;
          // Redis.fromEnv() returns parsed JSON automatically
          return val as T;
        } catch {
          return null;
        }
      },

      async set(key: string, value: unknown): Promise<void> {
        try {
          await redis.set(key, value);
        } catch {
          // silently fail
        }
      },

      async del(key: string): Promise<void> {
        try {
          await redis.del(key);
        } catch {
          // silently fail
        }
      },

      async keys(pattern: string): Promise<string[]> {
        try {
          return await redis.keys(pattern);
        } catch {
          return [];
        }
      },
    };
  } catch {
    return null;
  }
}

// ─── Filesystem Implementation (Vercel /tmp or Local Dev) ──────────────────

/**
 * On Vercel, process.cwd() is read-only. Only /tmp is writable.
 * We detect Vercel via the VERCEL env var and use /tmp/data/ there.
 */
function getDataDir(): string {
  if (process.env.VERCEL === '1') {
    return '/tmp/data';
  }
  return path.join(process.cwd(), 'data');
}

const DATA_DIR = getDataDir();

/**
 * Ensure the data directory exists. Returns true if ready, false on failure.
 * Never throws — so module-level initialization won't crash on Vercel.
 */
function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch {
    console.warn(`[KV Store] Cannot create data directory: ${DATA_DIR}. Storage unavailable.`);
    return false;
  }
}

function filePathForKey(key: string): string {
  // Sanitize key to a valid filename
  const safeName = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeName}.json`);
}

function createFileStore(): KVStore | null {
  if (!ensureDataDir()) {
    return null;
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const fp = filePathForKey(key);
        if (!fs.existsSync(fp)) return null;
        const raw = fs.readFileSync(fp, 'utf-8');
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },

    async set(key: string, value: unknown): Promise<void> {
      try {
        const fp = filePathForKey(key);
        ensureDataDir();
        fs.writeFileSync(fp, JSON.stringify(value, null, 2), 'utf-8');
      } catch {
        // silently fail
      }
    },

    async del(key: string): Promise<void> {
      try {
        const fp = filePathForKey(key);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        // silently fail
      }
    },

    async keys(_pattern: string): Promise<string[]> {
      try {
        ensureDataDir();
        const files = fs.readdirSync(DATA_DIR);
        return files
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace(/\.json$/, ''));
      } catch {
        return [];
      }
    },
  };
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _store: KVStore | null = null;

/**
 * Get the singleton KV store instance.
 *
 * Priority:
 *   1. Upstash Redis (via @upstash/redis Redis.fromEnv())
 *   2. Filesystem (fallback for local dev, or /tmp on Vercel)
 *
 * This function is called at module scope. It wraps all creation in try-catch
 * so that a storage failure NEVER crashes the serverless function.
 */
export function getKVStore(): KVStore {
  if (_store) return _store;

  try {
    // Try Upstash Redis via @upstash/redis SDK
    const upstash = createUpstashStore();
    if (upstash) {
      console.log('[KV Store] ✅ Using Upstash Redis (@upstash/redis SDK)');
      _store = upstash;
      return _store;
    }

    // Fallback to filesystem
    const isOnVercel = process.env.VERCEL === '1';
    console.log(`[KV Store] ${isOnVercel ? '⚠️  No Upstash Redis configured — using /tmp/ (data lost on cold start)' : '📁 Using filesystem (local dev)'}`);
    const fileStore = createFileStore();
    if (fileStore) {
      _store = fileStore;
      return _store;
    }

    // Last resort: null object pattern (no-op store)
    console.warn('[KV Store] ❌ All storage backends failed. Using in-memory fallback (data NOT persisted).');
    _store = createNoopStore();
    return _store;
  } catch (e) {
    console.error('[KV Store] ❌ Storage initialization failed catastrophically:', e);
    _store = createNoopStore();
    return _store;
  }
}

/**
 * No-op KV store that keeps data in memory only.
 * Used as a last resort when filesystem and Upstash are both unavailable.
 */
function createNoopStore(): KVStore {
  const mem = new Map<string, string>();
  return {
    async get<T>(key: string): Promise<T | null> {
      const val = mem.get(key);
      if (!val) return null;
      try { return JSON.parse(val) as T; } catch { return null; }
    },
    async set(key: string, value: unknown): Promise<void> {
      mem.set(key, JSON.stringify(value));
    },
    async del(key: string): Promise<void> {
      mem.delete(key);
    },
    async keys(_pattern: string): Promise<string[]> {
      return Array.from(mem.keys());
    },
  };
}

/**
 * Check if the KV store is backed by Upstash Redis (production).
 * Checks for UPSTASH_REDIS_REST_URL env var.
 */
export function isRemoteKV(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
}

// ─── Named KV Keys ─────────────────────────────────────────────────────────

export const KV_KEYS = {
  PREDICTIONS: 'predictions',
  CHATS: 'chats',
  MATCH_OVERRIDES: 'match-overrides',
  MATCHES_CACHE: 'matches-cache',
} as const;
