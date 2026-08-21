import { describe, it, expect } from 'vitest';
import { buildNotFoundHtml, createNotFoundBody } from './NotFoundPage';
import { COPY } from '../data/copy';
import { NOT_FOUND_COPY } from '../data/notFoundCopy';
import { LOGO_ORANGE } from './ansrMark';

const html = (): string => buildNotFoundHtml(document);

describe('custom 404 page', () => {
  it('is self-contained: no scripts and no external references', () => {
    const page = html();
    // A 404 is served for ANY unmatched path, including deep ones, so a relative
    // asset URL would resolve somewhere else entirely. Nothing may be fetched.
    expect(page).not.toContain('<script');
    expect(page).not.toContain('<link');
    expect(page).not.toContain('<img');
    expect(page).not.toContain('src=');
    // The one URL on the page is the route home.
    expect(page.match(/href="/g)).toHaveLength(1);
    expect(page).toContain('<style>');
    // The game's own stylesheet is inlined, not a lookalike.
    expect(page).toContain('.beam-run__stage');
    expect(page).toContain('.beam-run__btn');
  });

  it('ships a rule for every class it uses, including the ones the game stopped using', () => {
    /*
     * The page borrows the game's class names, so a rule deleted with its last *game*
     * caller silently unstyles a surface no other test looks at — this is a build-time
     * page, and it happened: `.beam-run__stake` / `--stake-figure` were the title
     * screen's three-line hook, the owner deleted the hook, and the 404's "404" was
     * left as unstyled bitmap art.
     *
     * So the check is mechanical: every `beam-run__` class this page puts in its markup
     * must appear as a selector in the stylesheet it inlines.
     */
    const page = html();
    const used = new Set<string>();
    for (const attr of page.match(/class="([^"]+)"/g) ?? []) {
      for (const cls of attr.slice(7, -1).split(/\s+/)) {
        if (cls.startsWith('beam-run__')) used.add(cls);
      }
    }
    expect(used.size).toBeGreaterThan(8);
    const css = page.slice(page.indexOf('<style>'), page.indexOf('</style>'));
    for (const cls of used) {
      // `beam-run__sr` and the rest are all real selectors; a missing one is a class
      // whose rules went with a screen that no longer exists.
      expect(css, cls).toContain(`.${cls}`);
    }
  });

  it('always offers a route back into the game', () => {
    const body = createNotFoundBody(document);
    const links = body.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('/');
    expect(links[0]!.textContent).toBe(NOT_FOUND_COPY.play);
    expect(links[0]!.className).toContain('beam-run__btn');

    const custom = createNotFoundBody(document, 'https://example.com/play');
    expect(custom.querySelector('a')!.getAttribute('href')).toBe('https://example.com/play');
  });

  it('reads as prose for assistive tech, with the bitmap art decorative', () => {
    const body = createNotFoundBody(document);
    const heading = body.querySelector('h1')!;
    expect(heading.textContent).toBe(NOT_FOUND_COPY.title);
    expect(body.textContent).toContain(NOT_FOUND_COPY.codeLabel);
    expect(body.textContent).toContain(NOT_FOUND_COPY.body);
    // Every SVG on the page is decorative — the lockup carries its own label.
    for (const svg of body.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    // One landmark only: <main>. The overlay is layout, not a dialog.
    expect(body.tagName).toBe('MAIN');
    expect(body.querySelector('[role="main"]')).toBeNull();
    expect(body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('carries the real ANSR lockup', () => {
    const body = createNotFoundBody(document);
    const brand = body.querySelector('.beam-run__brand')!;
    expect(brand.getAttribute('aria-label')).toContain(COPY.meta.name);
    expect(brand.getAttribute('aria-label')).toContain(COPY.meta.edition);
    const mark = brand.querySelector('path')!;
    expect(mark.getAttribute('fill')).toBe(LOGO_ORANGE);
    expect((mark.getAttribute('d') ?? '').length).toBeGreaterThan(500);
  });

  it('stands the hero and the barrier on the ground line, clear of the crop', () => {
    const scene = createNotFoundBody(document).querySelector('.beam-run__scene')!;
    const [, , w, h] = (scene.getAttribute('viewBox') ?? '').split(' ').map(Number);
    // Rect-only path data (M x y h w v h h -w z), so the strip stays pixel-crisp.
    const rects: Array<[number, number, number, number]> = [];
    for (const p of scene.querySelectorAll('path')) {
      const d = p.getAttribute('d') ?? '';
      expect(d).toMatch(/^(M-?\d+ -?\d+h-?\d+v-?\d+h-?\d+z)+$/);
      for (const m of d.matchAll(/M(-?\d+) (-?\d+)h(-?\d+)v(-?\d+)h-?\d+z/g)) {
        rects.push([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
      }
    }
    // Something sits exactly on the ground line, and nothing floats below it
    // except the ground band itself.
    const groundY = 240;
    expect(rects.some(([, y, , rh]) => y + rh === groundY)).toBe(true);
    expect(rects.every(([, y]) => y >= 0 && y < h!)).toBe(true);
    // The hero + barrier group lives in the left third: a narrow viewport scales
    // this strip by height and crops the right, so a centred group would be cut.
    const bright = rects.filter(([x, y]) => y < groundY && x < w! / 2);
    expect(bright.length).toBeGreaterThan(0);
  });

  it('is deterministic — the same page every build', () => {
    expect(html()).toBe(html());
  });
});
