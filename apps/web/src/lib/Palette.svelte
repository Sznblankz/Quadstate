<script lang="ts">
  import { PALETTE_CATALOG, type PaletteItem } from "./palette/catalog.js";
  import { iconSvg } from "./palette/icons.js";
  import type { AppController } from "./controller.js";

  let { ctrl, placePart, libraryParts, userParts }: {
    ctrl: AppController;
    placePart: string | null;
    libraryParts: Array<{ id: string; name: string }>;
    userParts: Array<{ id: string; name: string }>;
  } = $props();

  let search = $state("");
  // Collapsed state per category, seeded from each category's defaultOpen.
  let collapsed = $state<Record<string, boolean>>(
    Object.fromEntries(PALETTE_CATALOG.map((c) => [c.id, !c.defaultOpen])),
  );

  interface DisplayItem {
    key: string; label: string; icon: string; enabled: boolean;
    tooltip: string; part: string | null; props?: Record<string, number>;
  }

  function resolve(it: PaletteItem): DisplayItem {
    let part: string | null = null;
    let enabled = it.enabled;
    if (it.builtin) {
      part = it.builtin;
    } else if (it.libraryName) {
      const found = libraryParts.find((p) => p.name === it.libraryName);
      part = found?.id ?? null;
      if (!found) enabled = false; // library part not registered → not placeable
    }
    if (!enabled) part = null;
    return { key: it.id, label: it.label, icon: it.icon, enabled, tooltip: it.tooltip, part, props: it.builtinProps };
  }

  function matches(it: PaletteItem, catLabel: string, q: string): boolean {
    if (!q) return true;
    const hay = [it.label, it.id, catLabel, ...(it.aliases ?? [])].join(" ").toLowerCase();
    return hay.includes(q);
  }

  const q = $derived(search.trim().toLowerCase());

  const cats = $derived(
    PALETTE_CATALOG.map((cat) => {
      const source: PaletteItem[] = cat.dynamic === "userParts"
        ? userParts.map((u) => ({
            id: u.id, label: u.name, icon: "chip", enabled: true,
            tooltip: `Drag onto the canvas to place ${u.name}.`, builtin: u.id,
          }))
        : cat.items;
      const items = source.filter((it) => matches(it, cat.label, q)).map(resolve);
      return { id: cat.id, label: cat.label, items };
    }).filter((c) => c.items.length > 0),
  );

  const isOpen = (catId: string): boolean => (q.length > 0 ? true : !collapsed[catId]);

  function toggle(catId: string): void {
    if (q.length > 0) return; // categories are force-open while searching
    collapsed[catId] = !collapsed[catId];
  }

  function tileDown(d: DisplayItem, e: PointerEvent): void {
    if (!d.enabled || !d.part) return;
    ctrl.beginPaletteDrag(d.part, e, d.props ?? {});
  }
</script>

<aside class="palette">
  <div class="search">
    <input type="text" placeholder="Search components" aria-label="Search components" bind:value={search} />
  </div>
  <div class="cats">
    {#each cats as cat (cat.id)}
      <div class="cat">
        <button class="cat-head" onclick={() => toggle(cat.id)} aria-expanded={isOpen(cat.id)}>
          <span class="chev">{isOpen(cat.id) ? "▾" : "▸"}</span>
          <span class="cat-label">{cat.label}</span>
          <span class="count">{cat.items.length}</span>
        </button>
        {#if isOpen(cat.id)}
          <div class="tiles">
            {#each cat.items as d (cat.id + ":" + d.key)}
              <button
                class="tile"
                class:active={d.enabled && d.part === placePart}
                class:disabled={!d.enabled}
                aria-disabled={!d.enabled}
                title={d.tooltip}
                onpointerdown={(e) => tileDown(d, e)}
              >
                <span class="ico">{@html `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${iconSvg(d.icon)}</svg>`}</span>
                <span class="tile-label">{d.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    {#if cats.length === 0}
      <div class="empty">No components match “{search}”.</div>
    {/if}
  </div>
</aside>

<style>
  .palette {
    width: 200px; flex: 0 0 auto; display: flex; flex-direction: column;
    min-height: 0; background: var(--bg); border-right: 1px solid var(--hairline);
  }
  .search { padding: 10px 10px 6px; flex: 0 0 auto; }
  .search input {
    width: 100%; box-sizing: border-box; background: var(--surface1);
    border: 1px solid var(--hairline); border-radius: 8px; color: var(--text1);
    font: inherit; font-size: 12px; padding: 6px 9px;
  }
  .search input::placeholder { color: var(--text3); }
  .search input:focus { outline: none; border-color: var(--accent); }

  .cats { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 2px 6px 14px; }
  .cat { margin-top: 2px; }
  .cat-head {
    width: 100%; display: flex; align-items: center; gap: 6px;
    background: transparent; border: none; cursor: pointer; border-radius: 6px;
    color: var(--text3); font-size: 11px; font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; padding: 7px 4px;
  }
  .cat-head:hover { color: var(--text2); }
  .chev { width: 10px; font-size: 9px; flex: 0 0 auto; }
  .cat-label { flex: 1; text-align: left; }
  .count { color: var(--text3); font-weight: 500; font-size: 10px; }

  .tiles { display: flex; flex-direction: column; gap: 1px; padding: 1px 0 6px; }
  .tile {
    display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
    background: transparent; border: 1px solid transparent; border-radius: 7px;
    padding: 5px 8px; cursor: grab; color: var(--text2); font: inherit; font-size: 12.5px;
  }
  .tile:hover { background: var(--surface2); color: var(--text1); }
  .tile:focus-visible { outline: none; border-color: var(--accent); }
  .tile.active { background: var(--accentQuiet); border-color: var(--accent); color: var(--text1); }
  .tile.disabled { color: var(--text3); cursor: default; opacity: 0.5; }
  .tile.disabled:hover { background: transparent; color: var(--text3); }
  .ico {
    flex: 0 0 22px; height: 22px; display: inline-flex; align-items: center;
    justify-content: center; color: var(--text2);
  }
  .tile:hover .ico, .tile.active .ico { color: var(--text1); }
  .tile.disabled .ico { color: var(--text3); }
  .tile-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: var(--text3); font-size: 12px; padding: 14px 8px; }
</style>
