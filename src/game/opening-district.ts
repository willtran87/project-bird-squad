import Phaser from 'phaser';
import { cardLibrary, cardArtAssets, prefersReducedMotion, firstFlightGuideState, currentMove, UI_FONT } from '../main';
import { rooftopPlanMatch, combinations, type FlywayState, type RooftopPlan } from './flyway-rules';
import { prefersLeanEffects } from './graphics-quality';

type Scene = Phaser.Scene & Record<string, any>;
export const rooftopPlans: Array<{ id: RooftopPlan; name: string; play: string; preen: string; cost: string }> = [
  { id: 'shelter', name: 'Hold & Answer', play: 'Block the hit, retain a strike, then answer. Nests → Quills adds 2 damage once per turn.', preen: 'Locked Nest: its upgrade rewards a full block with next-turn draw and Open Sky Guard.', cost: 'Setup uses Wingbeats now. Retained cards still need Wingbeats next turn.' },
  { id: 'tempo', name: 'Chorus Engine', play: 'Build Resonance before Plume Flash. Basins → Plumes adds 1 Resonance once per turn.', preen: 'Plume Flash: its upgrade draws when you already have Resonance.', cost: 'Playing a fourth card causes Open Sky. Extra draws do not make extra plays safe.' },
  { id: 'molt', name: 'Storm Window', play: 'Prepare Cover or Open Sky Guard, then use Hot Feathers to change the whole hand for one turn.', preen: 'Hot Feathers: its upgrade adds Open Sky Guard. Inspect alternate abilities before committing.', cost: 'Molt ends at Roost. Plan for the exposed enemy phase, even if the burst is strong.' },
];

export function renderRooftopPlans(parent: HTMLElement, scene: Scene, state: FlywayState, change: (fn: () => void) => void) {
  const heading = document.createElement('h2'); heading.textContent = 'Find your Rooftops strategy'; parent.append(heading);
  const note = document.createElement('p');
  note.textContent = 'Optional: matching cards get double draft weight in Rooftops battle rewards, making other strategies less likely. Existing reward roles and exclusions still apply; no specific card is guaranteed. Change your plan on the route before a fight.';
  parent.append(note);
  const grid = document.createElement('div'); grid.className = 'flyway-grid rooftop-plans'; parent.append(grid);
  const deck: Array<{id: string}> = scene.runState?.deck ?? scene.allDeckCards?.() ?? [];
  for (const plan of rooftopPlans) {
    const box = document.createElement('section'); box.dataset.rooftopPlan = plan.id;
    const title = document.createElement('h3'); title.textContent = plan.name;
    const asset = cardArtAssets[({shelter:'pentacles_04',tempo:'wands_ace',molt:'aviary_25'} as const)[plan.id]];
    if (asset) { const art = document.createElement('img'); art.src = asset.url; art.alt = ''; art.className = 'rooftop-plan-art'; box.append(art); }
    const owned = deck.filter(card => cardLibrary[card.id] && rooftopPlanMatch(plan.id, cardLibrary[card.id].runtime));
    box.append(title);
    for (const text of [plan.play, plan.preen, plan.cost, `In your flock: ${owned.map(c => cardLibrary[c.id].name).join(', ') || 'no matching cards yet'}.`]) {
      const p = document.createElement('p'); p.textContent = text; box.append(p);
    }
    if (scene.runState && scene.runState.mapIndex === 0) {
      const choose = document.createElement('button'); choose.type = 'button';
      choose.textContent = `Follow ${plan.name}`; choose.setAttribute('aria-pressed', String(state.rooftopPlan === plan.id));
      choose.onclick = () => change(() => { state.rooftopPlan = plan.id; }); box.append(choose);
    }
    grid.append(box);
  }
  if (scene.runState && scene.runState.mapIndex === 0 && state.rooftopPlan) {
    const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Keep drafts open';
    clear.onclick = () => change(() => { delete state.rooftopPlan; }); parent.append(clear);
  }
  const coaching = document.createElement('button'); coaching.type = 'button';
  coaching.textContent = state.coachingOff ? 'Enable Rooftops coaching' : 'Hide Rooftops coaching';
  coaching.onclick = () => change(() => { if (state.coachingOff) delete state.coachingOff; else state.coachingOff = true; });
  parent.append(coaching);
}

/** Uses current legal cards and Tells; never assumes a future hand or recommends a forced play. */
function coaching(scene: Scene) {
  const guide = firstFlightGuideState();
  if (!scene.flyway?.rooftopPlan || scene.flyway.coachingOff || (!guide.enabled && !guide.completed) || scene.selectedInstanceId || scene.turn > 3) return;
  const living = scene.enemies.filter((e: any) => e.hp > 0);
  const boss = living.find((e: any) => e.runtime.id === 'tar_crowned_crow');
  if (boss && !boss.flywayBreakUsed) return 'Crow or escorts? Winded disrupts the Crow once. Check its next Tell before spending that opening.';
  if (scene.flock.molt) return 'Your hand has changed. Keep Cover for Roost: Molt ends before the exposed enemy phase.';
  const limit = scene.flyway.condition === 'scaffold' ? 3 : 4;
  if (scene.cardsPlayedThisTurn === limit - 1) return `${limit - 1} cards played. The next opens the sky: compare the extra payoff with the enemy Tells.`;
  const next = combinations.find(combo => combo.first === scene.flightCombat.previousSuit && !scene.flightCombat.combos.includes(combo.id)
    && scene.hand.some((card: any) => card.runtime.suit === combo.second && scene.effectiveCost(card) <= scene.energy));
  if (next) return `${next.name} is available. ${next.rule}`;
  if (scene.cardsPlayedThisTurn > 0) return;
  if (living.some((e: any) => e.runtime.id === 'wire_hawk')) return 'Watch sets up Heavy Strike. Prepare your Cover before choosing a Molt burst.';
  if (living.length > 1) return 'Thin the attackers or stop the disruptive bird? Compare their Tells before choosing a target.';
  if (living.some((e: any) => currentMove(e).effects.some((effect: string) => effect.startsWith('damage('))))
    return 'Cover absorbs the next hit and protects Flow. Saving a strike can set up your next beat.';
}

export function installOpeningDistrict(scene: Scene) {
  const index = () => scene.runState?.mapIndex ?? scene.flywayMapIndex ?? 0;
  const hints = (out: Array<{text: string; accent: number}>) => {
    if (index() !== 0) return;
    const text = coaching(scene); if (text) out.push({ text, accent: 0xe4b36e });
  };
  scene.events.on('opening-coaching', hints);
  // Warm light and an answered clothesline mark actual saved help, not elapsed time.
  const neighborhood = () => {
    if (scene.children.getByName('opening-neighborhood')) return;
    const saved: FlywayState | undefined = scene.runState?.flyway;
    if (!saved || !(saved.residents.sella > 0 || saved.restored.includes(0))) return;
    const root = scene.add.container().setDepth(1).setName('opening-neighborhood');
    for (let i = 0; i < 4; i++) {
      const x = 1070 + i * 42, y = 654 + (i % 2) * 7;
      root.add(scene.add.circle(x, y, 15, 0xf0b568, .12));
      root.add(scene.add.rectangle(x, y, 7, 11, 0xffdb91, .85));
    }
    const label = scene.add.text(1060, 683, saved.restored.includes(0) ? 'THE ROOFTOPS ANSWER' : 'SELLA KEEPS THE LIGHT ON',
      { fontFamily: UI_FONT, fontSize: '12px', color: '#ffe0a1', backgroundColor: '#101b25', padding: {x: 5, y: 3}, resolution: 2 });
    root.add(label);
  };
  scene.events.on('opening-route-backdrop', neighborhood);
  if (scene.scene.key === 'RouteScene' && scene.routeEssentialAssetsReady) neighborhood();
  let lastReaction = -Infinity;
  const record = { reactions: 0, last: '' };
  scene.openingDistrict = record;
  const react = (kind: 'block' | 'escape' | 'combo' | 'break' | 'victory') => {
    if (!scene.fxLayer?.active || scene.time.now - lastReaction < 900) return;
    lastReaction = scene.time.now; record.reactions++; record.last = kind;
    const art = scene.root?.getByName('combat-leader-art');
    if (!art?.active) return;
    const root = scene.add.container().setName('opening-bird-reaction'); scene.fxLayer.add(root);
    const findPortrait = (object: any): Phaser.GameObjects.Image | undefined => object.name === 'combat-leader-portrait' ? object
      : object.list?.map(findPortrait).find(Boolean);
    const source = findPortrait(art);
    const matrix = source?.getWorldTransformMatrix();
    const portrait = source && matrix ? scene.add.image(matrix.tx, matrix.ty, source.texture.key)
      .setScale(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)).setAlpha(.65) : undefined;
    if (portrait) root.add(portrait);
    const lines: Record<string, string[]> = {
      fledgling: ['Together.', 'Still with you.', 'That’s our rhythm.', 'The crossing is ours.', 'Everyone made it.'],
      roostkeeper: ['Held.', 'Stay behind me.', 'Now answer.', 'Hold this opening.', 'Homeward.'],
      spark_caller: ['On the beat.', 'Keep the chorus.', 'Again, together!', 'There’s our cue.', 'Let them hear us.'],
      talon: ['Read it.', 'Eyes forward.', 'Clean sequence.', 'Now. Move.', 'Route clear.'],
      tidewarden: ['Shelter holds.', 'Breathe. I’m here.', 'One current.', 'Through the gap.', 'All wings home.'],
    };
    const text = (lines[scene.runLeaderId] ?? lines.fledgling)[['block','escape','combo','break','victory'].indexOf(kind)];
    // Keep the small reaction caption above portrait art while its decorative echo
    // remains behind the protected combat UI. The FX root owns both lifetimes.
    const caption = scene.add.text(272, 414, text, { fontFamily: UI_FONT, fontSize: '18px', color: '#ffe6b5', backgroundColor: '#101b25', padding: {x: 8, y: 4}, resolution: 2 }).setOrigin(.5).setDepth(45);
    const reduced = prefersReducedMotion() || prefersLeanEffects();
    if (!reduced && portrait) {
      // Anticipation, a small decisive pose, then recovery; original idle art is untouched.
      scene.tweens.add({ targets: portrait, x: portrait.x - 3, duration: 90, yoyo: true, onComplete: () => {
        if (portrait.active) scene.tweens.add({ targets: portrait, x: matrix!.tx + (kind === 'block' ? -5 : 8), angle: kind === 'combo' ? -3 : 2, alpha: 0, duration: 340, ease: 'Sine.easeOut' });
      } });
    } else portrait?.setVisible(false);
    const timer = scene.time.delayedCall(850, () => root.destroy(true));
    root.once('destroy', () => { caption.destroy(); timer.remove(false); if (portrait) scene.tweens.killTweensOf(portrait); });
  };
  const impact = ({blocked, lost, hp}: {blocked: number; lost: number; hp: number}) => {
    if (blocked > 0 && lost === 0) react('block');
    else if (lost > 0 && hp > 0 && hp <= scene.flock.maxHp * .34) react('escape');
  };
  const combo = () => react('combo'), broken = () => react('break');
  const card = () => { if (scene.enemies.every((e: any) => e.hp <= 0)) react('victory'); };
  scene.events.on('opening-impact', impact); scene.events.on('flyway-combination', combo);
  scene.events.on('flyway-break', broken); scene.events.on('flyway-card', card);
  scene.events.once('shutdown', () => {
    scene.events.off('opening-coaching', hints); scene.events.off('opening-route-backdrop', neighborhood);
    scene.events.off('opening-impact', impact); scene.events.off('flyway-combination', combo);
    scene.events.off('flyway-break', broken); scene.events.off('flyway-card', card); delete scene.openingDistrict;
  });
}
