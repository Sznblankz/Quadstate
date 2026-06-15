/**
 * Account state — MOCK / LOCAL ONLY.
 *
 * There is no backend or real authentication wired up yet. "Signing in" stores
 * a local profile (display name + email) on this device so the chrome can show
 * an identity; it does NOT contact any server, verify credentials, or sync
 * anything. Guest mode is the default and the app is fully usable without an
 * account. See `BACKEND_NEEDED` for what a real implementation would add.
 *
 * When a real auth provider is chosen (Supabase / Firebase / Auth.js / …), this
 * module is the single seam to replace: swap the mock sign-in/out for the
 * provider's session, and persist projects server-side instead of localStorage.
 */

export const ACCOUNT_IS_MOCK = true;

/** What a real backend would need to add (surfaced in the UI, not just here). */
export const BACKEND_NEEDED =
  "Local profile only — no real authentication, password, or cloud sync yet. " +
  "A backend (e.g. Supabase/Firebase/Auth.js) is still required for real " +
  "sign-in and to sync projects across devices.";

export type AccountStatus = "guest" | "signedIn";

export interface Account {
  status: AccountStatus;
  name: string;
  email: string;
}

const GUEST: Account = { status: "guest", name: "", email: "" };
const KEY = "quadstate:account:v1";

function load(): Account {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const a = JSON.parse(raw) as Partial<Account>;
      if (a.status === "signedIn" && (a.name || a.email)) {
        return { status: "signedIn", name: a.name ?? "", email: a.email ?? "" };
      }
    }
  } catch { /* corrupt / blocked */ }
  return { ...GUEST };
}

/** Reactive account singleton (mutated, never reassigned). */
export const account = $state<Account>(load());

function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(account)); } catch { /* full/blocked */ }
}

/** Mock sign-in: store a local profile on this device. No server contact. */
export function signIn(name: string, email: string): void {
  account.status = "signedIn";
  account.name = name.trim();
  account.email = email.trim();
  persist();
}

/** Sign out back to guest. Local projects are untouched. */
export function signOut(): void {
  account.status = "guest";
  account.name = "";
  account.email = "";
  persist();
}

/** Display label for the avatar (initials) — falls back to a guest glyph. */
export function initials(): string {
  if (account.status !== "signedIn") return "";
  const src = account.name || account.email;
  const parts = src.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
