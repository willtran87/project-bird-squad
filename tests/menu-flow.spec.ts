import { test, expect, type Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}'));
async function battle(page: Page) {
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('BattleScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('BattleScene', { routeNodeId: 'm1_entry' });
  });
  await page.waitForFunction(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    return b.scene.isActive() && b.fxLayer?.active && b.hand?.length && !b.combatAnimationPending;
  });
  await page.waitForTimeout(1500);
}

test.beforeEach(async ({page}) => {
  await page.setViewportSize({width:2560,height:1600});
  await page.goto('./');
  await expect.poll(async () => (await snapshot(page)).titleFocus?.current).toBe('primaryRun');
});

test('quiet menu preserves setup, utilities, and a one-press start', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const v of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(v);
    await page.screenshot({path:info.outputPath(`menu-${v.width}.png`)});
  }
  expect(await page.evaluate(() => {
    const m = (window as any).__birdSquadGame.scene.getScene('MenuScene');
    return {
      utilities: m.children.list.filter((o:any) => o.name === 'title-utility-hit').length,
      leaders: m.leaderPanels.length,
      goalStrip: m.children.list.some((o:any) => o.name === 'title-collection-goal-hit'),
      leaderFrames: m.children.list.filter((o:any) => o.name === 'title-leader-card-frame').length,
      setup: m.children.list.find((o:any) => o.name === 'title-setup-surface')?.fillAlpha,
    };
  })).toEqual({utilities:4, leaders:5, goalStrip:false, leaderFrames:0, setup:1});
  expect((await snapshot(page)).setupOpen).toBe(false);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').leaderPanels.every((p:any)=>!p.rect.visible&&!p.rect.input.enabled))).toBe(true);
  await page.keyboard.press('Tab'); // Flight setup
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).setupOpen).toBe(true);
  await page.keyboard.press('Tab'); // difficulty
  await page.keyboard.press('Tab'); // flight length
  await page.keyboard.press('ArrowRight');
  expect((await snapshot(page)).selectedRunMode).toBe('quick');
  await page.keyboard.press('Shift+Tab'); // difficulty
  await page.keyboard.press('Shift+Tab'); // leader
  await page.keyboard.press('ArrowRight');
  expect((await snapshot(page)).selectedLeader).toBe('spark_caller');
  await page.keyboard.press('s');
  await expect.poll(async () => (await snapshot(page)).settingsOpen).toBe(true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('h');
  await expect.poll(async () => (await snapshot(page)).helpOpen).toBe(true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect((await snapshot(page)).titleFocus.current).toBe('primaryRun');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('RouteScene');
  const run = await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState);
  expect(run.leaderId).toBe('spark_caller');
  expect(run.runMode).toBe('quick');
  await expect.poll(async () => (await snapshot(page)).routeAssetsReady).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__birdSquadGame.scene.getScene('RouteScene');
    r.openRouteCollectionGoals(); // Persist through the real navigation path.
  });
  await expect.poll(async () => (await snapshot(page)).mode).toBe('codex');
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('CodexScene').scene.start('MenuScene'));
  await expect.poll(async () => (await snapshot(page)).scene).toBe('MenuScene');
  await page.screenshot({path:info.outputPath('menu-resume.png')});
  // Saved-flight entry is the primary action, never an accidental new run.
  expect((await snapshot(page)).titleFocus.label).toBe('Continue Run');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).scene).toBe('RouteScene');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').runState.seed)).toBe(run.seed);
  expect(errors).toEqual([]);
});

test('highest Ascension keeps cumulative modifiers readable at the minimum viewport', async ({page}, info) => {
  await page.setViewportSize({width:1000,height:560});
  const result = await page.evaluate(() => {
    localStorage.setItem('birdsquad.maxTier','6');
    const m=(window as any).__birdSquadGame.scene.getScene('MenuScene');
    m.setSetupOpen(true);
    m.stepDifficulty(6);
    const label=m.difficultyLabelText.getBounds(), description=m.difficultyDescText.getBounds();
    return {label:m.difficultyLabelText.text,description:m.difficultyDescText.text,
      labelLeft:label.left,labelRight:label.right,descBottom:description.bottom,descLeft:description.left,descRight:description.right};
  });
  expect(result.label).toBe('Tier 6');
  expect(result.description).toContain('HP x1.30');
  expect(result.description).toContain('Tells reroute');
  expect(result.labelLeft).toBeGreaterThan(170);
  expect(result.labelRight).toBeLessThan(530);
  expect(result.descLeft).toBeGreaterThanOrEqual(80);
  expect(result.descRight).toBeLessThanOrEqual(620);
  expect(result.descBottom).toBeLessThan(570);
  await page.screenshot({path:info.outputPath('menu-tier-6-1000.png')});
});

// Deterministic scene time verifies programmed pacing independently of software
// WebGL / CI frame stalls. This is sequencing coverage, not an FPS benchmark.
for (const pace of ['standard', 'snappy', 'cinematic']) {
  test(`fluid enemy turn: ${pace} preserves impact and restores input`, async ({page}, info) => {
    await page.evaluate(pace => localStorage.setItem('birdsquad.combatPace', pace), pace);
    await battle(page);
    const result = await page.evaluate(() => {
      const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
      const enemy = b.enemies[0];
      const move = { id:'fluid_strike', label:'Measured Strike', effects:['damage(4)'] };
      enemy.runtime.moves = [move]; enemy.runtime.attackPattern = {type:'cycle',moveIds:[move.id]}; enemy.intentIndex=0;
      b.enemies = [enemy]; b.hand=[]; b.flock.block=0; b.flock.hp=b.flock.maxHp;
      const hp = b.flock.hp, turn = b.turn;
      const firstScale = b.enemyMoveTimingScale(enemy, move);
      const samples: any[] = [];
      let tellWidth=0, doubleTell=false, staleTell=false;
      const started = b.time.now;
      b.endTurnAnimated();
      for (let i=0; i<1200 && b.combatAnimationPending; i++) {
        samples.push({beat:b.combatEnemyTurnBeat, hp:b.flock.hp, elapsed:b.time.now-started});
        if (b.combatEnemyTurnBeat === 'windup') {
          tellWidth=Math.max(tellWidth,...b.fxLayer.list.filter((o:any)=>o.name==='combat-enemy-attack-tell').map((o:any)=>o.displayWidth));
          doubleTell ||= b.fxLayer.list.some((o:any)=>o.name==='combat-threat-charge');
        }
        if (b.combatEnemyTurnBeat === 'release') staleTell ||= b.fxLayer.list.some((o:any)=>o.name==='combat-enemy-attack-tell');
        (window as any).advanceTime(10);
      }
      const repeatedScale = b.enemyMoveTimingScale(enemy, move);
      return {samples, hp, afterHp:b.flock.hp, turn, afterTurn:b.turn, pending:b.combatAnimationPending,
        elapsed:b.time.now-started, firstScale, repeatedScale, hand:b.hand.length,tellWidth,doubleTell,staleTell};
    });
    expect(result.pending).toBe(false);
    expect(result.afterTurn).toBe(result.turn+1);
    expect(result.hand).toBeGreaterThan(0);
    expect(result.tellWidth).toBeGreaterThan(0);
    if (pace !== 'cinematic') expect(result.tellWidth).toBeLessThan(180);
    expect(result.doubleTell).toBe(pace === 'cinematic');
    expect(result.staleTell).toBe(false);
    expect(result.afterHp).toBeLessThan(result.hp);
    const preImpact = result.samples.filter(s => ['preamble','windup','release'].includes(s.beat));
    expect(preImpact.length).toBeGreaterThan(0);
    expect(preImpact.every(s => s.hp === result.hp)).toBe(true);
    const hit = result.samples.find(s => s.hp < result.hp);
    expect(hit?.beat).toBe('impact');
    expect(result.elapsed).toBeLessThan(pace === 'cinematic' ? 11000 : pace === 'standard' ? 1750 : 1400);
    if (pace !== 'cinematic') {
      const windup = result.samples.filter(s => s.beat === 'windup');
      expect(windup.at(-1)!.elapsed - windup[0].elapsed).toBeGreaterThanOrEqual(pace === 'standard' ? 650 : 470);
      const release = result.samples.find(s => s.beat === 'release');
      expect(hit!.elapsed - release!.elapsed).toBeLessThanOrEqual(230);
      expect(result.samples.filter(s => s.beat === 'impact').every(s => s.hp < result.hp)).toBe(true);
      expect(result.elapsed - hit!.elapsed).toBeLessThan(600);
    }
    expect(result.firstScale).toBe(pace === 'cinematic' ? 1 : pace === 'standard' ? 0.38 : 0.28);
    expect(result.repeatedScale).toBe(pace === 'cinematic' ? 1 : pace === 'standard' ? 0.24 : 0.18);
    console.log(`${pace}: ${Math.round(result.elapsed)} ms enemy turn, impact ${Math.round(hit!.elapsed)} ms`);
    await page.screenshot({path:info.outputPath(`ready-${pace}.png`)});
  });
}

test('player cards resolve within a short feedback window without queuing a second play', async ({page}) => {
  await battle(page);
  const result = await page.evaluate(() => {
    const b = (window as any).__birdSquadGame.scene.getScene('BattleScene');
    b.energy=99;
    const enemy=b.enemies[0], card=b.hand[0], hp=enemy.hp, started=b.time.now;
    const played=b.statCardsPlayed, passes=b.battleRenderPasses;
    const rootObjects=[...b.root.list];
    const cardObjects=b.handCardRects.get(card.instanceId).getData('presentation');
    b.playCardAnimated(card,enemy.id);
    const stableCommit=rootObjects.every((o:any,i:number)=>b.root.list[i]===o);
    const cardRetired=cardObjects.every((o:any)=>!o.visible&&(!o.input||!o.input.enabled));
    const energyMatches=b.root.getByName('hud-value-Wingbeats').text.startsWith(`${b.energy}/`);
    const heldHp=enemy.hp;
    const next=b.hand[0]; b.onCardClicked(next.instanceId); b.onCardClicked(next.instanceId);
    while (b.combatAnimationPending && b.time.now-started<2000) (window as any).advanceTime(10);
    return {elapsed:b.time.now-started,hp,heldHp,afterHp:enemy.hp,played:b.statCardsPlayed-played,
      selected:b.selectedInstanceId,next:next.instanceId,pending:b.combatAnimationPending, passes:b.battleRenderPasses-passes,stableCommit,cardRetired,energyMatches};
  });
  expect(result.heldHp).toBe(result.hp);
  expect(result.afterHp).toBeLessThan(result.hp);
  expect(result.elapsed).toBeLessThan(500);
  expect(result.pending).toBe(false);
  expect(result.played).toBe(1);
  expect(result.passes).toBe(1);
  expect(result.selected).toBe(result.next);
  expect(result.stableCommit).toBe(true);
  expect(result.cardRetired).toBe(true);
  expect(result.energyMatches).toBe(true);
});

test('flight setup closes by controller and preserves choices without hidden hit targets', async ({page},info) => {
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    const m=(window as any).__birdSquadGame.scene.getScene('MenuScene');
    m.input.gamepad.emit('down',{}, {index:1},1);
  });
  expect((await snapshot(page)).setupOpen).toBe(false);
  expect((await snapshot(page)).titleFocus.current).toBe('configure');
  expect((await snapshot(page)).selectedLeader).toBe('spark_caller');
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setupObjects.every((o:any)=>!o.visible&&(!o.input||!o.input.enabled)))).toBe(true);
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).setupOpen).toBe(true);
  expect((await snapshot(page)).selectedLeader).toBe('spark_caller');
  await page.screenshot({path:info.outputPath('flight-setup-reopened.png')});
});

test('dedicated setup and settings remove competing chrome at every supported size', async ({page}, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const clickNamed = async (name: string) => {
    const point = await page.evaluate(name => {
      const m=(window as any).__birdSquadGame.scene.getScene('MenuScene');
      const list=m.settingsOverlay?.list ?? m.children.list;
      const object=list.find((o:any)=>o.name===name);
      const bounds=m.game.canvas.getBoundingClientRect();
      return {x:bounds.x+object.x*bounds.width/1280,y:bounds.y+object.y*bounds.height/720};
    },name);
    await page.mouse.click(point.x,point.y);
  };
  for (const size of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]) {
    await page.setViewportSize(size);
    await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').setSetupOpen(true));
    expect(await page.evaluate(() => {
      const m=(window as any).__birdSquadGame.scene.getScene('MenuScene');
      return {logo:m.children.getByName('title-logo').visible,
        utilities:m.children.list.filter((o:any)=>o.name==='title-utility-hit'&&(o.visible||o.input.enabled)).length,
        focus:m.menuFocusOrder(),
        leaders:m.leaderPanels.map((p:any)=>p.rect.getBounds().bottom),
        modeTop:[...m.runModeViews.values()].map((v:any)=>v.hit.getBounds().top)};
    })).toEqual({logo:false,utilities:0,focus:['leader','difficulty','runMode','primaryRun','configure'],leaders:[286,286,286,286,286],modeTop:[450,450]});
    await page.mouse.move(0,0);
    await page.screenshot({path:info.outputPath(`setup-${size.width}.png`)});
    await page.keyboard.press('Enter'); // Leader details must not cover Settings.
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').leaderTooltip?.active);
    await page.screenshot({path:info.outputPath(`leader-details-${size.width}.png`)});
    await page.keyboard.press('s');
    await expect.poll(async () => (await snapshot(page)).settingsOpen).toBe(true);
    await page.waitForFunction(() => {
      const m=(window as any).__birdSquadGame.scene.getScene('MenuScene');
      return !m.load.isLoading() && m.settingsOverlay?.list.some((o:any)=>o.name==='system-quiet-menu-panel');
    });
    await page.waitForTimeout(150); // Include the deferred asset-refresh frame.
    expect(await page.evaluate(() => Boolean((window as any).__birdSquadGame.scene.getScene('MenuScene').leaderTooltip?.active))).toBe(false);
    for (const section of [0,1,2,3]) {
      await clickNamed(`system-settings-section-${section}-hit`);
      await page.screenshot({path:info.outputPath(`settings-${section}-${size.width}.png`)});
    }
    expect(await page.evaluate(() => {
      const m=(window as any).__birdSquadGame.scene.getScene('MenuScene');
      return m.settingsOverlay.list.filter((o:any)=>o.texture?.key?.includes('system-settings-')).length;
    })).toBe(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect((await snapshot(page)).setupOpen).toBe(false);
  }
  expect(errors).toEqual([]);
});
