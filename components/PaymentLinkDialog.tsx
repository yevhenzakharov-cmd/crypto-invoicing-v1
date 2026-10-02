"use client";

import { useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { validateForPayment, type Invoice } from "@/lib/invoice";
import { buildPayUrl, linkInvoice, signingMessage } from "@/lib/link";
import { Modal } from "./Modal";

export function PaymentLinkDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const problems = useMemo(() => validateForPayment(invoice), [invoice]);
  const [sign, setSign] = useState(true);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const inv = linkInvoice(invoice);
      let signature: `0x${string}` | undefined;
      if (sign && address) signature = await signMessageAsync({ message: signingMessage(inv) });
      setUrl(buildPayUrl(window.location.origin, { invoice: inv, signature, signer: signature ? address : undefined }));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(/rejected|denied/i.test(m) ? "Signature request was cancelled." : m);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal title="Payment link" onClose={onClose}>
      {problems.length > 0 ? (
        <>
          <div className="notice warn" role="alert">
            Fix these first:
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {problems.map((p) => <li key={p.field}>{p.message}</li>)}
            </ul>
          </div>
          <button type="button" className="btn" onClick={onClose}>Back to invoice</button>
        </>
      ) : url ? (
        <>
          <div className="field">
            <label htmlFor="pay-url">Share this link with your client</label>
            <input id="pay-url" className="input mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 12 }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer">Preview payment page</a>
          </div>
          <p className="faint" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            The invoice is stored inside this link, not on our servers. Anyone with the link can see the invoice, so share it only with your client.
          </p>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            Your client opens the link, connects a wallet and pays you directly. Nothing is saved on our side.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, cursor: address ? "pointer" : "not-allowed" }}>
            <input type="checkbox" checked={sign && !!address} disabled={!address} onChange={(e) => setSign(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent-strong)" }} />
            <span>
              Sign with my wallet <span className="badge accent" style={{ marginLeft: 6 }}>recommended</span>
              <span className="faint" style={{ display: "block", fontSize: 13, marginTop: 4 }}>
                Payers see a &quot;verified&quot; badge. If anyone changes the amount or address, the badge disappears.
              </span>
            </span>
          </label>
          {error && <div className="notice err" role="alert">{error}</div>}
          <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>
            {busy ? "Waiting for signature…" : "Create link"}
          </button>
        </>
      )}
    </Modal>
  );
}
