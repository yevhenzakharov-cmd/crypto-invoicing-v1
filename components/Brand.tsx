import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Brand({ tag }: { tag?: string }) {
  return (
    <Link href="/" className="brand" aria-label={BRAND.name || "Home"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND.logo} alt="" width={34} height={34} />
      {BRAND.name && <span className="brand-name">{BRAND.name}</span>}
      {tag && <span className="tag">{tag}</span>}
    </Link>
  );
}
