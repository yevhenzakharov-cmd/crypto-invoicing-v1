import type { Token } from "./chains";

/**
 * EIP-681 payment request URIs — the format wallet apps understand when
 * scanning a QR code.
 *   native: ethereum:<to>@<chainId>?value=<wei>
 *   ERC-20: ethereum:<token>@<chainId>/transfer?address=<to>&uint256=<units>
 */
export function eip681Uri(opts: { chainId: number; token: Token; recipient: string; amount?: bigint }): string {
  const { chainId, token, recipient, amount } = opts;
  if (!token.address) {
    return `ethereum:${recipient}@${chainId}${amount && amount > 0n ? `?value=${amount.toString()}` : ""}`;
  }
  const qs = new URLSearchParams({ address: recipient });
  if (amount && amount > 0n) qs.set("uint256", amount.toString());
  return `ethereum:${token.address}@${chainId}/transfer?${qs.toString()}`;
}
