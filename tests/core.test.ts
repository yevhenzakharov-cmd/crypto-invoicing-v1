import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { amountOrZero, formatFixed, parseAmount, toTokenUnits } from "@/lib/money";
import { amountDue, blankInvoice, computeTotals, sanitizeInvoice, validateForPayment, type Invoice } from "@/lib/invoice";
import { buildPayUrl, decodeLinkPayload, encodeLinkPayload, linkInvoice, signingMessage } from "@/lib/link";
import { eip681Uri } from "@/lib/eip681";
import { findToken } from "@/lib/chains";
import { decryptVault, encryptVault, readVaultHeader, WALLET_KEY_MESSAGE } from "@/lib/vault";

const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

function sample(): Invoice {
  const inv = blankInvoice();
  inv.number = "INV-12";
  inv.from = { name: "Acme Studio", lines: ["Miami, FL", "", ""] };
  inv.to = { name: "Mark Richardson", lines: ["Austin, TX", "", ""] };
  inv.items = [
    { description: "Consulting Nov", qty: "1", rate: "1,000.00" },
    { description: "Extra hours", qty: "2.5", rate: "80" },
  ];
  inv.taxPercent = "10";
  inv.shipping = "0";
  inv.discount = "20";
  inv.payment = { ...inv.payment, chainId: 8453, token: "USDC", recipient: account.address };
  return inv;
}

describe("money", () => {
  it("parses and rejects", () => {
    expect(parseAmount("1,000.50")).toBe(1000500000000000000000n);
    expect(parseAmount("abc")).toBeNull();
    expect(amountOrZero("-5")).toBe(0n);
  });
  it("rounds to token units half-up", () => {
    expect(toTokenUnits(parseAmount("1.0000005")!, 6)).toBe(1000001n);
    expect(toTokenUnits(parseAmount("1.0000004")!, 6)).toBe(1000000n);
  });
  it("formats", () => {
    expect(formatFixed(parseAmount("1234.5")!)).toBe("1,234.50");
    expect(formatFixed(parseAmount("0.0153")!)).toBe("0.0153");
  });
});

describe("invoice totals", () => {
  it("computes exactly", () => {
    const t = computeTotals(sample());
    // 1000 + 200 = 1200; +10% = 1320; -20 = 1300
    expect(formatFixed(t.total)).toBe("1,300.00");
    expect(amountDue(sample())).toBe(1300_000000n);
  });
  it("never goes negative", () => {
    const inv = sample();
    inv.discount = "999999";
    expect(computeTotals(inv).total).toBe(0n);
  });
  it("validates", () => {
    expect(validateForPayment(sample())).toEqual([]);
    const bad = sample();
    bad.payment.recipient = "0x123";
    expect(validateForPayment(bad).map((p) => p.field)).toContain("recipient");
  });
  it("sanitizes hostile input", () => {
    expect(() => sanitizeInvoice({ v: 2 })).toThrow();
    const s = sanitizeInvoice({ v: 1, number: "x".repeat(999), items: [{ qty: 5, rate: {} }], payment: { chainId: 999 } });
    expect(s.number.length).toBe(64);
    expect(s.items[0].qty).toBe("");
    expect(s.payment.chainId).toBe(8453);
  });
});

describe("payment links", () => {
  it("round-trips and keeps signatures valid", async () => {
    const inv = linkInvoice(sample());
    const signature = await account.signMessage({ message: signingMessage(inv) });
    const url = buildPayUrl("https://example.com", { invoice: inv, signature, signer: account.address });
    expect(url.startsWith("https://example.com/pay#1.")).toBe(true);
    const decoded = decodeLinkPayload(url.split("#")[1]);
    expect(decoded.invoice).toEqual(inv);
    expect(await verifyMessage({ address: account.address, message: signingMessage(decoded.invoice), signature: decoded.signature! })).toBe(true);
  });
  it("detects tampering", async () => {
    const inv = linkInvoice(sample());
    const signature = await account.signMessage({ message: signingMessage(inv) });
    const decoded = decodeLinkPayload(encodeLinkPayload({ invoice: inv, signature, signer: account.address }));
    decoded.invoice.payment.recipient = "0x000000000000000000000000000000000000dEaD";
    expect(await verifyMessage({ address: account.address, message: signingMessage(decoded.invoice), signature })).toBe(false);
  });
  it("strips fiat details from links", () => {
    const inv = sample();
    inv.payment.fiat.account = "SECRET";
    expect(linkInvoice(inv).payment.fiat.account).toBe("");
  });
  it("rejects garbage", () => {
    expect(() => decodeLinkPayload("#1.!!!!")).toThrow();
    expect(() => decodeLinkPayload("#9.abc")).toThrow();
  });
});

describe("EIP-681", () => {
  it("builds ERC-20 and native URIs", () => {
    const usdc = findToken(8453, "USDC")!;
    expect(eip681Uri({ chainId: 8453, token: usdc, recipient: account.address, amount: 5n })).toBe(
      `ethereum:${usdc.address}@8453/transfer?address=${account.address}&uint256=5`,
    );
    const eth = findToken(1, "ETH")!;
    expect(eip681Uri({ chainId: 1, token: eth, recipient: account.address, amount: 10n })).toBe(`ethereum:${account.address}@1?value=10`);
  });
});

describe("vault", () => {
  it("wallet mode: same signature unlocks, other wallet fails", async () => {
    const sig = await account.signMessage({ message: WALLET_KEY_MESSAGE });
    const file = await encryptVault(sample(), { mode: "wallet", signature: sig }, { address: account.address });
    expect(readVaultHeader(file).mode).toBe("wallet");
    expect(await decryptVault(file, { mode: "wallet", signature: sig })).toEqual(sample());
    const other = privateKeyToAccount("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
    const otherSig = await other.signMessage({ message: WALLET_KEY_MESSAGE });
    await expect(decryptVault(file, { mode: "wallet", signature: otherSig })).rejects.toThrow(/Could not unlock/);
  });
  it("passphrase mode + tamper detection", async () => {
    const file = await encryptVault({ a: 1 }, { mode: "passphrase", passphrase: "correct horse battery" }, { iterations: 100_000 });
    expect(await decryptVault(file, { mode: "passphrase", passphrase: "correct horse battery" })).toEqual({ a: 1 });
    await expect(decryptVault(file, { mode: "passphrase", passphrase: "wrong passphrase" })).rejects.toThrow(/Wrong passphrase/);
    const tampered = file.slice();
    tampered[tampered.length - 1] ^= 1;
    await expect(decryptVault(tampered, { mode: "passphrase", passphrase: "correct horse battery" })).rejects.toThrow();
  });
  it("plaintext never appears in the file", async () => {
    const file = await encryptVault({ secret: "Mark Richardson" }, { mode: "passphrase", passphrase: "abcdefgh" }, { iterations: 100_000 });
    expect(new TextDecoder().decode(file)).not.toContain("Mark");
  });
  it("rejects non-vault files", () => {
    expect(() => readVaultHeader(new TextEncoder().encode("hello world, not a vault"))).toThrow();
  });
});
