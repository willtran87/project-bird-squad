import Phaser from 'phaser';
import { alphaEnemyLibrary, birdAudio, currentMap, formatEffects, killTweensForTree, prefersReducedMotion } from '../main';
import { journal, type FlywayState } from './flyway-rules';
import { prefersLeanEffects } from './graphics-quality';
import { routeSceneMapBackdropAssets } from './route-scene-assets';

type Scene = Phaser.Scene & Record<string, any>;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag); if (text) node.textContent = text; return node;
};
const button = (owner: HTMLElement, label: string, action: () => void, disabled = false) => {
  const node = element('button', label); node.type = 'button'; node.disabled = disabled; node.onclick = action; owner.append(node); return node;
};

/** A prior-district visit is required: helping at High Roost cannot unlock its own gift. */
export function cityOpportunities(s: FlywayState) {
  return {
    sella: s.residents.sella > 0 && s.visits.some(id => /^sella:[012]$/.test(id)),
    oren: s.canalFerry?.rewarded === true,
    ivo: s.spireRelay?.rewarded === true,
  };
}

export function renderHighRoost(parent: HTMLElement, scene: Scene, s: FlywayState, change: (fn: () => void) => boolean) {
  const box = element('section'); box.dataset.highRoost = 'city'; parent.append(box);
  box.append(element('h2', 'The city carries you'), element('p', 'Pressure, recovery, commitment. Visit your neighbors before committing to the next crossing. Each favor is available once this flight.'));
  const route = scene.scene.key === 'RouteScene' && scene.runState?.mapIndex === 3 && !scene.nodeChoiceOpen && !scene.marketOpen;
  const available = cityOpportunities(s);
  if (route) {
    const selected = currentMap().nodes.find(node => node.id === scene.selectedNodeId);
    const detail = selected && scene.nodeDetail(selected);
    if (detail?.lesson) box.append(element('h3', `Before you commit · ${detail.title}`), element('p', detail.lesson));
  }
  const favors = [
    { id: 'sella' as const, title: 'Sella’s shelter stop', reason: 'Your earlier shelter visit kept a lantern burning.', locked: 'Help Sella in an earlier district to open this shelter.', label: 'Rest at Sella’s shelter · restore 8 Cohesion', apply: () => { scene.runState.currentHp = Math.min(scene.runMaxHp(), scene.runState.currentHp + 8); } },
    { id: 'oren' as const, title: 'Oren’s supply crossing', reason: `Your ferry repair (${s.canalFerry?.pledge ?? 'pending'}) brought materials uphill.`, locked: 'Restore Oren’s Canal ferry to open this crossing.', label: 'Collect Oren’s supplies · 3 Open Sky Guard next fight', apply: () => { scene.runState.nextCombat ??= {}; scene.runState.nextCombat.openSkyGuard = (scene.runState.nextCombat.openSkyGuard ?? 0) + 3; } },
    { id: 'ivo' as const, title: 'Ivo’s last warning', reason: `Your relay repair (${s.spireRelay?.pledge ?? 'pending'}) carries a warning from the summit.`, locked: 'Reconnect Ivo’s Spires relay to hear this warning.', label: 'Listen to Ivo · reveal the Warden’s final Tell', apply: () => {} },
  ];
  for (const favor of favors) {
    const row = element('section'); box.append(row); row.append(element('h3', favor.title), element('p', available[favor.id] ? favor.reason : favor.locked));
    const used = s.cityAid?.includes(favor.id);
    if (used) row.append(element('p', 'This favor has been received.'));
    else button(row, favor.label, () => {
      if (!route || !cityOpportunities(s)[favor.id] || s.cityAid?.includes(favor.id)) return;
      if (change(() => { favor.apply(); (s.cityAid ??= []).push(favor.id); journal(s, `${favor.reason} ${favor.label}.`); })) birdAudio.play('spireAnswer', .5);
    }, !route || !available[favor.id] || (favor.id === 'sella' && scene.runState.currentHp >= scene.runMaxHp()));
  }
  if (s.cityAid?.includes('ivo')) {
    const warden = alphaEnemyLibrary.get('roost_warden');
    box.append(element('h3', 'Ivo’s warning · Final Signal'));
    for (const id of warden?.phaseTwoMoveIds ?? []) {
      const move = warden?.moves.find(move => move.id === id);
      if (move) box.append(element('p', `${move.label}: ${formatEffects(move.effects)}`));
    }
    box.append(element('p', 'At half Cohesion the Warden drops stored force and Cover, then begins this loop. The Falcon can add 3 stored force; already stored force survives the Falcon. Hit the Winded Warden to cancel one damaging Tell. Current combat forecasts include the actual support and Guard state.'));
  }
  if (scene.scene.key === 'BattleScene' && scene.enemies?.some((e: any) => e.runtime.id === 'roost_warden')) {
    box.append(element('h3', 'Two support perches'));
    for (const [id, role] of [['roost_spire_sentinel','Shield perch · future 8 Cover'], ['roost_relay_falcon','Signal perch · future +3 stored force']]) {
      const enemy = scene.enemies.find((e: any) => e.runtime.id === id);
      box.append(element('p', `${role}: ${enemy?.hp > 0 ? 'active — select this bird to interrupt support' : 'disabled — no further support'}.`));
    }
  }
}

export function endingScenes(s: FlywayState) {
  const choice = cityOpportunities(s);
  return [
    {title:'First light · the shelter',text:choice.sella ? 'Sella lifts the shelter awning. The Scrap you left became blankets; tired birds step into the morning.' : 'Sella lights a single lantern. The route is open, but the shelter still needs neighbors to help.'},
    {title:'Morning traffic · the canal',text:s.canalFerry?.rewarded ? `Oren’s ferry crosses again. Your ${s.canalFerry.pledge === 'timber' ? 'timber holds the landing steady under the first supply carts' : 'lamps guide the dawn shift safely beneath the bridges'}.` : s.canalFerry ? 'Oren lays out the materials you pledged. The ferry repair is unfinished; today, couriers carry the first supplies by wing.' : 'Oren watches the quiet landing. The sky route is safe; the ferry remains a job for another flight.'},
    {title:'The city answers · the spires',text:s.spireRelay?.rewarded ? `Ivo opens the ${s.spireRelay.pledge === 'wires' ? 'rewired line' : 'new signal lenses'}. Calls pass from rooftop to rooftop. ${s.cityAid?.includes('ivo') ? 'You carried his final warning to the Warden.' : 'The warning line will serve the next flock.'}` : s.spireRelay ? 'Ivo returns to the repair you began. Nearby birds answer by voice while the far mast waits.' : 'Ivo answers the returning flock from his window. The far mast is quiet; reconnect it on another flight.'},
  ];
}

/** User-paced, skippable and replayable; the saved journal owns all narrative facts. */
export function renderCityEnding(parent: HTMLElement, s: FlywayState) {
  const box = element('section'); box.dataset.cityEnding = 'true'; parent.append(box);
  let step = 0; const scenes = endingScenes(s);
  const render = () => {
    box.replaceChildren();
    if (step < scenes.length) {
      const story = scenes[step]; box.append(element('h2', story.title), element('p', `${step + 1}/3 · ${story.text}`));
      const art = Object.values(routeSceneMapBackdropAssets)[step];
      box.style.background = `linear-gradient(130deg, ${['#15283be8','#263c40e8','#4a4032e8'][step]}, #101b25c9), url("${art.url}") center / cover`;
      box.style.padding = '24px'; box.style.borderRadius = '10px'; box.style.minHeight = '160px';
      button(box, step === 2 ? 'Meet the finishing flock' : 'Continue the morning', () => { step++; render(); box.querySelector('button')?.focus(); });
      button(box, 'Skip to the finishing flock', () => { step = 3; render(); box.querySelector('button')?.focus(); });
    } else {
      const invitation = !cityOpportunities(s).sella ? 'Next flight: help Sella in the Rooftops, then return to her High Roost shelter.' : !s.canalFerry?.rewarded ? 'Next flight: finish Oren’s ferry repair and bring supplies to the summit.' : !s.spireRelay?.rewarded ? 'Next flight: reconnect Ivo’s relay and carry his warning to the Warden.' : 'Next flight: try Ten Familiar Wings and restore the city with ten birds or fewer.';
      box.append(element('h2','A morning worth returning to'),element('p',invitation));
      button(box,'Replay the city’s morning',()=>{step=0;render();box.querySelector('button')?.focus();});
    }
  }; render();
}

/** Reuses the expansion tick. No additional frame loop, downloads or input owners. */
export function installHighRoost(scene: Scene) {
  const record = { dawn: 0, pose: 'brace', answers: 0 }; scene.highRoost = record;
  const backdrop = () => {
    if ((scene.runState?.mapIndex ?? scene.flywayMapIndex) !== 3) return;
    const s: FlywayState = scene.flyway ?? scene.runState?.flyway;
    record.dawn = s?.restored.includes(3) ? 1 : Math.min(.85, (s?.settledNodes.filter(id=>id.startsWith('3:')).length ?? 0) / 6);
    const layer = scene.backdropLayer ?? (scene.scene.key === 'RouteScene'
      ? scene.children.getByName('roost-route-sky') ?? scene.add.container().setDepth(1).setName('roost-route-sky') : undefined);
    if (layer?.active && !layer.getByName('roost-morning')) {
      const root = scene.add.container().setName('roost-morning'); layer.add(root);
      const sky = scene.add.rectangle(640, 215, 1280, 330, 0x879bbd, .08).setName('roost-dawn'); root.add(sky);
      const cable = scene.add.graphics(); root.add(cable); cable.lineStyle(1, 0xc6c3b4, .25);
      for (let i=0;i<3;i++) { cable.beginPath();cable.moveTo(240,120+i*9);cable.lineTo(670,144+i*9);cable.lineTo(1180,115+i*9);cable.strokePath(); }
      const still = prefersReducedMotion() || prefersLeanEffects();
      for (let i=0;i<4;i++) {
        const bird=scene.add.ellipse(270+i*235,132+(i%2)*10,8,4,0x465062,.7);root.add(bird);
        if(!still)scene.tweens.add({targets:bird,x:bird.x+10,y:bird.y-2,duration:1700+i*250,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
      }
      if(!still)scene.tweens.add({targets:cable,y:2,duration:2400,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
      root.once('destroy',()=>killTweensForTree(scene,root));
    }
    const sky = layer?.getByName('roost-morning')?.getByName('roost-dawn');
    sky?.setFillStyle(record.dawn >= .5 ? 0xf3c47b : 0x879bbd, .08 + record.dawn*.1);
    // Change stance only when its semantic state changes, without stacking tweens.
    for(const {group,enemy} of scene.enemyPoseGroups?.values() ?? []) {
      const pose = enemy.flywayBroken || enemy.weak > 0 ? 'stagger' : enemy.block > 0 ? 'brace' : 'recovery';
      if(group.getData('roost-pose')===pose)continue;
      group.setData('roost-pose',pose);record.pose=pose;
      const angle=pose==='stagger'?-4:pose==='brace'?2:0;
      scene.tweens.killTweensOf(group);
      if(prefersReducedMotion()||prefersLeanEffects())group.setAngle(angle);
      else scene.tweens.add({targets:group,angle,duration:220,ease:'Sine.easeOut'});
    }
  };
  const answer = () => { if((scene.runState?.mapIndex ?? scene.flywayMapIndex)!==3)return;record.answers++;birdAudio.play('spireAnswer',.35);backdrop(); };
  scene.events.on('roost-backdrop',backdrop);scene.events.on('opening-route-backdrop',backdrop);scene.events.on('flyway-phase',answer);scene.events.on('flyway-break',answer);backdrop();
  scene.events.once('shutdown',()=>{scene.events.off('roost-backdrop',backdrop);scene.events.off('opening-route-backdrop',backdrop);scene.events.off('flyway-phase',answer);scene.events.off('flyway-break',answer);delete scene.highRoost;});
}
