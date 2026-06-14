/**
 * Screen <-> world transform, owned centrally (input adapter and renderer
 * both consume it; nothing else does coordinate math).
 */
export class Viewport {
  /** World coordinates of the screen origin. */
  x = 0;
  y = 0;
  zoom = 1;

  static readonly MIN_ZOOM = 0.1;
  static readonly MAX_ZOOM = 8;

  worldX(sx: number): number {
    return sx / this.zoom + this.x;
  }

  worldY(sy: number): number {
    return sy / this.zoom + this.y;
  }

  screenX(wx: number): number {
    return (wx - this.x) * this.zoom;
  }

  screenY(wy: number): number {
    return (wy - this.y) * this.zoom;
  }

  panByScreen(dsx: number, dsy: number): void {
    this.x -= dsx / this.zoom;
    this.y -= dsy / this.zoom;
  }

  /** Zoom by `factor`, keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const wx = this.worldX(sx);
    const wy = this.worldY(sy);
    this.zoom = Math.min(Viewport.MAX_ZOOM, Math.max(Viewport.MIN_ZOOM, this.zoom * factor));
    this.x = wx - sx / this.zoom;
    this.y = wy - sy / this.zoom;
  }

  /** Visible world rectangle for a screen of the given pixel size. */
  visibleRect(width: number, height: number): { x0: number; y0: number; x1: number; y1: number } {
    return {
      x0: this.x,
      y0: this.y,
      x1: this.worldX(width),
      y1: this.worldY(height),
    };
  }
}
