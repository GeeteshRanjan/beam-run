import { describe, it, expect } from 'vitest';
import { Analytics, type AnalyticsSink } from './Analytics';
import { buildNavigatorPayload, buildNavigatorUrl } from './navigator';
import { getSessionId, getMutePref, setMutePref } from './Save';

function recorder(): { sink: AnalyticsSink; events: { name: string; params: Record<string, unknown> }[] } {
  const events: { name: string; params: Record<string, unknown> }[] = [];
  return { events, sink: { emit: (name, params) => events.push({ name, params }) } };
}

function make(consent: boolean) {
  const r = recorder();
  const a = new Analytics({
    consent,
    sink: r.sink,
    sessionId: 'sess-123',
    device: 'desktop',
    reducedMotion: false,
    getInput: () => 'keyboard',
    now: () => '2026-01-01T00:00:00.000Z',
  });
  return { a, r };
}

describe('Analytics (consent-gated)', () => {
  it('emits NOTHING without consent', () => {
    const { a, r } = make(false);
    a.gameLoaded();
    a.gameStarted();
    a.playerDied(2, 'fire', 1);
    a.gameCompleted(115, 92, 3);
    expect(r.events.length).toBe(0);
  });

  it('emits each event once with the correct name + params (incl. common)', () => {
    const { a, r } = make(true);
    a.gameLoaded();
    a.gameStarted();
    a.screenEntered(1, 'Setup Delays');
    a.screenCleared(1, 12.345, 2);
    a.badgeCollected(1, 'PLACE_TILE');
    a.playerDied(2, 'fire', 1);
    a.gameOver(3, 40, 60.5);
    a.gameCompleted(115, 92.5, 3);
    a.ctaShown('win');
    a.ctaClicked('win', '/gcc-opportunity-navigator');
    a.gameSkipped(0);
    a.assistToggled('slowMode', true);

    const names = r.events.map((e) => e.name);
    expect(names).toEqual([
      'game_loaded',
      'game_started',
      'screen_entered',
      'screen_cleared',
      'badge_collected',
      'player_died',
      'game_over',
      'game_completed',
      'cta_shown',
      'cta_clicked',
      'game_skipped',
      'assist_toggled',
    ]);

    // Common params present on every event.
    for (const e of r.events) {
      expect(e.params.session_id).toBe('sess-123');
      expect(e.params.device).toBe('desktop');
      expect(e.params.input).toBe('keyboard');
      expect(e.params.reduced_motion).toBe(false);
      expect(e.params.ts).toBe('2026-01-01T00:00:00.000Z');
    }

    // Spot-check event-specific params.
    const cleared = r.events.find((e) => e.name === 'screen_cleared')!;
    expect(cleared.params).toMatchObject({ screen_id: 1, time_s: 12.35, deaths_on_screen: 2 });
    const died = r.events.find((e) => e.name === 'player_died')!;
    expect(died.params).toMatchObject({ screen_id: 2, cause: 'fire', lives_left: 1 });
    const done = r.events.find((e) => e.name === 'game_completed')!;
    expect(done.params).toMatchObject({ total_points: 115, duration_s: 92.5, total_deaths: 3 });
    const clicked = r.events.find((e) => e.name === 'cta_clicked')!;
    expect(clicked.params).toMatchObject({ context: 'win', target: '/gcc-opportunity-navigator' });
  });

  it('honours runtime consent revocation/grant', () => {
    const { a, r } = make(true);
    a.gameLoaded();
    a.setConsent(false);
    a.gameStarted();
    a.setConsent(true);
    a.gameSkipped(1);
    expect(r.events.map((e) => e.name)).toEqual(['game_loaded', 'game_skipped']);
  });
});

describe('Navigator hand-off payload', () => {
  it('maps each CTA context to the non-PII UTM/outcome payload', () => {
    expect(buildNavigatorPayload('win', 47)).toEqual({
      utm_source: 'beam_run',
      utm_medium: 'web_game',
      utm_campaign: 'market_entry',
      br_outcome: 'completed',
      br_points: 47,
    });
    expect(buildNavigatorPayload('game_over', 12).br_outcome).toBe('game_over');
    expect(buildNavigatorPayload('skip', -5).br_outcome).toBe('skipped');
    expect(buildNavigatorPayload('skip', -5).br_points).toBe(0); // clamped, non-negative
  });

  it('composes a deep-link URL', () => {
    const url = buildNavigatorUrl('/gcc-opportunity-navigator', buildNavigatorPayload('win', 47));
    expect(url).toBe(
      '/gcc-opportunity-navigator?utm_source=beam_run&utm_medium=web_game&utm_campaign=market_entry&br_outcome=completed&br_points=47',
    );
  });
});

describe('Save (privacy-first persistence)', () => {
  it('returns a stable pseudonymous session id', () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it('round-trips the mute preference', () => {
    setMutePref({ music: true, sfx: false });
    expect(getMutePref()).toEqual({ music: true, sfx: false });
  });
});
