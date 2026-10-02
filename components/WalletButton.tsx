"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

const WalletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
    <path d="M3 7V6a2 2 0 0 1 2-2h11" />
    <circle cx="16.5" cy="13.5" r="1.2" />
  </svg>
);

/** Connect button restyled to the console look. */
export function WalletButton({ label = "Connect Wallet" }: { label?: string }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");
        if (!ready) return <span className="btn btn-sm" aria-hidden style={{ opacity: 0 }}>{label}</span>;
        if (!account || !chain) {
          return (
            <button type="button" className="btn btn-primary btn-sm" onClick={openConnectModal}>
              <WalletIcon /> {label}
            </button>
          );
        }
        if (!connected) {
          return (
            <button type="button" className="btn btn-primary btn-sm" onClick={openConnectModal}>
              Sign in
            </button>
          );
        }
        return (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={`btn btn-sm${chain.unsupported ? " btn-danger" : ""}`} onClick={openChainModal}>
              {chain.unsupported ? "Wrong network" : chain.name}
            </button>
            <button type="button" className="btn btn-sm mono" onClick={openAccountModal}>
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
