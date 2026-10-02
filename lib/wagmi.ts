"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig } from "wagmi";
import { BRAND } from "./brand";
import { SUPPORTED_CHAINS } from "./chains";
import { transports } from "./rpc";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

/**
 * With a WalletConnect project ID: full wallet list incl. mobile wallets via QR.
 * Without one: browser-extension wallets only, so the app still runs locally.
 */
const walletGroups = projectId
  ? [
      { groupName: "Popular", wallets: [metaMaskWallet, rabbyWallet, coinbaseWallet, rainbowWallet] },
      { groupName: "More", wallets: [walletConnectWallet, injectedWallet] },
    ]
  : [{ groupName: "Browser wallets", wallets: [injectedWallet, rabbyWallet, coinbaseWallet] }];

const connectors = connectorsForWallets(walletGroups, {
  appName: BRAND.name || "Crypto invoicing",
  projectId: projectId || "not-configured",
});

export const wagmiConfig = createConfig({
  connectors,
  chains: SUPPORTED_CHAINS,
  transports,
  ssr: true,
});

export const walletConnectConfigured = Boolean(projectId);
