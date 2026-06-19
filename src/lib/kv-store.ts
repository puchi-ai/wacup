/**
 * KV Store — Persistent Storage Adapter
 *
 * Production (Vercel): Uses Upstash Redis (formerly Vercel KV).
 * Development (local):   Uses filesystem-backed JSON files.
 *
 * Environment variables for production:
 *   UPSTASH_REDIS_REST_URL  — URL from Upstash console
 *   UPSTASH_REDIS_REST_TOKEN — Token from Upstash console
 *
 * On Vercel, these are auto-injected when you add "Vercel KV" via the
 * Marketplace integration (it provisions an Upstash Redis instance).
 */

import fs from 'fs';
import path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

// ─── Upstash Redis Implementation (Production) ────────────────────────────

function createUpstashStore(): KVStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  // Minimal fetch-based REST client — no native SDK dependency required
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers });
        if (!res.ok) return null;
        const data = await res.json() as { result: string | null };
        return data.result ? (JSON.parse(data.result) as T) : null;
      } catch {
        return null;
      }
    },

    async set(key: string, value: unknown): Promise<void> {
      try {
        await fetch(`${url}/set/${encodeURIComponent(key)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(value),
        });
      } catch {
        // silently fail
      }
    },

    async del(key: string): Promise<void> {
      try {
        await fetch(`${url}/del/${encodeURIComponent(key)}`, {
          method: 'POST',
          headers,
        });
      } catch {
        // silently fail
      }
    },

    async keys(pattern: string): Promise<string[]> {
      try {
        const res = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, { headers });
        if (!res.ok) return [];
        const data = await res.json() as { result: string[] };
        return data.result || [];
      } catch {
        return [];
      }
    },
  };
}

// ─── Filesystem Implementation (Local Dev) ────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePathForKey(key: string): string {
  // Sanitize key to a valid filename
  const safeName = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeName}.json`);
}

function createFileStore(): KVStore {
  ensureDataDir();

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
 *   1. Upstash Redis (if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set)
 *   2. Filesystem (fallback for local dev)
 */
export function getKVStore(): KVStore {
  if (_store) return _store;

  // Try Upstash first
  const upstash = createUpstashStore();
  if (upstash) {
    console.log('[KV Store] ✅ Using Upstash Redis (Vercel KV)');
    _store = upstash;
    return _store;
  }

  // Fallback to filesystem
  console.log('[KV Store] 📁 Using filesystem (local dev)');
  _store = createFileStore();
  return _store;
}

/**
 * Check if the KV store is backed by Upstash Redis (production).
 */
export function isRemoteKV(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ─── Named KV Keys ─────────────────────────────────────────────────────────

export const KV_KEYS = {
  PREDICTIONS: 'predictions',
  CHATS: 'chats',
  MATCH_OVERRIDES: 'match-overrides',
  MATCHES_CACHE: 'matches-cache',
} as const;
