import { arbitrum, base, mainnet, polygon } from "viem/chains";
import type { Address, Chain } from "viem";

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, polygon] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

export function getChain(id: number): Chain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === id);
}

export function isSupportedChainId(id: number): id is SupportedChainId {
  return SUPPORTED_CHAINS.some((c) => c.id === id);
}

export function explorerTxUrl(chainId: number, hash: string) {
  const chain = getChain(chainId);
  const baseUrl = chain?.blockExplorers?.default.url;
  return baseUrl ? `${baseUrl}/tx/${hash}` : undefined;
}

export function explorerAddressUrl(chainId: number, address: string) {
  const chain = getChain(chainId);
  const baseUrl = chain?.blockExplorers?.default.url;
  return baseUrl ? `${baseUrl}/address/${address}` : undefined;
}

export type Token = {
  symbol: string;
  name: string;
  decimals: number;
  /** undefined = the chain's native coin */
  address?: Address;
};

/**
 * Official token contracts per chain. Native stablecoins only — bridged
 * look-alikes are deliberately left out (e.g. there is no official Tether
 * deployment on Base, so USDT is not offered there).
 * The payment page re-checks symbol and decimals on-chain before paying.
 */
export const TOKENS: Record<SupportedChainId, Token[]> = {
  [mainnet.id]: [
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "DAI", name: "Dai", decimals: 18, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" },
    { symbol: "ETH", name: "Ether", decimals: 18 },
  ],
  [base.id]: [
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    { symbol: "DAI", name: "Dai", decimals: 18, address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" },
    { symbol: "ETH", name: "Ether", decimals: 18 },
  ],
  [arbitrum.id]: [
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { symbol: "DAI", name: "Dai", decimals: 18, address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" },
    { symbol: "ETH", name: "Ether", decimals: 18 },
  ],
  [polygon.id]: [
    { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    { symbol: "DAI", name: "Dai", decimals: 18, address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" },
    { symbol: "POL", name: "Polygon Ecosystem Token", decimals: 18 },
  ],
};

export function findToken(chainId: number, symbol: string): Token | undefined {
  if (!isSupportedChainId(chainId)) return undefined;
  return TOKENS[chainId].find((t) => t.symbol === symbol);
}

export const CHAIN_LABELS: Record<SupportedChainId, string> = {
  [mainnet.id]: "Ethereum",
  [base.id]: "Base",
  [arbitrum.id]: "Arbitrum One",
  [polygon.id]: "Polygon",
};
