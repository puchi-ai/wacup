/**
 * SuiWalletProfile — Apple Glass Style Wallet Connect/Disconnect
 *
 * Features:
 * - Animated gradient border (Apple glass style) around connect button
 * - Connected state shows address pill with hover dropdown
 */
import React from 'react';
import { User, LogOut, Copy, ExternalLink, CheckCircle2, Wallet, MessageSquare, Cpu } from 'lucide-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { dAppKit } from '../lib/suiKit';
import { GlassCard } from './GlassCard';
import type { Prediction, ChatMessage } from '../types';

interface SuiWalletProfileProps {
  className?: string;
  predictions?: Prediction[];
  chats?: ChatMessage[];
  requestingWallet?: boolean;
}

export const SuiWalletProfile: React.FC<SuiWalletProfileProps> = ({ className = '', predictions = [], chats = [], requestingWallet = false }) => {
  const account = useCurrentAccount();
  const kit = useDAppKit();
  const [copied, setCopied] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleDisconnect = async () => {
    try {
      await kit.disconnectWallet();
    } catch (e) {
      console.warn('[SuiWallet] Disconnect failed:', e);
    }
  };

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

  // Close dropdown on outside click — must be BEFORE any early return
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Wallet-linked predictions and chats
  const walletPredictions = predictions.filter(p => p.walletAddress === account?.address);
  const walletChats = chats.filter(c => c.sender === 'user' && c.walletAddress === account?.address);

  // ── Disconnected State: Dark Glass Button ───────────────────────────
  if (!account) {
    return (
      <div className={`relative group/connect ${className}`}>
        {/* Dark glass animated border container */}
        <div
          className={`relative rounded-xl overflow-hidden transition-all duration-500 ${
            requestingWallet
              ? 'shadow-[0_0_24px_rgba(6,182,212,0.6)] animate-pulse-border'
              : ''
          }`}
          style={{ padding: '1px' }}
        >
          {/* Rotating gradient border */}
          <div
            className="absolute pointer-events-none animate-glass-border z-0"
            style={{
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.6), rgba(255,255,255,0.3), rgba(255,255,255,0.6), transparent)',
              filter: 'blur(1px)',
              willChange: 'transform',
            }}
          />
          {/* Dark glass surface */}
          <div className="relative z-10 rounded-xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08]">
            <ConnectButton instance={dAppKit}>
              <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono text-white/90 tracking-wider">
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </span>
            </ConnectButton>
          </div>
        </div>
        {requestingWallet && (
          <div className="absolute right-0 top-full mt-2 text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg whitespace-nowrap animate-fade-in">
            Connect wallet to unlock all features
          </div>
        )}
      </div>
    );
  }

  // ── Connected State: Address Pill + Dropdown ─────────────────────────
  // Dropdown visibility: hover on desktop (group-hover), click/tap on mobile (dropdownOpen state)
  const showDropdown = dropdownOpen;

  return (
    <div className={`relative group ${className}`} ref={dropdownRef}>
      {/* Connected address pill with glass effect */}
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(16,185,129,0.12)]"
        style={{ padding: '1px' }}
      >
        <div
          className="absolute pointer-events-none animate-glass-border-slow z-0"
          style={{
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',              background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.4), transparent)',
              filter: 'blur(1px)',
            willChange: 'transform',
          }}
        />
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="relative z-10 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-xl cursor-pointer w-full text-left"
        >
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
            {shortenAddress(account.address)}
          </span>
        </button>
      </div>

      {/* Dropdown — visible on hover (desktop) OR click/tap (mobile) */}
      <div
        className={`absolute right-0 top-full mt-2 w-72 z-50 transition-all duration-200 translate-y-1 ${
          showDropdown || dropdownOpen
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:translate-y-0'
        }`}
      >
        <div className="relative">
          {/* Invisible bridge for hover continuity */}
          <div className="absolute -top-3 left-0 right-0 h-3" />
          <GlassCard glowColor="emerald" className="p-4 border-emerald-500/20 space-y-3 backdrop-blur-2xl bg-black/70 shadow-2xl shadow-emerald-500/5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider block">Sui Wallet</span>
                  <span className="text-[9px] font-mono text-emerald-400">Connected</span>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>

            {/* Address */}
            <div className="bg-black/60 border border-white/5 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-400 truncate max-w-[200px]">
                  {account.address}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                  title="Copy address"
                >
                  {copied ? (
                    <span className="text-[9px] text-emerald-400 font-mono font-bold">Copied!</span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* ── Wallet-linked Predictions ── */}
            {walletPredictions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                  <Cpu className="w-3 h-3" />
                  <span>Recent Predictions</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                  {walletPredictions.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5">
                      <span className="text-[9px] font-mono text-gray-400 truncate max-w-[130px]">{p.matchId}</span>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        p.choice === 'home' ? 'bg-emerald-500/10 text-emerald-400'
                        : p.choice === 'draw' ? 'bg-slate-500/10 text-slate-300'
                        : 'bg-rose-500/10 text-rose-400'
                      }`}>{p.choice}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Wallet-linked Chat History ── */}
            {walletChats.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                  <MessageSquare className="w-3 h-3" />
                  <span>Recent Discussions</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                  {walletChats.slice(0, 3).map((c) => (
                    <div key={c.id} className="bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5">
                      <p className="text-[9px] font-mono text-gray-400 truncate">
                        {c.text.length > 60 ? `${c.text.slice(0, 60)}...` : c.text}
                      </p>
                      <span className="text-[7px] font-mono text-gray-600">{new Date(c.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── On-Chain Badge ── */}
            <div className="flex items-center justify-center gap-1 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[7px] font-mono text-cyan-400/70 uppercase tracking-wider">MemWal · On-Chain</span>
            </div>

            {/* Sui Explorer links */}
            <div className="space-y-1">
              <a
                href={`https://suiscan.xyz/mainnet/account/${account.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>View on SuiScan</span>
              </a>
              <a
                href={`https://suivision.xyz/account/${account.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>View on SuiVision</span>
              </a>
            </div>

            {/* Disconnect action */}
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-[10px] font-mono font-bold rounded-lg cursor-pointer transition-all active:scale-[0.98]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect Wallet</span>
            </button>

            {/* Network badge */}
            <div className="flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Sui Mainnet</span>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
