import { test, expect, type Page } from '@playwright/test';
import { orderTeachingHand } from '../src/game/guided-opening';
import { readableHandRules, actionFirstHandRules, fitHandRules } from '../src/game/battle/hand-rule-summary';
import { encounterDecision } from '../src/game/combat-reading';
import { resolveScriptedBattle } from './helpers/scripted-battle';
import { settleCanvas } from './helpers/settled-canvas';

const sizes = [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}];
async function route(page: Page) {
  await page.goto('./?flight=opening-mastery&length=full');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const g=(window as any).__birdSquadGame,r=g.scene.getScene('RouteScene');return g.scene.isActive('RouteScene')&&r.routeEssentialAssetsReady&&r.openFlyway; });
  await page.evaluate(() => { const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');if(r.shouldChooseDistrictContract())r.chooseDistrictContract(r.districtContractChoices()[0].id); });
}
async function ready(page: Page) {
  // Phaser queues restarts until its next frame. Require the new initialization,
  // not the still-ready outgoing battle, before inspecting or driving the scene.
  await page.waitForFunction(() => { const w=window as any,g=w.__birdSquadGame,b=g.scene.getScene('BattleScene');return g.scene.isActive('BattleScene')&&b.battleStartingData!==w.masteryPreviousBattle&&b.mode==='battle'&&b.openingDistrict&&b.combatPreviewModule&&b.discardChoiceModule&&b.returnChoiceModule&&!b.combatIntroActive&&!b.combatAnimationPending; });
}
test.afterEach(async ({page}) => { await page.goto('about:blank'); });

test('Opening mastery teaching order preserves copies and handles missing cards', () => {
  const cards=['wands_ace','swords_ace','pentacles_fledgling','major_00','aviary_25','pentacles_04'].map(id=>({id,cost:1,target:'enemy',runtime:{kind:'crew'}}));
  const taught=orderTeachingHand(cards);
  expect(taught.map(c=>c.id)).toEqual(['major_00','swords_ace','pentacles_fledgling','pentacles_04','wands_ace','aviary_25']);
  expect(new Set(taught)).toEqual(new Set(cards));
  expect(cards[0].id).toBe('wands_ace');
  expect(orderTeachingHand([])).toEqual([]);
});

test('Opening mastery action-first excerpts retain every predicate, target and written order', () => {
  const source=readableHandRules(['If Resonance: Spend 1 Resonance.','If spent Resonance: Deal 2, ignoring Cover.','If no Resonance: Draw 1.','If first played: Gain 1 Cover.','Deal 2 to all.']);
  const face=actionFirstHandRules(source);
  expect(face.split('\n')).toEqual(['Spend 1 Resonance (if Resonance).','Deal 2 damage, ignoring Cover (if this card spent Resonance).','Draw 1 (if no Resonance remains and none was spent).','Gain 1 Cover (first use this fight).','Deal 2 damage to all enemies.']);
  expect(fitHandRules(face,t=>t.length<40).text).toBe('Complex effect\nInspect full rules');
  expect(fitHandRules('Deal 3 damage.\nGain 2 Cover.\nDraw 1.',()=>true).omitted).toBe(0);
});

test('Opening mastery guided battle offers attack and Cover; skip preserves the original hand',async({page},info)=>{
  await route(page);
  await page.evaluate(()=>{
    const w=window as any,r=w.__birdSquadGame.scene.getScene('RouteScene');w.masteryRun=structuredClone(r.runState);
    localStorage.setItem('birdsquad.firstFlightGuide',JSON.stringify({enabled:true,routeCommits:1}));
    r.scene.start('BattleScene',{runState:structuredClone(w.masteryRun),routeNodeId:'m1_entry'});
  });
  await ready(page);
  const hand=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {ids:b.hand.map((c:any)=>c.id),opening:b.openingDraw};});
  expect(hand.ids.slice(0,3)).toEqual(['major_00','swords_ace','pentacles_fledgling']);expect(hand.opening.teachingOrder).toBe(true);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`guided-${size.width}.png`)});}
  await page.evaluate(()=>{const w=window as any,b=w.__birdSquadGame.scene.getScene('BattleScene');w.masteryPreviousBattle=b.battleStartingData;localStorage.setItem('birdsquad.firstFlightGuide',JSON.stringify({enabled:true,routeCommits:1,cardsPlayed:1}));b.scene.restart({runState:w.masteryRun,routeNodeId:'m1_entry'});});
  await ready(page);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').hand.slice(0,3).map((c:any)=>c.id))).toEqual(hand.ids.slice(0,3));
  await page.evaluate(()=>{const w=window as any,b=w.__birdSquadGame.scene.getScene('BattleScene');w.masteryPreviousBattle=b.battleStartingData;localStorage.setItem('birdsquad.firstFlightGuide',JSON.stringify({enabled:false}));b.scene.restart({runState:w.masteryRun,routeNodeId:'m1_entry'});});
  await ready(page);
  expect(await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.hand.slice(0,3).map((c:any)=>c.id);})).toEqual(['major_00','wands_ace','wands_fledgling']);
});

test('Opening mastery full block reports actual prevented damage in one lane',async({page},info)=>{
  await route(page);await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:'m1_entry'});});await ready(page);
  const actual=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');b.flock.block=30;const before=b.statBlocked;b.resolveEnemyTurn();b.time.paused=true;return b.statBlocked-before;});
  expect(actual).toBeGreaterThan(0);await expect(page.locator('#identity-sequence')).toContainText(`Cover blocked all ${actual} damage`);
  await expect(page.locator('#identity-sequence')).toHaveAttribute('aria-label',/0 Cohesion lost/);
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);expect(await page.locator('#identity-sequence').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`blocked-${size.width}.png`)});}
});

for(const [name,id] of [['Hold & Answer','enc_canal_alternating_watch'],['Chorus Engine','enc_canal_open_perch'],['Storm Window','enc_spire_quiet_beat']])
test(`Opening mastery ${name} challenge uses real rules, retries and preserves the saved flight`,async({page},info)=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await route(page);
  const disk=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('birdsquad.'))));
  await page.keyboard.press('j');await page.getByRole('button',{name:'Practice & feedback',exact:true}).click();
  const launch=page.getByRole('button',{name:`Practice ${name}`,exact:true});await expect(launch).toBeVisible();
  for(const size of sizes){await page.setViewportSize(size);await launch.scrollIntoViewIfNeeded();expect(await page.locator('#flyway-book').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`challenge-menu-${size.width}.png`)});}
  await launch.focus();await page.keyboard.press('Enter');await ready(page);
  const start=await page.evaluate(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return {id:b.getTextState().route.currentPayloadId,energy:b.energy,enemy:b.enemies.map((e:any)=>e.runtime.id),practice:b.practiceRematch};});
  expect(start.id).toBe(id);expect(start.practice).toBe(true);expect(start.energy).toBe(3);
  await expect(page.locator('#identity-sequence')).toBeVisible();
  for(const size of sizes){await page.setViewportSize(size);await settleCanvas(page);await page.screenshot({path:info.outputPath(`challenge-${size.width}.png`)});}
  const outcome=await page.evaluate(resolveScriptedBattle,'sheltered');
  expect(outcome.mode).toBe('runComplete');expect(outcome.decisions.length).toBeGreaterThan(1);
  await info.attach('mechanical-outcome',{body:JSON.stringify(outcome),contentType:'application/json'});
  await page.evaluate(()=>{const w=window as any,b=w.__birdSquadGame.scene.getScene('BattleScene');w.masteryPreviousBattle=b.battleStartingData;b.practiceLostFight();});await ready(page);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').getTextState().route.currentPayloadId)).toBe(id);
  const alternative=await page.evaluate(resolveScriptedBattle,'pressure');
  expect(alternative.mode).toBe('runComplete');
  await info.attach('alternative-outcome',{body:JSON.stringify(alternative),contentType:'application/json'});
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').scene.start('MenuScene'));
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('birdsquad.'))))).toEqual(disk);
  expect(errors).toEqual([]);
});

test('Opening mastery showcase choices track recovery and remaining stored force',()=>{
  const enemies=[{hp:30,intentIndex:0,nextAttackBonus:0},{hp:20,intentIndex:0,nextAttackBonus:0}];
  expect(encounterDecision('enc_canal_open_perch',enemies,new Map())).toContain('remove support');
  enemies[0].nextAttackBonus=3;expect(encounterDecision('enc_canal_open_perch',enemies,new Map())).toContain('will not erase');
  enemies.forEach(e=>e.intentIndex=2);
  expect(encounterDecision('enc_canal_alternating_watch',enemies,new Map())).toContain('Both recover');
  expect(encounterDecision('enc_spire_quiet_beat',enemies,new Map())).toContain('Quiet Beat');
});
