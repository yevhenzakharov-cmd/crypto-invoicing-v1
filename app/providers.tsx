"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  createAuthenticationAdapter,
  darkTheme,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  type AuthenticationStatus,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createSiweMessage } from "viem/siwe";
import { useAccount, WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

type AuthState = {
  status: AuthenticationStatus;
  address: string | null;
  error: string | null;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState>({ status: "loading", address: null, error: null, signOut: async () => {} });
export const useAuth = () => useContext(AuthContext);

const theme = darkTheme({
  accentColor: "#F2F2F4",
  accentColorForeground: "#000000",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});
theme.colors.modalBackground = "#0A0A0C";
theme.colors.modalBorder = "#2A2A31";
theme.fonts.body = "'Fira Mono', ui-monospace, monospace";

function AuthLayer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { address: connected, status: accountStatus } = useAccount();
  const [status, setStatus] = useState<AuthenticationStatus>("loading");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/siwe/session", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAddress(data.address);
      setStatus(data.address ? "authenticated" : "unauthenticated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in unavailable.");
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/siwe/logout", { method: "POST" }).catch(() => {});
    setAddress(null);
    setStatus("unauthenticated");
  }, []);

  // Disconnecting, or switching to a different wallet, ends the session.
  // (Only a real connected → disconnected transition counts, so a page reload
  // while the wallet is still reconnecting doesn't sign the user out.)
  const prevAccountStatus = useRef(accountStatus);
  useEffect(() => {
    const prev = prevAccountStatus.current;
    prevAccountStatus.current = accountStatus;
    if (status !== "authenticated" || !address) return;
    if (prev === "connected" && accountStatus === "disconnected") signOut();
    else if (accountStatus === "connected" && connected && connected.toLowerCase() !== address.toLowerCase()) signOut();
  }, [connected, accountStatus, address, status, signOut]);

  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => {
          const res = await fetch("/api/siwe/nonce", { cache: "no-store" });
          if (!res.ok) {
            const msg = (await res.json().catch(() => ({}))).error ?? "Sign-in unavailable.";
            setError(msg);
            throw new Error(msg);
          }
          return res.text();
        },
        createMessage: ({ nonce, address, chainId }) =>
          createSiweMessage({
            domain: window.location.host,
            address,
            statement: "Sign in to your invoicing workspace. This is free and does not send a transaction.",
            uri: window.location.origin,
            version: "1",
            chainId,
            nonce,
            issuedAt: new Date(),
            expirationTime: new Date(Date.now() + 10 * 60 * 1000),
          }),
        verify: async ({ message, signature }) => {
          const res = await fetch("/api/siwe/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, signature }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error ?? "Sign-in failed.");
            return false;
          }
          setError(null);
          setAddress(data.address);
          setStatus("authenticated");
          return true;
        },
        signOut,
      }),
    [signOut],
  );

  // Sign-in is only requested inside the app; payers on /pay just connect.
  const enabled = pathname?.startsWith("/app") ?? false;

  return (
    <AuthContext.Provider value={{ status, address, error, signOut }}>
      <RainbowKitAuthenticationProvider adapter={adapter} status={status} enabled={enabled}>
        <RainbowKitProvider theme={theme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </RainbowKitAuthenticationProvider>
    </AuthContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthLayer>{children}</AuthLayer>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
