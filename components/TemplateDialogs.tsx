"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { sanitizeInvoice, type Invoice } from "@/lib/invoice";
import { safeFilename, triggerDownload } from "@/lib/pdf";
import { isVaultKeyVerified, useWalletVaultKey } from "@/lib/useWalletVaultKey";
import { decryptVault, encryptVault, readVaultHeader, VAULT_EXTENSION, VAULT_MIME, type VaultHeader } from "@/lib/vault";
import { Modal } from "./Modal";

function errMsg(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/rejected|denied|User rejected/i.test(m)) return "Signature request was cancelled.";
  return m;
}

export function SaveTemplateDialog({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: (msg: string) => void }) {
  const { address } = useAccount();
  const getKey = useWalletVaultKey();
  const [mode, setMode] = useState<"wallet" | "passphrase">(address ? "wallet" : "passphrase");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstTime = mode === "wallet" && !isVaultKeyVerified(address);

  const save = async () => {
    setError(null);
    if (mode === "passphrase") {
      if (pass.length < 8) return setError("Use at least 8 characters.");
      if (pass !== pass2) return setError("Passphrases don't match.");
    }
    setBusy(true);
    try {
      const file =
        mode === "wallet"
          ? await (async () => {
              const k = await getKey({ verify: true });
              return encryptVault(invoice, { mode: "wallet", signature: k.signature }, { address: k.address });
            })()
          : await encryptVault(invoice, { mode: "passphrase", passphrase: pass });
      const name = `${safeFilename(invoice.to.name || invoice.number, "invoice")}-template${VAULT_EXTENSION}`;
      triggerDownload(new Blob([file as BlobPart], { type: VAULT_MIME }), name);
      onSaved(`Saved ${name} — encrypted ${mode === "wallet" ? "with your wallet" : "with your passphrase"}.`);
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Save encrypted template" onClose={onClose}>
      <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        The template is encrypted in your browser before the file is created. Only the key you choose can open it — we never see the file or the key.
      </p>
      <div className="seg" role="group" aria-label="Lock with">
        <button type="button" aria-pressed={mode === "wallet"} onClick={() => setMode("wallet")} disabled={!address}>Lock with wallet</button>
        <button type="button" aria-pressed={mode === "passphrase"} onClick={() => setMode("passphrase")}>Use a passphrase</button>
      </div>
      {mode === "wallet" ? (
        <div className="notice">
          {firstTime
            ? "Your wallet will ask you to sign the same message twice. We check both signatures match, so this wallet can always reopen the file. Free, no transaction."
            : "Your wallet key is ready for this session."}
          <div className="faint" style={{ marginTop: 6 }}>If you lose access to this wallet, the file can't be opened.</div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="pp1">Passphrase</label>
            <input id="pp1" className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pp2">Repeat passphrase</label>
            <input id="pp2" className="input" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          </div>
          <div className="notice warn">There is no reset. If you forget the passphrase, the file can't be opened — by you or by us.</div>
        </>
      )}
      {error && <div className="notice err" role="alert">{error}</div>}
      <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
        {busy ? "Encrypting…" : "Encrypt & download"}
      </button>
    </Modal>
  );
}

export function OpenTemplateDialog({ onClose, onLoaded }: { onClose: () => void; onLoaded: (inv: Invoice, msg: string) => void }) {
  const { address } = useAccount();
  const getKey = useWalletVaultKey();
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; header: VaultHeader } | null>(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    setError(null);
    setFile(null);
    if (!f) return;
    if (f.size > 2_000_000) return setError("That file is too large to be a template.");
    const bytes = new Uint8Array(await f.arrayBuffer());
    try {
      setFile({ name: f.name, bytes, header: readVaultHeader(bytes) });
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const unlock = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data =
        file.header.mode === "wallet"
          ? await decryptVault(file.bytes, { mode: "wallet", signature: (await getKey({ verify: false })).signature })
          : await decryptVault(file.bytes, { mode: "passphrase", passphrase: pass });
      onLoaded(sanitizeInvoice(data), `Opened ${file.name}.`);
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Open encrypted template" onClose={onClose}>
      <div className="field">
        <label htmlFor="tpl-file">Template file ({VAULT_EXTENSION})</label>
        <input id="tpl-file" className="input" type="file" accept={VAULT_EXTENSION} style={{ paddingTop: 10 }} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {file?.header.mode === "wallet" && (
        <div className="notice">
          Locked with wallet <span className="mono">{file.header.hint || "(unknown)"}</span>.{" "}
          {address ? "Your wallet will ask for one signature to unlock it." : "Connect that wallet to unlock it."}
        </div>
      )}
      {file?.header.mode === "passphrase" && (
        <div className="field">
          <label htmlFor="pp-open">Passphrase</label>
          <input id="pp-open" className="input" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} />
        </div>
      )}
      {error && <div className="notice err" role="alert">{error}</div>}
      <button type="button" className="btn btn-primary" onClick={unlock} disabled={!file || busy || (file.header.mode === "wallet" && !address)}>
        {busy ? "Unlocking…" : "Unlock & load"}
      </button>
    </Modal>
  );
}
