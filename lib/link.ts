import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { getAddress, keccak256, toHex, type Address, type Hex } from "viem";
import { CHAIN_LABELS, findToken, type SupportedChainId } from "./chains";
import { amountDue, sanitizeInvoice, type Invoice } from "./invoice";
import { formatTokenUnits } from "./money";

/**
 * Payment links carry the whole invoice inside the URL *fragment* (after #).
 * Browsers never send the fragment to the server, so invoice data never
 * reaches our hosting — it lives only in the link itself.
 *
 *   https://site/pay#1.<base64url(deflate(json))>
 */

export type LinkPayload = {
  invoice: Invoice;
  /** Optional proof the invoice was issued by the holder of `signer`. */
  signer?: Address;
  signature?: Hex;
};

const VERSION = "1";

/** Deterministic JSON (sorted keys) so a signature verifies after a round trip. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

/** Only crypto-relevant data goes into a link; fiat bank details stay out. */
export function linkInvoice(inv: Invoice): Invoice {
  return { ...inv, payment: { ...inv.payment, recipient: getAddress(inv.payment.recipient), fiat: { bank: "", account: "", details: "" } } };
}

export function invoiceHash(inv: Invoice): Hex {
  return keccak256(toHex(canonicalJson(inv)));
}

/**
 * The text the issuer signs. Human-readable on purpose: the wallet shows the
 * amount, network and pay-to address, so nobody signs something blind.
 */
export function signingMessage(inv: Invoice): string {
  const token = findToken(inv.payment.chainId, inv.payment.token);
  const due = amountDue(inv);
  const amount = token && due !== null ? `${formatTokenUnits(due, token.decimals)} ${token.symbol}` : "?";
  return [
    "Payment request",
    "",
    `Invoice: ${inv.number || "(no number)"}`,
    `Amount: ${amount}`,
    `Network: ${CHAIN_LABELS[inv.payment.chainId as SupportedChainId] ?? inv.payment.chainId}`,
    `Pay to: ${inv.payment.recipient}`,
    "",
    "Signing proves this invoice came from you. It is free and sends no transaction.",
    "",
    `Hash: ${invoiceHash(inv)}`,
  ].join("\n");
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeLinkPayload(p: LinkPayload): string {
  const body = { i: p.invoice, s: p.signature, a: p.signer };
  return `${VERSION}.${b64urlEncode(deflateSync(strToU8(canonicalJson(body)), { level: 9 }))}`;
}

export function decodeLinkPayload(fragment: string): LinkPayload {
  const raw = fragment.replace(/^#/, "");
  const dot = raw.indexOf(".");
  if (dot < 0 || raw.slice(0, dot) !== VERSION) throw new Error("This payment link is not in a supported format.");
  let parsed: Record<string, unknown>;
  try {
    // cap inflated size to guard against decompression bombs
    const bytes = inflateSync(b64urlDecode(raw.slice(dot + 1)));
    if (bytes.length > 200_000) throw new Error("too large");
    parsed = JSON.parse(strFromU8(bytes));
  } catch {
    throw new Error("This payment link is damaged or incomplete. Ask the sender to share it again.");
  }
  const invoice = sanitizeInvoice(parsed.i);
  const signature = typeof parsed.s === "string" && /^0x[0-9a-fA-F]+$/.test(parsed.s) ? (parsed.s as Hex) : undefined;
  const signer = typeof parsed.a === "string" && /^0x[0-9a-fA-F]{40}$/.test(parsed.a) ? getAddress(parsed.a) : undefined;
  return { invoice, signature, signer };
}

export function buildPayUrl(origin: string, p: LinkPayload): string {
  return `${origin}/pay#${encodeLinkPayload(p)}`;
}
