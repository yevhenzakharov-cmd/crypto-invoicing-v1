"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, getAddress, type Hex } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CHAIN_LABELS, explorerAddressUrl, explorerTxUrl, findToken, type SupportedChainId } from "@/lib/chains";
import { amountDue, computeTotals, type Invoice } from "@/lib/invoice";
import { decodeLinkPayload, signingMessage, type LinkPayload } from "@/lib/link";
import { formatFixed, formatTokenUnits } from "@/lib/money";
import { WalletButton } from "./WalletButton";

type SigState = "checking" | "verified" | "invalid" | "unsigned";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function friendly(e: unknown) {
  const m = e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message : String(e);
  if (/rejected|denied/i.test(m)) return "You cancelled the request in your wallet.";
  if (/insufficient funds/i.test(m)) return "Not enough funds to cover the payment and network fee.";
  return m;
}

export function PayView() {
  const [payload, setPayload] = useState<LinkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash;
      if (!h || h.length < 3) {
        setError("This page needs a payment link. Ask the person who invoiced you for the full link.");
        return;
      }
      try {
        setPayload(decodeLinkPayload(h));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid payment link.");
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  if (error) {
    return (
      <main className="wrap" style={{ paddingTop: 96, maxWidth: 640 }}>
        <div className="notice err" role="alert">{error}</div>
      </main>
    );
  }
  if (!payload) return <main className="wrap" style={{ paddingTop: 96 }}><p className="muted">Reading payment link…</p></main>;
  return <PayInvoice payload={payload} />;
}

function PayInvoice({ payload }: { payload: LinkPayload }) {
  const inv: Invoice = payload.invoice;
  const chainId = inv.payment.chainId as SupportedChainId;
  const token = findToken(chainId, inv.payment.token);
  const recipient = useMemo(() => {
    try { return getAddress(inv.payment.recipient); } catch { return null; }
  }, [inv.payment.recipient]);
  const due = amountDue(inv);
  const totals = computeTotals(inv);
  const money = (x: bigint) => formatFixed(x, { minDp: 2, maxDp: token ? Math.min(token.decimals, 8) : 2 });

  // --- issuer signature -----------------------------------------------------
  const publicClient = usePublicClient({ chainId });
  const [sig, setSig] = useState<SigState>(payload.signature ? "checking" : "unsigned");
  useEffect(() => {
    let alive = true;
    if (!payload.signature || !payload.signer || !publicClient) {
      setSig("unsigned");
      return;
    }
    publicClient
      .verifyMessage({ address: payload.signer, message: signingMessage(inv), signature: payload.signature as Hex })
      .then((ok) => alive && setSig(ok ? "verified" : "invalid"))
      .catch(() => alive && setSig("invalid"));
    return () => { alive = false; };
  }, [payload, inv, publicClient]);
  const signerIsRecipient = payload.signer && recipient && payload.signer.toLowerCase() === recipient.toLowerCase();

  // --- on-chain token check -------------------------------------------------
  const tokenMeta = useReadContracts({
    contracts: token?.address
      ? [
          { address: token.address, abi: erc20Abi, functionName: "symbol", chainId },
          { address: token.address, abi: erc20Abi, functionName: "decimals", chainId },
        ]
      : [],
    query: { enabled: Boolean(token?.address) },
  });
  const onchainSymbol = tokenMeta.data?.[0]?.result as string | undefined;
  const onchainDecimals = tokenMeta.data?.[1]?.result as number | undefined;
  // Only a confirmed mismatch blocks payment; an unreachable RPC does not.
  const tokenChecked = tokenMeta.data?.[0]?.status === "success" && tokenMeta.data?.[1]?.status === "success";
  const tokenMismatch =
    Boolean(token?.address) &&
    tokenChecked &&
    // Decimals must match exactly; symbol is normalised (e.g. "USD₮0" → "USDT0").
    (onchainDecimals !== token!.decimals || !onchainSymbol?.replace(/₮/g, "T").toUpperCase().includes(token!.symbol));

  // --- payer wallet ---------------------------------------------------------
  const { address: payer, chainId: walletChain, isConnected } = useAccount();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const native = useBalance({ address: payer, chainId, query: { enabled: Boolean(payer) } });
  const erc20Bal = useReadContract({
    address: token?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: payer ? [payer] : undefined,
    chainId,
    query: { enabled: Boolean(payer && token?.address) },
  });
  const balance = token?.address ? (erc20Bal.data as bigint | undefined) : native.data?.value;

  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const [hash, setHash] = useState<Hex | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const receipt = useWaitForTransactionReceipt({ hash: hash ?? undefined, chainId, query: { enabled: Boolean(hash) } });

  const blockers: string[] = [];
  if (!token) blockers.push("This invoice asks for a token that isn't supported on this network.");
  if (!recipient) blockers.push("The pay-to address in this link is not valid.");
  if (due === null || due <= 0n) blockers.push("This invoice has no amount due.");
  if (sig === "invalid") blockers.push("The issuer signature doesn't match this invoice. It may have been modified — confirm with the sender before paying.");
  if (tokenMismatch) blockers.push("The token contract didn't match what we expected. Payment is blocked for your safety.");

  const needsAck = sig === "unsigned";
  const wrongChain = isConnected && walletChain !== chainId;
  const insufficient = balance !== undefined && due !== null && balance < due;
  const paid = receipt.isSuccess && receipt.data?.status === "success";
  const reverted = receipt.isSuccess && receipt.data?.status === "reverted";
  const overdue = inv.dueDate && new Date(inv.dueDate + "T23:59:59") < new Date();

  const pay = async () => {
    if (!token || !recipient || due === null) return;
    setPayError(null);
    setSubmitting(true);
    try {
      const h = token.address
        ? await writeContractAsync({ address: token.address, abi: erc20Abi, functionName: "transfer", args: [recipient, due], chainId })
        : await sendTransactionAsync({ to: recipient, value: due, chainId });
      setHash(h);
    } catch (e) {
      setPayError(friendly(e));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdf = async () => {
    const { downloadInvoicePdf } = await import("@/lib/pdf");
    await downloadInvoicePdf(inv);
  };

  const txUrl = hash ? explorerTxUrl(chainId, hash) : undefined;

  return (
    <main className="wrap" style={{ paddingTop: 40, paddingBottom: 96, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
      <section className="panel" style={{ flex: "1 1 560px", minWidth: 0 }} aria-label="Invoice">
        <div className="panel-head">
          <span className="eyebrow">Invoice {inv.number}</span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sig === "verified" && <span className="badge ok">✓ signed by {short(payload.signer!)}</span>}
            {sig === "checking" && <span className="badge">checking signature…</span>}
            {sig === "invalid" && <span className="badge warn">signature does not match</span>}
            {sig === "unsigned" && <span className="badge warn">not signed by issuer</span>}
            {overdue && !paid && <span className="badge warn">overdue</span>}
          </span>
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 20 }}>
            <div>
              <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>From</div>
              <div style={{ fontWeight: 600 }}>{inv.from.name || "—"}</div>
              {inv.from.lines.filter(Boolean).map((l, i) => <div key={i} className="muted" style={{ fontSize: 14 }}>{l}</div>)}
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>Bill to</div>
              <div style={{ fontWeight: 600 }}>{inv.to.name || "—"}</div>
              {inv.to.lines.filter(Boolean).map((l, i) => <div key={i} className="muted" style={{ fontSize: 14 }}>{l}</div>)}
            </div>
            <div className="mono" style={{ fontSize: 13, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", alignContent: "start" }}>
              <span className="faint">Issued</span><span>{inv.issueDate}</span>
              <span className="faint">Due</span><span>{inv.dueDate}</span>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr className="mono faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)", fontWeight: 400 }}>Item</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)", fontWeight: 400 }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)", fontWeight: 400 }}>Rate</th>
                  <th style={{ textAlign: "right", padding: "10px 8px", borderTop: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)", fontWeight: 400 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #16161b" }}>
                    <td style={{ padding: "12px 8px" }}>{it.description}</td>
                    <td className="mono" style={{ padding: "12px 8px", textAlign: "right" }}>{it.qty}</td>
                    <td className="mono" style={{ padding: "12px 8px", textAlign: "right" }}>{it.rate}</td>
                    <td className="mono" style={{ padding: "12px 8px", textAlign: "right" }}>{money(totals.lines[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals" style={{ maxWidth: 340 }}>
            <span className="muted">Subtotal</span><span className="mono" style={{ textAlign: "right" }}>{money(totals.subtotal)}</span>
            {totals.tax > 0n && <><span className="muted">Tax ({inv.taxPercent}%)</span><span className="mono" style={{ textAlign: "right" }}>{money(totals.tax)}</span></>}
            {totals.shipping > 0n && <><span className="muted">Shipping</span><span className="mono" style={{ textAlign: "right" }}>{money(totals.shipping)}</span></>}
            {totals.discount > 0n && <><span className="muted">Discount</span><span className="mono" style={{ textAlign: "right" }}>({money(totals.discount)})</span></>}
            <span className="eyebrow" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 10, marginTop: 6 }}>Total</span>
            <span className="mono" style={{ textAlign: "right", borderTop: "1px solid var(--line-2)", paddingTop: 10, marginTop: 6, fontSize: 18 }}>
              {money(totals.total)} <span style={{ fontSize: 13, color: "var(--accent)" }}>{token?.symbol}</span>
            </span>
          </div>

          {(inv.notes || inv.terms) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16, borderTop: "1px solid var(--line)", paddingTop: 16, fontSize: 14 }}>
              {inv.notes && <div><div className="eyebrow" style={{ fontSize: 11, marginBottom: 4 }}>Notes</div><div className="muted" style={{ whiteSpace: "pre-wrap" }}>{inv.notes}</div></div>}
              {inv.terms && <div><div className="eyebrow" style={{ fontSize: 11, marginBottom: 4 }}>Terms</div><div className="muted" style={{ whiteSpace: "pre-wrap" }}>{inv.terms}</div></div>}
            </div>
          )}
        </div>
      </section>

      <aside className="panel" style={{ flex: "0 1 380px", minWidth: 280, position: "sticky", top: 84 }} aria-label="Payment">
        <div className="panel-head"><span className="eyebrow">Pay</span><span className="mono faint" style={{ fontSize: 12 }}>{CHAIN_LABELS[chainId]}</span></div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="faint" style={{ fontSize: 13 }}>Amount due</div>
            <div className="mono" style={{ fontSize: 30 }}>
              {token && due !== null ? formatTokenUnits(due, token.decimals) : "—"} <span style={{ fontSize: 15, color: "var(--accent)" }}>{token?.symbol}</span>
            </div>
          </div>
          {recipient && (
            <div style={{ fontSize: 13 }}>
              <div className="faint">Paid directly to</div>
              <a className="mono" href={explorerAddressUrl(chainId, recipient)} target="_blank" rel="noopener noreferrer" style={{ wordBreak: "break-all" }}>{recipient}</a>
              {sig === "verified" && !signerIsRecipient && (
                <div style={{ color: "var(--warn)", marginTop: 4 }}>Signed by {short(payload.signer!)}, a different wallet than the pay-to address.</div>
              )}
            </div>
          )}

          {blockers.length > 0 && (
            <div className="notice err" role="alert">{blockers.map((b) => <div key={b}>{b}</div>)}</div>
          )}

          {paid ? (
            <div className="notice ok" role="status">
              Payment confirmed on-chain.{" "}
              {txUrl && <a href={txUrl} target="_blank" rel="noopener noreferrer">View transaction</a>}
            </div>
          ) : reverted ? (
            <div className="notice err" role="alert">The transaction failed on-chain. No funds were transferred. {txUrl && <a href={txUrl} target="_blank" rel="noopener noreferrer">Details</a>}</div>
          ) : hash ? (
            <div className="notice" role="status">Waiting for confirmation… {txUrl && <a href={txUrl} target="_blank" rel="noopener noreferrer">Track it</a>}</div>
          ) : blockers.length === 0 ? (
            <>
              {needsAck && (
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--warn)", cursor: "pointer" }}>
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: "var(--warn-strong)" }} />
                  This link isn&apos;t signed by the issuer. I&apos;ve confirmed the address with them through another channel.
                </label>
              )}
              {!isConnected ? (
                <WalletButton label="Connect wallet to pay" />
              ) : wrongChain ? (
                <button type="button" className="btn btn-primary" disabled={switching} onClick={() => switchChainAsync({ chainId }).catch((e) => setPayError(friendly(e)))}>
                  {switching ? "Switching…" : `Switch to ${CHAIN_LABELS[chainId]}`}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={pay} disabled={submitting || insufficient || (needsAck && !ack)}>
                  {submitting ? "Confirm in your wallet…" : `Pay ${token && due !== null ? formatTokenUnits(due, token.decimals) : ""} ${token?.symbol ?? ""}`}
                </button>
              )}
              {isConnected && !wrongChain && insufficient && (
                <div className="notice warn">Your wallet holds {token && balance !== undefined ? formatTokenUnits(balance, token.decimals) : "0"} {token?.symbol} on {CHAIN_LABELS[chainId]} — not enough for this invoice.</div>
              )}
              {payError && <div className="notice err" role="alert">{payError}</div>}
              <p className="faint" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>
                This is a direct transfer from your wallet to the address above. Nobody in between holds the funds. We can&apos;t see whether this invoice was already paid — check with the sender if unsure.
              </p>
            </>
          ) : null}

          <button type="button" className="btn btn-sm" onClick={downloadPdf}>Download invoice PDF</button>
        </div>
      </aside>
    </main>
  );
}
