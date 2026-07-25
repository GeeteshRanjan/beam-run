import { describe, it, expect, vi } from 'vitest';
import { ansrMarkPath, ansrMarkScale, drawAnsrLogo, LOGO_ORANGE } from './ansrLogo';
import { ANSR_MARK_W, ANSR_MARK_H } from '../ui/ansrMark';

/** Minimal 2D-context stand-in: records the calls we care about. */
function stubCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D & { scale: ReturnType<typeof vi.fn> };
}

describe('ansrLogo (the brand mark on canvas)', () => {
  it('fits the mark to a given diameter by its longest side', () => {
    const longest = Math.max(ANSR_MARK_W, ANSR_MARK_H);
    expect(ansrMarkScale(longest)).toBeCloseTo(1, 6);
    expect(ansrMarkScale(92)).toBeCloseTo(92 / longest, 6);
    // The mark is taller than it is wide, so a 92px draw stays within 92px.
    expect(ANSR_MARK_W * ansrMarkScale(92)).toBeLessThanOrEqual(92);
    expect(ANSR_MARK_H * ansrMarkScale(92)).toBeCloseTo(92, 6);
  });

  it('degrades quietly where Path2D is unavailable (jsdom)', () => {
    // No canvas implementation here, so the path compiles to null and drawing is
    // a no-op instead of a throw — the finale must never take the game down.
    expect(ansrMarkPath()).toBeNull();
    const ctx = stubCtx();
    expect(() => drawAnsrLogo(ctx, 100, 100, 92, 0.4)).not.toThrow();
    expect(ctx.scale).not.toHaveBeenCalled();
  });

  it('re-exports the logo orange, distinct from the value accent', () => {
    expect(LOGO_ORANGE).toBe('#f05722');
    expect(LOGO_ORANGE).not.toBe('#FF5400');
  });
});
