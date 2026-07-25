import { describe, it, expect } from 'vitest';
import { Analytics, type AnalyticsSink } from './Analytics';
import { buildNavigatorPayload, buildNavigatorUrl } from './navigator';
import { getSessionId, getMutePref, setMutePref } from './Save';

function recorder(): {
  sink: AnalyticsSink;
  events: { name: string; params: Record<string, unknown> }[];
} {
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
    a.setbackIncurred(2, 'fire', 8);
    a.gameCompleted(14, 92, 3, 12, 4);
    expect(r.events.length).toBe(0);
  });

  it('emits each event once with the correct name + params (incl. common)', () => {
    const { a, r } = make(true);
    a.gameLoaded();
    a.gameStarted();
    a.screenEntered(1, 'Setup Delays');
    a.screenCleared(1, 12.345, 2, 8);
    a.badgeCollected(1, 'PLACE_TILE');
    a.setbackIncurred(2, 'fire', 8);
    a.runSummary(3, 10, 60.5);
    a.gameCompleted(14, 92.5, 3, 12, 4);
    a.ctaShown('win');
    a.ctaClicked('win', '/gcc-opportunity-navigator', 'compliance');
    a.gameSkipped(0);
    a.assistToggled('autoRun', true);

    expect(r.events.map((e) => e.name)).toEqual([
      'game_loaded',
      'game_started',
      'screen_entered',
      'screen_cleared',
      'badge_collected',
      'setback_incurred',
      'run_summary_shown',
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

    const cleared = r.events.find((e) => e.name === 'screen_cleared')!;
    expect(cleared.params).toMatchObject({
      screen_id: 1,
      time_s: 12.35,
      setbacks_on_screen: 2,
      months: 8,
    });
    const setback = r.events.find((e) => e.name === 'setback_incurred')!;
    expect(setback.params).toMatchObject({ screen_id: 2, cause: 'fire', months: 8 });
    const summary = r.events.find((e) => e.name === 'run_summary_shown')!;
    expect(summary.params).toMatchObject({ reached_screen: 3, months: 10, duration_s: 60.5 });
    const done = r.events.find((e) => e.name === 'game_completed')!;
    expect(done.params).toMatchObject({
      months: 14,
      duration_s: 92.5,
      total_setbacks: 3,
      quick_wins: 12,
      capabilities_engaged: 4,
    });
    const clicked = r.events.find((e) => e.name === 'cta_clicked')!;
    expect(clicked.params).toMatchObject({
      context: 'win',
      target: '/gcc-opportunity-navigator',
      topic: 'compliance',
    });
  });

  it('omits the topic when the click did not declare one', () => {
    const { a, r } = make(true);
    a.ctaClicked('skip', '/nav');
    expect(r.events[0]!.params).not.toHaveProperty('topic');
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
    expect(buildNavigatorPayload('win', 14)).toEqual({
      utm_source: 'beam_run',
      utm_medium: 'web_game',
      utm_campaign: 'market_entry',
      br_outcome: 'completed',
      br_months: 14,
    });
    expect(buildNavigatorPayload('summary', 8).br_outcome).toBe('in_progress');
    expect(buildNavigatorPayload('skip', -5).br_outcome).toBe('skipped');
    expect(buildNavigatorPayload('skip', -5).br_months).toBe(0); // clamped
  });

  it('carries a declared topic only when one was chosen', () => {
    expect(buildNavigatorPayload('win', 11, 'compliance').br_topic).toBe('compliance');
    expect(buildNavigatorPayload('win', 11)).not.toHaveProperty('br_topic');
  });

  it('composes a deep-link URL', () => {
    const url = buildNavigatorUrl(
      '/gcc-opportunity-navigator',
      buildNavigatorPayload('win', 11, 'setup'),
    );
    expect(url).toBe(
      '/gcc-opportunity-navigator?utm_source=beam_run&utm_medium=web_game' +
        '&utm_campaign=market_entry&br_outcome=completed&br_months=11&br_topic=setup',
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
