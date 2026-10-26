import Phaser from 'phaser';
import { birdAudio, cardLibrary, formatEffects, killTweensForTree, prefersReducedMotion, UI_FONT } from '../main';
import { journal, spirePreens, spireRelayProgress, type FlywayState } from './flyway-rules';
import { prefersLeanEffects } from './graphics-quality';

type Scene = Phaser.Scene & Record<string, any>;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag); if (text) node.textContent = text; return node;
};
export function renderSignalSpires(parent: HTMLElement, scene: Scene, state: FlywayState, change: (fn: () => void) => boolean, portraitUrl?: string) {
  const story = element('section'); story.dataset.spireStory = 'relay'; parent.append(story);
  story.append(element('h2', 'Ivo’s answering line'));
  if (portraitUrl) { const img = element('img'); img.src = portraitUrl; img.alt = 'Ivo Tallymast'; img.className = 'flyway-resident'; story.append(img); }
  const route = scene.scene.key === 'RouteScene' && scene.runState && !scene.nodeChoiceOpen && !scene.marketOpen;
  const map = scene.runState?.mapIndex ?? scene.flywayMapIndex;
  const relay = state.spireRelay, progress = spireRelayProgress(state);
  const button = (label: string, action: () => void, disabled = false, owner: HTMLElement = story) => {
    const control = element('button', label); control.type = 'button'; control.disabled = disabled; control.onclick = action; owner.append(control); return control;
  };
  if (!relay) {
    story.append(element('p', '“The lamps work. Nobody answers. Help me repair the line, then clear two Spires fights so the couriers can reach the far mast.”'));
    story.append(element('p', 'Optional: invest 18 Scrap once. Wires grant 1 Wingbeat next fight; lenses grant 2 Open Sky Guard next fight. Restore the relay to carry a final warning to High Roost.'));
    for (const pledge of ['wires', 'lenses'] as const) button(`Repair relay ${pledge} · 18 Scrap`, () => {
      if (!route || map !== 2 || state.spireRelay || scene.runState.scrap < 18) return;
      if (change(() => {
        scene.runState.scrap -= 18; scene.runState.scrapSpent = (scene.runState.scrapSpent ?? 0) + 18;
        state.spireRelay = { pledge, startedAt: spireRelayProgress(state).clears };
        journal(state, `Ivo repairs the relay ${pledge}. Clear two Spires crossings to reconnect the answering line.`);
      })) birdAudio.play('spireRepair', .65);
    }, !route || map !== 2 || scene.runState.scrap < 18);
  } else if (!relay.rewarded) {
    story.append(element('p', progress.ready ? 'A distant courier answers. The line is clear; Ivo is ready to reconnect the city.' : `${Math.min(2, Math.max(0, progress.clears - relay.startedAt))}/2 Spires victories since your pledge. The far mast is still isolated.`));
    const gift = relay.pledge === 'wires' ? '1 Wingbeat' : '2 Open Sky Guard';
    button(`Reconnect relay · ${gift} next fight`, () => {
      if (!route || relay.rewarded || !spireRelayProgress(state).ready) return;
      if (change(() => {
        scene.runState.nextCombat ??= {};
        const key = relay.pledge === 'wires' ? 'wingbeatBonus' : 'openSkyGuard';
        scene.runState.nextCombat[key] = (scene.runState.nextCombat[key] ?? 0) + (relay.pledge === 'wires' ? 1 : 2);
        relay.rewarded = true; state.residents.ivo = Math.min(8, state.residents.ivo + 1);
        journal(state, `Ivo reconnects the ${relay.pledge} relay: ${gift} next fight. The final warning will reach High Roost.`);
      })) birdAudio.play('spireAnswer');
    }, !route || !progress.ready);
  } else {
    story.append(element('p', 'The answering line is open. Couriers signal from mast to mast; Ivo keeps your repair mark on the switchboard.'));
    if (!relay.delivered) {
      const ferry = state.canalFerry?.rewarded === true;
      story.append(element('p', `At High Roost, receive Ivo’s warning: 1 Wingbeat next fight${ferry ? ', plus 2 Open Sky Guard from Oren’s ferry delivery' : ''}. One delivery per flight.`));
      button('Receive High Roost relay delivery', () => {
        if (!route || map !== 3 || relay.delivered) return;
        if (change(() => {
          scene.runState.nextCombat ??= {};
          scene.runState.nextCombat.wingbeatBonus = (scene.runState.nextCombat.wingbeatBonus ?? 0) + 1;
          if (ferry) scene.runState.nextCombat.openSkyGuard = (scene.runState.nextCombat.openSkyGuard ?? 0) + 2;
          relay.delivered = true;
          journal(state, `High Roost answers Ivo: 1 Wingbeat next fight.${ferry ? ' Oren’s restored ferry brings 2 Open Sky Guard.' : ''}`);
        })) birdAudio.play('spireAnswer');
      }, !route || map !== 3);
    } else story.append(element('p', 'High Roost received the warning. Your one-time delivery has been collected.'));
  }
  if (map !== 2) return;
  const guide = element('section'); parent.append(guide); guide.append(element('h2', 'Spires signatures · choose your timing'));
  guide.append(element('p', 'Unpreened birds can choose these at a Spires Preen. Already-Preened birds may retrain here for 25 Scrap; this replaces their active branch, preserves passive Flock Stats, and grants no extra Preen. Compare normal and Molt rules at a Preen or in Full rules after retraining.'));
  const grid = element('div'); grid.className = 'flyway-grid'; guide.append(grid);
  for (const branch of spirePreens) {
    const box = element('section'); grid.append(box);
    box.append(element('h3', `${branch.name} · ${cardLibrary[branch.card].name}`), element('p', `${branch.plan}: ${branch.tradeoff}`));
    const runtime = cardLibrary[branch.card].runtime, cost = branch.cost ?? runtime.cost;
    box.append(element('p', `Cost: ${cost} Wingbeats. ${formatEffects(branch.effects)} Molt (${Math.max(0,cost-(runtime.kind==='molt'?0:1))} Wingbeats): ${formatEffects(branch.moltEffects)}`));
    const card = scene.runState?.deck.find((c: any) => c.id === branch.card);
    if (!card?.upgraded) { box.append(element('p', 'Choose at a Spires Preen when this unpreened bird is in your flock.')); continue; }
    if (card.preenBranch === branch.id) { box.append(element('p', 'This signature is already trained.')); continue; }
    const select = button(`Retrain ${branch.name} · 25 Scrap`, () => {
      if (box.querySelector('[data-confirm-retrain]')) return;
      const confirm = element('section'); confirm.dataset.confirmRetrain = branch.id; box.append(confirm);
      confirm.append(element('p', `Replace the current branch with ${branch.name} for 25 Scrap? ${branch.tradeoff}`));
      button(`Confirm ${branch.name} · 25 Scrap`, () => {
        if (!route || scene.runState.mapIndex !== 2 || !card.upgraded || card.preenBranch === branch.id || scene.runState.scrap < 25) return;
        if (change(() => {
          scene.runState.scrap -= 25; scene.runState.scrapSpent = (scene.runState.scrapSpent ?? 0) + 25;
          card.preenBranch = branch.id;
          journal(state, `${cardLibrary[branch.card].name} retrains as ${branch.name} at the signal mast.`);
        })) birdAudio.play('spireRepair');
      }, false, confirm);
      button('Keep current Preen', () => { confirm.remove(); select.focus(); }, false, confirm);
      confirm.querySelector<HTMLButtonElement>('button')?.focus();
    }, !route || scene.runState.scrap < 25, box);
  }
}

/** Background lamps are event-driven, bounded and never own input. */
export function installSignalSpires(scene: Scene) {
  const inSpires = () => (scene.runState?.mapIndex ?? scene.flywayMapIndex) === 2;
  const record = { pulses: 0, active: 0, restored: false }; scene.signalSpires = record;
  const backdrop = () => {
    const layer = scene.backdropLayer;
    if (!inSpires() || !layer?.active || layer.getByName('spire-cables')) return;
    const root = scene.add.container().setName('spire-cables'); layer.add(root);
    const cable = scene.add.graphics(); root.add(cable); cable.lineStyle(1, 0x9ba9c6, .24);
    for (let i = 0; i < 3; i++) {
      cable.beginPath(); cable.moveTo(360, 140 + i * 9); cable.lineTo(780, 170 + i * 9); cable.lineTo(1230, 140 + i * 9); cable.strokePath();
      root.add(scene.add.rectangle(480 + i * 290, 149 + (i === 1 ? 22 : 0), 9, 6, 0xd9c79b, .65));
    }
  };
  const routeBackdrop = () => {
    const saved: FlywayState | undefined = scene.runState?.flyway;
    if (![2, 3].includes(scene.runState?.mapIndex) || !saved?.spireRelay || scene.children.getByName('spire-relay')) return;
    record.restored = saved.spireRelay.rewarded === true;
    const root = scene.add.container(70, 682).setDepth(1).setName('spire-relay');
    root.add(scene.add.rectangle(10, 0, 4, 27, 0x9ba9c6));
    root.add(scene.add.rectangle(10, -12, 24, 8, record.restored ? 0xffd88a : 0x65748c));
    root.add(scene.add.text(30, -6, record.restored ? 'IVO’S RELAY · LINE OPEN' : 'IVO’S RELAY · WAITING FOR AN ANSWER', {fontFamily:UI_FONT,fontSize:'12px',color:'#e0e7ff',backgroundColor:'#101b25',padding:{x:4,y:3},resolution:2}));
  };
  const pulse = () => {
    if (!inSpires() || !scene.fxLayer?.active || record.active >= 2) return;
    const root = scene.add.container().setName('spire-signal-fx'); scene.fxLayer.add(root); record.active++; record.pulses++;
    const reduced = prefersReducedMotion() || prefersLeanEffects();
    for (let i = 0; i < (reduced ? 1 : 3); i++) {
      const lamp = scene.add.rectangle(480 + i * 290, 149 + (i === 1 ? 22 : 0), 14, 9, 0xffe3a6, .85); root.add(lamp);
      if (!reduced) scene.tweens.add({targets:lamp,alpha:0,duration:380+i*70});
    }
    const timer = scene.time.delayedCall(650, () => root.destroy(true));
    root.once('destroy', () => {timer.remove(false);killTweensForTree(scene,root);record.active=Math.max(0,record.active-1);});
  };
  const phase = () => {if(inSpires()){pulse();birdAudio.play('spireBroadcast',.65);}};
  const combo = () => {if(inSpires()){pulse();birdAudio.play('spireAnswer',.5);}};
  scene.events.on('opening-route-backdrop',routeBackdrop); scene.events.on('spire-backdrop',backdrop);
  scene.events.on('flyway-phase',phase); scene.events.on('flyway-combination',combo);
  routeBackdrop();backdrop();
  scene.events.once('shutdown',()=>{
    scene.events.off('opening-route-backdrop',routeBackdrop);scene.events.off('spire-backdrop',backdrop);
    scene.events.off('flyway-phase',phase);scene.events.off('flyway-combination',combo);delete scene.signalSpires;
  });
}
