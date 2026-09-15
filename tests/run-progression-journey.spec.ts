import { test, expect } from '@playwright/test';
import { resolveScriptedBattle } from './helpers/scripted-battle';
import { settleCanvas } from './helpers/settled-canvas';
import { writeFile } from 'node:fs/promises';
import { flockLeaders } from '../src/game/leaders';
import { readFileSync } from 'node:fs';

const supplyData = JSON.parse(readFileSync(new URL('../data/game/alpha-supplies.json', import.meta.url), 'utf8'));

const cases = [
  ...(['balanced', 'pressure', 'sheltered', 'cache-first'] as const).map(policy => ({
    policy, leader: 'fledgling', seed: 'continuation-progression-1', equipped: false,
  })),
  ...flockLeaders.flatMap(leader => [1, 2].map(seed => ({
    policy: 'cache-first' as const, leader: leader.id, seed: `continuation-equipped-${seed}`, equipped: true,
  }))),
];

// Actual run state flows through route, combat, reward and district transitions.
// A defeat is a valid measured outcome, not proof that the balance is wrong.
for (const scenario of cases) test(`seeded run progression: ${scenario.equipped ? 'equipped' : scenario.policy} ${scenario.leader} ${scenario.seed}`, async ({ page }, info) => {
  const { policy, leader, seed, equipped } = scenario;
  test.setTimeout(240000);
  const errors: string[] = [], journey: any[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async leader => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene'); await w.__birdSquadEnsureScene('BattleScene');
    const menu = w.__birdSquadGame.scene.getScene('MenuScene');
    menu.selectedLeaderId = leader;
    menu.selectedRunMode = 'full'; menu.startRun();
  }, leader);
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.evaluate(seed => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.scene.restart({ runState: { ...r.runState, seed } });
  }, seed);
  let terminal = '';
  // Four districts plus Market picks/Supplies need more transitions than the
  // old opening-only policy. Still bounded to expose actual progression loops.
  for (let step = 0; step < 240 && !terminal; step++) {
    await settleCanvas(page);
    await page.waitForFunction(() => {
      const game = (window as any).__birdSquadGame;
      if (game.scene.isActive('RouteScene')) return game.scene.getScene('RouteScene').routeEssentialAssetsReady;
      if (!game.scene.isActive('BattleScene')) return false;
      const b = game.scene.getScene('BattleScene');
      return b.fxLayer?.active && b.combatPreviewModule && b.discardChoiceModule && b.returnChoiceModule
        && !b.combatIntroActive && !b.combatAnimationPending;
    });
    const state = await page.evaluate(() => {
      const game = (window as any).__birdSquadGame;
      return game.scene.isActive('RouteScene') ? 'route' : game.scene.getScene('BattleScene').mode;
    });
    if (state === 'battle') {
      const result = await page.evaluate(resolveScriptedBattle, {
        policy: policy === 'cache-first' ? 'sheltered' : policy,
        supplies: equipped ? supplyData.supplies : [],
      });
      journey.push({ kind: 'combat', ...result });
      expect(result.mode, JSON.stringify(result)).not.toBe('battle');
      expect(Number.isFinite(result.hp)).toBe(true);
    } else if (['defeat', 'runComplete'].includes(state)) terminal = state;
    else if (state === 'route') {
      journey.push(await page.evaluate(({ policy, equipped }) => {
        const w = window as any, r = w.__birdSquadGame.scene.getScene('RouteScene'), map = w.__birdSquadCurrentMap();
        if (r.shouldChooseDistrictContract()) {
          const choice = r.districtContractChoices()[0]; r.chooseDistrictContract(choice.id);
          return { kind: 'contract', id: choice.id, map: map.id };
        }
        if (r.cardPickerMode) {
          const card = r.pickerEligibleCards(r.cardPickerMode).find((c: any) => c.cost <= r.runState.scrap);
          if (!card) throw new Error('Empty progression picker');
          const before = r.runState.scrap, cost = card.cost, context = r.cardPickerContext;
          r.applyCardPick(card.index); return { kind: 'preen', id: card.card.id, context, cost, before, after: r.runState.scrap };
        }
        if (r.pendingRouteReward) { r.claimRouteReward(); return { kind: 'claim-route' }; }
        if (r.marketOpen) {
          if (equipped) {
            const before = r.runState.scrap;
            // Buy only legal offered stock; no refresh, grant or price override.
            const utility = r.marketUtilityShelf.findIndex((s: any) => !s.sold && r.marketUtilityEnabled(s)
              && (s.id === 'preen' || s.supplyId));
            if (utility >= 0) {
              const listing = { ...r.marketUtilityShelf[utility] };
              r.buyMarketUtility(utility);
              return { kind: 'market-utility', listing, before, after: r.runState.scrap, picker: r.cardPickerMode };
            }
            const mark = r.marketWaymarkShelf.findIndex((s: any) => !s.sold && s.price <= before);
            if (mark >= 0) {
              const listing = { ...r.marketWaymarkShelf[mark] }; r.buyMarketRouteMark(mark);
              return { kind: 'market-waymark', listing, before, after: r.runState.scrap };
            }
            const card = r.marketCardShelf.findIndex((s: any) => !s.sold && s.price <= before
              && !r.runState.deck.some((c: any) => c.id === s.id));
            if (card >= 0) {
              const listing = { ...r.marketCardShelf[card] }; r.buyMarketCard(card);
              return { kind: 'market-card', listing, before, after: r.runState.scrap };
            }
          }
          r.leaveMarket(); return { kind: 'leave-market' };
        }
        if (r.nodeChoiceOpen) {
          const node = map.nodes.find((n: any) => n.id === r.nodeChoiceNodeId);
          const available = r.nodeChoiceList(node).filter((c: any) => !c.locked);
          const preference = node.type === 'basin' ? 'recover' : node.type === 'cache' ? 'cache_scrap' : 'decline';
          const key = (available.find((c: any) => c.key === preference) ?? available.find((c: any) => !c.effects.length) ?? available[0])?.key;
          if (!key) throw new Error('No valid route choice');
          r.chooseNodeOption(key); return { kind: 'route-choice', node: node.id, key };
        }
        if (equipped) {
          const index = r.runState.supplies.findIndex((id: string) => {
            const supply = r.marketSupply(id);
            return supply?.timing === 'route' || (supply?.timing === 'either' && r.runMaxHp() - r.runState.currentHp >= 6);
          });
          if (index >= 0) {
            const id = r.runState.supplies[index], before = r.runState.scrap;
            r.useRouteSupply(index);
            return { kind: 'route-supply', id, before, after: r.runState.scrap, hp: r.runState.currentHp };
          }
        }
        const choices = map.nodes.filter((n: any) => r.selectableNodeIds.has(n.id));
        const rank = (n: any) => equipped && n.type === 'market' && r.runState.scrap >= 45 ? -2
          : policy === 'cache-first' && n.type === 'cache' ? -1
          : n.type === 'basin' && r.runState.currentHp < r.runMaxHp() * 0.8 ? 0
          : n.type === 'boss' ? 1 : n.type === 'street' ? 2 : 3;
        choices.sort((a: any, b: any) => rank(a) - rank(b) || a.id.localeCompare(b.id));
        const choice = choices[0];
        if (!choice) throw new Error(`No legal route continuation: ${JSON.stringify(r.getTextState())}`);
        r.commitRouteNode(choice.id);
        return { kind: 'travel', id: choice.id, type: choice.type, map: map.id, offered: choices.map((n: any) => ({ id: n.id, type: n.type, payload: n.payloadId })),
          hp: r.runState.currentHp, scrap: r.runState.scrap, deck: r.runState.deck.length };
      }, { policy, equipped }));
    } else {
      await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
      journey.push(await page.evaluate(() => {
        const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
        const mode = b.mode;
        if (mode === 'cardReward') {
          const card = b.rewardChoices.find((c: any) => c.runtime.kind !== 'snag');
          if (card) { b.chooseRewardCard(card.id); return { kind: mode, id: card.id }; }
          b.skipCardReward(); return { kind: 'skip-card' };
        }
        if (mode === 'upgradeReward') { const id = b.upgradeChoices[0].id; b.chooseUpgradeCard(id); return { kind: mode, id }; }
        if (mode === 'waymarkReward') { const id = b.waymarkChoices[0].id; b.chooseWaymarkReward(id); return { kind: mode, id }; }
        throw new Error(`Unsupported progression state: ${mode}`);
      }));
    }
  }
  const summary = await page.evaluate(() => (window as any).__birdSquadLastRun ?? null);
  const report = JSON.stringify({ ...scenario, terminal, summary, journey }, null, 2);
  await writeFile(info.outputPath('mechanical-run.json'), report);
  await info.attach('mechanical-run', { body: report, contentType: 'application/json' });
  expect(['defeat', 'runComplete']).toContain(terminal);
  expect(summary).toMatchObject({ leaderId: leader, seed, result: terminal === 'defeat' ? 'loss' : 'win' });
  expect(journey.filter(entry => entry.kind === 'combat').length).toBeGreaterThan(1);
  expect(errors).toEqual([]);
  await settleCanvas(page);
  await page.screenshot({ path: info.outputPath('run-outcome.png') });
});
