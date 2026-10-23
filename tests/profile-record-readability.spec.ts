import { test, expect } from '@playwright/test';
import { settleCanvas } from './helpers/settled-canvas';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {targetGeometry,checkTargetGeometry} from './helpers/target-geometry';

const cardIds=(JSON.parse(readFileSync(new URL('../data/game/alpha-cards.json',import.meta.url),'utf8')) as {cards:{id:string}[]}).cards.map(c=>c.id);

test.use({ hasTouch: true });

for (const count of [0, 50]) test(`record readers preserve readable text, separated controls and saved data: ${count} flights`, async ({ page }, info) => {
  test.setTimeout(120_000); // Real export/replace/restore followed by the three-size state matrix.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({count,cardIds}) => {
    if(sessionStorage.getItem('record-layout-seeded'))return;
    sessionStorage.setItem('record-layout-seeded','1');
    const runs = Array.from({ length: count }, (_, i) => ({ id: `run-${Date.now() - i * 60000}-${i}`,
      seed: 'record-readability-long-seed-' + i, result: i % 2 ? 'loss' : 'win', leaderId: 'fledgling', difficulty: 3,
      runMode: 'full', mapId: 'map_01_rooftop_blocks', finalNodeId: 'm1_entry', turnsTaken: 123,
      durationMs: 987654, currentCohesion: 0, maxCohesion: 38, path: ['m1_entry'],
      deck: [{ id: 'wands_ace' }], routeMarks: [], suppliesUsed: [], signals: [], combatResults: [],
    }));
    localStorage.setItem('birdsquad.runs', JSON.stringify(runs));
    localStorage.setItem('birdsquad.runs.backup', JSON.stringify(runs));
    const decks=count?Array.from({length:30},(_,i)=>({id:`restore-max-${i}`,lineageId:`lineage-${i}`,revision:99,
      name:'W'.repeat(32),description:'W'.repeat(120),notes:'W'.repeat(240),leaderId:'fledgling',
      createdAt:100+i,updatedAt:100+i,archived:i>=6,favorite:i===0,runMode:'full',
      cards:cardIds.slice(0,60).map((id,j)=>({id,upgraded:j%2===0}))})):[];
    const account=JSON.stringify({runs:count,wins:count/2,losses:count/2,decks,discoveredCards:count?cardIds:[]});
    for(const key of ['birdsquad.account','birdsquad.account.backup'])localStorage.setItem(key,account);
  }, {count,cardIds});
  await page.setViewportSize({ width: 2560, height: 1600 }); await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
  await page.evaluate(async () => {
    const w = window as any; await w.__birdSquadEnsureScene('ProfileScene');
    for (const s of w.__birdSquadGame.scene.getScenes(true)) w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('ProfileScene');
  });
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text()).scene === 'ProfileScene');
  await page.waitForFunction(() => !(window as any).__birdSquadGame.scene.getScene('ProfileScene').cameras.main.fadeEffect.isRunning);
  // Exercise the real file workflow, rather than only constructing a pending
  // preview in memory. The subsequent matrix renders the restored data.
  const tap=async(name:string)=>{
    await settleCanvas(page);
    await page.waitForFunction(name=>{
      const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');
      if(!s||s.load.isLoading())return false;
      const h=s.children.getByName(name);if(!h?.input?.enabled)return false;
      const p={x:h.x,y:h.y,camera:s.cameras.main};
      const hits=s.input.manager.hitTest(p,s.input._list,s.cameras.main,[]);
      s.input.sortGameObjects(hits,p);return hits[0]===h;
    },name);
    const point=await page.evaluate(name=>{const s=(window as any).__birdSquadGame.scene.getScene('ProfileScene');
      const h=s.children.getByName(name),c=s.game.canvas.getBoundingClientRect();
      return{x:c.left+h.x*c.width/1280,y:c.top+h.y*c.height/720};},name);
    await page.touchscreen.tap(point.x,point.y);await settleCanvas(page);
  };
  await tap('profile-save-data-hit');
  const downloading=page.waitForEvent('download');await tap('profile-save-download-hit');
  await expect.poll(()=>page.evaluate(()=>JSON.parse((window as any).render_game_to_text()).saveData?.status)).toBe('downloaded');
  const downloaded=await (await downloading).path();expect(downloaded).toBeTruthy();
  const raw=await readFile(downloaded!);const backup=JSON.parse(raw.toString());
  expect(backup.data.account.decks).toHaveLength(count?30:0);
  await page.evaluate(()=>{
    for(const key of ['birdsquad.account','birdsquad.account.backup'])localStorage.setItem(key,JSON.stringify({runs:1,wins:0,losses:1}));
    for(const key of ['birdsquad.runs','birdsquad.runs.backup'])localStorage.setItem(key,'[]');
  });
  const choosing=page.waitForEvent('filechooser');await tap('profile-save-restore-file-hit');
  await (await choosing).setFiles({name:'maximum-restored-save.json',mimeType:'application/json',buffer:raw});
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).saveData?.status==='restoreReady');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birdsquad.account')!).runs)).toBe(1);
  for(const viewport of [{width:2560,height:1600},{width:1440,height:900},{width:1000,height:560}]){
    await page.setViewportSize(viewport);await settleCanvas(page);
    checkTargetGeometry(await targetGeometry(page,'ProfileScene'),'actual restore confirmation');
    await page.screenshot({path:info.outputPath(`actual-restore-preview-${viewport.width}.png`)});
  }
  const reloaded=page.waitForEvent('framenavigated',frame=>frame===page.mainFrame());
  await tap('profile-save-restore-confirm-hit');
  await reloaded;
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text?.()??'{}').titleBoot?.ready);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('birdsquad.account')!).runs)).toBe(count);
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('birdsquad.account')!));
  expect(restored.decks).toEqual(backup.data.account.decks);
  expect(restored.discoveredCards).toEqual(backup.data.account.discoveredCards);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birdsquad.runs')!))).toEqual(backup.data.runHistory);
  await page.evaluate(async()=>{const w=window as any;await w.__birdSquadEnsureScene('ProfileScene');
    for(const s of w.__birdSquadGame.scene.getScenes(true))w.__birdSquadGame.scene.stop(s.scene.key);
    w.__birdSquadGame.scene.start('ProfileScene');});
  await page.waitForFunction(()=>JSON.parse((window as any).render_game_to_text()).scene==='ProfileScene');
  const stored=await page.evaluate(()=>localStorage.getItem('birdsquad.runs'));
  expect(JSON.parse(stored!)).toEqual(backup.data.runHistory);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birdsquad.account')!).decks)).toEqual(backup.data.account.decks);
  for (const viewport of [{ width: 2560, height: 1600 }, { width: 1440, height: 900 }, { width: 1000, height: 560 }]) {
    await page.setViewportSize(viewport); await settleCanvas(page);
    for (const mode of ['history', 'save', 'invalid', 'restore', 'ratings']) {
      await page.evaluate(({ mode, count }) => {
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene'), v = s.profileViewState;
        v.flightLogOpen = mode === 'history'; v.saveDataOpen = mode !== 'history'; v.flightReview = undefined;
        v.pendingRestore = mode === 'restore' ? { runs: 9999, wins: 9999, leaders: 10, activeRun: true, exportedAt: new Date().toISOString() } : undefined;
        v.saveDataMessage = mode === 'invalid' ? 'Backup could not be restored. The file is invalid; your existing save and settings are unchanged. Choose a valid Bird Squad backup and try again.' : '';
        v.saveDataStatus = mode === 'invalid' ? 'invalid' : 'idle';
        history.replaceState(null, '', mode === 'ratings' ? '?playtest=1' : location.pathname);
        v.playtestRunId = count ? JSON.parse(localStorage.getItem('birdsquad.runs')!)[0].id : undefined;
        v.playtestRunResult = count ? 'win' : undefined;
        s.renderPremiumProfileScene();
      }, { mode, count });
      await settleCanvas(page);
      const result = await page.evaluate(mode => {
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
        const prefix = mode === 'history' ? 'profile-flight-log' : 'profile-save-data';
        const start = s.children.list.findIndex((o: any) => o.name === `${prefix}-blocker`);
        const objects = s.children.list.slice(start), box = s.children.getByName(`${prefix}-panel`).getBounds();
        const scale = s.game.canvas.getBoundingClientRect().width / 1280;
        const labels = objects.filter((o: any) => o.type === 'Text');
        const controls = objects.filter((o: any) => o.input?.enabled && !o.name.endsWith('blocker'));
        const contains = (r: any) => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
        const clear = (a: any, b: any) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
        return { texts: labels.map((o: any) => ({ text: o.text, size: parseFloat(o.style.fontSize) * scale, fits: contains(o.getBounds()) })),
          overlaps: labels.flatMap((a: any, i: number) => labels.slice(i + 1).filter((b: any) => !clear(a.getBounds(), b.getBounds())).map((b: any) => [a.text, b.text])),
          controls: controls.map((o: any) => ({ name: o.name, width: o.width * scale, height: o.height * scale, fits: contains(o.getBounds()) })),
          controlOverlap: controls.some((a: any, i: number) => controls.slice(i + 1).some((b: any) => !clear(a.getBounds(), b.getBounds()))),
          controlSeparation: controls.every((a: any, i: number) => controls.slice(i + 1).every((b: any) => {
            const x=a.getBounds(), y=b.getBounds();
            return Math.max(x.left-y.right,y.left-x.right,x.top-y.bottom,y.top-x.bottom)>=8;
          })),
          rows: objects.filter((o: any) => o.name.startsWith('profile-flight-log-row-')).length,
          ratings: Boolean(s.children.getByName('profile-playtest-rating-header')),
        };
      }, mode);
      for (const text of result.texts) { expect(text.size, text.text).toBeGreaterThanOrEqual(14); expect(text.fits, text.text).toBe(true); }
      expect(result.overlaps).toEqual([]);
      if (mode === 'history') for (const text of result.texts) expect(text.text).not.toMatch(/\b1 (cards|stops)\b/);
      for (const control of result.controls) { expect(control.width, control.name).toBeGreaterThanOrEqual(44); expect(control.height, control.name).toBeGreaterThanOrEqual(44); expect(control.fits, control.name).toBe(true); }
      expect(result.controlOverlap).toBe(false);
      expect(result.controlSeparation).toBe(true);
      if (mode === 'history') expect(result.rows).toBe(count ? 7 : 0);
      if (mode === 'ratings') expect(result.ratings).toBe(true);
      await page.screenshot({ path: info.outputPath(`${mode}-${viewport.width}.png`) });
      const close = await page.evaluate(mode => {
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
        const hit = s.children.getByName(mode === 'history' ? 'profile-flight-log-close' : 'profile-save-close');
        const b = s.game.canvas.getBoundingClientRect();
        return { x: b.left + hit.x * b.width / 1280, y: b.top + hit.y * b.height / 720,
          cues: JSON.parse((window as any).render_game_to_text()).audio.cueRequests.close ?? 0 };
      }, mode);
      await page.touchscreen.tap(close.x, close.y);
      await settleCanvas(page);
      if (mode === 'restore') {
        const parent = await page.evaluate(() => {
          const v=(window as any).__birdSquadGame.scene.getScene('ProfileScene').profileViewState;
          return {open:v.saveDataOpen,pending:!!v.pendingRestore,focus:v.focus};
        });
        expect(parent).toEqual({open:true,pending:false,focus:'saveRestore'});
        await page.touchscreen.tap(close.x, close.y);await settleCanvas(page);
        close.cues += 1;
      }
      const closed = await page.evaluate(() => {
        const s = (window as any).__birdSquadGame.scene.getScene('ProfileScene');
        return { history: s.profileViewState.flightLogOpen, save: s.profileViewState.saveDataOpen,
          focus: s.profileViewState.focus, pending: Boolean(s.profileViewState.pendingRestore),
          cues: JSON.parse((window as any).render_game_to_text()).audio.cueRequests.close ?? 0 };
      });
      expect(closed).toMatchObject({ history: false, save: false, pending: false, cues: close.cues + 1 });
      if (mode !== 'history' || count) expect(closed.focus).toBe(mode === 'history' ? 'flightLog' : 'saveData');
      expect(await page.evaluate(() => localStorage.getItem('birdsquad.runs'))).toBe(stored);
    }
  }
  expect(errors).toEqual([]);
});
