<script lang="ts">
  import { signalColor } from "@logicsim/canvas";
  import type { AppController } from "./controller.js";

  let { ctrl, componentId, partId, name, tick }: {
    ctrl: AppController;
    componentId: number;
    partId: string;
    name: string;
    tick: number;
  } = $props();

  let expanded = $state<Record<string, boolean>>({});

  interface Row {
    path: string;
    label: string;
    indent: number;
    expandable: boolean;
  }

  function rowsFor(pid: string, prefix: string, indent: number): Row[] {
    const def = ctrl.lib.get(pid);
    if (!def) return [];
    const out: Row[] = [];
    for (const pin of def.interface.pins) {
      out.push({
        path: prefix + pin.name,
        label: (pin.dir === "in" ? "→ " : "← ") + pin.name,
        indent, expandable: false,
      });
    }
    if (def.body.kind === "structural") {
      for (const net of def.body.nets) {
        out.push({ path: prefix + net.name, label: net.name, indent, expandable: false });
      }
      for (const inst of def.body.instances) {
        const sub = ctrl.lib.get(inst.part);
        if (!sub) continue; // builtins: their pins are already visible as nets
        const path = prefix + inst.id + "/";
        out.push({ path, label: `${inst.id}: ${sub.name}`, indent, expandable: true });
        if (expanded[path]) out.push(...rowsFor(inst.part, path, indent + 1));
      }
    }
    return out;
  }

  const rows = $derived(rowsFor(partId, `c${componentId}/`, 0));

  const VAL = ["0", "1", "X", "Z"];
  function probe(path: string, _tick: number): number | null {
    return ctrl.probe(path);
  }
</script>

<div class="inspector">
  <div class="rail-label">INSPECTOR</div>
  <h3>
    <span class="name">{name}</span>
    <span class="actions">
      <button class="act" onclick={() => ctrl.editDefinition(partId, name)} title="Edit this chip's blueprint">Edit</button>
      <button class="act" onclick={() => ctrl.exportChip(partId)} title="Export this chip with its dependencies">⇪</button>
    </span>
  </h3>
  <div class="rows">
    {#each rows as r (r.path)}
      <div class="row" style="padding-left: {2 + r.indent * 14}px">
        {#if r.expandable}
          <button class="tw" onclick={() => { expanded[r.path] = !expanded[r.path]; }}>
            {expanded[r.path] ? "▾" : "▸"}
          </button>
          <span class="lbl inst">{r.label}</span>
        {:else}
          {@const v = probe(r.path, tick)}
          <span class="lbl">{r.label}</span>
          <span class="val" style="color: {v === null ? 'var(--text3)' : signalColor(v)}">
            {v === null ? "—" : VAL[v]}
          </span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .inspector {
    padding: 12px 14px;
    border-bottom: 1px solid var(--hairline);
  }
  .rail-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.10em;
    color: var(--text3); margin-bottom: 8px;
  }
  h3 {
    margin: 0 0 8px; font-size: 14px; font-weight: 600;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .name { color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .actions { flex: 0 0 auto; display: flex; gap: 4px; }
  .act {
    background: var(--surface1); color: var(--text2); border: 1px solid var(--hairline);
    border-radius: 6px; padding: 2px 8px; cursor: pointer; font: inherit; font-size: 12px;
  }
  .act:hover { background: var(--surface2); color: var(--text1); }
  .row {
    display: flex; align-items: center; gap: 6px;
    padding: 2px 4px; font-size: 12px;
  }
  .lbl { color: var(--label); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lbl.inst { color: var(--text1); }
  .val { margin-left: auto; font-weight: 700; font-family: ui-monospace, monospace; }
  .tw {
    background: none; border: none; color: var(--text3); cursor: pointer;
    padding: 0; width: 14px; font-size: 11px;
  }
  .tw:hover { color: var(--text1); }
</style>
