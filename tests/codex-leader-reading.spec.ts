import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
test.use({ hasTouch: true });

test('text-led collection navigation stays readable and touch-operable in every section', async ({ page }, info) => {
  await boot(page);
  for (const section of ['cards', 'items', 'leaders', 'enemies', 'glossary']) {
    await page.evaluate(section => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeSection = section; c.detailId = undefined; c.renderAll();
    }, section);
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${section}-${size.width}.png`) });
      const geometry = await page.evaluate(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        const tabs = c.root.list.filter((n: any) => n.name === 'codex-tab-surface');
        const scale = document.querySelector('canvas')!.getBoundingClientRect().height / 720;
        const title = c.root.list.find((n: any) => n.type === 'Text' && n.text === 'Codex');
        return { titleRight: title.getBounds().right, count: tabs.length, errors: tabs.flatMap((tab: any) => {
          const label = c.root.list.find((n: any) => n.type === 'Text' && n.text === tab.getData('label') && n.x === tab.x && n.y === tab.y - 8);
          const hit = c.root.list.find((n: any) => n.name === 'codex-tab-hit' && n.x === tab.x && n.y === tab.y);
          return !label || label.width > tab.width - 6 || !hit?.input?.enabled || hit.height * scale < 44 ? [tab.getData('label')] : [];
        }), frames: c.root.list.filter((n: any) => n.name === 'codex-tab-frame').length };
      });
      expect(geometry.titleRight).toBeLessThanOrEqual(138);
      expect(geometry.count).toBeGreaterThanOrEqual(5); expect(geometry.errors).toEqual([]); expect(geometry.frames).toBe(0);
    }
    const next = await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      const hit = c.root.list.find((n: any) => n.name === 'codex-tab-hit' && n.getData('label') === 'Cards');
      const b = document.querySelector('canvas')!.getBoundingClientRect();
      return { x: b.x + hit.x * b.width / 1280, y: b.y + hit.y * b.height / 720 };
    });
    await page.touchscreen.tap(next.x, next.y);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').activeSection === 'cards');
  }
});

async function boot(page: Page) {
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('CodexScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('CodexScene');
  });
  await page.waitForFunction(() => Boolean((window as any).__birdSquadGame.scene.getScene('CodexScene').codexData));
}

test('all leader dossiers preserve complete gameplay and lore in measured reading order', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
    const errors: string[] = [], leaders = c.allLeaders();
    const saved = localStorage.getItem('birdsquad.account'); let count = 0;
    try {
      for (const unlockAll of [false, true]) {
        const account = JSON.parse(saved ?? '{}');
        account.unlockedLeaders = unlockAll ? leaders.map((l: any) => l.id) : [];
        localStorage.setItem('birdsquad.account', JSON.stringify(account));
        // Let the existing journal migration normalize this synthetic account
        // before asserting that subsequent reads do not change persisted data.
        c.root.removeAll(true); c.renderLeaderDetail(leaders[0].id);
        const before = JSON.stringify(localStorage);
        for (const leader of leaders) {
          c.detailScrollTarget = c.detailScroll = 0; c.root.removeAll(true); c.renderLeaderDetail(leader.id);
          const reader = c.root.getByName('codex-leader-reader'), texts = reader.list;
          const node = (name: string) => reader.getByName(`codex-leader-${name}`);
          const lore = c.codexData.getLeaderLore(leader.id);
          if (node('title').text !== leader.name || node('signature').text !== `${leader.signatureName}: ${leader.signatureText}`
            || node('combat-read').text !== lore.playstyleRead || node('backstory').text !== lore.backstory
            || node('narrative-beats').text !== lore.narrativeBeats.map((b: string) => `· ${b}`).join('\n\n')) errors.push(`${leader.id}: incomplete content`);
          if (node('starting-deck').y > node('backstory').y) errors.push(`${leader.id}: hierarchy`);
          if (node('signature').style.fontSize !== '20px') errors.push(`${leader.id}: rules size`);
          const locked = node('meta').text.endsWith('Locked');
          if (locked && !node('how-to-unlock')?.text) errors.push(`${leader.id}: unlock instructions`);
          if (!locked && node('field-quote')?.text !== `"${lore.quote}"`) errors.push(`${leader.id}: quote`);
          for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            if (t.style.maxLines > 0 || t.getBounds().right > 1099 || t.style.resolution !== 2) errors.push(`${leader.id}: clipping`);
            if (i && t.y < texts[i - 1].getBounds().bottom) errors.push(`${leader.id}: overlap`);
          }
          if (texts.at(-1).getBounds().bottom - c.detailMaxScroll > 609) errors.push(`${leader.id}: unreachable end`);
          if (c.root.list.some((n: any) => ['codex-dossier-frame', 'codex-art-preview-frame'].includes(n.name))) errors.push(`${leader.id}: frame clutter`);
          count++;
        }
        if (JSON.stringify(localStorage) !== before) errors.push('read-only save mutation');
      }
    } finally {
      if (saved === null) localStorage.removeItem('birdsquad.account'); else localStorage.setItem('birdsquad.account', saved);
    }
    return { count, errors };
  });
  expect(result.count).toBe(10); expect(result.errors).toEqual([]);
});

test('leader dossiers fit three viewports with real art, keyboard, wheel and touch paging', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (/not supported in WebGL/.test(m.text())) errors.push(m.text()); });
  await boot(page);
  const ids = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').allLeaders().map((l: any) => l.id));
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  for (const id of ids) {
    await page.evaluate(id => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      c.activeSection = 'leaders'; c.openCodexDetail(id, false);
    }, id);
    await page.waitForFunction(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return Boolean(c.root.getByName('codex-leader-dossier-art')) && !c.load.isLoading();
    });
    for (const size of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(size); await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`${id}-${size.width}.png`) });
    }
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').detailScroll > 0);
    await page.mouse.move(600, 300); await page.mouse.wheel(0, 300);
    for (let i = 0; i < 20; i++) {
      const next = await page.evaluate(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        const hit = c.root.getByName('codex-leader-scroll-more');
        if (!hit?.input?.enabled) return null;
        const b = document.querySelector('canvas')!.getBoundingClientRect();
        return { x: b.x + hit.x * b.width / 1280, y: b.y + hit.y * b.height / 720, h: hit.height * b.height / 720 };
      });
      if (!next) break;
      expect(next.h).toBeGreaterThanOrEqual(44);
      await page.touchscreen.tap(next.x, next.y);
      await page.waitForFunction(() => {
        const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
        return Math.abs(c.detailScroll - c.detailScrollTarget) < 1;
      });
    }
    expect(await page.evaluate(() => {
      const c = (window as any).__birdSquadGame.scene.getScene('CodexScene');
      return c.detailScroll >= c.detailMaxScroll - 1 && c.root.getByName('codex-leader-reader').list.at(-1).getBounds().bottom <= 609;
    })).toBe(true);
    await page.screenshot({ path: info.outputPath(`${id}-end-1000.png`) });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !JSON.parse((window as any).render_game_to_text()).detailOpen);
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved); expect(errors).toEqual([]);
});

test('long leader title and signature reflow without clipping or overlapping', async ({ page }, info) => {
  await boot(page); await page.setViewportSize({ width: 1000, height: 560 });
  const result = await page.evaluate(() => {
    const c = (window as any).__birdSquadGame.scene.getScene('CodexScene'), leader = c.allLeaders()[0];
    leader.name = 'A deliberately long translated leader name that wraps across several lines without touching the close control';
    leader.signatureText = 'Complete signature mechanics remain readable. '.repeat(30) + 'Final signature rule.';
    c.activeSection = 'leaders'; c.openCodexDetail(leader.id, false);
    const reader = c.root.getByName('codex-leader-reader');
    return { overlap: reader.list.some((n: any, i: number) => i && n.y < reader.list[i - 1].getBounds().bottom),
      full: reader.getByName('codex-leader-signature').text.endsWith('Final signature rule.'),
      width: Math.max(...reader.list.map((n: any) => n.getBounds().right)) };
  });
  expect(result.overlap).toBe(false); expect(result.full).toBe(true); expect(result.width).toBeLessThanOrEqual(1099);
  await settleCanvas(page); await page.screenshot({ path: info.outputPath('long-leader-1000.png') });
});
