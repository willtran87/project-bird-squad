import { test, expect } from '@playwright/test';

for (const reduced of [false, true]) for (const remapped of [false, true]) {
  test(`trigger bursts and read-only history, reduced=${reduced}, remapped=${remapped}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.addInitScript(remapped => {
      localStorage.setItem('birdsquad.screenReader', 'on');
      if (remapped) localStorage.setItem('birdsquad.controlBindings', JSON.stringify({ version: 1, bindings: { guide: 'KeyJ', previous: 'KeyQ', next: 'KeyE', back: 'KeyB' } }));
    }, remapped);
    const keys = remapped ? { history: 'Shift+j', next: 'e', previous: 'q', back: 'b' } : { history: 'Shift+h', next: 'ArrowRight', previous: 'ArrowLeft', back: 'Escape' };
    await page.setViewportSize({ width: 2560, height: 1600 });
    await page.goto('./');
    await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
    await page.evaluate(async () => {
      const w = window as any;
      await w.__birdSquadEnsureScene('BattleScene');
      for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
      w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
    });
    await page.waitForFunction(() => {
      const w = window as any, b = w.__birdSquadGame.scene.getScene('BattleScene');
      return b.battleFxPresenterModule && b.battleHandRendererModule && b.hand.length && !b.combatAnimationPending && !b.combatIntroActive;
    });
    const settle = async () => {
      const f = await page.evaluate(() => (window as any).__birdSquadGame.loop.frame);
      await page.waitForFunction(f => (window as any).__birdSquadGame.loop.frame >= f + 2, f);
    };
    const helpLane = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.battleInputActive = true;
      b.renderAll();
      const covered = { hint: Boolean(b.root.getByName('combat-input-hint')),
        history: b.root.getByName('combat-log-hit').visible,
        label: b.root.getByName('combat-log-latest').visible };
      b.battleInputActive = false;
      b.renderAll();
      return { covered, restored: b.root.getByName('combat-log-hit').visible };
    });
    expect(helpLane).toEqual({ covered: { hint: true, history: false, label: false }, restored: true });
    const stable = () => page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return { hand: b.hand.map((c: any) => c.instanceId), selected: b.selectedInstanceId, target: b.selectedEnemyId,
        energy: b.energy, turn: b.turn, hp: b.enemies.map((e: any) => e.hp), pending: b.combatAnimationPending };
    });
    const modal = () => page.evaluate(() => JSON.parse((window as any).render_game_to_text()).combatCardDetail ?? null);
    const burst = async () => page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      for (let i = 0; i < 12; i++) {
        b.showSupplyFeedback({ id: 'seed_packet', name: `Supply ${i + 1}`, timing: 'manual', effects: ['heal(2)'] });
        b.logEvent(`Supply ${i + 1}: gain 2 Cohesion.`);
        b.showWaymarkFeedback({ id: 'broken_cover_chime', name: `Waymark ${i + 1}`, description: 'Gain 1 Wingbeat.', trigger: 'onEnemyCoverBroken', effect: 'gainWingbeat(1)' });
        b.logEvent(`Waymark ${i + 1}: gain 1 Wingbeat.`);
      }
      const notices = b.fxLayer.list.filter((o: any) => o.name === 'combat-trigger-feedback');
      return { count: notices.length, triggers: notices[0]?.getData('count'), source: notices[0]?.getData('source'),
        history: b.combatHistory.slice(-24), pending: b.combatAnimationPending,
        texts: notices[0]?.list.filter((o: any) => o.type === 'Text').map((o: any) => ({ size: o.style.fontSize, bottom: o.getBounds().bottom })) };
    });
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').cameras.main.fadeEffect.isRunning);
    const beforeBurst = await stable();
    const result = await burst();
    expect(result.count).toBe(1); expect(result.triggers).toBe(24); expect(result.source).toBe('Waymark 12');
    expect(await stable()).toEqual(beforeBurst);
    expect(result.history).toHaveLength(24);
    result.history.forEach((line: string, i: number) => expect(line).toContain(`${i % 2 ? 'Waymark' : 'Supply'} ${Math.floor(i / 2) + 1}:`));
    await settle();
    await page.screenshot({ path: info.outputPath('burst-2560.png') });
    await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('BattleScene').fxLayer.getByName('combat-trigger-feedback'));
    // Pointer history, then selected-card keyboard and controller history.
    const p = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), r = b.root.getByName('combat-log-hit').getBounds(), c = b.game.canvas.getBoundingClientRect();
      return { x: c.left + r.centerX * c.width / 1280, y: c.top + r.centerY * c.height / 720 };
    });
    await page.mouse.click(p.x, p.y); await settle();
    expect((await modal()).kind).toBe('history');
    await page.keyboard.press(keys.back); await settle();
    await page.evaluate(() => { const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'); b.onCardClicked(b.hand[0].instanceId); });
    const baseline = await stable();
    await page.keyboard.press(keys.history); await settle();
    const last = await modal(); expect(last.kind).toBe('history'); expect(last.page).toBe(last.pageCount);
    await expect.poll(() => page.locator('#game-status').textContent()).toContain('Combat history, reading only.');
    for (const key of ['1', 'r', 'x', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(key);
    await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      for (const index of [2, 3, 12, 13]) b.input.gamepad.emit('down', {}, { index });
    });
    expect(await stable()).toEqual(baseline);
    await page.keyboard.press(keys.previous); await settle(); expect((await modal()).page).toBe(last.page - 1);
    await page.keyboard.press(keys.next); await settle(); expect((await modal()).page).toBe(last.page);
    const content = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), panel = b.combatCardDetail;
      return panel.getData('pages').map((p: any) => p.body).join(' ').replace(/\s+/g, ' ');
    });
    for (const entry of result.history) expect(content).toContain(entry);
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => document.querySelector('canvas')!.getBoundingClientRect().width <= innerWidth + 1);
      await settle();
      const fits = await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene'), panel = b.combatCardDetail, end = panel.getData('page');
        let valid = true;
        for (let i = 0; i < panel.getData('pageCount'); i++) {
          panel.getData('changePage')(i - panel.getData('page'));
          valid &&= panel.getByName('combat-card-detail-body').getBounds().bottom <= 502;
        }
        panel.getData('changePage')(end - panel.getData('page'));
        return valid;
      });
      expect(fits).toBe(true); await settle();
      await page.screenshot({ path: info.outputPath(`history-${viewport.width}.png`) });
    }
    await page.keyboard.press('p'); await settle();
    await page.keyboard.press(keys.back); await settle();
    expect((await modal()).kind).toBe('history');
    // Repeated Confirm must neither dismiss inspection nor play the selected card.
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.keyboard.emit('keydown-ENTER', { repeat: true }));
    expect((await modal()).kind).toBe('history');
    await page.keyboard.press('Enter'); await settle(); expect(await modal()).toBeNull();
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.keyboard.emit('keydown-ENTER', { repeat: true }));
    expect(await stable()).toEqual(baseline);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 10 }));
    await settle(); expect((await modal()).kind).toBe('history');
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').input.gamepad.emit('down', {}, { index: 1 }));
    await settle(); expect(await stable()).toEqual(baseline);
    const cleanup = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      for (let i = 0; i < 500; i++) { b.presentTriggerFeedback(`Trigger ${i}`, 'Gain 2 Cover.', 0x77cccc); b.logEvent(`Stress ${i}`); }
      const card = b.fxLayer.getByName('combat-trigger-feedback');
      b.fxLayer.removeAll(true);
      return { active: card.active, tweens: b.tweens.getTweensOf(card).length, retained: b.combatHistory.length,
        first: b.combatHistory[0], last: b.combatHistory.at(-1) };
    });
    expect(cleanup.active).toBe(false); expect(cleanup.tweens).toBe(0); expect(cleanup.retained).toBe(256);
    expect(cleanup.first).toContain('Stress 244'); expect(cleanup.last).toContain('Stress 499');
    await settle(); expect(errors).toEqual([]);
  });
}
