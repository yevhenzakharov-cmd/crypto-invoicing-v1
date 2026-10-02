# crypto-invoicing-v1

Non-custodial crypto invoicing. Create invoices and payment links that are paid straight to your wallet on Ethereum, Base, Arbitrum or Polygon. No database, no custody, encrypted templates.

> The product name is intentionally blank for now. Set `BRAND.name` in `lib/brand.ts` and it appears everywhere.

## What V1 does

| Area | What it does |
| --- | --- |
| **Wallet sign-in** | Sign-In with Ethereum (EIP-4361) via RainbowKit + wagmi. Session is an encrypted httpOnly cookie, so no user database. |
| **Invoice generator** (`/app`) | Line items, tax %, shipping, discount, fiat or crypto payment details. All math is fixed-point `bigint`, never floats. |
| **PDF export** | Generated in the browser with `@react-pdf/renderer`, with an optional payment QR. |
| **Payment QR** | EIP-681 URI that wallets understand. Four styles, all checked to decode with ZXing. |
| **Payment links** (`/pay#…`) | The whole invoice is compressed into the URL fragment, which browsers never send to the server. Optionally signed by the issuer's wallet, and the pay page verifies the signature (EOA + ERC-1271). |
| **Payment** | Direct ERC-20 `transfer` or native transfer from payer to recipient, with network switching, balance check, on-chain token sanity check, and receipt tracking. |
| **Encrypted templates** (`.ivault`) | AES-256-GCM in the browser. Key comes from a wallet signature by default (HKDF), or from an optional passphrase (PBKDF2, 600k iterations). |

Tokens: USDC, USDT, DAI and the native coin on each chain. These are official contracts only (`lib/chains.ts`); there is no USDT on Base, because Tether has no official deployment there.

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # optional for local dev
pnpm dev                     # http://localhost:3000
pnpm test                    # unit tests (money, links, signatures, encryption)
pnpm build                   # production build
```

Without `NEXT_PUBLIC_WC_PROJECT_ID`, only browser-extension wallets (MetaMask, Rabby, Coinbase) are offered. In dev, a built-in session secret is used.

## Deploy to Vercel

1. Import this GitHub repo at vercel.com/new. The framework is detected automatically (Next.js).
2. Add environment variables:
   - `SESSION_SECRET`: **required**. Generate with `openssl rand -base64 32`.
   - `NEXT_PUBLIC_WC_PROJECT_ID`: free at https://cloud.reown.com (enables mobile wallets / WalletConnect). Add your Vercel domain to the project's allowed domains there.
   - `NEXT_PUBLIC_RPC_*`: optional, your own RPC URLs (Alchemy, Infura, QuickNode…). Recommended for production; public RPCs are rate-limited.
3. Deploy.

**Privacy setting worth changing:** Vercel keeps request logs (which include IP addresses) by default. Set log retention to the minimum your plan allows, and don't enable Vercel Analytics / Speed Insights if you want the "no tracking" claim to stay true.

## Project map

```
app/
  page.tsx            landing
  app/page.tsx        invoice generator (behind wallet sign-in)
  pay/page.tsx        payment page (reads invoice from the URL fragment)
  privacy/page.tsx    precise privacy statement
  api/siwe/*          nonce / verify / session / logout (stateless)
  providers.tsx       wagmi + RainbowKit + SIWE adapter
components/           UI (editor, pay view, dialogs, wallet button)
lib/
  brand.ts            product name & logo, one place
  chains.ts           networks + official token contracts
  money.ts            fixed-point bigint math
  invoice.ts          invoice model, totals, validation, sanitising
  link.ts             payment-link encoding + signing message
  vault.ts            encrypted template file format
  eip681.ts, qr.ts    wallet QR codes
  pdf.tsx             browser-side PDF
  session.ts          iron-session cookie
tests/core.test.ts    unit tests
```

## Security notes

- `WALLET_KEY_MESSAGE` in `lib/vault.ts` must **never** change: every wallet-locked template is derived from a signature over that exact text. It is brand-neutral on purpose.
- On first save, the wallet is asked to sign twice and the two signatures are compared. Wallets that don't sign deterministically (some smart-contract / MPC wallets) are told to use a passphrase instead, so nobody gets locked out of a file.
- Payment links are bearer documents: anyone with the link can read the invoice. Fiat bank details are stripped from links.
- The pay page blocks payment when the issuer signature is present but invalid, or when the on-chain token symbol/decimals don't match. Unsigned links require the payer to tick an acknowledgement.
- Headers: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, HSTS. A full Content-Security-Policy is on the roadmap.
- `lib/empty-module.js` stubs optional `@x402/*` imports from the Coinbase SDK that this app never uses (they otherwise break the build).
