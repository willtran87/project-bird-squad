import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';

for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }])
test(`combat HUD keeps actionable text readable and secondary goals out of enemy turns at ${viewport.width}`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('birdsquad.firstFlightGuide', JSON.stringify({ enabled: true, routeCommits: 1 })));
  await page.setViewportSize(viewport);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.hand.length && b.battleHudRendererModule && !b.combatIntroActive && !b.combatAnimationPending;
  });
    await settleCanvas(page);
    for (const phase of ['idle', 'preamble', 'windup', 'release', 'impact', 'recovery', 'interlude']) {
      const measured = await page.evaluate(phase => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        b.hudOriginalContext ??= b.battleHudRenderContext.bind(b);
        b.battleHudRenderContext = (supplemental: boolean) => {
          const c = b.hudOriginalContext(supplemental);
          return { ...c, onRoost: () => { b.hudRoleActivations++; }, beat: { ...c.beat, active: phase !== 'idle', phase,
            move: 'Featherwright Emergency Reinforcement Pattern',
            progress: { label: b.enemyTurnBeatLabel(phase), progress: 0.5, elapsedMs: 0, durationMs: 0 },
            acceleration: { available: true, active: phase === 'recovery', multiplier: 2 } },
            guidance: phase === 'idle' ? c.guidance : undefined,
            objective: supplemental ? { text: 'Hold the crossing  /  2 of 3 turns  /  +12 Scrap', accent: 0xe2b24a, detail: 'Hold for three turns to earn twelve Scrap.' } : undefined };
        };
        b.energy = 0; b.flock.block = 999; b.spark = 5; b.flock.flow = 4;
        b.scrap = 999999;
        b.flockSuitCounts = () => ({ plumes: 6, quills: 6, basins: 6, nests: 6 });
        b.battleInputActive = true; b.renderAll();
        const scale = document.querySelector('canvas')!.getBoundingClientRect().width / 1280;
        const contains = (a: any, z: any) => z.left >= a.left - 1 && z.right <= a.right + 1 && z.top >= a.top - 1 && z.bottom <= a.bottom + 1;
        const clear = (a: any, z: any) => a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom;
        const metrics = ['Cover', 'Wingbeats', 'Resonance', 'Scrap', 'Deck', 'Supplies', 'Waymarks'];
        const texts = metrics.flatMap(key => [b.root.getByName(`hud-label-${key}`), b.root.getByName(`hud-value-${key}`)]);
        texts.push(...['hud-value-Cohesion', 'combat-flow-value', 'combat-flow-status', 'combat-incoming-forecast-label', 'combat-roost-label', 'combat-roost-preview'].map(key => b.root.getByName(key)));
        const guidance = b.root.list.filter((o: any) => o.name === 'first-combat-guidance');
        const objective = b.root.list.filter((o: any) => o.name === 'encounter-objective');
        const beat = b.root.getByName('combat-beat-progress-ui');
        texts.push(...[...guidance, ...objective, ...beat.list].filter((o: any) => o.type === 'Text'));
        const roost = b.root.getByName('combat-roost-hit');
        b.hudRoleActivations = 0; roost.emit('pointerdown');
        const roostTexts = ['combat-roost-label', 'combat-roost-preview'].map(key => b.root.getByName(key));
        const phaseLabel = beat.getByName('combat-enemy-phase-label'), haste = beat.getByName('combat-enemy-acceleration-label');
        return {
          floors: texts.filter(Boolean).map((o: any) => ({ name: o.name || o.text, css: parseFloat(o.style.fontSize) * scale })),
          labelsSeparate: metrics.every(key => b.root.getByName(`hud-label-${key}`).getBounds().bottom <= b.root.getByName(`hud-value-${key}`).getBounds().top),
          metricsSeparate: metrics.every((key, i) => i === metrics.length - 1 ||
            Math.max(b.root.getByName(`hud-label-${key}`).getBounds().right, b.root.getByName(`hud-value-${key}`).getBounds().right)
              < b.root.getByName(`hud-label-${metrics[i + 1]}`).getBounds().left),
          roostContained: roostTexts.every(o => contains(roost.getBounds(), o.getBounds())),
          roostSeparate: clear(roostTexts[0].getBounds(), roostTexts[1].getBounds()),
          guidanceContained: !guidance.length || contains(guidance[0].getBounds(), guidance[1].getBounds()),
          objectiveContained: !objective.length || contains(objective[0].getBounds(), objective[1].getBounds()),
          guidanceGoalSeparate: !guidance.length || !objective.length || clear(guidance[0].getBounds(), objective[0].getBounds()),
          phaseSeparated: !phaseLabel || clear(phaseLabel.getBounds(), haste.getBounds()),
          objective: objective.length > 0, guidance: guidance.length > 0,
          roostEnabled: Boolean(roost.input?.enabled), roostActivations: b.hudRoleActivations,
          moveExcerpt: beat.getByName('combat-enemy-move-label')?.getData('truncated'),
          energy: b.root.getByName('hud-value-Wingbeats').text,
        };
      }, phase);
      for (const item of measured.floors) expect(item.css, `${phase}: ${item.name}`).toBeGreaterThanOrEqual(
        ['hud-value-Cover', 'hud-value-Wingbeats', 'hud-value-Cohesion', 'combat-roost-label', 'first-combat-guidance'].includes(item.name) ? 16 : 14);
      expect(measured.labelsSeparate).toBe(true);
      expect(measured.metricsSeparate).toBe(true);
      expect(measured.roostContained).toBe(true); expect(measured.roostSeparate).toBe(true);
      expect(measured.guidanceContained).toBe(true); expect(measured.objectiveContained).toBe(true);
      expect(measured.guidanceGoalSeparate).toBe(true); expect(measured.phaseSeparated).toBe(true);
      expect(measured.objective).toBe(phase === 'idle' && !measured.guidance);
      expect(measured.roostEnabled).toBe(phase === 'idle');
      expect(measured.roostActivations).toBe(phase === 'idle' ? 1 : 0);
      if (phase !== 'idle') expect(measured.moveExcerpt).toBe(true);
      expect(measured.energy).toMatch(/^0\//);
      await settleCanvas(page); await page.screenshot({ path: info.outputPath(`${phase}-${viewport.width}.png`) });
    }
  const goals = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return ['Swift Crossing  /  Beat 3/3', 'Measured Flight  /  Overextensions 0/0',
      'Shelter Intact  /  Cover 999  /  finish guarded', 'Untouched Crossing  /  Cohesion lost 999/0',
      'Bright Signal  /  Surge 1/1', 'Hold Formation  /  Flow 5/1',
      'Keep A Reserve  /  Wingbeat banked 1/1', 'Weather The Heights  /  Damage blocked 12/12']
      .flatMap(title => ['', '  /  COMPLETE', '  /  FAILED'].map(status => {
        const text = `${title}  /  +18${status}`;
        b.battleHudRenderContext = (supplemental: boolean) => ({ ...b.hudOriginalContext(supplemental), guidance: undefined,
          objective: supplemental ? { text, accent: 0xe2b24a, detail: text } : undefined });
        b.renderAll();
        const [panel, label] = b.root.list.filter((o: any) => o.name === 'encounter-objective');
        const a = panel.getBounds(), z = label.getBounds();
        return { text, fits: z.left >= a.left && z.right <= a.right && z.top >= a.top && z.bottom <= a.bottom };
      }));
  });
  for (const goal of goals) expect(goal.fits, goal.text).toBe(true);
  expect(errors).toEqual([]);
});
