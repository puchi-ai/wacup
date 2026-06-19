import React, { useState, useEffect, useRef } from 'react';
import { Send, Cpu, Calendar, Database, User, ChevronDown, MessageSquare, BarChart3, Flame, Swords, BookOpen, Zap } from 'lucide-react';
import { Match, ChatMessage, Prediction } from '../types';
import { GlassCard } from './GlassCard';
import { FlagIcon } from './FlagIcon';
import { safeFormatDate } from '../lib/safeDate';

/** Available models on OpenRouter — prioritising fast, non-reasoning free models */
const AVAILABLE_MODELS = [
  {
    id: 'google/gemma-4-26b-a4b-it',
    name: 'Gemma 4 26B',
    provider: 'Google',
    description: 'Google Gemma 4, fast inference',
    color: 'text-blue-400',
    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  },
  {
    id: 'meta-llama/llama-4-scout:free',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    description: 'Free tier, strong & fast',
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    name: 'Nemotron Nano 30B',
    provider: 'NVIDIA',
    description: 'Fast MoE, low latency',
    color: 'text-amber-400',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'OpenAI',
    description: 'Open-source, efficient',
    color: 'text-violet-400',
    badge: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  },
];

/** Available pundit styles/personas */
export const PUNDIT_STYLES = [
  {
    id: 'british-pundit',
    name: 'British Pundit',
    description: 'Witty, professional, BBC Match of the Day style',
    icon: MessageSquare,
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Cold, statistical, all about xG and percentiles',
    icon: BarChart3,
    color: 'text-cyan-400',
    badge: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  },
  {
    id: 'passionate-fan',
    name: 'Passionate Fan',
    description: 'Emotional, hype-driven, dramatic commentary',
    icon: Flame,
    color: 'text-rose-400',
    badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  },
  {
    id: 'tactical-coach',
    name: 'Tactical Coach',
    description: 'Formation-focused, strategic, technical depth',
    icon: Swords,
    color: 'text-violet-400',
    badge: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  },
  {
    id: 'veteran-legend',
    name: 'Veteran Legend',
    description: 'Wise, experienced, storytelling from the game',
    icon: BookOpen,
    color: 'text-amber-400',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  },
  {
    id: 'ruthless-critic',
    name: 'Ruthless Critic',
    description: 'Blunt, brutally honest, Roy Keane-style',
    icon: Zap,
    color: 'text-red-400',
    badge: 'bg-red-500/10 border-red-500/20 text-red-400',
  },
];

interface AIChatViewProps {
  match: Match;
  chats: ChatMessage[];
  existingPrediction?: Prediction;
  onSendMessage: (text: string, model?: string, style?: string) => Promise<void>;
  onNavigateHome: () => void;
}

export const AIChatView: React.FC<AIChatViewProps> = ({
  match,
  chats,
  existingPrediction,
  onSendMessage,
  onNavigateHome,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(PUNDIT_STYLES[0]);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const styleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setIsStyleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter messages for this specific match context
  const filteredChats = chats.filter((c) => c.matchId === match.id);

  // Scroll synchronization
  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredChats, isAiThinking]);

  // Initial welcome message if chat history is empty
  useEffect(() => {
    if (filteredChats.length === 0) {
      // Simulate welcome loading slightly to look premium
      setIsAiThinking(true);
      const timer = setTimeout(async () => {
        setIsAiThinking(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filteredChats.length]);

  // Determine if streaming AI content is already visible (hide loading dots)
  const latestAIMessages = filteredChats.filter(c => c.sender === 'ai');
  const hasStreamingAI = latestAIMessages.length > 0 && latestAIMessages[latestAIMessages.length - 1].text.length > 0;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAiThinking) return;

    const userMsg = inputText;
    setInputText('');
    setIsAiThinking(true);

    try {
      await onSendMessage(userMsg, selectedModel.id, selectedStyle.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[500px] animate-fade-in">
      {/* Header bar */}
      <div className="flex items-start justify-between border-b border-white/5 pb-4 shrink-0 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest leading-none block">
              AI Discussion Log
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/15 px-1.5 py-0.5 rounded">
              <Database className="w-2.5 h-2.5" /> MEMWAL-INTEGRATED
            </span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1">
            Tactical Pundit Consult
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Style Selector Dropdown */}
          <div className="relative" ref={styleDropdownRef}>
            <button
              onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-white/5 border border-white/10 hover:border-white/20 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
            >
              {React.createElement(selectedStyle.icon, { className: `w-3 h-3 ${selectedStyle.color}` })}
              <span className="text-white hidden md:inline">{selectedStyle.name}</span>
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isStyleDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStyleDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#111] border border-white/10 rounded-xl shadow-2xl shadow-black/50 backdrop-blur-xl z-50 overflow-hidden">
                {PUNDIT_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      setSelectedStyle(style);
                      setIsStyleDropdownOpen(false);
                    }}
                    className={`w-full flex items-start gap-2.5 p-2.5 text-left cursor-pointer transition-all hover:bg-white/5 ${
                      selectedStyle.id === style.id ? 'bg-white/5' : ''
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] ${style.badge}`}>
                      {React.createElement(style.icon, { className: 'w-3 h-3' })}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold font-mono ${selectedStyle.id === style.id ? style.color : 'text-gray-200'}`}>
                        {style.name}
                      </div>
                      <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                        {style.description}
                      </div>
                    </div>
                    {selectedStyle.id === style.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-2 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model Selector Dropdown */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-white/5 border border-white/10 hover:border-white/20 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
            >
              <Cpu className={`w-3 h-3 ${selectedModel.color}`} />
              <span className="text-white hidden md:inline">{selectedModel.name}</span>
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-[#111] border border-white/10 rounded-xl shadow-2xl shadow-black/50 backdrop-blur-xl z-50 overflow-hidden">
                {AVAILABLE_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full flex items-start gap-2.5 p-2.5 text-left cursor-pointer transition-all hover:bg-white/5 ${
                      selectedModel.id === model.id ? 'bg-white/5' : ''
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] ${model.badge}`}>
                      <Cpu className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold font-mono ${selectedModel.id === model.id ? model.color : 'text-gray-200'}`}>
                        {model.name}
                      </div>
                      <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                        {model.provider} · {model.description}
                      </div>
                    </div>
                    {selectedModel.id === model.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-2 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onNavigateHome}
            className="text-xs font-mono text-gray-400 hover:text-white bg-white/5 border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
          >
            &larr; Back
          </button>
        </div>
      </div>

      {/* Match spotlight tag */}
      <div className="bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between my-3 shrink-0 text-xs shadow-md">
        <div className="flex items-center gap-2 font-mono text-gray-300">
          <Calendar className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Active Context:</span>
          <span className="text-[#00F0FF] font-extrabold tracking-wider inline-flex items-center gap-1.5">
            <FlagIcon countryCode={match.countryCode} size={20} /> {match.homeTeam} <span className="text-slate-500 font-normal">VS</span> {match.awayTeam} <FlagIcon countryCode={match.awayCountryCode} size={20} />
          </span>
        </div>
        
        {existingPrediction ? (
          <div className="font-mono text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 font-semibold">
            <span>Forecast Choice: {existingPrediction.choice.toUpperCase()}</span>
          </div>
        ) : (
          <div className="font-mono text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 font-semibold">
            <span>No prediction registered yet</span>
          </div>
        )}
      </div>

      {/* Main chat messages workspace */}
      <div className="grow overflow-y-auto pr-1 md:pr-2 space-y-4 mb-4 select-text custom-scrollbar">
        {filteredChats.length === 0 && !isAiThinking ? (
          <div className="h-full flex items-center justify-center text-center p-6">
            <div className="max-w-sm space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                <Cpu className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Start Match Discussion</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-mono">
                Ask the AI Football Expert for tactical insight, team reports, or odds explanations. It remembers your prediction choice automatically!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Seeded First Welcome message if empty chats */}
            {filteredChats.length === 0 && isAiThinking && (
              <div className="w-full flex items-center justify-center p-4">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {filteredChats
              .filter(msg => msg.sender !== 'ai' || msg.text.length > 0)
              .map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* User or AI Icon wrapper */}
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 text-xs ${
                    msg.sender === 'user'
                      ? 'bg-cyan-500 text-black border-cyan-400'
                      : 'bg-[#151515] text-emerald-400 border-white/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl relative select-text border font-sans text-xs md:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20 rounded-tr-none'
                      : 'bg-black/40 text-gray-300 border-white/10 rounded-tl-none'
                  }`}
                >
                  {/* Subtle top reflection glint */}
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
                  
                  {/* Chat message markdown content split by lines for nice layout */}
                  <div className="space-y-2 whitespace-pre-wrap">
                    {msg.text}
                  </div>

                  {/* Timestamp log */}
                  <span className="text-[9px] font-mono text-gray-600 mt-2 block text-right select-none">
                    {safeFormatDate(msg.timestamp, { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              </div>
            ))}

            {/* Show loading dots only while waiting for first chunk (streaming AI already visible otherwise) */}
            {isAiThinking && !hasStreamingAI && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-[#151515] border border-white/10 flex items-center justify-center shrink-0 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-bounce">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="bg-black/40 border border-white/10 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            
            <div ref={chatMessagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form Footer */}
      <form onSubmit={handleSend} className="mt-auto shrink-0 pb-3">
        <GlassCard glowColor="blue" className="p-2 border-white/15 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAiThinking}
            placeholder={
              existingPrediction 
                ? "Ask the AI about your prediction reasoning or request key match analysis..." 
                : "Ask about matches - do you support Home score or Away underdog?"
            }
            className="grow bg-transparent text-xs text-white placeholder-gray-500 font-mono outline-none px-3.5 py-2.5 rounded-lg disabled:opacity-50"
          />
          <button
            type="submit"
            id="send-ai-discuss-button"
            disabled={!inputText.trim() || isAiThinking}
            className="w-10 h-10 shrink-0 bg-cyan-500 hover:bg-cyan-400 active:scale-[0.95] text-black font-semibold rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </GlassCard>
      </form>
    </div>
  );
};
