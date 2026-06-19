/**
 * ProfileView — User Profile Page
 *
 * Displays the connected Sui wallet details, SUI balance,
 * prediction statistics, and recent predictions linked to the wallet address.
 *
 * Only available when a Sui wallet is connected.
 */
import React, { useState, useEffect } from 'react';
import {
  User, Copy, ExternalLink, Wallet, Coins, Cpu, Activity,
  CheckCircle2, XCircle, Clock, TrendingUp, Sparkles, ArrowUpRight,
  MessageSquare,
} from 'lucide-react';
import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { GlassCard } from './GlassCard';
import type { Prediction, ChatMessage, UserAccuracyStats, Match } from '../types';

interface ProfileViewProps {
  predictions: Prediction[];
  chats: ChatMessage[];
  matches: Match[];
  stats: UserAccuracyStats;
  onNavigateHome: () => void;
  onNavigate: (view: 'home' | 'prediction' | 'ai-discuss' | 'history' | 'schedule' | 'profile', matchId?: string) => void;
  /** Track which predictions have on-chain digests (matchId → txDigest) */
  submittedPredictions?: Record<string, string>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  predictions,
  chats,
  matches,
  stats,
  onNavigateHome,
  onNavigate,
  submittedPredictions = {},
}) => {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const [suiBalance, setSuiBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch SUI balance when wallet is connected
  useEffect(() => {
    if (!account?.address) return;

    let cancelled = false;
    setBalanceLoading(true);

    (async () => {
      try {
        const balance = await (client as any).getBalance({
          owner: account.address,
          coinType: '0x2::sui::SUI',
        });
        if (!cancelled) {
          const sui = (Number(balance.totalBalance) / 1_000_000_000).toFixed(4);
          setSuiBalance(sui);
        }
      } catch (e) {
        console.warn('[Profile] Failed to fetch SUI balance:', e);
        if (!cancelled) setSuiBalance(null);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [account?.address, client]);

  const handleCopyAddress = async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = account.address;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (addr: string) => {
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get wallet-tagged predictions
  const walletPredictions = predictions.filter(p => p.walletAddress === account?.address);

  // Get wallet-tagged chat history (user messages)
  const walletChats = chats
    .filter(c => c.walletAddress === account?.address)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  // Get match for each prediction
  const hydratedPredictions = walletPredictions
    .map(p => ({ ...p, match: matches.find(m => m.id === p.matchId) }))
    .filter(p => p.match)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  // If no wallet connected, show prompt
  if (!account) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block mb-1">
              User Profile
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              On-Chain Identity
            </h1>
          </div>
          <button
            onClick={onNavigateHome}
            className="text-xs font-mono text-gray-400 hover:text-white bg-white/5 border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
          >
            &larr; Back
          </button>
        </div>

        <GlassCard glowColor="blue" className="p-8 text-center border-white/10 space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400">
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Connect Your Sui Wallet</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto font-mono leading-relaxed">
              Connect a Sui wallet to view your on-chain profile, SUI balance, and prediction &amp; chat history tagged to your address.
            </p>
          </div>
          <p className="text-[10px] text-cyan-400 font-mono mt-2">
            Use the Connect Wallet button in the header above.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block mb-1">
            User Profile
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            On-Chain Identity
            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
              Connected
            </span>
          </h1>
        </div>
        <button
          onClick={onNavigateHome}
          className="text-xs font-mono text-gray-400 hover:text-white bg-white/5 border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
        >
          &larr; Back
        </button>
      </div>

      {/* Wallet Identity Card */}
      <GlassCard glowColor="emerald" className="p-5 border-emerald-500/20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="grow">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block">Sui Wallet</span>
            <span className="text-[10px] font-mono text-emerald-400">Connected to Mainnet</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        </div>

        {/* Full address display */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Wallet className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-xs font-mono text-gray-300 truncate">{account.address}</span>
            </div>
            <button
              onClick={handleCopyAddress}
              className="text-gray-500 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copy address"
            >
              {copied ? (
                <span className="text-[9px] text-emerald-400 font-mono font-bold">Copied!</span>
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* SUI Balance */}
        <div className="flex items-center gap-3 bg-black/30 border border-white/5 rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
          <div className="grow">
            <span className="text-[10px] font-mono text-gray-500 uppercase block">SUI Balance</span>
            {balanceLoading ? (
              <span className="text-sm font-mono text-gray-400 animate-pulse">Loading...</span>
            ) : suiBalance !== null ? (
              <span className="text-lg font-bold font-mono text-white">{suiBalance} SUI</span>
            ) : (
              <span className="text-sm font-mono text-gray-500">Unable to fetch</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`https://suiscan.xyz/mainnet/account/${account.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
              title="View on SuiScan"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">SuiScan</span>
            </a>
            <a
              href={`https://suivision.xyz/account/${account.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300 transition-colors"
              title="View on SuiVision"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">SuiVision</span>
            </a>
          </div>
        </div>
      </GlassCard>

      {/* Prediction Stats */}
      <GlassCard glowColor="blue" className="p-5 border-white/10 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          Prediction Statistics
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
            <span className="text-[9px] font-mono text-gray-500 uppercase block">Total</span>
            <span className="text-lg font-bold font-mono text-white mt-1 block">{walletPredictions.length}</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
            <span className="text-[9px] font-mono text-gray-500 uppercase block">Resolved</span>
            <span className="text-lg font-bold font-mono text-white mt-1 block">{stats.totalResolved}</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
            <span className="text-[9px] font-mono text-gray-500 uppercase block">Correct</span>
            <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">{stats.correctPredictions}</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
            <span className="text-[9px] font-mono text-gray-500 uppercase block">Accuracy</span>
            <span className="text-lg font-bold font-mono text-cyan-400 mt-1 block">
              {stats.totalResolved > 0 ? `${stats.accuracyRate}%` : '—'}
            </span>
          </div>
        </div>

        {/* Accuracy trend indicator */}
        {stats.totalResolved > 0 && (
          <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-gray-500 border-t border-white/5 pt-3">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {stats.correctPredictions}/{stats.totalResolved} resolved predictions
              {stats.accuracyRate >= 60 ? ' — strong form!' : stats.accuracyRate >= 40 ? ' — room to improve!' : ' — keep trying!'}
            </span>
          </div>
        )}
      </GlassCard>

      {/* Wallet-Linked Chat History */}
      <GlassCard glowColor="default" className="p-5 border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            Chat History
          </h2>
          {walletChats.length > 0 && (
            <button
              onClick={() => onNavigate('history')}
              className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              View all &rarr;
            </button>
          )}
        </div>

        {walletChats.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-mono">No chat history linked to this wallet yet.</p>
            <p className="text-[10px] font-mono text-gray-600 mt-1">
              AI discussions made while connected will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {walletChats.map((c) => (
              <div
                key={c.id}
                className="bg-black/40 border border-white/5 rounded-lg p-3 text-xs font-mono"
              >
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    c.sender === 'user' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {c.sender === 'user' ? 'You' : 'AI'}
                  </span>
                  <div className="grow min-w-0">
                    <p className="text-gray-300 truncate">
                      {c.text.length > 80 ? `${c.text.slice(0, 80)}...` : c.text}
                    </p>
                    <span className="text-[8px] text-gray-600 mt-0.5 block">
                      {new Date(c.timestamp).toLocaleDateString()} {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Recent Wallet-Tagged Predictions */}
      <GlassCard glowColor="default" className="p-5 border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            Recent Predictions
          </h2>
          {walletPredictions.length > 0 && (
            <button
              onClick={() => onNavigate('history')}
              className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              View all &rarr;
            </button>
          )}
        </div>

        {hydratedPredictions.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-mono">No predictions tagged with this wallet yet.</p>
            <p className="text-[10px] font-mono text-gray-600 mt-1">
              Predictions made while connected will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {hydratedPredictions.map(({ id, choice, reasoning, timestamp, isResolved, wasCorrect, match }) => (
              <div
                key={id}
                className="bg-black/40 border border-white/5 rounded-lg p-3 flex items-center justify-between text-xs font-mono"
              >
                <div className="grow min-w-0">
                  <span className="text-gray-300 truncate block">
                    {match!.homeShort} vs {match!.awayShort}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      choice === 'home'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : choice === 'draw'
                        ? 'bg-slate-500/10 text-slate-300'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {choice.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      {new Date(timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 ml-2">
                  {isResolved ? (
                    wasCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    )
                  ) : (
                    <Clock className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* On-Chain Identity Info */}
      <GlassCard glowColor="default" className="p-4 border-white/5 space-y-3">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
          On-Chain Identity
        </h3>
        <div className="space-y-2 text-[10px] font-mono">
          <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-2.5">
            <span className="text-gray-500">Network</span>
            <span className="text-emerald-400 font-bold">Sui Mainnet</span>
          </div>
          <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-2.5">
            <span className="text-gray-500">Wallet Tagged Predictions</span>
            <span className="text-white font-bold">{walletPredictions.length}</span>
          </div>              <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-2.5">
                <span className="text-gray-500">Chat Messages</span>
                <span className="text-white font-bold">{walletChats.length}</span>
              </div>
              <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-2.5">
                <span className="text-gray-500">On-Chain Submissions</span>
                <span className="text-amber-400 font-bold">{Object.keys(submittedPredictions).length}</span>
              </div>
              <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-2.5">
                <span className="text-gray-500">MemWal Data</span>
                <span className="text-cyan-400 font-bold">Walrus Memory</span>
              </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-1 border-t border-white/5">
          <a
            href={`https://suiscan.xyz/mainnet/account/${account.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>View on SuiScan</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
          <span className="text-gray-600 text-[10px]">|</span>
          <a
            href={`https://suivision.xyz/account/${account.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>View on SuiVision</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </GlassCard>
    </div>
  );
};
