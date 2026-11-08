import { test, expect, type Page } from '@playwright/test';
import { decisionBrief, primaryBenefit } from '../src/game/decision-brief';
import { installStrategyAuditPolicy } from './helpers/strategy-audit-policy';
import { settleCanvas } from './helpers/settled-canvas';

const bird = (id: string, effects: string[], cost = 1, suit: string | null = null, upgrade?: string[]) => ({
  id, name: id, upgraded: false, runtime: { id, cost, suit, effects, upgrade: { effects: upgrade ?? effects }, moltEffects: [] } as any,
});
test('Clear choices advice rejects conditional sources and unaffordable sequences, and reads upgrades', () => {
  const consumer = bird('Consumer', ['if resonanceAtLeast(2) then damage(target, 5)'], 2);
  expect(decisionBrief(consumer, [bird('Conditional', ['if fullCohesion then gainResonance(2)'])]).pairing).toBe('No verified owned pairing.');
  expect(decisionBrief(consumer, [bird('Small', ['gainResonance(1)'])]).pairing).toBe('No verified owned pairing.');
  expect(decisionBrief(consumer, [bird('Expensive', ['gainResonance(2)'], 2)]).pairing).toBe('No verified owned pairing.');
  const refunded = bird('Refunded', ['gainResonance(2)', 'gainWingbeat(1)'], 2);
  expect(decisionBrief(consumer, [refunded]).pairing).toBe('After Refunded: Resonance');
  const upgraded = { ...bird('Preened', ['gainResonance(1)'], 1, null, ['gainResonance(2)']), upgraded: true };
  expect(decisionBrief(consumer, [upgraded]).pairing).toBe('After Preened: Resonance');
  expect(decisionBrief(consumer, [bird('Spent', ['gainResonance(2)', 'spendResonance(2)'])]).pairing).toBe('No verified owned pairing.');
  expect(decisionBrief(consumer, [bird('Burst', ['gainResonance(2)', 'resonanceBurst(2)'])]).pairing).toBe('No verified owned pairing.');
  expect(decisionBrief(consumer, [bird('Loss', ['gainResonance(2)', 'loseWingbeat(1)'])]).pairing).toBe('No verified owned pairing.');
  expect(decisionBrief(bird('Unspent', ['if spentResonance then draw(1)']), [refunded]).pairing).toBe('No verified owned pairing.');
});
test('Clear choices advice preserves order, form and once-per-fight combination limits', () => {
  const nest = bird('Nest', ['gainCover(4)'], 1, 'nests'), quill = bird('Quill', ['damage(target, 4)'], 1, 'quills');
  expect(decisionBrief(quill, [nest]).pairing).toBe('After Nest: Brace & Cut');
  expect(decisionBrief(nest, [quill]).pairing).toBe('Before Quill: Brace & Cut');
  expect(decisionBrief(quill, [nest]).details).toContain('unused in the fight');
  expect(decisionBrief(quill, [{ ...nest, runtime: { ...nest.runtime, effects: ['enterMolt()'] } }]).pairing).toBe('No verified owned pairing.');
  const winded = bird('Answer', ['if targetWinded then draw(1)']);
  expect(decisionBrief(winded, [bird('Setter', ['applyWinded(target, 1)'])]).details).toContain('same surviving target');
  expect(decisionBrief(winded, [bird('Maybe', ['if targetIntendsAttack then applyWinded(target, 1)'])]).pairing).toBe('No verified owned pairing.');
});
test('Clear choices audit policies distinguish shelter, Resonance and Molt offers', async ({page}) => {
  await page.goto('about:blank'); await page.evaluate(installStrategyAuditPolicy);
  const cards = [bird('Shelter', ['gainCover(8)', 'retainHand(1)']), bird('Chorus', ['gainResonance(3)', 'draw(1)']),
    { ...bird('Storm', ['enterMolt()', 'gainOpenSkyGuard(2)']), runtime: { ...bird('Storm', []).runtime, effects: ['enterMolt()', 'gainOpenSkyGuard(2)'], moltEffects: ['damage(target, 12)'] } }];
  const picks = await page.evaluate(cards => ['shelter','tempo','molt'].map(plan =>
    [...cards].sort((a,b)=>(window as any).__auditCardScore(b,plan)-(window as any).__auditCardScore(a,plan))[0].id), cards);
  expect(picks).toEqual(['Shelter','Chorus','Storm']);
});
async function battle(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
  await page.goto('./?flight=clear-choices&length=full');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady;});
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.combatPreviewModule&&b.battleHudRendererModule&&b.battleHandRendererModule&&!b.combatInteractionLocked();});
}
test('Clear choices critical forecasts stay complete and separate at every supported size', async ({page},info) => {
  await battle(page); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size);await settleCanvas(page);
    for(const scenario of ['ordinary','lethal','phase-choice']) {
      const result=await page.evaluate(scenario=>{
        const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),c=b.hand[0],enemy=b.enemies[0];
        b.selectedInstanceId=c.instanceId;
        const o=b.simulateCardOutcome(c,enemy.id);
        o.flockBefore.energy=3;o.flockAfter.energy=2;o.flockBefore.block=0;o.flockAfter.block=4;o.coverGain=4;
        o.enemyStates=[{id:enemy.id,hpBefore:27,hpAfter:scenario==='lethal'?0:22,maxHp:27,blockBefore:0,blockAfter:0,defeated:scenario==='lethal'}];
        o.contract.target='enemy';
        if(scenario==='phase-choice'){o.bossPhaseBreak={enemyId:enemy.id,name:'A very long phase name',nextIntent:'Attack 20'};o.bossDisruptions=['boss'];o.requiresChoice=true;}
        const view=b.battleHudRendererModule.formatBattleSelectionOutcome(c.name,enemy.id,'',0,o);
        b.selectionOutcomePreview?.destroy(true);
        b.selectionOutcomePreview=b.battleHudRendererModule.renderBattleSelectionPreview({scene:b,root:b.root,gameWidth:1280,fontFamily:'Arial',boldFontStyle:'bold',cyan:0x24d0d6,gold:0xffdd88},view);
        const p=b.selectionOutcomePreview,box=p.getByName('combat-outcome-preview').getBounds();
        const values=['combat-selection-summary','combat-selection-impact','combat-selection-protection','combat-selection-notice'].map(name=>{
          const t=p.getByName(name),r=t.getBounds();return {name,text:t.text,left:r.left,right:r.right,top:r.top,bottom:r.bottom,fits:r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom};});
        return {values,details:view.details,fields:view.fields,bottom:box.bottom};
      },scenario);
      expect(result.values.every(v=>v.fits)).toBe(true);
      expect(result.values[0].right).toBeLessThan(result.values[1].left);
      expect(result.values[1].right).toBeLessThan(result.values[2].left);
      expect(result.fields.cost).toBe('Wingbeats 3 → 2');expect(result.fields.protection).toBe('Cover 0 → 4');
      expect(result.bottom).toBeLessThan(444);
      if(scenario==='lethal')expect(result.fields.impact).toContain('DEFEATED');
      if(scenario==='phase-choice') {expect(result.fields.notice).toContain('PHASE II');expect(result.fields.notice).toContain('ATTACK DISRUPTED');expect(result.fields.notice).toContain('later effects pending');expect(result.details).toContain('Attack 20');}
      await settleCanvas(page);
      await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').combatReading?.visible)).toBe(false);
      await page.screenshot({path:info.outputPath(`${scenario}-${size.width}.png`)});
    }
  }
  expect(errors).toEqual([]);
});
test('Clear choices complete card catalog keeps numeric forecasts inside separate fields', async ({page}) => {
  await battle(page);
  await page.evaluate(async()=>{await (window as any).__birdSquadEnsureScene('CodexScene');});
  const result=await page.evaluate(()=>{
    const g=(window as any).__birdSquadGame,b=g.scene.getScene('BattleScene'),cards=g.scene.getScene('CodexScene').allCards(),failures:string[]=[];
    b.selectedInstanceId=b.hand[0].instanceId;b.energy=3;b.flock.block=99;b.flock.hp=b.flock.maxHp=100;
    b.enemies.forEach((e:any)=>{e.hp=e.maxHp=100;e.block=10;});
    for(const original of cards)for(const upgraded of [false,true])for(const molt of [false,true]) {
      const card={...original,upgraded,cost:upgraded?original.runtime.upgrade.cost??original.runtime.cost:original.runtime.cost};b.flock.molt=molt;
      const o=b.simulateCardOutcome(card,b.enemies[0].id),view=b.battleHudRendererModule.formatBattleSelectionOutcome(card.name,b.enemies[0].id,'',0,o);
      b.selectionOutcomePreview?.destroy(true);
      const p=b.battleHudRendererModule.renderBattleSelectionPreview({scene:b,root:b.root,gameWidth:1280,fontFamily:'Arial',boldFontStyle:'bold',cyan:0x24d0d6,gold:0xffdd88},view);b.selectionOutcomePreview=p;
      const bounds=p.getByName('combat-outcome-preview').getBounds();
      const rows=['combat-selection-summary','combat-selection-impact','combat-selection-protection','combat-selection-notice'].map(name=>({name,b:p.getByName(name).getBounds(),text:p.getByName(name).text}));
      for(const row of rows)if(row.b.left<bounds.left||row.b.right>bounds.right)failures.push(`${card.id}/${upgraded}/${molt}/${row.name}: ${row.text}`);
      if(rows[0].b.right>=rows[1].b.left||rows[1].b.right>=rows[2].b.left)failures.push(`${card.id}/${upgraded}/${molt}/columns`);
    }
    return {count:cards.length*4,failures};
  });
  expect(result.count).toBeGreaterThanOrEqual(400);expect(result.failures).toEqual([]);
});
test('Clear choices selection avoids full dossier rebuilds and refreshes changed outcomes', async ({page}) => {
  await battle(page);
  const result=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.energy=99;b.renderAll();
    let views=0,sims=0;const view=b.battleHandCardView,sim=b.simulateCardOutcome;
    b.battleHandCardView=function(...args:any[]){views++;return view.apply(this,args);};
    b.simulateCardOutcome=function(...args:any[]){sims++;return sim.apply(this,args);};
    b.onCardClicked(b.hand[0].instanceId);const work={views,sims};
    const before=b.selectedCardOutcomePreview();b.energy=1;b.flock.block=7;b.refreshCombatSelectionPreview();
    const after=b.selectedCardOutcomePreview();
    b.flock.flow=b.flock.flowMax-1;b.refreshHandCardSelection();
    const flow=b.hand.filter((c:any)=>b.handCardRects.get(c.instanceId)?.active).every((c:any)=>{
      const expected=view.call(b,c).flowVisible,actual=b.handCardFlowIndicators.get(c.instanceId)?.container.visible;
      return expected===actual;
    });
    return {work,before:before.fields.cost,after:after.fields.cost,protection:after.fields.protection,flow};
  });
  expect(result.work.views).toBe(0);expect(result.work.sims).toBeLessThanOrEqual(2);
  expect(result.after).not.toBe(result.before);expect(result.protection).toMatch(/^Cover 7 →/);expect(result.flow).toBe(true);
});
for(const preen of [false,true])test(`Clear choices ${preen?'Preen':'reward'} advice remains readable and inspection preserves the choice`,async({page},info)=>{
  await battle(page);
  await page.evaluate(preen=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');const cards=b.allDeckCards().filter((c:any)=>!c.upgraded).slice(0,3);
    // An owned copy of the same identity must not replace the inspected offer's rules.
    const duplicate=structuredClone(cards[0]);duplicate.instanceId+='-owned-copy';duplicate.upgraded=true;
    duplicate.runtime.upgrade.effects=['gainCover(999)'];b.drawPile.unshift(duplicate);
    b.mode=preen?'upgradeReward':'cardReward';b.rewardChoices=cards;b.upgradeChoices=cards;b.renderAll();
  },preen);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`offers-${size.width}.png`)});}
  const before=await page.evaluate(preen=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene'),card=(b.mode==='upgradeReward'?b.upgradeChoices:b.rewardChoices)[0];
    const before=JSON.stringify({deck:b.allDeckCards(),scrap:b.scrap,mode:b.mode});b.openRewardCardInspection(card.id);
    return {snapshot:before,candidate:{...card,upgraded:preen}};
  },preen);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').cardPreview?.getData('reading'));
  const read=await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    const panel=b.cardPreview;const total=panel.getData('reading').total,readings=[];
    for(let i=0;i<total;i++){readings.push(panel.getData('reading'));panel.getData('turnRulesPage')(1);}
    b.closeRewardCardInspection();return {after:JSON.stringify({deck:b.allDeckCards(),scrap:b.scrap,mode:b.mode}),readings};
  });
  expect(before.snapshot).toBe(read.after);
  const advice=read.readings.filter((r:any)=>r.title==='OWNED PAIRING · CONDITIONS').map((r:any)=>r.text).join(' ').replace(/\s+/g,' ');
  expect(advice).toContain('Potential, not a promised draw.');expect(advice).toContain('three-Wingbeat');
  expect(advice).toContain(primaryBenefit(before.candidate).replace(/\s+/g,' '));expect(advice).not.toContain('999');
});
