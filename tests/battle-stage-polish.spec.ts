import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const encounter of ['m1_entry', 'm1_boss']) {
  test(`battle stage keeps measured vitals and target input readable in ${encounter}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width: 2560, height: 1600 });
    await page.goto('./');
    await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
    await page.evaluate(async routeNodeId => {
      const w = window as any;
      await w.__birdSquadEnsureScene('BattleScene');
      for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
      w.__birdSquadGame.scene.start('BattleScene', { routeNodeId });
    }, encounter);
    await page.waitForFunction(() => {
      const w = window as any, battle = w.__birdSquadGame.scene.getScene('BattleScene');
      return battle.fxLayer?.active && battle.root?.getByName('combat-enemy-name')
        && !battle.combatAnimationPending && !battle.battleRenderQueued
        && !JSON.parse(w.render_game_to_text()).combatIntro?.active;
    });

    const checkVitals = async () => {
      const values = await page.evaluate(() => {
        const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return battle.enemies.filter((enemy: any) => enemy.hp > 0).map((enemy: any) => {
          const named = (name: string) => battle.root.list.find((child: any) => child.name === name && child.getData('enemyId') === enemy.id);
          const name = named('combat-enemy-name'), value = named('combat-enemy-hp-value');
          const panel = named('combat-enemy-vitals').getBounds();
          const track = named('combat-enemy-health-track').getBounds();
          const fill = named('combat-enemy-health-fill').getBounds();
          const badge = named('combat-enemy-intent-badge').getBounds();
          const group = named('combat-enemy-art');
          const portrait = group.list[0].getByName('combat-enemy-portrait');
          const artBounds = portrait ? battle.enemyTextureVisibleBounds(portrait.texture.key) : undefined;
          const imageBounds = portrait?.getBounds();
          if (portrait?.texture.key === 'enemy-roof_rat') {
            const shadow = group.list[0].getByName('combat-enemy-contact-shadow');
            const contact = portrait.y + portrait.displayHeight * (416 / 512 - 0.5);
            if (!shadow || Math.abs(shadow.y - contact) > 3) throw new Error('Roof Rat contact shadow detached from paws');
          }
          const artTop = imageBounds ? imageBounds.top + imageBounds.height * artBounds.top : 114;
          const artBottom = imageBounds ? imageBounds.top + imageBounds.height * artBounds.bottom : badge.top;
          const otherBadges = battle.root.list.filter((child: any) => child.name === 'combat-enemy-intent-badge' && child.getData('enemyId') !== enemy.id);
          const badgesSeparated = otherBadges.every((other: any) => {
            const bounds = other.getBounds();
            return badge.right < bounds.left || badge.left > bounds.right || badge.bottom < bounds.top || badge.top > bounds.bottom;
          });
          const log = battle.root.getByName('combat-log-hit').getBounds();
          const contains = (bounds: any) => bounds.left >= panel.left && bounds.right <= panel.right && bounds.top >= panel.top && bounds.bottom <= panel.bottom;
          return { nameFits: contains(name.getBounds()), valueFits: contains(value.getBounds()),
            separated: name.getBounds().right + 4 <= value.getBounds().left,
            badgeClear: badge.bottom < panel.top && badge.centerX === panel.centerX,
            logClear: log.top > panel.bottom,
            badgesSeparated,
            fullName: name.getData('fullName') === enemy.name,
            exactHealth: value.text === `${enemy.hp}/${enemy.maxHp}`,
            headerClear: Math.max(name.getBounds().bottom, value.getBounds().bottom) + 4 <= track.top,
            meterFits: contains(track) && contains(fill) && Math.abs(fill.left - track.left) < 0.1,
            meterAccurate: Math.abs(fill.width - Math.max(2, track.width * enemy.hp / enemy.maxHp)) < 0.1,
            crispIntent: named('combat-enemy-intent-value').style.resolution === 2,
            artBelowHud: artTop >= 106, artAboveTell: artBottom <= badge.top };
        });
      });
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) expect(value).toEqual({ nameFits: true, valueFits: true, separated: true, badgeClear: true, logClear: true, badgesSeparated: true, fullName: true, exactHealth: true, headerClear: true, meterFits: true, meterAccurate: true, crispIntent: true, artBelowHud: true, artAboveTell: true });
    };
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport);
      await settleCanvas(page);
      await checkVitals();
      await page.screenshot({ path: info.outputPath(`stage-${viewport.width}.png`) });
    }

    if (encounter === 'm1_entry') {
      // Synthetic crowded/long-name fixture exercises the actual foreground renderer.
      await page.evaluate(() => {
        const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const first = battle.enemies[0];
        first.name = 'The Featherwright Emergency Relay Station';
        first.hp = 123; first.maxHp = 999;
        const second = { ...first, id: `${first.id}-vitals`, name: 'Canal Lookout', hp: 3, runtime: { ...first.runtime } };
        battle.enemies = [first, second]; battle.selectedEnemyId = first.id; battle.renderAll();
      });
      await checkVitals();
      await page.screenshot({ path: info.outputPath('crowded-1000.png') });
      await page.setViewportSize({ width: 2560, height: 1600 });
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath('crowded-2560.png') });
      const target = await page.evaluate(() => {
        const w = window as any, battle = w.__birdSquadGame.scene.getScene('BattleScene');
        const enemy = battle.enemies[1];
        const bar = battle.root.list.find((child: any) => child.name === 'combat-enemy-vitals' && child.getData('enemyId') === enemy.id).getBounds();
        const canvas = w.__birdSquadGame.canvas.getBoundingClientRect();
        return { id: enemy.id, hp: enemy.hp, hand: battle.hand.length,
          x: canvas.left + bar.centerX / w.__birdSquadGame.scale.width * canvas.width,
          y: canvas.top + bar.centerY / w.__birdSquadGame.scale.height * canvas.height };
      });
      await page.mouse.click(target.x, target.y);
      await page.waitForFunction(id => (window as any).__birdSquadGame.scene.getScene('BattleScene').selectedEnemyId === id, target.id);
      const selection = await page.evaluate(() => {
        const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        return { selected: battle.selectedEnemyId, hp: battle.enemies[1].hp, hand: battle.hand.length };
      });
      expect(selection).toEqual({ selected: target.id, hp: target.hp, hand: target.hand });
      await checkVitals();
    }
    await page.evaluate(() => {
      const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      // Focus a surviving target, then verify a forecast through the actual input path.
      battle.selectedEnemyId = battle.enemies[0].id;
      battle.renderAll();
      battle.onCardClicked(battle.hand[0].instanceId);
    });
    const forecast = await page.evaluate(() => {
      const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const hp = battle.enemyHpBar(battle.enemies[0]);
      const rectangles = battle.root.list.filter((child: any) => child.name === 'combat-enemy-outcome-preview' && child.type === 'Rectangle');
      const meterOverlays = rectangles.filter((child: any) => child.y === hp.y);
      const labels = battle.root.list.filter((child: any) => ['combat-enemy-name', 'combat-enemy-hp-value'].includes(child.name));
      const strip = battle.selectionOutcomePreview.getByName('combat-outcome-preview').getBounds();
      const footerClear = rectangles.every((child: any) => child.getBounds().bottom < strip.top);
      return { count: meterOverlays.length, footerClear, clear: meterOverlays.every((overlay: any) => {
        const a = overlay.getBounds();
        return labels.every((label: any) => { const b = label.getBounds(); return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom; });
      }) };
    });
    expect(forecast).toEqual({ count: 2, footerClear: true, clear: true });
    for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
      await page.setViewportSize(viewport);
      await settleCanvas(page);
      await page.screenshot({ path: info.outputPath(`forecast-${viewport.width}.png`) });
    }
    const hidden = await page.evaluate(() => {
      const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const hidden = !battle.root.getByName('combat-log-hit').visible && !battle.root.getByName('combat-log-latest').visible;
      battle.handleBattleBack();
      return hidden;
    });
    expect(hidden).toBe(true);
    // Back queues a coalesced render for the next frame.
    await expect.poll(() => page.evaluate(() => {
      const battle = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      return battle.root.getByName('combat-log-hit').visible && battle.root.getByName('combat-log-latest').visible;
    })).toBe(true);
    expect(errors).toEqual([]);
  });
}
