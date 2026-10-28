import Phaser from 'phaser';
import atlasUrl from '../../assets/runtime/flock/performances/living-battles-atlas-v1.webp';
import { birdAudio, prefersReducedMotion, queueRuntimeImageAssets } from '../main';
import { prefersLeanEffects } from './graphics-quality';

const key = 'living-battles-atlas-v1';
const leaders = ['fledgling', 'spark_caller', 'talon', 'tidewarden', 'roostkeeper', 'caldra'];
const poses = ['anticipation', 'wingbeat', 'contact', 'recoil', 'recovery'];
const calls = ['flockSparrow', 'flockChorus', 'flockShrike', 'flockHeron', 'flockFinch', 'flockJackdaw'] as const;
// Measured transparent gutters in the approved atlas, including its irregular
// row spacing. No resizing or runtime canvas extraction of the source pixels.
const rows = [0, 201, 395, 583, 774, 954, 1122];
const columns = [0, 286, 566, 864, 1142, 1402];
type Scene = Phaser.Scene & Record<string, any>;
type Actor = { image: Phaser.GameObjects.Image; row: number; clock: Phaser.Time.TimerEvent; until: number; kind: 'cast'|'hit'|'call'; impact?: number; budget: number; enemyId?: string };

export function installLivingPerformances(scene: Scene) {
  let alive = true, ambientAt = scene.time.now + 14000;
  const actors = new Map<string, Actor>();
  const status = { ready: false, active: [] as Array<{ bird: string; pose: string }>, calls: 0 }; scene.livingPerformances = status;
  const frames = () => {
    if (!alive || !scene.textures.exists(key)) return;
    const texture = scene.textures.get(key);
    for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) {
      const name = `${row}-${col}`;
      if (!texture.has(name)) texture.add(name, 0, columns[col], rows[row], columns[col+1]-columns[col], rows[row+1]-rows[row]);
    }
    status.ready = true;
  };
  queueRuntimeImageAssets(scene, [{key, url:atlasUrl}], 'Bird performance art unavailable', frames); frames();
  const still = () => prefersReducedMotion() || prefersLeanEffects();
  const original = (a: Actor) => a.enemyId ? scene.enemyPoseGroups.get(a.enemyId)?.group : scene.root?.getByName('combat-leader-art');
  const retire = (id: string) => { const a = actors.get(id); if (!a) return; original(a)?.setVisible(true); a.clock.remove(false); a.image.destroy(); actors.delete(id); };
  const start = (id: string, row: number, kind: Actor['kind'], budget = 0, enemyId?: string) => {
    if (!status.ready || !scene.fxLayer?.active || scene.mode !== 'battle') return;
    retire(id);
    const enemy = enemyId && scene.enemies.find((e: any) => e.id === enemyId && e.hp > 0);
    if (enemyId && !enemy) return;
    const at = enemy ? scene.enemyView(enemy) : {x:280,y:352};
    const image = scene.add.image(at.x, at.y + 64, key, `${row}-${kind === 'hit' ? 3 : 0}`).setOrigin(.5, 1)
      .setScale(enemy ? .72 : .90).setFlipX(!!enemy).setName(`living-bird-${id}`).setDepth(42);
    scene.fxLayer.add(image);
    const clock=scene.time.addEvent({delay:Math.max(700,budget+600)});
    actors.set(id, {image,row,clock,until:Math.max(700,budget+600),kind,budget,enemyId});
  };
  const leaderRow = () => Math.max(0, leaders.indexOf(scene.runLeaderId ?? 'fledgling'));
  const cast = (budget: number) => start('leader', leaderRow(), 'cast', budget);
  const impact = () => { const a = actors.get('leader'); if (a?.kind === 'cast') { a.impact = a.clock.getElapsed(); a.until = a.impact + 360; } };
  const hit = (cue: string) => { if (cue === 'hit') start('leader', leaderRow(), 'hit'); };
  const enemy = (id: string, cue: string) => {
    if (scene.battlefieldMood() !== 'rival' || scene.flyway.rivalWins >= 3 || !id.startsWith('tarline_jackdaw')) return;
    if (cue === 'hit') start('caldra', 5, 'hit', 0, id);
  };
  const enemyStart = (id: string, budget: number) => {
    if (scene.battlefieldMood() !== 'rival' || scene.flyway.rivalWins >= 3) return;
    const captain = scene.enemies.find((e:any) => e.hp>0 && e.runtime.id==='tarline_jackdaw');
    if (captain?.id === id) start('caldra',5,'cast',budget,id);
  };
  const enemyImpact = (id: string) => {
    const a=actors.get('caldra');
    if (a?.enemyId === id) { a.impact=a.clock.getElapsed(); a.until=a.impact+360; birdAudio.play('flockJackdaw',.5); }
  };
  const call = () => { start('leader',leaderRow(),'call'); birdAudio.play(calls[leaderRow()],.65); status.calls++; };
  scene.events.on('living-cast',cast); scene.events.on('flyway-card',impact); scene.events.on('living-flock-cue',hit);
  scene.events.on('living-enemy-cue',enemy); scene.events.on('living-enemy-start',enemyStart); scene.events.on('living-enemy-impact',enemyImpact); scene.events.on('flyway-call',call);
  const update = () => {
    if (!alive || scene.sys.isPaused()) return;
    const now = scene.time.now;
    for (const [id,a] of actors) {
      const elapsed=a.clock.getElapsed();
      if (!a.image.active || elapsed >= a.until || scene.mode !== 'battle' || a.enemyId && !scene.enemies.some((e:any)=>e.id===a.enemyId&&e.hp>0)) { retire(id); continue; }
      const phase = still() ? a.kind === 'hit' ? 3 : 2 : a.kind==='hit' ? elapsed<180?3:4
        : a.impact !== undefined ? elapsed-a.impact<120?2:4
        : a.kind==='call' ? elapsed<120?0:elapsed<280?1:elapsed<450?2:4
        : elapsed<Math.max(40,a.budget*.35)?0:1;
      a.image.setFrame(`${a.row}-${phase}`).setData('pose',poses[phase]);
      original(a)?.setVisible(false);
    }
    status.active=[...actors.values()].map(a=>({bird:leaders[a.row],pose:a.image.getData('pose')??'anticipation'}));
    if (now>=ambientAt) {
      ambientAt=now+14000;
      if (!document.hidden && !document.querySelector('dialog[open]') && scene.mode==='battle' && !scene.combatAnimationPending && !scene.pauseOverlayOpen && !scene.settingsOverlayOpen) birdAudio.play('rooftopAir',.45);
    }
  };
  return { update, destroy: () => {
    alive=false; for (const id of [...actors.keys()]) retire(id); status.active=[];
    scene.events.off('living-cast',cast);scene.events.off('flyway-card',impact);scene.events.off('living-flock-cue',hit);
    scene.events.off('living-enemy-cue',enemy);scene.events.off('living-enemy-start',enemyStart);scene.events.off('living-enemy-impact',enemyImpact);scene.events.off('flyway-call',call);
  }};
}
