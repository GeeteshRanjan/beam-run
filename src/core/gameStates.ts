/**
 * The top-level game states and their legal transitions (Tech Architecture §4):
 *
 *   BOOT ──assets──▶ START ──start──▶ TITLE_CARD ──hold/skip──▶ PLAYING
 *   PLAYING ──reach exit──▶ TITLE_CARD (screens 0..4)
 *   PLAYING ──hazard──▶ LIFE_LOST ──lives remain──▶ TITLE_CARD (same screen)
 *   LIFE_LOST ──last life──▶ START
 *   PLAYING ──win trigger──▶ WIN
 *   WIN ──restart──▶ START
 *
 * `LIFE_LOST` is one screen doing two jobs, told apart by the lives remaining:
 * with lives left it is the coaching beat ("take the ANSR badge and this stops
 * happening") and it restarts the stage the player was already on, so ground
 * covered is never taken away. On the last life it becomes the closing ledger —
 * every delay, what it cost, and the route to the Navigator — and hands back to
 * the title screen. Either way it is never a dead end and never blames the
 * player: the months are charged to the obstacle, by name.
 *
 * Note what this is NOT: there is still no state in which the player is walled
 * off from the hand-off. A run that ends out of lives ends on a conversion
 * surface, exactly like a run that reaches the Tech Park.
 */
export type GameState = 'BOOT' | 'START' | 'TITLE_CARD' | 'PLAYING' | 'LIFE_LOST' | 'WIN';

export const GAME_TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  BOOT: ['START'],
  START: ['TITLE_CARD'],
  TITLE_CARD: ['PLAYING'],
  PLAYING: ['TITLE_CARD', 'LIFE_LOST', 'WIN'],
  LIFE_LOST: ['TITLE_CARD', 'START'],
  WIN: ['START'],
};
