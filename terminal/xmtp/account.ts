/**
 * @file XMTP Account Management
 *
 * Handles key generation, storage, and loading for XMTP chat.
 * Keys are stored in ~/.hyperfin/config/xmtp.json
 *
 * Uses Web Crypto API (Deno-native) instead of node:crypto.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".hyperfin", "config");
const XMTP_CONFIG_PATH = join(CONFIG_DIR, "xmtp.json");

export interface XmtpAccount {
  /** Hex-encoded private key (32 bytes) */
  privateKey: string;
  /** Derived Ethereum address */
  address: string;
  /** When the account was created */
  createdAt: string;
}

/**
 * Derives an Ethereum address from a 32-byte private key.
 * Uses SHA-256 as a simplified derivation (real impl would use secp256k1 + keccak256).
 */
async function deriveAddress(privateKeyHex: string): Promise<string> {
  const keyBytes = hexToBytes(privateKeyHex);
  const hash = await crypto.subtle.digest("SHA-256", keyBytes.buffer as ArrayBuffer);
  const hashHex = bytesToHex(new Uint8Array(hash));
  return "0x" + hashHex.slice(-40);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates a new XMTP account with a random private key.
 */
export async function generateAccount(): Promise<XmtpAccount> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const privateKey = bytesToHex(keyBytes);
  const address = await deriveAddress(privateKey);
  return {
    privateKey,
    address,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Ensures the config directory exists.
 */
export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Saves an XMTP account to the config file.
 */
export function saveAccount(account: XmtpAccount): void {
  ensureConfigDir();
  Deno.writeTextFileSync(XMTP_CONFIG_PATH, JSON.stringify(account, null, 2));
}

/**
 * Loads an XMTP account from the config file.
 * Returns null if no account exists.
 */
export function loadAccount(): XmtpAccount | null {
  try {
    if (!existsSync(XMTP_CONFIG_PATH)) return null;
    const data = Deno.readTextFileSync(XMTP_CONFIG_PATH);
    return JSON.parse(data) as XmtpAccount;
  } catch {
    return null;
  }
}

/**
 * Gets or creates an XMTP account.
 * If an account already exists, returns it. Otherwise creates a new one.
 */
export async function getOrCreateAccount(): Promise<XmtpAccount> {
  const existing = loadAccount();
  if (existing) return existing;

  const account = await generateAccount();
  saveAccount(account);
  return account;
}

/**
 * Returns the path to the config directory.
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}
