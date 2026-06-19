/**
 * Vercel Serverless Entry Point
 *
 * Imports the Express app from server.ts and exports it as the default
 * handler for Vercel's @vercel/node runtime. Vercel handles all incoming
 * HTTP requests through this single serverless function, routing them
 * to the correct Express middleware.
 *
 * Rewrites in vercel.json send all /api/(.*) and / requests here.
 *
 * ## Error Handling
 * If the Express app fails to initialize (e.g., missing deps, env var
 * issues), this module exports a fallback handler that returns diagnostic
 * information to help debug the issue.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Try to load the Express app ──────────────────────────────────────────

let app: import('express').Express | null = null;
let initError: string | null = null;
let initErrorStack: string | null = null;

async function loadApp() {
  try {
    const mod = await import('../app.js');
    app = mod.default;
    console.log('[Vercel] ✅ Express app loaded successfully.');
  } catch (e: any) {
    initError = e?.message || 'Unknown error loading Express app';
    initErrorStack = e?.stack || null;
    console.error('[Vercel] ❌ Failed to load Express app:', e);
  }
}

// Start loading immediately (non-blocking — first request may need to wait)
const loadPromise = loadApp();

// ─── Fallback Express Router (for diagnostics when app fails) ─────────────

import express from 'express';

const fallbackApp = express();
fallbackApp.use(express.json());

// Bare-minimum health check (works even without the main app)
fallbackApp.get('/api/health', (_req, res) => {
  res.json({
    status: initError ? 'error' : (app ? 'ok' : 'loading'),
    appLoaded: !!app,
    initError,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,
    memory: process.memoryUsage(),
  });
});

// Simple env var check (shows which vars are set, without values)
fallbackApp.get('/api/env-check', (_req, res) => {
  const vars = [
    'OPENROUTER_API_KEY',
    'MEMWAL_PRIVATE_KEY',
    'MEMWAL_ACCOUNT_ID',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
    'VERCEL_REGION',
    'AI_MODEL',
    'APP_URL',
    'VITE_SUI_PACKAGE_ID',
    'VITE_SUI_MARKET_ID',
    'NODE_ENV',
  ];
  const envVars: Record<string, { set: boolean; length: number }> = {};
  for (const v of vars) {
    const val = process.env[v];
    envVars[v] = { set: !!val, length: val ? val.length : 0 };
  }
  res.json({ envVars, initError });
});

// ─── Export Handler ───────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure the app is loaded
  if (!app) {
    await loadPromise;
  }

  if (app) {
    // Forward to the Express app
    app(req, res);
  } else {
    // Use fallback for basic endpoints; otherwise return 503
    const path = req.url || '';
    if (path.startsWith('/api/health') || path.startsWith('/api/env-check')) {
      fallbackApp(req, res);
    } else {
      res.status(503).json({
        error: 'Express app failed to initialize',
        message: initError,
        stack: initErrorStack,
        hints: [
          'Check your environment variables are set in the Vercel dashboard.',
          'Check Vercel Function Logs for detailed error output.',
          'Visit /api/health or /api/env-check for more diagnostics.',
          'Ensure all dependencies are installed (npm install ran successfully).',
        ],
      });
    }
  }
}
