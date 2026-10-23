import {test,expect} from '@playwright/test';
import {settleCanvas} from './helpers/settled-canvas';

test('real flight report source preserves large flights, defeat evidence and every unlock',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1000,height:560});await page.goto('./');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('BattleScene',{routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    return s.battleHandRendererModule&&s.fxLayer?.active&&s.hand?.length&&!s.combatInteractionLocked()&&!s.battleRenderQueued;});
  await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    s.retireCombatFxForOutcome();s.mode='defeat';s.emitRunSummary('loss');s.renderAll();});
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').bossDossierModule);
  await settleCanvas(page);
  const source=await page.evaluate(()=>{
    const w=window as any,s=w.__birdSquadGame.scene.getScene('BattleScene');
    const fatal='An extraordinarily long incoming attack name '.repeat(8);
    const summary={...w.__birdSquadLastRun,killedBy:fatal,
      deck:Array.from({length:110},(_,i)=>({id:i===109?'wands_ace':'major_00',upgraded:i%2===0})),
      path:Array.from({length:44},(_,i)=>`complete-stop-${i}`),finalNodeId:'complete-stop-43',
      signals:Array.from({length:18},(_,i)=>({signalId:`complete-signal-${i}`,choiceKey:`choice-${i}`})),
      combatResults:[{nodeId:'complete-stop-43',damageDealt:27,cohesionLost:38,killedByMove:fatal,
        damageTakenByMove:[{enemyId:'roof_rat',moveId:'strike',moveLabel:fatal,damageTaken:38,blockedDamage:0,hitCount:4}]}],
      decisionStats:{cardsPlayed:22,overextensions:0,lowCardTurns:0,unspentWingbeatAtRoost:0,blockedDamage:0}};
    w.__birdSquadLastRun=summary;
    const unlocks=Array.from({length:6},(_,i)=>({id:`complete-unlock-${i}`,kind:'record',
      name:`Complete progress record ${i}`,description:`Preserve the complete description ${i}.`}));
    s.outcomeUnlockHighlights=()=>unlocks;s.renderAll();
    return {details:s.outcomeFlightDetails(),review:s.bossDossierModule.buildDefeatReview(summary),unlocks};
  });
  expect(source.details.deck).toHaveLength(110);expect(source.details.path).toHaveLength(44);
  expect(source.details.path.at(-1)).toContain('complete-stop-43');
  expect(source.details.decisions.filter((line:string)=>line.startsWith('Signal ·'))).toHaveLength(18);
  expect(source.details.decisions.join('\n')).toContain('complete-signal-17: choice-17');
  for(const value of [source.review.headline,source.review.evidence,source.review.tip,source.review.replayNote])
    expect(source.details.results).toContain(value);
  for(const unlock of source.unlocks)expect(source.details.results).toContain(`${unlock.name}: ${unlock.description}`);
  for(const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]){
    await page.setViewportSize(size);await settleCanvas(page);
    const geometry=await page.evaluate(()=>{const s=(window as any).__birdSquadGame.scene.getScene('BattleScene');
      const frame=s.root.getByName('run-defeat-review').getBounds();
      return ['headline','evidence','tip'].map(suffix=>{const text=s.root.getByName(`run-defeat-review-${suffix}`),b=text.getBounds();
        return {text:text.text,full:text.getData('fullText'),truncated:text.getData('truncated'),
          inside:b.left>=frame.left&&b.right<=frame.right&&b.top>=frame.top&&b.bottom<=frame.bottom};});});
    for(const item of geometry){expect(item.inside,JSON.stringify(item)).toBe(true);expect(item.truncated).toBe(true);expect(item.text).toMatch(/…$/);expect(item.full.length).toBeGreaterThan(item.text.length);}
    await page.screenshot({path:info.outputPath(`complete-outcome-${size.width}.png`)});
  }
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').openOutcomeFlightDetails());
  const read=()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').root
    .getByName('run-flight-details-section-body').getData('reading'));
  const first=await read(),visited:Array<{title:string;text:string}>=[];
  for(let i=0;i<first.total;i++){const value=await read();expect(value.page).toBe(i+1);visited.push(value);await page.keyboard.press('PageDown');}
  const joined=(prefix:string)=>visited.filter(p=>p.title.startsWith(prefix)).map(p=>p.text).join('\n').replace(/\s/g,'');
  for(const [key,title] of [['deck','FINAL DECK'],['path','ROUTE PATH'],['decisions','DECISIONS'],['results','RESULTS']] as const)
    expect(joined(title)).toBe(source.details[key].join('\n').replace(/\s/g,''));
  await info.attach('complete-source',{body:JSON.stringify(source),contentType:'application/json'});
  expect(errors).toEqual([]);
});
