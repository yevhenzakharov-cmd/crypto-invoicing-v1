/**
 * Brand settings in one place. The product name is intentionally empty until
 * it is chosen: set `name` and every page, title and PDF picks it up.
 */
export const BRAND = {
  name: "",
  /** Used in <title> and PDFs while `name` is empty. */
  fallbackTitle: "Non-custodial crypto invoicing",
  logo: "/logo.png",
};

export function brandTitle(page?: string) {
  const base = BRAND.name || BRAND.fallbackTitle;
  return page ? `${page} · ${base}` : base;
}
