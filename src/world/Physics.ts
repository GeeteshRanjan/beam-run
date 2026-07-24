/**
 * Physics — axis-separated AABB integration and collision resolution.
 *
 * Movement is subdivided so no single sub-step exceeds `MAX_STEP` pixels, which
 * guarantees a fast-moving body can never tunnel through a solid (even at
 * MAX_FALL_SPEED). Each sub-step resolves the X axis then the Y axis
 * independently — the standard platformer approach that avoids corner snags and
 * lets us report ground/ceiling/wall contact cleanly.
 *
 * No DOM/canvas dependency: fully headless and deterministic.
 */

export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hitCeiling: boolean;
  hitWall: boolean;
}

/** Largest displacement resolved in a single sub-step (px). */
export const MAX_STEP = 8;

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True if `box`, nudged 1px down, rests on any solid. Drives coyote-time. */
export function isOnGround(box: AABB, solids: readonly AABB[]): boolean {
  const probe: AABB = { x: box.x, y: box.y + 1, w: box.w, h: box.h };
  for (const s of solids) {
    // Only count solids whose top is at/below the box bottom (standing on top).
    if (aabbOverlap(probe, s) && box.y + box.h <= s.y + 1) return true;
  }
  return false;
}

/**
 * Integrate a body by (vx, vy) over `dt` against static solids.
 * `box` is not mutated; the resolved position is returned.
 */
export function moveAndCollide(
  box: AABB,
  vx: number,
  vy: number,
  dt: number,
  solids: readonly AABB[],
  maxStep = MAX_STEP,
): MoveResult {
  let { x, y } = box;
  const { w, h } = box;
  const dx = vx * dt;
  const dy = vy * dt;

  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  const subSteps = Math.max(1, Math.ceil(dist / maxStep));
  const stepX = dx / subSteps;
  const stepY = dy / subSteps;

  let onGround = false;
  let hitCeiling = false;
  let hitWall = false;

  for (let i = 0; i < subSteps; i += 1) {
    // --- X axis ---
    x += stepX;
    if (stepX !== 0) {
      for (const s of solids) {
        const cur: AABB = { x, y, w, h };
        if (!aabbOverlap(cur, s)) continue;
        if (stepX > 0) {
          x = s.x - w; // moving right → push to solid's left face
        } else {
          x = s.x + s.w; // moving left → push to solid's right face
        }
        vx = 0;
        hitWall = true;
      }
    }

    // --- Y axis ---
    y += stepY;
    if (stepY !== 0) {
      for (const s of solids) {
        const cur: AABB = { x, y, w, h };
        if (!aabbOverlap(cur, s)) continue;
        if (stepY > 0) {
          y = s.y - h; // moving down → land on top
          onGround = true;
        } else {
          y = s.y + s.h; // moving up → bonk ceiling
          hitCeiling = true;
        }
        vy = 0;
      }
    }
  }

  // Final ground check (covers the resting/zero-velocity case too).
  if (!onGround && isOnGround({ x, y, w, h }, solids)) {
    onGround = true;
  }

  return { x, y, vx, vy, onGround, hitCeiling, hitWall };
}
