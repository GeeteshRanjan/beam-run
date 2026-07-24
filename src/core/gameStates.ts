/**
 * The top-level game states and their legal transitions (Tech Architecture §4):
 *
 *   BOOT ──assets──▶ START ──start──▶ TITLE_CARD ──hold/skip──▶ PLAYING
 *   PLAYING ──reach exit──▶ TITLE_CARD (screens 0..4)
 *   PLAYING ──win trigger──▶ WIN
 *   PLAYING ──death, lives>0──▶ DEATH ──▶ PLAYING (respawn)
 *   PLAYING/DEATH ──death, lives==0──▶ GAMEOVER
 *   GAMEOVER/WIN ──restart──▶ START
 */
export type GameState =
  | 'BOOT'
  | 'START'
  | 'TITLE_CARD'
  | 'PLAYING'
  | 'DEATH'
  | 'GAMEOVER'
  | 'WIN';

export const GAME_TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  BOOT: ['START'],
  START: ['TITLE_CARD'],
  TITLE_CARD: ['PLAYING'],
  PLAYING: ['TITLE_CARD', 'DEATH', 'WIN'],
  DEATH: ['PLAYING', 'GAMEOVER'],
  GAMEOVER: ['START'],
  WIN: ['START'],
};
