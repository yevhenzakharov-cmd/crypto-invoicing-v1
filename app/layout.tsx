// Fira Mono, self-hosted (no requests to Google Fonts).
import "@fontsource/fira-mono/400.css";
import "@fontsource/fira-mono/500.css";
import "@fontsource/fira-mono/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { brandTitle } from "@/lib/brand";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: brandTitle(),
  description: "Create invoices and payment links paid straight to your wallet. Non-custodial, no database, encrypted templates.",
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
