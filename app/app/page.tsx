import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Workspace } from "@/components/Workspace";
import { brandTitle } from "@/lib/brand";

export const metadata: Metadata = { title: brandTitle("Invoice generator") };

export default function AppPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <Workspace />
    </>
  );
}
