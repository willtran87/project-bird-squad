/** Shared by hover help, the Codex, and explicit combat reading views. */
import type { BattleHandCardPreviewView } from './battle/render-hand';
export interface KeywordDef { color: string; def: string }
export const KEYWORDS: Record<string, KeywordDef> = {
  Cover: { color: '#7ab8d6', def: 'Temporary shielding. Absorbs incoming attack damage. Flock Cover resets at the start of your next turn; the Nests keystone carries a capped amount over.' },
  Cohesion: { color: '#8fd6a0', def: "The flock's health. If Cohesion reaches 0, the run ends. Healing restores it up to the current maximum." },
  Resonance: { color: '#c39bff', def: 'A banked combo resource. Gain it from cards, stats, or items, then spend it on Resonance payoffs.' },
  'Resonance Burst': { color: '#8df4ff', def: 'Spends all banked Resonance. The card multiplies the amount spent into damage, before combat modifiers.' },
  Winded: { color: '#c98bff', def: 'Weakens the affected enemy or flock: attack damage is multiplied by 75%, rounded down, before later modifiers. More stacks extend its duration, not the reduction. Stacks decrease by 1 at the start of your turn and also fuel Winded payoffs.' },
  Fouled: { color: '#8bd2a0', def: 'A lingering harmful status. It damages Cohesion at the start of your turn, then decreases by 1.' },
  'Winded Burst': { color: '#c98bff', def: "Converts the target enemy's Winded stacks into damage using the card's multiplier, then consumes those stacks." },
  Molt: { color: '#ff9d4d', def: 'A whole-turn transform stance. Non-Molt cards cost 1 less, cards use alternate abilities, and the first positive damage, Cover, or recovery gains Molt Power. Roost leaves Open Sky.' },
  'Open Sky': { color: '#ffe1a3', def: 'An exposed state that increases incoming attack damage. It counts down after the enemy phase. Open Sky Guard prevents the exposure bonus for individual hits, not their base damage.' },
  'Open Sky Guard': { color: '#cfe3a3', def: 'While exposed, each incoming hit consumes 1 Guard to prevent its Open Sky damage bonus. Base damage still applies. A multi-hit attack can consume several charges.' },
  Flow: { color: '#67d4e6', def: 'Momentum built by playing cards. Full Flow creates Surge; taking unblocked damage resets Flow.' },
  Surge: { color: '#8df4ff', def: 'Full Flow. The flock gains +1 damage and +1 Cover until an unblocked hit breaks Flow.' },
  Scatter: { color: '#ff7a6e', def: 'Below 34% Cohesion, damage and Cover fall to 75% unless the flock has full Flow. Heal enough to Regroup.' },
  Hold: { color: '#9fd0e0', def: 'The steady mid formation - neither broken nor surging.' },
  Wingbeat: { color: '#ffd97a', def: 'The energy spent to play cards. Gain Wingbeat adds energy immediately, unless the effect explicitly says next turn. At the start of your turn, energy resets to 3 plus next-turn bonuses.' },
  Regen: { color: '#8fd6a0', def: 'Restores a set amount of Cohesion at the start of each of your turns.' },
  Energy: { color: '#ffd54a', def: 'The card-playing resource, also called Wingbeat. It resets to 3 plus next-turn bonuses at the start of your turn.' },
  Draw: { color: '#bcd2e6', def: 'Pull cards from your draw pile into your hand. An empty draw pile reshuffles the discard.' },
  Discard: { color: '#b6a0c8', def: 'Send cards from your hand to the discard pile.' },
  Retain: { color: '#8fd6a0', def: 'Keep cards in hand through Roost. The selected card is kept first; remaining slots keep the rightmost unplayed cards.' },
  Keystone: { color: '#ffd97a', def: 'A suit aura unlocked by 5 or more cards of one suit in your whole deck, not just your hand. Grants a passive bonus in combat.' },
};
const KEYWORD_LIST = Object.keys(KEYWORDS).sort((a, b) => b.length - a.length);

/** Longest phrases win; punctuation and resource plurals retain their written form. */
export function buildKeywordTokens(text: string): Array<{ text: string; kw?: string }> {
  const words = text.split(/\s+/).filter(Boolean);
  const tokens: Array<{ text: string; kw?: string }> = [];
  for (let i = 0; i < words.length;) {
    let matched = false;
    for (let n = Math.min(3, words.length - i); n >= 1 && !matched; n--) {
      const raw = words.slice(i, i + n).join(' ');
      const stripped = raw.replace(/[.,;:!?\])]+$/, '').replace(/^[\[(]+/, '').toLowerCase();
      const canonical = KEYWORD_LIST.find(k => k.toLowerCase() === stripped
        || (k === 'Wingbeat' && stripped === 'wingbeats') || (k === 'Keystone' && stripped === 'keystones'));
      if (canonical) { tokens.push({ text: raw, kw: canonical }); i += n; matched = true; }
    }
    if (!matched) { tokens.push({ text: words[i] }); i++; }
  }
  return tokens;
}

/** Only terms in this card's rules, cost and stats; no recursive glossary expansion. */
export function cardKeywordSections(text: string): Array<{ heading: string; body: string }> {
  const terms = new Set(buildKeywordTokens(text).flatMap(token => token.kw ? [token.kw] : []));
  return [...terms].map(term => ({ heading: `TERM · ${term.toUpperCase()}`, body: KEYWORDS[term].def }));
}

export function combatCardKeywordSections(card: BattleHandCardPreviewView) {
  return cardKeywordSections(`${card.currentText}\n${card.alternateText ?? ''}\n${card.stats ?? ''}\nWingbeat${card.usesMolt || card.alternateLabel?.includes('MOLT') ? ' Molt' : ''}`);
}

/** Decision readers explain only displayed rules and costs, never names or advice. */
export function decisionCardKeywordSections(sections: Array<{ title: string; text: string }>) {
  const rules = sections.filter(section => /^(NOW|BASE|PREEN(?:ED)?|MOLT|PASSIVE FLOCK BONUSES)(?:$|[ ·/])/.test(section.title));
  const context = `${rules.map(section => section.text).join('\n')}\nWingbeat${rules.some(section => section.title.includes('MOLT')) ? ' Molt' : ''}`;
  return cardKeywordSections(context).map(section => ({ title: section.heading, text: section.body }));
}
