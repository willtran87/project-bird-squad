import { currentCombatNodes, currentMove } from '../main';
import { beginPracticeSession, endPracticeSession } from './practice-session';
import { memoryStorageSessionActive, safeStorageGet, safeStorageSet } from './safe-storage';
import { capstones, type Capstone } from './signature-capstones';
import type { TurnResult } from './turn-practice';

const key = 'birdsquad.feedback.v1';
let returnRoute: any;
let demoChoice: Capstone | undefined;
const el = (tag: string, text: string) => { const node = document.createElement(tag); node.textContent = text; return node; };
const button = (text: string, action: () => void) => { const b = document.createElement('button'); b.textContent = text; b.onclick = action; return b; };
function markers(): any[] { try { const data = JSON.parse(safeStorageGet(key) ?? '[]'); return Array.isArray(data) ? data.slice(-50) : []; } catch { return []; } }

export function startCapstoneDemo(scene: any, choice: Capstone) {
  if (!scene.runState || memoryStorageSessionActive() || !scene.runState.flyway.restored.includes(1)) return;
  const node = currentCombatNodes().find(node => node.type === 'street');
  if (!node || !beginPracticeSession(undefined, () => { if (returnRoute) { scene.scene.stop(); returnRoute=undefined; demoChoice=undefined; } })) return;
  returnRoute = structuredClone(scene.runState); demoChoice = choice;
  const runState = structuredClone(returnRoute);
  runState.flyway.capstone = choice;
  runState.deck = ['swords_ace','wands_ace','cups_ace','pentacles_ace','aviary_25'].map(id => ({id,upgraded:false}));
  runState.pendingCombatReward = undefined;
  scene.scene.launch('BattleScene', {runState,routeNodeId:node.id,practiceRematch:true});
  scene.scene.sleep();
}

export function renderWorkshop(root: HTMLElement, scene: any, close: () => void) {
  root.dataset.flightWorkshop='true';
  root.append(el('h2', 'Practice & feedback'));
  if (!memoryStorageSessionActive()) { returnRoute = undefined; demoChoice = undefined; }
  if (demoChoice && returnRoute) {
    root.append(el('h3', `${capstones[demoChoice].name} · practice demonstration`), el('p', capstones[demoChoice].description),
      el('p', 'Try the trigger in this small practice deck. This uses the real combat rules; rewards and choices stay in memory.'),
      button('Return to the Canal gift', () => {
        close(); returnRoute=undefined; demoChoice=undefined; endPracticeSession();
        const route=scene.scene.get('RouteScene');
        route.events.once('wake',()=>route.openFlyway?.('gift'));
        scene.scene.stop(); scene.scene.wake('RouteScene');
      }));
  }
  const checkpoint = scene.turnCheckpoint;
  if (checkpoint?.result && (scene.mode === 'defeat' || scene.practiceTurn)) {
    root.append(el('h3', `Try turn ${checkpoint.values.turn} again`),
      el('p', 'Restore the hand, enemies, resources and random state from the start of this turn. Future draws stay hidden. Compare one enemy phase; this is an experiment, not a best-move score.'));
    const table = document.createElement('table');
    const header = document.createElement('tr'); ['After the turn','Original','Practice'].forEach(text => header.append(el('th',text))); table.append(header);
    const names: Record<keyof TurnResult,string> = {cohesion:'Cohesion',cover:'Cover',wingbeats:'Unspent Wingbeats',resonance:'Resonance',survivors:'Enemies standing',damage:'Damage dealt this turn'};
    for (const [field,label] of Object.entries(names)) {
      const row=document.createElement('tr'), offset=field==='damage'?checkpoint.values.statDealt:0;
      row.append(el('th',label),el('td',String(checkpoint.result[field]-offset)),el('td',scene.practiceTurnResult?String(scene.practiceTurnResult[field]-offset):'Awaiting a turn'));
      table.append(row);
    }
    root.append(table, button('Retry this turn', () => {
      if (!scene.ensureOutcomeSaved()) return;
      if (!memoryStorageSessionActive() && !beginPracticeSession()) return;
      close(); scene.scene.restart({...structuredClone(scene.battleStartingData),practiceRematch:true,turnCheckpoint:structuredClone(checkpoint)});
    }));
  } else root.append(el('p','After a defeat, return here to retry the final turn. You can also practice the whole fight from the defeat screen.'));
  const feedback = el('section',''); feedback.dataset.feedbackMarkers='true'; root.append(feedback);
  feedback.append(el('h3','Mark this moment'), el('p','Optional local feedback. Includes the visible hand, resources and enemy Tells. Nothing is sent automatically. Keeps the latest 50 markers.'));
  const status=el('p',`${markers().length} local markers.`); status.setAttribute('role','status');
  for (const label of ['Confusing','Satisfying','Slow']) feedback.append(button(label, () => {
    const marker = {label,at:new Date().toISOString(),scene:scene.scene.key,mode:scene.mode,turn:scene.turn,
      map:scene.flywayMapIndex??scene.runState?.mapIndex,practice:memoryStorageSessionActive(),
      hand:scene.hand?.map((card:any)=>({id:card.id,upgraded:card.upgraded})),energy:scene.energy,resonance:scene.spark,
      cohesion:scene.flock?.hp,cover:scene.flock?.block,
      enemies:scene.enemies?.map((enemy:any)=>({id:enemy.runtime.id,hp:enemy.hp,cover:enemy.block,tell:currentMove(enemy).label,intentIndex:enemy.intentIndex})),
      recent:scene.combatHistory?.slice(-8)};
    const list=[...markers(),marker].slice(-50);
    status.textContent=safeStorageSet(key,JSON.stringify(list))?`${label} marked. ${list.length} local markers.`:'Could not save the marker. Your game is unchanged.';
  }));
  feedback.append(button('Export feedback', () => {
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,markers:markers()},null,2)],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download='bird-squad-feedback.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='Feedback export prepared. Share it only if you choose.';
  }),button('Clear local markers',()=>{status.textContent=safeStorageSet(key,'[]')?'Local markers cleared.':'Could not clear markers.';}),status);
}
