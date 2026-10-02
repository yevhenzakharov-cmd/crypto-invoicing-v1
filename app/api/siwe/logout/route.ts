import { getSession, sessionErrorResponse } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();
    session.destroy();
    return Response.json({ ok: true });
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
