/**
 * Embedded wallet: local private-key management with Web Crypto encryption.
 *
 * - Generates or imports an Ethereum private key
 * - Encrypts it with a password (PBKDF2 + AES-GCM)
 * - Creates a viem WalletClient usable by x402-fetch
 * - Persists the encrypted keystore via the local FastAPI backend
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { EncryptedKeystore } from "../types";
import { USDC_ADDRESS, ERC20_BALANCE_ABI } from "./contracts";
import { LOCAL_API_URL } from "./env";

// ─── Crypto helpers (Web Crypto API) ───────────────────────────────

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function deriveKey(
  password: string,
  salt: ArrayBuffer,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPrivateKey(
  privateKey: string,
  password: string,
): Promise<{ iv: string; salt: string; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt.buffer);

  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(privateKey),
  );

  return {
    iv: toBase64(iv.buffer),
    salt: toBase64(salt.buffer),
    ciphertext: toBase64(ct),
  };
}

async function decryptPrivateKey(
  ciphertext: string,
  iv: string,
  salt: string,
  password: string,
): Promise<string> {
  const key = await deriveKey(password, fromBase64(salt));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(fromBase64(iv)) },
    key,
    new Uint8Array(fromBase64(ciphertext)),
  );
  return new TextDecoder().decode(pt);
}

// ─── Keystore persistence (via FastAPI backend) ────────────────────

export async function loadKeystore(): Promise<EncryptedKeystore | null> {
  try {
    const resp = await fetch(`${LOCAL_API_URL}/wallet/keystore`);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Load keystore failed: ${resp.status}`);
    return resp.json();
  } catch {
    return null;
  }
}

export async function saveKeystore(ks: EncryptedKeystore): Promise<void> {
  const resp = await fetch(`${LOCAL_API_URL}/wallet/keystore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ks),
  });
  if (!resp.ok) throw new Error(`Save keystore failed: ${resp.status}`);
}

export async function deleteKeystore(): Promise<void> {
  await fetch(`${LOCAL_API_URL}/wallet/keystore`, { method: "DELETE" });
}

// ─── Wallet operations ─────────────────────────────────────────────

/**
 * Generate a brand-new wallet, encrypt with password, persist keystore.
 * Returns the hex private key (caller should keep in memory only).
 */
export async function createNewWallet(
  password: string,
): Promise<{ privateKey: `0x${string}`; address: string }> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = await encryptPrivateKey(privateKey, password);

  const keystore: EncryptedKeystore = {
    version: 1,
    address: account.address,
    ...encrypted,
    createdAt: Date.now(),
  };
  await saveKeystore(keystore);

  return { privateKey, address: account.address };
}

/**
 * Import an existing private key, encrypt with password, persist keystore.
 */
export async function importWallet(
  privateKey: `0x${string}`,
  password: string,
): Promise<{ address: string }> {
  const account = privateKeyToAccount(privateKey);
  const encrypted = await encryptPrivateKey(privateKey, password);

  const keystore: EncryptedKeystore = {
    version: 1,
    address: account.address,
    ...encrypted,
    createdAt: Date.now(),
  };
  await saveKeystore(keystore);

  return { address: account.address };
}

/**
 * Unlock existing keystore with password. Returns decrypted private key.
 */
export async function unlockKeystore(
  keystore: EncryptedKeystore,
  password: string,
): Promise<`0x${string}`> {
  const pk = await decryptPrivateKey(
    keystore.ciphertext,
    keystore.iv,
    keystore.salt,
    password,
  );
  return pk as `0x${string}`;
}

// ─── viem clients ──────────────────────────────────────────────────

export function createEmbeddedWalletClient(
  privateKey: `0x${string}`,
): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null;

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
  }
  return _publicClient;
}

/**
 * Read USDC balance for the given address on Base Sepolia.
 */
export async function getUsdcBalance(address: `0x${string}`): Promise<string> {
  try {
    const client = getPublicClient();
    const raw = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return formatUnits(raw as bigint, 6);
  } catch {
    return "0";
  }
}

/**
 * Detect whether a browser-injected wallet (MetaMask etc.) is available.
 */
export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum;
}
