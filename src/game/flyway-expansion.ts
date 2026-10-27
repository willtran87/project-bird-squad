import Phaser from 'phaser';
import './flyway-expansion.css';
import { birdAudio, cardArtAssets, cardLibrary, createInitialRunState, currentMap, formatEffects,
  hasActiveRun, isLeaderUnlocked, loadAccount, prefersReducedMotion, queueRuntimeImageAssets,
  killTweensForTree, motionState, UI_FONT } from '../main';
import { routeSceneEventResidentAssets, routeSceneMapBackdropAssets } from './route-scene-assets';
import { codexLeaderArtAssets } from './leader-portrait-assets';
import { writeJournaledJson, readJournaledJson } from './safe-storage';
import { controlBindingsSnapshot } from './input-bindings';
import { prefersLeanEffects } from './graphics-quality';
import { showDownloadRecovery } from '../update-recovery';
import { bossDisruption, branchCards, branchUpgrade, canalPreens, spirePreens, combinations, conditions, districts, flightStories,
  journal, resolvedLeaderCall, rivalChapter, newFlywayState, normalizeFlyway, relics, type FlywayState,
  type FlywayCondition, type FlywayRelic, type PreenBranch } from './flyway-rules';

// Matches the scene adapters used by the existing lazy battle/route modules.
type Scene = Phaser.Scene & Record<string, any>;
type Page = 'flight' | 'crew' | 'city' | 'stories' | 'journal' | 'call';
const installed = new WeakSet<Phaser.Scene>();
const archiveKey = 'birdsquad.flyway.journal';
const medalsKey = 'birdsquad.flyway.medals';
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
};
const button = (label: string, action: () => void, disabled = false) => {
  const node = element('button', label); node.type = 'button'; node.disabled = disabled;
  node.onclick = () => { node.focus({preventScroll:true}); action(); }; return node;
};
function section(parent: HTMLElement, title: string, text: string) {
  const node = element('section'); node.append(element('h2', title), element('p', text)); parent.append(node); return node;
}
function saveRoute(scene: Scene) {
  if (!scene.runState) return true;
  return writeJournaledJson('birdsquad.run.active', scene.runState);
}
function readArchive() {
  return readJournaledJson(archiveKey, value => {
    if (!value || typeof value !== 'object') return undefined;
    const entry = value as { flyway?: unknown; birds?: unknown };
    const birds = Array.isArray(entry.birds) ? entry.birds.filter((card): card is {id:string} =>
      !!card && typeof card === 'object' && typeof card.id === 'string' && Object.hasOwn(cardLibrary, card.id)).slice(0, 100) : [];
    return {flyway: normalizeFlyway(entry.flyway ?? value), birds};
  });
}
function state(scene: Scene): FlywayState {
  if (scene.scene.key === 'BattleScene') return scene.flyway;
  if (scene.runState) return scene.runState.flyway ??= newFlywayState();
  return readArchive()?.flyway ?? newFlywayState();
}
function mapIndex(scene: Scene) { return scene.runState?.mapIndex ?? scene.flywayMapIndex ?? 0; }
function isBusy(scene: Scene) {
  return document.querySelector('dialog[open]:not(#flyway-book)') || scene.confirmExitOpen || scene.shouldChooseDistrictContract?.() || scene.routeCommitPending
    || scene.pauseOverlayOpen || scene.settingsOverlayOpen || scene.settingsOverlay?.active || scene.helpOverlay?.active || scene.leaderTooltip?.active || scene.titleRunLaunchPending || scene.codexOpening
    || scene.combatAnimationPending || scene.combatIntroActive || scene.discardChoice || scene.returnChoice
    || scene.inspectOverlay || scene.combatCardDetail?.active || scene.supplyDrawerOpen || scene.waymarkDrawerOpen
    || scene.deckOverlayOpen || scene.flockOverlayOpen || scene.nodeChoiceOpen || scene.marketOpen
    || scene.pendingRouteReward || scene.cardPickerMode || scene.root?.getByName('pending-overlay')?.active
    || scene.scene.key === 'BattleScene' && !scene.fxLayer?.active;
}

export function installFlyway(raw: Phaser.Scene) {
  if (installed.has(raw)) return;
  installed.add(raw);
  const scene = raw as Scene;
  let alive = true, openingFailed = false;
  let opening: typeof import('./opening-district') | undefined;
  let canal: typeof import('./canal-markets') | undefined, canalFailed = false;
  let spires: typeof import('./signal-spires') | undefined, spiresFailed = false;
  let roost: typeof import('./high-roost') | undefined, roostFailed = false;
  let identity: typeof import('./flock-identity') | undefined;
  let identityHud: ReturnType<typeof import('./flock-identity')['installIdentity']> | undefined;
  let identityFailed = false;
  let dialog: HTMLDialogElement | undefined;
  let page: Page = 'flight';
  let pendingPreen: { card: any; accept: (branch: PreenBranch) => void; isCurrent: () => boolean } | undefined;
  let frame = 0, lastPad = new Set<number>();
  const pressedButtons = () => {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    const pressed = new Set<number>();
    pad?.buttons.forEach((entry, index) => { if (entry.pressed) pressed.add(index); });
    return pressed;
  };
  let previousFocus: HTMLElement | null = null;
  const launch = button(scene.scene.key === 'MenuScene' ? 'Flight Stories · J' : 'Flyway · J', () => open());
  launch.className = 'flyway-launch'; launch.id = 'flyway-launch';
  const shortcutCode = () => Object.values(controlBindingsSnapshot()).includes('KeyJ') ? 'F8' : 'KeyJ';
  document.body.append(launch);
  const position = () => {
    identityHud?.update();
    const rect = scene.game.canvas.getBoundingClientRect();
    const battle = scene.scene.key === 'BattleScene';
    const menu = scene.scene.key === 'MenuScene';
    const left = `${rect.left + (battle ? 14 : menu ? 110 : 16) * rect.width / 1280}px`;
    const top = `${rect.top + (battle ? 359 : menu ? 18 : 640) * rect.height / 720}px`;
    if (launch.style.left !== left) launch.style.left = left;
    if (launch.style.top !== top) launch.style.top = top;
    const key = shortcutCode() === 'KeyJ' ? 'J' : 'F8';
    const shortcut = ` · ${key}`;
    const accessible = `Open Flyway journal, Leader call and Flight Stories. Keyboard ${key}; controller View or Select.`;
    if (launch.getAttribute('aria-label') !== accessible) launch.setAttribute('aria-label', accessible);
    const label = menu ? 'Flight Stories' : scene.runState?.mapIndex === 0 && !scene.runState.flyway?.rooftopPlan ? 'Strategy' : 'Flyway';
    let caption = `${label}${shortcut}`;
    const hidden = Boolean(isBusy(scene) || !scene.sys.isActive() || scene.routeCheckpointIndicator?.active
      || scene.mode && scene.mode !== 'battle' && !['runComplete', 'defeat'].includes(scene.mode));
    if (launch.hidden !== hidden) launch.hidden = hidden;
    if (battle && !launch.hidden) {
      const call = resolvedLeaderCall(scene.runLeaderId,scene.flyway);
      const ready = !scene.flightCombat.called && scene.flightCombat.charge >= call.goal;
      caption = `${identityHud ? 'Flyway' : ready ? 'Call ready' : ['runComplete','defeat'].includes(scene.mode) ? 'Flight journal' : scene.flightCombat.called ? 'Flyway' : `Call ${scene.flightCombat.charge}/${call.goal}`}${shortcut}`;
      const title = `${call.name}: ${call.charge} ${call.effect}`;
      if (launch.title !== title) launch.title = title;
    }
    if (launch.textContent !== caption) launch.textContent = caption;
  };
  position();
  const resize = () => position(); window.addEventListener('resize', resize);
  // Phaser can apply its canvas size after the window resize event. Anchor DOM
  // controls to the completed canvas layout rather than the next polling tick.
  const canvasResize = new ResizeObserver(position); canvasResize.observe(scene.game.canvas);
  const refreshTimer = window.setInterval(position, 250);
  function close() {
    if (!dialog) return;
    dialog.close(); dialog.remove(); dialog = undefined; pendingPreen = undefined;
    scene.flywayBookOpen = false;
    // Pause is queued until the next scene update. Always queue its matching
    // resume, including a close that arrives before that pause has taken effect.
    scene.scene.resume();
    previousFocus?.focus(); scene.game.canvas.focus();
  }
  function open(target: Page = scene.scene.key === 'MenuScene' ? 'stories' : ['runComplete','defeat'].includes(scene.mode) ? 'journal' : 'flight', force = false) {
    if (dialog || !scene.sys.isActive() || document.querySelector('dialog[open]:not(#flyway-book)') || (!force && isBusy(scene))) return;
    page = target;
    previousFocus = document.activeElement as HTMLElement;
    dialog = element('dialog', undefined, 'flyway-book'); dialog.id = 'flyway-book'; dialog.setAttribute('aria-labelledby', 'flyway-book-title');
    document.body.append(dialog); scene.flywayBookOpen = true; scene.scene.pause();
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        event.preventDefault(); const controls = [...dialog!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = controls.indexOf(document.activeElement as HTMLButtonElement);
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
    });
    render(); dialog.showModal();
    (target==='call' ? dialog.querySelector<HTMLButtonElement>('[data-call-preview] button:not(:disabled)')??dialog.querySelector<HTMLButtonElement>('button') : dialog.querySelector<HTMLButtonElement>('button'))?.focus();
    // The press that opened this owner must be released before it can activate
    // a dialog control, even when Phaser and this poll run in the same frame.
    lastPad = pressedButtons();
  }
  function feedback(text: string) { const status = dialog?.querySelector('[role=status]'); if (status) status.textContent = text; }
  function mutate(action: () => void) {
    const before = scene.runState ? structuredClone(scene.runState) : undefined;
    action();
    if (!saveRoute(scene)) { if (before) scene.runState = before; render(); feedback('Could not save. Your choice was not applied; try again.'); return false; }
    scene.renderAll?.(); render(); return true;
  }
  function render() {
    if (!dialog) return;
    const focusedLabel = dialog.contains(document.activeElement) ? document.activeElement?.textContent : undefined;
    const scroll = dialog.scrollTop;
    dialog.replaceChildren();
    const header = element('header');
    const title = element('h1', pendingPreen ? 'Choose this bird’s Preen' : 'The Flyway Journal'); title.id = 'flyway-book-title';
    header.append(title, element('p', 'A city connected by familiar wings.', 'flyway-note'));
    const nav = element('nav'); nav.setAttribute('aria-label', 'Flyway sections');
    if (!pendingPreen) for (const [id, label] of [['flight','This flight'],['crew','Flock & combinations'],['city','City & crossings'],['stories','Flight Stories'],['journal','Flight journal']] as Array<[Page,string]>) {
      const tab = button(label, () => { page = id; render(); }); tab.setAttribute('aria-pressed', String(page === id)); nav.append(tab);
    }
    nav.append(button(pendingPreen ? 'Cancel' : 'Return to game', close)); header.append(nav); dialog.append(header);
    const body = element('main'); dialog.append(body);
    const status = element('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live','polite'); body.append(status);
    if (pendingPreen) renderPreen(body);
    else if (page === 'call') renderCall(body);
    else if (page === 'flight') renderFlight(body);
    else if (page === 'crew') renderCrew(body);
    else if (page === 'city') renderCity(body);
    else if (page === 'stories') renderStories(body);
    else renderJournal(body);
    body.append(element('p', 'Tab / Shift+Tab: navigate · Enter: choose · Esc: return · Controller D-pad / A / B', 'flyway-note'));
    dialog.scrollTop = scroll;
    if (dialog.open) {
      const controls = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      (controls.find(control => control.textContent === focusedLabel) ?? controls[0])?.focus({preventScroll:true});
    }
  }
  function renderPreen(body: HTMLElement) {
    const request = pendingPreen!; const runtime = cardLibrary[request.card.id].runtime;
    const grid = element('div', undefined, 'flyway-grid'); body.append(grid);
    const extras = mapIndex(scene) === 1 ? canalPreens : mapIndex(scene) === 2 ? spirePreens : [];
    const branches: PreenBranch[] = ['shelter', 'flight', ...extras.filter(entry => entry.card === runtime.id).map(entry => entry.id)];
    for (const branch of branches) {
      const upgrade = branchUpgrade(runtime, branch);
      const special = extras.find(entry => entry.id === branch);
      const name = special?.name ?? (branch === 'shelter' ? 'Shelter' : 'Flight');
      const cost = upgrade.cost ?? runtime.cost;
      const moltCost = Math.max(0, cost - (runtime.kind === 'molt' ? 0 : 1));
      const box = section(grid, `${name} Preen`, `${special ? `${special.plan}: ${special.tradeoff}\n` : ''}Cost: ${cost} Wingbeats. ${formatEffects(upgrade.effects)}\nMolt (${moltCost} Wingbeats): ${formatEffects(upgrade.moltEffects ?? [])}`);
      const asset = cardArtAssets[request.card.id];
      if (asset) { const img = element('img'); img.src = asset.url; img.alt = cardLibrary[request.card.id].bird; img.className = 'flyway-card-art'; box.prepend(img); }
      box.append(button(`Choose ${name}`, () => { const current = request.isCurrent(); close(); if (current) request.accept(branch); }));
    }
  }
  function renderFlight(body: HTMLElement) {
    const s = state(scene);
    const district = districts[mapIndex(scene)] ?? districts[0];
    section(body, district.name, district.weather);
    renderIdentity(body,s);
    if (mapIndex(scene) === 0 && scene.runState) renderPlans(body, s);
    if (mapIndex(scene) === 1 || s.canalFerry) renderCanal(body, s);
    if (mapIndex(scene) === 2 || s.spireRelay) renderSpires(body, s);
    if (mapIndex(scene) === 3) renderRoost(body, s);
    if (scene.scene.key === 'BattleScene') {
      const combat=scene.flightCombat;
      renderCall(body);
      for (const enemy of scene.enemies) {
        const disruption = bossDisruption(enemy, mapIndex(scene));
        if (disruption) section(body, `${enemy.name} · disruption`, enemy.flywayBreakUsed ? 'Your disruption has been used for this fight.' : disruption.rule);
      }
      section(body, conditions[s.condition].name, conditions[s.condition].rule);
      for (const combo of combinations.filter(combo => combo.first === combat.previousSuit && !combat.combos.includes(combo.id))) section(body, `${combo.name} · ready to finish`, combo.rule);
    } else if (!scene.runState) section(body, 'Start a flight', 'Begin a normal flight or choose a Flight Story. During battle, return here to inspect and activate your earned Leader call.');
    if (s.relic) section(body, relics[s.relic].name, relics[s.relic].rule);
    else if (scene.runState && !s.relicChosen) {
      const box = section(body, 'A keepsake for this flight', 'Choose one strategic Waymark. Its benefit and cost last for this flight. You may keep flying without choosing.');
      for (const [id, relic] of Object.entries(relics)) {
        const row = section(box, relic.name, relic.rule);
        row.append(button(`Carry ${relic.name}`, () => mutate(() => { s.relic = id as FlywayRelic; s.relicChosen = true; journal(s, `The flock carries ${relic.name}. ${relic.rule}`); })));
      }
    }
    if (s.story) { const story = flightStories.find(entry => entry.id === s.story)!; section(body, story.title, `${story.rule} Progress: ${s.survivedMolt} Molt phases survived; ${s.cleanFights} clean fights; ${s.resonanceSpent??0} Resonance spent; ${s.windedHits??0} Winded card hits; ${s.leaderCalls} Calls.`); }
  }
  function renderCall(body:HTMLElement) {
    if(scene.scene.key!=='BattleScene')return;
    const call=resolvedLeaderCall(scene.runLeaderId,scene.flyway),combat=scene.flightCombat;
    const target=scene.resolvePlayableEnemyTarget(scene.selectedEnemyId);
    const box=section(body,call.name,`${call.charge} ${combat.charge}/${call.goal}. ${call.effect} Once per combat. ${call.tradeoff??''}`);
    box.dataset.callPreview='true';
    box.append(element('p',`Base damage and Cover use normal formation modifiers. ${call.rules.damage&&!call.rules.all?`Target: ${target?.name??'none'} (${target?.hp??0} Cohesion, ${target?.block??0} Cover).`:call.rules.all?'Targets: every living enemy.':''}`));
    box.append(button(combat.called?'Call used this fight':'Use Leader call',()=>{close();scene.activateFlywayCall();},combat.called||combat.charge<call.goal||scene.mode!=='battle'||!!call.rules.damage&&!scene.enemies.some((e:any)=>e.hp>0)));
    section(body,'Combination sequence',`Last suit: ${combat.previousSuit??'none'}. ${combinations.filter(c=>c.first===combat.previousSuit&&!combat.combos.includes(c.id)).map(c=>c.rule).join(' ')||'Play a first suit to prepare a combination.'} Each combination resolves once per turn; Roost resets the sequence.`);
  }
  function renderIdentity(body:HTMLElement,s:FlywayState){
    if(identity)identity.renderIdentity(body,scene,s,mutate);
    else if(scene.runState){const box=section(body,'Leader specialization',identityFailed?'Leader notes could not load; your base Call remains available.':'Preparing Leader notes…');if(identityFailed)box.append(button('Leader recovery options',showDownloadRecovery));}
  }
  function renderCrew(body: HTMLElement) {
    if (mapIndex(scene) === 0 && scene.flock) renderPlans(body, state(scene));
    section(body, 'Call and response', 'Each combination can resolve once per turn. Play the two suits consecutively; a different card interrupts the sequence. The sequence resets at Roost.');
    for (const combo of combinations) section(body, combo.name, combo.rule);
    const deck = scene.runState?.deck ?? scene.allDeckCards?.() ?? [];
    const box = section(body, 'Branching Preens', 'First Flight, Plume Flash, Quill Point, Open Basin, Locked Nest and Hot Feathers offer Shelter (+2 Cover) or Flight (+1 draw) on top of their normal upgrade. Choose at the Preen confirmation.');
    for (const card of deck.filter((card: any) => branchCards.includes(card.id))) box.append(element('p', `${cardLibrary[card.id]?.name ?? card.id}: ${card.upgraded ? card.preenBranch ? `${card.preenBranch} Preen` : 'original Preen' : 'branches available at a Preen stop'}`));
  }
  function renderCity(body: HTMLElement) {
    const s = state(scene); renderRestoration(body, s);
    if (mapIndex(scene) === 1 || s.canalFerry) renderCanal(body, s);
    if (mapIndex(scene) === 2 || s.spireRelay) renderSpires(body, s);
    if (mapIndex(scene) === 3) renderRoost(body, s);
    const grid = element('div', undefined, 'flyway-grid'); body.append(grid);
    districts.forEach((district, index) => {
      const box = section(grid, `${s.restored.includes(index) ? '✓ ' : ''}${district.name}`, s.restored.includes(index) ? district.restored : district.weather);
      if (s.restored.includes(index)) box.classList.add('flyway-restored');
    });
    const eligible = scene.runState && !scene.nodeChoiceOpen && !scene.marketOpen;
    if (eligible) {
      const selected = currentMap().nodes.find(node => node.id === scene.selectedNodeId);
      if (selected && ['street','rival','boss'].includes(selected.type) && scene.selectableNodeIds?.has(selected.id)) {
        const box = section(body, `Approach: ${selected.label}`, 'Choose the conditions for this selected crossing. The bonus is awarded once after victory.');
        for (const [id, condition] of Object.entries(conditions)) {
          const row = section(box, condition.name, condition.rule);
          const pick = button(`Take ${condition.name.toLowerCase()}`, () => mutate(() => { s.condition = id as FlywayCondition; s.conditionNode = selected.id; }));
          pick.setAttribute('aria-pressed', String(s.conditionNode === selected.id && s.condition === id)); row.append(pick);
        }
      }
      renderResidents(body, s);
    }
    const chapter=rivalChapter(s.rivalWins);
    const rival = section(body, 'Caldra’s Pinion Crew', `Rival victories: ${s.rivalWins}. ${s.rivalWins>=3?'Caldra keeps her promise: her crossings are open. Other district crews still offer their own challenges.':`Next: ${chapter.name}. ${chapter.line} ${chapter.weakness}`}`);
    const rivalArt=routeSceneEventResidentAssets.rival; if(rivalArt){const img=element('img');img.src=rivalArt.url;img.alt='Caldra Pinion';img.className='flyway-resident';rival.prepend(img);}
  }

  function renderRestoration(body: HTMLElement, s: FlywayState) {
    const panorama=element('div',undefined,'flyway-panorama'); panorama.setAttribute('role','img');
    panorama.setAttribute('aria-label',`City restoration: ${s.restored.length} of four districts connected. ${s.restored.map(i=>districts[i].name).join(', ')}`);
    const assets=Object.values(routeSceneMapBackdropAssets);
    districts.forEach((district,index)=>{
      const panel=element('div',undefined,`flyway-city-panel ${s.restored.includes(index)?'is-restored':''}`);
      if(assets[index])panel.style.backgroundImage=`url("${assets[index].url}")`;
      panel.append(element('span',district.name),element('i',s.restored.includes(index)?'✦':'○'));
      panorama.append(panel);
    });
    body.append(panorama);
  }

  function renderResidents(body: HTMLElement, s: FlywayState) {
    const index = mapIndex(scene);
    const residents = [
      { id: 'sella', name: 'Sella Warmwick', line: 'The lanterns are still burning. Will you help keep this shelter open?', help: 'Leave 10 Scrap for the shelter', gift: 'Receive 5 Cohesion', kind: 'heal' },
      { id: 'ivo', name: 'Ivo Tallymast', line: 'A signal only matters if another bird answers. Help me keep the line alive.', help: 'Leave 10 Scrap for signal repairs', gift: 'Receive 1 Open Sky Guard next fight', kind: 'guard' },
      { id: 'oren', name: 'Oren Shearbright', line: 'Bring the flock through safely. I can mend what the crossing wears away.', help: 'Leave 10 Scrap for the workshop', gift: 'Receive 15 Scrap in reclaimed materials', kind: 'scrap' },
    ];
    for (const resident of residents) {
      const trust = s.residents[resident.id] ?? 0; const visit = `${resident.id}:${index}`;
      const visited = s.visits.includes(visit);
      const box = section(body, `${resident.name} · trust ${trust}`, trust ? `“I remember your help.” ${resident.line}` : resident.line);
      const portrait = routeSceneEventResidentAssets[({sella:'basin',ivo:'signal',oren:'nest'} as const)[resident.id as 'sella'|'ivo'|'oren']];
      if (portrait) { const img=element('img'); img.src=portrait.url; img.alt=resident.name; img.className='flyway-resident'; box.prepend(img); }
      box.append(button(resident.help, () => mutate(() => {
        if (s.visits.includes(visit) || scene.runState.scrap < 10) return;
        scene.runState.scrap -= 10; scene.runState.scrapSpent = (scene.runState.scrapSpent ?? 0) + 10;
        s.residents[resident.id] = trust + 1; s.visits.push(visit); journal(s, `${resident.name} remembers the flock's help in ${districts[index].name}.`);
      }), visited || scene.runState.scrap < 10));
      box.append(button(resident.gift, () => mutate(() => {
        if (s.visits.includes(visit) || trust <= 0) return;
        if (resident.kind === 'heal') scene.runState.currentHp = Math.min(scene.runMaxHp(), scene.runState.currentHp + 5);
        if (resident.kind === 'guard') { scene.runState.nextCombat ??= {}; scene.runState.nextCombat.openSkyGuard = (scene.runState.nextCombat.openSkyGuard ?? 0) + 1; }
        if (resident.kind === 'scrap') { scene.runState.scrap += 15; scene.runState.scrapEarned = (scene.runState.scrapEarned ?? 0) + 15; }
        s.visits.push(visit); journal(s, `${resident.name} repays the flock: ${resident.gift.toLowerCase()}.`);
      }), visited || trust <= 0));
    }
  }
  function renderStories(body: HTMLElement) {
    const account = loadAccount();
    const medals = readJournaledJson(medalsKey, value => Array.isArray(value) ? value.filter(id => typeof id === 'string') : undefined) ?? [];
    for (const story of flightStories) {
      const box = section(body, story.title, `${story.premise} ${story.rule}`);
      const portrait = codexLeaderArtAssets[story.leader];
      if (portrait) { const img = element('img'); img.src = portrait.url; img.alt = story.leader; img.className = 'flyway-portrait'; box.prepend(img); }
      box.append(element('p', `Reward: ${story.reward}`));
      if (medals.includes(story.id)) box.append(element('p', '✦ Completed — journal seal earned'));
      const allowed = scene.scene.key === 'MenuScene' && !hasActiveRun() && isLeaderUnlocked(account, story.leader);
      box.append(button('Begin Flight Story', () => {
        if (hasActiveRun() || !isLeaderUnlocked(loadAccount(), story.leader)) return;
        const run = createInitialRunState(story.leader, 0, 'full', story.seed); run.flyway = newFlywayState(story.id);
        close(); scene.enterRoute(run);
      }, !allowed));
      if (!allowed) box.append(element('p', scene.scene.key !== 'MenuScene' ? 'Available from the main menu.' : hasActiveRun() ? 'Finish your current flight first.' : 'Unlock this Leader to begin.', 'flyway-note'));
    }
  }
  function renderJournal(body: HTMLElement) {
    const s = state(scene);
    if (scene.flywayArchiveSaved === false) {const notice=section(body,'Journal not yet saved','Keep this flight open and retry saving your journal and seals.');notice.append(button('Retry saving journal',()=>{scene.saveFlywayEnding();render();}));}
    section(body, s.restored.length === 4 ? 'The city answers' : 'Wings across the city', `${s.restored.length}/4 flyways restored · ${s.combinations} combinations · ${s.leaderCalls} Leader calls · ${s.survivedMolt} Molt phases survived.`);
    identity?.renderIdentityEnding(body,s);
    if (s.restored.includes(3)) { if (roost) roost.renderCityEnding(body, s); else renderRoost(body, s); }
    renderRestoration(body, s);
    const grid = element('div', undefined, 'flyway-grid'); body.append(grid);
    for (const index of s.restored) { const box = section(grid, districts[index].name, districts[index].restored); box.classList.add('flyway-restored'); }
    const birds = scene.runState?.deck ?? scene.allDeckCards?.() ?? readArchive()?.birds ?? [];
    if (birds.length) {
      const crew = section(body, 'The birds who carried the signal', 'Every card is a bird with a place in this flight.');
      for (const card of birds) {
        const row = section(crew, cardLibrary[card.id]?.name ?? card.id, cardLibrary[card.id]?.bird ?? '');
        const art = cardArtAssets[card.id]; if (art) { const img = element('img'); img.src = art.url; img.alt = cardLibrary[card.id]?.bird ?? ''; img.className = 'flyway-card-art'; row.prepend(img); }
      }
    }
    for (const note of s.journal) section(body, 'Route memory', note);
    for (const medal of s.medals) { const box = section(body, 'Flight Story seal', flightStories.find(story => story.id === medal)?.reward ?? medal); box.prepend(element('span', medal === 'open-sky' ? '❧' : medal === 'small-flock' ? '◎' : '≋', `flyway-seal ${medal}`)); }
  }
  const onKey = (event: KeyboardEvent) => {
    if (!dialog && (!scene.sys.isActive() || isBusy(scene))) return;
    // Shift + a remapped guide key already owns combat history. Function keys
    // cannot be bound in Controls; F8 is separate from map inspection's F2.
    if (event.code !== shortcutCode() || event.repeat || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement)?.matches('input,textarea,[contenteditable=true]')) return;
    event.preventDefault(); event.stopImmediatePropagation(); if (dialog) close(); else open();
  };
  window.addEventListener('keydown', onKey, true);
  const poll = () => {
    const pressed = pressedButtons();
    const hit = (id: number) => pressed.has(id) && !lastPad.has(id);
    if (!dialog && hit(8) && scene.sys.isActive() && !isBusy(scene)) open(scene.scene.key==='BattleScene'&&scene.mode==='battle'?'call':undefined);
    else if (dialog) {
      if (hit(1)) close();
      else if (hit(0)) (document.activeElement as HTMLButtonElement)?.click();
      else if ([12,13,14,15].some(hit)) {
        const controls = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = controls.indexOf(document.activeElement as HTMLButtonElement);
        const next = controls[(index + (hit(12) || hit(14) ? -1 : 1) + controls.length) % controls.length];
        next?.focus(); next?.scrollIntoView({block:'nearest'});
      }
    }
    lastPad = pressed; frame = requestAnimationFrame(poll);
  }; frame = requestAnimationFrame(poll);
  scene.flywayPreenRequest = (card: any, accept: (branch: PreenBranch) => void, isCurrent = () => true) => {
    if (card.upgraded || card.preenBranch || !branchCards.includes(card.id)) return false;
    if (!isCurrent()) return true;
    pendingPreen = { card, accept, isCurrent }; open('crew', true); return true;
  };
  scene.flywayCancelPreen = () => { if (pendingPreen) close(); };
  scene.openFlyway = open;
  installPresentation(scene);
  void import('./flock-identity').then(module=>{
    if(!alive)return;identity=module;identityHud=module.installIdentity(scene,()=>!!dialog||!!isBusy(scene),()=>open('call'));render();
  }).catch(()=>{if(alive){identityFailed=true;render();}});
  if (mapIndex(scene) === 3 || state(scene).restored.includes(3)) void import('./high-roost').then(module => {
    if (!alive) return; roost = module; module.installHighRoost(scene); render();
  }).catch(() => { if (alive) { roostFailed = true; render(); } });
  function renderRoost(body: HTMLElement, s: FlywayState) {
    if (roost) roost.renderHighRoost(body, scene, s, mutate);
    else { const box = section(body, 'High Roost', roostFailed ? 'City notes could not load. Your flight remains available.' : 'Preparing the final crossing…'); if (roostFailed) box.append(button('City recovery options', showDownloadRecovery)); }
  }
  if (mapIndex(scene) === 2 || state(scene).spireRelay) void import('./signal-spires').then(module => {
    if (!alive) return;
    spires = module; module.installSignalSpires(scene); render();
  }).catch(() => { if (alive) { spiresFailed = true; render(); } });
  if (mapIndex(scene) === 1 || state(scene).canalFerry) void import('./canal-markets').then(module => {
    if (!alive) return;
    canal = module; module.installCanalMarkets(scene); render();
  }).catch(() => { if (alive) { canalFailed = true; render(); } });
  if (scene.scene.key !== 'MenuScene') void import('./opening-district').then(module => {
    if (!alive) return;
    opening = module; module.installOpeningDistrict(scene); render();
  }).catch(() => { if (alive) { openingFailed = true; render(); } });
  function renderPlans(body: HTMLElement, s: FlywayState) {
    if (opening) opening.renderRooftopPlans(body, scene, s, mutate);
    else {
      const box = section(body, 'Rooftops strategies', openingFailed ? 'Strategy notes could not load. Your flight is still available.' : 'Preparing strategy notes…');
      if (openingFailed) box.append(button('Strategy recovery options', showDownloadRecovery));
    }
  }
  function renderCanal(body: HTMLElement, s: FlywayState) {
    if (canal) canal.renderCanalMarkets(body, scene, s, mutate, routeSceneEventResidentAssets.nest?.url);
    else {
      const box = section(body, 'Canal crossings', canalFailed ? 'Canal notes could not load. Your flight and normal Preens remain available.' : 'Preparing canal notes…');
      if (canalFailed) box.append(button('Canal recovery options', showDownloadRecovery));
    }
  }
  function renderSpires(body: HTMLElement, s: FlywayState) {
    if (spires) spires.renderSignalSpires(body, scene, s, mutate, routeSceneEventResidentAssets.signal?.url);
    else {
      const box = section(body, 'Signal crossings', spiresFailed ? 'Signal notes could not load. Your flight and normal Preens remain available.' : 'Preparing signal notes…');
      if (spiresFailed) box.append(button('Signal recovery options', showDownloadRecovery));
    }
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    alive = false;
    identityHud?.destroy();
    close(); installed.delete(raw); launch.remove(); canvasResize.disconnect(); window.clearInterval(refreshTimer); cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey, true);
    delete scene.flywayPreenRequest; delete scene.flywayCancelPreen; delete scene.openFlyway;
  });
}

function installPresentation(scene: Scene) {
  if (scene.scene.key !== 'BattleScene') return;
  let lastMode = '', active = 0;
  const counters = { cameos: 0, suitActions: 0, moltTransitions: 0, impacts: 0, phaseChanges: 0 };
  scene.flywayPresentation = counters;
  queueRuntimeImageAssets(scene, Object.values(codexLeaderArtAssets), 'Flyway bird cameo art unavailable');
  function group(name: string) {
    if (!scene.fxLayer?.active || active >= (prefersLeanEffects() ? 2 : 5)) return undefined;
    const root = scene.add.container().setName(name); scene.fxLayer.add(root); active += 1;
    root.once('destroy', () => { active = Math.max(0, active - 1); });
    scene.time.delayedCall(800, () => { if (root.active) { killTweensForTree(scene, root); root.destroy(true); } });
    return root;
  }
  const cardAction = (card: any, enemyId: string) => {
    const root = group('flyway-suit-action'); if (!root) return;
    counters.suitActions += 1;
    const suit = card.runtime.suit; const enemy = scene.enemies.find((e: any) => e.id === enemyId);
    const view = enemy ? scene.enemyView(enemy) : { x: 800, y: 280 };
    const reduced = prefersReducedMotion();
    const color = suit === 'plumes' ? 0xe6ac72 : suit === 'quills' ? 0xbccad8 : suit === 'basins' ? 0x93cfcf : 0xd5bc83;
    for (let i = 0; i < (reduced ? 2 : prefersLeanEffects() ? 5 : 9); i++) {
      const x = suit === 'basins' || suit === 'nests' ? 250 : view.x;
      const y = suit === 'basins' || suit === 'nests' ? 350 : view.y;
      const object = suit === 'basins' ? scene.add.ellipse(x, y + 30 + i * 4, 26 + i * 14, 7 + i * 3).setStrokeStyle(2, color, .65)
        : suit === 'nests' ? scene.add.rectangle(x - 40 + i * 10, y, 6, 44, color, .8).setAngle(i % 2 ? 28 : -28)
        : scene.add.ellipse(x - 30 + i * 8, y, suit === 'quills' ? 38 : 20, suit === 'quills' ? 3 : 7, color, .85).setAngle(suit === 'quills' ? -28 : -55 + i * 12);
      root.add(object);
      if (!reduced) scene.tweens.add({ targets: object, y: y + (suit === 'basins' ? 34 : -25), x: x - 24 + i * 10, alpha: 0, duration: 450 + i * 20, ease: 'Sine.easeOut' });
    }
    // These portraits match the exact species on their cards.
    const cameoLeader = ({ major_00: 'fledgling', swords_ace: 'talon', cups_ace: 'tidewarden' } as Record<string,string>)[card.id];
    const asset = cameoLeader ? codexLeaderArtAssets[cameoLeader] : undefined;
    if (asset && scene.textures.exists(asset.key)) {
      counters.cameos += 1;
      const image = scene.add.image(360, 280, asset.key).setName('flyway-card-bird');
      image.setScale(125 / image.height).setAlpha(.92); root.add(image);
      if (!reduced) scene.tweens.add({ targets: image, x: suit === 'quills' ? view.x - 70 : 440, y: 245, angle: suit === 'quills' ? -12 : 7, alpha: 0, duration: 620, ease: 'Sine.easeInOut' });
    }
    // Canal water spreads outward; rooftop grit lifts in a narrow contact oval.
    const ripple = scene.add.ellipse(view.x, 355, mapIndex(scene)===1?30:18, mapIndex(scene)===1?6:3).setStrokeStyle(mapIndex(scene)===1?2:1, districts[mapIndex(scene)].tint, .6); root.add(ripple);
    if (!reduced) scene.tweens.add({ targets: ripple, scaleX: 4, scaleY: 2, alpha: 0, duration: 550 });
    counters.impacts += 1;
  };
  const molt = (entering: boolean) => {
    counters.moltTransitions += 1; const root = group('flyway-molt-transition'); if (!root) return;
    const color = entering ? 0xefbf7f : 0xa9c9dd;
    const label = scene.add.text(640, 180, entering ? 'MOLT · make this opening count' : 'OPEN SKY · bring them home', {fontFamily:UI_FONT,fontSize:'24px',fontStyle:'bold',color:entering?'#f4d59e':'#d6e7f5',backgroundColor:'#0b1723',padding:{x:16,y:10}}).setOrigin(.5);
    root.add(label);
    for (const side of [-1,1]) { const wing = scene.add.triangle(640 + side * 130, 220, 0, 0, side * 140, -35, side * 65, 35, color, .2); root.add(wing); if (!prefersReducedMotion()) scene.tweens.add({targets:wing,x:640+side*250,alpha:0,duration:650}); }
    if (!prefersReducedMotion()) scene.tweens.add({targets:label,alpha:0,delay:450,duration:300});
  };
  const phase = () => { counters.phaseChanges += 1; const root = group('flyway-boss-reaction'); if (!root) return; for(let i=0;i<6;i++){const paper=scene.add.rectangle(700+i*40,350,12,5,0xc6b794,.7);root.add(paper);if(!prefersReducedMotion())scene.tweens.add({targets:paper,y:300-i*4,x:740+i*45,angle:i*27,alpha:0,duration:600});} };
  const tick = () => {
    if (!scene.flock || scene.mode !== 'battle') return;
    if (mapIndex(scene) === 1) scene.events.emit('canal-backdrop');
    if (mapIndex(scene) === 2) scene.events.emit('spire-backdrop');
    if (mapIndex(scene) === 3) scene.events.emit('roost-backdrop');
    const musicState = scene.flock.molt ? 'molt' : scene.flock.exposed ? 'open-sky' : scene.enemies.some((e:any)=>e.phase===2&&e.hp>0) ? 'boss-phase' : scene.flock.flow >= scene.flock.flowMax ? 'surge' : scene.flock.flow > 0 ? 'flow' : 'planning';
    if (musicState !== lastMode) { lastMode=musicState; birdAudio.setFlightState(musicState, mapIndex(scene)); }
    const art = scene.root?.getByName('combat-leader-art');
    if (art && !art.getData('flyway-personality')) {
      art.setData('flyway-personality',true);
      const personality = ({fledgling:{angle:.7,dx:1.8,duration:1250},spark_caller:{angle:1.1,dx:2.4,duration:950},talon:{angle:-.6,dx:-1.5,duration:1800},tidewarden:{angle:.35,dx:.6,duration:2600},roostkeeper:{angle:-.25,dx:.4,duration:2200}} as Record<string,{angle:number,dx:number,duration:number}>)[scene.runLeaderId] ?? {angle:.4,dx:1,duration:1700};
      if (!motionState().reduced && !prefersLeanEffects()) scene.tweens.add({targets:art,angle:personality.angle,x:art.x+personality.dx,duration:personality.duration,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    }
    for (const {group:pose,enemy} of scene.enemyPoseGroups?.values() ?? []) if(mapIndex(scene)!==3&&enemy.runtime.type==='boss'&&!pose.getData('flyway-personality')) {
      pose.setData('flyway-personality',true); const stance=[{angle:.65,dx:1.4,duration:1600},{angle:-.35,dx:.7,duration:2400},{angle:-.9,dx:2,duration:1300},{angle:.25,dx:.3,duration:2800}][mapIndex(scene)]; if(!prefersReducedMotion()&&!prefersLeanEffects())scene.tweens.add({targets:pose,angle:stance.angle,x:pose.x+stance.dx,duration:stance.duration,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    }
    const layer = scene.backdropLayer;
    const lighting = layer?.getByName('flyway-district-light');
    lighting?.setFillStyle(scene.flock.molt ? 0xe8b475 : scene.flock.exposed ? 0x8daebc : districts[mapIndex(scene)].tint, scene.flock.molt || scene.flock.exposed ? .07 : .035);
    const hand = scene.handLayer;
    if(hand?.active && !hand.getByName('flyway-molt-rail')) hand.add(scene.add.rectangle(640,498,910,2,0xe8b475,.8).setName('flyway-molt-rail'));
    hand?.getByName('flyway-molt-rail')?.setVisible(Boolean(scene.flock.molt));
    if(layer?.active&&!layer.getByName('flyway-district-light')){
      const light=scene.add.rectangle(640,240,1280,320,districts[mapIndex(scene)].tint,.035).setName('flyway-district-light');layer.add(light);
      if(!prefersReducedMotion()&&!prefersLeanEffects()) for(let i=0;i<7;i++){
        const rain=mapIndex(scene)===1;
        const mote=scene.add.rectangle(70+i*175,120+(i%3)*55,rain?2:9,rain?16:3,districts[mapIndex(scene)].tint,.2).setAngle(rain?-15:12).setName('flyway-district-weather');layer.add(mote);
        scene.tweens.add({targets:mote,x:mote.x+45,y:mote.y+(rain?160:-25),alpha:0,duration:1800+i*140,repeat:-1,delay:i*110});
      }
    }
  };
  const timer=scene.time.addEvent({delay:180,loop:true,callback:tick});
  scene.events.on('flyway-card',cardAction); scene.events.on('flyway-molt',molt); scene.events.on('flyway-break',phase); scene.events.on('flyway-phase',phase);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{timer.remove(false);scene.events.off('flyway-card',cardAction);scene.events.off('flyway-molt',molt);scene.events.off('flyway-break',phase);scene.events.off('flyway-phase',phase);birdAudio.setFlightState('planning',0);});
}
