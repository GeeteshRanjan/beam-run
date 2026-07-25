/**
 * The top-level game states and their legal transitions (Tech Architecture §4):
 *
 *   BOOT ──assets──▶ START ──start──▶ TITLE_CARD ──hold/skip──▶ PLAYING
 *   PLAYING ──reach exit──▶ TITLE_CARD (screens 0..4)
 *   PLAYING ──win trigger──▶ WIN
 *   WIN ──restart──▶ START
 *
 * There is deliberately **no DEATH and no GAMEOVER**. These hazards are the
 * buyer's live reality; the game never tells them they failed at it and never
 * walls them off from the closing hand-off. A hazard books months on the journey
 * clock (a *setback*, handled inside PLAYING with no state change) and the run
 * continues, so every player reaches the finale and the Navigator CTA.
 */
export type GameState = 'BOOT' | 'START' | 'TITLE_CARD' | 'PLAYING' | 'WIN';

export const GAME_TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  BOOT: ['START'],
  START: ['TITLE_CARD'],
  TITLE_CARD: ['PLAYING'],
  PLAYING: ['TITLE_CARD', 'WIN'],
  WIN: ['START'],
};
