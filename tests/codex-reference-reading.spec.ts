import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { codexGlossaryTerms } from '../src/game/codex-glossary';
import { KEYWORDS, keywordIconId } from '../src/game/keyword-definitions';

test.use({ hasTouch: true });

async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.addInitScript(() => localStorage.setItem('birdsquad.screenReader', 'on'));
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return Boolean(c.codexData) && c.glossaryTerms.every((term: any) => c.textures.exists(`ui-icon-${term.icon}`));
  });
}

test('Codex glossary contains every canonical contextual definition exactly once', () => {
  const names = codexGlossaryTerms.map(term => term.term);
  expect(new Set(names).size).toBe(names.length);
  expect(codexGlossaryTerms.every(term => term.summary.trim() && term.detail.trim() && term.icon.trim())).toBe(true);
  for (const [term, definition] of Object.entries(KEYWORDS)) {
    expect(codexGlossaryTerms.find(entry => entry.term === term)).toMatchObject({
      detail: definition.def,
      icon: keywordIconId(term),
    });
  }
});

test('all enemy and glossary tiles fit readable text without frame clutter', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const errors: string[] = []; let count = 0;
    for (const [kind, entries] of [['enemy', c.allCodexEnemies()], ['glossary', c.glossaryTerms]] as const) {
      for (const entry of entries) {
        c.root.removeAll(true);
        if (kind === 'enemy') c.renderEnemyThumb(c.root, entry, 640, 360);
        else c.renderGlossaryEntry(c.root, entry, 640, 360, 556, 138);
        const tile = c.root.getByName(`codex-${kind}-tile`), bounds = tile.getByName('codex-entry-hit').getBounds();
        const texts = tile.list.filter((n: any) => n.type === 'Text' && n.name !== 'codex-entry-fallback');
        for (const n of texts) {
          const b = n.getBounds(), full = n.getData('fullText');
          if (n.style.resolution !== 2 || n.style.maxLines || b.left < bounds.left + 12 || b.right > bounds.right - 12
            || b.top < bounds.top + 12 || b.bottom > bounds.bottom - 12) errors.push(`${entry.id ?? entry.term}: bounds`);
          if (n.text !== full && (!n.text.endsWith('…') || !full.startsWith(n.text.slice(0, -1)))) errors.push('silent clipping');
          for (const other of texts) {
            if (other === n) continue;
            const a = other.getBounds();
            if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) errors.push('overlap');
          }
        }
        if (tile.getByName('codex-entry-summary').style.fontSize !== '18px') errors.push('summary too small');
        if (kind === 'enemy' && entry.source === 'reserve' && !tile.getByName('codex-entry-meta').text.startsWith('Concept')) errors.push('reserve identity lost');
        if (kind === 'enemy' && entry.typeHint === 'Boss' && !tile.getByName('codex-entry-summary').text.includes('tactics observed')) errors.push('boss progress lost');
        if (kind === 'glossary') {
          const icon = tile.getByName('codex-glossary-icon'), b = icon?.getBounds();
          if (!icon || icon.texture?.key !== `ui-icon-${entry.icon}` || !b || b.left < bounds.left + 12
            || b.right > bounds.right - 12 || b.top < bounds.top + 12 || b.bottom > bounds.bottom - 12) errors.push(`${entry.term}: icon`);
        }
        if (tile.list.some((n: any) => n.name === 'codex-entry-frame')) errors.push('frame clutter');
        count++;
      }
    }
    return { count, errors };
  });
  expect(result.count).toBe(115); expect(result.errors).toEqual([]);
});

test('enemy and glossary grids keep deep focus, loaded art and detail return across viewports', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  for (const section of ['enemies', 'glossary']) {
    await page.evaluate(section => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeSection = section; c.activeEnemyTab = 0; c.focusZone = 'entries';
      c.entryFocusIndex = 0; c.gridScroll = c.gridScrollTarget = 0; c.renderAll();
    }, section);
    for (const index of section === 'enemies' ? [0, 40, 80] : [0, 17, 33]) {
      await page.evaluate(index => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        c.entryFocusIndex = index; c.ensureFocusedEntryVisible(); c.gridScroll = c.gridScrollTarget; c.renderAll();
      }, index);
      if (section === 'enemies') await page.waitForFunction(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        const walk = (n: any): any[] => (n.list ?? []).flatMap((child: any) => [child, ...walk(child)]);
        const tiles = walk(c.root).filter((n: any) => n.name === 'codex-enemy-tile');
        const shape = c.codexGridShape();
        return tiles.length && tiles.filter((t: any) => {
          const b = t.getByName('codex-entry-hit').getBounds(); return b.bottom > shape.top && b.top < shape.bottom;
        }).every((t: any) => Boolean(t.getByName('codex-entry-art')));
      });
      for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
        await page.setViewportSize(size); await settleCanvas(page);
        await page.screenshot({ path: info.outputPath(`${section}-${index}-${size.width}.png`) });
      }
      const selected = await page.evaluate(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        const entry = c.codexFocusEntries()[c.entryFocusIndex], geometry = c.entryFocusGeometry();
        const tile = c.gridLayer.list.find((n: any) => n.getData('id') === entry.id), b = tile.getByName('codex-entry-hit').getBounds();
        return { id: entry.id, scroll: c.gridScroll, x: b.centerX, y: b.centerY, geometry, top: b.top, bottom: b.bottom,
          topFades: c.root.list.filter((n: any) => n.name === 'codex-grid-top-fade-strip').length, shape: c.codexGridShape() };
      });
      expect(selected.geometry.x).toBeCloseTo(selected.x); expect(selected.geometry.y).toBeCloseTo(selected.y);
      expect(selected.top).toBeGreaterThanOrEqual(selected.shape.top); expect(selected.bottom).toBeLessThanOrEqual(selected.shape.bottom);
      expect(selected.topFades).toBe(index > 0 ? 8 : 0);
      await page.keyboard.press('Enter');
      await page.waitForFunction(id => JSON.parse((window as any).render_game_to_text()).detailOpen === id, selected.id);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
      expect(await page.evaluate(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); return { index: c.entryFocusIndex, scroll: c.gridScroll };
      })).toEqual({ index, scroll: selected.scroll });
    }
  }
  expect(errors).toEqual([]);
});

test('all glossary definitions are complete, readable and announced through real input', async ({ page }, info) => {
  await boot(page);
  await page.setViewportSize({ width: 1000, height: 560 });
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    c.activeSection = 'glossary'; c.entryFocusIndex = 0; c.focusZone = 'entries'; c.renderAll();
  });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => document.getElementById('game-status')?.textContent ?? '')).toContain('If Cohesion reaches 0');
  await page.keyboard.press('Escape');
  const terms = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').glossaryTerms);
  for (const term of terms) {
    await page.evaluate(term => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.openCodexDetail(term.term);
    }, term);
    const result = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), reader = c.root.getByName('codex-glossary-reader');
      const texts = reader.list.filter((n: any) => n.type === 'Text'), definition = reader.getByName('codex-glossary-definition');
      const icon = reader.getByName('codex-glossary-detail-icon');
      return { definition: definition.text, size: definition.style.fontSize, errors: texts.flatMap((n: any, i: number) =>
        n.style.maxLines || n.style.resolution !== 2 || n.getBounds().right > 1024 || (i && n.y < texts[i - 1].getBounds().bottom) ? [n.name] : []),
        icon: icon?.getData('icon'), iconTexture: icon?.texture?.key,
        bottom: definition.getBounds().bottom - c.detailMaxScroll };
    });
    expect(result.definition).toBe(term.detail); expect(result.size).toBe('22px'); expect(result.errors).toEqual([]);
    expect(result.icon).toBe(term.icon); expect(result.iconTexture).toBe(`ui-icon-${term.icon}`); expect(result.bottom).toBeLessThanOrEqual(568);
    await page.keyboard.press('Escape');
  }
  // Pointer and touch both open a definition from its visible tile.
  for (const touch of [false, true]) {
    const point = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.entryFocusIndex = 0; c.gridScroll = c.gridScrollTarget = 0; c.renderAll();
      const b = c.gridLayer.list[0].getByName('codex-entry-hit').getBounds(), canvas = document.querySelector('canvas')!.getBoundingClientRect();
      return { x: canvas.x + b.centerX * canvas.width / 1280, y: canvas.y + b.centerY * canvas.height / 720 };
    });
    if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).detailOpen === 'Cohesion');
    await settleCanvas(page); await page.screenshot({ path: info.outputPath(`glossary-detail-${touch ? 'touch' : 'pointer'}-1000.png`) });
    await page.keyboard.press('Escape');
  }
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.focusZone = 'entries';
    c.input.gamepad.emit('down', c.input.gamepad.pad1, { index: 0 }, 1);
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).detailOpen === 'Cohesion');
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); c.input.gamepad.emit('down', c.input.gamepad.pad1, { index: 1 }, 1);
  });
  await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
});

test('long glossary definitions page with keyboard wheel and touch without changing saved progress', async ({ page }, info) => {
  await boot(page);
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const term = c.glossaryTerms[0];
    term.detail = 'A long definition must remain complete and readable without reducing its type size. '.repeat(40) + 'FINAL DEFINITION SENTENCE.';
    c.activeSection = 'glossary'; c.openCodexDetail(term.term);
  });
  for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(size); await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`long-glossary-${size.width}.png`) });
  }
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll > 0);
  await page.mouse.move(600, 320); await page.mouse.wheel(0, 200);
  for (let i = 0; i < 20; i++) {
    const point = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const hit = c.root.getByName('codex-glossary-scroll-more');
      if (!hit?.input?.enabled) return null;
      const b = document.querySelector('canvas')!.getBoundingClientRect();
      return { x: b.x + hit.x * b.width / 1280, y: b.y + hit.y * b.height / 720, height: hit.height * b.height / 720 };
    });
    if (!point) break;
    expect(point.height).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(point.x, point.y); await settleCanvas(page);
  }
  await page.waitForFunction(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); return c.detailScroll >= c.detailMaxScroll - 1;
  });
  const end = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const n = c.root.getByName('codex-glossary-reader').getByName('codex-glossary-definition');
    return { text: n.text, bottom: n.getBounds().bottom, size: n.style.fontSize };
  });
  expect(end.text.endsWith('FINAL DEFINITION SENTENCE.')).toBe(true); expect(end.bottom).toBeLessThanOrEqual(569); expect(end.size).toBe('22px');
  await page.screenshot({ path: info.outputPath('long-glossary-end-1000.png') });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
});
