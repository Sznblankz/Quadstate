/**
 * Gray-box prototype instrumentation (design doc 4 §2). Every interaction
 * event is logged with timestamp, classification, target, and outcome so
 * "feel" failures leave objective traces. Exposed on window.__logicsim
 * via the controller; sessions export JSON for the validation archive.
 */

export interface ProtoEvent {
  t: number;
  type: string;
  data: Record<string, unknown>;
}

export interface SpacePress {
  t: number;
  durationMs: number;
  /** Pointer movement occurred while Space was held (= pan intent). */
  panned: boolean;
  /** The release toggled the transport. */
  toggled: boolean;
}

export class ProtoLogger {
  readonly events: ProtoEvent[] = [];
  readonly spacePresses: SpacePress[] = [];
  private taskStarts = new Map<string, number>();
  private pauseAt: number | null = null;
  private pauseExploited = false;

  /** Event types that do NOT count as "using" a paused sim. */
  private static readonly PASSIVE = new Set(["transport", "space", "suspectPause", "escape", "stampDisarm"]);

  log(type: string, data: Record<string, unknown> = {}): void {
    this.events.push({ t: Math.round(performance.now()), type, data });
    if (this.pauseAt !== null && !ProtoLogger.PASSIVE.has(type)) {
      this.pauseExploited = true;
    }
  }

  space(press: SpacePress): void {
    this.spacePresses.push(press);
    this.log("space", { ...press });
  }

  /**
   * Suspect-pause tracking (Card C silent-pause metric): a pause interval
   * the user never exploits — no step, poke, or selection before resuming
   * — is a probable unnoticed accidental pause.
   */
  transport(running: boolean): void {
    if (!running) {
      this.pauseAt = performance.now();
      this.pauseExploited = false;
    } else if (this.pauseAt !== null) {
      if (!this.pauseExploited) {
        this.log("suspectPause", { pausedMs: Math.round(performance.now() - this.pauseAt) });
      }
      this.pauseAt = null;
    }
    this.log("transport", { running });
  }

  /** Call on step/poke/select/probe while paused — clears pause suspicion. */
  pauseUsed(): void {
    this.pauseExploited = true;
  }

  /** Misfire = the system did something other than intent (doc 4 §2.1). */
  misfire(kind: string, data: Record<string, unknown> = {}): void {
    this.log("misfire", { kind, ...data });
  }

  startTask(name: string): void {
    this.taskStarts.set(name, performance.now());
    this.log("taskStart", { name });
  }

  endTask(name: string): void {
    const start = this.taskStarts.get(name);
    this.taskStarts.delete(name);
    this.log("taskEnd", { name, ms: start === undefined ? null : Math.round(performance.now() - start) });
  }

  /** Space histogram + headline rates for in-session adjudication. */
  summary(): Record<string, unknown> {
    const presses = this.spacePresses;
    const taps = presses.filter((p) => !p.panned);
    const buckets: Record<string, number> = {};
    for (const p of presses) {
      const b = `${Math.min(1000, Math.floor(p.durationMs / 50) * 50)}ms${p.panned ? "+pan" : ""}`;
      buckets[b] = (buckets[b] ?? 0) + 1;
    }
    const toggles = this.events.filter((e) => e.type === "transport");
    let falseToggleGuesses = 0;
    for (let i = 1; i < toggles.length; i++) {
      if (toggles[i].t - toggles[i - 1].t < 1000) falseToggleGuesses++;
    }
    return {
      events: this.events.length,
      spacePresses: presses.length,
      spaceTaps: taps.length,
      spacePans: presses.length - taps.length,
      durationHistogram: buckets,
      probableFalseToggles: falseToggleGuesses,
      suspectPauses: this.events.filter((e) => e.type === "suspectPause").length,
      misfires: this.events.filter((e) => e.type === "misfire").length,
    };
  }

  exportJson(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      summary: this.summary(),
      spacePresses: this.spacePresses,
      events: this.events,
    }, null, 2);
  }
}
