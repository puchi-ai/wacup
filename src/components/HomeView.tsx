import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, Calendar, TrendingUp, Cpu, History, ArrowRight } from 'lucide-react';
import { Match, Prediction, UserAccuracyStats } from '../types';
import { GlassCard } from './GlassCard';
import { FlagIcon } from './FlagIcon';
import { safeParseDate, safeFormatDate, safeTimestamp, safeDiffMs } from '../lib/safeDate';

interface CountdownTimerProps {
  kickoffTime: string;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ kickoffTime, className = '' }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isOver: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: false });

  useEffect(() => {
    const target = safeTimestamp(kickoffTime);

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isOver: false,
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [kickoffTime]);

  if (timeLeft.isOver) {
    return (
      <span className="text-[10px] sm:text-xs font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded animate-pulse">
        🔴 KICKOFF
      </span>
    );
  }

  const pad = (num: number) => String(num).padStart(2, '0');

  return (
    <div className={`flex items-center gap-1 font-mono text-cyan-400 font-extrabold ${className}`}>
      {timeLeft.days > 0 && (
        <>
          <span>{timeLeft.days}</span>
          <span className="text-slate-500 text-[9px] mr-1">d</span>
        </>
      )}
      <span>{pad(timeLeft.hours)}</span>
      <span className="text-slate-500 text-[9px]">:</span>
      <span>{pad(timeLeft.minutes)}</span>
      <span className="text-slate-500 text-[9px]">:</span>
      <span className="text-cyan-300 animate-pulse">{pad(timeLeft.seconds)}</span>
      <span className="text-emerald-400 text-[8px] font-bold uppercase tracking-wider ml-1 px-1.5 py-0.5 bg-emerald-500/10 rounded">
        T-MINUS
      </span>
    </div>
  );
};

interface HomeViewProps {
  matches: Match[];
  predictions: Prediction[];
  stats: UserAccuracyStats;
  walletAddress: string | null;
  onNavigate: (view: 'home' | 'prediction' | 'ai-discuss' | 'history' | 'schedule', matchId?: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  matches,
  predictions,
  stats,
  walletAddress,
  onNavigate,
}) => {
  const isLoggedIn = !!walletAddress;

  // Filter predictions by current wallet for per-user stats
  const userPredictions = predictions.filter(p => p.walletAddress === walletAddress);

  // Find closest upcoming match
  const nearestUpcomingMatch = useMemo(() => {
    const upcoming = matches.filter((m) => m.status === 'upcoming');
    return upcoming.sort(
      (a, b) => safeTimestamp(a.kickoffTime) - safeTimestamp(b.kickoffTime)
    )[0];
  }, [matches]);

  // Find if user already made a prediction on this specific match
  const hasPredictedNearest = useMemo(() => {
    if (!nearestUpcomingMatch) return null;
    return userPredictions.find((p) => p.matchId === nearestUpcomingMatch.id);
  }, [nearestUpcomingMatch, userPredictions]);

  // Find 2 next closest matches (adjacent to the nearest match)
  const nextTwoUpcomingMatches = useMemo(() => {
    const upcoming = matches.filter((m) => m.status === 'upcoming');
    const sorted = upcoming.sort(
      (a, b) => safeTimestamp(a.kickoffTime) - safeTimestamp(b.kickoffTime)
    );
    return sorted.slice(1, 3);
  }, [matches]);

  // Render relative time (safe date parsing)
  const formatKickoff = (isoString: string) => {
    const kickoff = safeParseDate(isoString);
    const now = new Date();
    const diffMs = safeDiffMs(isoString, now);
    
    if (diffMs <= 0) return 'Kickoff Now';

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) {
      const diffMins = Math.round(diffMs / (1000 * 60));
      return `Starts in ${diffMins} minutes`;
    }
    if (diffHrs < 24) {
      return `Starts in ${diffHrs} hours`;
    }
    const diffDays = Math.floor(diffHrs / 24);
    return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      {/* Intro Greetings */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2.5 font-display">
            Predictor Arena <span className="text-cyan-400 text-xs bg-cyan-500/15 px-2.5 py-1 rounded-full border border-cyan-500/25 uppercase font-mono tracking-widest leading-none">MemWal MVP</span>
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Analyze upcoming fixtures and log tactical estimations securely utilizing MemWal.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300 font-mono">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>WAL Sync Status:</span>
          <span className="text-emerald-400 font-bold animate-pulse">● ONLINE</span>
        </div>
      </div>

      {/* 2 Next Closest Matches Section */}
      {nextTwoUpcomingMatches.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-1">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" /> Upcoming Spotlight Contenders
            </h2>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Next in queue</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nextTwoUpcomingMatches.map((m) => {
              const hasPredictedThis = userPredictions.find((p) => p.matchId === m.id);
              return (
                <GlassCard
                  key={m.id}
                  glowColor="blue"
                  interactive
                  onClick={() => onNavigate('prediction', m.id)}
                  className={`p-5 flex flex-col justify-between border-white/10 hover:border-cyan-500/20 transition-all ${!isLoggedIn ? 'opacity-70' : ''}`}
                >
                  <div>
                    {/* Header: Competition & kickoff countdown */}
                    <div className="flex justify-between items-center text-[10px] font-mono mb-4 text-slate-400">
                      <span className="text-cyan-400 font-bold uppercase tracking-wider">{m.competition}</span>
                      <CountdownTimer kickoffTime={m.kickoffTime} />
                    </div>

                    {/* Team display row */}
                    <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3.5 rounded-xl my-3 font-mono">
                      <div className="flex items-center gap-2 max-w-[42%] truncate">
                        <FlagIcon countryCode={m.countryCode} size={28} />
                        <span className="text-xs font-bold text-slate-100 tracking-wider truncate">{m.homeTeam}</span>
                      </div>
                      
                      <div className="flex flex-col items-center shrink-0 mx-2">
                        <span className="text-[10px] font-bold text-slate-500">VS</span>
                        {m.odds && (
                          <span className="text-[9px] text-cyan-400 mt-0.5">{m.odds.home.toFixed(2)} / {m.odds.away.toFixed(2)}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-row-reverse text-right max-w-[42%] truncate">
                        <FlagIcon countryCode={m.awayCountryCode} size={28} />
                        <span className="text-xs font-bold text-slate-100 tracking-wider truncate">{m.awayTeam}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer status and button */}
                  <div className="flex justify-between items-center border-t border-dashed border-white/10 pt-3 mt-3">
                    <span className="text-[9px] font-mono text-slate-500 truncate max-w-[50%]">
                      {m.venue.split(',')[0]}
                    </span>
                    {hasPredictedThis ? (
                      <span className={`text-[9px] border px-2 py-0.5 rounded font-bold uppercase font-mono ${
                        hasPredictedThis.choice === 'home'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : hasPredictedThis.choice === 'draw'
                          ? 'bg-slate-500/10 border-slate-500/20 text-slate-200'
                          : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                      }`}>
                        {hasPredictedThis.choice === 'home' ? `${m.homeTeam} Win` : hasPredictedThis.choice === 'draw' ? 'Draw' : `${m.awayTeam} Win`}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('prediction', m.id);
                        }}
                        className={`px-2.5 py-1.5 text-[9px] font-extrabold rounded-lg cursor-pointer font-mono transition-all ${
                          isLoggedIn
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-black'
                            : 'bg-white/5 text-gray-500 hover:bg-white/10'
                        }`}
                      >
                        {isLoggedIn ? 'Forecast →' : 'Connect to Predict'}
                      </button>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Featured Next Upcoming Match Card */}
      {nearestUpcomingMatch ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Nearest Spotlight Clash
            </span>
            <CountdownTimer kickoffTime={nearestUpcomingMatch.kickoffTime} className="bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full text-xs" />
          </div>

          <GlassCard glowColor="blue" className="p-6 md:p-8 border-white/10 relative overflow-hidden">
            {/* Spotlight Match absolute tag */}
            <div className="absolute top-6 left-6 bg-cyan-500/20 text-cyan-300 text-[10px] px-3 py-1 rounded-full border border-cyan-500/30 font-bold uppercase tracking-widest font-mono select-none">
              Featured Spot
            </div>

            {/* Competition Header */}
            <div className="text-center pb-4 border-b border-white/5 mt-6 sm:mt-0">
              <span className="text-xs font-mono font-semibold text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-full uppercase tracking-wider">
                {nearestUpcomingMatch.competition}
              </span>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                Kickoff: {safeFormatDate(nearestUpcomingMatch.kickoffTime)}
              </p>
            </div>

            {/* Duel Scoreline Display (Replacing country words with national flag icons / shortcodes) */}
            <div className="grid grid-cols-3 items-center justify-center my-6 md:my-8 text-center px-2 md:px-6">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-3 font-mono">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-lg">
                  <FlagIcon countryCode={nearestUpcomingMatch.countryCode} size={48} />
                </div>
                <span className="text-base md:text-lg font-extrabold text-[#00F0FF] tracking-wider uppercase">{nearestUpcomingMatch.homeTeam}</span>
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-extrabold text-white/20 tracking-tighter mb-2 italic uppercase font-display select-none">
                  VS
                </span>
                <div className="bg-white/10 border border-white/10 px-3 py-1 rounded-md text-[10px] md:text-xs font-mono text-slate-300">
                  {safeFormatDate(nearestUpcomingMatch.kickoffTime, { hour: '2-digit', minute: '2-digit', hour12: false })} GMT
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-2 truncate max-w-[80px] md:max-w-none">
                  {nearestUpcomingMatch.venue.split(',')[0]}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center gap-3 font-mono">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-lg">
                  <FlagIcon countryCode={nearestUpcomingMatch.awayCountryCode} size={48} />
                </div>
                <span className="text-base md:text-lg font-extrabold text-[#00F0FF] tracking-wider uppercase">{nearestUpcomingMatch.awayTeam}</span>
              </div>
            </div>

            {/* Market Odds indicators */}
            {nearestUpcomingMatch.odds && (
              <div className="grid grid-cols-3 gap-2 bg-white/5 border border-white/10 rounded-xl p-3 text-center text-xs font-mono max-w-sm mx-auto mb-6">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Home Win</span>
                  <span className="text-emerald-400 font-bold text-sm tracking-tight">{nearestUpcomingMatch.odds.home.toFixed(2)}</span>
                </div>
                <div className="border-x border-white/5">
                  <span className="text-slate-400 block text-[10px] uppercase">Draw</span>
                  <span className="text-slate-300 font-bold text-sm tracking-tight">{nearestUpcomingMatch.odds.draw.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Away Win</span>
                  <span className="text-rose-455 font-bold text-sm tracking-tight">{nearestUpcomingMatch.odds.away.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Tactical Briefing */}
            <p className="text-xs text-slate-300 text-center leading-relaxed max-w-lg mx-auto mb-6 font-mono border-t border-dashed border-white/10 pt-4" style={{ fontStyle: 'italic' }}>
              &ldquo; {nearestUpcomingMatch.details} &rdquo;
            </p>

            {/* Navigation Actions matching Frosted Glass */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4 justify-center items-center">
              {hasPredictedNearest ? (
                <button
                  onClick={() => onNavigate('history')}
                  className={`w-full sm:w-auto px-8 py-3.5 inline-flex items-center justify-center gap-2 border text-xs font-bold rounded-full cursor-pointer transition-all text-center ${
                    hasPredictedNearest.choice === 'home'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                      : hasPredictedNearest.choice === 'draw'
                      ? 'bg-slate-500/10 border-slate-500/30 text-slate-200 hover:bg-slate-500/20'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                  }`}
                >
                  Predicted: {hasPredictedNearest.choice === 'home' ? `${nearestUpcomingMatch.homeTeam} Win` : hasPredictedNearest.choice === 'draw' ? 'Draw' : `${nearestUpcomingMatch.awayTeam} Win`}
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('prediction', nearestUpcomingMatch.id)}
                  id="predict-featured-button"
                  className={`w-full sm:w-auto px-8 py-3.5 inline-flex items-center justify-center gap-2 text-xs font-extrabold rounded-full cursor-pointer transition-all shadow-lg active:scale-[0.98] ${
                    isLoggedIn
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-black shadow-cyan-900/40'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" /> {isLoggedIn ? 'Submit Prediction' : 'Connect Wallet to Predict'}
                </button>
              )}

              <button
                onClick={() => onNavigate('ai-discuss', nearestUpcomingMatch.id)}
                id="discuss-featured-button"
                className={`w-full sm:w-auto px-8 py-3.5 inline-flex items-center justify-center gap-2 border text-xs font-semibold rounded-full cursor-pointer transition-all active:scale-[0.98] ${
                  isLoggedIn
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-white/5 text-gray-500 border-white/5'
                }`}
              >
                <Cpu className="w-4 h-4 text-cyan-400" /> {isLoggedIn ? 'Consult AI Pundit' : 'Login to Discuss'}
              </button>
            </div>
          </GlassCard>
        </div>
      ) : (
        <GlassCard className="p-6 text-center text-gray-400">
          No current spotlight matches found. Please re-seed the match database.
        </GlassCard>
      )}

      {/* Stats Bento Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Predictions */}
        <GlassCard glowColor="emerald" className="p-5 flex items-center gap-4 border-white/10">
          <div className="inline-flex justify-center items-center w-10 h-10 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">MemWal Predictions</span>
            <span className="text-2xl font-extrabold text-white tracking-tight">{userPredictions.length}</span>
          </div>
        </GlassCard>

        {/* Accuracy Rating */}
        <GlassCard glowColor="blue" className="p-5 flex items-center gap-4 border-white/10">
          <div className="inline-flex justify-center items-center w-10 h-10 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Live Accuracy Rate</span>
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {stats.totalResolved > 0 ? `${stats.accuracyRate}%` : '0%'}
            </span>
          </div>
        </GlassCard>

        {/* WAL Registry size */}
        <GlassCard glowColor="amber" className="p-5 flex items-center gap-4 border-white/10">
          <div className="inline-flex justify-center items-center w-10 h-10 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider block">Completed Matches</span>
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {matches.filter(m => m.status === 'completed').length} / {matches.length}
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Interactive Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GlassCard
          interactive
          onClick={() => onNavigate('schedule')}
          className="p-4 flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-cyan-400 transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">View Full Schedule</span>
              <span className="text-[10px] text-slate-500 font-mono">Check upcoming & history</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
        </GlassCard>

        <GlassCard
          interactive
          onClick={() => onNavigate('history')}
          className="p-4 flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-400 transition-colors">
              <History className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Historical Prediction Log</span>
              <span className="text-[10px] text-slate-500 font-mono">Verify sync records</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
        </GlassCard>
      </div>
    </div>
  );
};
