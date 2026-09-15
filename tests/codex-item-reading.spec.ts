import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
test.use({ hasTouch: true });

async function bootCodex(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').root));
}

test('Codex item and enemy reading surfaces', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (/not supported in WebGL/.test(message.text())) errors.push(message.text()); });
  await bootCodex(page);
  const samples = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const longest = (items: any[]) => [...items].sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0];
    return [
      { section: 'items', id: longest(c.allSupplies()).id },
      { section: 'items', id: longest(c.allWaymarks()).id },
      { section: 'enemies', id: c.allCodexEnemies().find((e: any) => e.typeHint === 'Boss' && e.source === 'encounter').id },
      { section: 'enemies', id: 'roof_rat' },
      { section: 'enemies', id: c.allCodexEnemies().find((e: any) => e.source === 'reserve').id },
    ];
  });
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  for (const sample of samples) {
    await page.evaluate(sample => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeSection = sample.section; c.openCodexDetail(sample.id, false);
    }, sample);
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('CodexScene').load.isLoading());
    await page.waitForFunction(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), art = c.currentDetailArtAsset();
      return art && c.textures.exists(art.key);
    });
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${sample.id}-${size.width}.png`) });
    }
    const geometry = await page.evaluate(sample => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const reader = c.root.getByName('codex-item-reader');
      const nodes = (reader?.list ?? c.root.list).filter((n: any) => n.type === 'Text' && n.x === (reader ? 440 : 580));
      const rule = nodes.find((n: any) => reader ? n.name === 'codex-item-rules' : n.style.fontSize === '20px');
      const kit = nodes.find((n: any) => n.text.startsWith('COMBAT KIT') || n.text === 'MOVE KIT');
      const lore = nodes.find((n: any) => n.text === 'FIELD NOTE');
      return { ruleSize: rule.style.fontSize, max: c.detailMaxScroll,
        overflow: nodes.filter((n: any) => n.getBounds().right > (reader ? 1069 : 1099)).map((n: any) => n.text),
        kitFirst: !kit || kit.y < lore.y,
        frames: c.root.list.filter((n: any) => ['codex-dossier-frame', 'codex-art-preview-frame'].includes(n.name)).length,
        masked: sample.section !== 'items' || Boolean(c.root.getByName('codex-item-reader-clip-top') && c.root.getByName('codex-item-reader-clip-bottom')),
        art: Boolean(c.root.getByName(sample.section === 'items' ? 'codex-item-dossier-art' : 'codex-enemy-dossier-art')) };
    }, sample);
    expect(geometry.ruleSize).toBe('20px'); expect(geometry.overflow).toEqual([]);
    expect(geometry.kitFirst).toBe(true); expect(geometry.frames).toBe(0);
    expect(geometry.masked).toBe(true); expect(geometry.art).toBe(true);
    if (geometry.max > 0) {
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll > 0);
      await page.mouse.move(600, 300); await page.mouse.wheel(0, 700);
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll > 0);
      await page.evaluate(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        c.detailScrollTarget = c.detailScroll = c.detailMaxScroll; c.renderAll();
      });
      await settleCanvas(page); await page.screenshot({ path: info.outputPath(`${sample.id}-end-1000.png`) });
      if (sample.section === 'items') {
        const back = await page.evaluate(() => {
          const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
          const hit = c.root.getByName('codex-item-scroll-back'), b = document.querySelector('canvas')!.getBoundingClientRect();
          return { x: b.x + hit.x * b.width / 1280, y: b.y + hit.y * b.height / 720 };
        });
        await page.touchscreen.tap(back.x, back.y);
        await page.waitForFunction(() => {
          const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'); return c.detailScroll < c.detailMaxScroll;
        });
      }
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
  expect(errors).toEqual([]);
});

test('every Supply and Waymark has complete measured rules and a reachable final section', async ({ page }) => {
  await bootCodex(page);
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const errors: string[] = []; let count = 0;
    for (const [kind, items] of [['Supply', c.allSupplies()], ['Waymark', c.allWaymarks()]] as const) {
      for (const item of items) {
        c.detailScrollTarget = c.detailScroll = 0; c.root.removeAll(true);
        if (kind === 'Supply') c.renderSupplyDetail(item.id); else c.renderWaymarkDetail(item.id);
        const reader = c.root.getByName('codex-item-reader'), texts = reader.list.filter((n: any) => n.type === 'Text');
        if (reader.getByName('codex-item-title').text !== item.name) errors.push(`${item.id}: title`);
        const effect = reader.getByName(kind === 'Supply' ? 'codex-item-use' : 'codex-item-effect');
        if (effect.text !== item.description) errors.push(`${item.id}: description`);
        const rules = reader.getByName('codex-item-rules');
        if (!rules?.text || /->|\b\w+\([^)]*\)/.test(rules.text)) errors.push(`${item.id}: unformatted rules`);
        for (let i = 0; i < texts.length; i++) {
          const t = texts[i];
          if (t.style.maxLines > 0 || t.getBounds().right > 1069 || t.style.resolution !== 2) errors.push(`${item.id}: clipping`);
          if (i && t.y < texts[i - 1].getBounds().bottom) errors.push(`${item.id}: overlap`);
        }
        if (texts.at(-1).getBounds().bottom - c.detailMaxScroll > 608) errors.push(`${item.id}: unreachable end`);
        count++;
      }
    }
    return { count, errors };
  });
  expect(result.count).toBe(89); expect(result.errors).toEqual([]);
});

test('long item titles and rules remain readable with touch paging and do not consume the Supply', async ({ page }, info) => {
  await bootCodex(page); await page.setViewportSize({ width: 1000, height: 560 }); await settleCanvas(page);
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const supply = c.allSupplies().find((s: any) => s.id === 'market_iou');
    supply.name = 'A lengthy translated Supply title that must wrap without covering its metadata or close button';
    supply.description = `${'A complete, deliberately long reading fixture. '.repeat(35)}Final rule remains available.`;
    c.activeSection = 'items'; c.openCodexDetail(supply.id, false);
  });
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('CodexScene').load.isLoading());
  await settleCanvas(page); await page.screenshot({ path: info.outputPath('long-item-top-1000.png') });
  for (let i = 0; i < 20; i++) {
    const next = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const hit = c.root.getByName('codex-item-scroll-more');
      if (!hit?.input?.enabled) return null;
      const b = document.querySelector('canvas')!.getBoundingClientRect();
      return { x: b.x + hit.x * b.width / 1280, y: b.y + hit.y * b.height / 720, height: hit.height * b.height / 720 };
    });
    if (!next) break;
    expect(next.height).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(next.x, next.y);
    await page.waitForFunction(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return Math.abs(c.detailScroll - c.detailScrollTarget) < 1;
    });
  }
  const end = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return { id: c.detailId, atEnd: c.detailScroll >= c.detailMaxScroll - 1,
      packingBottom: c.root.getByName('codex-item-reader').getByName('codex-item-packing').getBounds().bottom };
  });
  expect(end.id).toBe('market_iou'); expect(end.atEnd).toBe(true); expect(end.packingBottom).toBeLessThanOrEqual(609);
  await page.screenshot({ path: info.outputPath('long-item-end-1000.png') });
  const close = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const hit = c.root.getByName('codex-detail-close-hit'), b = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: b.x + hit.x * b.width / 1280, y: b.y + hit.y * b.height / 720 };
  });
  await page.touchscreen.tap(close.x, close.y);
  await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
});

test('all enemy dossiers preserve complete known moves and measured text', async ({ page }) => {
  await bootCodex(page);
  await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    c.activeSection = 'enemies'; c.openCodexDetail('roof_rat', false);
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const errors: string[] = [], enemies = c.allCodexEnemies();
    for (const enemy of enemies) {
      c.detailScrollTarget = c.detailScroll = 0; c.root.removeAll(true); c.renderEnemyDetail(enemy.id);
      const texts = c.root.list.filter((n: any) => n.type === 'Text' && n.x === 580);
      const dossier = c.codexBossView(enemy);
      const actual = texts.filter((n: any) => n.style.fontSize === '20px').map((n: any) => n.text);
      const revealed = dossier.rows.filter((r: any) => r.revealed).map((r: any) => r.text);
      if (revealed.some((t: string) => !actual.includes(t))) errors.push(`${enemy.id}: missing move`);
      const hidden = dossier.total - dossier.observed;
      if (hidden && !actual.includes(`${hidden} Undocumented tactic${hidden === 1 ? '' : 's'} · Face this boss to reveal.`)) errors.push(`${enemy.id}: hidden count`);
      for (let i = 0; i < texts.length; i++) {
        const t = texts[i];
        if (t.style.maxLines > 0 || t.getBounds().right > 1099 || t.style.resolution !== 2) errors.push(`${enemy.id}: clipping`);
        if (i && t.y < texts[i - 1].getBounds().bottom) errors.push(`${enemy.id}: overlap`);
      }
      if (texts.at(-1).getBounds().bottom - c.detailMaxScroll > 608) errors.push(`${enemy.id}: unreachable end`);
    }
    return { count: enemies.length, errors };
  });
  expect(result.count).toBe(81); expect(result.errors).toEqual([]);
});

test('enemy rule descriptions retain effects beyond the old three-effect excerpt', async ({ page }) => {
  await bootCodex(page);
  const text = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    return c.runtimeEnemyEntry({ id: 'roof_rat', name: 'Reading fixture', type: 'normal', health: 20,
      description: '', silhouette: '', visualBrief: '', artPose: '',
      moves: [{ id: 'extended', label: 'Extended chain', effects: Array(12).fill('gainCover(1)') }],
    }).moveKit[0].text;
  });
  expect(text).toBe(`Extended chain: ${Array(12).fill('Gain 1 Cover.').join(' ')}`);
});
