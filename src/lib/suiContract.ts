/**
 * Sui On-Chain Prediction Contract SDK
 *
 * TypeScript bindings for the worldcup_predictor::prediction Move module.
 * Uses @mysten/sui v2.x Transaction builder with gRPC transport.
 *
 * ## Setup after deployment
 * 1. Deploy the contract to Sui mainnet:
 *    sui client publish --gas-budget 50000000 contracts/prediction
 * 2. Set VITE_SUI_PACKAGE_ID and VITE_SUI_MARKET_ID in .env
 * 3. AdminCap is transferred to the deployer's address
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PredictionContractConfig {
  /** Published package ID on Sui mainnet */
  packageId: string;
  /** ID of the shared PredictionMarket object */
  marketId: string;
  /** Initial shared version of the PredictionMarket object */
  marketInitialSharedVersion: number;
}

export interface OnChainPredictionRecord {
  id: string;
  predictor: string;
  matchId: string;
  choice: number; // 0=home, 1=draw, 2=away
  isResolved: boolean;
  wasCorrect: boolean;
}

export interface OnChainMatchResult {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition: string;
  recordedAt: number;
}

// ─── Fullnode URLs ─────────────────────────────────────────────────────────

const FULLNODE_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  localnet: 'http://127.0.0.1:9000',
};

// ─── Singleton Config ──────────────────────────────────────────────────────

let _config: PredictionContractConfig | null = null;

/** Set the contract config (call once at app boot from env vars). */
export function setContractConfig(config: PredictionContractConfig) {
  _config = config;
}

/** Get the current contract config. */
export function getContractConfig(): PredictionContractConfig | null {
  return _config;
}

// ─── SuiClient Factory ─────────────────────────────────────────────────────

export function createSuiClient(network: 'mainnet' | 'testnet' = 'mainnet'): SuiGrpcClient {
  const baseUrl = FULLNODE_URLS[network];
  if (!baseUrl) throw new Error(`Unknown network: ${network}`);
  return new SuiGrpcClient({ network, baseUrl });
}

// ─── Transaction Builders ──────────────────────────────────────────────────

/**
 * Build a PTB that places an on-chain prediction.
 *
 * Calls `place_prediction(market, match_id, choice)` on the Move contract,
 * minting a PredictionRecord NFT to the caller.
 *
 * @param matchId  Match identifier (e.g. "gA-1")
 * @param choice   0 = home, 1 = draw, 2 = away
 * @param config   Contract config with packageId and marketId
 * @returns        A Transaction object ready to be signed and executed
 */
export function buildPlacePredictionTx(
  matchId: string,
  choice: number,
  config: PredictionContractConfig,
): Transaction {
  const txb = new Transaction();

  txb.moveCall({
    target: `${config.packageId}::prediction::place_prediction`,
    arguments: [
      txb.sharedObjectRef({
        objectId: config.marketId,
        initialSharedVersion: config.marketInitialSharedVersion, // see note below
        mutable: true, // place_prediction takes &mut PredictionMarket
      }),
      txb.pure.string(matchId),
      txb.pure.u8(choice),
    ],
  });

  return txb;
}

/**
 * Build a PTB that records a match result on-chain (admin only).
 */
export function buildRecordMatchResultTx(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  competition: string,
  adminCapId: string,
  config: PredictionContractConfig,
): Transaction {
  const txb = new Transaction();
  txb.moveCall({
    target: `${config.packageId}::prediction::record_match_result`,
    arguments: [
      txb.object(adminCapId),
      txb.pure.string(matchId),
      txb.pure.string(homeTeam),
      txb.pure.string(awayTeam),
      txb.pure.u8(homeScore),
      txb.pure.u8(awayScore),
      txb.pure.string(competition),
    ],
  });
  return txb;
}

/**
 * Build a PTB that resolves a user's prediction (admin only).
 *
 * Marks a PredictionRecord as resolved and records correctness.
 *
 * @param recordId   The object ID of the PredictionRecord to resolve
 * @param wasCorrect True if the predictor's choice matched the actual result
 * @param adminCapId The AdminCap object ID
 */
export function buildResolvePredictionTx(
  recordId: string,
  wasCorrect: boolean,
  adminCapId: string,
  config: PredictionContractConfig,
): Transaction {
  const txb = new Transaction();
  txb.moveCall({
    target: `${config.packageId}::prediction::resolve_prediction`,
    arguments: [
      txb.object(adminCapId),
      txb.object(recordId),
      txb.pure.bool(wasCorrect),
    ],
  });
  return txb;
}

// ─── Query Helpers ─────────────────────────────────────────────────────────

/**
 * Parse the `json` field of a gRPC object response into a typed record.
 * The JSON output from gRPC places Move struct fields directly on the object,
 * wrapped under the `json` property when `include: { json: true }` is used.
 *
 * The PredictionRecord fields are:
 *   - id: { id: string }
 *   - predictor: string
 *   - match_id: string
 *   - choice: number (u8)
 *   - is_resolved: boolean
 *   - was_correct: boolean
 */
function parsePredictionRecordJson(json: Record<string, unknown> | null | undefined): OnChainPredictionRecord | null {
  if (!json) return null;
  const fields = json as Record<string, unknown>;
  return {
    id: ((fields.id as Record<string, unknown> | undefined)?.id as string) ?? '',
    predictor: (fields.predictor as string) ?? '',
    matchId: (fields.match_id as string) ?? '',
    choice: typeof fields.choice === 'number' ? fields.choice : parseInt(String(fields.choice), 10) || 0,
    isResolved: Boolean(fields.is_resolved),
    wasCorrect: Boolean(fields.was_correct),
  };
}

/**
 * Fetch all PredictionRecord objects owned by a wallet address using gRPC.
 *
 * The gRPC API uses `listOwnedObjects` with an `include` option for content.
 * The response returns objects with `type`, `json` (when include.json is true),
 * and `content` (BCS bytes when include.content is true).
 *
 * We request `include: { json: true }` to get the decoded JSON representation
 * of the Move struct fields, which is the closest equivalent to the old
 * JSON-RPC `content.fields`.
 */
export async function getUserPredictions(
  client: SuiGrpcClient,
  address: string,
  packageId: string,
): Promise<OnChainPredictionRecord[]> {
  const structType = `${packageId}::prediction::PredictionRecord`;

  const response = await client.listOwnedObjects({
    owner: address,
    type: structType,
    include: { json: true },
  });

  return response.objects
    .filter(obj => obj.type === structType)
    .map(obj => parsePredictionRecordJson(obj.json))
    .filter((r): r is OnChainPredictionRecord => r !== null);
}

/**
 * Fetch market info (prediction count) using gRPC.
 *
 * The gRPC API uses `getObject` with `objectId` and `include`.
 * The response has `object` (not `data`), and the JSON-serialized fields
 * are in `json` when `include: { json: true }` is set.
 */
export async function getMarketInfo(
  client: SuiGrpcClient,
  marketId: string,
): Promise<{ predictionCount: number }> {
  const response = await client.getObject({
    objectId: marketId,
    include: { json: true },
  });

  const json = response.object.json as Record<string, unknown> | null | undefined;
  if (!json) throw new Error('Market object not found on chain');

  return {
    predictionCount: parseInt(String(json.prediction_count), 10) || 0,
  };
}

/**
 * Load contract config from Vite environment variables at runtime.
 * Returns true if VITE_SUI_PACKAGE_ID is set.
 */
export function loadConfigFromEnv(): boolean {
  const packageId = import.meta.env.VITE_SUI_PACKAGE_ID as string | undefined;
  const marketId = import.meta.env.VITE_SUI_MARKET_ID as string | undefined;
  const marketInitialSharedVersion = import.meta.env.VITE_SUI_MARKET_INITIAL_SHARED_VERSION as string | undefined;

  if (!packageId || !marketId || !marketInitialSharedVersion) return false;

  setContractConfig({
    packageId,
    marketId,
    marketInitialSharedVersion: parseInt(marketInitialSharedVersion, 10),
  });
  return true;
}
