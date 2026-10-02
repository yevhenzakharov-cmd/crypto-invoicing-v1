import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

/**
 * Stateless sign-in session: an encrypted, httpOnly cookie. There is no
 * database — the server keeps nothing between requests.
 */
export type SessionData = {
  nonce?: string;
  address?: `0x${string}`;
  chainId?: number;
  issuedAt?: number;
};

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret-change-me";

export class SessionNotConfiguredError extends Error {}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return DEV_SECRET;
  throw new SessionNotConfiguredError("SESSION_SECRET is missing or shorter than 32 characters.");
}

export async function getSession() {
  const options: SessionOptions = {
    password: secret(),
    cookieName: "inv_session",
    ttl: 60 * 60 * 24 * 7,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    },
  };
  return getIronSession<SessionData>(await cookies(), options);
}

export function sessionErrorResponse(err: unknown) {
  if (err instanceof SessionNotConfiguredError) {
    return Response.json({ error: "Sign-in is not configured on this deployment (SESSION_SECRET)." }, { status: 503 });
  }
  return Response.json({ error: "Unexpected error." }, { status: 500 });
}
