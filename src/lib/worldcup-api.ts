/**
 * World Cup 2026 — Live Data Fetcher
 *
 * Fetches the latest tournament data from the openfootball/worldcup.json
 * repository on GitHub and transforms it into our internal Match[] format.
 *
 * Cache: in-memory + /tmp file (Vercel-compatible) with 15-min TTL.
 * Cron job auto-refreshes the cache every 15 minutes.
 *
 * Data URL: https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
 */

import type { Match } from '../types';
import { getTeamInfo } from './teamData';
import fs from 'fs';

// ─── Configuration ────────────────────────────────────────────────────────

const WC2026_DATA_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

/** Cache TTL: 15 minutes (matches cron job interval) */
const CACHE_TTL_MS = 15 * 60 * 1000;

// ─── Types for the OpenFootball JSON schema ───────────────────────────────

interface OpenFootballMatch {
  round: string;
  num?: number;
  date: string;      // "2026-06-11"
  time?: string;     // "13:00 UTC-6"
  team1: string;     // "Mexico"
  team2: string;     // "South Africa"
  score?: {
    ft?: [number, number];  // full-time [home, away]
  };
  group?: string;    // "Group A"
  ground: string;     // "Mexico City"
}

interface OpenFootballData {
  name: string;
  matches: OpenFootballMatch[];
}

// ─── In-memory cache ──────────────────────────────────────────────────────

let cachedMatches: Match[] | null = null;
let lastFetchTime = 0;
let lastFetchError: string | null = null;

// ─── /tmp file cache helpers (Vercel-compatible) ──────────────────────────

function tmpCachePath(): string {
  return '/tmp/worldcup-matches-cache.json';
}

function writeTmpCache(matches: Match[]): void {
  try {
    fs.writeFileSync(
      tmpCachePath(),
      JSON.stringify({ matches, timestamp: Date.now() }, null, 2),
      'utf-8'
    );
  } catch {
    // /tmp not available (browser/edge) — silently skip
  }
}

function readTmpCache(): { matches: Match[]; timestamp: number } | null {
  try {
    if (!fs.existsSync(tmpCachePath())) return null;
    return JSON.parse(fs.readFileSync(tmpCachePath(), 'utf-8'));
  } catch {
    return null;
  }
}

function clearTmpCache(): void {
  try {
    if (fs.existsSync(tmpCachePath())) fs.unlinkSync(tmpCachePath());
  } catch {
    // silently skip
  }
}

// ─── Knockout placeholder detection — team names like "1A" (Group A winner), "W74", etc.

function isPlaceholder(name: string): boolean {
  // OpenFootball uses "1A" (group position), "W74" (match winner), "L74" (match loser)
  return /^(\d[A-L]|W\d+|L\d+)$/.test(name);
}

function formatTeamName(name: string): string {
  if (!isPlaceholder(name)) return name;
  // "1A" → "Group A Winner", "2B" → "Group B 2nd", "3A" → "Group A 3rd"
  const match = name.match(/^(\d)([A-L])$/);
  if (match) {
    const pos = match[1];
    const grp = match[2];
    const suffix = pos === '1' ? 'Winner' : pos === '2' ? 'Runner-up' : `${pos}rd Place`;
    return `Group ${grp} ${suffix}`;
  }
  // "W74" → "Match 74 Winner"
  if (name.startsWith('W')) return `Match ${name.slice(1)} Winner`;
  if (name.startsWith('L')) return `Match ${name.slice(1)} Loser`;
  return `TBD (${name})`;
}

function formatTeamShort(name: string): string {
  if (!isPlaceholder(name)) return name.substring(0, 3).toUpperCase();
  const match = name.match(/^(\d)([A-L])$/);
  if (match) return `${match[2]}${match[1]}`; // "A1", "B2"
  return 'TBD';
}

// ─── Round display names ──────────────────────────────────────────────────

const ROUND_ORDER: Record<string, number> = {
  'Group A': 0, 'Group B': 1, 'Group C': 2, 'Group D': 3,
  'Group E': 4, 'Group F': 5, 'Group G': 6, 'Group H': 7,
  'Group I': 8, 'Group J': 9, 'Group K': 10, 'Group L': 11,
  'Round of 32': 12, 'Round of 16': 13, 'Quarter-finals': 14,
  'Semi-finals': 15, '3rd Place Match': 16, 'Final': 17,
};

function roundToLabel(round: string): string {
  // "Group A" → "Group A", "Round of 32" → "Round of 32", "Quarter-finals" → "Quarter-finals"
  if (round.startsWith('Group ')) return round;
  if (ROUND_ORDER[round] !== undefined) return round;
  // Fallback: extract a readable name
  return round;
}

function roundToCompetition(round: string): string {
  // "Group A" → "FIFA World Cup 2026 (Group A)"
  if (round.startsWith('Group ')) {
    return `FIFA World Cup 2026 (${round})`;
  }
  // "Round of 32" → "FIFA World Cup 2026 · Round of 32"
  return `FIFA World Cup 2026 · ${round}`;
}

// ─── Stadium name mapping (openfootball uses short names) ──────────────────

const venueMap: Record<string, string> = {
  'Mexico City':                    'Estadio Azteca, Mexico City',
  'Guadalajara (Zapopan)':          'Estadio Akron, Guadalajara',
  'Monterrey (Guadalupe)':          'Estadio BBVA, Monterrey',
  'Toronto':                        'BMO Field, Toronto',
  'Vancouver':                      'BC Place, Vancouver',
  'Seattle':                        'Lumen Field, Seattle',
  'San Francisco Bay Area (Santa Clara)': "Levi's Stadium, San Francisco",
  'Los Angeles (Inglewood)':        'SoFi Stadium, Los Angeles',
  'Kansas City':                    'GEHA Field at Arrowhead Stadium, Kansas City',
  'Houston':                        'NRG Stadium, Houston',
  'Dallas (Arlington)':            'AT&T Stadium, Dallas',
  'Atlanta':                        'Mercedes-Benz Stadium, Atlanta',
  'Miami (Miami Gardens)':          'Hard Rock Stadium, Miami',
  'Boston (Foxborough)':            'Gillette Stadium, Boston',
  'Philadelphia':                   'Lincoln Financial Field, Philadelphia',
  'New York/New Jersey (East Rutherford)': 'MetLife Stadium, East Rutherford',
};

function mapVenue(ground: string): string {
  return venueMap[ground] || ground;
}

// ─── Odds generator (realistic based on team strength) ─────────────────────

function generateOdds(home: string, away: string): { home: number; draw: number; away: number } {
  const topTiers = ['Argentina', 'Brazil', 'France', 'England', 'Spain', 'Germany', 'Portugal', 'Netherlands', 'Belgium'];
  const secondTier = ['USA', 'Mexico', 'Canada', 'Croatia', 'Uruguay', 'Japan', 'Morocco', 'Switzerland', 'Colombia', 'Senegal'];

  const homeStrength = isPlaceholder(home) ? 1 : topTiers.includes(home) ? 3 : secondTier.includes(home) ? 2 : 1;
  const awayStrength = isPlaceholder(away) ? 1 : topTiers.includes(away) ? 3 : secondTier.includes(away) ? 2 : 1;

  const diff = homeStrength - awayStrength;
  let homeOdds = 2.10 - diff * 0.35;
  let drawOdds = 3.30 - Math.abs(diff) * 0.15;
  let awayOdds = 3.50 + diff * 0.50;

  homeOdds = Math.max(1.20, Math.min(8.0, Math.round(homeOdds * 100) / 100));
  drawOdds = Math.max(2.80, Math.min(5.0, Math.round(drawOdds * 100) / 100));
  awayOdds = Math.max(1.80, Math.min(15.0, Math.round(awayOdds * 100) / 100));

  return { home: homeOdds, draw: drawOdds, away: awayOdds };
}

// ─── Match detail text generator ──────────────────────────────────────────

function generateDetails(home: string, away: string, round: string, isCompleted: boolean): string {
  if (isCompleted) {
    return `Full-time result from the ${round} match between ${home} and ${away} at the FIFA World Cup 2026.`;
  }
  return `An upcoming ${round} match between ${home} and ${away} at the FIFA World Cup 2026.`;
}

// ─── Parse time string to ISO date ────────────────────────────────────────

function parseKickoff(dateStr: string, timeStr?: string): string {
  if (!timeStr) return `${dateStr}T00:00:00.000Z`;

  const match = timeStr.match(/^(\d{1,2}:\d{2})(?:\s+UTC([+-]\d{1,2}))?$/);
  if (!match) return `${dateStr}T${timeStr.replace(/\s+/g, '')}:00.000Z`;

  const time = match[1];
  const offsetStr = match[2];
  const hours = parseInt(time.split(':')[0], 10);
  const minutes = parseInt(time.split(':')[1], 10);

  if (offsetStr) {
    const offset = parseInt(offsetStr, 10);
    const utcHours = hours - offset;
    return `${dateStr}T${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
  }

  return `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
}

// ─── Generate unique match ID ─────────────────────────────────────────────

function generateMatchId(index: number, round: string): string {
  const prefix = round.startsWith('Group ') ? `g${round.slice(-1)}` :
    round === 'Round of 32' ? 'r32' :
    round === 'Round of 16' ? 'r16' :
    round.includes('Quarter') ? 'qf' :
    round.includes('Semi') ? 'sf' :
    round.includes('3rd') ? 'tp' :
    round.includes('Final') ? 'fn' :
    `m${Math.floor(index / 3) + 1}`;
  return `${prefix}-${index + 1}`;
}

// ─── Public API types ─────────────────────────────────────────────────────

export interface FetchResult {
  matches: Match[];
  source: 'api' | 'cache' | 'error';
  error?: string;
  fetchedAt: string;
}

// ─── Main fetcher ─────────────────────────────────────────────────────────

/**
 * Fetch the latest World Cup 2026 data from the OpenFootball GitHub repo.
 * Returns matches transformed into our internal Match[] format.
 *
 * Results cached: in-memory + /tmp file (Vercel-compatible), 15-min TTL.
 */
export async function fetchWorldCup2026Matches(forceRefresh = false): Promise<FetchResult> {
  const now = Date.now();

  // 1. Return in-memory cache if fresh
  if (!forceRefresh && cachedMatches && (now - lastFetchTime) < CACHE_TTL_MS) {
    return {
      matches: cachedMatches,
      source: 'cache',
      fetchedAt: new Date(lastFetchTime).toISOString(),
    };
  }

  // 2. Try /tmp file cache (Vercel warm instance)
  if (!forceRefresh) {
    const fileCache = readTmpCache();
    if (fileCache && (now - fileCache.timestamp) < CACHE_TTL_MS) {
      cachedMatches = fileCache.matches;
      lastFetchTime = fileCache.timestamp;
      return {
        matches: fileCache.matches,
        source: 'cache',
        fetchedAt: new Date(fileCache.timestamp).toISOString(),
      };
    }
  }

  // 3. Fetch from GitHub
  try {
    console.log('[WorldCup API] Fetching latest data...');
    const response = await fetch(WC2026_DATA_URL);

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}: ${response.statusText}`);
    }

    const rawData: OpenFootballData = await response.json();
    if (!rawData.matches || !Array.isArray(rawData.matches)) {
      throw new Error('Invalid data format: missing matches array');
    }

    // 4. Transform each match — include ALL matches including knockout placeholders
    const nowDate = new Date();
    const matches: Match[] = rawData.matches
      .map((m, idx) => {
        const homeName = formatTeamName(m.team1);
        const awayName = formatTeamName(m.team2);
        const homeInfo = getTeamInfo(m.team1);
        const awayInfo = getTeamInfo(m.team2);
        const kickoffISO = parseKickoff(m.date, m.time);
        const roundLabel = roundToLabel(m.round);

        return {
          id: generateMatchId(idx, m.round),
          homeTeam: homeName,
          homeShort: isPlaceholder(m.team1) ? formatTeamShort(m.team1) : homeInfo.short,
          homeFlag: isPlaceholder(m.team1) ? '🏳️' : homeInfo.flag,
          countryCode: isPlaceholder(m.team1) ? '' : homeInfo.countryCode,
          awayTeam: awayName,
          awayShort: isPlaceholder(m.team2) ? formatTeamShort(m.team2) : awayInfo.short,
          awayFlag: isPlaceholder(m.team2) ? '🏳️' : awayInfo.flag,
          awayCountryCode: isPlaceholder(m.team2) ? '' : awayInfo.countryCode,
          kickoffTime: kickoffISO,
          competition: roundToCompetition(roundLabel),
          status: m.score?.ft ? 'completed' as const : 'upcoming' as const,
          homeScore: m.score?.ft ? m.score.ft[0] : undefined,
          awayScore: m.score?.ft ? m.score.ft[1] : undefined,
          venue: mapVenue(m.ground),
          odds: generateOdds(m.team1, m.team2),
          details: generateDetails(homeName, awayName, roundLabel, !!m.score?.ft),
        } satisfies Match;
      });

    // 5. Sort: overall by kickoff time ascending
    const sorted = matches.sort((a, b) => {
      return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
    });

    // 6. Update caches
    cachedMatches = sorted;
    lastFetchTime = now;
    lastFetchError = null;
    writeTmpCache(sorted);

    console.log(`[WorldCup API] ✅ ${sorted.length} matches fetched (all rounds including knockouts).`);
    return { matches: sorted, source: 'api', fetchedAt: new Date(now).toISOString() };
  } catch (e: any) {
    console.warn('[WorldCup API] Fetch failed:', e.message);
    lastFetchError = e.message;

    // 7. Stale in-memory cache fallback
    if (cachedMatches) {
      return {
        matches: cachedMatches,
        source: 'cache',
        error: e.message,
        fetchedAt: new Date(lastFetchTime).toISOString(),
      };
    }

    // 8. Stale /tmp file cache fallback
    const fileCache = readTmpCache();
    if (fileCache) {
      cachedMatches = fileCache.matches;
      lastFetchTime = fileCache.timestamp;
      return {
        matches: fileCache.matches,
        source: 'cache',
        error: e.message,
        fetchedAt: new Date(fileCache.timestamp).toISOString(),
      };
    }

    return { matches: [], source: 'error', error: e.message, fetchedAt: new Date().toISOString() };
  }
}

/**
 * Force-refresh the cache (used by cron job).
 * Returns fresh data directly.
 */
export async function refreshCache(): Promise<FetchResult> {
  return fetchWorldCup2026Matches(true);
}

/**
 * Get the last fetch error message.
 */
export function getLastFetchError(): string | null {
  return lastFetchError;
}

/**
 * Clear all caches.
 */
export function clearCache(): void {
  cachedMatches = null;
  lastFetchTime = 0;
  lastFetchError = null;
  clearTmpCache();
}

/**
 * Get cache state info.
 */
export function getCacheInfo(): { isCached: boolean; age: number | null; source: string } {
  if (cachedMatches && lastFetchTime > 0) {
    return { isCached: true, age: Date.now() - lastFetchTime, source: 'memory' };
  }
  const fileCache = readTmpCache();
  if (fileCache) {
    return { isCached: true, age: Date.now() - fileCache.timestamp, source: 'file' };
  }
  return { isCached: false, age: null, source: 'none' };
}
