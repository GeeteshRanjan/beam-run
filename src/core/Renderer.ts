/**
 * Renderer — owns the canvas, HiDPI scaling, and letterboxing.
 *
 * The game draws in a fixed internal coordinate space (1280×720). The renderer
 * maps that space onto the canvas with `object-fit: contain` semantics: the
 * internal frame is scaled up uniformly and centred, with Deep-Teal bars
 * filling any leftover area. All gameplay draw calls use internal coordinates
 * and are clipped to the 1280×720 frame.
 */
import { RESOLUTION, BRAND } from '../data/tuning.config';

export interface Viewport {
  /** CSS px scale from internal → displayed frame. */
  scale: number;
  /** CSS px offset (letterbox bar size) on each axis. */
  offsetX: number;
  offsetY: number;
  /** Displayed frame size in CSS px. */
  drawW: number;
  drawH: number;
}

/**
 * Pure `contain` fit of the internal resolution into a container. No DOM/canvas
 * dependency, so it is unit-testable.
 */
export function computeViewport(
  containerW: number,
  containerH: number,
  internalW = RESOLUTION.WIDTH,
  internalH = RESOLUTION.HEIGHT,
): Viewport {
  const targetAspect = internalW / internalH;
  const containerAspect = containerW / containerH;
  let drawW: number;
  let drawH: number;
  if (containerAspect > targetAspect) {
    // Container is wider than 16:9 → height-limited, bars on left/right.
    drawH = containerH;
    drawW = containerH * targetAspect;
  } else {
    // Container is taller → width-limited, bars on top/bottom.
    drawW = containerW;
    drawH = containerW / targetAspect;
  }
  const scale = drawW / internalW;
  const offsetX = (containerW - drawW) / 2;
  const offsetY = (containerH - drawH) / 2;
  return { scale, offsetX, offsetY, drawW, drawH };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly internalW = RESOLUTION.WIDTH;
  readonly internalH = RESOLUTION.HEIGHT;

  private dpr = 1;
  private viewport: Viewport = computeViewport(RESOLUTION.WIDTH, RESOLUTION.HEIGHT);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('2D canvas context unavailable');
    }
    this.ctx = ctx;
    this.resize();
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  /** Recompute backing store + viewport from the canvas's CSS size. */
  resize(): void {
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width || this.internalW;
    const cssH = rect.height || this.internalH;
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.viewport = computeViewport(cssW, cssH, this.internalW, this.internalH);
  }

  /**
   * Begin a frame: paint the letterbox, set the internal-space transform
   * (optionally offset by a camera-shake vector, in internal px), and clip to
   * the play frame.
   */
  begin(shakeX = 0, shakeY = 0): void {
    const { ctx } = this;
    const { scale, offsetX, offsetY } = this.viewport;
    const d = this.dpr;

    // Letterbox bars.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BRAND.DEEP_TEAL;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Internal-space transform.
    const s = scale * d;
    ctx.setTransform(s, 0, 0, s, (offsetX + shakeX) * d, (offsetY + shakeY) * d);
    ctx.beginPath();
    ctx.rect(0, 0, this.internalW, this.internalH);
    ctx.clip();
  }

  end(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Reset transform to device space (for HUD/debug drawing over the frame). */
  toDeviceSpace(): number {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    return this.dpr;
  }
}
