import Phaser from 'phaser';
import { birdAudio, currentCombatNodes } from '../main';
import { signaturePhase } from './signature-fights';
import { flightHighlights } from './flight-highlights';
import { cardLibrary } from '../main';
import { callSpecializations, resolvedLeaderCall, combinations, rivalChapter, journal, type FlywayState } from './flyway-rules';
import { capstones, type Capstone } from './signature-capstones';
import { combinationReading, encounterDecision } from './combat-reading';

type Scene=Phaser.Scene & Record<string,any>;
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const section=(root:HTMLElement,title:string,text:string)=>{const n=el('section');n.append(el('h2',title),el('p',text));root.append(n);return n;};
const button=(text:string,action:()=>void)=>{const b=el('button',text);b.type='button';b.onclick=action;return b;};

export function renderIdentity(root:HTMLElement,scene:Scene,s:FlywayState,mutate:(fn:()=>void)=>boolean, giftOnly=false){
  const leader=scene.runState?.leaderId??scene.runLeaderId??'fledgling';
  const call=resolvedLeaderCall(leader,s);
  if(!scene.runState)return;
  const capstone = section(root, 'A gift from the Canal', s.capstone ? `${capstones[s.capstone].name}: ${capstones[s.capstone].description}`
    : s.restored.includes(1) ? 'The market birds offer one capstone for this flight. Inspect its timing and limitation before committing.' : 'Restore Canal Markets to earn one strategy capstone.');
  capstone.dataset.signatureCapstones = 'true';
  if (!s.capstone && s.restored.includes(1)) for (const [id, mark] of Object.entries(capstones)) {
    const row = section(capstone, mark.name, mark.description);
    row.append(button(`Try ${mark.name}`, () => scene.previewCapstone?.(id)));
    row.append(button(`Inspect ${mark.name}`, () => {
      row.querySelector('[data-capstone-confirm]')?.remove();
      const confirmation = el('div'); confirmation.dataset.capstoneConfirm = id;
      confirmation.append(el('p', 'Choose one for this flight. The other two gifts become unavailable.'), button(`Carry ${mark.name}`, () => mutate(() => {
        const current = scene.runState.flyway as FlywayState;
        if (current.capstone || !current.restored.includes(1)) return;
        current.capstone = id as Capstone; journal(current, `${mark.name}: ${mark.description}`);
      })), button('Keep deciding', () => confirmation.remove()));
      row.append(confirmation); confirmation.querySelector('button')?.focus();
    }));
  }
  if(giftOnly)return;
  const box=section(root,'Your Leader’s next step',s.callStyle?`${call.name}: ${call.effect} ${call.tradeoff}`:s.restored.length?'Choose a Call specialization for the rest of this flight, or keep the base Call. Charge and once-per-fight limits stay the same.':'Defeat your first district boss to choose one of two Call specializations.');
  box.dataset.flockIdentity='specializations';
  if(s.callStyle||!s.restored.length)return;
  for(const choice of callSpecializations[leader]??callSpecializations.fledgling){
    const row=section(box,choice.name,`${choice.effect} ${choice.tradeoff} Base damage and Cover use normal formation modifiers.`);
    const pick=button(`Inspect ${choice.name}`,()=>{
      row.querySelector('[data-call-confirm]')?.remove();
      const confirm=el('div');confirm.dataset.callConfirm=choice.style;
      confirm.append(el('p','This replaces the base Call for this flight. The other specialization will be unavailable.'),button(`Commit ${choice.name}`,()=>{const saved=mutate(()=>{
        const current=scene.runState.flyway as FlywayState;
        if(!current.restored.length||current.callStyle)return;
        current.callStyle=choice.style;journal(current,`${choice.name}: ${choice.effect} ${choice.tradeoff}`);
      });if(saved)document.querySelector('[data-flock-identity]')?.scrollIntoView({block:'center'});}),button('Keep deciding',()=>confirm.remove()));row.append(confirm);confirm.querySelector('button')?.focus();
    });row.append(pick);
  }
}

export function renderIdentityEnding(root:HTMLElement,s:FlywayState){
  const labels = ['A combination to remember', 'A familiar wing', 'A choice in the city', 'Your next flock'];
  flightHighlights(s, id => cardLibrary[id]?.name ?? id).forEach((text, i) => section(root, labels[i], text));
  if(s.rivalWins)section(root,'Caldra keeps the crossing',rivalChapter(s.rivalWins-1).ending);
  if(s.story==='chorus-line')section(root,s.storyComplete?'Every roof answers':'The unfinished chorus',s.storyComplete?'Spark-Caller waits. One call returns from the market, another from the mast, then a whole street answers. The warning is now everyone’s song.':'The warning reached some roofs. Spend 12 Resonance and use three Calls on a winning flight to complete the chorus.');
  if(s.story==='clean-cut')section(root,s.storyComplete?'A path for smaller wings':'The watch remains',s.storyComplete?'Talon folds the striking wing and lands beside the smallest bird. The watch has stepped back; the whole flock crosses together.':'The flock found openings, but the passage is unfinished. Land 12 card hits on Winded enemies and use three Calls on a winning flight.');
}

/** Bounded HUD and signatures; gameplay never waits for this optional module. */
export function installIdentity(scene:Scene,blocked:()=>boolean,openCall:()=>void,readingBlocked=blocked){
  if(scene.scene.key!=='BattleScene')return {update:()=>{},destroy:()=>{}};
  const callButton=button('Inspect Call · F9',openCall);callButton.className='identity-call';callButton.id='identity-call';
  const sequence=el('div');sequence.className='identity-sequence';sequence.id='identity-sequence';sequence.setAttribute('role','status');sequence.setAttribute('aria-live','polite');
  document.body.append(callButton,sequence);
  const fight = el('div'); fight.id = 'signature-fight'; fight.className = 'identity-sequence';
  fight.setAttribute('role', 'status'); fight.setAttribute('aria-live', 'polite'); document.body.append(fight);
  const stats={decisionMs:0,animationMs:0,rewardMs:0,cleanupMs:0,signatures:0};scene.identityPacing=stats;
  let last=performance.now();
  let alive=true, performances: ReturnType<typeof import('./living-performances')['installLivingPerformances']> | undefined;
  void import('./living-performances').then(module=>{if(alive)performances=module.installLivingPerformances(scene);}).catch(()=>{});
  const update=()=>{
    const now=performance.now(),dt=Math.min(500,now-last);last=now;
    const paused=scene.sys.isPaused()||!scene.sys.isActive()||document.hidden||scene.pauseOverlayOpen||scene.settingsOverlayOpen;
    if(!paused){
      if(scene.mode==='battle'){
        if(scene.combatAnimationPending||scene.combatIntroActive)stats.animationMs+=dt;
        else if(!blocked()){
          stats.decisionMs+=dt;
          const living=scene.enemies.filter((e:any)=>e.hp>0);
          if(living.length===1&&living[0].hp<=living[0].maxHp*.2)stats.cleanupMs+=dt;
        }
      }else if(!blocked()&&['cardReward','upgradeReward','waymarkReward'].includes(scene.mode))stats.rewardMs+=dt;
    }
    const hidden=readingBlocked()||paused||scene.mode!=='battle';callButton.hidden=blocked()||hidden;
    const focus=scene.motionFocus?.active ? scene.motionFocus : undefined;
    sequence.hidden=hidden||!!scene.selectedInstanceId&&!focus;
    const phase = signaturePhase(currentCombatNodes()[scene.currentRouteIndex]?.payloadId ?? '', scene.enemies);
    scene.signatureFight = phase;
    fight.hidden = hidden || !phase || !!scene.selectedInstanceId;
    if(hidden){scene.combatReading=undefined;return;}
    const r=scene.game.canvas.getBoundingClientRect(),scale=r.width/1280;
    Object.assign(fight.style, { left: `${r.left+370*scale}px`, top: `${r.top+372*scale}px`, width: `${625*scale}px`, fontSize: `${Math.max(12,16*scale)}px`, borderLeft: `4px solid ${phase?.phase===3?'#90d4b5':'#edba72'}` });
    const phaseText = phase ? `${phase.name} · ${phase.text}` : '';
    if (fight.textContent !== phaseText) fight.textContent = phaseText;
    fight.title = phase?.lesson ?? '';
    Object.assign(callButton.style,{left:`${r.left+14*scale}px`,top:`${r.top+321*scale}px`,width:`${142*scale}px`,fontSize:`${Math.max(12,14*scale)}px`});
    Object.assign(sequence.style,{left:`${r.left+370*scale}px`,top:`${r.top+402*scale}px`,width:`${625*scale}px`,fontSize:`${scene.motionPayoff && scene.time.now < scene.motionPayoff.until ? Math.max(14,18*scale) : Math.max(12,15*scale)}px`});
    const call=resolvedLeaderCall(scene.runLeaderId,scene.flyway),combat=scene.flightCombat;
    const label=combat.called?'Call used · F9':combat.charge>=call.goal?'Call ready · F9':`Call ${combat.charge}/${call.goal} · F9`;
    if(callButton.textContent!==label)callButton.textContent=label;
    callButton.title=`${call.name}: ${call.charge} ${call.effect}`;
    callButton.setAttribute('aria-label',`Inspect Leader Call. ${call.name}. ${combat.charge}/${call.goal}. ${combat.called?'Used this fight.':call.effect} Keyboard F9; controller View.`);
    const announcement = scene.identityAnnouncement && scene.time.now < scene.identityAnnouncement.until ? scene.identityAnnouncement.text : scene.openingReaction && scene.time.now < scene.openingReaction.until ? scene.openingReaction.text : undefined;
    const casting=focus && ['anticipation','commit'].includes(focus.phase);
    const payoff=!casting && scene.motionPayoff && scene.time.now < scene.motionPayoff.until ? scene.motionPayoff : undefined;
    const decision=encounterDecision(currentCombatNodes()[scene.currentRouteIndex]?.payloadId??'',scene.enemies,scene.enemyDefeatedTurns);
    const text=casting ? `${focus.name} → ${focus.target} · ${focus.style==='shelter'?'Shelter':focus.style==='retreat'?'Support':focus.style==='rally'?'Rally':'Strike'}`
      : payoff?.text ?? announcement ?? decision ?? combinationReading(scene);
    if(sequence.textContent!==(text??''))sequence.textContent=text??'';
    sequence.hidden ||= !text;
    sequence.title=casting ? `${focus.bird} · ${focus.name} → ${focus.target}` : payoff?.detail ?? text ?? '';
    sequence.setAttribute('aria-label',sequence.title);
    sequence.dataset.feedback=casting?'action':payoff?'resolved':decision?'decision':'combination';
    scene.combatReading={text:text??'',detail:sequence.title,visible:!sequence.hidden,kind:sequence.dataset.feedback,actor:focus?{...focus}:undefined};
  };
  const key=(event:KeyboardEvent)=>{
    if(event.code!=='F9'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||blocked()||!scene.sys.isActive()||scene.mode!=='battle')return;
    if((event.target as HTMLElement)?.matches('input,textarea,[contenteditable=true]'))return;
    event.preventDefault();event.stopImmediatePropagation();openCall();
  };window.addEventListener('keydown',key,true);
  const signature=(kind:string,name:string)=>{
    if(scene.mode!=='battle')return;
    stats.signatures++;
    scene.identityAnnouncement={text:name,until:scene.time.now+1400};
    const combo=combinations.find(c=>c.id===kind);
    if(combo)birdAudio.play(combo.effect==='damage'?'hitConfirm':combo.effect==='cover'?'cover':'spend',.65);
    update();
  };
  const onCall=(name?:string)=>signature('call',name??resolvedLeaderCall(scene.runLeaderId,scene.flyway).name);
  const onCombo=(combo?:{id:string;name:string})=>{if(combo){
    scene.flockCombination=scene.lastFlockCard&&scene.lastFlockCard.turn===scene.turn&&scene.resolvingCard
      ? {name:combo.name,first:scene.lastFlockCard.name,cardId:scene.resolvingCard.id} : undefined;
    signature(combo.id,combo.name);
  }};
  const onCard=(card:any)=>{scene.lastFlockCard={id:card.id,name:card.name,turn:scene.turn};};
  scene.events.on('flyway-call',onCall);scene.events.on('flyway-combination',onCombo);scene.events.on('flyway-card',onCard);
  return {update,destroy:()=>{alive=false;performances?.destroy();callButton.remove();sequence.remove();fight.remove();delete scene.motionFocus;delete scene.motionPayoff;delete scene.combatReading;delete scene.lastFlockCard;delete scene.flockCombination;window.removeEventListener('keydown',key,true);scene.events.off('flyway-call',onCall);scene.events.off('flyway-combination',onCombo);scene.events.off('flyway-card',onCard);}};
}
