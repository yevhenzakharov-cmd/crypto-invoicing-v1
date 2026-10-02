"use client";

import { useAccount } from "wagmi";
import { useAuth } from "@/app/providers";
import { InvoiceEditor } from "./InvoiceEditor";
import { WalletButton } from "./WalletButton";

/** The invoice generator, behind wallet sign-in (Sign-In with Ethereum). */
export function Workspace() {
  const { status, error } = useAuth();
  const { isConnected } = useAccount();

  if (status === "authenticated") return <InvoiceEditor />;

  return (
    <main className="wrap" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", justifyContent: "center" }}>
      <div className="panel" style={{ maxWidth: 520, width: "100%" }}>
        <div className="panel-head"><span className="eyebrow">Sign in</span><span className="mono faint" style={{ fontSize: 12 }}>no email · no password</span></div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" }}>Sign in with your wallet</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {status === "loading"
              ? "Checking your session…"
              : isConnected
                ? "Approve the sign-in message in your wallet. It's free and sends no transaction."
                : "Connect a wallet, then sign one message to prove it's yours. It's free and sends no transaction."}
          </p>
          {error && <div className="notice err" role="alert">{error}</div>}
          <div><WalletButton label="Connect & sign in" /></div>
        </div>
      </div>
    </main>
  );
}
