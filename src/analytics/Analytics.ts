/**
 * Analytics — a consent-gated, GA4-style event adapter.
 *
 * Privacy stance (doc 07 §2, non-negotiable):
 *  - No PII. A single pseudonymous `session_id` ties events for funnel analysis.
 *  - With NO consent the adapter is a hard no-op: it buffers nothing and emits
 *    nothing. Consent can be granted/revoked at runtime via `setConsent`.
 *  - Every event carries the common params (session_id, device, input,
 *    reduced_motion, ts) and snake_case names for GA4 compatibility.
 *
 * Transport is an injectable `AnalyticsSink` (defaults to GA4 dataLayer/gtag if
 * present, plus a dev debug log). Injectable so the taxonomy is unit-testable.
 */
import type { CtaContext } from './navigator';

export type Device = 'desktop' | 'mobile' | 'tablet';
export type InputMode = 'keyboard' | 'touch';

export interface AnalyticsSink {
  emit(name: string, params: Record<string, unknown>): void;
}

export interface AnalyticsOptions {
  consent?: boolean;
  sink?: AnalyticsSink;
  sessionId: string;
  device?: Device;
  reducedMotion?: boolean;
  /** Current input modality (keyboard/touch); read per-event as it can change. */
  getInput?: () => InputMode;
  /** ISO timestamp source (injectable for tests). */
  now?: () => string;
}

/** Default sink: GA4 dataLayer/gtag when available, plus a dev debug log. */
export function createDefaultSink(debug = false): AnalyticsSink {
  return {
    emit(name, params) {
      if (typeof window !== 'undefined') {
        const w = window as unknown as {
          gtag?: (...args: unknown[]) => void;
          dataLayer?: unknown[];
        };
        if (typeof w.gtag === 'function') w.gtag('event', name, params);
        else if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: name, ...params });
      }
      if (debug && typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.debug('[BeamRun analytics]', name, params);
      }
    },
  };
}

export class Analytics {
  private consent: boolean;
  private readonly sink: AnalyticsSink;
  private readonly sessionId: string;
  private readonly device: Device;
  private readonly reducedMotion: boolean;
  private readonly getInput: () => InputMode;
  private readonly now: () => string;

  constructor(opts: AnalyticsOptions) {
    this.consent = opts.consent ?? false;
    this.sink = opts.sink ?? createDefaultSink();
    this.sessionId = opts.sessionId;
    this.device = opts.device ?? 'desktop';
    this.reducedMotion = opts.reducedMotion ?? false;
    this.getInput = opts.getInput ?? (() => 'keyboard');
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  get hasConsent(): boolean {
    return this.consent;
  }

  /** Grant/revoke analytics consent at runtime. */
  setConsent(consent: boolean): void {
    this.consent = consent;
  }

  private track(name: string, params: Record<string, unknown> = {}): void {
    if (!this.consent) return; // hard no-op without consent
    this.sink.emit(name, {
      session_id: this.sessionId,
      device: this.device,
      input: this.getInput(),
      reduced_motion: this.reducedMotion,
      ts: this.now(),
      ...params,
    });
  }

  // --- typed taxonomy (analytics-events.json) -------------------------------

  gameLoaded(): void {
    this.track('game_loaded');
  }
  gameStarted(): void {
    this.track('game_started');
  }
  screenEntered(screenId: number, screenName: string): void {
    this.track('screen_entered', { screen_id: screenId, screen_name: screenName });
  }
  screenCleared(screenId: number, timeS: number, setbacks: number, months: number): void {
    this.track('screen_cleared', {
      screen_id: screenId,
      time_s: round2(timeS),
      setbacks_on_screen: setbacks,
      months: months,
    });
  }
  badgeCollected(screenId: number, badgeType: string): void {
    this.track('badge_collected', { screen_id: screenId, badge_type: badgeType });
  }
  /** A hazard cost the player time. Diagnostic (difficulty balancing), not an intent signal. */
  setbackIncurred(screenId: number, cause: string, totalMonths: number): void {
    this.track('setback_incurred', { screen_id: screenId, cause, months: totalMonths });
  }
  /** Mid-run exit: the summary receipt was shown instead of a game-over wall. */
  runSummary(reachedScreen: number, months: number, durationS: number): void {
    this.track('run_summary_shown', {
      reached_screen: reachedScreen,
      months,
      duration_s: round2(durationS),
    });
  }
  gameCompleted(
    months: number,
    durationS: number,
    setbacks: number,
    quickWins: number,
    capabilities: number,
  ): void {
    this.track('game_completed', {
      months,
      duration_s: round2(durationS),
      total_setbacks: setbacks,
      quick_wins: quickWins,
      capabilities_engaged: capabilities,
    });
  }
  ctaShown(context: CtaContext): void {
    this.track('cta_shown', { context });
  }
  ctaClicked(context: CtaContext, target: string, topic?: string): void {
    this.track('cta_clicked', { context, target, ...(topic ? { topic } : {}) });
  }
  gameSkipped(screenId: number): void {
    this.track('game_skipped', { screen_id: screenId });
  }
  assistToggled(option: string, enabled: boolean): void {
    this.track('assist_toggled', { option, enabled });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rough device class from the environment (no fingerprinting). */
export function detectDevice(): Device {
  if (typeof navigator === 'undefined') return 'desktop';
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in (globalThis as object);
  if (!touch) return 'desktop';
  const w = typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight) : 0;
  return w >= 600 ? 'tablet' : 'mobile';
}
