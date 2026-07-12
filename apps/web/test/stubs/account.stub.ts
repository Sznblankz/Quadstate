/**
 * Plain (non-reactive) stand-in for `src/lib/account.svelte.ts`.
 *
 * The real module declares its singleton with the `$state` rune, which only
 * exists after the Svelte compiler runs — and vitest.config.ts deliberately
 * runs logic tests in plain Node without the Svelte plugin. The tests only
 * ever see the guest shape, so a plain object with the same surface is enough.
 * (If another `.svelte.ts` rune module ever enters a test's import graph,
 * stub it the same way and add an alias in vitest.config.ts.)
 */
import type { Account } from "../../src/lib/account.svelte.js";

export const ACCOUNT_ENABLED = false;

export const account: Account = {
  status: "guest",
  userId: null,
  name: "",
  email: "",
  avatarUrl: null,
};

export function initAuth(): void {}

export async function signInWithOAuth(): Promise<{ error?: string }> {
  return { error: "Cloud sign-in is not configured." };
}

export async function signInWithMagicLink(): Promise<{ error?: string }> {
  return { error: "Cloud sign-in is not configured." };
}

export async function signOut(): Promise<void> {}

export function initials(): string {
  return "";
}
