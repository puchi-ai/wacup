import React, { useState } from 'react';
import { HelpCircle, ChevronRight, CheckCircle2, FileJson, Cpu, Coins, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { Match, Prediction, PredictionChoice } from '../types';
import { GlassCard } from './GlassCard';
import { FlagIcon } from './FlagIcon';
import { OnChainPredictionConfig } from '../types';

interface PredictionViewProps {
  match: Match;
  onSavePrediction: (choice: PredictionChoice, reasoning: string) => Promise<string>;
  onNavigateHome: () => void;
  existingPrediction?: Prediction;
  /** On-chain contract config (undefined = contract not deployed) */
  onChainConfig?: OnChainPredictionConfig;
  /** Called when user triggers an on-chain submission */
  onSubmitOnChain?: (matchId: string, choice: PredictionChoice) => Promise<string>;
}

export const PredictionView: React.FC<PredictionViewProps> = ({
  match,
  onSavePrediction,
  onNavigateHome,
  existingPrediction,
  onChainConfig,
  onSubmitOnChain,
}) => {
  const [choice, setChoice] = useState<PredictionChoice>(
    existingPrediction?.choice || 'home'
  );
  const [reasoning, setReasoning] = useState<string>(
    existingPrediction?.reasoning || ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<{
    id: string;
    timestamp: string;
    synced: boolean;
    txDigest: string | null;
  } | null>(null);

  // On-chain state is read from props (set by App.tsx via onChainConfig)
  // to ensure the tx digest and error flow down correctly from the parent.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const txDigest = await onSavePrediction(choice, reasoning);

      setSavedData({
        id: `wal-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        synced: true,
        txDigest: txDigest || null,
      });
    } catch (e: any) {
      console.error(e);
      setSubmitError(e?.message || 'Transaction was rejected or failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnChainSubmit = async () => {
    if (!onSubmitOnChain || !match.id) return;
    await onSubmitOnChain(match.id, choice);
  };

  const choiceOptions: { value: PredictionChoice; label: string; icon: React.ReactNode; border: string; glow: string }[] = [
    {
      value: 'home',
      label: `${match.homeTeam} Win (Forecast Win)`,
      icon: <FlagIcon countryCode={match.countryCode} size={28} />,
      border: 'border-emerald-500/20 hover:border-emerald-500/50',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.12)]',
    },
    {
      value: 'draw',
      label: 'Pragmatic Draw (Forecast Draw)',
      icon: <span className="text-2xl leading-none">🤝</span>,
      border: 'border-slate-500/20 hover:border-slate-400/50',
      glow: 'shadow-[0_0_15px_rgba(148,163,184,0.12)]',
    },
    {
      value: 'away',
      label: `${match.awayTeam} Win (Forecast Loss/Away Win)`,
      icon: <FlagIcon countryCode={match.awayCountryCode} size={28} />,
      border: 'border-rose-500/20 hover:border-rose-500/50',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.12)]',
    },
  ];

  const getActiveStyles = (val: PredictionChoice) => {
    if (val === 'home') return 'bg-emerald-500/10 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
    if (val === 'draw') return 'bg-slate-500/10 border-slate-200 text-slate-100 shadow-[0_0_15px_rgba(148,163,184,0.15)]';
    return 'bg-rose-500/10 border-rose-400 text-rose-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
  };

  const getRadioStyles = (val: PredictionChoice) => {
    if (val === 'home') return 'border-emerald-400 bg-emerald-400';
    if (val === 'draw') return 'border-slate-300 bg-slate-300';
    return 'border-rose-400 bg-rose-400';
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <span className="text-xs font-mono font-bold text-cyan-455 uppercase tracking-widest block mb-1">
            Prediction Entry
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Log Your Tactical Choice
          </h1>
        </div>
        <button
          onClick={onNavigateHome}
          className="text-xs font-mono text-gray-400 hover:text-white bg-white/5 border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
        >
          &larr; Back
        </button>
      </div>

      {/* Static Match Info */}
      <GlassCard className="p-4 bg-white/2 border-white/10">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-mono">
          <span>{match.competition}</span>
          <span>Odds-Weight</span>
        </div>

        <div className="flex justify-between items-center bg-black/40 border border-white/5 p-4 rounded-xl font-mono">
          <div className="flex items-center gap-2.5 max-w-[45%] truncate">
            <FlagIcon countryCode={match.countryCode} size={32} />
            <span className="text-sm font-bold text-white tracking-wide uppercase truncate">{match.homeTeam}</span>
          </div>
          <span className="text-xs font-bold tracking-widest text-cyan-400/40 shrink-0 mx-2">VS</span>
          <div className="flex items-center gap-2.5 text-right flex-row-reverse max-w-[45%] truncate">
            <FlagIcon countryCode={match.awayCountryCode} size={32} />
            <span className="text-sm font-bold text-white tracking-wide uppercase truncate">{match.awayTeam}</span>
          </div>
        </div>
      </GlassCard>

      {!savedData ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Winner Choice Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase font-mono tracking-widest block">
              Forecast Outcome
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {choiceOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => setChoice(opt.value)}
                  className={`
                    flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-all duration-300
                    ${choice === opt.value ? getActiveStyles(opt.value) : 'bg-black/30 ' + opt.border}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <span className="text-sm font-bold text-white">{opt.label}</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      choice === opt.value
                        ? getRadioStyles(opt.value) + ' text-black'
                        : 'border-white/10 bg-transparent'
                    }`}
                  >
                    {choice === opt.value && <div className="w-2 h-2 rounded-full bg-black" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Reasoning Text */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase font-mono tracking-widest flex items-center justify-between">
              <span>Tactical Reasoning <span className="text-gray-600 font-normal lowercase">(Optional)</span></span>
              <span className="text-[10px] text-gray-500 font-normal">Saves to AI Memory</span>
            </label>
            <textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Construct your strategic case: consider team forms, weather parameters, suspensions, defensive shapes..."
              className="w-full min-h-[110px] bg-black border border-white/10 rounded-xl p-4 text-xs text-gray-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 font-mono leading-relaxed placeholder:text-gray-600 transition-all"
            />
          </div>

          {/* Error message */}
          {submitError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2 text-[11px] font-mono">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-rose-400 font-bold block mb-1">Transaction Failed</span>
                <span className="text-rose-300">{submitError}</span>
              </div>
            </div>
          )}

          {/* CTA Trigger */}
          <button
            type="submit"
            disabled={isSubmitting}
            id="commit-prediction-button"
            className="w-full py-4 px-6 font-bold bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                {onChainConfig?.enabled ? 'Awaiting Wallet Signature...' : 'Appending MemWal disk...'}
              </>
            ) : (
              <>Commit Prediction &rarr;</>
            )}
          </button>
        </form>
      ) : (
        /* Success / WAL ledger view */
        <div className="animate-scale-up space-y-6">
          <GlassCard glowColor="emerald" className="p-6 text-center border-emerald-500/20 space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 animate-pulse">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Prediction Saved Locally</h2>
              <p className="text-xs text-gray-400 mt-1">
                Your tactical entry has been recorded in the MemWal database ledger.
              </p>
            </div>

            {/* WAL RECEIPT */}
            <div className="bg-black/80 border border-white/5 rounded-xl p-4 text-left font-mono text-[10px] text-gray-400 space-y-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-gray-600 uppercase font-bold flex items-center gap-1">
                  <FileJson className="w-3 h-3 text-cyan-400" /> MEMWAL RECEIPT
                </span>
                <span className={`text-[8px] px-2 py-0.5 rounded ${savedData.synced ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  {savedData.synced ? 'SYNCED' : 'BUFFERED'}
                </span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-gray-600">ID:</span>
                <span className="col-span-2 text-gray-300 font-bold">{savedData.id}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-gray-600">TIMESTAMP:</span>
                <span className="col-span-2 text-gray-300">{savedData.timestamp}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-gray-600">MATCH:</span>
                <span className="col-span-2 text-gray-300">{match.id} ({match.homeShort} vs {match.awayShort})</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-gray-600">FORECAST:</span>
                <span className="col-span-2 text-emerald-400 font-bold">{choice.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-gray-600">REASON:</span>
                <span className="col-span-2 text-gray-300 italic truncate">{reasoning || '(none)'}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-dashed border-white/10 text-[9px] text-cyan-400/60 justify-center">
                <Cpu className="w-3.5 h-3.5" />
                <span>MEMWAL ENCODE: SUCCESS</span>
              </div>
            </div>

            {/* ─── On-Chain Submission Section — shows digest from the primary submit ── */}
            {savedData.txDigest && (
              <div className="border-t border-white/10 pt-4 mt-2 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-bold">✅ On-Chain Submitted</span>
                </div>
                <div className="flex items-center gap-3 pl-5">
                  <a
                    href={`https://suiscan.xyz/mainnet/tx/${savedData.txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                  >
                    View on SuiScan
                  </a>
                  <span className="text-gray-600">|</span>
                  <a
                    href={`https://suivision.xyz/tx/${savedData.txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                  >
                    View on SuiVision
                  </a>
                </div>
                <div className="text-[9px] font-mono text-gray-500 truncate pl-5">
                  Digest: {savedData.txDigest.slice(0, 24)}...
                </div>
              </div>
            )}

            {/* ─── Legacy On-Chain Submission Section (for existing predictions) ── */}
            {!savedData.txDigest && onChainConfig && onSubmitOnChain && (
              <div className="border-t border-white/10 pt-4 mt-2 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-gray-500 uppercase tracking-wider">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Submit to Sui Mainnet</span>
                </div>

                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                  A PredictionRecord NFT will be minted to your wallet on Sui.
                </p>

                {/* Chain Status — reads from parent onChainConfig props */}
                {onChainConfig.lastTxDigest && !onChainConfig.lastTxError && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400 font-bold">✅ Submitted</span>
                    </div>
                    <div className="flex items-center gap-3 pl-5">
                      <a
                        href={`https://suiscan.xyz/mainnet/tx/${onChainConfig.lastTxDigest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                      >
                        View on SuiScan
                      </a>
                      <span className="text-gray-600">|</span>
                      <a
                        href={`https://suivision.xyz/tx/${onChainConfig.lastTxDigest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                      >
                        View on SuiVision
                      </a>
                    </div>
                  </div>
                )}

                {onChainConfig.lastTxError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2 text-[10px] font-mono">
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="text-rose-400">{onChainConfig.lastTxError}</span>
                  </div>
                )}

                <button
                  onClick={handleOnChainSubmit}
                  disabled={onChainConfig.isSubmitting || !!onChainConfig.lastTxDigest}
                  className={`w-full py-3 px-5 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                    onChainConfig.lastTxDigest
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                      : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg'
                  }`}
                >
                  {onChainConfig.isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing Transaction...
                    </>
                  ) : onChainConfig.lastTxDigest ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      On-Chain Confirmed
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" />
                      Submit On-Chain
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-2">
              <button
                onClick={onNavigateHome}
                className="grow py-3 px-5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl cursor-pointer transition-all active:scale-[0.98]"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setSavedData(null);
                }}
                className="grow py-3 px-5 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl cursor-pointer transition-all active:scale-[0.98]"
              >
                Modify Prediction
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
