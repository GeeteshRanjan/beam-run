import { describe, it, expect } from 'vitest';
import { BRAND, RESOLUTION, PLAYER, JOURNEY } from './tuning.config';
import { PALETTE, SEMANTIC } from './tokens';
import { COPY, CAPABILITIES, capabilityFor } from './copy';
import { SCREENS, SCREEN_COUNT, getScreen, GRID, TOTAL_MONTHS_BASE } from './levels';
import { wrapPixelLabel, normalizeForPixels } from '../ui/PixelType';

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

  it('quotes no industry statistic anywhere a player can read one', () => {
    /*
     * The title screen led with "The average India GCC takes 24 months to go live."
     * and the closing screen answered it with "ANSR clients average 11 months." Both
     * are gone (owner call): an unsourced average is a claim the player can argue
     * with, printed on the two surfaces they are most likely to screenshot.
     *
     * This is the guard, and it is deliberately a *search* rather than a check on the
     * two deleted keys: the figures came back once already, as a per-row "saves 4
     * months" on the receipt, which was the same claim split four ways.
     */
    const player: string[] = [
      COPY.start.headline,
      COPY.start.tagline,
      COPY.legend.moveJumpKeys,
      COPY.legend.moveJumpTap,
      COPY.legend.fireKeys,
      COPY.legend.fireTap,
      COPY.win.title,
      COPY.win.lostLabel,
      COPY.win.verdictClean,
      COPY.win.verdictDelayed,
      COPY.win.delaysNone,
      COPY.win.replay,
      COPY.gameOver.title,
      COPY.gameOver.costLabel,
      COPY.gameOver.advice,
      COPY.gameOver.restart,
      COPY.a11y.won(0),
      COPY.a11y.won(4),
    ];
    for (const s of player) {
      expect(s, s).not.toContain(String(JOURNEY.BASELINE_MONTHS));
      expect(s, s).not.toContain(String(JOURNEY.ANSR_BENCHMARK_MONTHS));
      expect(s.toLowerCase(), s).not.toContain('average');
      expect(s.toLowerCase(), s).not.toContain('benchmark');
    }
  });

  it('leads the title screen with the hook and the offer, and nothing else', () => {
    /*
     * Five things have now been deleted from this screen by the owner, in order: the
     * 24-month average, the dare that pointed at it ("Think you can?"), the arcade
     * contract ("6 STAGES. 3 LIVES.", drafted and rejected in its own raster), the
     * three-line hook ("Any board can approve a GCC. / BUILDING IT / is the hard
     * part."), and now the row of key caps — the controls are taught on the briefing
     * cards, a stage at a time (`COPY.legend`).
     *
     * What is left is two lines: the hook, then the offer. Neither carries a figure.
     */
    expect(COPY.start.headline).toBe('All of the delays. None of the damage.');
    expect(COPY.start.tagline).toBe('Play through the GCC journey, before you plan it.');
    for (const line of [COPY.start.headline, COPY.start.tagline]) {
      expect(line, line).not.toMatch(/\d/);
      expect(line, line).not.toMatch(/['\u2018\u2019]/);
    }
    expect(COPY.start).not.toHaveProperty('hook');
    expect(COPY.start).not.toHaveProperty('challenge');
    // The controls are gone from this screen's copy as well as from its markup: leaving
    // the sentences here is how a deleted surface grows back.
    expect(COPY.start).not.toHaveProperty('controlsKeys');
    expect(COPY.start).not.toHaveProperty('controlsTap');
    expect(COPY.start).not.toHaveProperty('legend');
    // Two balanced lines at the measure the screen sets each of them at — the headline
    // as the title (20), the offer at the body measure (34) — so the last line is never
    // a single word standing over the Start cap.
    const head = wrapPixelLabel(COPY.start.headline, 20);
    expect(head).toHaveLength(2);
    expect(Math.abs(head[0]!.length - head[1]!.length)).toBeLessThanOrEqual(4);
    const offer = wrapPixelLabel(COPY.start.tagline, 34);
    expect(offer).toHaveLength(2);
    expect(Math.min(offer[0]!.length, offer[1]!.length) * 2).toBeGreaterThanOrEqual(
      Math.max(offer[0]!.length, offer[1]!.length),
    );
  });
  it('teaches the controls on the cards, and names fire only where it exists', () => {
    /*
     * Owner call: the controls copy moved off the opening screen and onto the briefing
     * cards, "like a play through", with F introduced "when it is relevant".
     *
     * These four sentences are the legend's *accessible* copy — the visible row is caps —
     * so they are not measured against any headline. What they must do is split the
     * lesson in two: the move/jump pair may not mention fire (it is shown three stages
     * before a powerup arms one, so naming it would be a control that does nothing), and
     * the fire pair must name the key, because it is the one control nobody can guess.
     */
    for (const line of [COPY.legend.moveJumpKeys, COPY.legend.moveJumpTap]) {
      expect(line.toLowerCase(), line).toContain('jump');
      expect(line.toLowerCase(), line).not.toContain('fire');
    }
    expect(COPY.legend.fireKeys).toMatch(/\bF\b/);
    for (const line of [COPY.legend.fireKeys, COPY.legend.fireTap]) {
      expect(line.toLowerCase(), line).toContain('fire');
    }
    // Every cap label sets inside its own cap, which is what keeps the row a row of
    // buttons rather than a row of words.
    for (const label of Object.values(COPY.legend.caps)) {
      expect(normalizeForPixels(label).length, label).toBeLessThanOrEqual(5);
    }
  });

  it('names a capability, a product and a topic for every capability badge', () => {
    const badges = SCREENS.filter((s) => s.badge).map((s) => s.badge!.type);
    /*
     * **Every badge in the game is a capability, and there are exactly four.** The two
     * screens with nothing to defend against carry none: Head Office (owner call — a badge
     * whose effect is deliberately unassigned taught the player that taking one does
     * nothing, one screen before the one that saves them) and now the Tech Park (owner
     * call — a rail hanging in the middle of the payoff, on a screen already won). The
     * `SAFE_PASSAGE` type went with its last holder, so the "filter out the one that has
     * no product" step this test used to need is gone.
     */
    expect(badges).toHaveLength(SCREENS.length - 2);
    expect(SCREENS.filter((s) => !s.badge).map((s) => s.name)).toEqual([
      'Head Office',
      'ANSR Tech Park',
    ]);
    // …and a screen may only omit the badge if it has nothing to defend against.
    for (const s of SCREENS) {
      if (!s.badge) expect(s.hazard, `screen ${s.id} has obstacles but no badge`).toBe('none');
    }
    for (const b of badges) {
      const cap = capabilityFor(b);
      expect(cap, `badge ${b} needs a capability entry`).toBeTruthy();
      expect(cap!.product).toBeTruthy();
      expect(cap!.topic).toBeTruthy();
      // …and a HUD label, so the engaged chip is never blank.
      expect(COPY.powers[b]).toBeTruthy();
    }
    // Nothing in COPY.powers is a badge nobody carries.
    expect(Object.keys(COPY.powers).sort()).toEqual([...badges].sort());
  });

  it('blames the environment for every setback cause, never the player', () => {
    for (const cause of ['stamp', 'fire', 'monster', 'mummy', 'fall']) {
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

  it('claims no months for any single capability', () => {
    // The receipt row used to read "saves 4 months", and the four figures summed to
    // the gap between the two published averages. Both averages are out of the game,
    // so the field went with them: a row states what ANSR did, from COPY.powers.
    for (const cap of CAPABILITIES) {
      expect(cap, cap.product).not.toHaveProperty('monthsSaved');
      expect(COPY.powers[cap.badge], cap.product).toBeTruthy();
      expect(COPY.powers[cap.badge]!, cap.product).not.toMatch(/month/i);
    }
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
    // Journey order (owner call): setup → compliance → workplace → hiring.
    expect(getScreen(2).name).toBe('Compliance');
    expect(getScreen(3).name).toBe('Workplace');
    expect(getScreen(4).name).toBe('Hire Under Fire');
    expect(() => getScreen(99)).toThrow();
  });
});
