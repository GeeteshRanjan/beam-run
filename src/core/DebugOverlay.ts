/**
 * DebugOverlay — dev-only readout (FPS, state, timers, later hitboxes/hazard
 * windows). Drawn in device space so it isn't affected by the internal-space
 * transform. Toggled with the backtick key; never present in production builds.
 */
export class DebugOverlay {
  enabled = false;

  toggle(): void {
    this.enabled = !this.enabled;
  }

  render(ctx: CanvasRenderingContext2D, dpr: number, lines: string[]): void {
    if (!this.enabled) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 8;
    const lineH = 14;
    const w = 220;
    const h = pad * 2 + lines.length * lineH;
    ctx.fillStyle = 'rgba(0, 36, 46, 0.82)';
    ctx.fillRect(pad, pad, w, h);
    ctx.strokeStyle = 'rgba(255, 84, 0, 0.7)';
    ctx.strokeRect(pad, pad, w, h);
    ctx.fillStyle = '#E6E6E6';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, pad * 2, pad * 2 + i * lineH);
    });
    ctx.restore();
  }
}
