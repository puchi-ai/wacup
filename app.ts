/**
 * app.ts — Shared Express Application
 *
 * Contains the Express app, all API routes, data loading/saving, and AI model
 * setup. Does NOT include any Vite dev server or static file serving — those
 * are handled by server.ts (local dev) and api/index.ts (Vercel serverless).
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { withMemWal } from '@mysten-incubation/memwal/ai';
import dotenv from 'dotenv';
import { Match, Prediction, ChatMessage } from './src/types.js';
import { mockMatches } from './src/mockData.js';
import { fetchWorldCup2026Matches, getCacheInfo as getWorldCupCacheInfo, clearCache as clearWorldCupCache } from './src/lib/worldcup-api.js';
import { getMemWalServer, isMemWalReady } from './src/lib/memwal-server.js';
import { getKVStore, KV_KEYS } from './src/lib/kv-store.js';

dotenv.config();

const app = express();

app.use(express.json());

// ─── KV Store (Upstash Redis in prod, filesystem in dev) ─────────────────

const kv = getKVStore();

// ─── Match Overrides Store ────────────────────────────────────────────────

async function loadMatchOverrides(): Promise<Record<string, { homeScore: number; awayScore: number }>> {
  try {
    const data = await kv.get<Record<string, { homeScore: number; awayScore: number }>>(KV_KEYS.MATCH_OVERRIDES);
    return data || {};
  } catch {
    return {};
  }
}

async function saveMatchOverrides(overrides: Record<string, { homeScore: number; awayScore: number }>) {
  await kv.set(KV_KEYS.MATCH_OVERRIDES, overrides);
  console.log('[Match Data] Persisted match result overrides.');
}

// ─── Predictions ──────────────────────────────────────────────────────────

async function loadPredictions(): Promise<Prediction[]> {
  try {
    const data = await kv.get<Prediction[]>(KV_KEYS.PREDICTIONS);
    return data || [];
  } catch {
    return [];
  }
}

async function savePredictions(preds: Prediction[]) {
  await kv.set(KV_KEYS.PREDICTIONS, preds);
}

// ─── Chats ────────────────────────────────────────────────────────────────

async function loadChats(): Promise<ChatMessage[]> {
  try {
    const data = await kv.get<ChatMessage[]>(KV_KEYS.CHATS);
    return data || [];
  } catch {
    return [];
  }
}

async function saveChats(chats: ChatMessage[]) {
  await kv.set(KV_KEYS.CHATS, chats);
}

// ─── Match Cache ──────────────────────────────────────────────────────────

let _matchCache: Match[] | null = null;

async function loadMatches(): Promise<Match[]> {
  const overrides = await loadMatchOverrides();

  // Try to get live data from OpenFootball
  try {
    const result = await fetchWorldCup2026Matches();
    if (result.matches.length > 0) {
      _matchCache = result.matches.map(m => {
        const override = overrides[m.id];
        if (override) {
          return { ...m, status: 'completed' as const, homeScore: override.homeScore, awayScore: override.awayScore };
        }
        return m;
      });
      console.log(`[Match Data] Loaded ${_matchCache.length} matches from OpenFootball (source: ${result.source})`);
      return _matchCache;
    }
  } catch (e) {
    console.warn('[Match Data] OpenFootball fetch failed, trying fallback:', e);
  }

  // Fallback: mock data with overrides
  console.log('[Match Data] Falling back to bundled mock data.');
  const matches: Match[] = JSON.parse(JSON.stringify(mockMatches));
  const result = matches.map(m => {
    const override = overrides[m.id];
    if (override) {
      return { ...m, status: 'completed' as const, homeScore: override.homeScore, awayScore: override.awayScore };
    }
    return m;
  });
  _matchCache = result;
  return result;
}

async function saveMatches(matches: Match[]) {
  const overrides: Record<string, { homeScore: number; awayScore: number }> = {};
  for (const match of matches) {
    if (match.status === 'completed') {
      overrides[match.id] = {
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
      };
    }
  }
  await saveMatchOverrides(overrides);
}

// Initial match data load (non-blocking — errors are logged internally)
clearWorldCupCache();
loadMatches().catch(e => console.warn('[Match Data] Initial load failed:', e));

// ─── Model Setup: OpenRouter + Walrus Memory ─────────────────────────────

let aiModel: any = null;
let memwalAvailable = false;
let currentModelId = 'meta-llama/llama-4-scout:free';
let customOpenAI: ReturnType<typeof createOpenAI> | null = null;

let _withMemWalConfig: {
  key: string;
  accountId: string;
  serverUrl: string;
  namespace: string;
  maxMemories: number;
  autoSave: boolean;
  minRelevance: number;
} | null = null;

function wrapModelWithMemory(model: any): any {
  if (!_withMemWalConfig) return model;
  try {
    return withMemWal(model, _withMemWalConfig);
  } catch {
    return model;
  }
}

function initAIModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const memwalKey = process.env.MEMWAL_PRIVATE_KEY;
  const memwalAccount = process.env.MEMWAL_ACCOUNT_ID;

  if (!apiKey) {
    console.warn('[AI Model] WARNING: OPENROUTER_API_KEY is missing. AI features will fallback to deterministic analysis.');
    return;
  }

  currentModelId = process.env.AI_MODEL || 'meta-llama/llama-4-scout:free';

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  customOpenAI = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': appUrl,
      'X-Title': 'AI Match Predictor',
    },
  });

  if (memwalKey && memwalAccount) {
    _withMemWalConfig = {
      key: memwalKey,
      accountId: memwalAccount,
      serverUrl: process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz',
      namespace: process.env.MEMWAL_NAMESPACE || 'ai-match-predictor',
      maxMemories: 8,
      autoSave: true,
      minRelevance: 0.25,
    };
  }

  const baseModel = customOpenAI.chat(currentModelId);

  if (memwalKey && memwalAccount) {
    try {
      aiModel = wrapModelWithMemory(baseModel);
      memwalAvailable = true;
      console.log(`[AI Model] ✅ ${currentModelId} + Walrus Memory (withMemWal) initialized via OpenRouter.`);
    } catch (e) {
      console.warn('[AI Model] withMemWal init failed, falling back to base model:', e);
      aiModel = baseModel;
    }
  } else {
    aiModel = baseModel;
    console.log(`[AI Model] ${currentModelId} initialized via OpenRouter (without Walrus Memory middleware).`);
  }
}

initAIModel();

(async () => {
  try {
    await getMemWalServer();
  } catch (e) {
    console.warn('[MemWal Server] Background init failed:', e);
  }
})();

// ================= API ENDPOINTS =================

app.get('/api/matches', async (req, res) => {
  try {
    const matches = await loadMatches();
    res.json(matches);
  } catch (e: any) {
    console.error('[API /api/matches] Error:', e);
    res.status(500).json({ error: 'Failed to load match data: ' + e.message });
  }
});

// Shared logic for refreshing match cache (used by both POST and GET/cron)
async function refreshMatchCache(forceRefresh: boolean) {
  const result = await fetchWorldCup2026Matches(forceRefresh);
  const overrides = await loadMatchOverrides();
  _matchCache = result.matches.map(m => {
    const override = overrides[m.id];
    if (override) {
      return { ...m, status: 'completed' as const, homeScore: override.homeScore, awayScore: override.awayScore };
    }
    return m;
  });
  return result;
}

app.post('/api/refresh-matches', async (req, res) => {
  try {
    const result = await refreshMatchCache(true);
    res.json({
      status: 'success',
      matches: _matchCache!.length,
      source: result.source,
      fetchedAt: result.fetchedAt,
      error: result.error || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET handler for Vercel daily cron (rewrites hit api/index.ts)
app.get('/api/refresh-matches', async (req, res) => {
  try {
    const forceRefresh = req.query.force === 'true' || req.query.action === 'refresh';
    const result = await refreshMatchCache(forceRefresh);
    res.json({
      status: 'success',
      message: forceRefresh ? 'Cache refreshed from OpenFootball' : 'Cache checked',
      matches: _matchCache!.length,
      source: result.source,
      fetchedAt: result.fetchedAt,
      error: result.error || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/matches/cache-info', (req, res) => {
  const info = getWorldCupCacheInfo();
  res.json({
    cached: info.isCached,
    count: _matchCache?.length || 0,
    ...info,
  });
});

app.get('/api/memwal/data', async (req, res) => {
  const [predictions, chats] = await Promise.all([loadPredictions(), loadChats()]);
  res.json({ predictions, chats });
});

app.post('/api/memwal/prediction', async (req, res) => {
  try {
    const newPred = req.body as Prediction;
    if (!newPred || !newPred.id || !newPred.matchId) {
      res.status(400).json({ error: 'Invalid prediction data format.' });
      return;
    }

    const current = await loadPredictions();
    const index = current.findIndex(p => p.id === newPred.id);
    if (index >= 0) {
      current[index] = newPred;
    } else {
      current.push(newPred);
    }
    await savePredictions(current);
    console.log('[MemWal WAL] Appended prediction log:', newPred.id);
    res.json({ status: 'success', id: newPred.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memwal/chat', async (req, res) => {
  try {
    const chat = req.body as ChatMessage;
    if (!chat || !chat.id || !chat.text) {
      res.status(400).json({ error: 'Invalid chat message format.' });
      return;
    }

    const current = await loadChats();
    const index = current.findIndex(c => c.id === chat.id);
    if (index >= 0) {
      current[index] = chat;
    } else {
      current.push(chat);
    }
    await saveChats(current);
    console.log('[MemWal WAL] Appended chat message log:', chat.id);
    res.json({ status: 'success', id: chat.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memwal/resolve-match', async (req, res) => {
  const { matchId, homeScore, awayScore } = req.body;
  if (!matchId || homeScore === undefined || awayScore === undefined) {
    res.status(400).json({ error: 'Missing parameters.' });
    return;
  }

  const matches = await loadMatches();
  const matchIndex = matches.findIndex(m => m.id === matchId);
  if (matchIndex < 0) {
    res.status(404).json({ error: 'Match not found.' });
    return;
  }

  const match = matches[matchIndex];
  if (match.status === 'completed') {
    res.status(400).json({ error: 'Match is already completed.' });
    return;
  }

  match.status = 'completed';
  match.homeScore = homeScore;
  match.awayScore = awayScore;
  await saveMatches(matches);

  let correctChoice: 'home' | 'draw' | 'away' = 'draw';
  if (homeScore > awayScore) {
    correctChoice = 'home';
  } else if (awayScore > homeScore) {
    correctChoice = 'away';
  }

  const predictions = await loadPredictions();
  let updatedCount = 0;
  const updatedPredictions = predictions.map(pred => {
    if (pred.matchId === matchId && !pred.isResolved) {
      updatedCount++;
      return { ...pred, isResolved: true, wasCorrect: pred.choice === correctChoice };
    }
    return pred;
  });

  if (updatedCount > 0) {
    await savePredictions(updatedPredictions);
  }

  console.log(`[MemWal WAL] Match ${matchId} resolved as ${homeScore}-${awayScore}. Evaluated ${updatedCount} predictions.`);
  res.json({ status: 'success', match, predictionsEvaluated: updatedCount });
});

// ─── MemWal Proxy Routes ────────────────────────────────────────────────

app.get('/api/memwal/health', async (req, res) => {
  try {
    const mw = await getMemWalServer();
    if (!mw) {
      res.json({ connected: false, offline: true });
      return;
    }
    await mw.health();
    res.json({ connected: true, offline: false });
  } catch (e: any) {
    res.json({ connected: false, offline: false, error: e?.message || 'Health check failed' });
  }
});

app.post('/api/memwal/remember', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Missing or invalid text field.' });
      return;
    }

    const mw = await getMemWalServer();
    if (!mw) {
      res.status(503).json({ error: 'MemWal SDK not initialized on server.' });
      return;
    }

    const job = await mw.remember(text);
    await mw.waitForRememberJob(job.job_id);
    res.json({ status: 'success', job_id: job.job_id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'remember() failed' });
  }
});

app.post('/api/memwal/recall', async (req, res) => {
  try {
    const { query, limit, maxDistance } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Missing or invalid query field.' });
      return;
    }

    const mw = await getMemWalServer();
    if (!mw) {
      res.status(503).json({ error: 'MemWal SDK not initialized on server.' });
      return;
    }

    const result = await mw.recall({
      query,
      limit: typeof limit === 'number' ? limit : 10,
      maxDistance: typeof maxDistance === 'number' ? maxDistance : 1.0,
    });

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'recall() failed' });
  }
});

app.post('/api/memwal/reset', async (req, res) => {
  try {
    await saveMatchOverrides({});
    await savePredictions([]);
    await saveChats([]);
    // Clear local cache file too if it exists
    const MATCHES_FILE = path.join(process.cwd(), 'data', 'matches.json');
    if (fs.existsSync(MATCHES_FILE)) {
      fs.unlinkSync(MATCHES_FILE);
    }
    res.json({ status: 'success', message: 'All data cleared. Fresh fixtures loaded.' });
  } catch (e: any) {
    res.status(500).json({ error: 'Reset failed: ' + e.message });
  }
});

// ─── Pundit Style System Prompts ──────────────────────────────────────────

const PUNDIT_PROMPTS: Record<string, string> = {
  'british-pundit': `You are an elite sports analyst with a highly engaging, professional, and slightly witty British pundit style — like a BBC Match of the Day commentator.`,
  'data-analyst': `You are a cold, ruthlessly analytical football data scientist. You speak exclusively in statistics, probabilities, xG, percentiles, and historical trends.`,
  'passionate-fan': `You are an utterly passionate, hyperbolic, and emotionally charged football commentator. The beautiful game is ART to you.`,
  'tactical-coach': `You are a deep-thinking tactical analyst and former coach. You break down formations, pressing triggers, defensive shapes, transition phases.`,
  'veteran-legend': `You are a wise, seasoned football veteran who has seen it all. You speak with gravitas, authority, and a touch of nostalgia.`,
  'ruthless-critic': `You are a brutally honest, no-nonsense pundit. You do not sugarcoat. You call out poor performance, weak mentality, and bad tactics with sharp honesty.`,
};

function buildSystemPrompt(
  match: Match,
  userPrediction: Prediction | undefined,
  userAccuracy: number | null,
  historicPredictionsCount: number,
  walletAddress: string | undefined,
  styleId: string,
): string {
  const persona = PUNDIT_PROMPTS[styleId] || PUNDIT_PROMPTS['british-pundit'];

  return [
    persona,
    '',
    `MATCH: ${match.homeTeam} vs ${match.awayTeam} (${match.competition}) @ ${match.venue}`,
    `ODDS: ${match.odds?.home || 'N/A'}/${match.odds?.draw || 'N/A'}/${match.odds?.away || 'N/A'}`,
    `CONTEXT: ${match.details}`,
    '',
    `USER: ${userPrediction ? `predicted ${userPrediction.choice.toUpperCase()} — \"${userPrediction.reasoning || '-'}\"` : 'no prediction yet'}`,
    ...(userAccuracy !== null
      ? [`ACCURACY: ${userAccuracy}% (${historicPredictionsCount} resolved)`]
      : []),
    `WALLET: ${walletAddress || 'none'}`,
    '',
    'RULES: 1) Address prediction with tactical insight 2) Reference past memories naturally 3) Max 150 words 4) No betting advice',
  ].join('\n');
}

// ─── AI Discuss Endpoint ──────────────────────────────────────────────────

app.post('/api/ai/discuss', async (req, res) => {
  const { matchId, messages, style: rawStyle } = req.body;
  if (!matchId) {
    res.status(400).json({ error: 'Missing match context.' });
    return;
  }

  const matches = await loadMatches();
  const match = matches.find(m => m.id === matchId);
  if (!match) {
    res.status(404).json({ error: 'Associated match not found.' });
    return;
  }

  const predictions = await loadPredictions();
  const userPrediction = predictions.find(p => p.matchId === matchId);
  const historicPredictionsCount = predictions.filter(p => p.isResolved).length;
  const correctCount = predictions.filter(p => p.isResolved && p.wasCorrect).length;

  const userAccuracy = historicPredictionsCount > 0
    ? Math.round((correctCount / historicPredictionsCount) * 100)
    : null;

  const chatHistoryContext = messages || [];

  const systemPrompt = buildSystemPrompt(
    match,
    userPrediction,
    userAccuracy,
    historicPredictionsCount,
    req.body.walletAddress,
    rawStyle || 'british-pundit',
  );

  const useStreaming = req.body.stream === true;

  if (aiModel) {
    try {
      const requestedModel = req.body.model ?? currentModelId;
      const modelToUse = requestedModel !== currentModelId
        ? wrapModelWithMemory(customOpenAI!.chat(requestedModel))
        : null;
      const activeModel = modelToUse || aiModel;

      const formattedMessages = chatHistoryContext.map((msg: any) => ({
        role: msg.sender === 'ai' ? 'assistant' as const : 'user' as const,
        content: msg.text,
      }));

      console.log(`[AI] Calling ${requestedModel} via OpenRouter (streaming: ${useStreaming})...`);

      if (useStreaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const result = await streamText({
          model: activeModel,
          system: systemPrompt,
          messages: formattedMessages,
          temperature: 0.7,
          maxOutputTokens: 300,
        });

        for await (const chunk of result.textStream) {
          res.write(`data: ${JSON.stringify({ t: chunk })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ done: true, model: requestedModel })}\n\n`);
        res.end();
      } else {
        const result = await generateText({
          model: activeModel,
          system: systemPrompt,
          messages: formattedMessages,
          temperature: 0.7,
          maxOutputTokens: 300,
        });

        const responseText = result.text || 'I was unable to formulate a tactical report at this time. Let us await kickoff!';
        console.log(`[AI] ✅ ${requestedModel} responded successfully.`);
        res.json({ text: responseText, model: requestedModel });
      }
    } catch (e: any) {
      console.error('[AI] ❌ Generation failed:', e?.message || e);
      if (res.headersSent || useStreaming) {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream');
        }
        const errMsg = e?.message || 'Generation failed';
        res.write(`data: ${JSON.stringify({ t: errMsg })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, error: errMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: 'AI generation error: ' + (e?.message || 'Unknown error') });
      }
    }
  } else {
    // Fallback when no AI model is configured
    let fallbackText = '';
    if (userPrediction) {
      fallbackText = `Indeed! Speaking tactically about your prediction for ${userPrediction.choice.toUpperCase()}: `;
      if (userPrediction.choice === 'home') {
        fallbackText += `${match.homeTeam} holds a brilliant record at ${match.venue}. Your choice makes complete strategic sense considering their home momentum!`;
      } else if (userPrediction.choice === 'away') {
        fallbackText += `Backing the underdogs ${match.awayTeam} away is a brave call, but with their counter-attacking speed, they could definitely spring a surprise.`;
      } else {
        fallbackText += `A draw is a very pragmatic choice. These two powerhouses are evenly matched, and a tight tactical stalemate seems highly likely here.`;
      }
    } else {
      fallbackText = `The clash between ${match.homeTeam} and ${match.awayTeam} is a fascinating tactical matchup. ${match.homeTeam} is entering with strong offensive form, but ${match.awayTeam}'s defense is extremely compact. I'd recommend making a prediction now so we can record your choice in the MemWal!`;
    }

    if (userAccuracy && userAccuracy > 60) {
      fallbackText += ` Given your impressive accuracy of ${userAccuracy}% in our logs, I'm inclined to trust your instinct!`;
    }

    setTimeout(() => {
      res.json({ text: fallbackText, model: null });
    }, 1200);
  }
});

// ─── Vercel Diagnostics ─────────────────────────────────────────────────

// Track server start time for uptime monitoring
const SERVER_START_TIME = Date.now();

/**
 * GET /api/health — Quick health check endpoint
 * Consistent with the fallback in api/index.ts
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appLoaded: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
});

/**

/**
 * GET /api/debug — Comprehensive Vercel diagnostics endpoint
 *
 * Returns a full snapshot of the server's health, configuration, and
 * environment. Useful for debugging deployment issues on Vercel.
 *
 * Response format:
 * {
 *   status: 'ok' | 'degraded' | 'error',
 *   timestamp: string,
 *   environment: { node, platform, vercel, ... },
 *   config: { envVars: { ... }, ... },
 *   services: { kv, memwal, ai, matches, ... },
 *   errors: string[]  // accumulated errors
 * }
 */
app.get('/api/debug', async (req, res) => {
  const diagnostics: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
  };

  const errors: string[] = [];

  // ── Environment ───────────────────────────────────────────────────────
  diagnostics.environment = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    cwd: process.cwd(),
    vercel: {
      isVercel: !!(process.env.VERCEL === '1' || process.env.VERCEL_ENV),
      env: process.env.VERCEL_ENV || null,
      url: process.env.VERCEL_URL || null,
      region: process.env.VERCEL_REGION || null,
    },
  };

  // ── Environment Variables (presence only, no values) ──────────────────
  const requiredVars = [
    'OPENROUTER_API_KEY',
    'MEMWAL_PRIVATE_KEY',
    'MEMWAL_ACCOUNT_ID',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'AI_MODEL',
    'VITE_SUI_PACKAGE_ID',
    'VITE_SUI_MARKET_ID',
  ];
  const envVars: Record<string, { present: boolean; length: number; source: string }> = {};
  for (const v of requiredVars) {
    const val = process.env[v];
    envVars[v] = {
      present: !!val,
      length: val ? val.length : 0,
      source: val ? (val.startsWith('vercel_') ? 'vercel_inject' : 'user_set') : 'missing',
    };
  }
  diagnostics.config = { envVars };

  // ── Filesystem Access ─────────────────────────────────────────────────
  try {
    const testDir = process.env.VERCEL === '1' ? '/tmp' : process.cwd();
    const canRead = fs.existsSync(testDir);
    let canWrite = false;
    const testFile = path.join(testDir, '.vercel-debug-test');
    try {
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      canWrite = true;
    } catch {
      canWrite = false;
    }

    const distExists = fs.existsSync(path.join(process.cwd(), 'dist'));
    const dataDir = process.env.VERCEL === '1' ? '/tmp/data' : path.join(process.cwd(), 'data');
    const dataExists = fs.existsSync(dataDir);

    diagnostics.filesystem = {
      cwd: process.cwd(),
      testDir,
      canRead,
      canWrite,
      distExists,
      dataDir,
      dataExists,
    };

    if (!canWrite) {
      errors.push('Filesystem is read-only');
    }
  } catch (e: any) {
    diagnostics.filesystem = { error: e.message };
    errors.push(`Filesystem error: ${e.message}`);
  }

  // ── KV Store ──────────────────────────────────────────────────────────
  try {
    const kv = getKVStore();
    const testKey = '_debug_health_' + Date.now();
    await kv.set(testKey, { ts: Date.now(), test: true });
    const readBack = await kv.get<{ ts: number; test: boolean }>(testKey);
    await kv.del(testKey);

    diagnostics.services = {
      ...diagnostics.services,
      kv: {
        type: (process.env.UPSTASH_REDIS_REST_URL ? 'upstash-redis' : 'filesystem'),
        writable: !!readBack,
        readBack: !!readBack,
      },
    };

    if (!readBack) {
      errors.push('KV store read/write test failed');
    }
  } catch (e: any) {
    diagnostics.services = { ...diagnostics.services, kv: { error: e.message } };
    errors.push(`KV store error: ${e.message}`);
  }

  // ── Match Data ─────────────────────────────────────────────────────────
  try {
    const matches = await loadMatches();
    diagnostics.services = {
      ...diagnostics.services,
      matches: {
        count: _matchCache?.length || 0,
        upcoming: matches.filter(m => m.status === 'upcoming').length,
        completed: matches.filter(m => m.status === 'completed').length,
        sample: matches.slice(0, 2).map(m => ({
          id: m.id,
          home: m.homeTeam,
          away: m.awayTeam,
          status: m.status,
        })),
      },
    };
  } catch (e: any) {
    diagnostics.services = { ...diagnostics.services, matches: { error: e.message } };
    errors.push(`Match data error: ${e.message}`);
  }

  // ── AI Model ───────────────────────────────────────────────────────────
  diagnostics.services = {
    ...diagnostics.services,
    ai: {
      configured: !!process.env.OPENROUTER_API_KEY,
      modelInitialized: !!aiModel,
      currentModel: currentModelId,
      memwalAvailable,
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    },
  };

  // ── MemWal ─────────────────────────────────────────────────────────────
  try {
    const mw = await getMemWalServer();
    diagnostics.services = {
      ...diagnostics.services,
      memwal: {
        configured: !!(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID),
        initialized: !!mw,
        ready: isMemWalReady(),
      },
    };
  } catch (e: any) {
    diagnostics.services = { ...diagnostics.services, memwal: { error: e.message } };
    errors.push(`MemWal error: ${e.message}`);
  }

  // ── Health Summary ────────────────────────────────────────────────────
  diagnostics.errors = errors;
  if (errors.length > 0) {
    diagnostics.status = errors.length > 2 ? 'error' : 'degraded';
  }

  res.json(diagnostics);
});

// ─── Export for Server and Vercel ─────────────────────────────────────────

export default app;
