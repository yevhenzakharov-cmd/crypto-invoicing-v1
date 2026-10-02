import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="wrap">
      <div className="footer">
        <span>
          © {new Date().getFullYear()} {BRAND.name || "All rights reserved"} · Non-custodial. We never hold funds.
        </span>
        <span style={{ display: "flex", gap: 18 }}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/app">App</Link>
        </span>
      </div>
    </footer>
  );
}
