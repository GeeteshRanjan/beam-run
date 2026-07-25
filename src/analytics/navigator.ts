/**
 * Navigator hand-off — builds the non-PII deep-link payload that pre-frames the
 * conversation in the ANSR GCC Opportunity Navigator (doc 07 §6).
 *
 * The game NEVER posts to a CRM; the only hand-off is this explicit-click deep
 * link carrying UTM + outcome + the run's month figure + (when the click came
 * from a capability row on the receipt) the topic the person chose.
 *
 * `br_topic` is a **declared** interest, not an inferred one: it is set only when
 * someone deliberately clicks a named capability. We do not guess intent from
 * how many times they mistimed a jump.
 */
export type CtaContext = 'win' | 'summary' | 'skip';
export type Outcome = 'completed' | 'in_progress' | 'skipped';

export interface NavigatorPayload {
  utm_source: 'beam_run';
  utm_medium: 'web_game';
  utm_campaign: 'market_entry';
  br_outcome: Outcome;
  /** Months to market this run produced (non-PII). */
  br_months: number;
  /** Capability the person chose to talk about, when they picked one. */
  br_topic?: string;
}

const OUTCOME: Record<CtaContext, Outcome> = {
  win: 'completed',
  summary: 'in_progress',
  skip: 'skipped',
};

/** Build the deep-link payload for a given CTA context, month figure and topic. */
export function buildNavigatorPayload(
  context: CtaContext,
  months: number,
  topic?: string,
): NavigatorPayload {
  const payload: NavigatorPayload = {
    utm_source: 'beam_run',
    utm_medium: 'web_game',
    utm_campaign: 'market_entry',
    br_outcome: OUTCOME[context],
    br_months: Math.max(0, Math.round(months)),
  };
  if (topic) payload.br_topic = topic;
  return payload;
}

/** Compose the full Navigator URL from a base + payload (skips empty values). */
export function buildNavigatorUrl(base: string, payload: NavigatorPayload): string {
  const query = Object.entries(payload)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${base}?${query}`;
}
