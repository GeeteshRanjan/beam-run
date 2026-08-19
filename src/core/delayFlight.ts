/**
 * The delay, flying from where it happened to where it is recorded.
 *
 * When an obstacle stops the player the simulation books two months, spends a
 * life and writes a line into the delay log in the top-right of the HUD. All
 * three of those were, until now, invisible at the moment they happened: the
 * heart went out and a row appeared in a panel a long way from the player's eyes,
 * which are on the hero. So the cost was reported in a place nobody was looking,
 * one frame after the thing that caused it.
 *
 * This is the missing connective tissue (owner call): the penalty is written on
 * the frame **at the place of death**, held there long enough to read, and then
 * carried up to the log panel — so "+2 MONTHS" and the obstacle's name arrive in
 * the ledger visibly, from the body they were taken off.
 *
 * Pure and headless on purpose. It is *presentation*, so it must never touch the
 * simulation, and everything it needs is (start point, end point, progress). That
 * also means the whole flight can be measured in a test without a canvas.
 *
 * Two things it deliberately is not:
 *  - It is not a straight line. A label sliding diagonally across a level reads as
 *    UI drifting; an arc reads as something being *carried*. `LIFT` is the height
 *    of that arc over the straight line, applied as a quadratic bezier.
 *  - It is not motion under `prefers-reduced-motion`. There the label simply holds
 *    at the place of death and fades, because the information ("this obstacle cost
 *    two months") is the part that matters and the journey is the juice.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * s of flight, start to finish.
 *
 * Bounded above by `LIVES.LOST_HOLD` (0.9s): after that beat the stage restarts
 * and its title card covers the frame, so anything still in the air is thrown
 * away unseen. 0.8 leaves a frame or two of margin.
 */
export const DELAY_FLIGHT_TIME = 0.8;

/**
 * Fraction of the flight spent held at the place of death before it sets off.
 *
 * This is what makes the label readable at all. Without it the text starts moving
 * on the frame it appears, which at 22 characters is a thing you notice rather
 * than a thing you read.
 */
const HOLD = 0.3;

/** px the arc rises above the straight line between the two points. */
const LIFT = 90;

export interface DelayFlightPose {
  x: number;
  y: number;
  /** 0..1, for the label's alpha. */
  alpha: number;
}

/** Ease in and out, so it accelerates away and settles into the panel. */
function ease(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
}

/**
 * Where the label is, and how solid, at `progress` (0..1) of its flight.
 *
 * `still` is `prefers-reduced-motion`: the label holds over the player and fades,
 * which keeps the message and drops the journey.
 */
export function delayFlightPose(
  from: Point,
  to: Point,
  progress: number,
  still = false,
): DelayFlightPose {
  const p = Math.max(0, Math.min(1, progress));
  // Fades over the last fifth, so it is at full strength while it is being read
  // and while it is travelling.
  const alpha = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
  if (still) return { x: from.x, y: from.y, alpha };

  if (p <= HOLD) {
    // Held, drifting up a little off the body: the same beat a value popup gets.
    return { x: from.x, y: from.y - 18 * (p / HOLD), alpha };
  }
  const u = ease((p - HOLD) / (1 - HOLD));
  const start = { x: from.x, y: from.y - 18 };
  // Quadratic bezier through a control point lifted above the midpoint.
  const cx = (start.x + to.x) / 2;
  const cy = (start.y + to.y) / 2 - LIFT;
  const m = 1 - u;
  return {
    x: m * m * start.x + 2 * m * u * cx + u * u * to.x,
    y: m * m * start.y + 2 * m * u * cy + u * u * to.y,
    alpha,
  };
}
