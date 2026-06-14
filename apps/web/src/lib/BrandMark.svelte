<script lang="ts">
  /**
   * QuadState mark: four digits in a 2×2 grid —
   *   0 1
   *   1 0
   * 1s carry the indigo accent, 0s stay gray. Geometric, tabular, quiet.
   * Used in the Home and editor chrome; the startup splash animates its own
   * larger copy of the same arrangement.
   */
  let { size = 15 }: { size?: number } = $props();
  const DIGITS = [
    { d: "0", on: false }, { d: "1", on: true },
    { d: "1", on: true },  { d: "0", on: false },
  ];
</script>

<span class="qs-mark" style="--s:{size}px" aria-hidden="true">
  {#each DIGITS as g}<span class="qs-d" class:on={g.on}>{g.d}</span>{/each}
</span>

<style>
  .qs-mark {
    display: inline-grid;
    grid-template-columns: repeat(2, 1fr);
    gap: calc(var(--s) * 0.14);
    font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    user-select: none;
  }
  .qs-d {
    width: var(--s);
    height: var(--s);
    display: grid;
    place-items: center;
    font-size: calc(var(--s) * 0.92);
    color: var(--text3);
  }
  .qs-d.on { color: var(--accent); }
</style>
