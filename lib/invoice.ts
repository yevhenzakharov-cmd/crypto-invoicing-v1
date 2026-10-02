import { isAddress } from "viem";
import { findToken, isSupportedChainId, type SupportedChainId } from "./chains";
import { amountOrZero, mul, percentOf, toTokenUnits, type Fixed } from "./money";

export type Party = { name: string; lines: string[] };
export type LineItem = { description: string; qty: string; rate: string };

export type Invoice = {
  v: 1;
  number: string;
  issueDate: string;
  dueDate: string;
  from: Party;
  to: Party;
  items: LineItem[];
  taxPercent: string;
  shipping: string;
  discount: string;
  notes: string;
  terms: string;
  payment: {
    method: "crypto" | "fiat";
    chainId: SupportedChainId;
    token: string;
    recipient: string;
    fiat: { bank: string; account: string; details: string };
  };
};

export function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function blankInvoice(): Invoice {
  return {
    v: 1,
    number: "INV-001",
    issueDate: today(),
    dueDate: today(30),
    from: { name: "", lines: ["", "", ""] },
    to: { name: "", lines: ["", "", ""] },
    items: [{ description: "", qty: "1", rate: "0" }],
    taxPercent: "0",
    shipping: "0",
    discount: "0",
    notes: "",
    terms: "",
    payment: {
      method: "crypto",
      chainId: 8453,
      token: "USDC",
      recipient: "",
      fiat: { bank: "", account: "", details: "" },
    },
  };
}

export type Totals = {
  lines: Fixed[];
  subtotal: Fixed;
  tax: Fixed;
  shipping: Fixed;
  discount: Fixed;
  total: Fixed;
};

export function computeTotals(inv: Invoice): Totals {
  const lines = inv.items.map((it) => mul(amountOrZero(it.qty), amountOrZero(it.rate)));
  const subtotal = lines.reduce((a, b) => a + b, 0n);
  const tax = percentOf(subtotal, amountOrZero(inv.taxPercent));
  const shipping = amountOrZero(inv.shipping);
  const discount = amountOrZero(inv.discount);
  const raw = subtotal + tax + shipping - discount;
  return { lines, subtotal, tax, shipping, discount, total: raw < 0n ? 0n : raw };
}

/** The exact amount, in the token's base units, the payer will send. */
export function amountDue(inv: Invoice): bigint | null {
  const token = findToken(inv.payment.chainId, inv.payment.token);
  if (!token) return null;
  return toTokenUnits(computeTotals(inv).total, token.decimals);
}

export type Problem = { field: string; message: string };

/** Problems that block creating a payment link. */
export function validateForPayment(inv: Invoice): Problem[] {
  const p: Problem[] = [];
  if (inv.payment.method !== "crypto") p.push({ field: "method", message: "Payment links need crypto payment selected." });
  if (!isSupportedChainId(inv.payment.chainId)) p.push({ field: "chain", message: "Unsupported network." });
  if (!findToken(inv.payment.chainId, inv.payment.token)) p.push({ field: "token", message: "Choose a token available on this network." });
  if (!isAddress(inv.payment.recipient, { strict: false })) p.push({ field: "recipient", message: "Enter a valid receiving wallet address." });
  const due = amountDue(inv);
  if (due === null || due <= 0n) p.push({ field: "total", message: "The invoice total must be greater than zero." });
  inv.items.forEach((it, i) => {
    if (it.qty.trim() && !/^[\d,.\s]+$/.test(it.qty)) p.push({ field: `qty-${i}`, message: `Line ${i + 1}: quantity is not a number.` });
    if (it.rate.trim() && !/^[\d,.\s]+$/.test(it.rate)) p.push({ field: `rate-${i}`, message: `Line ${i + 1}: rate is not a number.` });
  });
  return p;
}

/**
 * Normalises anything decoded from a link or a template file into a
 * well-formed Invoice, discarding unknown fields. Throws on wrong shape.
 */
export function sanitizeInvoice(x: unknown): Invoice {
  const o = x as Record<string, unknown>;
  if (!o || typeof o !== "object" || o.v !== 1) throw new Error("Unsupported invoice format.");
  const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
  const party = (v: unknown): Party => {
    const p = (v ?? {}) as Record<string, unknown>;
    const lines = Array.isArray(p.lines) ? p.lines.slice(0, 6).map((l) => str(l, 200)) : [];
    return { name: str(p.name, 200), lines };
  };
  const items = Array.isArray(o.items) ? o.items.slice(0, 100) : [];
  const pay = (o.payment ?? {}) as Record<string, unknown>;
  const fiat = (pay.fiat ?? {}) as Record<string, unknown>;
  const chainId = Number(pay.chainId);
  return {
    v: 1,
    number: str(o.number, 64),
    issueDate: str(o.issueDate, 32),
    dueDate: str(o.dueDate, 32),
    from: party(o.from),
    to: party(o.to),
    items: items.map((it) => {
      const i = (it ?? {}) as Record<string, unknown>;
      return { description: str(i.description, 300), qty: str(i.qty, 32), rate: str(i.rate, 40) };
    }),
    taxPercent: str(o.taxPercent, 16),
    shipping: str(o.shipping, 40),
    discount: str(o.discount, 40),
    notes: str(o.notes, 2000),
    terms: str(o.terms, 2000),
    payment: {
      method: pay.method === "fiat" ? "fiat" : "crypto",
      chainId: (isSupportedChainId(chainId) ? chainId : 8453) as SupportedChainId,
      token: str(pay.token, 12),
      recipient: str(pay.recipient, 64),
      fiat: { bank: str(fiat.bank, 200), account: str(fiat.account, 200), details: str(fiat.details, 500) },
    },
  };
}
