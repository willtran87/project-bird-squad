import {test, expect} from '@playwright/test';
import { installVirtualController, pressController, controllerButton } from './helpers/virtual-controller';

test('remapped Help keeps J and Shift+J while F8 opens Flyway across scenes',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('birdsquad.controlBindings',JSON.stringify({version:1,bindings:{guide:'KeyJ'}})));
  await page.goto('/');
  await expect(page.locator('#flyway-launch')).toContainText('F8');
  await expect(page.locator('#flyway-launch')).toHaveAttribute('aria-label',/Keyboard F8/);
  await page.keyboard.press('F8');await expect(page.locator('#flyway-book')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#flyway-book')).toHaveCount(0);
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('MenuScene'));
  await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('MenuScene').startRun());
  await page.waitForFunction(()=>{const s=(window as any).__birdSquadGame.scene.getScene('RouteScene');return s.routeEssentialAssetsReady&&s.openFlyway;});
  await page.keyboard.press('F8');await expect(page.locator('#flyway-book')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.isActive('RouteScene'));
  await page.evaluate(()=>{const r=(window as any).__birdSquadGame.scene.getScene('RouteScene');r.scene.start('BattleScene',{runState:structuredClone(r.runState),routeNodeId:'m1_entry'});});
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.openFlyway&&b.battleHandRendererModule&&b.fxLayer?.active&&!b.combatIntroActive&&!b.combatAnimationPending;});
  await page.keyboard.press('j');
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.getData('kind'))).toBe('card');
  await expect(page.locator('#flyway-book')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  await page.keyboard.press('Shift+j');
  await expect.poll(()=>page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.getData('kind'))).toBe('history');
  await expect(page.locator('#flyway-book')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!(window as any).__birdSquadGame.scene.getScene('BattleScene').combatCardDetail?.active);
  await page.keyboard.press('F8');await expect(page.locator('#flyway-book')).toBeVisible();
});

test('controller confirmation opens a Preen without reusing held A to cancel it',async({page})=>{
  await installVirtualController(page);
  await page.goto('/');
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await page.evaluate(async()=>{
    const w=window as any;await w.__birdSquadEnsureScene('BattleScene');
    w.__birdSquadGame.scene.stop('MenuScene');w.__birdSquadGame.scene.start('BattleScene',{routeNodeId:'m1_entry'});
  });
  await page.waitForFunction(()=>{const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');return b.openFlyway&&b.battleHandRendererModule&&!b.combatIntroActive&&!b.combatAnimationPending;});
  await page.evaluate(()=>{
    const b=(window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.upgradeChoices=[b.allDeckCards().find((c:any)=>c.id==='pentacles_04')];
    b.mode='upgradeReward';b.controllerChoiceIndex=0;b.battleInputActive=true;b.renderAll();
  });
  await page.waitForFunction(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').rewardPresentationReady());
  await pressController(page,0);
  await controllerButton(page,0,true);
  await expect(page.getByRole('dialog',{name:'Choose this bird’s Preen'})).toBeVisible();
  await controllerButton(page,0,false);
  await pressController(page,15);
  await expect(page.getByRole('button',{name:'Choose Shelter',exact:true})).toBeFocused();
  await pressController(page,0);
  await expect(page.locator('#flyway-book')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__birdSquadGame.scene.getScene('BattleScene').allDeckCards().some((c:any)=>c.id==='pentacles_04'&&c.upgraded&&c.preenBranch==='shelter'))).toBe(true);
});
