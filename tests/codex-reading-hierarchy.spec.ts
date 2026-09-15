import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

test('Codex puts complete gameplay rules before collection records and keeps the journal reachable', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').root));
  const ids = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const cards = c.allCards(), length = (card: any) => [card.text, card.upgradedText, card.moltText, card.moltTextUpgraded].join(' ').length;
    const longest = [...cards].sort((a: any, b: any) => length(b) - length(a))[0].id;
    for (const id of ['pentacles_04', longest]) c.discovered.add(id);
    c.openCodexDetail('pentacles_04', false);
    return ['pentacles_04', longest];
  });
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('CodexScene').load.isLoading());
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  for (const id of ids) {
    await page.evaluate(id => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      if (id !== 'pentacles_04') c.cardJournal[id] = 'x'.repeat(240);
      c.openCodexDetail(id, false);
    }, id);
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${id}-rules-${size.width}.png`) });
      const geometry = await page.evaluate(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        const texts = c.root.list.filter((o: any) => o.type === 'Text');
        const heading = (name: string) => texts.find((o: any) => o.text === name);
        const effect = heading('EFFECT'), collection = heading('COLLECTION STATUS'), journal = heading('CARD JOURNAL');
        const rules = texts.filter((t: any) => t.x >= effect.x && t.y > effect.y && t.y < collection.y && parseInt(t.style.fontSize) === 20);
        return { effect: effect.y, collection: collection.y, journal: journal.y,
          before: heading('FLOCK STATS').y < collection.y,
          rules: rules.length, overflow: rules.filter((t: any) => t.getBounds().right > 1069 || t.style.resolution !== 2).length,
          sections: texts.filter((t: any) => ['EFFECT', 'MOLT ABILITY', 'COLLECTION STATUS', 'HOW TO ACQUIRE', 'CARD JOURNAL'].includes(t.text)).map((t: any) => t.text),
          noteSize: c.root.getByName('codex-card-journal-note').style.fontSize,
          noteWidth: c.root.getByName('codex-card-journal-note').width,
          noteText: c.root.getByName('codex-card-journal-note').text,
          detail: JSON.parse((window as any).render_game_to_text()).detailOpen };
      });
      expect(geometry.effect).toBeLessThan(220);
      expect(geometry.before).toBe(true); expect(geometry.collection).toBeGreaterThan(geometry.effect);
      expect(geometry.journal).toBeGreaterThan(geometry.collection); expect(geometry.rules).toBeGreaterThan(0);
      expect(geometry.overflow).toBe(0); expect(geometry.noteSize).toBe('18px'); expect(geometry.detail).toBe(id);
      expect(geometry.noteWidth).toBeLessThanOrEqual(494);
      if (id !== 'pentacles_04') expect(geometry.noteText).toBe('x'.repeat(240));
      expect(geometry.sections).toContain('HOW TO ACQUIRE');
    }
    // Wheel and keyboard still traverse the complete read-only record.
    await page.mouse.move(740, 290); await page.mouse.wheel(0, 480);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll > 0);
    const before = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScrollTarget);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScrollTarget)).toBeGreaterThan(before);
    await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const label = c.root.list.find((o: any) => o.type === 'Text' && o.text === 'CARD JOURNAL');
      c.detailScrollTarget = c.detailScroll = Math.min(c.detailMaxScroll, c.detailScroll + label.y - 92); c.renderAll();
    });
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`${id}-journal.png`) });
    await page.keyboard.press('j');
    await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').cardJournalInput));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('CodexScene').cardJournalInput);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
  expect(errors).toEqual([]);
});
