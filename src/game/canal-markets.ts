import Phaser from 'phaser';
import { birdAudio, cardLibrary, killTweensForTree, prefersReducedMotion, UI_FONT } from '../main';
import { canalFerryProgress, canalPreens, journal, type FlywayState } from './flyway-rules';
import { prefersLeanEffects } from './graphics-quality';

type Scene = Phaser.Scene & Record<string, any>;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag); if (text) node.textContent = text; return node;
};
export function renderCanalMarkets(parent: HTMLElement, scene: Scene, state: FlywayState, change: (fn: () => void) => boolean, portraitUrl?: string) {
  const story = element('section'); story.dataset.canalStory = 'ferry'; parent.append(story);
  story.append(element('h2', 'Oren’s last ferry'));
  if (portraitUrl) { const img = element('img'); img.src = portraitUrl; img.alt = 'Oren Shearbright'; img.className = 'flyway-resident'; story.append(img); }
  const route = scene.scene.key === 'RouteScene' && scene.runState && !scene.nodeChoiceOpen && !scene.marketOpen;
  const progress = canalFerryProgress(state);
  const ferry = state.canalFerry;
  const button = (label: string, action: () => void, disabled = false) => {
    const control = element('button', label); control.type = 'button'; control.disabled = disabled;
    control.onclick = action; story.append(control);
  };
  if (!ferry) {
    story.append(element('p', '“The repair crew cannot cross while these moorings are held. Help me mend the ferry, then clear two Canal fights. We will bring the market back across.”'));
    story.append(element('p', 'Optional: invest 15 Scrap once. Timber reopens a shelter for 8 Cohesion; lamps prepare 2 Open Sky Guard for your next fight. You may leave this story for later.'));
    for (const pledge of ['timber', 'lamps'] as const) button(pledge === 'timber' ? 'Fund ferry timber · 15 Scrap' : 'Fund ferry lamps · 15 Scrap', () => {
      if (!route || scene.runState.mapIndex !== 1 || state.canalFerry || scene.runState.scrap < 15) return;
      if (change(() => {
        scene.runState.scrap -= 15; scene.runState.scrapSpent = (scene.runState.scrapSpent ?? 0) + 15;
        state.canalFerry = { pledge, startedAt: canalFerryProgress(state).clears };
        journal(state, `Oren starts the ferry ${pledge}. Clear two Canal crossings to bring the repair crew through.`);
      })) birdAudio.play('canalRepair', .65);
    }, !route || scene.runState.mapIndex !== 1 || scene.runState.scrap < 15);
  } else if (ferry.rewarded) {
    story.append(element('p', ferry.pledge === 'timber' ? 'The ferry carries neighbors to the dry shelter. Oren keeps your timber mark on its bow.' : 'Amber lamps guide the ferry home. Oren answers your flock with two short bell notes.'));
    story.append(element('p', 'Crossing restored. Your one-time reward has been collected.'));
  } else {
    const count = Math.min(2, Math.max(0, progress.clears - ferry.startedAt));
    story.append(element('p', progress.ready ? 'The moorings are clear. The crew has the ferry afloat; Oren is ready to reopen the crossing.' : `${count}/2 Canal victories since your pledge. Oren waits for the repair crew to cross safely.`));
    const gift = ferry.pledge === 'timber' ? 'Reopen ferry · receive 8 Cohesion' : 'Reopen ferry · receive 2 Open Sky Guard next fight';
    button(gift, () => {
      if (!route || ferry.rewarded || !canalFerryProgress(state).ready) return;
      if (change(() => {
        if (ferry.pledge === 'timber') scene.runState.currentHp = Math.min(scene.runMaxHp(), scene.runState.currentHp + 8);
        else { scene.runState.nextCombat ??= {}; scene.runState.nextCombat.openSkyGuard = (scene.runState.nextCombat.openSkyGuard ?? 0) + 2; }
        ferry.rewarded = true; state.residents.oren = Math.min(8, state.residents.oren + 1);
        journal(state, `Oren reopens the ferry with ${ferry.pledge}. ${gift}. The crossing remembers the flock.`);
      })) birdAudio.play('canalRepair');
    }, !route || !progress.ready);
  }
  if ((scene.runState?.mapIndex ?? scene.flywayMapIndex) !== 1) return;
  const guide = element('section'); guide.append(element('h2', 'Canal Preens · choose a direction'));
  guide.append(element('p', 'At a Canal Nest, Market service or Preen reward, these birds offer two extra alternatives alongside Shelter and Flight. Each replaces the normal active upgrade rules; passive Flock Stats stay unchanged. One Preen per bird; compare both normal and Molt rules before committing.'));
  const grid = element('div'); grid.className = 'flyway-grid'; guide.append(grid); parent.append(guide);
  for (const card of ['pentacles_04', 'wands_ace', 'aviary_25']) {
    const box = element('section'); box.append(element('h3', cardLibrary[card].name));
    for (const branch of canalPreens.filter(entry => entry.card === card)) box.append(element('p', `${branch.name} · ${branch.plan}: ${branch.tradeoff}`));
    grid.append(box);
  }
}

/** Decorative water never owns input or changes combat timing. */
export function installCanalMarkets(scene: Scene) {
  const inCanal = () => (scene.runState?.mapIndex ?? scene.flywayMapIndex) === 1;
  const record = { pulses: 0, active: 0, phase: 1, restored: false };
  scene.canalMarkets = record;
  const ferryBackdrop = () => {
    if (scene.runState?.mapIndex !== 1 || scene.children.getByName('canal-ferry')) return;
    const saved: FlywayState = scene.runState.flyway;
    if (!saved?.canalFerry) return;
    const open = saved.canalFerry.rewarded === true;
    record.restored = open;
    const root = scene.add.container(70, 682).setDepth(1).setName('canal-ferry');
    root.add(scene.add.rectangle(25, 1, 54, 7, open ? 0xd9b578 : 0x61777b, .9));
    root.add(scene.add.triangle(25, 7, -29, 0, 29, 0, 20, 12, open ? 0xb49159 : 0x43565d, .9));
    for (let i = 0; i < (open ? 3 : 1); i++) root.add(scene.add.circle(10 + i * 15, -6, 4, open ? 0xffd88a : 0x718d91));
    root.add(scene.add.text(62, -4, open ? 'OREN’S FERRY · CROSSING OPEN' : 'OREN’S FERRY · CREW WAITING', { fontFamily: UI_FONT, fontSize: '12px', color: open ? '#ffe0a1' : '#aac8ce', backgroundColor: '#101b25', padding: { x: 4, y: 3 }, resolution: 2 }));
  };
  const backdrop = () => {
    const layer = scene.backdropLayer;
    if (!layer?.active || layer.getByName('canal-waterline')) return;
    const root = scene.add.container().setName('canal-waterline'); layer.add(root);
    for (let i = 0; i < 5; i++) root.add(scene.add.rectangle(640 + (i % 2 ? 80 : -80), 366 + i * 15, 660 - i * 70, 2, 0x79c9ce, .10));
  };
  const pulse = (phase = false) => {
    if (!inCanal() || !scene.fxLayer?.active || record.active >= 2) return;
    const root = scene.add.container().setName('canal-current-fx'); scene.fxLayer.add(root);
    record.active++; record.pulses++;
    const reduced = prefersReducedMotion() || prefersLeanEffects();
    for (let i = 0; i < (reduced ? 1 : 3); i++) {
      const ripple = scene.add.ellipse(800, 398 + i * 12, 160 + i * 90, 14 + i * 7).setStrokeStyle(2, phase ? 0xd9b578 : 0x79c9ce, .45);
      root.add(ripple);
      if (!reduced) scene.tweens.add({ targets: ripple, scaleX: 1.4, alpha: 0, duration: 520 + i * 70 });
    }
    const timer = scene.time.delayedCall(750, () => root.destroy(true));
    root.once('destroy', () => { timer.remove(false); killTweensForTree(scene, root); record.active = Math.max(0, record.active - 1); });
  };
  const phase = () => { if (inCanal()) { record.phase = 2; pulse(true); birdAudio.play('canalSurge', .65); } };
  const combo = () => { if (inCanal()) { pulse(); birdAudio.play('canalBell', .55); } };
  const molt = (entering: boolean) => { if (entering) pulse(); };
  scene.events.on('opening-route-backdrop', ferryBackdrop);
  scene.events.on('canal-backdrop', backdrop);
  scene.events.on('flyway-phase', phase);
  scene.events.on('flyway-combination', combo);
  scene.events.on('flyway-molt', molt);
  ferryBackdrop(); if (scene.flywayMapIndex === 1) backdrop();
  scene.events.once('shutdown', () => {
    scene.events.off('opening-route-backdrop', ferryBackdrop); scene.events.off('canal-backdrop', backdrop);
    scene.events.off('flyway-phase', phase); scene.events.off('flyway-combination', combo); scene.events.off('flyway-molt', molt);
    delete scene.canalMarkets;
  });
}
