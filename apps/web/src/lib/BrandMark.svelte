<script lang="ts">
  import { onDestroy } from "svelte";
  /**
   * QuadState mark: four digits in a 2×2 grid —
   *   0 1
   *   1 0
   * 1s carry the indigo accent, 0s stay gray. Geometric, tabular, quiet.
   * Used in the Home and editor chrome; the startup splash animates its own
   * larger copy of the same arrangement.
   *
   * `interactive` (the Home logo): on hover the mark scales up (CSS), spins once
   * (Web Animations), and its digits flicker 0/1 before settling back to the
   * resting pattern. All of it is disabled under reduced motion.
   */
  let { size = 15, interactive = false }: { size?: number; interactive?: boolean } = $props();

  const REST = [
    { d: "0", on: false }, { d: "1", on: true },
    { d: "1", on: true },  { d: "0", on: false },
  ];
  let digits = $state(REST.map((g) => ({ ...g })));

  let markEl: HTMLElement;
  let spin: Animation | null = null;
  let flickerTimer: ReturnType<typeof setInterval> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  function reduced(): boolean {
    if (typeof window === "undefined") return false;
    return document.documentElement.dataset.reducedMotion === "1" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }

  const settle = (): void => { digits = REST.map((g) => ({ ...g })); };

  function stopFlicker(): void {
    if (flickerTimer) { clearInterval(flickerTimer); flickerTimer = null; }
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  }

  function enter(): void {
    if (!interactive || reduced()) return;
    // One-shot 360° spin (ends where it started, so no fill needed).
    spin?.cancel();
    spin = markEl.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: 600, easing: "cubic-bezier(.5,.05,.2,1)" },
    );
    // Digits flicker 0/1, then lock back to the resting pattern.
    stopFlicker();
    flickerTimer = setInterval(() => {
      digits = digits.map(() => {
        const one = Math.random() < 0.5;
        return { d: one ? "1" : "0", on: one };
      });
    }, 80);
    stopTimer = setTimeout(() => { stopFlicker(); settle(); }, 520);
  }

  function leave(): void {
    if (!interactive) return;
    stopFlicker();
    settle(); // CSS handles the scale-down; the spin ends on its own.
  }

  onDestroy(() => { stopFlicker(); spin?.cancel(); });
</script>

<span
  class="qs-wrap"
  class:interactive
  style="--s:{size}px"
  aria-hidden="true"
  onpointerenter={enter}
  onpointerleave={leave}
>
  <span class="qs-mark" bind:this={markEl}>
    {#each digits as g}<span class="qs-d" class:on={g.on}>{g.d}</span>{/each}
  </span>
</span>

<style>
  .qs-wrap {
    display: inline-flex;
    transform-origin: center;
  }
  .qs-wrap.interactive {
    cursor: pointer;
    transition: transform .3s cubic-bezier(.5,.05,.2,1);
  }
  .qs-wrap.interactive:hover { transform: scale(1.18); }

  .qs-mark {
    display: inline-grid;
    grid-template-columns: repeat(2, 1fr);
    gap: calc(var(--s) * 0.14);
    font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    user-select: none;
    transform-origin: center;
  }
  .qs-d {
    width: var(--s);
    height: var(--s);
    display: grid;
    place-items: center;
    font-size: calc(var(--s) * 0.92);
    color: var(--text3);
    transition: color .12s linear;
  }
  .qs-d.on { color: var(--accent); }

  /* Reduced motion: no scale, no spin, no flicker (the JS paths are gated too). */
  @media (prefers-reduced-motion: reduce) {
    .qs-wrap.interactive { transition: none; }
    .qs-wrap.interactive:hover { transform: none; }
    .qs-d { transition: none; }
  }
  :global([data-reduced-motion="1"]) .qs-wrap.interactive { transition: none; }
  :global([data-reduced-motion="1"]) .qs-wrap.interactive:hover { transform: none; }
  :global([data-reduced-motion="1"]) .qs-d { transition: none; }
</style>
