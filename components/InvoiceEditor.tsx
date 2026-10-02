"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { CHAIN_LABELS, findToken, SUPPORTED_CHAINS, TOKENS, type SupportedChainId } from "@/lib/chains";
import { eip681Uri } from "@/lib/eip681";
import { amountDue, blankInvoice, computeTotals, type Invoice, type Party } from "@/lib/invoice";
import { formatFixed, parseAmount } from "@/lib/money";
import { QR_STYLES, qrPngDataUrl, type QrStyle } from "@/lib/qr";
import { PaymentLinkDialog } from "./PaymentLinkDialog";
import { QrPreview } from "./QrPreview";
import { OpenTemplateDialog, SaveTemplateDialog } from "./TemplateDialogs";

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function PartyFields({ who, party, onChange }: { who: "from" | "to"; party: Party; onChange: (p: Party) => void }) {
  const label = who === "from" ? "Your" : "Client";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <input
        className="ghost"
        aria-label={`${label} name`}
        placeholder={who === "from" ? "Your name or company" : "Client name"}
        value={party.name}
        onChange={(e) => onChange({ ...party, name: e.target.value })}
        style={{ fontSize: who === "from" ? 17 : 15, fontWeight: 600, marginLeft: -8 }}
      />
      {party.lines.map((l, i) => (
        <input
          key={i}
          className="ghost"
          aria-label={`${label} address line ${i + 1}`}
          placeholder={["Street address", "City, postcode", "Country"][i] ?? "Address"}
          value={l}
          onChange={(e) => onChange({ ...party, lines: party.lines.map((x, j) => (j === i ? e.target.value : x)) })}
          style={{ color: "var(--muted)", marginLeft: -8 }}
        />
      ))}
    </div>
  );
}

export function InvoiceEditor() {
  const { address } = useAccount();
  const [inv, setInv] = useState<Invoice>(blankInvoice);
  const [dirty, setDirty] = useState(false);
  const [qrStyle, setQrStyle] = useState<QrStyle>("plain");
  const [qrOnInvoice, setQrOnInvoice] = useState(true);
  const [dialog, setDialog] = useState<null | "save" | "open" | "link">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = useCallback((fn: (d: Invoice) => Invoice) => {
    setInv((prev) => fn(prev));
    setDirty(true);
  }, []);
  const say = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  // Pre-fill the receiving address with the connected wallet.
  useEffect(() => {
    if (address) setInv((p) => (p.payment.recipient ? p : { ...p, payment: { ...p.payment, recipient: address } }));
  }, [address]);

  // Nothing is stored anywhere — warn before losing unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const totals = useMemo(() => computeTotals(inv), [inv]);
  const token = findToken(inv.payment.chainId, inv.payment.token);
  const due = amountDue(inv);
  const isCrypto = inv.payment.method === "crypto";
  const recipientOk = isAddress(inv.payment.recipient, { strict: false });
  const qrText = isCrypto && token && recipientOk ? eip681Uri({ chainId: inv.payment.chainId, token, recipient: inv.payment.recipient, amount: due ?? undefined }) : "";
  const money = (x: bigint) => formatFixed(x, { minDp: 2, maxDp: token && isCrypto ? Math.min(token.decimals, 8) : 2 });
  const numInvalid = (s: string) => s.trim() !== "" && parseAmount(s) === null;

  const setChain = (chainId: SupportedChainId) =>
    update((d) => {
      const keep = TOKENS[chainId].some((t) => t.symbol === d.payment.token);
      return { ...d, payment: { ...d.payment, chainId, token: keep ? d.payment.token : TOKENS[chainId][0].symbol } };
    });

  const savePdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadInvoicePdf } = await import("@/lib/pdf");
      const qrDataUrl = qrOnInvoice && qrText ? await qrPngDataUrl(qrText, qrStyle) : undefined;
      await downloadInvoicePdf(inv, { qrDataUrl });
      say("PDF downloaded. It was generated in your browser.");
    } catch (e) {
      say(`PDF failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setPdfBusy(false);
    }
  };

  const clearAll = () => {
    if (dirty && !window.confirm("Clear this invoice? Unsaved changes will be lost.")) return;
    const fresh = blankInvoice();
    if (address) fresh.payment.recipient = address;
    setInv(fresh);
    setDirty(false);
    say("Invoice cleared.");
  };

  return (
    <div className="wrap editor-layout">
      <div className="panel editor-doc">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
            <PartyFields who="from" party={inv.from} onChange={(from) => update((d) => ({ ...d, from }))} />
          </div>
          <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--line-3)" }}>Invoice</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 24, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>Bill to</div>
            <PartyFields who="to" party={inv.to} onChange={(to) => update((d) => ({ ...d, to }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "6px 12px", alignItems: "center", alignContent: "start", fontSize: 14 }}>
            <label htmlFor="inv-no" className="faint">Invoice #</label>
            <input id="inv-no" className="ghost mono" value={inv.number} onChange={(e) => update((d) => ({ ...d, number: e.target.value }))} />
            <label htmlFor="inv-date" className="faint">Invoice date</label>
            <input id="inv-date" type="date" className="ghost mono" value={inv.issueDate} onChange={(e) => update((d) => ({ ...d, issueDate: e.target.value }))} />
            <label htmlFor="due-date" className="faint">Due date</label>
            <input id="due-date" type="date" className="ghost mono" value={inv.dueDate} onChange={(e) => update((d) => ({ ...d, dueDate: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="items-head"><span>Item description</span><span style={{ textAlign: "right" }}>Qty</span><span style={{ textAlign: "right" }}>Rate</span><span style={{ textAlign: "right" }}>Amount</span><span /></div>
          {inv.items.map((it, i) => (
            <div className="item-row" key={i}>
              <input className="ghost" aria-label={`Line ${i + 1} description`} placeholder="Item name / description" value={it.description}
                onChange={(e) => update((d) => ({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) }))} />
              <input className={`ghost num${numInvalid(it.qty) ? " input invalid" : ""}`} aria-label={`Line ${i + 1} quantity`} inputMode="decimal" value={it.qty}
                onChange={(e) => update((d) => ({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) }))} />
              <input className={`ghost num${numInvalid(it.rate) ? " input invalid" : ""}`} aria-label={`Line ${i + 1} rate`} inputMode="decimal" value={it.rate}
                onChange={(e) => update((d) => ({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)) }))} />
              <span className="mono" style={{ textAlign: "right", paddingRight: 8, fontSize: 14 }}>{money(totals.lines[i] ?? 0n)}</span>
              <button type="button" className="icon-btn" aria-label={`Remove line ${i + 1}`}
                onClick={() => update((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((_, j) => j !== i) : [{ description: "", qty: "1", rate: "0" }] }))}>
                <Icon d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3" />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-dashed" style={{ alignSelf: "flex-start" }}
            onClick={() => update((d) => ({ ...d, items: [...d.items, { description: "", qty: "1", rate: "0" }] }))}>
            <Icon d="M12 5v14M5 12h14" /> Add line
          </button>
        </div>

        <div className="totals">
          <span className="muted">Subtotal</span><span className="mono" style={{ textAlign: "right", paddingRight: 8 }}>{money(totals.subtotal)}</span>
          <label htmlFor="tax" className="muted">Tax (%)</label>
          <input id="tax" className={`ghost num${numInvalid(inv.taxPercent) ? " input invalid" : ""}`} inputMode="decimal" value={inv.taxPercent} onChange={(e) => update((d) => ({ ...d, taxPercent: e.target.value }))} />
          <label htmlFor="ship" className="muted">Shipping</label>
          <input id="ship" className={`ghost num${numInvalid(inv.shipping) ? " input invalid" : ""}`} inputMode="decimal" value={inv.shipping} onChange={(e) => update((d) => ({ ...d, shipping: e.target.value }))} />
          <label htmlFor="disc" className="muted">Discount</label>
          <input id="disc" className={`ghost num${numInvalid(inv.discount) ? " input invalid" : ""}`} inputMode="decimal" value={inv.discount} onChange={(e) => update((d) => ({ ...d, discount: e.target.value }))} />
          <div style={{ gridColumn: "1 / -1", marginTop: 10, borderTop: "1px solid var(--line-2)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="eyebrow">Total</span>
            <span className="mono" style={{ fontSize: 26 }}>{money(totals.total)} {isCrypto && token && <span style={{ fontSize: 14, color: "var(--accent)" }}>{token.symbol}</span>}</span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ fontSize: 11 }}>Payment information</span>
            <div className="seg" role="group" aria-label="Payment method">
              <button type="button" aria-pressed={!isCrypto} onClick={() => update((d) => ({ ...d, payment: { ...d.payment, method: "fiat" } }))}>Fiat</button>
              <button type="button" aria-pressed={isCrypto} onClick={() => update((d) => ({ ...d, payment: { ...d.payment, method: "crypto" } }))}>Crypto</button>
            </div>
          </div>

          {!isCrypto ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
              <div className="field"><label htmlFor="bank">Bank name</label><input id="bank" className="input" value={inv.payment.fiat.bank} onChange={(e) => update((d) => ({ ...d, payment: { ...d.payment, fiat: { ...d.payment.fiat, bank: e.target.value } } }))} /></div>
              <div className="field"><label htmlFor="acct">Account / IBAN</label><input id="acct" className="input mono" value={inv.payment.fiat.account} onChange={(e) => update((d) => ({ ...d, payment: { ...d.payment, fiat: { ...d.payment.fiat, account: e.target.value } } }))} /></div>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="fdet">Other details (SWIFT, reference…)</label><input id="fdet" className="input" value={inv.payment.fiat.details} onChange={(e) => update((d) => ({ ...d, payment: { ...d.payment, fiat: { ...d.payment.fiat, details: e.target.value } } }))} /></div>
            </div>
          ) : (
            <div style={{ border: "1px solid var(--line)", background: "var(--panel-2)", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
                <div className="field">
                  <label htmlFor="network">Network</label>
                  <select id="network" className="input" value={inv.payment.chainId} onChange={(e) => setChain(Number(e.target.value) as SupportedChainId)}>
                    {SUPPORTED_CHAINS.map((c) => <option key={c.id} value={c.id}>{CHAIN_LABELS[c.id]} · chain {c.id}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="token">Token</label>
                  <select id="token" className="input" value={inv.payment.token} onChange={(e) => update((d) => ({ ...d, payment: { ...d.payment, token: e.target.value } }))}>
                    {TOKENS[inv.payment.chainId].map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol} · {t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="wallet">Receiving wallet address</label>
                <input id="wallet" className={`input mono${inv.payment.recipient && !recipientOk ? " invalid" : ""}`} placeholder="0x…" spellCheck={false} value={inv.payment.recipient}
                  onChange={(e) => update((d) => ({ ...d, payment: { ...d.payment, recipient: e.target.value.trim() } }))} style={{ fontSize: 13 }} />
                <span style={{ fontSize: 12, color: inv.payment.recipient && !recipientOk ? "var(--warn-strong)" : "var(--warn)" }}>
                  {inv.payment.recipient && !recipientOk ? "This doesn't look like a valid wallet address." : `Payments arrive on ${CHAIN_LABELS[inv.payment.chainId]}. Make sure this address can receive there.`}
                </span>
              </div>
              {qrText && (
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ padding: 10, background: "#fff" }}><QrPreview text={qrText} style={qrStyle} size={150} label="Payment QR code" /></div>
                    <span className="mono faint" style={{ fontSize: 11 }}>EIP-681 · scannable by wallets</span>
                  </div>
                  <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="field">
                      <span className="label">QR style</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {QR_STYLES.map((q) => (
                          <button key={q.id} type="button" className="btn btn-sm" aria-pressed={qrStyle === q.id} onClick={() => setQrStyle(q.id)}
                            style={qrStyle === q.id ? { background: "var(--text)", color: "#000", borderColor: "var(--text)" } : undefined}>{q.label}</button>
                        ))}
                      </div>
                    </div>
                    <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, minHeight: 44, cursor: "pointer" }}>
                      <input type="checkbox" checked={qrOnInvoice} onChange={(e) => setQrOnInvoice(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent-strong)" }} />
                      Add QR code to PDF
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 16, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <div className="field"><label htmlFor="notes" className="eyebrow" style={{ fontSize: 11 }}>Notes</label><textarea id="notes" className="input" rows={3} placeholder="Thank you for your business." value={inv.notes} onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))} /></div>
          <div className="field"><label htmlFor="terms" className="eyebrow" style={{ fontSize: 11 }}>Terms</label><textarea id="terms" className="input" rows={3} placeholder="Payment due within 30 days." value={inv.terms} onChange={(e) => update((d) => ({ ...d, terms: e.target.value }))} /></div>
        </div>
      </div>

      <aside className="editor-side no-print">
        <div className="panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow" style={{ fontSize: 11 }}>Share</span>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setDialog("link")} disabled={!isCrypto}>
            <Icon d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /> Create payment link
          </button>
          <button type="button" className="btn btn-block" onClick={savePdf} disabled={pdfBusy}>
            <Icon d="M12 4v11M7 10l5 5 5-5M5 20h14" /> {pdfBusy ? "Generating…" : "Save as PDF"}
          </button>
          <span className="eyebrow" style={{ fontSize: 11, marginTop: 8 }}>Templates</span>
          <button type="button" className="btn btn-block" onClick={() => setDialog("save")}>
            <Icon d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z" /> Save encrypted template
          </button>
          <button type="button" className="btn btn-block" onClick={() => setDialog("open")}>
            <Icon d="M12 20V9M7 14l5-5 5 5M5 4h14" /> Open template
          </button>
          <button type="button" className="btn btn-block btn-danger" onClick={clearAll}>
            <Icon d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3" /> Clear invoice
          </button>
          {toast && <div className="notice" role="status">{toast}</div>}
        </div>
        <div className="panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
          <span className="eyebrow" style={{ fontSize: 11 }}>Privacy</span>
          This invoice exists only in this browser tab. Save an encrypted template to keep it — we keep no copy.
        </div>
      </aside>

      {dialog === "save" && <SaveTemplateDialog invoice={inv} onClose={() => setDialog(null)} onSaved={(m) => { setDirty(false); say(m); }} />}
      {dialog === "open" && <OpenTemplateDialog onClose={() => setDialog(null)} onLoaded={(loaded, m) => { setInv(loaded); setDirty(false); say(m); }} />}
      {dialog === "link" && <PaymentLinkDialog invoice={inv} onClose={() => setDialog(null)} />}
    </div>
  );
}
