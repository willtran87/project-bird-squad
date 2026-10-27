import type { CardSuit, RuntimeCard, RuntimeCardUpgrade, RuntimeEnemy } from './types';

export type PreenBranch = 'shelter' | 'flight' | 'canal-anchor' | 'canal-counter' | 'canal-chorus' | 'canal-cadence' | 'canal-harbor' | 'canal-current' | 'spire-watch' | 'spire-chorus' | 'spire-aperture';
export type FlightStoryId = 'open-sky' | 'small-flock' | 'unbroken' | 'chorus-line' | 'clean-cut';
export type FlywayCondition = 'clear' | 'crosswind' | 'rain' | 'scaffold';
export type FlywayRelic = 'woven-roost' | 'storm-pin' | 'light-travel';
export type RooftopPlan = 'shelter' | 'tempo' | 'molt';
/** Draft weight only: keeps rarity, singleton exclusions and structured slots. */
export function rooftopPlanMatch(plan: RooftopPlan | undefined, card: Pick<RuntimeCard, 'effects'>) {
  if (!plan) return false;
  const effects = card.effects?.join(' ') ?? '';
  return plan === 'shelter' ? /gainCover|fullyBlocksNextAttack|retainHand/.test(effects)
    : plan === 'tempo' ? /gainResonance|spendResonance|gainWingbeat/.test(effects)
    : plan === 'molt' ? /enterMolt|gainOpenSkyGuard/.test(effects) : false;
}
export interface FlywayState {
  version: 1;
  restored: number[];
  residents: Record<string, number>;
  visits: string[];
  rivalWins: number;
  rivalNodes: string[];
  settledNodes: string[];
  condition: FlywayCondition;
  conditionNode?: string;
  relic?: FlywayRelic;
  relicChosen: boolean;
  story?: FlightStoryId;
  storyComplete: boolean;
  medals: string[];
  journal: string[];
  combinations: number;
  leaderCalls: number;
  survivedMolt: number;
  cleanFights: number;
  rooftopPlan?: RooftopPlan;
  coachingOff?: boolean;
  cityAid?: Array<'sella' | 'oren' | 'ivo'>;
  callStyle?: 'shelter' | 'flight';
  resonanceSpent?: number;
  windedHits?: number;
  canalFerry?: { pledge: 'timber' | 'lamps'; startedAt: number; rewarded?: true };
  spireRelay?: { pledge: 'wires' | 'lenses'; startedAt: number; rewarded?: true; delivered?: true };
}
export const districts = [
  { name: 'Rooftop Blocks', color: '#edba72', tint: 0xe4a568, weather: 'Warm windows · drifting paper', restored: 'Neighbors cross the repaired clothesline. Window lanterns answer the first safe-flight call.' },
  { name: 'Canal Markets', color: '#86d8d4', tint: 0x72bfc4, weather: 'Canal rain · rippling reflections', restored: 'The sluice opens. Market awnings rise, and the water route carries food and shelter again.' },
  { name: 'Signal Spires', color: '#b5bcea', tint: 0xa8b2da, weather: 'Crosswinds · taut signal cables', restored: 'Calls leap from mast to mast. Couriers reclaim the high crossings above the city.' },
  { name: 'High Roost', color: '#f3deb1', tint: 0xf0d6a0, weather: 'Clear dawn · a vast open sky', restored: 'The final call reaches every district. Four broken routes become one living flyway.' },
] as const;
export const conditions: Record<FlywayCondition, { name: string; rule: string; reward: number }> = {
  clear: { name: 'Sheltered approach', rule: 'Standard combat conditions.', reward: 0 },
  crosswind: { name: 'Exposed crossing', rule: 'Begin with 1 fewer Wingbeat. Win for 20 bonus Scrap.', reward: 20 },
  rain: { name: 'Heavy rain', rule: 'Each Cover gain is reduced by 1, to a minimum of 0. Win for 20 bonus Scrap.', reward: 20 },
  scaffold: { name: 'Unstable scaffold', rule: 'Roost after three or more cards causes Open Sky. Win for 25 bonus Scrap.', reward: 25 },
};
export const relics: Record<FlywayRelic, { name: string; rule: string }> = {
  'woven-roost': { name: 'Woven Roost', rule: 'Carry up to 8 Cover into your next turn. Each Cover gain is reduced by 2.' },
  'storm-pin': { name: 'Storm Pin', rule: 'Gain 1 Wingbeat when entering Molt. Leaving Molt adds a second turn of Open Sky.' },
  'light-travel': { name: 'Light Travel', rule: 'If you begin a turn with at most 4 cards, attacks gain +2 damage for that turn. Draw one fewer card at turn start.' },
};
/** All sources pay the same disclosed Cover cost, after their normal modifiers. */
export function flywayCoverGain(state: Pick<FlywayState, 'relic' | 'condition'>, amount: number) {
  return Math.max(0, amount - (state.relic === 'woven-roost' ? 2 : 0) - (state.condition === 'rain' ? 1 : 0));
}
export const leaderCalls: Record<string, { name: string; goal: number; charge: string; effect: string }> = {
  fledgling: { name: 'Neighborhood Rally', goal: 3, charge: 'Play three different suits.', effect: 'Gain 2 Wingbeats and 3 Cover.' },
  spark_caller: { name: 'Chorus Break', goal: 3, charge: 'Spend a total of 3 Resonance.', effect: 'Gain 2 Wingbeats and draw 1 card.' },
  talon: { name: 'Decisive Dive', goal: 3, charge: 'Hit a Winded enemy three times.', effect: 'Deal 8 damage to the selected enemy, bypassing Cover.' },
  tidewarden: { name: 'Sheltering Sweep', goal: 6, charge: 'Restore 6 actual Cohesion.', effect: 'Restore 6 Cohesion and gain 4 Cover.' },
  roostkeeper: { name: 'Return the Pressure', goal: 2, charge: 'Fully block two damaging attacks.', effect: 'Deal 4 damage to every enemy and gain 4 Cover.' },
};
export interface CallEffect { energy?: number; draw?: number; heal?: number; cover?: number; damage?: number; pierce?: boolean; all?: boolean; winded?: number }
const baseCallEffects: Record<string, CallEffect> = {
  fledgling: {energy:2,cover:3}, spark_caller:{energy:2,draw:1}, talon:{damage:8,pierce:true},
  tidewarden:{heal:6,cover:4}, roostkeeper:{damage:4,all:true,cover:4},
};
export const callSpecializations: Record<string, Array<{style:'shelter'|'flight';name:string;effect:string;tradeoff:string;rules:CallEffect}>> = {
  fledgling: [
    {style:'shelter',name:'Gather the Neighbors',effect:'Gain 1 Wingbeat and 7 Cover.',tradeoff:'Give up one Wingbeat for stronger protection.',rules:{energy:1,cover:7}},
    {style:'flight',name:'Lead the Crossing',effect:'Gain 3 Wingbeats.',tradeoff:'Give up all Call Cover for an extra Wingbeat.',rules:{energy:3}},
  ],
  spark_caller: [
    {style:'shelter',name:'Echo Relay',effect:'Gain 1 Wingbeat and draw 2 cards.',tradeoff:'One fewer Wingbeat; extra cards still need energy and can expose the flock.',rules:{energy:1,draw:2}},
    {style:'flight',name:'Fast Chorus',effect:'Gain 3 Wingbeats.',tradeoff:'Give up the Call draw for an extra Wingbeat.',rules:{energy:3}},
  ],
  talon: [
    {style:'shelter',name:'Scatter the Watch',effect:'Deal 4 damage to every enemy, then give each survivor 1 Winded.',tradeoff:'Lower focused damage; damage no longer bypasses Cover.',rules:{damage:4,all:true,winded:1}},
    {style:'flight',name:'Clean Execution',effect:'Deal 12 damage to the selected enemy, bypassing Cover.',tradeoff:'Focuses the entire Call on one target; gives no protection or Winded.',rules:{damage:12,pierce:true}},
  ],
  tidewarden: [
    {style:'shelter',name:'Deep Shelter',effect:'Restore 10 Cohesion.',tradeoff:'Give up all Call Cover; healing cannot exceed maximum Cohesion.',rules:{heal:10}},
    {style:'flight',name:'Breakwater Sweep',effect:'Restore 3 Cohesion and gain 9 Cover.',tradeoff:'Less recovery in exchange for immediate protection.',rules:{heal:3,cover:9}},
  ],
  roostkeeper: [
    {style:'shelter',name:'Hold the Roof',effect:'Gain 12 Cover.',tradeoff:'Give up all Call damage for protection.',rules:{cover:12}},
    {style:'flight',name:'Answer Together',effect:'Deal 7 damage to every enemy.',tradeoff:'Give up all Call Cover for a stronger retaliation.',rules:{damage:7,all:true}},
  ],
};
export function resolvedLeaderCall(leader: string, state?: Pick<FlywayState,'callStyle'>) {
  const id = Object.hasOwn(leaderCalls,leader) ? leader : 'fledgling';
  const variant = callSpecializations[id].find(v=>v.style===state?.callStyle);
  return {...leaderCalls[id],...variant,rules:variant?.rules??baseCallEffects[id]};
}
export const rivalChapters = [
  {name:'The First Wager',weakness:'The Watch shields its captain. Remove the Watch or strike during recovery.',line:'“Show me how you bring them across.”',ending:'Caldra remembers the flock that accepted her first wager.'},
  {name:'The Answering Crew',weakness:'The Courier stores force for its captain. Stop future charges; stored force remains until spent.',line:'“I have seen your opening. Now read mine.”',ending:'Caldra changes her formation after the rematch, then leaves the next crossing open.'},
  {name:'The Last Wager',weakness:'Shield and signal birds support the captain. Choose a support target; recovery opens every third move.',line:'“One last crossing. No toll after this.”',ending:'Having yielded three wagers, Caldra calls her crew aside and keeps her promise: the crossing belongs to everyone.'},
] as const;
export function rivalChapter(wins=0) { return rivalChapters[Math.min(2,Math.max(0,Math.floor(wins)))]; }
/** Clone canonical birds; their art/identity stays stable and live/forecast share these loops. */
export function rivalFormation(wins: number, lookup: (id:string)=>RuntimeEnemy): RuntimeEnemy[] {
  const stage=Math.min(2,Math.max(0,Math.floor(wins)));
  const ids=stage===0?['tarline_jackdaw','pigeon_enforcer']:stage===1?['tarline_jackdaw','signal_gull']:['tarline_jackdaw','pigeon_enforcer','signal_gull'];
  return ids.map((id,index)=>{
    const base=structuredClone(lookup(id));
    const captain=index===0, shield=id==='pigeon_enforcer';
    base.name=captain?'Captain':shield?'Watch':'Courier';
    base.health=captain?[26,30,34][stage]:[20,20,18][stage];
    base.lesson=rivalChapter(wins).weakness;
    base.moves=captain?[
      {id:'pinion-strike',label:'Crossing Strike',effects:[`damage(flock, ${[8,10,12][stage]})`]},
      {id:'pinion-brace',label:'Regroup',effects:['gainCover(self, 6)']},
      {id:'pinion-rest',label:'Recover footing',effects:[]},
    ]:[
      {id:'pinion-support',label:shield?'Shield the Captain':'Signal the Captain',effects:[shield?'gainCoverAlly(front, 6)':'nextAttackBonusAlly(front, 3)']},
      {id:'pinion-strike',label:'Crossing Peck',effects:['damage(flock, 4)']},
      {id:'pinion-rest',label:'Recover footing',effects:[]},
    ];
    base.attackPattern={type:'cycle',moveIds:base.moves.map(m=>m.id)};
    return base;
  });
}
export const combinations = [
  { id: 'brace-cut', name: 'Brace & Cut', first: 'nests', second: 'quills', rule: 'Nests → Quills: deal 2 extra damage to the selected enemy.', effect: 'damage' },
  { id: 'rain-chorus', name: 'Rain Chorus', first: 'basins', second: 'plumes', rule: 'Basins → Plumes: gain 1 Resonance.', effect: 'resonance' },
  { id: 'safe-landing', name: 'Safe Landing', first: 'quills', second: 'basins', rule: 'Quills → Basins: gain 3 Cover.', effect: 'cover' },
] as const;
export const flightStories: Array<{ id: FlightStoryId; title: string; premise: string; rule: string; reward: string; seed: string; leader: string; relic?: FlywayRelic }> = [
  { id: 'open-sky', title: 'After the Storm', premise: 'Carry a warning through the storm, then bring your flock safely home.', rule: 'Win a Full flight after surviving at least 3 Molt enemy phases.', reward: 'Storm Survivor · copper feather journal seal', seed: 'story-after-storm-v1', leader: 'tidewarden', relic: 'storm-pin' },
  { id: 'small-flock', title: 'Ten Familiar Wings', premise: 'A small crew knows every rooftop by heart.', rule: 'Win a Full flight with at most 10 cards. Adding a card is allowed, but you must release enough before the ending.', reward: 'Close Company · woven circle journal seal', seed: 'story-ten-wings-v1', leader: 'fledgling', relic: 'light-travel' },
  { id: 'unbroken', title: 'The Quiet Crossing', premise: 'Guide the city through a route that leaves no bird behind.', rule: 'Win a Full flight with at least 3 fights taking no Cohesion damage.', reward: 'Still Air · blue wing journal seal', seed: 'story-quiet-crossing-v1', leader: 'roostkeeper', relic: 'woven-roost' },
  { id: 'chorus-line', title: 'Every Roof Answers', premise: 'Spark-Caller carries a warning that grows with every answering roof.', rule: 'Win a Full flight after spending at least 12 Resonance and using at least 3 Leader calls.', reward: 'Answering Chorus · amber wave journal seal', seed: 'story-chorus-line-v1', leader: 'spark_caller' },
  { id: 'clean-cut', title: 'A Path Through the Watch', premise: 'Talon finds a way through the watch so the smaller wings can follow.', rule: 'Win a Full flight after hitting Winded enemies with cards at least 12 times and using at least 3 Leader calls.', reward: 'Clear Passage · silver quill journal seal', seed: 'story-clean-cut-v1', leader: 'talon' },
];
export function newFlywayState(story?: FlightStoryId): FlywayState {
  const authored = flightStories.find(entry => entry.id === story);
  return { version: 1, restored: [], residents: { sella: 0, ivo: 0, oren: 0 }, visits: [], rivalWins: 0, rivalNodes: [], settledNodes: [], condition: 'clear',
    relic: authored?.relic, relicChosen: Boolean(authored?.relic), story: authored?.id, storyComplete: false,
    medals: [], journal: [], combinations: 0, leaderCalls: 0, survivedMolt: 0, cleanFights: 0 };
}
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100000, Math.floor(n))) : 0;
const strings = (a: unknown, max = 128): string[] => Array.isArray(a) ? a.filter((v): v is string => typeof v === 'string').slice(-max).map(v => v.slice(0, 300)) : [];
export function normalizeFlyway(value: unknown): FlywayState {
  const s = newFlywayState();
  if (!value || typeof value !== 'object') return s;
  const v = value as Record<string, unknown>;
  s.restored = Array.isArray(v.restored) ? [...new Set(v.restored.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 4))] : [];
  s.visits = strings(v.visits); s.rivalNodes = strings(v.rivalNodes); s.settledNodes = strings(v.settledNodes); s.journal = strings(v.journal, 48);
  for (const key of ['rivalWins', 'combinations', 'leaderCalls', 'survivedMolt', 'cleanFights'] as const) s[key] = finite(v[key]);
  for (const id of ['sella', 'ivo', 'oren']) {
    const residents = v.residents as Record<string, unknown> | undefined;
    s.residents[id] = Math.min(8, finite(residents?.[id]));
  }
  if (typeof v.condition === 'string' && Object.hasOwn(conditions, v.condition)) s.condition = v.condition as FlywayCondition;
  if (typeof v.conditionNode === 'string') s.conditionNode = v.conditionNode.slice(0, 100);
  if (typeof v.relic === 'string' && Object.hasOwn(relics, v.relic)) s.relic = v.relic as FlywayRelic;
  s.relicChosen = v.relicChosen === true || Boolean(s.relic);
  s.story = flightStories.find(entry => entry.id === v.story)?.id;
  s.storyComplete = v.storyComplete === true;
  s.medals = [...new Set(strings(v.medals, 5).filter(id => flightStories.some(story => story.id === id)))];
  if (v.callStyle === 'shelter' || v.callStyle === 'flight') s.callStyle = v.callStyle;
  for (const key of ['resonanceSpent','windedHits'] as const) if (v[key] !== undefined) s[key]=finite(v[key]);
  if (v.rooftopPlan === 'shelter' || v.rooftopPlan === 'tempo' || v.rooftopPlan === 'molt') s.rooftopPlan = v.rooftopPlan;
  if (v.coachingOff === true) s.coachingOff = true;
  const ferry = v.canalFerry && typeof v.canalFerry === 'object' ? v.canalFerry as Record<string, unknown> : undefined;
  if (ferry && typeof ferry === 'object' && (ferry.pledge === 'timber' || ferry.pledge === 'lamps')) {
    s.canalFerry = { pledge: ferry.pledge, startedAt: Math.floor(finite(ferry.startedAt)) };
    if (ferry.rewarded === true) s.canalFerry.rewarded = true;
  }
  const relay = v.spireRelay && typeof v.spireRelay === 'object' ? v.spireRelay as Record<string, unknown> : undefined;
  if (relay && (relay.pledge === 'wires' || relay.pledge === 'lenses')) {
    s.spireRelay = { pledge: relay.pledge, startedAt: finite(relay.startedAt) };
    if (relay.rewarded === true) {
      s.spireRelay.rewarded = true;
      if (relay.delivered === true) s.spireRelay.delivered = true;
    }
  }
  if (Array.isArray(v.cityAid)) s.cityAid = [...new Set(strings(v.cityAid, 3).filter((id): id is 'sella' | 'oren' | 'ivo' => ['sella','oren','ivo'].includes(id)))];
  return s;
}
export function journal(s: FlywayState, text: string) { s.journal = [...s.journal, text].slice(-48); }
export function restoreDistrict(s: FlywayState, index: number) {
  if (!districts[index] || s.restored.includes(index)) return false;
  s.restored.push(index); journal(s, districts[index].restored); return true;
}
export function finishStory(s: FlywayState, won: boolean, deckSize: number) {
  const complete = won && (s.story === 'open-sky' ? s.survivedMolt >= 3 : s.story === 'small-flock' ? deckSize <= 10 : s.story === 'unbroken' ? s.cleanFights >= 3 : s.story === 'chorus-line' ? (s.resonanceSpent??0)>=12&&s.leaderCalls>=3 : s.story === 'clean-cut' ? (s.windedHits??0)>=12&&s.leaderCalls>=3 : false);
  if (complete && s.story && !s.storyComplete) { s.storyComplete = true; s.medals.push(s.story); journal(s, `Flight Story complete: ${flightStories.find(story => story.id === s.story)!.title}.`); }
  return complete;
}
export interface FlightCombatState {
  lightTravelReady?: boolean;
  charge: number; called: boolean; suits: CardSuit[]; previousSuit?: CardSuit;
  combos: string[]; bossBreaks: string[]; molted: boolean; moltSurvived: boolean;
  completed: boolean;
}
export function newFlightCombat(): FlightCombatState { return { charge: 0, called: false, suits: [], combos: [], bossBreaks: [], molted: false, moltSurvived: false, completed: false }; }
export function chargeCall(combat: FlightCombatState, leader: string, kind: 'suit' | 'spend' | 'winded' | 'heal' | 'block', amount = 1, suit?: CardSuit) {
  if (combat.called) return;
  if (kind === 'suit' && suit && !combat.suits.includes(suit)) combat.suits.push(suit);
  if (leader === 'fledgling') combat.charge = combat.suits.length;
  else if ((leader === 'spark_caller' && kind === 'spend') || (leader === 'talon' && kind === 'winded') || (leader === 'tidewarden' && kind === 'heal') || (leader === 'roostkeeper' && kind === 'block')) combat.charge += Math.max(0, amount);
  combat.charge = Math.min(combat.charge, (leaderCalls[leader] ?? leaderCalls.fledgling).goal);
}
export function takeCall(combat: FlightCombatState, leader: string) {
  if (combat.called || combat.charge < (leaderCalls[leader] ?? leaderCalls.fledgling).goal) return false;
  combat.called = true; return true;
}
export function playCombination(combat: FlightCombatState, suit?: CardSuit | null) {
  const combo = combinations.find(c => c.first === combat.previousSuit && c.second === suit && !combat.combos.includes(c.id));
  combat.previousSuit = suit ?? undefined;
  if (combo) combat.combos.push(combo.id);
  return combo;
}
export const branchCards = ['major_00', 'wands_ace', 'swords_ace', 'cups_ace', 'pentacles_04', 'aviary_25'];
/** Canal alternatives replace active upgrade rules; canonical passive stats remain. */
export const canalPreens: Array<{ id: PreenBranch; card: string; name: string; plan: string; tradeoff: string; effects: string[]; moltEffects: string[]; cost?: number }> = [
  { id: 'canal-anchor', card: 'pentacles_04', name: 'Mooring Anchor', plan: 'Hold & Answer', tradeoff: 'More immediate Cover; gives up the normal full-block draw and Guard payoff.', effects: ['gainCover(12)', 'retainHand(1)'], moltEffects: ['damage(target, 10)', 'retainHand(1)'] },
  { id: 'canal-counter', card: 'pentacles_04', name: 'Countercurrent', plan: 'Hold & Answer', tradeoff: 'Less Cover now; retain two cards and earn three next-turn draws only if you fully block the next attack.', effects: ['gainCover(4)', 'retainHand(2)', 'if fullyBlocksNextAttack then nextTurnDraw(3)'], moltEffects: ['damage(target, 12)'] },
  { id: 'canal-chorus', card: 'wands_ace', name: 'Ferry Chorus', plan: 'Chorus Engine', tradeoff: 'Two draws require existing Resonance. Lower damage; drawn cards still cost Wingbeats and count toward Open Sky.', effects: ['if hasResonance then draw(2)', 'damage(target, 2)', 'gainResonance(2)'], moltEffects: ['gainCover(3)', 'draw(2)'] },
  { id: 'canal-cadence', card: 'wands_ace', name: 'Lockstep Cadence', plan: 'Chorus Engine', tradeoff: 'Greater damage with existing Resonance; gives up upgrade draw and generates only one Resonance.', effects: ['if hasResonance then damage(target, 6)', 'damage(target, 3)', 'gainResonance(1)'], moltEffects: ['gainCover(8)'] },
  { id: 'canal-harbor', card: 'aviary_25', name: 'Sheltered Harbor', plan: 'Storm Window', tradeoff: 'Costs one Wingbeat instead of zero to enter Molt with extra Cover and active Open Sky Guard.', cost: 1, effects: ['enterMolt()', 'gainOpenSkyGuard(2)', 'gainCover(4)'], moltEffects: ['gainCover(8)', 'draw(1)'] },
  { id: 'canal-current', card: 'aviary_25', name: 'Running Current', plan: 'Storm Window', tradeoff: 'Draw two on entry but forgo the normal upgrade’s active Guard. Prepare protection before the burst.', effects: ['enterMolt()', 'draw(2)'], moltEffects: ['gainWingbeat(1)', 'draw(1)'] },
];
export function canalFerryProgress(s: FlywayState) {
  const clears = new Set(s.settledNodes.filter(id => id.startsWith('1:'))).size;
  return { clears, ready: !!s.canalFerry && (s.restored.includes(1) || clears >= s.canalFerry.startedAt + 2) };
}
export const spirePreens: typeof canalPreens = [
  { id: 'spire-watch', card: 'pentacles_04', name: 'Patient Watch', plan: 'Hold & Answer', cost: 2,
    tradeoff: 'Pay 2 Wingbeats now to retain two cards and bank 1 Wingbeat for next turn. Gives up the original conditional draw and Guard.',
    effects: ['gainCover(8)', 'retainHand(2)', 'gainEnergyNextTurn(1)'], moltEffects: ['damage(target, 10)', 'gainEnergyNextTurn(1)'] },
  { id: 'spire-chorus', card: 'wands_ace', name: 'Relay Chorus', plan: 'Chorus Engine',
    tradeoff: 'Play a Basin first to recover 1 Wingbeat. In Molt, play a Quill first for two draws. Lower immediate damage; sequencing matters.',
    effects: ['if playedSuitThisTurn(basins) then gainWingbeat(1)', 'damage(target, 3)', 'gainResonance(1)'],
    moltEffects: ['if playedSuitThisTurn(quills) then draw(2)', 'gainCover(4)'] },
  { id: 'spire-aperture', card: 'aviary_25', name: 'Storm Aperture', plan: 'Storm Window', cost: 1,
    tradeoff: 'Requires 1 Wingbeat before refunding 1 on Molt entry. Adds Open Sky and grants no active Guard. Its Molt strike costs 4 Cover.',
    effects: ['enterMolt()', 'gainWingbeat(1)', 'applyOpenSky(1)'], moltEffects: ['damage(target, 12)', 'loseCover(4)'] },
];
export function spireRelayProgress(s: FlywayState) {
  const clears = new Set(s.settledNodes.filter(id => id.startsWith('2:'))).size;
  return { clears, ready: !!s.spireRelay && (s.restored.includes(2) || clears >= s.spireRelay.startedAt + 2) };
}
export function validBranch(id: string, value: unknown): PreenBranch | undefined {
  const canal = [...canalPreens, ...spirePreens].find(branch => branch.card === id && branch.id === value);
  if (canal) return canal.id;
  return branchCards.includes(id) && (value === 'shelter' || value === 'flight') ? value : undefined;
}
export function branchUpgrade(card: RuntimeCard, branch?: PreenBranch): RuntimeCardUpgrade {
  const base = card.upgrade;
  const canal = [...canalPreens, ...spirePreens].find(entry => entry.card === card.id && entry.id === branch);
  if (canal) return { ...base, cost: canal.cost ?? base.cost, effects: [...canal.effects], moltEffects: [...canal.moltEffects] };
  if (!branch || !branchCards.includes(card.id)) return base;
  const extra = branch === 'shelter' ? 'gainCover(2)' : 'draw(1)';
  return { ...base, effects: [...base.effects, extra], moltEffects: [...(base.moltEffects ?? card.moltEffects ?? base.effects), extra] };
}
export function bossDisruption(enemy: { runtime: { type: string }; weak: number; hitThisTurn: boolean; block: number }, map: number) {
  if (enemy.runtime.type !== 'boss') return undefined;
  const index = ((map % 4) + 4) % 4;
  return [
    { rule: 'Make the boss Winded to cancel its next attack this fight.', met: enemy.weak > 0 },
    { rule: 'Hit the boss and strip all its Cover to cancel its next attack this fight.', met: enemy.hitThisTurn && enemy.block === 0 },
    { rule: 'Apply at least 2 Winded to cancel its next attack this fight.', met: enemy.weak >= 2 },
    { rule: 'Hit the Winded boss to cancel its next attack this fight.', met: enemy.hitThisTurn && enemy.weak > 0 },
  ][index];
}
