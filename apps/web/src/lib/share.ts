/**
 * Public read-only share links. A signed-in owner marks a project public (sets
 * `is_public` + an unguessable `share_slug`); anyone can then open
 * `…/#/p/<slug>` and load it read-only via an UNAUTHENTICATED select, allowed
 * by the `public_read_shared` RLS policy.
 *
 * Routing is intentionally hash-based (`#/p/<slug>`): the fragment never hits
 * the server, so the static SPA needs no Vercel rewrite, and it stays clear of
 * the (hashless) auth redirect.
 */
import { supabase } from "./supabase.js";
import { account } from "./account.svelte.js";

const SLUG_RE = /^#\/p\/([A-Za-z0-9_-]{4,64})$/;

/** Extract a share slug from a URL hash, or null if it isn't a share route. */
export function parseShareSlug(hash: string): string | null {
  const m = SLUG_RE.exec(hash);
  return m ? m[1] : null;
}

/** Build the canonical share URL for a slug (app root + hash route). */
export function shareUrl(slug: string): string {
  return `${location.origin}${location.pathname}#/p/${slug}`;
}

function randomSlug(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Anonymous read of a shared project. Returns null if not found / not public. */
export async function fetchSharedProject(slug: string): Promise<{ name: string; json: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("projects")
    .select("name,doc")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { name: string; doc: string };
  return { name: row.name, json: row.doc };
}

export interface ShareState {
  isPublic: boolean;
  url: string | null;
}

/** Current share state of an owned cloud project. */
export async function getShareState(projectId: string): Promise<ShareState> {
  if (!supabase || account.status !== "signedIn") return { isPublic: false, url: null };
  const { data, error } = await supabase
    .from("projects")
    .select("is_public,share_slug")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return { isPublic: false, url: null };
  const row = data as { is_public: boolean; share_slug: string | null };
  return { isPublic: row.is_public, url: row.share_slug ? shareUrl(row.share_slug) : null };
}

/** Make a project public; returns its share URL (or null on failure). Keeps any
 *  existing slug so the link is stable across enable/disable. */
export async function enableShare(projectId: string): Promise<string | null> {
  if (!supabase || account.status !== "signedIn") return null;
  const { data } = await supabase
    .from("projects")
    .select("share_slug")
    .eq("id", projectId)
    .maybeSingle();
  const existing = (data as { share_slug: string | null } | null)?.share_slug;
  const slug = existing ?? randomSlug();
  const { error } = await supabase
    .from("projects")
    .update({ is_public: true, share_slug: slug })
    .eq("id", projectId);
  return error ? null : shareUrl(slug);
}

/** Stop sharing a project (keeps the slug so re-enabling is stable). */
export async function disableShare(projectId: string): Promise<boolean> {
  if (!supabase || account.status !== "signedIn") return false;
  const { error } = await supabase
    .from("projects")
    .update({ is_public: false })
    .eq("id", projectId);
  return !error;
}
