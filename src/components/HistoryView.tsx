import React, { useState, useMemo } from 'react';
import { Sparkles, CheckCircle2, XCircle, Clock, Trash2, Cpu, FileJson, Play } from 'lucide-react';
import { Match, Prediction, UserAccuracyStats } from '../types';
import { GlassCard } from './GlassCard';
import { FlagIcon } from './FlagIcon';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface HistoryViewProps {
  predictions: Prediction[];
  matches: Match[];
  stats: UserAccuracyStats;
  walletAddress: string | null;
  onSimulateResolve: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
  onResetDatabase: () => Promise<void>;
  onNavigate: (view: 'home' | 'prediction' | 'ai-discuss' | 'history' | 'schedule', matchId?: string) => void;
  /** Track which predictions have on-chain digests (matchId → txDigest) */
  submittedPredictions?: Record<string, string>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  predictions,
  matches,
  stats,
  walletAddress,
  onSimulateResolve,
  onResetDatabase,
  onNavigate,
  submittedPredictions = {},
}) => {
  // Filter predictions by current wallet for per-user history
  const userPredictions = walletAddress
    ? predictions.filter(p => p.walletAddress === walletAddress)
    : [];

  // Recompute per-user stats
  const userTotalResolved = userPredictions.filter(p => p.isResolved).length;
  const userCorrect = userPredictions.filter(p => p.isResolved && p.wasCorrect).length;
  const userIncorrect = userTotalResolved - userCorrect;
  const userAccuracyRate = userTotalResolved > 0 ? Math.round((userCorrect / userTotalResolved) * 100) : 0;
  const userChartData = [
    { name: 'Correct', value: userCorrect, color: '#10B981' },
    { name: 'Incorrect', value: userIncorrect, color: '#F43F5E' },
  ].filter((item) => item.value > 0);
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
  const [simHomeScore, setSimHomeScore] = useState<number>(2);
  const [simAwayScore, setSimAwayScore] = useState<number>(1);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);

  // Pair predictions with Match entities — filtered by wallet
  const hydratedPredictions = useMemo(() => {
    return userPredictions.map((p) => {
      const match = matches.find((m) => m.id === p.matchId);
      return {
        ...p,
        match,
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [userPredictions, matches]);

  // Chart data format — uses per-user stats
  const chartData = useMemo(() => {
    return [
      { name: 'Correct', value: userCorrect, color: '#10B981' },
      { name: 'Incorrect', value: userIncorrect, color: '#F43F5E' },
    ].filter((item) => item.value > 0);
  }, [userCorrect, userIncorrect]);

  const handleSimulateKickoff = async (matchId: string) => {
    if (isResolving) return;
    setIsResolving(true);
    try {
      await onSimulateResolve(matchId, simHomeScore, simAwayScore);
      setActiveSimulationId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsResolving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('This will wipe your current MemWal prediction logs and restore the original matches to "Upcoming". Proceed?')) return;
    
    setIsResetting(true);
    try {
      await onResetDatabase();
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block mb-1">
            Historical Data Logs
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-display">
            MemWal Prediction Ledger
          </h1>
        </div>

        {/* Clear database log action */}
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 text-xs font-mono rounded-lg cursor-pointer transition-all disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset All Logs</span>
        </button>
      </div>

      {hydratedPredictions.length === 0 ? (
        <GlassCard glowColor="blue" className="p-8 text-center border border-white/10 space-y-4 max-w-md mx-auto">
          <div className="inline-flex justify-center items-center w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Predictions Found</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed font-mono">
              You haven't committed any predictions to the Write-Ahead Log. Go to the dashboard or schedule to forecast matches!
            </p>
          </div>
          <button
            onClick={() => onNavigate('home')}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold rounded-lg cursor-pointer transition-all font-mono"
          >
            Predict Your First Match
          </button>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* STATS SUMMARY & CHART COLUMN */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
              Accuracy Metrics
            </h2>

            <GlassCard glowColor="blue" className="p-5 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 font-mono tracking-wider mb-2">Accuracy Rate</span>
              <span className="text-4xl font-extrabold text-white tracking-tight font-mono mb-4">
                {userTotalResolved > 0 ? `${userAccuracyRate}%` : '0%'}
              </span>

              {/* Piechart wrapper */}
              <div className="w-full h-44 flex items-center justify-center relative">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="51%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.85)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontSize: '10px',
                          fontFamily: 'monospace',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs font-mono text-gray-500 text-center max-w-[200px]">
                    Waiting for matches to kickoff. Predict upcoming fixtures, then click "Simulate Match" to compute your precision rate.
                  </p>
                )}
                {/* Center score readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-lg font-bold text-white font-mono leading-none">
                    {userCorrect} / {userTotalResolved}
                  </span>
                  <span className="text-[9px] text-gray-500 font-mono mt-0.5 uppercase tracking-widest">
                    resolved
                  </span>
                </div>
              </div>

              {/* Static stats labels */}
              <div className="w-full grid grid-cols-2 gap-2 mt-4 text-xs font-mono border-t border-white/5 pt-3.5">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg text-center">
                  <span className="text-[10px] text-gray-500 block uppercase">Correct</span>
                  <span className="text-emerald-400 font-bold block text-sm mt-0.5">{userCorrect}</span>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg text-center">
                  <span className="text-[10px] text-gray-500 block uppercase">Incorrect</span>
                  <span className="text-rose-400 font-bold block text-sm mt-0.5">{userIncorrect}</span>
                </div>
              </div>
            </GlassCard>

            {/* Simulated sandbox details warning */}
            <div className="p-4 bg-cyan-950/20 border border-cyan-500/15 rounded-xl space-y-2 text-xs text-slate-300 font-mono leading-relaxed">
              <span className="font-bold text-cyan-400 uppercase text-[10px] tracking-wider block">Sandbox Mode:</span>
              <p>
                In standard deployment, predictions await real match kickoff. In this preview, click <Play className="w-3 h-3 inline-block" /> **Simulate Kickoff** on any pending prediction card to resolve fixtures and see how MemWal automatically matches values.
              </p>
            </div>
          </div>

          {/* CHRONOLOGICAL WAL TRANSACTIONS COLUMN */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
              Prediction Logs Sequence
            </h2>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {hydratedPredictions.map(({ id, choice, reasoning, timestamp, isResolved, wasCorrect, match, matchId }) => {
                const matchObj = match;
                if (!matchObj) return null;

                const isUpcoming = matchObj.status === 'upcoming';
                const isSimulationFormOpen = activeSimulationId === matchId;

                return (
                  <GlassCard
                    key={id}
                    glowColor={isUpcoming ? 'default' : wasCorrect ? 'emerald' : 'crimson'}
                    className="p-4 flex flex-col space-y-3.5 border-white/5 transition-all"
                  >
                    {/* Header transaction summary */}
                    <div className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-2">
                      <span className="text-slate-500 inline-flex items-center gap-1 text-[9px] uppercase">
                        <FileJson className="w-3 h-3 text-cyan-400 shrink-0" /> LOG_ID: {id.split('-')[1] || id}
                        {submittedPredictions[matchId] && (
                          <span className="ml-1.5 text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded font-bold tracking-wider">
                            ON-CHAIN
                          </span>
                        )}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}{' '}
                        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Match names and results if any (Replacing words with clear flag and shortcode code icons) */}
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-500 block font-mono text-[9px] uppercase tracking-wider">{matchObj.competition}</span>
                        <span className="font-extrabold text-[#00F0FF] text-sm tracking-widest font-mono inline-flex items-center gap-1.5">
                          <FlagIcon countryCode={matchObj.countryCode} size={20} /> {matchObj.homeTeam} <span className="font-mono text-slate-500 font-light select-none">VS</span> {matchObj.awayTeam} <FlagIcon countryCode={matchObj.awayCountryCode} size={20} />
                        </span>
                      </div>

                      {/* Display status or results */}
                      {!isUpcoming ? (
                        <div className="text-right">
                          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block tracking-widest">FINAL SCORE</span>
                          <span className="font-bold text-white font-mono text-base">
                            {matchObj.homeScore} - {matchObj.awayScore}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Pending
                          </span>
                        </div>
                      )}
                    </div>

                    {/* User forecasting choice */}
                    <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-xs font-mono space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 uppercase text-[9px]">forecast choice:</span>
                        <span className={`font-bold uppercase tracking-wide px-2 py-0.5 rounded text-[10px] border ${
                          choice === 'home'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : choice === 'draw'
                            ? 'bg-slate-500/10 border-slate-500/20 text-slate-200'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        }`}>
                          {choice === 'home' ? `${matchObj.homeTeam} Win` : choice === 'draw' ? 'Tactical Draw' : `${matchObj.awayTeam} Win`}
                        </span>
                      </div>
                      {reasoning && (
                        <div className="border-t border-dashed border-white/10 pt-1.5 mt-1.5">
                          <span className="text-slate-500 uppercase text-[9px] block mb-0.5">tactical rationale:</span>
                          <p className="text-slate-300 italic text-[11px] leading-relaxed">&ldquo; {reasoning} &rdquo;</p>
                        </div>
                      )}
                    </div>

                    {/* Result evaluation banner */}
                    <div className="flex items-center justify-between pt-1 text-xs font-mono">
                      {!isUpcoming ? (
                        <div className="flex items-center gap-1.5">
                          {wasCorrect ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider">Prediction Correct</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-rose-500" />
                              <span className="text-rose-500 font-bold uppercase text-[10px] tracking-wider">Prediction Incorrect</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-[10px] uppercase">Awaiting result</span>
                        </div>
                      )}

                      {/* Interactive Sandbox resolution action if match is pending */}
                      {isUpcoming && !isSimulationFormOpen && (
                        <button
                          onClick={() => setActiveSimulationId(matchId)}
                          className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black text-[10px] font-bold rounded-md font-mono cursor-pointer flex items-center gap-1"
                        >
                          <Play className="w-3.5 h-3.5 shrink-0" />
                          <span>Simulate Result</span>
                        </button>
                      )}
                    </div>

                    {/* Simulation configuration interface if opened */}
                    {isSimulationFormOpen && (
                      <div className="border-t border-dashed border-white/10 pt-4 mt-2 space-y-3 animate-fade-in bg-black/45 p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider block uppercase">
                          ⚙️ SIMULATE LEAGUE RESULTS
                        </span>
                        
                        <div className="flex gap-4 items-center">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] text-slate-500 font-mono block uppercase">{matchObj.homeTeam} Goals</label>
                            <input
                              type="number"
                              min="0"
                              max="9"
                              value={simHomeScore}
                              onChange={(e) => setSimHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-black border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-cyan-400"
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-500 mt-4">&mdash;</span>
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] text-slate-500 font-mono block uppercase">{matchObj.awayTeam} Goals</label>
                            <input
                              type="number"
                              min="0"
                              max="9"
                              value={simAwayScore}
                              onChange={(e) => setSimAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-black border border-white/10 rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 text-xs font-mono shrink-0">
                          <button
                            onClick={() => setActiveSimulationId(null)}
                            className="px-3 py-1.5 bg-white/5 text-gray-400 hover:text-white rounded cursor-pointer border border-white/5"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSimulateKickoff(matchId)}
                            id={`simulate-kickoff-confirm-${matchId}`}
                            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded cursor-pointer"
                          >
                            Execute Kickoff &rarr;
                          </button>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
