import { randomBytes } from "node:crypto";
import { getSession, sessionErrorResponse } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Cryptographically random, single-use nonce (EIP-4361: alphanumeric, ≥ 8 chars).
 * Deliberately not viem's generateSiweNonce(), which slices a Math.random
 * buffer and yields predictable, overlapping nonces.
 */
function newNonce() {
  return randomBytes(16).toString("hex");
}

export async function GET() {
  try {
    const session = await getSession();
    session.nonce = newNonce();
    await session.save();
    return new Response(session.nonce, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
