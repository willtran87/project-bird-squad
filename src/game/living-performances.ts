import type Phaser from 'phaser';
import { birdAudio, prefersReducedMotion } from '../main';
import { prefersLeanEffects } from './graphics-quality';

type Scene = Phaser.Scene & Record<string, any>;
type Action = { bird: string; clock: Phaser.Time.TimerEvent; until: number; kind: 'cast'|'hit'|'call'; budget: number; impact?: number; enemyId?: string; style: string };
const calls = { fledgling: 'flockSparrow', spark_caller: 'flockChorus', talon: 'flockShrike', tidewarden: 'flockHeron', roostkeeper: 'flockWeaver' } as const;
function phase(a:Action) {
  const elapsed=a.clock.getElapsed(), since=elapsed-(a.impact??Infinity);
  return a.kind==='hit'?(elapsed<110?'recoil':'recovery')
    :a.impact!==undefined?(since<90?'contact':'recovery')
    :a.kind==='call'?(elapsed<120?'anticipation':elapsed<300?'contact':'recovery')
    :elapsed<Math.max(40,a.budget*.35)?'anticipation':'commit';
}

/** One established body per combatant. No species, outfit, facing or texture
 * swaps. Enemy movement remains owned by the existing enemy presenter. */
export function installLivingPerformances(scene:Scene) {
  let alive=true, ambientAt=scene.time.now+14000;
  const actions=new Map<string,Action>();
  const status={ready:true,active:[] as Array<{bird:string;pose:string}>,crew:[] as never[],calls:0,artPolicy:'canonical-stills'};
  scene.livingPerformances=status;
  const pose=()=>scene.root?.getByName('combat-leader-art')?.getByName('combat-leader-pose');
  const reset=()=>pose()?.setPosition(0,0).setAngle(0).setScale(1).setAlpha(1).setData('performancePose','idle');
  const retire=(id:string)=>{actions.get(id)?.clock.remove(false);actions.delete(id);if(id==='leader')reset();};
  const start=(id:string,bird:string,kind:Action['kind'],budget=0,enemyId?:string,style='rally')=>{
    if(!alive||scene.mode!=='battle')return;
    retire(id);
    if(enemyId&&!scene.enemies.some((e:any)=>e.id===enemyId&&e.hp>0))return;
    const until=kind==='hit'?300:kind==='call'?480:Math.max(320,budget+300);
    actions.set(id,{bird,kind,budget,enemyId,style,until,clock:scene.time.addEvent({delay:until+1})});
    if(id==='leader'){const original=pose();if(original)scene.tweens.killTweensOf(original);}
  };
  const cast=(budget:number,style='rally')=>start('leader',scene.runLeaderId??'fledgling','cast',budget,undefined,style);
  const impact=()=>{const a=actions.get('leader');if(a?.kind==='cast'){a.impact=a.clock.getElapsed();a.until=a.impact+240;}};
  const flockCue=(cue:string)=>{
    if(cue==='hit')start('leader',scene.runLeaderId??'fledgling','hit');
    else if(!actions.has('leader'))start('leader',scene.runLeaderId??'fledgling','call',0,undefined,cue==='brace'?'shelter':cue==='heal'?'retreat':'rally');
  };
  const enemyStart=(id:string,budget:number)=>{
    const enemy=scene.enemies.find((e:any)=>e.id===id&&e.hp>0);
    if(enemy)start(`enemy:${id}`,enemy.runtime.id,'cast',budget,id);
  };
  const enemyImpact=(id:string)=>{
    const a=actions.get(`enemy:${id}`);
    if(a){a.impact=a.clock.getElapsed();a.until=a.impact+240;}
    // Caldra is a peafowl patron; her captain remains the canonical jackdaw.
    if(a?.bird==='tarline_jackdaw')birdAudio.play('flockJackdaw',.5);
  };
  const call=()=>{
    const leader=(scene.runLeaderId??'fledgling') as keyof typeof calls;
    start('leader',leader,'call');birdAudio.play(calls[leader]??calls.fledgling,.65);status.calls++;
  };
  const update=()=>{
    if(!alive||scene.sys.isPaused())return;
    const still=prefersReducedMotion()||prefersLeanEffects();
    for(const [id,a] of actions){
      const elapsed=a.clock.getElapsed(),since=elapsed-(a.impact??Infinity);
      if(elapsed>=a.until||scene.mode!=='battle'||a.enemyId&&!scene.enemies.some((e:any)=>e.id===a.enemyId&&e.hp>0)){retire(id);continue;}
      if(id==='leader'){
        const original=pose();
        if(original){
          // Bounded offsets, stable scale, no second body or crossfade.
          const strength=still||a.kind==='cast'?0:a.kind==='hit'?-Math.sin(Math.PI*Math.min(1,elapsed/300))
            :a.impact!==undefined?Math.max(0,1-since/240)
            :a.kind==='call'?Math.sin(Math.PI*Math.min(1,elapsed/480))
            :Math.min(1,elapsed/Math.max(1,a.budget));
          const defensive=a.style==='shelter'||a.style==='retreat';
          original.setPosition(strength*(defensive?-4:10),strength*(defensive?3:-4)).setAngle(strength*(defensive?-1:1.5))
            .setScale(1).setAlpha(1).setData('performancePose',phase(a));
        }
      }
    }
    status.active=[...actions.values()].map(a=>({bird:a.bird,pose:phase(a)}));
    if(scene.time.now>=ambientAt){ambientAt=scene.time.now+14000;if(!document.hidden&&!document.querySelector('dialog[open]')&&scene.mode==='battle'&&!scene.combatAnimationPending&&!scene.pauseOverlayOpen&&!scene.settingsOverlayOpen)birdAudio.play('rooftopAir',.45);}
  };
  scene.events.on('living-cast',cast);scene.events.on('flyway-card',impact);scene.events.on('living-flock-cue',flockCue);
  scene.events.on('living-enemy-start',enemyStart);scene.events.on('living-enemy-impact',enemyImpact);scene.events.on('flyway-call',call);scene.events.on('postupdate',update);
  return {update,destroy:()=>{
    alive=false;for(const id of [...actions.keys()])retire(id);status.active=[];
    scene.events.off('living-cast',cast);scene.events.off('flyway-card',impact);scene.events.off('living-flock-cue',flockCue);
    scene.events.off('living-enemy-start',enemyStart);scene.events.off('living-enemy-impact',enemyImpact);scene.events.off('flyway-call',call);scene.events.off('postupdate',update);
  }};
}
