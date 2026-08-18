/**
 * Copy for the custom not-found page.
 *
 * It lives apart from `COPY` for one reason: `src/ui/NotFoundPage.ts` is
 * build-time only (rendered once into `dist-site/404.html`, never imported by the
 * game), but `COPY` is a single object literal the game *does* import — so
 * keeping these strings in it shipped the 404 page's wording to every host that
 * embeds the game. Same rule as ever, no hardcoded strings in UI code; just a
 * module the bundle has no reason to reach.
 *
 * The page exists because the two Navigator routes (the title screen's "Skip to
 * the Navigator" and the closing receipt) deep-link a path the static host does
 * not serve, so the last thing a prospect saw was the host's raw 404. A dead end
 * is a dead end whoever renders it, so the page is ours: same cabinet, same
 * bitmap type, one route back.
 */
export const NOT_FOUND_COPY = {
  pageTitle: 'Page not found \u2014 ANSRcade: The GCC Game',
  /** Big arcade figure. */
  code: '404',
  /** Accessible sentence behind the figure. */
  codeLabel: 'Error 404. Page not found.',
  title: 'Off the map.',
  body: 'This route is not part of the journey. The game is one press away.',
  play: 'Back to the game',
} as const;
