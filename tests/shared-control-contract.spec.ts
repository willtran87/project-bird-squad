import { test, expect, type Page } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import { installVirtualController, pressController } from './helpers/virtual-controller';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';

test.use({ hasTouch: true });
const sizes = [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }];
async function boot(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await settleCanvas(page);
}
async function click(page: Page, scene: string, name: string, touch = false) {
  const point = await page.evaluate(({ scene, name }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene);
    const walk = (list: any[]): any[] => list.flatMap(o => [o, ...(o.list ? walk(o.list) : [])]);
    const hit = walk(s.children.list).find(o => o.name === name && o.active && o.visible && o.input?.enabled);
    if (!hit) throw new Error(`Missing ${scene}/${name}`);
    const b = hit.getBounds(), c = s.game.canvas.getBoundingClientRect();
    return { x: c.left + b.centerX * c.width / 1280, y: c.top + b.centerY * c.height / 720 };
  }, { scene, name });
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  await settleCanvas(page);
}

test('shared controls preserve focus on hover, repaint dynamic disabled state and keep fixed geometry', async ({ page }, info) => {
  await boot(page);
  for (const size of sizes) {
    await page.setViewportSize(size); await settleCanvas(page);
    const checks = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      const hit = s.children.list.find((o: any) => o.getData?.('focus') === 'primaryRun');
      const label = hit.getData('labelObject');
      const before = hit.getBounds();
      hit.setData('focused', true); hit.emit('pointerover'); hit.emit('pointerout');
      const focusSurvives = hit.lineWidth === 3;
      hit.setData('enabled', false);
      const disabled = { input: Boolean(hit.input?.enabled), fill: hit.fillColor, color: label.style.color };
      hit.emit('pointerdown'); // Scene callers must not bypass disabled state either.
      const unchangedScene = s.scene.isActive();
      hit.setData('enabled', true); hit.setData('selected', true); hit.setData('focused', false);
      hit.emit('pointerover'); hit.emit('pointerout');
      const selected = label.style.fontStyle === 'bold' && hit.getData('selected');
      hit.setVisible(false); hit.emit('pointerdown');
      const hiddenSafe = s.scene.isActive(); hit.setVisible(true);
      hit.disableInteractive(); hit.emit('pointerdown');
      const inputSafe = s.scene.isActive(); hit.setInteractive({useHandCursor:true});
      const after = hit.getBounds(), scale = s.game.canvas.getBoundingClientRect().width / 1280;
      hit.setData('selected', false);
      return { focusSurvives, disabled, unchangedScene, selected, hiddenSafe, inputSafe,
        geometry: before.x === after.x && before.y === after.y && before.width === after.width && before.height === after.height,
        target: after.width * scale >= 44 && after.height * scale >= 44,
        text: parseFloat(label.style.fontSize) * scale >= 16, complete: !label.getData('truncated'),
        enabledAgain: Boolean(hit.input?.enabled) };
    });
    expect(checks).toEqual({ focusSurvives: true, disabled: { input: false, fill: 0x18232c, color: '#a2b1ba' },
      unchangedScene: true, selected: true, hiddenSafe: true, inputSafe: true, geometry: true, target: true, text: true, complete: true, enabledAgain: true });
    await page.screenshot({ path: info.outputPath(`title-${size.width}.png`) });
  }
});

test('primary and utility states retain readable contrast, visible recovery and unchanged bounds', async ({page},info)=>{
  await boot(page);
  for(const size of sizes){
    await page.setViewportSize(size);await settleCanvas(page);
    for(const state of ['hover','focus','selected','armed','disabled','loading','error']){
      const checks=await page.evaluate(state=>{
        const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
        const luminance=(n:number)=>{const rgb=[n>>16&255,n>>8&255,n&255].map(c=>{const x=c/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
        const ratio=(a:number,b:number)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
        return ['primaryRun','configure'].map(focus=>{
          const h=s.children.list.find((o:any)=>o.getData?.('focus')===focus),before=h.getBounds();
          h.setData({enabled:true,selected:state==='selected',focused:state==='focus',hovered:state==='hover',status:'idle'});
          if(state==='disabled')h.setData('enabled',false);
          if(['armed','loading','error'].includes(state))h.setData({statusLabel:state==='armed'?'Confirm choice':state==='loading'?'Loading…':'Failed · Retry',status:state});
          const t=h.getData('labelObject'),b=h.getBounds(),z=t.getBounds();
          if(state==='disabled'||state==='loading')h.emit('pointerdown');
          return {role:h.getData('controlKind'),enabled:!!h.input?.enabled,status:h.getData('status'),
            stable:before.x===b.x&&before.y===b.y&&before.width===b.width&&before.height===b.height,
            visible:h.fillAlpha===1&&h.strokeAlpha===1,weight:h.lineWidth,
            contrast:ratio(parseInt(t.style.color.slice(1),16),h.fillColor),
            indicator:ratio(h.strokeColor,h.fillColor),
            fits:z.left>=b.left+4&&z.right<=b.right-4&&z.top>=b.top+4&&z.bottom<=b.bottom-4,
            text:t.text,scene:s.scene.isActive()};
        });
      },state);
      expect(checks.map(c=>c.role)).toEqual(['primary','utility']);
      for(const c of checks){
        expect(c).toMatchObject({stable:true,visible:true,fits:true,scene:true,enabled:!['disabled','loading'].includes(state)});
        expect(c.contrast).toBeGreaterThanOrEqual(4.5);
        if(['focus','hover','error'].includes(state))expect(c.indicator).toBeGreaterThanOrEqual(3);
        if(state==='focus')expect(c.weight).toBe(3);
        if(state==='hover')expect(c.weight).toBe(2);
      }
      await page.screenshot({path:info.outputPath(`state-${state}-${size.width}.png`)});
    }
  }
});

test('shared pause and exit controls are readable, separated and cannot accidentally abandon a flight', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await page.evaluate(async () => {
    const w = window as any;
    await w.__birdSquadEnsureScene('RouteScene'); w.__birdSquadGame.scene.stop('MenuScene');
    w.__birdSquadGame.scene.start('RouteScene');
  });
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').routeEssentialAssetsReady);
  const saved = await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState));
  for (const size of sizes) {
    await page.setViewportSize(size); await page.keyboard.press('Escape'); await settleCanvas(page);
    await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('RouteScene').children.getByName('pause-abandon-hit'));
    checkTargetGeometry(await targetGeometry(page,'RouteScene'),'pause commands');
    const pause = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('RouteScene'), scale = s.game.canvas.getBoundingClientRect().width / 1280;
      return s.children.list.filter((o: any) => o.getData?.('controlKind')).map((hit: any) => {
        const l = hit.getData('labelObject'), b = hit.getBounds(), t = l.getBounds();
        return { name: hit.name, target: b.width * scale >= 44 && b.height * scale >= 44,
          readable: parseFloat(l.style.fontSize) * scale >= 16, full: !l.getData('truncated'),
          contained: t.left >= b.left + 4 && t.right <= b.right - 4 && t.top >= b.top + 4 && t.bottom <= b.bottom - 4 };
      });
    });
    expect(pause.length).toBeGreaterThanOrEqual(4);
    for (const check of pause) expect(check).toMatchObject({ target: true, readable: true, full: true, contained: true });
    await page.screenshot({ path: info.outputPath(`pause-${size.width}.png`) });
    await click(page, 'RouteScene', 'pause-abandon-hit', true);
    checkTargetGeometry(await targetGeometry(page,'RouteScene'),'abandon confirmation');
    const confirmation = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('RouteScene');
      const keep = s.children.getByName('route-confirm-exit-keep-hit'), abandon = s.children.getByName('route-confirm-exit-abandon-hit');
      const hint = s.children.getByName('route-confirm-exit-escape-hint');
      const subtitle = s.children.getByName('route-confirm-exit-subtitle');
      const scale = s.game.canvas.getBoundingClientRect().width / 1280;
      return { keep: keep.getData('controlKind'), abandon: abandon.getData('controlKind'),
        gap: abandon.getBounds().left - keep.getBounds().right,
        readable: [hint, subtitle].every(t => parseFloat(t.style.fontSize) * scale >= 14),
        copyFits: subtitle.getBounds().bottom < keep.getBounds().top - 12 && hint.getBounds().top > keep.getBounds().bottom + 12 };
    });
    expect(confirmation).toMatchObject({ keep: 'primary', abandon: 'destructive', readable: true, copyFits: true });
    expect(confirmation.gap).toBeGreaterThanOrEqual(8);
    await page.screenshot({ path: info.outputPath(`confirm-${size.width}.png`) });
    await page.keyboard.press('Escape'); await settleCanvas(page);
    expect(await page.evaluate(() => JSON.stringify((window as any).__birdSquadGame.scene.getScene('RouteScene').runState))).toBe(saved);
  }
  expect(errors).toEqual([]);
});

test('guide controls keep focus, honor disabled state on every input and release their input owner on close', async ({ page }, info) => {
  test.setTimeout(90000);
  await installVirtualController(page);
  await boot(page);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').openHelpOverlay());
  await page.waitForFunction(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay?.list
    .some((o: any) => o.getData?.('label') === 'Practice lessons'));
  for (const size of sizes) {
    await page.setViewportSize(size); await settleCanvas(page);
    const geometry = await page.evaluate(() => {
      const s = (window as any).__birdSquadGame.scene.getScene('MenuScene');
      const list = s.helpOverlay.list.filter((o: any) => o.visible), scale = s.game.canvas.getBoundingClientRect().width / 1280;
      const texts = list.filter((o: any) => o.type === 'Text');
      const bounds = texts.map((o: any) => ({ ...o.getBounds(), label: o.text }));
      const tipBottom = Math.max(...texts.filter((o: any) => o.name === 'how-to-play-tip-value').map((o: any) => o.getBounds().bottom));
      const actionTop = Math.min(...list.filter((o: any) => ['Practice lessons', 'Skip Guide', 'Replay Guide'].includes(o.getData?.('label'))).map((o: any) => o.getBounds().top));
      return { readable: texts.every((o: any) => parseFloat(o.style.fontSize) * scale >= 14),
        footerClearance: (actionTop - tipBottom) * scale >= 8,
        inside: texts.every((o: any) => { const b=o.getBounds(); return b.left>=60 && b.right<=1220 && b.top>=30 && b.bottom<=690; }),
        overlaps: bounds.flatMap((a: any, i: number) => bounds.slice(i+1).filter((b: any) =>
          a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y).map((b: any) => [a.label,b.label])) };
    });
    expect(geometry).toEqual({ readable: true, footerClearance: true, inside: true, overlaps: [] });
    await page.screenshot({ path: info.outputPath(`guide-${size.width}.png`) });
  }
  const disable = () => page.evaluate(() => {
    const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
    const hit=s.helpOverlay.list.find((o:any)=>o.getData?.('label')==='Practice lessons');
    hit.setData('enabled', false); return s.helpOverlay.getData('topic') ?? '';
  });
  const initial = await disable();
  await page.keyboard.press('Enter'); await pressController(page,0); await settleCanvas(page);
  expect(await page.evaluate(() => {
    const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
    return { topic:s.helpOverlay.getData('topic') ?? '', loading:Boolean(s.helpOverlay.getData('practiceLoading')) };
  })).toEqual({topic:initial,loading:false});
  await page.evaluate(() => {
    const s=(window as any).__birdSquadGame.scene.getScene('MenuScene');
    const hit=s.helpOverlay.list.find((o:any)=>o.getData?.('label')==='Practice lessons');
    hit.setData('enabled',true);
    hit.getData('caption').setText('Live lesson label');
    hit.emit('pointerover');hit.emit('pointerout');
    (window as any).oldGuide=s.helpOverlay;
  });
  expect(await page.evaluate(() => {
    const h=(window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay.list.find((o:any)=>o.getData?.('label')==='Practice lessons');
    return {label:h.getData('caption').text,focus:h.lineWidth};
  })).toEqual({label:'Live lesson label',focus:3});
  await page.keyboard.press('Escape'); await settleCanvas(page);
  expect(await page.evaluate(() => !(window as any).oldGuide.active)).toBe(true);
  await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').openHelpOverlay());
  await settleCanvas(page);
  // Reopening has one owner, so one Tab advances one action, not two.
  await page.keyboard.press('Tab'); await settleCanvas(page);
  expect(await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('MenuScene').helpOverlay.list
    .find((o:any)=>o.name==='how-to-play-actions').getData('actionFocus').index)).toBe(1);
  await page.keyboard.press('Escape');
});
