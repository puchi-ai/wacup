/**
 * AI Match Predictor - Main App Container
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Home, Calendar, History, MessageSquare, Cpu, User,
} from 'lucide-react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import type { PredictionChoice } from './types';
import { Match, Prediction, ChatMessage, UserAccuracyStats, OnChainPredictionConfig } from './types';
import { memwalClient, localStore } from './lib/memwal';
import { Disclaimer } from './components/Disclaimer';
import { HomeView } from './components/HomeView';
import { PredictionView } from './components/PredictionView';
import { AIChatView } from './components/AIChatView';
import { HistoryView } from './components/HistoryView';
import { ScheduleView } from './components/ScheduleView';
import { GlassCard } from './components/GlassCard';
import { SuiWalletProfile } from './components/SuiWalletProfile';
import { ProfileView } from './components/ProfileView';
import {
  setContractConfig,
  getContractConfig,
  buildPlacePredictionTx,
  loadConfigFromEnv,
  createSuiClient,
  getUserPredictions,
  type OnChainPredictionRecord,
} from './lib/suiContract';
import { Transaction } from '@mysten/sui/transactions';

type ViewState = 'home' | 'prediction' | 'ai-discuss' | 'history' | 'schedule' | 'profile';

export default function App() {
  // Sui wallet connection state
  const suiAccount = useCurrentAccount();
  const walletAddress = suiAccount?.address || null;

  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [requestingWallet, setRequestingWallet] = useState(false);
  
  // Data State
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState<boolean>(false);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);  // MemWal SDK status
  const [memwalStatus, setMemwalStatus] = useState<{ sdk: boolean; offline: boolean }>({
    sdk: false,
    offline: true,
  });

  // ─── On-Chain Contract State ───────────────────────────────────────────
  const { signAndExecuteTransaction } = useDAppKit();
  /** Track which predictions have been submitted on-chain (matchId → txDigest) */
  const [submittedPredictions, setSubmittedPredictions] = useState<Record<string, string>>({});
  const [onChainConfig, setOnChainConfig] = useState<OnChainPredictionConfig>({
    enabled: false,
    isSubmitting: false,
    lastTxDigest: null,
    lastTxError: null,
  });

  // Load matches from backend API
  const refreshMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/matches');
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (e: any) {
      console.warn('Matches retrieval from server failed, utilizing offline cache', e);
    }
  }, []);

  // Fetch full data logs from MemWal (SDK → REST → IndexedDB fallback)
  const refreshMemWalLogData = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const logs = await memwalClient.syncLoadAll();
      setPredictions(logs.predictions);
      setChats(logs.chats);
    } catch (e: any) {
      setSyncError('Partial synchronization fail. Offline logs are displayed.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Bootstrapping Initializer
  useEffect(() => {
    let cancelled = false;

    async function bootApp() {
      try {
        setIsLoading(true);

        // 1. Load matches and data (each has internal error handling)
        await refreshMatches();
        if (cancelled) return;

        // 2. Load MemWal data (SDK → REST → IndexedDB fallback chain)
        await refreshMemWalLogData();
        if (cancelled) return;

        // 3. Query on-chain PredictionRecord objects for the connected wallet
        if (suiAccount && getContractConfig()) {
          await fetchOnChainRecords();
          if (cancelled) return;
        }

        // 4. Check MemWal SDK status for UI display
        const status = await memwalClient.getStatus();
        if (cancelled) return;
        setMemwalStatus(status);
      } catch (e: any) {
        console.warn('[Boot] Non-fatal init error:', e?.message || e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Load contract config from env vars
    const hasContract = loadConfigFromEnv();
    if (hasContract) {
      console.log('[On-Chain] ✅ Prediction contract configured (VITE_SUI_*)');
      setOnChainConfig(prev => ({ ...prev, enabled: true }));
    }

    // Only boot after a small delay to ensure wallet state is settled
    const timer = setTimeout(() => bootApp(), 100);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── On-Chain Sync Helpers ────────────────────────────────────────────
  /** Convert on-chain choice number (0|1|2) to PredictionChoice */
  const choiceFromNumber = (n: number): PredictionChoice =>
    n === 0 ? 'home' : n === 1 ? 'draw' : 'away';

  /** Query on-chain PredictionRecord objects for the connected wallet and merge into state */
  const fetchOnChainRecords = useCallback(async () => {
    const config = getContractConfig();
    if (!suiAccount?.address || !config) return;

    try {
      const client = createSuiClient('mainnet');
      const records: OnChainPredictionRecord[] = await getUserPredictions(
        client,
        suiAccount.address,
        config.packageId,
      );

      if (records.length === 0) return;

      console.log(`[On-Chain] ✅ Fetched ${records.length} prediction records from Sui for ${suiAccount.address.slice(0, 8)}...`);

      // Convert on-chain records to Prediction type and merge with local state
      const onChainPredictions: Prediction[] = records.map(r => ({
        id: `onchain-${r.id}`,
        matchId: r.matchId,
        choice: choiceFromNumber(r.choice),
        reasoning: '',
        timestamp: new Date().toISOString(),
        isResolved: r.isResolved,
        wasCorrect: r.wasCorrect,
        walletAddress: r.predictor,
      }));

      // Merge: on-chain records take priority over local ones for same matchId
      setPredictions(prev => {
        const merged = [...prev];
        for (const ocp of onChainPredictions) {
          const idx = merged.findIndex(p => p.matchId === ocp.matchId);
          if (idx >= 0) {
            merged[idx] = ocp;
          } else {
            merged.push(ocp);
          }
        }
        return merged;
      });

      // Track digests — we use record id as a synthetic digest for display
      setSubmittedPredictions(prev => {
        const next = { ...prev };
        for (const r of records) {
          next[r.matchId] = `onchain-${r.id}`;
        }
        return next;
      });
    } catch (e) {
      console.warn('[On-Chain] Failed to fetch on-chain records:', e);
    }
  }, [suiAccount]);

  // Re-fetch on-chain records when wallet connects or changes
  useEffect(() => {
    if (suiAccount && getContractConfig()) {
      fetchOnChainRecords();
    }
  }, [suiAccount, fetchOnChainRecords]);

  // Compute accuracy real-time stats filtered by wallet
  const accuracyStats = useMemo<UserAccuracyStats>(() => {
    const userPredictions = predictions.filter(p => walletAddress ? p.walletAddress === walletAddress : false);
    const resolved = userPredictions.filter((p) => p.isResolved);
    const correct = resolved.filter((p) => p.wasCorrect);
    const rate = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0;
    
    return {
      totalPredicted: userPredictions.length,
      totalResolved: resolved.length,
      correctPredictions: correct.length,
      incorrectPredictions: resolved.length - correct.length,
      accuracyRate: rate,
    };
  }, [predictions]);

  // Navigation controller helper — gates wallet-required views
  const handleNavigationState = (view: ViewState, matchId?: string) => {
    // Wallet-gated views: only allow navigation if wallet is connected
    const walletRequiredViews: ViewState[] = ['prediction', 'ai-discuss', 'history', 'profile'];
    if (walletRequiredViews.includes(view) && !suiAccount) {
      // Highlight connect button and scroll to header
      console.warn('[App] Wallet required for view:', view);
      setCurrentView('home');
      setRequestingWallet(true);
      setTimeout(() => setRequestingWallet(false), 3000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (matchId) {
      setSelectedMatchId(matchId);
    } else if (view === 'prediction' || view === 'ai-discuss') {
      // Find fallback nearest matching match if undefined
      const upcoming = matches.filter(m => m.status === 'upcoming');
      if (upcoming.length > 0) {
        setSelectedMatchId(upcoming[0].id);
      }
    }

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Predict form submission triggers (tags with wallet address)
  const executeSavePrediction = async (choice: 'home' | 'draw' | 'away', reasoning: string): Promise<string> => {
    if (!selectedMatchId) throw new Error('No match selected');

    const newPrediction: Prediction = {
      id: `pred-${Math.random().toString(36).substring(2, 9)}`,
      matchId: selectedMatchId,
      choice,
      reasoning,
      timestamp: new Date().toISOString(),
      isResolved: false,
      walletAddress: walletAddress || undefined,
    };

    // ─── On-chain first, then memwal ────────────────────────────────────
    if (walletAddress && getContractConfig()) {
      // 1. Submit on-chain first (throws on failure — wallet popup appears now)
      const txDigest = await handleOnChainSubmit(selectedMatchId, choice);

      // 2. Only on success: save to memwal
      await memwalClient.savePrediction(newPrediction);

      // 3. Update UI state
      setPredictions((prev) => {
        const filtered = prev.filter((p) => p.matchId !== selectedMatchId);
        return [newPrediction, ...filtered];
      });

      return txDigest;
    }

    // ─── No wallet / no contract: memwal-only fallback ───────────────────
    const isSuccessfulSync = await memwalClient.savePrediction(newPrediction);

    setPredictions((prev) => {
      const filtered = prev.filter((p) => p.matchId !== selectedMatchId);
      return [newPrediction, ...filtered];
    });

    if (!isSuccessfulSync) throw new Error('Failed to save prediction locally');
    return '';
  };

  // Discussion Chat message dispatch (tags with wallet address)
  // Features: optimistic user message + streaming AI response (SSE)
  const executeSendChatMessage = async (text: string, model?: string, style?: string): Promise<void> => {
    if (!selectedMatchId) return;

    const userMessage: ChatMessage = {
      id: `chat-${Math.random().toString(36).substring(2, 9)}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
      matchId: selectedMatchId,
      walletAddress: walletAddress || undefined,
    };
    const aiPlaceholderId = `chat-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Show user message in UI IMMEDIATELY before any async operations
    setChats((prev) => [...prev, userMessage]);

    // 2. Create AI placeholder message immediately for streaming
    const aiPlaceholder: ChatMessage = {
      id: aiPlaceholderId,
      sender: 'ai',
      text: '',
      timestamp: new Date().toISOString(),
      matchId: selectedMatchId,
    };
    setChats((prev) => [...prev, aiPlaceholder]);

    // 3. Persist user message to IndexedDB + Walrus in background (non-blocking)
    memwalClient.saveChat(userMessage).catch(console.error);

    // Gather thread context (before AI placeholder for clean history)
    const matchChats = chats.filter((c) => c.matchId === selectedMatchId);
    const discussionContext = [...matchChats, userMessage];

    // 3. Fetch streaming AI response
    try {
      const response = await fetch('/api/ai/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatchId,
          messages: discussionContext,
          model: model || undefined,
          style: style || 'british-pundit',
          stream: true,
        }),
      });

      if (!response.ok) throw new Error('Endpoint failure');
      if (!response.body) throw new Error('No response body');

      const contentType = response.headers.get('Content-Type') || '';
      let finalText = '';

      if (contentType.includes('text/event-stream')) {
        // ── SSE streaming mode ────────────────────────────────────────
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // keep incomplete line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.done) {
                  // streaming complete
                } else if (data.error) {
                  throw new Error(data.error);
                } else if (data.t) {
                  fullText += data.t;
                  // Update AI message incrementally (batched via React)
                  setChats((prev) =>
                    prev.map((msg) =>
                      msg.id === aiPlaceholderId ? { ...msg, text: fullText } : msg,
                    ),
                  );
                }
              } catch {
                // skip malformed SSE
              }
            }
          }
        }
        finalText = fullText;
      } else {
        // ── JSON response mode (fallback for non-streaming responses) ─
        try {
          const data = await response.json();
          finalText = data.text || JSON.stringify(data);
        } catch {
          // If JSON parsing fails, read as text
          finalText = await response.text();
        }
      }

      // 4. Save completed AI response to MemWal
      const finalTextSafe = finalText || 'The AI Football Expert is temporarily disconnected. Please try again shortly.';
      const savedMessage: ChatMessage = {
        id: aiPlaceholderId,
        sender: 'ai',
        text: finalTextSafe,
        timestamp: new Date().toISOString(),
        matchId: selectedMatchId,
      };
      // Update UI with final text (in case JSON fallback was used)
      setChats((prev) =>
        prev.map((msg) =>
          msg.id === aiPlaceholderId ? { ...msg, text: finalTextSafe } : msg,
        ),
      );
      await memwalClient.saveChat(savedMessage);
    } catch (e) {
      console.error('[Chat] Streaming error:', e);
      // Update placeholder with error fallback
      setChats((prev) =>
        prev.map((msg) =>
          msg.id === aiPlaceholderId
            ? {
                ...msg,
                text: 'The AI Football Expert is temporarily disconnected from standard feeds. Please try saving your entry again shortly.',
              }
            : msg,
        ),
      );
      // Still save the error message so it persists
      await memwalClient.saveChat({
        ...aiPlaceholder,
        text: 'The AI Football Expert is temporarily disconnected from standard feeds. Please try saving your entry again shortly.',
      });
    }
  };

  // Sandbox resolution trigger (Forces outcome evaluation)
  const executeSandboxMatchResolution = async (matchId: string, homeScore: number, awayScore: number) => {
    const isSuccessfulSimulation = await memwalClient.simulateMatchResult(matchId, homeScore, awayScore);
    if (isSuccessfulSimulation) {
      await refreshMatches();
      await refreshMemWalLogData();
    }
  };

  // Sandbox resetting log wipe triggers
  const executeResetLogDatabaseInstance = async () => {
    try {
      await fetch('/api/memwal/reset', { method: 'POST' });
      await localStore.clearAll();
      setPredictions([]);
      setChats([]);
      setSubmittedPredictions({});
      await refreshMatches();
      setCurrentView('home');
    } catch (e) {
      console.error('Reset database failed', e);
    }
  };

  // ─── On-Chain Submit Handler ────────────────────────────────────────────
  /** Convert PredictionChoice (home|draw|away) to u8 (0|1|2) */
  const choiceToNumber = (c: PredictionChoice): number =>
    c === 'home' ? 0 : c === 'draw' ? 1 : 2;

  /** Build, sign, and execute an on-chain prediction transaction. Returns the tx digest. */
  const handleOnChainSubmit = async (matchId: string, choice: PredictionChoice): Promise<string> => {
    const contractConfig = getContractConfig();
    if (!contractConfig) {
      throw new Error('Contract not configured. Set VITE_SUI_PACKAGE_ID and VITE_SUI_MARKET_ID.');
    }

    const txb = buildPlacePredictionTx(matchId, choiceToNumber(choice), contractConfig);

    setOnChainConfig(prev => ({ ...prev, isSubmitting: true, lastTxError: null }));

    try {
      // Set sender from wallet before serializing
      if (walletAddress) txb.setSenderIfNotSet(walletAddress);

      // Use BCS bytes instead of toJSON() to bypass valibot schema validation
      // (fixes "Expected Object but received Object" ValiError in browser)
      const suiClient = createSuiClient('mainnet');
      const txBytes = await txb.build({ client: suiClient });
      // Wrap bytes in Transaction.from() per the fix guide — reconstructs a
      // proper Transaction from BCS bytes that the wallet can safely handle
      const result = await signAndExecuteTransaction({ transaction: Transaction.from(txBytes) });

      if (result.$kind === 'FailedTransaction') {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? 'Transaction failed',
        );
      }

      const digest = result.Transaction.digest;
      setOnChainConfig(prev => ({
        ...prev,
        isSubmitting: false,
        lastTxDigest: digest,
        lastTxError: null,
      }));
      setSubmittedPredictions(prev => ({ ...prev, [matchId]: digest }));
      console.log('[On-Chain] ✅ Prediction submitted. Digest:', digest);
      return digest;
    } catch (e: any) {
      // Log valibot issues to pinpoint the exact failing field
      if (e?.issues) {
        console.error('ValiError issues:', JSON.stringify(e.issues, null, 2));
      }
      const msg = e?.message || 'Transaction was rejected or failed';
      setOnChainConfig(prev => ({ ...prev, isSubmitting: false, lastTxError: msg }));
      throw e;
    }
  };

  // Selected match resolver from ID
  const activeFocusMatch = useMemo(() => {
    return matches.find((m) => m.id === selectedMatchId) || matches[0];
  }, [matches, selectedMatchId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center p-6 text-center select-none font-mono">
        <div className="relative mb-6">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500/25 border-t-cyan-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-cyan-400 rotate-animation" />
          </div>
        </div>
        <h2 className="text-sm font-bold text-white uppercase tracking-widest mt-2">Loading Wacup</h2>
        <span className="text-[10px] text-gray-500 mt-1">Reticulating walrus memory blocks...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-cyan-500 selection:text-black font-sans pb-28">
      {/* Abstract Dynamic Shifting Background Lights */}
      <div className="fixed top-[-150px] left-[-150px] w-[700px] h-[700px] rounded-full blur-[120px] pointer-events-none bg-cyan-500/25 animate-glow-slow-1 transition-all z-0" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none bg-indigo-500/25 animate-glow-slow-2 transition-all z-0" />

      {/* Compliance Launcher Overlay */}
      <Disclaimer onAccept={() => setIsDisclaimerAccepted(true)} />

      {/* Top Navigation / Status Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigationState('home')}>
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <img src="/logo.svg" alt="Wacup" className="w-7 h-7" />
            </div>
            <span className="font-extrabold text-base md:text-lg tracking-wider uppercase text-white font-mono">WACUP</span>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Sui Wallet Connect / Profile — Apple Glass Style */}
            <SuiWalletProfile predictions={predictions} chats={chats} requestingWallet={requestingWallet} />
          </div>
        </div>
      </header>

      {/* Primary viewport content */}
      <main className="grow max-w-4xl w-full mx-auto p-4 md:p-8 animate-fade-in relative z-10">
        {syncError && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono rounded-xl text-center">
            ⚠️ {syncError}
          </div>
        )}

        {currentView === 'home' && (
          <HomeView
            matches={matches}
            predictions={predictions}
            stats={accuracyStats}
            walletAddress={walletAddress}
            onNavigate={handleNavigationState}
          />
        )}

        {currentView === 'prediction' && activeFocusMatch && (
          <PredictionView
            match={activeFocusMatch}
            onSavePrediction={executeSavePrediction}
            onNavigateHome={() => setCurrentView('home')}
            existingPrediction={predictions.find((p) => p.matchId === activeFocusMatch.id)}
            onChainConfig={onChainConfig.enabled ? onChainConfig : undefined}
            onSubmitOnChain={onChainConfig.enabled ? handleOnChainSubmit : undefined}
          />
        )}

        {currentView === 'ai-discuss' && activeFocusMatch && (
          <AIChatView
            match={activeFocusMatch}
            chats={chats}
            existingPrediction={predictions.find((p) => p.matchId === activeFocusMatch.id)}
            onSendMessage={executeSendChatMessage}
            onNavigateHome={() => setCurrentView('home')}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            predictions={predictions}
            matches={matches}
            stats={accuracyStats}
            walletAddress={walletAddress}
            onSimulateResolve={executeSandboxMatchResolution}
            onResetDatabase={executeResetLogDatabaseInstance}
            onNavigate={handleNavigationState}
            submittedPredictions={submittedPredictions}
          />
        )}

        {currentView === 'schedule' && (
          <ScheduleView
            matches={matches}
            predictions={predictions}
            walletAddress={walletAddress}
            onNavigate={handleNavigationState}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            predictions={predictions}
            chats={chats}
            matches={matches}
            stats={accuracyStats}
            onNavigateHome={() => setCurrentView('home')}
            onNavigate={handleNavigationState}
            submittedPredictions={submittedPredictions}
          />
        )}
      </main>

      {/* Floating Apple Dock Bottom Nav Grid — auto-resizes to fit items */}
      <nav className="fixed bottom-6 inset-x-0 z-40 px-4 pointer-events-none select-none">
        <div className="w-fit mx-auto pointer-events-auto">
          <GlassCard glowColor="blue" className="p-1 px-3 border-white/20 shadow-neutral-900 shadow-2xl rounded-2xl flex items-center justify-center gap-1 bg-black/60 backdrop-blur-xl">
            {/* Dock items — wallet-gated ones hidden when not logged in */}
            <button
              onClick={() => handleNavigationState('home')}
              id="active-nav-dock-home"
              className={`flex flex-col items-center gap-1 p-2 cursor-pointer transition-all ${
                currentView === 'home' ? 'text-cyan-400 scale-110' : 'text-gray-500 hover:text-gray-450'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[9px] font-bold font-mono tracking-wide">Home</span>
            </button>

            <button
              onClick={() => handleNavigationState('schedule')}
              id="active-nav-dock-schedule"
              className={`flex flex-col items-center gap-1 p-2 cursor-pointer transition-all ${
                currentView === 'schedule' ? 'text-cyan-400 scale-110' : 'text-gray-500 hover:text-gray-450'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-[9px] font-bold font-mono tracking-wide">Schedule</span>
            </button>

            {suiAccount && (
              <>
                <button
                  onClick={() => handleNavigationState('ai-discuss')}
                  id="active-nav-dock-pundit"
                  className={`flex flex-col items-center gap-1 p-2 cursor-pointer transition-all ${
                    currentView === 'ai-discuss' ? 'text-cyan-400 scale-110' : 'text-gray-500 hover:text-gray-450'
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-[9px] font-bold font-mono tracking-wide">AI Discuss</span>
                </button>

                <button
                  onClick={() => handleNavigationState('profile')}
                  id="active-nav-dock-profile"
                  className={`flex flex-col items-center gap-1 p-2 cursor-pointer transition-all ${
                    currentView === 'profile' ? 'text-cyan-400 scale-110' : 'text-gray-500 hover:text-gray-450'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="text-[9px] font-bold font-mono tracking-wide">Profile</span>
                </button>

                <button
                  onClick={() => handleNavigationState('history')}
                  id="active-nav-dock-history"
                  className={`flex flex-col items-center gap-1 p-2 cursor-pointer transition-all ${
                    currentView === 'history' ? 'text-cyan-400 scale-110' : 'text-gray-500 hover:text-gray-450'
                  }`}
                >
                  <History className="w-5 h-5" />
                  <span className="text-[9px] font-bold font-mono tracking-wide">History</span>
                </button>
              </>
            )}
          </GlassCard>
        </div>
      </nav>

      {/* Footer / Legal Section */}
      <footer className="mt-auto border-t border-white/10 bg-black/80 px-4 md:px-8 py-4 flex flex-col md:flex-row gap-2 md:gap-0 items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-[0.1em] z-20 shrink-0">
        <div className="flex gap-6">
          <span>© 2026 Wacup</span>
          <span className={memwalStatus.sdk ? 'text-emerald-500/80' : 'text-slate-500'}>
            {memwalStatus.sdk ? '⛓ Walrus Memory · On-Chain' : 'Powered by MemWal Storage'}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-center md:text-right text-rose-400/80 justify-center items-center">
          <span className="animate-pulse">⚠️ Mandatory Disclaimer: No Betting or Financial Rewards</span>
          <span className="text-slate-500">Restricted in UK/US Jurisdictions</span>
        </div>
      </footer>
    </div>
  );
}
