import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { brandTitle } from "@/lib/brand";

export const metadata: Metadata = { title: brandTitle("Privacy") };

const rows: [string, string][] = [
  ["Your invoices", "Never stored by us. They exist in your browser while editing, in encrypted files you save, and inside payment links you share."],
  ["Payment links", "The invoice is in the part of the link after #. Browsers do not send that part to servers, so it never reaches our hosting."],
  ["Template files", "Encrypted in your browser with AES-256-GCM before the file is created. The key comes from your wallet signature or your passphrase. We never see either."],
  ["Funds", "Never held. Payments are standard transfers from the payer's wallet to the address on the invoice."],
  ["Sign-in", "Sign-In with Ethereum. We set one encrypted, httpOnly session cookie containing your wallet address. There is no account database."],
  ["Analytics & tracking", "None. No analytics scripts, tracking pixels, advertising cookies or third-party fonts."],
  ["What others can see", "Our hosting provider handles web requests and, like any host, can see connection metadata such as IP addresses. The blockchain RPC providers and, if you use it, the WalletConnect relay can too. We do not collect or store this data ourselves."],
  ["On-chain data", "Payments are public on the blockchain, like any transaction. That is a property of the network, not of this site."],
];

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ paddingTop: 72, maxWidth: 900 }}>
        <div className="eyebrow">Privacy</div>
        <h1 style={{ fontSize: "clamp(32px, 4.5vw, 52px)", fontWeight: 500, letterSpacing: "-0.02em", margin: "14px 0 18px" }}>
          What we see, and what we don&apos;t
        </h1>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.7, marginTop: 0 }}>
          This tool is designed to know as little about you as possible. Here is the precise picture, without marketing gloss.
        </p>
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 32 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 220px) 1fr", gap: 24, padding: "20px 0", borderBottom: "1px solid var(--line)" }}>
              <div className="mono" style={{ fontSize: 13, color: "var(--accent)" }}>{k}</div>
              <div style={{ color: "var(--text-2)", lineHeight: 1.7 }}>{v}</div>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
