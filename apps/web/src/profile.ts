import { DEFAULT_APPEARANCE, cleanName, sanitizeAppearance, type CharacterAppearance } from "@naijaverse/shared";

/**
 * Milestone 01 accounts.
 *
 * Accounts and characters are stored in the browser so the vertical slice runs
 * with zero backend setup. Passwords are hashed with WebCrypto — never stored
 * in plain text — but this is explicitly *not* the final auth system: Supabase
 * Auth + Row Level Security replaces it in the persistence phase, and the
 * `Account` shape here already mirrors the columns those migrations create.
 */

export interface Account {
  username: string;
  displayName: string;
  passwordHash: string;
  /** True when the browser had no WebCrypto available and a fallback was used. */
  weakHash: boolean;
  createdAt: number;
  lastLoginAt: number;
  character: CharacterAppearance;
}

const ACCOUNTS_KEY = "naijaverse.accounts.v1";
const SESSION_KEY = "naijaverse.session.v1";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 6;

function readAccounts(): Record<string, Account> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, Account>;
  } catch {
    return {};
  }
}

function writeAccounts(accounts: Record<string, Account>): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Storage can be unavailable (private browsing, quota). Failing to persist
    // must not stop someone from playing, so we swallow it deliberately.
  }
}

export function normalizeUsername(username: string): string {
  return cleanName(username).toLowerCase().replace(/\s+/g, "");
}

export function normalizeDisplayName(username: string): string {
  return cleanName(username).slice(0, 20) || "Player";
}

async function hashPassword(username: string, password: string): Promise<{ hash: string; weak: boolean }> {
  const payload = `naijaverse:${username}:${password}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return { hash: hex, weak: false };
  }
  return { hash: fallbackHash(payload), weak: true };
}

/** Non-cryptographic fallback for browsers without WebCrypto (plain HTTP). */
function fallbackHash(payload: string): string {
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return `weak${(hash >>> 0).toString(16)}`;
}

export function listAccounts(): Account[] {
  return Object.values(readAccounts()).sort((a, b) => b.lastLoginAt - a.lastLoginAt);
}

export function getAccount(username: string): Account | null {
  return readAccounts()[normalizeUsername(username)] ?? null;
}

export async function register(username: string, password: string): Promise<Account> {
  const key = normalizeUsername(username);
  if (key.length < USERNAME_MIN || key.length > USERNAME_MAX) {
    throw new Error(`Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters (letters and numbers).`);
  }
  if (password.length < PASSWORD_MIN) {
    throw new Error(`Password must be at least ${PASSWORD_MIN} characters.`);
  }

  const accounts = readAccounts();
  if (accounts[key]) throw new Error("That username is already taken.");

  const { hash, weak } = await hashPassword(key, password);
  const now = Date.now();
  const account: Account = {
    username: key,
    displayName: normalizeDisplayName(username),
    passwordHash: hash,
    weakHash: weak,
    createdAt: now,
    lastLoginAt: now,
    character: {
      ...DEFAULT_APPEARANCE,
      name: normalizeDisplayName(username).slice(0, 20),
    },
  };

  accounts[key] = account;
  writeAccounts(accounts);
  setSession(key);
  return account;
}

export async function login(username: string, password: string): Promise<Account> {
  const key = normalizeUsername(username);
  const account = readAccounts()[key];
  if (!account) throw new Error("No account with that username on this device.");

  const { hash } = await hashPassword(key, password);
  if (hash !== account.passwordHash) throw new Error("Incorrect password.");

  account.lastLoginAt = Date.now();
  const accounts = readAccounts();
  accounts[key] = account;
  writeAccounts(accounts);
  setSession(key);
  return account;
}

export function saveCharacter(username: string, character: CharacterAppearance): Account | null {
  const key = normalizeUsername(username);
  const accounts = readAccounts();
  const account = accounts[key];
  if (!account) return null;
  account.character = sanitizeAppearance(character);
  accounts[key] = account;
  writeAccounts(accounts);
  return account;
}

export function setSession(username: string | null): void {
  try {
    if (username) localStorage.setItem(SESSION_KEY, username);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore: a lost session simply means the player signs in again.
  }
}

export function restoreSession(): Account | null {
  try {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;
    return readAccounts()[username] ?? null;
  } catch {
    return null;
  }
}
