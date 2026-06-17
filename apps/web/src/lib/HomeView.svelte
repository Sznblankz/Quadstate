<script lang="ts">
  import { TOKENS } from "@logicsim/canvas";
  import BrandMark from "./BrandMark.svelte";
  import AccountMenu from "./AccountMenu.svelte";
  import { loadProjectDraft, type ProjectMeta } from "./draft.js";
  import { renderThumbnail } from "./thumbnail.js";
  import { TEMPLATES, templateProjectJson, type TemplateId } from "./templates.js";

  let { recents, onNew, onOpen, onTemplate, onRename, onDelete, onOpenSettings }: {
    recents: ProjectMeta[];
    onNew: () => void;
    /** Opens a project; `origin`/`thumb` seed the zoom-portal transition. */
    onOpen: (id: string, origin: DOMRect, thumb: string | null) => void;
    onTemplate: (id: TemplateId) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onOpenSettings: (section?: "account") => void;
  } = $props();

  const tokenStyle = Object.entries(TOKENS).map(([k, v]) => `--${k}: ${v}`).join(";");

  let query = $state("");
  const filtered = $derived(
    query.trim()
      ? recents.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      : recents,
  );
  const resume = $derived(recents.length ? recents[0] : null);

  // Thumbnails are rendered from each project's saved circuit and memoised by
  // id+savedAt, so a re-saved project re-renders but list shuffles don't.
  const THUMB_W = 360, THUMB_H = 200;
  const thumbCache = new Map<string, string | null>();
  function thumbFor(p: ProjectMeta): string | null {
    const key = `${p.id}:${p.savedAt}`;
    const hit = thumbCache.get(key);
    if (hit !== undefined) return hit;
    const d = loadProjectDraft(p.id);
    const url = d ? renderThumbnail(d.json, THUMB_W, THUMB_H) : null;
    thumbCache.set(key, url);
    return url;
  }

  // Template previews — rendered once from each template's own circuit, memoised.
  const TPL_W = 260, TPL_H = 96;
  const tplThumbCache = new Map<TemplateId, string | null>();
  function tplThumb(id: TemplateId): string | null {
    if (tplThumbCache.has(id)) return tplThumbCache.get(id)!;
    let url: string | null = null;
    try { url = renderThumbnail(templateProjectJson(id), TPL_W, TPL_H, 2); } catch { url = null; }
    tplThumbCache.set(id, url);
    return url;
  }

  function ago(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function open(id: string, e: MouseEvent): void {
    const card = (e.currentTarget as HTMLElement).closest(".card");
    const thumbEl = card?.querySelector(".thumb") ?? (e.currentTarget as HTMLElement);
    const rect = thumbEl.getBoundingClientRect();
    onOpen(id, rect, thumbFor(recents.find((p) => p.id === id)!));
  }

  // ---- inline rename + delete-confirm (quiet, card-local) ----
  let renamingId = $state<string | null>(null);
  let renameText = $state("");
  let confirmId = $state<string | null>(null);

  function startRename(p: ProjectMeta): void {
    confirmId = null;
    renamingId = p.id;
    renameText = p.name;
  }
  function commitRename(): void {
    if (renamingId) onRename(renamingId, renameText);
    renamingId = null;
  }
  function renameKey(e: KeyboardEvent): void {
    if (e.key === "Enter") commitRename();
    else if (e.key === "Escape") renamingId = null;
    e.stopPropagation();
  }
  function autofocus(node: HTMLInputElement) { node.focus(); node.select(); }
</script>

<div class="home" style={tokenStyle}>
  <header>
    <span class="brand">
      <BrandMark size={22} interactive />
      QuadState
    </span>
    <span class="spacer"></span>
    <AccountMenu onOpenSettings={onOpenSettings} size={40} />
  </header>

  <div class="content">
    <div class="left">
      <section class="templates">
        <div class="eyebrow">TEMPLATES</div>
        <div class="tpl-row">
          {#each TEMPLATES as t}
            {@const thumb = tplThumb(t.id)}
            <button class="tpl" onclick={() => onTemplate(t.id)} title={t.desc}>
              <span class="tpl-thumb" class:has={!!thumb} aria-hidden="true">
                {#if thumb}<img src={thumb} alt="" draggable="false" />{/if}
              </span>
              <span class="tpl-name">
                <span class="tpl-label">{t.label}</span>
                {#if t.timing}
                  <span class="tpl-wave" title="Demonstrates the timing diagram" aria-hidden="true">{@html `<svg viewBox="0 0 24 12" width="20" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 9h3V3h4v6h4V3h4v6h3"/></svg>`}</span>
                {/if}
              </span>
              <span class="tpl-desc">{t.desc}</span>
            </button>
          {/each}
        </div>
      </section>

      <section class="library">
        <div class="lib-head">
          <div class="lib-title-row">
            <span class="lib-title">My Projects</span>
            <span class="lib-count">{recents.length}</span>
          </div>
          <input class="search" placeholder="Search projects" bind:value={query} spellcheck="false" />
          <div class="tabs" role="tablist">
            <button class="tab active" role="tab" aria-selected="true">All Projects</button>
            <button class="tab" disabled title="Folders coming soon">+ Folder</button>
          </div>
        </div>
        <div class="lib-body">
          {#if filtered.length}
            <div class="cards">
              {#each filtered as p (p.id)}
                {@const thumb = thumbFor(p)}
                <div class="card">
                  <div class="card-body">
                    <span class="thumb card-thumb" class:has={!!thumb}>
                      {#if thumb}<img src={thumb} alt="" draggable="false" />{/if}
                    </span>
                    {#if renamingId === p.id}
                      <input class="rename-field" use:autofocus bind:value={renameText}
                        onkeydown={renameKey} onblur={commitRename} />
                    {:else}
                      <span class="card-name">{p.name}</span>
                    {/if}
                    <span class="card-meta">edited {ago(p.savedAt)}</span>
                  </div>

                  {#if renamingId !== p.id && confirmId !== p.id}
                    <button class="card-open" aria-label="Open {p.name}" onclick={(e) => open(p.id, e)}></button>
                  {/if}

                  {#if confirmId === p.id}
                    <div class="confirm">
                      <span>Delete this project?</span>
                      <div class="confirm-btns">
                        <button class="q-btn" onclick={() => confirmId = null}>Cancel</button>
                        <button class="q-btn danger" onclick={() => { onDelete(p.id); confirmId = null; }}>Delete</button>
                      </div>
                    </div>
                  {:else if renamingId !== p.id}
                    <div class="card-actions">
                      <button class="card-act" title="Rename" aria-label="Rename project" onclick={() => startRename(p)}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M11.6 2.4a1.4 1.4 0 0 1 2 2L5.3 12.7l-2.8.8.8-2.8 8.3-8.3z" />
                          <path d="M10.6 3.4l2 2" />
                        </svg>
                      </button>
                      <button class="card-act danger" title="Delete" aria-label="Delete project" onclick={() => confirmId = p.id}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M3 4.5h10M6.5 4.5V3.2h3v1.3M11 4.5l-.5 8a1 1 0 0 1-1 .95H6.5a1 1 0 0 1-1-.95l-.5-8" />
                        </svg>
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="lib-empty">
              {recents.length ? `No projects match “${query}”.` : "No projects yet — create one or open a template."}
            </div>
          {/if}
        </div>
        <div class="fade" aria-hidden="true"></div>
      </section>
    </div>

    <aside class="actions">
      <button class="action new" onclick={onNew}>
        <span class="plus" aria-hidden="true">+</span>
        <span class="action-title">New Circuit</span>
        <span class="action-sub">Start a blank canvas</span>
      </button>
      {#if resume}
        {@const rthumb = thumbFor(resume)}
        <button class="action resume" onclick={(e) => open(resume.id, e)}>
          <span class="eyebrow">CONTINUE</span>
          <span class="thumb resume-thumb" class:has={!!rthumb}>
            {#if rthumb}<img src={rthumb} alt="" draggable="false" />{/if}
          </span>
          <span class="action-title">{resume.name}</span>
          <span class="action-sub">edited {ago(resume.savedAt)} · Resume →</span>
        </button>
      {/if}
    </aside>
  </div>
</div>

<style>
  .home { height: 100%; background: var(--bg); color: var(--text1); font-family: Inter, system-ui, sans-serif; display: flex; flex-direction: column; overflow: hidden; }
  header { height: 64px; flex: 0 0 auto; display: flex; align-items: center; gap: 12px; padding: 0 28px; border-bottom: 1px solid var(--hairline); }
  .brand { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 20px; letter-spacing: -0.01em; }
  .spacer { flex: 1 1 auto; }

  .content { flex: 1; min-height: 0; display: flex; gap: 24px; padding: 24px 28px; }
  .left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }
  .actions { width: 300px; flex: 0 0 auto; display: flex; flex-direction: column; gap: 16px; }

  /* Entrance — content rises + fades when Home mounts (after the splash, or
     when returning from the editor). Header is excluded so the chrome mark
     stays put for the splash handoff. */
  .content { animation: rise 0.5s cubic-bezier(.22,.68,.16,1) both; }
  .actions { animation: rise 0.5s cubic-bezier(.22,.68,.16,1) 0.06s both; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

  .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.10em; color: var(--text3); }

  /* Templates — horizontal row near the top. */
  .templates { flex: 0 0 auto; display: flex; flex-direction: column; gap: 12px; }
  .tpl-row { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
  .tpl { flex: 0 0 auto; width: 168px; text-align: left; background: var(--surface1); border: 1px solid var(--hairline); border-radius: 12px; padding: 10px; cursor: pointer; color: var(--text1); font: inherit; display: flex; flex-direction: column; gap: 8px; transition: background .16s ease, border-color .16s ease, transform .16s ease; }
  .tpl:hover { background: var(--surface2); border-color: var(--hairlineStrong); transform: translateY(-1px); }
  .tpl:active { transform: translateY(0); }
  .tpl-thumb { height: 62px; border-radius: 8px; overflow: hidden; background: var(--bg); background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 12px 12px; box-shadow: inset 0 0 0 1px var(--hairline); }
  .tpl-thumb.has { background-image: none; }
  .tpl-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tpl-name { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
  .tpl-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tpl-wave { flex: 0 0 auto; color: var(--text3); display: inline-flex; }
  .tpl-desc { font-size: 11px; color: var(--text3); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* My Projects — the main contained, internally-scrolling panel. */
  .library { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; background: var(--surface1); border: 1px solid var(--hairline); border-radius: 16px; overflow: hidden; }
  .lib-head { flex: 0 0 auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--hairline); }
  .lib-title-row { display: flex; align-items: baseline; gap: 10px; }
  .lib-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  .lib-count { font-size: 12px; color: var(--text3); font-family: ui-monospace, monospace; }
  .search { background: var(--surface2); color: var(--text1); border: 1px solid var(--hairline); border-radius: 9px; padding: 8px 12px; font: inherit; font-size: 13px; transition: border-color .16s ease; }
  .search::placeholder { color: var(--text3); }
  .search:focus { outline: none; border-color: var(--accent); }
  .tabs { display: flex; gap: 4px; }
  .tab { background: none; border: none; border-bottom: 2px solid transparent; color: var(--text3); padding: 4px 8px; cursor: pointer; font: inherit; font-size: 13px; }
  .tab.active { color: var(--text1); border-bottom-color: var(--accent); }
  .tab:disabled { color: var(--text3); opacity: 0.5; cursor: default; }

  .lib-body { flex: 1; min-height: 0; overflow-y: auto; padding: 18px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; padding-bottom: 28px; }

  /* Card = container; a stretched transparent button (.card-open) opens it so
     the rename input and quiet hover actions can sit above without nesting
     interactive elements inside a button. */
  .card { position: relative; border-radius: 12px; }
  .card-body { background: var(--surface2); border: 1px solid var(--hairline); border-radius: 12px; padding: 12px; color: var(--text1); display: flex; flex-direction: column; gap: 8px; transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
  .card-open { position: absolute; inset: 0; z-index: 2; background: none; border: none; border-radius: 12px; cursor: pointer; padding: 0; }
  .card:hover .card-body { background: var(--surface3); border-color: var(--hairlineStrong); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
  .card-thumb { height: 92px; border-radius: 8px; overflow: hidden; background: var(--bg); background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 14px 14px; box-shadow: inset 0 0 0 1px var(--hairline); }
  .thumb.has { background-image: none; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .card-name { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-meta { font-size: 12px; color: var(--text2); font-family: ui-monospace, monospace; }

  .rename-field { width: 100%; background: var(--surface1); color: var(--text1); border: 1px solid var(--accent); border-radius: 6px; padding: 4px 7px; font: inherit; font-size: 14px; font-weight: 600; }
  .rename-field:focus { outline: none; }

  /* Hover actions — quiet, appear only on hover, never loud. */
  .card-actions { position: absolute; right: 8px; bottom: 8px; z-index: 3; display: flex; gap: 5px; opacity: 0; transform: translateY(3px); transition: opacity .15s ease, transform .15s ease; pointer-events: none; }
  .card:hover .card-actions, .card:focus-within .card-actions { opacity: 1; transform: none; pointer-events: auto; }
  /* Small square icon buttons (pencil / trash) — quiet, hover-only. */
  .card-act { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; background: rgba(13,15,20,0.82); backdrop-filter: blur(4px); color: var(--text2); border: 1px solid var(--hairline); border-radius: 7px; cursor: pointer; transition: background .14s ease, color .14s ease, border-color .14s ease; }
  .card-act svg { width: 15px; height: 15px; }
  .card-act:hover { background: var(--surface3); color: var(--text1); border-color: var(--hairlineStrong); }
  .card-act.danger:hover { color: var(--sigX); border-color: rgba(232,85,78,0.5); }

  /* Delete confirm — quiet inline panel over the card bottom. */
  .confirm { position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 3; display: flex; flex-direction: column; gap: 7px; background: rgba(13,15,20,0.92); backdrop-filter: blur(6px); border: 1px solid var(--hairlineStrong); border-radius: 9px; padding: 9px 10px; font-size: 12px; color: var(--text1); }
  .confirm-btns { display: flex; gap: 6px; justify-content: flex-end; }
  .q-btn { background: var(--surface2); color: var(--text2); border: 1px solid var(--hairline); border-radius: 7px; padding: 3px 11px; font: inherit; font-size: 12px; cursor: pointer; transition: background .14s ease, color .14s ease; }
  .q-btn:hover { background: var(--surface3); color: var(--text1); }
  .q-btn.danger { color: #fff; background: var(--sigX); border-color: var(--sigX); }
  .q-btn.danger:hover { background: #f0655e; }

  .lib-empty { color: var(--text2); font-size: 14px; padding: 8px 2px; }

  .fade { position: absolute; left: 1px; right: 1px; bottom: 1px; height: 56px; border-radius: 0 0 16px 16px; pointer-events: none; background: linear-gradient(to bottom, rgba(19,22,28,0), var(--surface1)); }

  /* Right-side large action cards. */
  .action { text-align: left; border-radius: 16px; padding: 20px; cursor: pointer; font: inherit; color: var(--text1); border: 1px solid var(--hairline); background: var(--surface1); display: flex; flex-direction: column; gap: 6px; transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
  .action-title { font-size: 18px; font-weight: 600; letter-spacing: -0.015em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .action-sub { font-size: 13px; color: var(--text2); }
  .action.new { background: var(--accent); border-color: var(--accent); color: #fff; min-height: 150px; justify-content: center; }
  .action.new:hover { background: var(--accentHover); transform: translateY(-2px); box-shadow: 0 10px 30px rgba(108,114,255,0.28); }
  .action.new:active { transform: translateY(0); }
  .action.new .action-sub { color: rgba(255,255,255,0.82); }
  .action.new .plus { font-size: 30px; font-weight: 300; line-height: 1; margin-bottom: 4px; }
  .action.resume { min-height: 260px; }
  .action.resume:hover { background: var(--surface2); border-color: var(--hairlineStrong); transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
  .resume-thumb { flex: 1; min-height: 130px; margin: 10px 0; border-radius: 10px; overflow: hidden; background: var(--bg); background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 16px 16px; box-shadow: inset 0 0 0 1px var(--hairline); }

  @media (prefers-reduced-motion: reduce) {
    .content, .actions { animation: none; }
    .tpl, .card-body, .action, .card-actions { transition: none; }
    .tpl:hover, .card:hover .card-body, .action:hover { transform: none; }
  }
</style>
