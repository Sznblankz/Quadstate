/**
 * Local project store (P11a): multiple autosaved project drafts so Home can
 * show recents and "New" never overwrites an older project. Each project is
 * one slot keyed by id; an index lists them for Home. The old P1 single-draft
 * slot is migrated in once so nothing is lost.
 */

export interface ProjectMeta { id: string; name: string; savedAt: number; }

const INDEX_KEY = "quadstate:projects:v1";
const SLOT = (id: string) => `quadstate:project:${id}`;
const LEGACY_DRAFT = "quadstate:draft:v1"; // P1 single draft

export function newProjectId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function readIndex(): ProjectMeta[] {
  try {
    const s = localStorage.getItem(INDEX_KEY);
    if (s) return JSON.parse(s) as ProjectMeta[];
  } catch { /* ignore */ }
  return [];
}

function writeIndex(list: ProjectMeta[]): void {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(list)); } catch { /* full/blocked */ }
}

let migrated = false;
function index(): ProjectMeta[] {
  let idx = readIndex();
  if (!migrated) {
    migrated = true;
    try {
      const raw = localStorage.getItem(LEGACY_DRAFT);
      if (raw && !idx.some((p) => p.id === "legacy")) {
        const d = JSON.parse(raw) as { json: string; name: string; savedAt: number };
        localStorage.setItem(SLOT("legacy"), d.json);
        idx = [...idx, { id: "legacy", name: d.name || "Untitled circuit", savedAt: d.savedAt || Date.now() }];
        writeIndex(idx);
      }
      if (raw) localStorage.removeItem(LEGACY_DRAFT);
    } catch { /* ignore */ }
  }
  return idx;
}

/** Recents, newest first. */
export function listProjects(): ProjectMeta[] {
  return index().slice().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveProjectDraft(id: string, name: string, json: string): void {
  try {
    localStorage.setItem(SLOT(id), json);
    const idx = index().filter((p) => p.id !== id);
    idx.push({ id, name, savedAt: Date.now() });
    writeIndex(idx);
  } catch { /* full/blocked */ }
}

export function loadProjectDraft(id: string): { name: string; json: string } | null {
  try {
    const json = localStorage.getItem(SLOT(id));
    if (json === null) return null;
    const meta = index().find((p) => p.id === id);
    return { name: meta?.name ?? "Untitled circuit", json };
  } catch { return null; }
}

export function deleteProjectDraft(id: string): void {
  try {
    localStorage.removeItem(SLOT(id));
    writeIndex(index().filter((p) => p.id !== id));
  } catch { /* ignore */ }
}

/** Rename a project in place (name lives in the index; order is preserved). */
export function renameProjectDraft(id: string, name: string): void {
  try {
    const idx = index();
    const entry = idx.find((p) => p.id === id);
    if (!entry) return;
    entry.name = name.trim() || entry.name;
    writeIndex(idx);
  } catch { /* ignore */ }
}
