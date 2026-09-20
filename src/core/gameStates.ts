/**
 * The top-level game states and their legal transitions (Tech Architecture §4):
 *
 *   BOOT ──assets──▶ START ──start──▶ TITLE_CARD ──press──▶ PLAYING
 *   PLAYING ──reach exit──▶ SCREEN_CLEAR ──press──▶ TITLE_CARD (screens 0..4)
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
/**
 * `TITLE_CARD` is the **briefing between two screens** (owner call), and it is the
 * one state in the middle of a run that cannot time out: it names the stage the
 * player is about to enter, says in one line what is in it, and waits for a
 * deliberate press (`Simulation.requestAdvance`). Nothing is simulated while it is
 * up, so a stage never starts while somebody is still reading about it.
 */
/**
 * `SCREEN_CLEAR` is the **first half of every transition** (owner call: "every
 * transition screen needs to be 2 screens instead of just 1 — one congratulations for
 * clearing the level, and the second information about the next level").
 *
 * It waits exactly like `TITLE_CARD` does, and it sits *before* the next screen is
 * loaded — which is the one thing about it that is load-bearing. `clearScreen()` used
 * to call `loadScreen(next)` and then put a card up, so anything reading `screenId`
 * while a card was on screen was already looking at the stage ahead. A card that
 * congratulates you has to name the stage **behind**, so the load moves to the press
 * that leaves this state (`Simulation.requestAdvance`) and `clearedScreenId` is what
 * the card is drawn from.
 *
 * It is not entered on the last screen: `finishRun()` goes straight to `WIN`, because a
 * congratulations card in front of the win receipt is the receipt's own headline said
 * twice, a press apart.
 */
export type GameState =
  | 'BOOT'
  | 'START'
  | 'TITLE_CARD'
  | 'PLAYING'
  | 'SCREEN_CLEAR'
  | 'LIFE_LOST'
  | 'WIN';

export const GAME_TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  BOOT: ['START'],
  START: ['TITLE_CARD'],
  TITLE_CARD: ['PLAYING'],
  PLAYING: ['SCREEN_CLEAR', 'LIFE_LOST', 'WIN'],
  SCREEN_CLEAR: ['TITLE_CARD'],
  LIFE_LOST: ['TITLE_CARD', 'START'],
  WIN: ['START'],
};
