import { combinations, type RooftopPlan } from './flyway-rules';
import { totalContributions, contributionResults, type CardContribution } from './card-contributions';
import type { RuntimeCard } from './types';

type Bird = { id: string; name: string; upgraded?: boolean; runtime: RuntimeCard };
export const buildRecipes: Record<RooftopPlan, { sequences: string[]; weakness: string; marks: string[] }> = {
  shelter: {
    sequences: ['Locked Nest → Patient Answer: block, retain, then bank your next Wingbeat.', 'A Quill → Shelter Song: earn Safe Landing, add Cover, and retain a strike for the next beat.'],
    weakness: 'Low immediate damage. Cover expires unless an effect carries it; support birds can outgrow a slow opening.',
    marks: ['workshop_stamp', 'nest_measure_line', 'quill_notch'],
  },
  tempo: {
    sequences: ['Answering Basin → Plume Flash: prepare Resonance and earn Rain Chorus.', 'Answering Basin → Returning Call: draw from prepared Resonance; save Wingbeats for the drawn cards.'],
    weakness: 'Draw is not energy. A fourth card causes Open Sky, and empty Resonance makes conditional draws fail.',
    marks: ['stage_pin', 'plumes_busker_patch', 'spark_ground_clip'],
  },
  molt: {
    sequences: ['Storm Shelter → Hot Feathers: prepare Cover and Guard before transforming your hand.', 'Hot Feathers → Homeward Wing: protect the exposed Roost and bank a Wingbeat for recovery.'],
    weakness: 'Molt ends at Roost. A burst without protection can lose Cohesion in the exposed enemy phase.',
    marks: ['shed_feather_case', 'fresh_pinfeather', 'eave_bloom'],
  },
};
const active = (c: Bird) => (c.upgraded ? c.runtime.upgrade.effects : c.runtime.effects).join(' ');

/** Describes exact owned rules and suit sequences, never predicts a win rate. */
export function candidateBuildReading(card: Bird, deck: Bird[], combats: Array<{ cardContributions?: CardContribution[] }>) {
  const own = deck.filter(c => c.id !== card.id), text = active(card);
  const pairs = combinations.flatMap(combo => {
    const first = combo.first === card.runtime.suit, second = combo.second === card.runtime.suit;
    const partners = own.filter(c => c.runtime.suit === (first ? combo.second : second ? combo.first : undefined));
    return partners.length ? [`${combo.name}: ${first ? card.name : partners.map(c => c.name).slice(0, 3).join(' / ')} → ${first ? partners.map(c => c.name).slice(0, 3).join(' / ') : card.name}. ${combo.rule}`] : [];
  });
  const sources = own.filter(c => /gainResonance\(/.test(active(c)));
  const uses = own.filter(c => /hasResonance|spendResonance/.test(active(c)));
  if (/hasResonance|spendResonance/.test(text)) pairs.push(sources.length
    ? `Resonance setup in this flock: ${sources.map(c => c.name).slice(0, 3).join(', ')}. Play setup before the conditional payoff.`
    : 'No other owned card generates Resonance in its normal rules. Prepare another source before relying on this condition.');
  if (/gainResonance\(/.test(text) && uses.length) pairs.push(`Prepares Resonance for ${uses.map(c => c.name).slice(0, 3).join(', ')}.`);
  if (/enterMolt\(/.test(text)) {
    const guards = own.filter(c => /gainOpenSkyGuard|gainCover/.test(active(c)));
    pairs.push(guards.length ? `Prepare protection with ${guards.map(c => c.name).slice(0, 3).join(', ')} before Molt. Inspect their alternate rules.` : 'No other owned normal card provides Cover or active Guard. Prepare protection before Molt.');
  }
  const record = totalContributions(combats).find(c => c.cardId === card.id);
  const observed = record ? `${card.name}: ${record.plays} plays; ${contributionResults(record).join(' · ') || 'no tracked numeric effects'}. Includes triggered effects; Cover gained is not damage prevented.`
    : `${card.name}: no recorded plays this flight. This is not evidence that it is weak.`;
  return { potential: (pairs.join('\n\n') || 'No named suit sequence or Resonance pairing with the other owned cards.') + '\n\nPotential only: order, Wingbeats, once-per-turn limits and the actual hand still matter. Uses this copy’s current normal rules.', observed };
}
