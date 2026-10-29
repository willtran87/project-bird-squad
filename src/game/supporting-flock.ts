import type Phaser from 'phaser';
import { prefersReducedMotion } from '../main';
import { prefersLeanEffects } from './graphics-quality';
type Scene = Phaser.Scene & Record<string, any>;
const poses = ['anticipation','wingbeat','contact','recoil','recovery'];
/** Two persistent wingmates share the approved atlas; no additional textures or timers. */
export function installSupportingFlock(scene: Scene, key: string) {
  const cast = [scene.runLeaderId === 'talon' ? 0 : 2, scene.runLeaderId === 'roostkeeper' ? 3 : 4].map((row, index) => ({
    row, x: index ? 570 : 440, y: 350,
    image: scene.add.image(index ? 570 : 440, 350, key, `${row}-4`).setOrigin(.5,1).setScale(.65)
      .setDepth(3).setName(`supporting-flock-${index}`).setData('role', index ? 'shelter' : 'striker'),
    started: -Infinity, budget: 0, impact: -Infinity, style: 'rally', target: 560,
  }));
  const state = cast.map((member,index) => ({role:index?'shelter':'striker',row:member.row,pose:'recovery',visible:false}));
  const begin = (budget: number, style: string, enemyId?: string) => {
    const member = cast[style === 'shelter' || style === 'retreat' ? 1 : 0];
    member.started = scene.time.now; member.budget = budget; member.impact = Infinity; member.style = style;
    const enemy = scene.enemies.find((e: any) => e.id === enemyId);
    member.target = enemy ? Math.min(650, scene.enemyView(enemy).x - 150) : 560;
  };
  const impact = () => { for (const member of cast) if (member.impact === Infinity) member.impact = scene.time.now; };
  const combo = () => { for (const member of cast) { member.started = scene.time.now; member.budget = 0; member.impact = scene.time.now; member.style = 'pair'; } };
  scene.events.on('living-cast', begin); scene.events.on('flyway-card', impact); scene.events.on('flyway-combination', combo);
  const update = () => {
    if (scene.sys.isPaused()) return;
    const still = prefersReducedMotion() || prefersLeanEffects();
    for (let index=0;index<cast.length;index++) {
      const member=cast[index];
      const elapsed = scene.time.now - member.started, since = scene.time.now - member.impact;
      const active = elapsed < member.budget + 800 && since < 420;
      const visible = scene.mode === 'battle' && !scene.combatIntroActive;
      state[index].visible = visible;
      member.image.setVisible(visible);
      if (!visible) continue;
      const resolved = Number.isFinite(member.impact);
      const phase = !active ? 4 : still ? resolved ? 2 : 0 : resolved ? since < 140 ? 2 : 4 : elapsed < member.budget * .35 ? 0 : 1;
      const forward = !active || still ? 0 : resolved ? Math.max(0, 1 - since / 420) : Math.min(1, elapsed / Math.max(1, member.budget));
      const destination = member.style === 'swoop' || member.style === 'shove' ? member.target : member.style === 'shelter' ? 610 : member.x + 35;
      const frame = `${member.row}-${phase}`;
      if (member.image.frame.name !== frame) member.image.setFrame(frame);
      state[index].pose = poses[phase];
      member.image.setPosition(member.x + (destination - member.x) * forward, member.y - (member.style === 'swoop' ? 55 * forward : 0))
        .setData('pose', poses[phase]).setData('active', active).setData('resolved', resolved);
    }
  };
  return { update, state, destroy() {
    scene.events.off('living-cast', begin); scene.events.off('flyway-card', impact); scene.events.off('flyway-combination', combo);
    cast.forEach(member => member.image.destroy());
  }};
}
