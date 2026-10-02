import { getSession, sessionErrorResponse } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    return Response.json(
      { address: session.address ?? null, chainId: session.chainId ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
