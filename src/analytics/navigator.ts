/**
 * Navigator hand-off — builds the non-PII deep-link payload that pre-frames the
 * conversation in the ANSR GCC Opportunity Navigator (doc 07 §6).
 *
 * The game NEVER posts to a CRM; the only hand-off is this explicit-click deep
 * link carrying UTM + outcome + the (non-PII) valuation score.
 */
export type CtaContext = 'win' | 'game_over' | 'skip';
export type Outcome = 'completed' | 'game_over' | 'skipped';

export interface NavigatorPayload {
  utm_source: 'beam_run';
  utm_medium: 'web_game';
  utm_campaign: 'market_entry';
  br_outcome: Outcome;
  br_points: number;
}

const OUTCOME: Record<CtaContext, Outcome> = {
  win: 'completed',
  game_over: 'game_over',
  skip: 'skipped',
};

/** Build the deep-link payload for a given CTA context + score. */
export function buildNavigatorPayload(context: CtaContext, points: number): NavigatorPayload {
  return {
    utm_source: 'beam_run',
    utm_medium: 'web_game',
    utm_campaign: 'market_entry',
    br_outcome: OUTCOME[context],
    br_points: Math.max(0, Math.round(points)),
  };
}

/** Compose the full Navigator URL from a base + payload. */
export function buildNavigatorUrl(base: string, payload: NavigatorPayload): string {
  const query = Object.entries(payload)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${base}?${query}`;
}
