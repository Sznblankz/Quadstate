/**
 * Account state — real authentication via Supabase (OAuth + magic link).
 *
 * The Supabase session is the single source of truth: `initAuth()` hydrates the
 * reactive `account` rune from the current session and keeps it in sync via
 * `onAuthStateChange`. When Supabase is not configured (`supabase === null`) the
 * app stays in guest mode and is fully usable (local, per-device storage).
 *
 * Sign-in is passwordless: Google / GitHub OAuth, or a magic link emailed to
 * the user. There is no password flow.
 */
import { supabase, SUPABASE_ENABLED } from "./supabase.js";
import type { Session } from "@supabase/supabase-js";

/** Whether real cloud auth is available in this build. */
export const ACCOUNT_ENABLED = SUPABASE_ENABLED;

export type AccountStatus = "guest" | "signedIn";

export interface Account {
  status: AccountStatus;
  /** Supabase user id (RLS owner key). Null while guest. */
  userId: string | null;
  name: string;
  email: string;
  /** Provider avatar URL, when available. */
  avatarUrl: string | null;
}

/** Reactive account singleton (mutated, never reassigned). */
export const account = $state<Account>({ status: "guest", userId: null, name: "", email: "", avatarUrl: null });

/** Reflect a Supabase session onto the rune. Null session → guest. */
function applySession(session: Session | null): void {
  if (!session?.user) {
    account.status = "guest";
    account.userId = null;
    account.name = "";
    account.email = "";
    account.avatarUrl = null;
    return;
  }
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  account.status = "signedIn";
  account.userId = u.id;
  account.email = u.email ?? "";
  account.name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.user_name === "string" && meta.user_name) ||
    (account.email ? account.email.split("@")[0] : "Signed in");
  account.avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
}

let initialised = false;

/** Hydrate the account from the current session and subscribe to changes.
 *  Safe to call once at boot; a no-op when cloud auth is disabled. */
export function initAuth(): void {
  if (initialised || !supabase) return;
  initialised = true;
  void supabase.auth.getSession().then(({ data }) => applySession(data.session));
  supabase.auth.onAuthStateChange((_event, session) => applySession(session));
}

/** Where the provider/magic-link returns to: the app root, no hash, so the
 *  auth response never collides with the `#/p/<slug>` share route. */
function redirectTo(): string {
  return location.origin + location.pathname;
}

/** Start an OAuth sign-in (redirects away, returns to the app on success). */
export async function signInWithOAuth(provider: "google" | "github"): Promise<{ error?: string }> {
  if (!supabase) return { error: "Cloud sign-in is not configured." };
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo() },
  });
  return { error: error?.message };
}

/** Email a magic sign-in link. */
export async function signInWithMagicLink(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Cloud sign-in is not configured." };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo() },
  });
  return { error: error?.message };
}

/** Sign out. The auth listener resets the rune to guest. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Display label for the avatar (initials) — empty while guest. */
export function initials(): string {
  if (account.status !== "signedIn") return "";
  const src = account.name || account.email;
  const parts = src.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
