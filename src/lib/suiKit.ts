/**
 * Sui dApp Kit Configuration
 *
 * Creates the Sui wallet connection kit using @mysten/dapp-kit-react.
 * Provides wallet connect/disconnect functionality for user on-chain identity.
 *
 * Docs: https://sdk.mystenlabs.com/dapp-kit/getting-started/react
 */
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

export const dAppKit = createDAppKit({
  autoConnect: true,
  networks: ['mainnet'],
  createClient: (network) => new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(network),
    network: network as any,
  }),
  // Disable Slush wallet — not needed for standard Sui wallet extensions
  slushWalletConfig: null,
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
