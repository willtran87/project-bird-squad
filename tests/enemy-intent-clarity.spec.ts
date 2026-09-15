import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { enemyIntentLabel } from '../src/game/enemy-intent';
import { settleCanvas } from './helpers/settled-canvas';

test('intent labels distinguish defence, preparation, healing and mixed effects', () => {
  const cases: Array<[string[], number, string]> = [
    [['gainCover(6)'], 0, 'Cover 6'],
    [['gainCover(4)', 'gainCover(3)'], 0, 'Cover 7'],
    [['nextAttackBonus(6)'], 0, 'Charge +6'],
    [['heal(6)'], 0, 'Heal 6'],
    [['gainCover(6)', 'nextAttackBonus(3)'], 0, 'Cover 6 +'],
    [['gainCover(6)', 'if flockHasNoCover then nextAttackBonus(2)'], 0, 'Cover 6 +'],
    [['if selfBelowHalf then heal(6)'], 0, 'Support'],
    [['if notHitThisTurn then nextAttackBonus(4)'], 0, 'Prepare'],
    [['healAlly(lowest, 5)'], 0, 'Support'],
    [['nextAttackBonusAlly(front, 3)'], 0, 'Support'],
    [['applyOpenSky(1)'], 0, 'Pressure'],
    [['damage(flock, 6)'], 8, 'Attack 8'],
    [['damage(flock, 3)', 'damage(flock, 3)'], 6, 'Attack 6'],
    [['damage(flock, 6)', 'applyFrail(1)'], 6, 'Attack 6 + !'],
    [['damage(flock, 6)', 'gainCover(4)'], 6, 'Attack 6 + !'],
  ];
  for (const [effects, damage, label] of cases) expect(enemyIntentLabel(effects, damage).label, effects.join('; ')).toBe(label);
});

test('authored intent descriptions and compact defence labels remain readable', async ({ page }, info) => {
  test.setTimeout(90000); // Full authored pool plus three rendered viewports.
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto('./');
  await page.waitForFunction(() => (window as any).__birdSquadEnsureScene);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const scene of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(scene.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.battleForegroundRendererModule && b.hand?.length && !b.combatIntroActive && !b.combatAnimationPending;
  });
  const alpha = JSON.parse(readFileSync('data/game/alpha-enemies.json', 'utf8'));
  const authored = [...['normalEncounters', 'rivalEncounters', 'bosses'].flatMap(k => alpha[k]),
    ...[2, 3, 4].flatMap(n => JSON.parse(readFileSync(`data/game/map0${n}-content.json`, 'utf8')).enemies)]
    .flatMap((enemy: any) => enemy.moves);
  const descriptions = await page.evaluate(async moves => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.intentFixture = structuredClone(b.enemies[0]);
    const descriptions: string[] = [];
    for (let i = 0; i < moves.length; i += 4) {
      b.enemies = moves.slice(i, i + 4).map((move: any, j: number) => ({ ...b.intentFixture, id: `intent-${j}`, intentIndex: 0,
        runtime: { ...b.intentFixture.runtime, moves: [move], attackPattern: { type: 'cycle', moveIds: [move.id] } } }));
      b.renderAll();
      descriptions.push(...b.root.list.filter((o: any) => o.name === 'combat-enemy-intent-badge').map((o: any) => o.getData('description')));
      // Flush destroyed text textures between batches, as real play does.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    return descriptions;
  }, authored);
  expect(descriptions).toHaveLength(222);
  expect(descriptions.filter(text => /[a-zA-Z]+\(|then |undefined|NaN/.test(text))).toEqual([]);
  for (const [width, height] of [[2560, 1600], [1440, 900], [1000, 560]]) {
    await page.setViewportSize({ width, height });
    const rows = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      b.enemies = [['gainCover(6)'], ['nextAttackBonus(3)'], ['heal(5)'], ['gainCover(4)', 'nextAttackBonus(2)']]
        .map((effects, i) => ({ ...b.intentFixture, id: `intent-${i}`, name: ['Defender', 'Charger', 'Healer', 'Mixed'][i], intentIndex: 0,
          runtime: { ...b.intentFixture.runtime, moves: [{ id: 'showcase', label: 'Intent example', effects }],
            attackPattern: { type: 'cycle', moveIds: ['showcase'] } } }));
      b.renderAll();
      return b.enemies.map((enemy: any) => {
        const label = b.root.list.find((o: any) => o.name === 'combat-enemy-intent-value' && o.getData('enemyId') === enemy.id);
        const panel = b.root.list.find((o: any) => o.name === 'combat-enemy-intent-badge' && o.getData('enemyId') === enemy.id);
        const a = label.getBounds(), z = panel.getBounds();
        return { label: label.text, description: panel.getData('description'), fits: a.left >= z.left && a.right <= z.right && a.top >= z.top && a.bottom <= z.bottom };
      });
    });
    expect(rows.map(row => row.label)).toEqual(['Cover 6', 'Charge +3', 'Heal 5', 'Cover 4 +']);
    expect(rows.every(row => row.fits)).toBe(true);
    expect(rows[0].description).toBe('Gain 6 Cover.');
    expect(rows[1].description).toBe('Next attack gains +3 damage.');
    expect(rows[3].description).toBe('Gain 4 Cover. Next attack gains +2 damage.');
    await settleCanvas(page);
    await page.screenshot({ path: info.outputPath(`intent-${width}.png`) });
  }
  expect(errors).toEqual([]);
});
