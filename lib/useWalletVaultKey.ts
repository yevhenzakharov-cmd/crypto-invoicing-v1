"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { WALLET_KEY_MESSAGE } from "./vault";

/**
 * Memory-only cache of the key signature for this tab. Never written to
 * storage; gone on reload.
 */
const cache = new Map<string, { signature: string; verified: boolean }>();

export class NonDeterministicWalletError extends Error {
  constructor() {
    super(
      "Your wallet produced a different signature each time, so it can't be used as a stable key (common with some smart-contract and hardware wallets). Use a passphrase instead.",
    );
  }
}

/**
 * Returns the wallet signature used as the template key.
 * `verify` (used when saving) asks for a second signature the first time and
 * checks both match, so a file can never be saved with a key the wallet
 * can't reproduce later.
 */
export function useWalletVaultKey() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  return useCallback(
    async ({ verify }: { verify: boolean }) => {
      if (!address) throw new Error("Connect your wallet first.");
      const k = address.toLowerCase();
      const hit = cache.get(k);
      if (hit && (hit.verified || !verify)) return { signature: hit.signature, address };
      const first = hit?.signature ?? (await signMessageAsync({ message: WALLET_KEY_MESSAGE }));
      if (verify) {
        const second = await signMessageAsync({ message: WALLET_KEY_MESSAGE });
        if (second.toLowerCase() !== first.toLowerCase()) throw new NonDeterministicWalletError();
      }
      cache.set(k, { signature: first, verified: verify || Boolean(hit?.verified) });
      return { signature: first, address };
    },
    [address, signMessageAsync],
  );
}

export function isVaultKeyVerified(address?: string) {
  return address ? Boolean(cache.get(address.toLowerCase())?.verified) : false;
}
