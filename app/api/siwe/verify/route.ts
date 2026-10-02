import { createPublicClient, getAddress, type Hex } from "viem";
import { parseSiweMessage } from "viem/siwe";
import { getChain } from "@/lib/chains";
import { transports } from "@/lib/rpc";
import { getSession, sessionErrorResponse } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    return sessionErrorResponse(err);
  }

  const body = (await req.json().catch(() => null)) as { message?: string; signature?: Hex } | null;
  if (!body?.message || !body.signature || body.message.length > 4000) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const fields = parseSiweMessage(body.message);
  const expectedDomain = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const chain = fields.chainId ? getChain(fields.chainId) : undefined;

  if (!session.nonce || fields.nonce !== session.nonce) {
    return Response.json({ error: "Sign-in request expired. Please try again." }, { status: 401 });
  }
  if (!fields.address || !chain || fields.domain !== expectedDomain) {
    return Response.json({ error: "Sign-in request is not valid for this site." }, { status: 401 });
  }

  // verifySiweMessage checks the signature (incl. smart-contract wallets via
  // ERC-1271), the domain, nonce, and the issued/expiry times.
  const client = createPublicClient({ chain, transport: transports[chain.id] });
  const valid = await client
    .verifySiweMessage({ message: body.message, signature: body.signature, domain: expectedDomain ?? undefined, nonce: session.nonce })
    .catch(() => false);

  session.nonce = undefined; // single use, success or not
  if (!valid) {
    await session.save();
    return Response.json({ error: "Signature could not be verified." }, { status: 401 });
  }

  session.address = getAddress(fields.address);
  session.chainId = chain.id;
  session.issuedAt = Date.now();
  await session.save();
  return Response.json({ ok: true, address: session.address });
}
