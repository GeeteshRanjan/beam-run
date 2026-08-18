/**
 * The delay log — the running record of what the journey actually cost.
 *
 * Every obstacle that stops the player writes one entry: which stage, which
 * obstacle, and the months it booked. The log is the reason the lives system
 * earns its place. Three lives on their own would just be an arcade convention;
 * a visible ledger turns each loss into a line item, and the closing total into
 * the argument — every one of those months was avoidable with the ANSR badge.
 *
 * Headless and pure on purpose: the simulation owns the entries, the HUD panel
 * and the overlays only ever *read* them through the two view builders here, so
 * the panel and the end screens can never disagree about the total.
 */
import { COPY } from '../data/copy';
import type { SetbackCause } from '../world/types';

export interface SetbackLogEntry {
  /** 1-based position in the run, so the panel can show "3rd delay". */
  index: number;
  screenId: number;
  screenName: string;
  cause: SetbackCause;
  /** Months this one booked. */
  months: number;
}

/** One obstacle kind, totalled across the run (the end-screen breakdown). */
export interface LedgerRow {
  cause: SetbackCause;
  /** Short uppercase obstacle name, safe for the 5x7 font. */
  label: string;
  count: number;
  months: number;
}

/** What the HUD panel draws: the latest few rows, a roll-up and the total. */
export interface LogPanelView {
  rows: readonly { label: string; months: number }[];
  /** Entries older than the visible window (0 when nothing is hidden). */
  earlier: number;
  total: number;
  count: number;
}

/** Short uppercase obstacle name for a cause (falls back to the raw cause). */
export function causeLabel(cause: SetbackCause): string {
  return COPY.setback.tag[cause] ?? cause.toUpperCase();
}

/** Total months booked by delays. */
export function loggedMonths(log: readonly SetbackLogEntry[]): number {
  return log.reduce((sum, e) => sum + e.months, 0);
}

/**
 * The breakdown by obstacle, in first-encountered order. Grouping matters: "RED
 * TAPE x2, +4 months" is a finding, while four identical rows is just noise.
 */
export function ledgerRows(log: readonly SetbackLogEntry[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const entry of log) {
    const existing = rows.find((r) => r.cause === entry.cause);
    if (existing) {
      existing.count += 1;
      existing.months += entry.months;
    } else {
      rows.push({
        cause: entry.cause,
        label: causeLabel(entry.cause),
        count: 1,
        months: entry.months,
      });
    }
  }
  return rows;
}

/**
 * The HUD panel view. The panel hangs from the top of the frame and grows
 * downwards, so it cannot be unbounded: only the most recent `visibleRows` are
 * listed and everything older collapses into one roll-up line. The total always
 * counts every entry.
 */
export function logPanelView(
  log: readonly SetbackLogEntry[],
  visibleRows: number,
): LogPanelView {
  const shown = visibleRows > 0 ? log.slice(-visibleRows) : [];
  return {
    rows: shown.map((e) => ({ label: causeLabel(e.cause), months: e.months })),
    earlier: Math.max(0, log.length - shown.length),
    total: loggedMonths(log),
    count: log.length,
  };
}
