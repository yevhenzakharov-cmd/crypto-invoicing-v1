import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const features = [
  {
    title: "Payment links",
    body: "Turn an invoice into a link. Your client opens it, connects a wallet, reviews the details and pays you in a few clicks.",
    note: "The invoice lives inside the link itself — after the #, the part browsers never send to a server.",
    icon: <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />,
  },
  {
    title: "Invoice generation",
    body: "Professional invoices with line items, tax, shipping and discounts. Export a PDF with a wallet-ready QR code.",
    note: "Amounts are calculated in exact integer math — no rounding drift between the invoice and the transfer.",
    icon: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" />,
  },
  {
    title: "Direct transfers",
    body: "Payments go straight from your client's wallet to yours on Ethereum, Base, Arbitrum or Polygon.",
    note: "We never hold, route or have access to funds. There is no contract in between — just a standard transfer.",
    icon: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  },
];

const highlights = [
  ["Encrypted templates", "Save templates as encrypted files on your own device. Unlock them with your wallet, or with a passphrase if you prefer."],
  ["Signed payment links", "Sign a link with your wallet and payers see a verified badge. If anyone edits the amount or address, the badge disappears."],
  ["No database", "There is nowhere for your invoices to leak from: we don't store them. Your files and links are the only copies."],
  ["Four networks", "USDC, USDT, DAI and native coins on Ethereum, Base, Arbitrum and Polygon. Official token contracts only."],
  ["Wallet sign-in", "Sign in with your wallet (Sign-In with Ethereum). No email, no password, no account to create."],
  ["Wallet-ready QR", "Every invoice can carry a standard payment QR (EIP-681) that mobile wallets scan directly."],
];

const faqs = [
  [
    "Do you ever hold my funds?",
    "No. Payments are ordinary transfers from the payer's wallet to the address on the invoice. Nothing passes through us, and there is no smart contract in between.",
  ],
  [
    "Where are my invoices stored?",
    "Nowhere on our side. An invoice exists in your browser while you edit it, in the encrypted template files you choose to save, and inside the payment links you share. We keep no database of invoices or clients.",
  ],
  [
    "How do encrypted templates work?",
    "When you save a template, your browser encrypts it with AES-256 before the file is created. By default the key comes from a signature by your wallet, so only that wallet can open the file. You can choose a passphrase instead. Lose the wallet or forget the passphrase and the file cannot be recovered — by you or by us.",
  ],
  [
    "What is a signed payment link?",
    "When you create a link while connected, you can sign it with your wallet. The payment page checks that signature, so your client knows the invoice really came from you and that the amount and address have not been changed.",
  ],
  [
    "Do you track visitors?",
    "We run no analytics, no tracking pixels and no advertising cookies. The only cookie is the encrypted sign-in session inside the app. Like any website, our hosting provider and the blockchain RPC providers your wallet talks to can see connection metadata such as IP addresses; we don't collect or store it.",
  ],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="wrap" id="top">
        <section className="hero">
          <div className="eyebrow" style={{ border: "1px solid var(--line-2)", padding: "6px 10px" }}>
            Non-custodial · no database · encrypted templates
          </div>
          <h1>
            Invoices paid <span className="grad">straight to your wallet.</span>
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 18, lineHeight: 1.6, maxWidth: 640 }}>
            Create invoices and payment links through a simple Web3 interface. Your client pays you directly, in stablecoins or native coins, on the network you choose.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/app" className="btn btn-primary">Create an invoice</Link>
            <Link href="#features" className="btn">How it works</Link>
          </div>
        </section>

        <section aria-label="Product preview" className="grid-hair" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="mono faint" style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>INV-012 · due in 30 days</span>
              <span style={{ color: "var(--accent)" }}>awaiting payment</span>
            </div>
            <div><div className="faint" style={{ fontSize: 13 }}>Bill to</div><div style={{ fontSize: 17 }}>Northwind Labs</div></div>
            <div style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "14px 0", display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>Smart-contract review, October</span><span className="mono">2,400.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="muted" style={{ fontSize: 13 }}>Total</span>
              <span className="mono" style={{ fontSize: 28 }}>2,400.00 <span className="muted" style={{ fontSize: 14 }}>USDC</span></span>
            </div>
          </div>
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
            <span className="mono faint" style={{ fontSize: 12 }}>payment link</span>
            <div className="mono" style={{ border: "1px solid var(--line-2)", padding: "12px 14px", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-2)" }}>
              /pay#1.eJyNkM1qwzAQhN9F5yLs2LET3wq9F...
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, fontSize: 13 }}>
              <div style={{ border: "1px solid var(--line)", padding: 12 }}><div className="faint" style={{ fontSize: 12 }}>Token</div>USDC</div>
              <div style={{ border: "1px solid var(--line)", padding: 12 }}><div className="faint" style={{ fontSize: 12 }}>Network</div>Base</div>
            </div>
            <span className="badge ok" style={{ alignSelf: "flex-start" }}>✓ signed by the issuer&apos;s wallet</span>
          </div>
        </section>

        <section className="section" id="features">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="eyebrow">01 · Features</div>
            <h2>Web3 payments made simple</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 620, lineHeight: 1.6 }}>Invoices, payment links and transfers — while your data stays yours.</p>
          </div>
          <div className="grid-hair cards">
            {features.map((f) => (
              <div className="card" key={f.title}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{f.icon}</svg>
                <h3>{f.title}</h3>
                <p style={{ color: "var(--text-2)" }}>{f.body}</p>
                <p className="faint" style={{ fontSize: 13, fontStyle: "italic" }}>{f.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="privacy">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="eyebrow">02 · Privacy by design</div>
            <h2>Built so there is nothing to leak</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 680, lineHeight: 1.6 }}>
              No custody, no database, no analytics. Read exactly what we do and don&apos;t see on the <Link href="/privacy">privacy page</Link>.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", borderTop: "1px solid var(--line)" }}>
            {highlights.map(([t, b], i) => (
              <div key={t} style={{ padding: "24px 24px 28px 0", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{t}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="faq">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="eyebrow">03 · FAQ</div>
            <h2>Frequently asked questions</h2>
          </div>
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {faqs.map(([q, a], i) => (
              <details className="faq-item" key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
