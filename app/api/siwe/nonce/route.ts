import { generateSiweNonce } from "viem/siwe";
import { getSession, sessionErrorResponse } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    session.nonce = generateSiweNonce();
    await session.save();
    return new Response(session.nonce, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
