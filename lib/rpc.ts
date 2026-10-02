import { http, type Transport } from "viem";
import { arbitrum, base, mainnet, polygon } from "viem/chains";

/**
 * RPC endpoints. Public defaults work out of the box; for production and
 * privacy, set your own provider URLs in the environment.
 */
export const transports: Record<number, Transport> = {
  [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_MAINNET || undefined),
  [base.id]: http(process.env.NEXT_PUBLIC_RPC_BASE || undefined),
  [arbitrum.id]: http(process.env.NEXT_PUBLIC_RPC_ARBITRUM || undefined),
  [polygon.id]: http(process.env.NEXT_PUBLIC_RPC_POLYGON || undefined),
};
