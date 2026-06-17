/**
 * Project store — the seam between the cloud (Supabase `projects` table, scoped
 * per-user by RLS) and the per-device local store (`draft.ts`). When signed in
 * with cloud configured, reads/writes go to the cloud; otherwise they fall back
 * to localStorage. `draft.ts` is left untouched as the guest backend.
 *
 * The public API mirrors `draft.ts` but is async (cloud calls are network I/O).
 */
import { supabase } from "./supabase.js";
import { account } from "./account.svelte.js";
import * as local from "./draft.js";

export interface ProjectMeta {
  id: string;
  name: string;
  savedAt: number;
}

/** True when reads/writes should target the cloud rather than localStorage. */
export function isCloudActive(): boolean {
  return supabase !== null && account.status === "signedIn" && account.userId !== null;
}

/** Mint an id for a NEW project. Cloud rows need a uuid up front (autosave
 *  writes before the row otherwise exists); guests keep draft.ts's generator. */
export function newProjectId(): string {
  if (isCloudActive() && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return local.newProjectId();
}

export async function listProjects(): Promise<ProjectMeta[]> {
  if (isCloudActive()) {
    const { data, error } = await supabase!
      .from("projects")
      .select("id,name,updated_at")
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return (data as Array<{ id: string; name: string; updated_at: string }>).map((r) => ({
      id: r.id,
      name: r.name,
      savedAt: new Date(r.updated_at).getTime(),
    }));
  }
  return local.listProjects();
}

export async function loadProject(id: string): Promise<{ name: string; json: string } | null> {
  if (isCloudActive()) {
    const { data, error } = await supabase!
      .from("projects")
      .select("name,doc")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { name: string; doc: string };
    return { name: row.name, json: row.doc };
  }
  return local.loadProjectDraft(id);
}

export async function saveProject(id: string, name: string, json: string): Promise<boolean> {
  if (isCloudActive()) {
    const { error } = await supabase!.from("projects").upsert({
      id,
      owner: account.userId,
      name,
      doc: json,
      updated_at: new Date().toISOString(),
    });
    return !error;
  }
  return local.saveProjectDraft(id, name, json);
}

export async function deleteProject(id: string): Promise<void> {
  if (isCloudActive()) {
    await supabase!.from("projects").delete().eq("id", id);
    return;
  }
  local.deleteProjectDraft(id);
}

export async function renameProject(id: string, name: string): Promise<void> {
  if (isCloudActive()) {
    await supabase!
      .from("projects")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id);
    return;
  }
  local.renameProjectDraft(id, name);
}

// ----------------------------------------------------- first-sign-in migration

const MIGRATED_KEY = (userId: string) => `quadstate:migrated:${userId}`;

/** How many local (guest) projects exist on this device. */
export function localProjectCount(): number {
  return local.listProjects().length;
}

/** True when this signed-in user has local projects not yet offered for upload. */
export function needsMigration(userId: string): boolean {
  if (!isCloudActive()) return false;
  try {
    if (localStorage.getItem(MIGRATED_KEY(userId))) return false;
  } catch {
    return false;
  }
  return local.listProjects().length > 0;
}

/** Remember that migration was handled (uploaded or declined) for this user. */
export function markMigrated(userId: string): void {
  try {
    localStorage.setItem(MIGRATED_KEY(userId), "1");
  } catch {
    /* ignore */
  }
}

/** Upload this device's local projects into the signed-in account as new cloud
 *  rows. Non-destructive: local copies are kept as the guest fallback. Returns
 *  how many uploaded. */
export async function migrateLocalProjects(): Promise<number> {
  if (!isCloudActive()) return 0;
  let n = 0;
  for (const meta of local.listProjects()) {
    const d = local.loadProjectDraft(meta.id);
    if (!d) continue;
    const ok = await saveProject(newProjectId(), d.name, d.json);
    if (ok) n++;
  }
  if (account.userId) markMigrated(account.userId);
  return n;
}
