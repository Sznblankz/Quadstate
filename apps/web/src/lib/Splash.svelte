<script lang="ts">
  import { onMount } from "svelte";

  /** Fires once the intro has played (or immediately, reduced-motion). The
   *  parent then reveals Home; this overlay fades out over the handoff. */
  let { onDone }: { onDone: () => void } = $props();

  // Final logo pattern, read row-major:  0 1 / 1 0  (1 = accent, 0 = gray).
  const FINAL = ["0", "1", "1", "0"];
  // Reactive digit faces — flicker between 0/1 while spinning, then settle.
  let digits = $state(FINAL.map((d) => ({ char: d, on: d === "1" })));

  const els: HTMLSpanElement[] = [];
  function setEl(node: HTMLSpanElement, i: number) { els[i] = node; }

  const CELL = 56;
  const GAP = 16;
  const half = (CELL + GAP) / 2;
  // Resting 2×2 cell centres (relative to the group centre).
  const grid = [
    { x: -half, y: -half }, { x: half, y: -half },
    { x: -half, y: half },  { x: half, y: half },
  ];

  onMount(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    els.forEach((el, i) => { el.style.transform = `translate(${grid[i].x}px, ${grid[i].y}px)`; });

    if (reduce || els.length < 4) {
      // Reduced motion: static final logo, brief hold, then hand off.
      digits = FINAL.map((d) => ({ char: d, on: d === "1" }));
      els.forEach((el) => (el.style.opacity = "1"));
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const anims: Animation[] = [];
    const after = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    // 1) Pop-in at the centre, staggered.
    els.forEach((el, i) => {
      const g = `translate(${grid[i].x}px, ${grid[i].y}px)`;
      anims.push(el.animate(
        [{ opacity: 0, transform: `${g} scale(.4)` }, { opacity: 1, transform: `${g} scale(1)` }],
        { duration: 420, delay: i * 70, easing: "cubic-bezier(.22,.68,.16,1)", fill: "forwards" },
      ));
    });

    // 2) Group spin — each digit ORBITS the centre (its cell-offset vector is
    //    rotated a full turn) but the digit itself never rotates, so the 2×2
    //    formation spins as a group while every digit stays upright/readable.
    const spinAt = 460, spinDur = 1050, STEPS = 24;
    els.forEach((el, i) => {
      const g = grid[i];
      const frames: Keyframe[] = [];
      for (let k = 0; k <= STEPS; k++) {
        const a = (k / STEPS) * Math.PI * 2;
        const rx = g.x * Math.cos(a) - g.y * Math.sin(a);
        const ry = g.x * Math.sin(a) + g.y * Math.cos(a);
        frames.push({ transform: `translate(${rx}px, ${ry}px) scale(1)` });
      }
      after(spinAt, () => anims.push(el.animate(frames,
        { duration: spinDur, easing: "cubic-bezier(.5,.05,.2,1)", fill: "forwards" })));
    });

    // 3) Flicker 0/1 while it spins, then settle to FINAL (staggered lock).
    const lockAt = spinAt + spinDur - 140;
    for (let tick = 0; tick < 13; tick++) {
      const t = spinAt + tick * 80;
      after(t, () => {
        digits = digits.map((_, i) =>
          t >= lockAt + i * 55
            ? { char: FINAL[i], on: FINAL[i] === "1" }
            : (Math.random() < 0.5 ? { char: "0", on: false } : { char: "1", on: true }));
      });
    }
    after(lockAt + 4 * 55, () => { digits = FINAL.map((d) => ({ char: d, on: d === "1" })); });

    // 4) Travel — each digit flies INDIVIDUALLY (staggered) to the matching
    //    cell of the small corner logo. No merge, no shared path.
    const scale = 0.25;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const corner = { x: 44, y: 30 }; // ~ chrome mark centre
    const travelAt = spinAt + spinDur + 90;
    els.forEach((el, i) => {
      const start = `translate(${grid[i].x}px, ${grid[i].y}px) scale(1)`;
      const ex = corner.x - cx + grid[i].x * scale;
      const ey = corner.y - cy + grid[i].y * scale;
      const end = `translate(${ex}px, ${ey}px) scale(${scale})`;
      after(travelAt, () => anims.push(el.animate(
        [{ transform: start }, { transform: end }],
        { duration: 600, delay: i * 60, easing: "cubic-bezier(.5,.06,.16,1)", fill: "forwards" },
      )));
    });

    // 5) Hand off (Home reveals + this overlay fades). Safety timer covers a
    //    backgrounded tab where animations never advance.
    after(travelAt + 580, onDone);
    after(travelAt + 1150, onDone);
    return () => { timers.forEach(clearTimeout); anims.forEach((a) => a.cancel()); };
  });
</script>

<div class="splash" role="img" aria-label="QuadState">
  <div class="logo">
    {#each digits as d, i}
      <span class="digit" class:on={d.on} use:setEl={i}>{d.char}</span>
    {/each}
  </div>
</div>

<style>
  .splash {
    position: fixed; inset: 0; z-index: 200;
    display: grid; place-items: center;
    background: var(--bg);
  }
  .logo { position: relative; width: 0; height: 0; }
  .digit {
    position: absolute; left: 0; top: 0;
    width: 60px; height: 60px; margin: -30px 0 0 -30px;
    display: grid; place-items: center;
    font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
    font-weight: 600; font-variant-numeric: tabular-nums;
    font-size: 52px; line-height: 1; color: var(--text3);
    opacity: 0; will-change: transform, opacity;
    transition: color .12s linear;
  }
  .digit.on { color: var(--accent); }

  @media (prefers-reduced-motion: reduce) {
    .digit { opacity: 1; transition: none; }
  }
</style>
