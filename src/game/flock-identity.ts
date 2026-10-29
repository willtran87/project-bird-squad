import Phaser from 'phaser';
import { birdAudio, prefersReducedMotion, killTweensForTree, UI_FONT, queueRuntimeImageAssets, currentCombatNodes } from '../main';
import { signaturePhase } from './signature-fights';
import { prefersLeanEffects } from './graphics-quality';
import { flightHighlights } from './flight-highlights';
import { cardLibrary } from '../main';
import { codexLeaderArtAssets } from './leader-portrait-assets';
import { callSpecializations, resolvedLeaderCall, combinations, rivalChapter, journal, type FlywayState } from './flyway-rules';
import { capstones, type Capstone } from './signature-capstones';

type Scene=Phaser.Scene & Record<string,any>;
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const section=(root:HTMLElement,title:string,text:string)=>{const n=el('section');n.append(el('h2',title),el('p',text));root.append(n);return n;};
const button=(text:string,action:()=>void)=>{const b=el('button',text);b.type='button';b.onclick=action;return b;};

export function renderIdentity(root:HTMLElement,scene:Scene,s:FlywayState,mutate:(fn:()=>void)=>boolean){
  const leader=scene.runState?.leaderId??scene.runLeaderId??'fledgling';
  const call=resolvedLeaderCall(leader,s);
  if(!scene.runState)return;
  const capstone = section(root, 'A gift from the Canal', s.capstone ? `${capstones[s.capstone].name}: ${capstones[s.capstone].description}`
    : s.restored.includes(1) ? 'The market birds offer one capstone for this flight. Inspect its timing and limitation before committing.' : 'Restore Canal Markets to earn one strategy capstone.');
  capstone.dataset.signatureCapstones = 'true';
  if (!s.capstone && s.restored.includes(1)) for (const [id, mark] of Object.entries(capstones)) {
    const row = section(capstone, mark.name, mark.description);
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
export function installIdentity(scene:Scene,blocked:()=>boolean,openCall:()=>void){
  if(scene.scene.key!=='BattleScene')return {update:()=>{},destroy:()=>{}};
  const callButton=button('Inspect Call · F9',openCall);callButton.className='identity-call';callButton.id='identity-call';
  const sequence=el('div');sequence.className='identity-sequence';sequence.id='identity-sequence';sequence.setAttribute('role','status');sequence.setAttribute('aria-live','polite');
  document.body.append(callButton,sequence);
  const fight = el('div'); fight.id = 'signature-fight'; fight.className = 'identity-sequence';
  fight.setAttribute('role', 'status'); fight.setAttribute('aria-live', 'polite'); document.body.append(fight);
  const stats={decisionMs:0,animationMs:0,rewardMs:0,cleanupMs:0,signatures:0};scene.identityPacing=stats;
  let last=performance.now(),active=0;
  let alive=true, performances: ReturnType<typeof import('./living-performances')['installLivingPerformances']> | undefined;
  void import('./living-performances').then(module=>{if(alive)performances=module.installLivingPerformances(scene);}).catch(()=>{});
  const update=()=>{
    performances?.update();
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
    const hidden=blocked()||paused||scene.mode!=='battle';callButton.hidden=hidden;sequence.hidden=hidden||!!scene.selectedInstanceId;
    const phase = signaturePhase(currentCombatNodes()[scene.currentRouteIndex]?.payloadId ?? '', scene.enemies);
    scene.signatureFight = phase;
    fight.hidden = hidden || !phase || !!scene.selectedInstanceId;
    if(hidden)return;
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
    const next=combinations.filter(c=>c.first===combat.previousSuit&&!combat.combos.includes(c.id));
    const text=scene.motionPayoff && scene.time.now < scene.motionPayoff.until ? scene.motionPayoff.text : next.length?next.map(c=>`${c.name}: ${c.first} → ${c.second}`).join(' · '):combat.previousSuit?`Last suit: ${combat.previousSuit} · no unfinished combination`:'Combinations: Nests → Quills · Basins → Plumes · Quills → Basins';
    if(sequence.textContent!==text)sequence.textContent=text;
    sequence.dataset.feedback=scene.motionPayoff && scene.time.now < scene.motionPayoff.until ? 'resolved' : 'combination';
  };
  const key=(event:KeyboardEvent)=>{
    if(event.code!=='F9'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||blocked()||!scene.sys.isActive()||scene.mode!=='battle')return;
    if((event.target as HTMLElement)?.matches('input,textarea,[contenteditable=true]'))return;
    event.preventDefault();event.stopImmediatePropagation();openCall();
  };window.addEventListener('keydown',key,true);
  queueRuntimeImageAssets(scene,Object.values(codexLeaderArtAssets),'Leader signature portraits unavailable');
  const signature=(kind:string,name:string)=>{
    if(!scene.fxLayer?.active||active>=2)return;
    const leader=scene.runLeaderId??'fledgling';
    const index=['fledgling','spark_caller','talon','tidewarden','roostkeeper'].indexOf(leader);
    const combo=combinations.find(c=>c.id===kind),reduced=prefersReducedMotion()||prefersLeanEffects();
    const color=combo?.effect==='cover'?0x94d4d6:combo?.effect==='damage'?0xcbd9e5:0xe8bf78;
    const group=scene.add.container().setName(`identity-signature-${kind}`);scene.fxLayer.add(group);active++;stats.signatures++;
    const caption=scene.add.text(480,205,name,{fontFamily:UI_FONT,fontSize:'18px',color:'#fff1cf',backgroundColor:'#0a1721',padding:{x:10,y:6}}).setOrigin(.5);group.add(caption);
    const art=codexLeaderArtAssets[leader];
    if(art&&scene.textures.exists(art.key)&&(combo||!scene.livingPerformances?.ready)){
      const bird=scene.add.image(400,290,art.key);bird.setScale(105/bird.height);group.add(bird);
      if(!reduced)scene.tweens.add({targets:bird,x:combo?.effect==='damage'||index===2?565:index===3?435:485,y:index===4?302:index===3?270:245,angle:index===2?-18:index===4?0:9,duration:420,yoyo:true});
    }
    for(let n=0;n<(reduced?1:3);n++){
      const wing=scene.add.ellipse(480+n*23,300,combo?.effect==='cover'?65:32,combo?.effect==='damage'?4:10,color,.8).setAngle(combo?.effect==='damage'?-35:combo?.effect==='cover'?0:n*18-18);group.add(wing);
      if(!reduced)scene.tweens.add({targets:wing,x:wing.x+(combo?.effect==='damage'?90:20),y:wing.y-(combo?.effect==='cover'?0:30),alpha:0,duration:540+n*60});
    }
    if(combo||!scene.livingPerformances?.ready)birdAudio.play(combo?(combo.effect==='damage'?'hitConfirm':combo.effect==='cover'?'cover':'spend'):(['formation','spend','heavyAttack','heal','coverBlock'] as const)[Math.max(0,index)],.65);
    group.once('destroy',()=>{active=Math.max(0,active-1);});
    scene.time.delayedCall(850,()=>{if(group.active){killTweensForTree(scene,group);group.destroy(true);}});
  };
  const onCall=(name?:string)=>signature('call',name??resolvedLeaderCall(scene.runLeaderId,scene.flyway).name);
  const onCombo=(combo?:{id:string;name:string})=>{if(combo)signature(combo.id,combo.name);};
  scene.events.on('flyway-call',onCall);scene.events.on('flyway-combination',onCombo);
  return {update,destroy:()=>{alive=false;performances?.destroy();callButton.remove();sequence.remove();fight.remove();window.removeEventListener('keydown',key,true);scene.events.off('flyway-call',onCall);scene.events.off('flyway-combination',onCombo);}};
}
