# Project knowledge

This file gives Freebuff context about your project: goals, commands, conventions, and gotchas.

## What this project is

**AI Match Predictor** is an offline-first football (soccer) match prediction platform with a server-side AI pundit (via OpenRouter multi-model gateway), **persistent on-chain memory via Walrus Memory (MemWal SDK)**, and **Sui wallet identity** integration. Users can connect their Sui wallet, view World Cup 2026 fixtures, make predictions (tagged with their wallet address), chat with an AI football analyst that remembers past conversations, and track their prediction history with stats.

## Commands

| Command | What it does |
|---------|-------------|
| `npm install` | Install dependencies (including Sui dApp Kit and AI SDK packages) |
| `npm run dev` | Start dev server (Express + Vite middleware) on port 3000 |
| `npm run build` | Build client (Vite) + bundle server (esbuild) → `dist/` |
| `npm start` | Run production server from `dist/` |
| `npm run lint` | Typecheck via `tsc --noEmit` |
| `npm run clean` | Remove `dist/` and `server.cjs` |

## Where key code lives

- **`server.ts`** — Express server: API routes, MemWal data persistence, **Vercel AI SDK + withMemWal middleware** for OpenRouter AI + memory, Vite middleware
- **`src/main.tsx`** — React entry point, **wraps App with Sui DAppKitProvider**
- **`src/App.tsx`** — Root app component with routing, **Sui wallet integration** (useCurrentAccount)
- **`src/components/`** — All UI components (HomeView, ScheduleView, PredictionView, HistoryView, AIChatView, Disclaimer, GlassCard, **SuiWalletProfile**)
- **`src/lib/memwal.ts`** — Client-side MemWal SDK integration with **wallet address tagging**
- **`src/lib/memwal-server.ts`** — Server-side MemWal utility functions (saveChatMemory, recallRelevantMemories)
- **`src/lib/suiKit.ts`** — **Sui dApp Kit configuration** (createDAppKit)
- **`src/mockData.ts`** — World Cup 2026 mock match data
- **`src/components/FlagIcon.tsx`** — Flag rendering component (SVG from CDN with emoji fallback)
- **`src/types.ts`** — TypeScript types including **walletAddress fields on Prediction and ChatMessage**
- **`src/index.css`** — Tailwind CSS v4 imports + global styles
- **`data/`** — Server-persisted JSON files (matches.json, predictions.json, chats.json, match-overrides.json)

## Architecture & data flow

1. User connects **Sui wallet** via the `SuiWalletProfile` component (uses `@mysten/dapp-kit-react`)
2. Wallet address is attached to each prediction and chat as `walletAddress` field
3. Predictions/chats commit immediately to IndexedDB (offline-first)
4. Same data asynchronously syncs to Express server via REST API (`/api/memwal/*`) and to **Walrus Memory** via the MemWal SDK
5. AI Chat calls `/api/ai/discuss` — the **withMemWal middleware** (from `@mysten-incubation/memwal/ai`) wraps the model and:
   - **Before generation**: Auto-recalls relevant memories from Walrus Memory and injects them into the prompt
   - **After generation**: Auto-saves conversation facts back to Walrus Memory
6. Match resolution (`/api/memwal/resolve-match`) auto-evaluates predictions

## Tech stack

- **Frontend**: React 19, Vite 6, Tailwind CSS 4, motion (animation), lucide-react (icons), recharts (charts)
- **Backend**: Express 4, tsx (dev runner), esbuild (prod bundle)
- **AI**: **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) → OpenRouter gateway (multi-model: Llama, Gemini, DeepSeek, etc.)
- **Blockchain**: **Walrus Memory** (`@mysten-incubation/memwal` with `withMemWal` middleware) + **Sui Wallet** (`@mysten/dapp-kit-react`)

## AI Integration (withMemWal + OpenRouter)

- **AI SDK**: Uses `generateText`/`streamText` from `ai` (Vercel AI SDK) with `openai` provider from `@ai-sdk/openai`
- **Base URL**: `https://openrouter.ai/api/v1`
- **Default model**: `meta-llama/llama-4-scout:free` (configurable via `AI_MODEL` env var)
- **Auth**: `OPENROUTER_API_KEY` env var (get at https://openrouter.ai/keys)
- **Memory Middleware**: `withMemWal` from `@mysten-incubation/memwal/ai` wraps the model for automatic memory recall/injection/save
- **Fallback**: Deterministic responses (no API key prompt) if `OPENROUTER_API_KEY` is not configured
- **Personas**: 6 pundit styles (British Pundit, Data Analyst, Passionate Fan, Tactical Coach, Veteran Legend, Ruthless Critic)

## Sui Wallet Integration

- **Package**: `@mysten/dapp-kit-react` (v2.0.3+)
- **Provider**: `DAppKitProvider` wraps the app in `main.tsx`, config via `createDAppKit` in `src/lib/suiKit.ts`
- **Components**: `ConnectButton` (from `@mysten/dapp-kit-react/ui`), `useCurrentAccount` and `useDAppKit` hooks
- **Wallet Profile**: `SuiWalletProfile.tsx` shows connect button when disconnected, hover-dropdown card with address/copy/explorer link/disconnect when connected
- **Data Tagging**: Wallet address is stored as `walletAddress` field on all predictions and chat messages, and tagged in Walrus Memory as `wallet: <address>`

## withMemWal Middleware

The `withMemWal` middleware from `@mysten-incubation/memwal/ai` wraps any AI SDK model with automatic Walrus Memory management:

```
model = withMemWal(baseModel, {
  key, accountId, serverUrl, namespace,
  maxMemories: 8,    // max memories to inject per request
  autoSave: true,    // auto-save conversation facts
  minRelevance: 0.25 // minimum similarity threshold
})

# Before each LLM call:
#   - Reads last user message as search query
#   - Recalls memories from Walrus Memory
#   - Injects relevant memories into system prompt
#
# After each LLM call:
#   - Analyzes and saves important facts (non-blocking)
```

## On-Chain Prediction Contract (Sui Move)

- **Location**: `contracts/prediction/`
- **Module**: `worldcup_predictor::prediction`
- **Edition**: Sui Move 2024 (system-provided framework, no `[dependencies]` needed)
- **Package**: `Move.toml` with `[addresses] worldcup_predictor = "0x0"`

### Contract functions
| Function | Access | Description |
|---|---|---|
| `place_prediction` | Public | Submit prediction. Mints `PredictionRecord` NFT to caller |
| `record_match_result` | AdminCap | Index a completed match on-chain as a shared `MatchResult` object |
| `resolve_prediction` | AdminCap | Mark a user's `PredictionRecord` as resolved (correct/incorrect) |
| `prediction_count` | Public | View total prediction count |

### Structs
- **`AdminCap`** — Admin capability (transferred to deployer at `init`)
- **`PredictionMarket`** — Shared config: prediction_count
- **`PredictionRecord`** — User-owned NFT: match_id, choice (0=home/1=draw/2=away), is_resolved, was_correct
- **`MatchResult`** — Shared indexed result: match_id, teams, scores, competition, recorded_at

### SDK (TypeScript bindings)
- **Location**: `src/lib/suiContract.ts`
- Provides PTB builders: `buildPlacePredictionTx`, `buildRecordMatchResultTx`, `buildResolvePredictionTx`
- Query helpers: `getUserPredictions`, `getMarketInfo`
- Config loader: `loadConfigFromEnv()` reads `VITE_SUI_PACKAGE_ID`, `VITE_SUI_MARKET_ID`, `VITE_SUI_MARKET_INITIAL_SHARED_VERSION`
- Uses `@mysten/sui` v2.x Transaction builder and SuiGrpcClient (gRPC transport)

### Build & lint
```bash
# Build with linting (no separate lint subcommand)
sui move build --lint --path contracts/prediction

# Build for production
sui move build --path contracts/prediction

# Publish to mainnet
sui client publish --gas-budget 50000000 contracts/prediction
```

The contract uses `public fun` (not `public entry fun`) — `entry` is redundant with `public` in edition 2024. All calls go through PTBs via the SDK.

### On-Chain Prediction Flow
1. User connects Sui wallet and makes a prediction
2. Prediction is saved locally (IndexedDB + MemWal) for instant reactivity
3. **Auto-submitted on-chain**: If wallet is connected and contract is configured, a PTB is built and signed, minting a `PredictionRecord` NFT to the user's wallet
4. History view fetches `PredictionRecord` objects from chain alongside local data

## Key conventions & patterns

- **Styling**: Tailwind CSS v4 with `@import "tailwindcss"` syntax (no postcss config needed)
- **UI pattern**: Glassmorphic cards (`GlassCard` component), dark theme, wallet connect/disconnect in header
- **All Express routes** prefixed with `/api/`
- **TypeScript**: strict-ish with `tsc --noEmit` for type checking
- **Path alias**: `@/` maps to project root (e.g., `@/src/types`)
- **Motion**: use `motion` library (formerly framer-motion) for animations

## Gotchas & constraints

- **OPENROUTER_API_KEY required** for AI features. Without it, the AI chat falls back to deterministic responses.
- **MEMWAL_ACCOUNT_ID and MEMWAL_PRIVATE_KEY required** for Walrus Memory persistence (both withMemWal middleware and client-side SDK)
- **Sui wallet** is optional — the app works without it. When connected, predictions/chats are tagged with the wallet address for on-chain identity.
- **On-chain prediction** requires deployed contract + env vars: `VITE_SUI_PACKAGE_ID`, `VITE_SUI_MARKET_ID`. If unset, on-chain submission is disabled.
- **withMemWal middleware** requires MEMWAL env vars (key + accountId). Config: `maxMemories: 8`, `autoSave: true`, `minRelevance: 0.25`
- **HMR is disabled** when `DISABLE_HMR=true` env var is set (AI Studio mode). File watching is also disabled in that case.
- **Server runs on port 3000**, not Vite's default 5173.
- **Data lives in files** under `data/` — these are not gitignored and persist locally.
- **No test framework** is currently set up. No test files exist.
- **Windows users**: npm scripts use `rm -rf` (POSIX) — won't work on Windows cmd; use Git Bash or WSL.
