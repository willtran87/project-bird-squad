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
          label:o.textContent,enemyId:'',backdrop:false,reachable:true,coveredBy:undefined,circular:false,
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
        const backdrop=/scrim|blocker/.test(o.name)||(!o.name&&!label&&b.right-b.left>=1279);
        return {name:o.name,type:o.type,owner,label,enemyId,backdrop,
          reachable:pointer.x>=0&&pointer.x<=1280&&pointer.y>=0&&pointer.y<=720&&receivers[0]===o,
          coveredBy:receivers[0]?.name,circular:!!radius,left:b.left,right:b.right,top:b.top,bottom:b.bottom,
          width:(b.right-b.left)*scale,height:(b.bottom-b.top)*scale};
      }).filter(b=>b.right>0&&b.left<1280&&b.bottom>0&&b.top<720);
  },scene);
}

export function checkTargetGeometry(targets:Awaited<ReturnType<typeof targetGeometry>>, context:string) {
  const controls=targets.filter(t=>t.reachable&&!t.backdrop);
  expect(controls.length,context+': actual reachable actions').toBeGreaterThan(0);
  expect(controls.filter(t=>(t.width<43.99||t.height<43.99)&&
    // A status strip repeats its own enemy's large selection action; it does
    // not introduce a separate command that needs an independent touch slot.
    !(t.enemyId&&controls.some(a=>a.enemyId===t.enemyId&&a.width>=44&&a.height>=44))),context+': 44 CSS px floor').toEqual([]);
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
  expect(conflicts,context+': shared 8px game-space separation').toEqual([]);
}
