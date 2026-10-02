"use client";

import Link from "next/link";
import { WalletButton } from "./WalletButton";
import { Brand } from "./Brand";

export function SiteHeader({ variant = "site" }: { variant?: "site" | "app" | "pay" }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Brand tag={variant === "app" ? "invoice generator" : variant === "pay" ? "payment" : undefined} />
        {variant === "site" && (
          <nav className="nav" aria-label="Main">
            <Link href="/#features">Features</Link>
            <Link href="/#privacy">Privacy</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {variant === "site" && (
            <Link href="/app" className="btn btn-sm">
              Launch app
            </Link>
          )}
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
