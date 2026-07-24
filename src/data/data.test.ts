import { describe, it, expect } from 'vitest';
import { BRAND, RESOLUTION, PLAYER } from './tuning.config';
import { PALETTE, SEMANTIC } from './tokens';
import { COPY } from './copy';
import { SCREENS, SCREEN_COUNT, getScreen, GRID } from './levels';

describe('brand tokens', () => {
  it('exposes exactly the five brand colours', () => {
    const keys = Object.keys(PALETTE).sort();
    expect(keys).toEqual(['DEEP_TEAL', 'LIGHT_GREY', 'LIGHT_TEAL', 'ORANGE', 'WHITE']);
  });

  it('every colour is a valid 6-digit hex', () => {
    for (const value of Object.values(PALETTE)) {
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('reserves orange as the value accent', () => {
    expect(SEMANTIC.accent).toBe(BRAND.ORANGE);
    expect(SEMANTIC.surface).toBe(BRAND.DEEP_TEAL);
  });
});

describe('tuning config import', () => {
  it('uses the 1280x720 / 40px grid', () => {
    expect(RESOLUTION.WIDTH).toBe(1280);
    expect(RESOLUTION.HEIGHT).toBe(720);
    expect(RESOLUTION.TILE).toBe(40);
    expect(RESOLUTION.COLS * RESOLUTION.TILE).toBe(RESOLUTION.WIDTH);
    expect(RESOLUTION.ROWS * RESOLUTION.TILE).toBe(RESOLUTION.HEIGHT);
  });

  it('has a physically sane jump velocity', () => {
    expect(PLAYER.JUMP_VELOCITY).toBeLessThan(0); // upward is negative y
    const apex = (PLAYER.JUMP_VELOCITY * PLAYER.JUMP_VELOCITY) / (2 * PLAYER.GRAVITY);
    expect(apex).toBeGreaterThan(120);
    expect(apex).toBeLessThan(160);
  });
});

describe('copy', () => {
  it('has the branded title and understated win line', () => {
    expect(COPY.meta.title).toBe('Beam Run: Market Entry');
    expect(COPY.win.title).toBe('Market Entry Complete.');
    expect(COPY.win.valuationLabel).toBe('Company Valuation');
  });
});

describe('levels data', () => {
  it('has six screens with ids 0..5', () => {
    expect(SCREEN_COUNT).toBe(6);
    expect(SCREENS.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('matches the documented grid', () => {
    expect(GRID).toEqual({ cols: 32, rows: 18, tile: 40 });
  });

  it('maps each hazard screen to a badge', () => {
    for (const s of SCREENS) {
      if (s.hazard !== 'none') {
        expect(s.badge, `screen ${s.id} needs a badge`).toBeTruthy();
      }
    }
  });

  it('getScreen returns the named screen', () => {
    expect(getScreen(2).name).toBe('Hire Under Fire');
    expect(() => getScreen(99)).toThrow();
  });
});
