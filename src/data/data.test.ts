import { describe, it, expect } from 'vitest';
import { BRAND, RESOLUTION, PLAYER, JOURNEY } from './tuning.config';
import { PALETTE, SEMANTIC } from './tokens';
import { COPY, CAPABILITIES, capabilityFor } from './copy';
import { SCREENS, SCREEN_COUNT, getScreen, GRID, TOTAL_MONTHS_BASE } from './levels';

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
    // The game is ANSRcade; "Market Entry" is the edition (see COPY.meta).
    expect(COPY.meta.name).toBe('ANSRcade');
    expect(COPY.meta.title).toBe(`${COPY.meta.name}: ${COPY.meta.edition}`);
    expect(COPY.win.title).toBe('Market Entry Complete.');
  });

  it('leads with the stake, interpolated from the tuning model (never typed)', () => {
    expect(COPY.start.stake(JOURNEY.BASELINE_MONTHS)).toContain('24');
  });

  it('names a capability, a product and a topic for every badge type', () => {
    const badges = SCREENS.filter((s) => s.badge).map((s) => s.badge!.type);
    for (const b of badges) {
      const cap = capabilityFor(b);
      expect(cap, `badge ${b} needs a capability entry`).toBeTruthy();
      expect(cap!.product).toBeTruthy();
      expect(cap!.topic).toBeTruthy();
    }
  });

  it('blames the environment for every setback cause, never the player', () => {
    for (const cause of ['delay', 'fire', 'gate', 'spike', 'fall']) {
      expect(COPY.setback.tag[cause]).toBeTruthy();
      expect(COPY.setback.reason[cause]).toBeTruthy();
      expect(COPY.setback.reason[cause]!.toLowerCase()).not.toContain('you failed');
    }
  });
});

describe('the journey model', () => {
  it('screen months sum to the ANSR benchmark, so a clean run lands on it', () => {
    expect(TOTAL_MONTHS_BASE).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
  });

  it('caps the clock below the going-alone baseline (the story cannot invert)', () => {
    expect(JOURNEY.MAX_MONTHS).toBeLessThan(JOURNEY.BASELINE_MONTHS);
  });

  it('capability savings account for the whole baseline gap', () => {
    const saved = CAPABILITIES.reduce((sum, c) => sum + c.monthsSaved, 0);
    expect(saved).toBe(JOURNEY.BASELINE_MONTHS - JOURNEY.ANSR_BENCHMARK_MONTHS);
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
