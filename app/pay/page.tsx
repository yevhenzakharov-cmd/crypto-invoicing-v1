import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { PayView } from "@/components/PayView";
import { brandTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: brandTitle("Pay invoice"),
  robots: { index: false, follow: false },
};

export default function PayPage() {
  return (
    <>
      <SiteHeader variant="pay" />
      <PayView />
    </>
  );
}
