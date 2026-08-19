import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripLevelNotes } from './strip-level-notes';

const RAW = readFileSync(resolve(__dirname, '../src/data/levels.json'), 'utf8');

describe('stripping level authoring prose from the bundle', () => {
  const before = JSON.parse(RAW);
  const after = JSON.parse(stripLevelNotes(RAW));

  it('drops the prose humans read and nothing else', () => {
    // The authored file carries the brief; the bundle must not.
    expect(before.meta.notes).toBeTruthy();
    expect(after.meta.notes).toBeUndefined();
    expect(after.meta.conventions).toBeUndefined();
    expect(after.meta.structure).toBeUndefined();
    expect(after.meta.clock).toBeUndefined();
    for (const s of after.screens) {
      expect(s.note).toBeUndefined();
      expect(s.meaningTag).toBeUndefined();
      expect(s.badge?.note).toBeUndefined();
      expect(s.lift?.note).toBeUndefined();
    }
  });

  it('drops prose from inside the hazard arrays too', () => {
    // Anywhere a human can write in this file, the stripper has to be able to take it
    // back out. The hiring dragon's `note` was the one that got away: 700 characters
    // of design rationale on a hazard *entry* rather than on the screen, and it went
    // out to every host until this test existed.
    const entries = (doc: { screens: Record<string, unknown>[] }) =>
      doc.screens.flatMap((s) =>
        (['monsters', 'stamps', 'dragons', 'mummies'] as const).flatMap(
          (k) => (s[k] as Record<string, unknown>[] | undefined) ?? [],
        ),
      );
    const authored = entries(before);
    expect(authored.some((e) => typeof e.note === 'string')).toBe(true);
    expect(authored.some((e) => typeof e.zone === 'string')).toBe(true);
    for (const e of entries(after)) {
      expect(e.note).toBeUndefined();
      expect(e.zone).toBeUndefined();
    }
  });

  it('keeps the strings that are DRAWN, however prose-like they look', () => {
    // The dragon's taunts are painted on its fireballs, so they are content and not
    // notes. A stripper that cannot tell the difference silently blanks the screen's
    // argument.
    const dragon = after.screens.find((s: { hazard: string }) => s.hazard === 'dragon');
    expect(dragon.dragons[0].taunts).toEqual(
      before.screens.find((s: { hazard: string }) => s.hazard === 'dragon').dragons[0].taunts,
    );
    expect(dragon.dragons[0].name).toBeTruthy();
    expect(dragon.dragons[0].seed).toBeTruthy();
  });

  it('keeps every byte the engine actually reads', () => {
    expect(after.meta.grid).toEqual(before.meta.grid);
    expect(after.screens).toHaveLength(before.screens.length);
    for (const [i, s] of after.screens.entries()) {
      const b = before.screens[i];
      expect(s.id).toBe(b.id);
      expect(s.name).toBe(b.name);
      expect(s.hazard).toBe(b.hazard);
      expect(s.monthsBase).toBe(b.monthsBase);
      expect(s.spawn).toEqual(b.spawn);
      expect(s.exit).toEqual(b.exit);
      expect(s.winTrigger).toEqual(b.winTrigger);
      // Only the title card survives: the other lines are mirrors of COPY.
      expect(s.copy?.titleCard).toBe(b.copy?.titleCard);
      expect(s.copy?.onClear).toBeUndefined();
      expect(s.lift?.gx).toBe(b.lift?.gx);
      // Geometry is untouched apart from the documentation-only `role`.
      expect(s.solids.map((r: { gx: number }) => r.gx)).toEqual(
        b.solids.map((r: { gx: number }) => r.gx),
      );
      // The badge is a pickup, so everything about its position survives.
      if (b.badge) expect(s.badge).toMatchObject({ type: b.badge.type, gx: b.badge.gx, gy: b.badge.gy });
    }
  });

  it('keeps the roles Screen.ts branches on, and drops the rest', () => {
    const roles = (screens: { solids: { role?: string }[] }[]) =>
      screens.flatMap((s) => s.solids.map((r) => r.role).filter(Boolean));
    expect(roles(before.screens).length).toBeGreaterThan(roles(after.screens).length);
    /*
     * Two roles survive, because two are read at runtime: `noncollide` (`Screen` skips
     * those rects) and `pedestal` (the renderer paints that solid as its screen's own
     * prop rather than as level material — the bricks the badge is dropped onto). Every
     * other role is a note to the next author and goes.
     */
    const kept = ['noncollide', 'pedestal'];
    for (const role of roles(after.screens)) {
      expect(kept.some((k) => role!.includes(k)), `role "${role}" survived`).toBe(true);
    }
    for (const k of kept) {
      expect(roles(after.screens).some((r) => r!.includes(k)), `no ${k} kept`).toBe(true);
    }
  });

  it('is smaller — that is the whole point', () => {
    expect(stripLevelNotes(RAW).length).toBeLessThan(RAW.length * 0.6);
  });
});
