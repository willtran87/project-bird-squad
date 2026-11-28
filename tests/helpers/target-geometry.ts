import {expect, type Page} from '@playwright/test';

/** Inspect actual hit areas and Phaser's topmost receiver, not decorative art
 * bounds or obscured controls belonging to a parent behind a modal. */
export async function targetGeometry(page: Page, scene: string) {
  return page.evaluate(scene => {
    const s=(window as any).__birdSquadGame.scene.getScene(scene);
    const scale=s.game.canvas.getBoundingClientRect().height/720;
    if(document.getElementById('folio-editor-actions')){
      const canvas=s.game.canvas.getBoundingClientRect();
      return [...document.querySelectorAll('[data-folio-editor],#folio-editor-actions button')].map(o=>{
        const b=o.getBoundingClientRect();
        return {name:o.id||o.getAttribute('aria-label')||'Folio text field',type:o.tagName,owner:'native-editor',
          label:o.textContent,enemyId:'',backdrop:false,blockedBy:undefined,kind:undefined,reachable:true,coveredBy:undefined,circular:false,
          left:(b.left-canvas.left)/scale,right:(b.right-canvas.left)/scale,top:(b.top-canvas.top)/scale,bottom:(b.bottom-canvas.top)/scale,
          width:b.width,height:b.height};
      });
    }
    const walk=(list:any[],owner='scene',enemyId=''):any[]=>list.flatMap(o=>o.visible&&o.alpha!==0?
      [{node:o,owner,enemyId:o.getData?.('enemyId')??enemyId},
        ...walk(o.list??[],o.name||owner,o.getData?.('enemyId')??enemyId)]:[]);
    return walk(s.children.list).filter(({node:o})=>o.input?.enabled&&(o.listenerCount('pointerdown')||o.listenerCount('pointerup')))
      .map(({node:o,owner,enemyId})=>{
        const a=o.input.hitArea,m=o.getWorldTransformMatrix(); let b=o.getBounds();
        const radius=typeof a?.radius==='number'?a.radius:0;
        if(a&&(typeof a.width==='number'||radius)){
          const x=(a.x??0)-radius-(o.displayOriginX??0),y=(a.y??0)-radius-(o.displayOriginY??0);
          const w=radius?2*radius:a.width,h=radius?2*radius:a.height;
          const pts=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>m.transformPoint(x,y));
          b={left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),
            top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))};
        }
        const pointer={x:(b.left+b.right)/2,y:(b.top+b.bottom)/2,camera:s.cameras.main};
        const receivers=s.input.manager.hitTest(pointer,s.input._list,s.cameras.main,[]);
        s.input.sortGameObjects(receivers,pointer);
        const label=o.getData('fullLabel')??o.getData('label')??o.getData('focus')??o.text;
        // Optional click-outside margins duplicate an explicit large Back/Close
        // action. They are dismissal space, not undersized command buttons.
        const isBackdrop=(n:any,l:any,w:number)=>/scrim|blocker/.test(n.name)||(!n.name&&!l&&w>=1279);
        const backdrop=isBackdrop(o,label,b.right-b.left);
        // The receiver that takes this control's centre, when it is another
        // command rather than a modal backdrop (used by the geometry sweep).
        // Only labelled command buttons in the same layer (top-level container)
        // count: a separate overlay layer gates the one beneath it in code, and
        // a modal backdrop owns the pointer events behind it by design.
        const top=receivers[0],own=receivers.indexOf(o);
        const layer=(n:any)=>{let p=n;while(p.parentContainer)p=p.parentContainer;return p===n?s.children:p;};
        const behindBackdrop=own<0||receivers.slice(0,own).some((r:any)=>isBackdrop(r,r.getData?.('label')??r.text,r.getBounds().width));
        const tb=top&&top!==o&&o.getData('controlKind')&&!behindBackdrop&&layer(top)===layer(o)?top.getBounds():undefined;
        const blockedBy=tb&&(top.listenerCount('pointerdown')||top.listenerCount('pointerup'))&&
          !isBackdrop(top,top.getData?.('label')??top.text,tb.right-tb.left)?
          {name:top.name,sameParent:top.parentContainer===o.parentContainer,left:tb.left,right:tb.right,top:tb.top,bottom:tb.bottom}:undefined;
        return {name:o.name,type:o.type,owner,label,enemyId,backdrop,blockedBy,kind:o.getData('controlKind') as string|undefined,
          reachable:pointer.x>=0&&pointer.x<=1280&&pointer.y>=0&&pointer.y<=720&&receivers[0]===o,
          coveredBy:receivers[0]?.name,circular:!!radius,left:b.left,right:b.right,top:b.top,bottom:b.bottom,
          width:(b.right-b.left)*scale,height:(b.bottom-b.top)*scale};
      }).filter(b=>b.right>0&&b.left<1280&&b.bottom>0&&b.top<720);
  },scene);
}

type Targets=Awaited<ReturnType<typeof targetGeometry>>;

function undersized(controls:Targets) {
  return controls.filter(t=>(t.width<43.99||t.height<43.99)&&
    // A status strip repeats its own enemy's large selection action; it does
    // not introduce a separate command that needs an independent touch slot.
    !(t.enemyId&&controls.some(a=>a.enemyId===t.enemyId&&a.width>=44&&a.height>=44)));
}

export function checkTargetGeometry(targets:Targets, context:string) {
  const controls=targets.filter(t=>t.reachable&&!t.backdrop);
  expect(controls.length,context+': actual reachable actions').toBeGreaterThan(0);
  expect(undersized(controls),context+': 44 CSS px floor').toEqual([]);
  expect(separationConflicts(controls),context+': shared 8px game-space separation').toEqual([]);
}

/** The same rules as checkTargetGeometry plus two more, returned as readable
 * strings so a sweep can report every surface at once: no command may hide
 * another command's centre (a modal backdrop may), and no reachable command
 * may straddle the stage edge. */
export function targetGeometryIssues(targets:Targets) {
  const controls=targets.filter(t=>t.reachable&&!t.backdrop);
  const issues:string[]=[];
  if(!controls.length)issues.push('no reachable actions');
  for(const t of undersized(controls))issues.push(`44 CSS px floor: ${t.name||t.owner} ${t.width.toFixed(1)}x${t.height.toFixed(1)}`);
  for(const c of separationConflicts(controls))issues.push(`8px separation: ${c.a} / ${c.b} gap ${c.gap.toFixed(1)}`);
  for(const t of targets){
    const b=t.blockedBy;
    if(t.backdrop||!b||t.enemyId)continue;
    // A nested action (in-card inspect, slider thumb) may sit on its own row;
    // a command from another container may not sit on top of this one.
    if(b.sameParent&&b.left>=t.left-1&&b.right<=t.right+1&&b.top>=t.top-1&&b.bottom<=t.bottom+1)continue;
    issues.push(`command hidden: ${t.name||t.owner} is covered by ${b.name||'unnamed command'}`);
  }
  for(const t of controls)if(t.kind&&(t.left<-1||t.right>1281||t.top<-1||t.bottom>721))issues.push(`command off stage: ${t.name||t.owner}`);
  return issues;
}

function separationConflicts(controls:Targets) {
  const conflicts:any[]=[];
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
    const a=controls[i],b=controls[j];
    // Enemy portrait, body and vitals select the same enemy. A slider or
    // in-card inspect action can intentionally nest inside its containing row.
    if(a.enemyId&&a.enemyId===b.enemyId)continue;
    if((a.left<=b.left&&a.right>=b.right&&a.top<=b.top&&a.bottom>=b.bottom)||
      (b.left<=a.left&&b.right>=a.right&&b.top<=a.top&&b.bottom>=a.bottom))continue;
    const circleRect=(circle:typeof a,rect:typeof a)=>{
      const x=(circle.left+circle.right)/2,y=(circle.top+circle.bottom)/2;
      return Math.hypot(x-Math.max(rect.left,Math.min(rect.right,x)),y-Math.max(rect.top,Math.min(rect.bottom,y)))-(circle.right-circle.left)/2;
    };
    const gap=a.circular&&b.circular?
      Math.hypot((a.left+a.right-b.left-b.right)/2,(a.top+a.bottom-b.top-b.bottom)/2)-(a.right-a.left+b.right-b.left)/2:
      a.circular?circleRect(a,b):b.circular?circleRect(b,a):Math.max(a.left-b.right,b.left-a.right,a.top-b.bottom,b.top-a.bottom);
    if(gap<7.9)conflicts.push({a:a.name||a.owner,b:b.name||b.owner,gap});
  }
  return conflicts;
}
