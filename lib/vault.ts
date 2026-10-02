/**
 * Encrypted template files (".ivault").
 *
 * Everything happens in the browser with the Web Crypto API. Nothing is sent
 * to a server. Two ways to lock a file:
 *
 *  - wallet (default): the user signs a fixed message; the signature is the
 *    secret. Key = HKDF-SHA256(signature, random salt) → AES-256-GCM.
 *  - passphrase (optional): Key = PBKDF2-SHA256(passphrase, salt, 600k) → AES-256-GCM.
 *
 * File layout (binary):
 *   "IVLT" | version u8 | mode u8 | headerLen u16 BE | header JSON | iv (12) | ciphertext+tag
 * Everything before the IV is authenticated as additional data, so the
 * header cannot be altered without decryption failing.
 */

export const VAULT_EXTENSION = ".ivault";
export const VAULT_MIME = "application/octet-stream";

/**
 * NEVER CHANGE THIS TEXT. The key for every wallet-locked file ever saved is
 * derived from a signature over exactly this message. It is brand-neutral on
 * purpose so a rename cannot lock anyone out.
 */
export const WALLET_KEY_MESSAGE = [
  "Unlock encrypted invoice templates",
  "",
  "Signing this message creates the key that encrypts and decrypts your template files.",
  "It happens entirely in your browser: the signature is never sent anywhere, and it costs no gas.",
  "",
  "Key version: 1",
].join("\n");

export const PBKDF2_ITERATIONS = 600_000;

const MAGIC = [0x49, 0x56, 0x4c, 0x54]; // "IVLT"
const VERSION = 1;
const MODE_WALLET = 1;
const MODE_PASSPHRASE = 2;
const HKDF_INFO = new TextEncoder().encode("ivault/v1/wallet");

export type VaultMode = "wallet" | "passphrase";
export type VaultHeader =
  | { mode: "wallet"; salt: string; hint: string }
  | { mode: "passphrase"; salt: string; iter: number };

export type UnlockSecret = { mode: "wallet"; signature: string } | { mode: "passphrase"; passphrase: string };

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("This browser does not support secure encryption (Web Crypto). Use an up-to-date browser over https.");
  return s;
};

function toB64(b: Uint8Array) {
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s);
}
function fromB64(s: string) {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function hexToBytes(hex: string) {
  const h = hex.replace(/^0x/, "");
  if (h.length % 2 || /[^0-9a-f]/i.test(h)) throw new Error("Invalid signature.");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** "0x1234…abcd" — enough to tell the user which wallet to connect, not the full address. */
export function addressHint(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`.toLowerCase();
}

async function deriveKey(header: VaultHeader, secret: UnlockSecret): Promise<CryptoKey> {
  const salt = fromB64(header.salt);
  if (header.mode === "wallet") {
    if (secret.mode !== "wallet") throw new Error("This file is locked with a wallet. Connect the wallet that saved it.");
    const ikm = await subtle().importKey("raw", hexToBytes(secret.signature), "HKDF", false, ["deriveKey"]);
    return subtle().deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: HKDF_INFO },
      ikm,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
  if (secret.mode !== "passphrase") throw new Error("This file is locked with a passphrase.");
  const base = await subtle().importKey("raw", new TextEncoder().encode(secret.passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: header.iter },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVault(
  data: unknown,
  secret: UnlockSecret,
  opts: { address?: string; iterations?: number } = {},
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const header: VaultHeader =
    secret.mode === "wallet"
      ? { mode: "wallet", salt: toB64(salt), hint: opts.address ? addressHint(opts.address) : "" }
      : { mode: "passphrase", salt: toB64(salt), iter: opts.iterations ?? PBKDF2_ITERATIONS };
  if (secret.mode === "passphrase" && secret.passphrase.length < 8) throw new Error("Use a passphrase of at least 8 characters.");

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const prefix = new Uint8Array(8 + headerBytes.length);
  prefix.set(MAGIC, 0);
  prefix[4] = VERSION;
  prefix[5] = secret.mode === "wallet" ? MODE_WALLET : MODE_PASSPHRASE;
  prefix[6] = (headerBytes.length >> 8) & 0xff;
  prefix[7] = headerBytes.length & 0xff;
  prefix.set(headerBytes, 8);

  const key = await deriveKey(header, secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ kind: "invoice-template", v: 1, data }));
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: prefix }, key, plaintext));

  const out = new Uint8Array(prefix.length + iv.length + ct.length);
  out.set(prefix, 0);
  out.set(iv, prefix.length);
  out.set(ct, prefix.length + iv.length);
  return out;
}

/** Reads the unencrypted header so the UI knows whether to ask for a wallet or a passphrase. */
export function readVaultHeader(file: Uint8Array): VaultHeader {
  if (file.length < 8 || MAGIC.some((b, i) => file[i] !== b)) throw new Error("This is not an encrypted template file.");
  if (file[4] !== VERSION) throw new Error("This template was saved by a newer version. Please update.");
  const len = (file[6] << 8) | file[7];
  if (8 + len + 12 + 16 > file.length) throw new Error("This template file is damaged.");
  let header: VaultHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(file.slice(8, 8 + len)));
  } catch {
    throw new Error("This template file is damaged.");
  }
  const expected = file[5] === MODE_WALLET ? "wallet" : file[5] === MODE_PASSPHRASE ? "passphrase" : null;
  if (!expected || header.mode !== expected) throw new Error("This template file is damaged.");
  if (header.mode === "passphrase" && (!Number.isInteger(header.iter) || header.iter < 100_000 || header.iter > 10_000_000)) {
    throw new Error("This template file is damaged.");
  }
  return header;
}

export async function decryptVault(file: Uint8Array, secret: UnlockSecret): Promise<unknown> {
  const header = readVaultHeader(file);
  const len = (file[6] << 8) | file[7];
  const prefix = file.slice(0, 8 + len);
  const iv = file.slice(8 + len, 8 + len + 12);
  const ct = file.slice(8 + len + 12);
  const key = await deriveKey(header, secret);
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt({ name: "AES-GCM", iv, additionalData: prefix }, key, ct);
  } catch {
    throw new Error(
      header.mode === "wallet"
        ? `Could not unlock. This file was saved with wallet ${header.hint || "another wallet"}.`
        : "Wrong passphrase, or the file was modified.",
    );
  }
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  if (parsed?.kind !== "invoice-template") throw new Error("This file is not an invoice template.");
  return parsed.data;
}
