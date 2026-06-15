<script lang="ts">
  import { signalColor, TOKENS, MIXED } from "@logicsim/canvas";
  import type { UiState } from "./controller.js";

  let { timeline, collapsed = $bindable(false), height = $bindable(200) }:
    { timeline: UiState["timeline"]; collapsed?: boolean; height?: number } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let cursorTick = $state<number | null>(null); // null = follow live (right edge)

  const LANE_H = 28, LABEL_W = 132, PAD = 8, AXIS_H = 18;
  const VAL = ["0", "1", "X", "Z"];

  type Trans = { tick: number; value: number };

  // Visual language — mirrors renderer.ts: HI green solid + halo (only glow),
  // LO blue flat, MIXED green solid no halo, X red dash-dot, Z gray dashed.
  function dashFor(v: number): number[] {
    if (v === 2) return [9, 4, 2, 4];
    if (v === 3) return [6, 5];
    return [];
  }
  function alphaFor(v: number): number {
    if (v === 1) return 1;
    if (v === MIXED) return 0.9;
    if (v === 0) return 0.9;
    if (v === 2) return 1;
    return 0.7; // Z
  }
  const colorFor = (v: number) => signalColor(v === MIXED ? 1 : v);
  const valLabel = (v: number) => (v === MIXED ? "∗" : VAL[v] ?? "?");

  /** Value at `tick`, or null before the lane's authoritative horizon. */
  function valueAt(trans: Trans[], oldest: number, tick: number): number | null {
    if (!trans.length || tick < oldest) return null;
    let lo = 0, hi = trans.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (trans[m].tick <= tick) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans < 0 ? null : trans[ans].value;
  }

  /** Visible window, data-driven: fit to roughly the last DESIRED transitions of
   *  the busiest lane (scale-free — slow clocks show several periods, fast signals
   *  show recent detail), clamped to a minimum span. Gridline step rounds to 1/2/5. */
  function windowFor(lanes: UiState["timeline"]["lanes"], now: number, plotW: number) {
    const DESIRED = 12, MIN_SPAN = 20;
    let t0data = now - MIN_SPAN;
    let busiest = 0;
    for (const lane of lanes) {
      if (lane.gone || lane.transitions.length <= busiest) continue;
      busiest = lane.transitions.length;
      const idx = Math.max(0, lane.transitions.length - 1 - DESIRED);
      t0data = lane.transitions[idx].tick;
    }
    const t1 = (cursorTick !== null && cursorTick > now) ? cursorTick : now;
    const t0 = Math.max(0, Math.min(t0data, t1 - MIN_SPAN));
    const span = Math.max(1, t1 - t0);
    const pxPerTick = plotW / span;
    const raw = 80 / pxPerTick;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / pow;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
    return { t0, t1, step, pxPerTick };
  }

  function draw() {
    const cv = canvas;
    if (!cv || collapsed) return;
    const lanes = timeline.lanes;
    const dpr = window.devicePixelRatio || 1;
    const cssW = cv.clientWidth;
    if (cssW === 0) return;
    const contentH = AXIS_H + PAD + lanes.length * LANE_H + PAD;
    const cssH = Math.max(contentH, cv.parentElement?.clientHeight ?? contentH);
    cv.style.height = cssH + "px";
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const plotW = cssW - LABEL_W - PAD;
    const { t0, t1, step, pxPerTick } = windowFor(lanes, timeline.now, plotW);
    const xOf = (t: number) => LABEL_W + (t - t0) * pxPerTick;

    // time grid + axis labels (monochrome)
    ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.strokeStyle = TOKENS.hairline; ctx.fillStyle = TOKENS.text3;
    ctx.font = "10px ui-monospace, monospace"; ctx.textBaseline = "top";
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const x = xOf(t);
      ctx.beginPath(); ctx.moveTo(x, AXIS_H); ctx.lineTo(x, cssH); ctx.stroke();
      ctx.fillText(String(t), x + 3, 3);
    }
    ctx.beginPath(); ctx.moveTo(0, AXIS_H); ctx.lineTo(cssW, AXIS_H); ctx.stroke();

    // lanes
    lanes.forEach((lane, i) => {
      const yMid = AXIS_H + PAD + i * LANE_H + LANE_H / 2;
      const yHi = yMid - 9, yLo = yMid + 9;
      ctx.fillStyle = TOKENS.text2; ctx.textBaseline = "middle";
      ctx.font = "11px system-ui, sans-serif";
      const label = lane.label + (lane.width > 1 ? ` [${lane.width}]` : "");
      ctx.fillText(label.length > 18 ? label.slice(0, 17) + "…" : label, PAD, yMid);

      if (lane.gone) {
        ctx.strokeStyle = TOKENS.text3; ctx.setLineDash([2, 4]);
        ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(LABEL_W, yMid); ctx.lineTo(LABEL_W + plotW, yMid); ctx.stroke();
        ctx.globalAlpha = 1; ctx.setLineDash([]);
        return;
      }
      drawWave(ctx, lane.transitions, Math.max(t0, lane.oldestTick), t1, xOf, yHi, yLo, yMid);
    });

    // scrub cursor + per-lane value readouts
    if (cursorTick !== null) {
      const x = xOf(cursorTick);
      ctx.strokeStyle = TOKENS.accent; ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssH); ctx.stroke();
      ctx.font = "10px ui-monospace, monospace"; ctx.textBaseline = "middle";
      lanes.forEach((lane, i) => {
        if (lane.gone) return;
        const v = valueAt(lane.transitions, lane.oldestTick, cursorTick!);
        const yMid = AXIS_H + PAD + i * LANE_H + LANE_H / 2;
        const right = x + 56 > cssW;
        const cx = right ? x - 22 : x + 6;
        ctx.fillStyle = TOKENS.surface3;
        ctx.fillRect(cx - 2, yMid - 7, 18, 14);
        ctx.fillStyle = v === null ? TOKENS.text3 : colorFor(v);
        ctx.fillText(v === null ? "—" : valLabel(v), cx, yMid);
      });
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
  }

  // step waveform: horizontal hold + vertical edge per transition (drawStart clamps to horizon)
  function drawWave(
    ctx: CanvasRenderingContext2D, trans: Trans[], drawStart: number, t1: number,
    xOf: (t: number) => number, yHi: number, yLo: number, yMid: number,
  ) {
    if (!trans.length) return;
    const yFor = (v: number) => (v === 1 ? yHi : v === 0 ? yLo : yMid);
    const seg = (xa: number, xb: number, v: number) => {
      if (xb <= xa) return;
      ctx.strokeStyle = colorFor(v); ctx.lineCap = "round"; const y = yFor(v);
      const line = (lw: number, a: number) => {
        ctx.setLineDash(v === 1 ? [] : dashFor(v)); ctx.lineWidth = lw; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
      };
      if (v === 1) { line(6, 0.28); line(2, 1); } else line(2, alphaFor(v)); // HI is the only glow
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    };
    let i = 0;
    while (i + 1 < trans.length && trans[i + 1].tick <= drawStart) i++;
    let curV = trans[i].value, curT = Math.max(drawStart, trans[i].tick);
    for (; i < trans.length; i++) {
      const segEnd = i + 1 < trans.length ? trans[i + 1].tick : t1;
      seg(xOf(Math.max(curT, drawStart)), xOf(Math.min(segEnd, t1)), curV);
      if (i + 1 < trans.length) {
        const nv = trans[i + 1].value, xe = xOf(trans[i + 1].tick);
        if (trans[i + 1].tick >= drawStart && trans[i + 1].tick <= t1) {
          ctx.setLineDash([]); ctx.strokeStyle = colorFor(nv); ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(xe, yFor(curV)); ctx.lineTo(xe, yFor(nv)); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        curV = nv; curT = trans[i + 1].tick;
      }
      if (segEnd >= t1) break;
    }
  }

  // Repaint on data / size / cursor / collapse changes.
  $effect(() => {
    void timeline; void height; void collapsed; void cursorTick;
    draw();
  });
  // Repaint when the canvas resizes (window/drawer width — not tracked above).
  $effect(() => {
    const cv = canvas;
    if (!cv) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(cv);
    return () => ro.disconnect();
  });

  function onMove(e: PointerEvent) {
    const cv = canvas;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x < LABEL_W) { cursorTick = null; return; }
    const plotW = r.width - LABEL_W - PAD;
    const { t0, pxPerTick } = windowFor(timeline.lanes, timeline.now, plotW);
    cursorTick = Math.max(0, Math.round(t0 + (x - LABEL_W) / pxPerTick));
  }
  function onLeave() { cursorTick = null; }

  // height-resize handle (drag the top edge)
  let resizing = false, startY = 0, startH = 0;
  function startResize(e: PointerEvent) {
    resizing = true; startY = e.clientY; startH = height;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResize(e: PointerEvent) {
    if (!resizing) return;
    height = Math.max(96, Math.min(window.innerHeight * 0.6, startH + (startY - e.clientY)));
  }
  function endResize(e: PointerEvent) {
    resizing = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }
</script>

<section class="td" class:collapsed style="height: {collapsed ? 'auto' : height + 'px'}">
  {#if !collapsed}
    <div class="handle" role="separator" aria-label="Resize timing diagram"
      onpointerdown={startResize} onpointermove={onResize} onpointerup={endResize}></div>
  {/if}
  <header class="head">
    <span class="title">TIMING</span>
    <span class="tick">t = {cursorTick ?? timeline.now}</span>
    <span class="spacer"></span>
    <button class="collapse" title={collapsed ? "Expand" : "Collapse"}
      onclick={() => (collapsed = !collapsed)}>{collapsed ? "▴" : "▾"}</button>
  </header>
  {#if !collapsed}
    {#if timeline.lanes.length === 0}
      <div class="empty">Add wires to Watches to see timing.</div>
    {:else}
      <div class="body">
        <canvas bind:this={canvas} onpointermove={onMove} onpointerleave={onLeave}></canvas>
      </div>
    {/if}
  {/if}
</section>

<style>
  .td {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--surface1);
    border-top: 1px solid var(--hairline);
    position: relative;
  }
  .handle {
    height: 6px; cursor: ns-resize; flex: 0 0 auto;
    position: absolute; top: -3px; left: 0; right: 0; z-index: 2;
  }
  .head {
    display: flex; align-items: center; gap: 12px;
    height: 30px; flex: 0 0 auto; padding: 0 12px;
    background: var(--surface2); border-bottom: 1px solid var(--hairline);
  }
  .title { font-size: 11px; font-weight: 600; letter-spacing: 0.10em; color: var(--text3); }
  .tick { font-family: ui-monospace, monospace; font-size: 11px; color: var(--text2); }
  .spacer { flex: 1; }
  .collapse {
    background: transparent; border: none; color: var(--text2);
    font-size: 12px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
  }
  .collapse:hover { background: var(--surface3); color: var(--text1); }
  .empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    color: var(--text3); font-size: 13px; padding: 20px;
  }
  .body { flex: 1; min-height: 0; overflow-y: auto; }
  canvas { display: block; width: 100%; }
</style>
