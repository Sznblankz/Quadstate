<script lang="ts">
  import { onMount } from "svelte";

  /** Fires once the intro has played (or immediately, reduced-motion). The
   *  parent then reveals Home; this overlay fades out over the handoff. */
  let { onDone }: { onDone: () => void } = $props();

  let spinner = $state<HTMLDivElement>();
  let logo = $state<HTMLDivElement>();
  const digitEls: HTMLSpanElement[] = [];
  function setDigit(node: HTMLSpanElement, i: number) { digitEls[i] = node; }

  // 0 1 / 1 0  → read row-major into a single file "0 1 1 0".
  const DIGITS = [
    { d: "0", on: false }, { d: "1", on: true },
    { d: "1", on: true },  { d: "0", on: false },
  ];

  const CELL = 60;            // big digit box (px)
  const GAP = 16;
  const half = (CELL + GAP) / 2;
  const ROW = CELL * 0.6;     // tight single-file spacing
  // 2×2 resting position of each cell's centre, relative to the group centre.
  const grid = [
    { x: -half, y: -half }, { x: half, y: -half },
    { x: -half, y: half },  { x: half, y: half },
  ];
  // Collapsed single-file position (horizontal row), same group centre.
  const row = DIGITS.map((_, i) => ({ x: (i - 1.5) * ROW, y: 0 }));

  const EASE_OUT = "cubic-bezier(.22,.68,.16,1)";
  const EASE_IO = "cubic-bezier(.62,0,.18,1)";

  onMount(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Resting transforms (also the fallback paint).
    digitEls.forEach((el, i) => {
      el.style.transform = `translate(${grid[i].x}px, ${grid[i].y}px)`;
    });

    if (reduce || !spinner || !logo || digitEls.length < 4) {
      // Reduced motion: hold the static mark briefly, then hand off.
      digitEls.forEach((el) => (el.style.opacity = "1"));
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }

    const anims: Animation[] = [];
    const A = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: "forwards", ...opts });
      anims.push(a);
      return a;
    };

    // 1) Pop-in — staggered scale/opacity at the 2×2 positions.
    digitEls.forEach((el, i) => {
      const g = `translate(${grid[i].x}px, ${grid[i].y}px)`;
      A(el, [
        { opacity: 0, transform: `${g} scale(.35)` },
        { opacity: 1, transform: `${g} scale(1)` },
      ], { duration: 440, delay: i * 80, easing: EASE_OUT });
    });

    // 2) Spin + collapse — the group turns while digits slide into single file.
    A(spinner, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: 920, delay: 560, easing: EASE_IO });
    digitEls.forEach((el, i) => {
      A(el, [
        { transform: `translate(${grid[i].x}px, ${grid[i].y}px) scale(1)` },
        { transform: `translate(${row[i].x}px, ${row[i].y}px) scale(1)` },
      ], { duration: 780, delay: 640, easing: EASE_IO });
    });

    // 3) Travel — the collapsed mark glides to the top-left chrome position.
    const targetX = 44 - window.innerWidth / 2;
    const targetY = 30 - window.innerHeight / 2;
    const travel = A(logo, [
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${targetX}px, ${targetY}px) scale(.26)` },
    ], { duration: 660, delay: 1480, easing: "cubic-bezier(.5,0,.16,1)" });

    travel.onfinish = () => onDone();
    // Safety net if the tab is backgrounded and onfinish never fires.
    const t = setTimeout(onDone, 2400);
    return () => { clearTimeout(t); anims.forEach((a) => a.cancel()); };
  });
</script>

<div class="splash" role="img" aria-label="QuadState">
  <div class="logo" bind:this={logo}>
    <div class="spinner" bind:this={spinner}>
      {#each DIGITS as g, i}
        <span class="digit" class:on={g.on} use:setDigit={i}>{g.d}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .splash {
    position: fixed; inset: 0; z-index: 200;
    display: grid; place-items: center;
    background: var(--bg);
  }
  .logo { position: relative; width: 0; height: 0; }
  .spinner { position: absolute; left: 0; top: 0; transform-origin: center; }
  .digit {
    position: absolute; left: 0; top: 0;
    width: 60px; height: 60px; margin: -30px 0 0 -30px;
    display: grid; place-items: center;
    font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
    font-weight: 600; font-variant-numeric: tabular-nums;
    font-size: 52px; line-height: 1; color: var(--text3);
    opacity: 0; will-change: transform, opacity;
  }
  .digit.on { color: var(--accent); }

  @media (prefers-reduced-motion: reduce) {
    .digit { opacity: 1; }
  }
</style>
