import React, { useState, useMemo } from 'react';
import { Search, Clock, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { Match, Prediction } from '../types';
import { GlassCard } from './GlassCard';
import { FlagIcon } from './FlagIcon';
import { safeFormatTime, safeTimestamp } from '../lib/safeDate';

interface ScheduleViewProps {
  matches: Match[];
  predictions: Prediction[];
  walletAddress: string | null;
  onNavigate: (view: 'home' | 'prediction' | 'ai-discuss' | 'history' | 'schedule', matchId?: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const ROUND_COLORS: Record<string, string> = {
  'Group A': 'blue', 'Group B': 'blue', 'Group C': 'blue', 'Group D': 'blue',
  'Group E': 'blue', 'Group F': 'blue', 'Group G': 'blue', 'Group H': 'blue',
  'Group I': 'blue', 'Group J': 'blue', 'Group K': 'blue', 'Group L': 'blue',
  'Round of 32': 'emerald', 'Round of 16': 'emerald',
  'Quarter-finals': 'cyan', 'Semi-finals': 'cyan',
  '3rd Place Match': 'amber', 'Final': 'rose',
};

function extractRound(competition: string): string {
  // "FIFA World Cup 2026 (Group A)" → "Group A"
  const groupMatch = competition.match(/\((Group [A-L])\)/);
  if (groupMatch) return groupMatch[1];
  // "FIFA World Cup 2026 · Round of 32" → "Round of 32"
  const roundMatch = competition.match(/· (.+)$/);
  return roundMatch?.[1] || competition;
}

function getRoundStyle(round: string): React.CSSProperties {
  const colorMap: Record<string, string> = {
    'Group A': '#3B82F6', 'Group B': '#3B82F6', 'Group C': '#3B82F6', 'Group D': '#3B82F6',
    'Group E': '#3B82F6', 'Group F': '#3B82F6', 'Group G': '#3B82F6', 'Group H': '#3B82F6',
    'Group I': '#3B82F6', 'Group J': '#3B82F6', 'Group K': '#3B82F6', 'Group L': '#3B82F6',
    'Round of 32': '#10B981', 'Round of 16': '#10B981',
    'Quarter-finals': '#06B6D4', 'Semi-finals': '#06B6D4',
    '3rd Place Match': '#F59E0B', 'Final': '#F43F5E',
  };
  const c = colorMap[round] || '#6B7280';
  return { color: c, backgroundColor: `${c}1A`, borderColor: `${c}33` };
}

function formatMatchTime(iso: string): string {
  return safeFormatTime(iso);
}

const choiceStyles: Record<string, string> = {
  home: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  draw: 'text-slate-200 bg-slate-500/10 border-slate-500/20',
  away: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

function isPlaceholderTeam(match: Match, side: 'home' | 'away'): boolean {
  return side === 'home' ? match.countryCode === '' : match.awayCountryCode === '';
}

// ─── Component ────────────────────────────────────────────────────────────

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  matches,
  predictions,
  walletAddress,
  onNavigate,
}) => {
  const isLoggedIn = !!walletAddress;
  const userPredictions = predictions.filter(p => p.walletAddress === walletAddress);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Group matches by round/group, sorted in tournament order
  const groupedMatches = useMemo(() => {
    let filtered = matches;
    if (filter === 'upcoming') filtered = filtered.filter(m => m.status === 'upcoming');
    if (filter === 'completed') filtered = filtered.filter(m => m.status === 'completed');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q) ||
        m.competition.toLowerCase().includes(q) ||
        m.venue.toLowerCase().includes(q)
      );
    }

    // Group by round (extracted from competition string)
    const rounds = new Map<string, Match[]>();
    for (const m of filtered) {
      const r = extractRound(m.competition);
      if (!rounds.has(r)) rounds.set(r, []);
      rounds.get(r)!.push(m);
    }

    // Sort rounds by earliest match date (chronological), matches within by date
    return Array.from(rounds.entries())
      .sort(([, msA], [, msB]) => {
        const aEarliest = Math.min(...msA.map(m => safeTimestamp(m.kickoffTime)));
        const bEarliest = Math.min(...msB.map(m => safeTimestamp(m.kickoffTime)));
        return aEarliest - bEarliest;
      })
      .map(([round, ms]) => [
        round,
        ms.sort((a, b) => safeTimestamp(a.kickoffTime) - safeTimestamp(b.kickoffTime)),
      ] as [string, Match[]]);
  }, [matches, filter, searchQuery]);

  const totalCount = matches.length;
  const displayedCount = groupedMatches.reduce((sum, [, ms]) => sum + ms.length, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-widest block mb-1">
            FIFA World Cup 2026
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2">
            Full Schedule
            <span className="text-[10px] font-mono text-slate-500 font-normal bg-white/5 px-2 py-0.5 rounded-full">
              {totalCount} matches
            </span>
          </h1>
        </div>

        <div className="flex bg-white/5 p-1 border border-white/10 rounded-xl text-xs font-mono shrink-0">
          {(['all', 'upcoming', 'completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
              {tab === 'all' && ` (${totalCount})`}
              {tab === 'upcoming' && ` (${matches.filter(m => m.status === 'upcoming').length})`}
              {tab === 'completed' && ` (${matches.filter(m => m.status === 'completed').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <GlassCard className="p-2 border-white/10 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-500 shrink-0 ml-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search teams, venues, or groups..."
          className="grow bg-transparent text-xs text-white placeholder-gray-500 font-mono outline-none py-1.5"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-[10px] text-slate-500 hover:text-white px-2 cursor-pointer font-mono"
          >
            Clear
          </button>
        )}
      </GlassCard>

      {/* Results count */}
      {searchQuery && (
        <p className="text-[10px] font-mono text-slate-500 text-center">
          {displayedCount} match{displayedCount !== 1 ? 'es' : ''} found
        </p>
      )}

      {/* Empty state */}
      {displayedCount === 0 ? (
        <div className="p-12 text-center text-gray-500 font-mono text-xs bg-white/[0.02] border border-white/5 rounded-xl">
          No matches match your current filter or search.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMatches.map(([group, ms]) => (
            <GroupTable
              key={group}
              group={group}
              matches={ms}
              userPredictions={userPredictions}
              isLoggedIn={isLoggedIn}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Group Table Sub-Component ────────────────────────────────────────────

function GroupTable({
  group,
  matches: ms,
  userPredictions,
  isLoggedIn,
  onNavigate,
}: {
  group: string;
  matches: Match[];
  userPredictions: Prediction[];
  isLoggedIn: boolean;
  onNavigate: ScheduleViewProps['onNavigate'];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <GlassCard glowColor={(ROUND_COLORS[group] || 'default') as any} className="overflow-hidden border-white/5">
      {/* Round header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/5 cursor-pointer hover:bg-white/[0.06] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider bg-opacity-10 border" style={getRoundStyle(group)}>
            {group}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {ms.length} match{ms.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-white/[0.04]">
          {/* Desktop table header — hidden on small screens */}
          <div className="hidden md:grid md:grid-cols-[1fr_2.5fr_80px_2.5fr_1.5fr_1.5fr_1.5fr] gap-2 px-4 py-2 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider bg-white/[0.02]">
            <span>Date</span>
            <span>Home</span>
            <span className="text-center">Score</span>
            <span className="text-right">Away</span>
            <span>Venue</span>
            <span className="text-center">Forecast</span>
            <span className="text-right">Actions</span>
          </div>

          {ms.map(m => (
            <MatchRow
              key={m.id}
              match={m}
              userPredictions={userPredictions}
              isLoggedIn={isLoggedIn}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Match Row Sub-Component ──────────────────────────────────────────────

function MatchRow({
  match: m,
  userPredictions,
  isLoggedIn,
  onNavigate,
}: {
  match: Match;
  userPredictions: Prediction[];
  isLoggedIn: boolean;
  onNavigate: ScheduleViewProps['onNavigate'];
}) {
  const isCompleted = m.status === 'completed';
  const hasPredicted = userPredictions.find(p => p.matchId === m.id);
  const isPlaceholder = isPlaceholderTeam(m, 'home') || isPlaceholderTeam(m, 'away');

  return (
    <div className={`px-4 py-2.5 transition-colors ${isPlaceholder ? 'border-b border-dashed border-amber-500/15 bg-amber-500/[0.02]' : 'hover:bg-white/[0.02]'}`}>
      {/* Mobile layout */}
      <div className="md:hidden space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatMatchTime(m.kickoffTime)}
          </span>
          {isPlaceholder && (
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 rounded border border-dashed border-amber-500/20">
              TBD
            </span>
          )}
          <span className="flex items-center gap-1 truncate max-w-[40%]">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{m.venue.split(',')[0]}</span>
          </span>
        </div>

        {/* Teams + Score row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <FlagIcon countryCode={m.countryCode} size={22} />
            <span className={`text-xs font-bold font-mono truncate ${isPlaceholderTeam(m, 'home') ? 'text-amber-400/70 italic' : 'text-white'}`}>{m.homeShort}</span>
          </div>

          <div className="shrink-0 px-2">
            {isCompleted ? (
              <span className="font-extrabold text-sm font-mono text-white">
                {m.homeScore}–{m.awayScore}
              </span>
            ) : (
              <span className="text-[9px] font-mono font-bold text-cyan-400/50 bg-white/5 border border-cyan-400/10 px-1.5 py-0.5 rounded">
                VS
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
            <span className={`text-xs font-bold font-mono truncate ${isPlaceholderTeam(m, 'away') ? 'text-amber-400/70 italic' : 'text-white'}`}>{m.awayShort}</span>
            <FlagIcon countryCode={m.awayCountryCode} size={22} />
          </div>
        </div>

        {/* Prediction + Actions row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1">
            {hasPredicted ? (
              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${choiceStyles[hasPredicted.choice] || ''}`}>
                {hasPredicted.choice.toUpperCase()}
                {isCompleted && (
                  hasPredicted.wasCorrect
                    ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    : <XCircle className="w-2.5 h-2.5 text-rose-500" />
                )}
              </span>
            ) : (
              <span className="text-[9px] text-slate-600 font-mono">—</span>
            )}
          </div>

          <div className="flex gap-1.5">
            {!isCompleted && !isPlaceholder && (
              <>
                {!hasPredicted && (
                  <button
                    onClick={() => onNavigate('prediction', m.id)}
                    className={`px-2 py-1 text-[9px] font-bold rounded cursor-pointer font-mono transition-all ${
                      isLoggedIn
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-black'
                        : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    {isLoggedIn ? 'Predict' : 'Login'}
                  </button>
                )}
                <button
                  onClick={() => isLoggedIn && onNavigate('ai-discuss', m.id)}
                  className={`px-2 py-1 text-[9px] font-bold rounded cursor-pointer font-mono transition-all border ${
                    isLoggedIn
                      ? 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                      : 'bg-white/5 text-gray-500 border-white/5'
                  }`}
                >
                  AI
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-[1fr_2.5fr_80px_2.5fr_1.5fr_1.5fr_1.5fr] gap-2 items-center text-xs">
        {/* Date */}
        <span className="text-[10px] font-mono text-slate-500">
          {formatMatchTime(m.kickoffTime)}
        </span>

        {/* Home team */}
        <div className="flex items-center gap-2 min-w-0">
          <FlagIcon countryCode={m.countryCode} size={22} />
          {isPlaceholderTeam(m, 'home') ? (
            <span className="text-[9px] font-bold font-mono text-amber-400/70 italic truncate border border-dashed border-amber-500/20 px-1.5 py-0.5 rounded">
              TBD
            </span>
          ) : (
            <span className="font-bold text-white font-mono text-xs truncate">{m.homeTeam}</span>
          )}
        </div>

        {/* Score */}
        <div className="text-center">
          {isCompleted ? (
            <span className="font-extrabold text-sm font-mono text-white">
              {m.homeScore}–{m.awayScore}
            </span>
          ) : (
            <span className="text-[9px] font-mono font-bold text-cyan-400/50 bg-white/5 border border-cyan-400/10 px-1.5 py-0.5 rounded">
              VS
            </span>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 min-w-0 justify-end">
          {isPlaceholderTeam(m, 'away') ? (
            <span className="text-[9px] font-bold font-mono text-amber-400/70 italic truncate border border-dashed border-amber-500/20 px-1.5 py-0.5 rounded">
              TBD
            </span>
          ) : (
            <span className="font-bold text-white font-mono text-xs truncate">{m.awayTeam}</span>
          )}
          <FlagIcon countryCode={m.awayCountryCode} size={22} />
        </div>

        {/* Venue */}
        <span className="text-[10px] font-mono text-slate-500 truncate" title={m.venue}>
          {m.venue.split(',')[0]}
        </span>

        {/* Forecast badge */}
        <div className="flex justify-center">
          {hasPredicted ? (
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${choiceStyles[hasPredicted.choice] || ''}`}>
              {hasPredicted.choice === 'home' ? m.homeShort : hasPredicted.choice === 'away' ? m.awayShort : 'DRW'}
              {isCompleted && (
                hasPredicted.wasCorrect
                  ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  : <XCircle className="w-2.5 h-2.5 text-rose-500" />
              )}
            </span>
          ) : (
            <span className="text-[9px] text-slate-600 font-mono">—</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-1">
          {!isCompleted && !isPlaceholder && (
            <>
              {!hasPredicted && (
                <button
                  onClick={() => onNavigate('prediction', m.id)}
                  className={`px-2 py-1 text-[9px] font-bold rounded cursor-pointer font-mono transition-all ${
                    isLoggedIn
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-black'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {isLoggedIn ? 'Predict' : 'Login'}
                </button>
              )}
              <button
                onClick={() => isLoggedIn && onNavigate('ai-discuss', m.id)}
                className={`px-2 py-1 text-[9px] font-bold rounded cursor-pointer font-mono transition-all border ${
                  isLoggedIn
                    ? 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                    : 'bg-white/5 text-gray-500 border-white/5'
                }`}
              >
                AI
              </button>
            </>
          )}
          {isCompleted && !hasPredicted && !isPlaceholder && (
            <span className="text-[9px] text-slate-600 italic">Closed</span>
          )}
        </div>
      </div>
    </div>
  );
}
