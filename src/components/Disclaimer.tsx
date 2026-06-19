import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info, MapPinCheck, HelpCircle } from 'lucide-react';
import { GlassCard } from './GlassCard';

export const Disclaimer: React.FC<{ onAccept: () => void }> = ({ onAccept }) => {
  const [accepted, setAccepted] = useState<boolean>(true); // Default to true while checking

  useEffect(() => {
    const isAccepted = localStorage.getItem('memwal_disclaimer_accepted');
    if (!isAccepted) {
      setAccepted(false);
    } else {
      onAccept();
    }
  }, [onAccept]);

  const handleAccept = () => {
    localStorage.setItem('memwal_disclaimer_accepted', 'true');
    setAccepted(true);
    onAccept();
  };

  if (accepted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 overflow-y-auto">
      {/* Dynamic ambient backgrounds */}
      <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-72 h-72 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg my-auto animate-fade-in">
        <GlassCard glowColor="emerald" className="p-6 md:p-8 border-white/15">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 mb-4 animate-pulse">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Compliance & Safety Agreement
            </h1>
            <p className="text-sm text-gray-400">
              Welcome to AI Match Predictor. Please read our mandatory terms before proceeding.
            </p>
          </div>

          <div className="space-y-4 mb-8 text-left">
            <div className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-white/5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">No Real-Money Betting</h3>
                <p className="text-xs text-gray-400 mt-1">
                  This application is strictly a football tactical game and intelligence simulator. It does NOT facilitate gambling, betting slips, or financial monetary rewards.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-white/5">
              <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">18+ Age Requirement</h3>
                <p className="text-xs text-gray-400 mt-1">
                  By entering, you confirm you are at least 18 years of age or meet the legal age requirement in your local jurisdiction.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-white/5">
              <MapPinCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Restricted Jurisdictions</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Access is prohibited from regions where sports analysis prediction games or automated football simulators are restricted by legal ordinances. You assume all compliance responsibility.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-white/5">
              <HelpCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Academic MemWal Research</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Your predictions and conversations will be logged securely in our persistent **MemWal Write-Ahead Log** and browser-fallback system for model personalization.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleAccept}
            id="agree-compliance-button"
            className="w-full py-4.5 px-6 font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-sm rounded-xl cursor-pointer shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 transform active:scale-[0.98]"
          >
            Agree & Enter Predictor Arena
          </button>

          <p className="text-center text-[10px] text-gray-500 mt-4 leading-relaxed">
            Selecting "Agree" creates a persistent configuration cookie on your sandbox browser allowing access to the client.
          </p>
        </GlassCard>
      </div>
    </div>
  );
};
