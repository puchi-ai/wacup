# Wacup - MemWal MVP ⚽

Wacup is an offline-first match prediction platform and AI football strategist. Built with **React (Vite) + Express Full-Stack**, it demonstrates **MemWal (Write-Ahead Log) replication principles** synchronized natively with client-side **IndexedDB Fallbacks**.

Powered by **OpenRouter** (multi-model AI gateway), the app acts as an engaging sports pundit with 6 distinct styles (British Pundit, Data Analyst, Tactical Coach, etc.) and remembers past conversations via Walrus Memory.

---

## 🏗️ Architecture Diagram

```
         +-------------------------------------------------------------+
         |                       CLIENT (BROWSER)                      |
         |                                                             |
         |   [Home Dashboard]  [Schedule View]  [History Stats & Graph]|
         +-------------------------+-----------------------------------+
                                   |
                  Read / Write Operations (Offline-First)
                                   v
         +-------------------------+-----------------------------------+
         |             Unified client-side memwal.ts Sync              |
         +-------------+---------------------------------+-------------+
                       |                                 |
                       | (Async Sync Fallback)           | (Immediate Local Commit)
                       v                                 v
         +-------------+-------------+     +-------------+-------------+
         |     HTTP REST Gateway     |     |   Browser-Native Store    |
         |    (Express Server API)   |     |     (IndexedDB Fallback)  |
         +-------------+-------------+     +---------------------------+
                       |
         +-------------+-----------------------------------------------+
         |                       EXPRESS SERVER                        |
         |                                                             |
         |    [API Routers] --->  [MemWal Sequential Log]              |
         |           |            (data/predictions.json on disk)      |
         |           v                                                 |
         |   [OpenAI SDK -> OpenRouter API] <-- OPENROUTER_API_KEY     |
         +-----------+-------------------------------------------------+
                     |
                     v
         [Llama / Gemini / DeepSeek / etc.] (OpenRouter gateway)
```

---

## 💾 The MemWal Memory Paradigm

To minimize cloud infrastructure costs and satisfy strict real-world reliability guidelines, the storage pattern implements **Dual-Commit Write-Ahead logs**:

1. **Immediate Local Block Commit**: Every prediction forecast and conversation message instantly commits to the local browser context via **IndexedDB** object stores (backed up by `localStorage`). This ensures immediate load times, perfect offline availability, and zero database read costs.
2. **Sequential Server Log Sync**: The client asynchronously dispatches an append command to the full-stack server's Write-Ahead Log endpoints (`/api/memwal/*`). The server appends this sequentially to persistent database files (`data/predictions.json`, `data/chats.json`), creating a durable historic log.
3. **Pundit Memory Integration**: When launching AI Chats, the active match history and forecasts are recovered from the server's WAL block and formatted as system background tokens, allowing the AI to remember and reference user profiles natively.

---

## 🔗 On-Chain Predictions (Sui Move Contract)

All predictions can be optionally submitted to a **Sui Move smart contract** on Sui mainnet. This creates a verifiable on-chain `PredictionRecord` NFT in the predictor's wallet.

### Contract
- **Location**: `contracts/prediction/`
- **Module**: `worldcup_predictor::prediction` — edition 2024
- **Functions**: `place_prediction`, `record_match_result` (admin), `resolve_prediction` (admin), `prediction_count` (public)

### How it works
1. User connects their Sui wallet and makes a prediction in the app (saved locally + MemWal)
2. If a wallet is connected and the contract is configured, the prediction is **automatically submitted on-chain** — minting a `PredictionRecord` NFT to the user's wallet
3. After match completion, the admin can `record_match_result` and `resolve_prediction` via the SDK
4. History view fetches `PredictionRecord` NFTs from the chain alongside local data

### Deploy the contract
```bash
# Requires Sui CLI installed
sui client publish --gas-budget 50000000 contracts/prediction
```
Then set the output package ID and market object ID in `.env`:
```env
VITE_SUI_PACKAGE_ID="<published-package-id>"
VITE_SUI_MARKET_ID="<market-object-id>"
```

### SDK
- **File**: `src/lib/suiContract.ts`
- PTB builders for all contract functions
- Query helpers to fetch user's `PredictionRecord` NFTs and market info
- Config loaded from `VITE_SUI_PACKAGE_ID`, `VITE_SUI_MARKET_ID`, `VITE_SUI_MARKET_INITIAL_SHARED_VERSION` env vars

---

## ⚙️ Environment Variables

The full-stack Express server loads parameters from a `.env` file at root. Documented structure is provided in `.env.example`:

```env
# OPENROUTER_API_KEY: Required for AI chat via OpenRouter (multi-model gateway).
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"

# AI_MODEL: OpenRouter model ID (default: meta-llama/llama-4-scout:free)
AI_MODEL="meta-llama/llama-4-scout:free"

# APP_URL: The URL where this applet is hosted.
APP_URL="http://localhost:3000"

# MEMWAL_ACCOUNT_ID: MemWalAccount object ID on Sui
MEMWAL_ACCOUNT_ID="YOUR_MEMWAL_ACCOUNT_OBJECT_ID"

# MEMWAL_PRIVATE_KEY: Ed25519 private key hex (delegate key)
MEMWAL_PRIVATE_KEY="YOUR_ED25519_PRIVATE_KEY_HEX"

# MEMWAL_SERVER_URL: Walrus Memory relayer URL (default: https://relayer.memory.walrus.xyz)
MEMWAL_SERVER_URL="https://relayer.memory.walrus.xyz"

# MEMWAL_NAMESPACE: Namespace for isolating app memories
MEMWAL_NAMESPACE="ai-match-predictor"

# VITE_SUI_PACKAGE_ID: Published on-chain prediction contract (optional)
VITE_SUI_PACKAGE_ID=""

# VITE_SUI_MARKET_ID: PredictionMarket shared object ID (optional)
VITE_SUI_MARKET_ID=""
```

---

## 🚀 Step-by-Step Setup Guide

Follow these steps to run the application in your local environment:

### Prerequisites
* **Node.js** v18 or later
* **npm** v10 or later

### 1. Install Dependencies
Initialize package packages in the workspace directory:
```bash
npm install
```

### 2. Configure Environment Secrets
Create a `.env` file based on our example:
```bash
cp .env.example .env
```
Ensure your `OPENROUTER_API_KEY` is specified inside `.env` to execute AI chat features.

### 3. Run Development Server
Spin up the coordinated Express + Vite middleware server on Port `3000`:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser to test the live preview.

### 4. Build for Production
Produce compiled production bundles:
```bash
npm run build
```
This runs the client Vite compiler to create optimized output assets in `/dist`, and bundles `server.ts` into a fast node script `/dist/server.cjs` via `esbuild`.

### 5. Launch Standalone Build
Launch the production system directly:
```bash
npm start
```

---

## 🌐 Vercel Deployment (Free Tier)

The project is configured for **Vercel Free (Hobby) plan** deployment with:
- Express server running as a serverless function (via `api/index.ts`)
- **Vercel KV (Upstash Redis)** for persistent data storage
- **Daily cron** for match data refresh (Free tier: 1 cron/day max)
- Static assets served via Vercel CDN

### Prerequisites
1. A [GitHub](https://github.com/) account
2. A [Vercel](https://vercel.com/) account (Hobby/Free plan)
3. Your environment variables ready (see `.env.example`)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### Step 2: Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. The default **Framework Preset** should auto-detect as **Vite**
4. **Build Command**: `npm run build` (already set in `vercel.json`)
5. **Output Directory**: `dist` (already set in `vercel.json`)

### Step 3: Add Vercel KV (for data persistence)
1. In your Vercel project dashboard, go to **Storage → Create Database → Vercel KV**
2. Select the **Hobby** plan (free — 30k requests/month, 256MB storage)
3. Follow the prompts to create the database
4. Vercel automatically injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into your environment
5. ✅ No manual env var setup needed for KV!

### Step 4: Configure Environment Variables
In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | For AI chat | Get at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `MEMWAL_ACCOUNT_ID` | For Walrus Memory | From [memory.walrus.xyz](https://memory.walrus.xyz) |
| `MEMWAL_PRIVATE_KEY` | For Walrus Memory | Delegate key hex |
| `APP_URL` | Recommended | Your Vercel domain (e.g. `https://your-app.vercel.app`) |

> **Note:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are auto-injected when you create Vercel KV — you don't need to add them manually.

### Step 5: Deploy
Click **Deploy** in the Vercel dashboard. Vercel will:
1. Run `vite build` to compile the React frontend → `dist/`
2. Detect `api/index.ts` as a serverless function
3. Deploy everything to Vercel's CDN

Your app is now live! 🎉

### Local Dev vs Vercel
| Feature | Local Dev | Vercel |
|---------|-----------|--------|
| Data storage | `data/*.json` files | Vercel KV (Upstash Redis) |
| Dev server | `npm run dev` (Vite + Express) | `api/index.ts` serverless |
| Match refresh | On startup + manual | Daily cron (`0 6 * * *`) |
| AI chat | OpenRouter API | Same |
| Static files | Vite middleware | Vercel CDN |

### Troubleshooting
- **"KV store not connected"** — Ensure you've added Vercel KV in your project Storage tab. Restart the deployment after adding it.
- **AI responding with fallback text** — Verify `OPENROUTER_API_KEY` is set in Vercel Environment Variables.
- **API returns 404** — Check that `vercel.json` rewrites are correct. The main entry is `api/index.ts`.
- **Cron not running** — Vercel Free only supports 1 cron/day. The cron is set to `0 6 * * *` (6 AM UTC daily).

---

## 🔒 Compliance & Safety Notes

Designed strictly as a non-gambling sports utility:
* **No Fin-Tech Integrity**: The code houses absolutely no integrations with betting slips, credit channels, deposit slips, or real balance accounts.
* **Consent Banner**: Employs a mandatory glassmorphic agreement model enforcing restricted jurisdictions, age guidance (18+), and a sports-data disclaimer before revealing screens.

---

## 🛠️ Troubleshooting Guide

### 1. "Vite: not found" or build errors
* **Cause**: Node modules are missing or corrupted.
* **Solution**: Clean your setup folders and reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### 2. AI responding with falling back text
* **Cause**: Your `OPENROUTER_API_KEY` was not detected inside the process environment.
* **Solution**: Double check `.env` file syntax and ensure you have a valid key from https://openrouter.ai/keys. The server outputs a warning if offline fallbacks are active.

### 3. "Failed to open local IndexedDB fallback store"
* **Cause**: Running the app inside high-security incognito or sandbox environments that deny local storage access.
* **Solution**: Enable browser cookies/local storage permissions or click "Open in New Tab" in the AI Studio header. The app automatically failovers to a memory cache backup if browser caches are blocked.
