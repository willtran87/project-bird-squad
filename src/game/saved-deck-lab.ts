import { prepareOpeningDraw } from './deterministic-draw';
import { BASE_HAND_TARGET, flockHandTarget } from './hand-size';
import type { SavedDeckRecord } from './saved-decks';
import type { RuntimeCard } from './types';

const LAB_SAMPLE_COUNT = 16;
const LAB_ENERGY = 3;

export interface SavedDeckLabCard {
  id: string;
  name: string;
  cost: number;
  upgraded: boolean;
  family: string;
  role: 'Pressure' | 'Guard' | 'Engine' | 'Utility' | 'Snag';
  playable: boolean;
  pressure: boolean;
  runtime: { kind: string };
  target: string;
}

export interface SavedDeckLabAnalysis {
  savedCopies: number;
  playableCards: number;
  duplicateCopies: number;
  unavailableCopies: number;
  preenedCards: number;
  legalForStandardFlight: boolean;
  issues: string[];
  averageCost: number;
  costCurve: Array<{ label: string; count: number }>;
  roles: Array<{ label: string; count: number }>;
  families: Array<{ label: string; count: number }>;
  resourceHooks: Array<{ label: string; count: number }>;
  consistency: {
    sampleCount: number;
    averagePlayable: number;
    atLeastTwoPlayablePercent: number;
    pressureAvailable: boolean;
    pressurePercent: number;
    uniqueHands: number;
    averageProtectionSwaps: number;
  };
  sample: {
    index: number;
    number: number;
    cards: SavedDeckLabCard[];
    playableCount: number;
    pressureCount: number;
    totalCost: number;
    protectionSwaps: number;
    affordableTogether: number;
  };
  rules: {
    handSize: number;
    wingbeats: number;
    baseHandSize: number;
    flockDraw: number;
    keystoneDraw: number;
    leaderId: string;
    scope: string;
    deterministic: true;
    usesCombatOpeningProtection: true;
    exactSavedOrderUnaffected: true;
    affectsPower: false;
    spendsResources: false;
  };
}

export interface SavedDeckLabReplacement {
  id: string;
  name: string;
  cost: number;
  family: string;
  role: SavedDeckLabCard['role'];
  score: number;
  reasons: string[];
}

function cardCost(card: RuntimeCard, upgraded: boolean) {
  return upgraded && card.upgrade.cost !== undefined ? card.upgrade.cost : card.cost;
}

function cardEffects(card: RuntimeCard, upgraded: boolean) {
  return upgraded ? card.upgrade.effects : card.effects;
}

function familyLabel(card: RuntimeCard) {
  if (card.kind === 'snag') return 'Snag';
  if (card.suit === 'plumes') return 'Plumes';
  if (card.suit === 'quills') return 'Quills';
  if (card.suit === 'basins') return 'Basins';
  if (card.suit === 'nests') return 'Nests';
  if (card.id.startsWith('aviary_')) return 'Aviary';
  if (card.kind === 'legend') return 'Legend';
  if (card.kind === 'molt') return 'Molt';
  return 'Unsuited';
}

function familyFromId(id: string) {
  if (id.startsWith('wands_')) return 'Plumes';
  if (id.startsWith('swords_')) return 'Quills';
  if (id.startsWith('cups_')) return 'Basins';
  if (id.startsWith('pentacles_')) return 'Nests';
  if (id.startsWith('aviary_')) return 'Aviary';
  if (id.startsWith('major_')) return 'Legend';
  return undefined;
}

function hasSignal(card: RuntimeCard, upgraded: boolean, signal: string) {
  const body = `${card.tags.join(' ')} ${cardEffects(card, upgraded).join(' ')}`.toLowerCase();
  if (signal === 'pressure') return card.target === 'enemy' || card.target === 'allEnemies' || /\battack\b|\bdamage\(/.test(body);
  if (signal === 'guard') return /\bcover\b|\bgaincover\(|\bopenskyguard\b/.test(body);
  if (signal === 'draw') return /\bdraw\b|\bdraw\(/.test(body);
  if (signal === 'heal') return /\bheal\b|\bheal\(|\boverhealcover\(/.test(body);
  if (signal === 'wingbeat') return /\bwingbeat\b|\bgainwingbeat\(|\bgainenergynextturn\(/.test(body);
  if (signal === 'resonance') return /\bresonance\b|\bgainresonance\(|\bspendresonance\(/.test(body);
  return false;
}

function roleFor(card: RuntimeCard, upgraded: boolean): SavedDeckLabCard['role'] {
  if (card.kind === 'snag') return 'Snag';
  if (hasSignal(card, upgraded, 'pressure')) return 'Pressure';
  if (hasSignal(card, upgraded, 'guard') || hasSignal(card, upgraded, 'heal')) return 'Guard';
  if (
    hasSignal(card, upgraded, 'draw')
    || hasSignal(card, upgraded, 'wingbeat')
    || hasSignal(card, upgraded, 'resonance')
  ) return 'Engine';
  return 'Utility';
}

function countLabels(labels: string[], preferred: string[]) {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...new Set([...preferred, ...labels])]
    .map((label) => ({ label, count: counts.get(label) ?? 0 }))
    .filter((entry) => entry.count > 0);
}

function canonicalLabCards(
  deck: SavedDeckRecord,
  library: ReadonlyMap<string, RuntimeCard>,
) {
  const byId = new Map<string, { runtime: RuntimeCard; upgraded: boolean }>();
  let unavailableCopies = 0;
  deck.cards.forEach((saved) => {
    const runtime = library.get(saved.id);
    if (!runtime) {
      unavailableCopies += 1;
      return;
    }
    const existing = byId.get(saved.id);
    if (!existing) byId.set(saved.id, { runtime, upgraded: saved.upgraded });
    else if (saved.upgraded) existing.upgraded = true;
  });
  const cards = [...byId.values()].map(({ runtime, upgraded }): SavedDeckLabCard => {
    const cost = cardCost(runtime, upgraded);
    const pressure = runtime.kind !== 'snag' && hasSignal(runtime, upgraded, 'pressure');
    return {
      id: runtime.id,
      name: runtime.displayName,
      cost,
      upgraded,
      family: familyLabel(runtime),
      role: roleFor(runtime, upgraded),
      playable: runtime.kind !== 'snag' && cost <= LAB_ENERGY,
      pressure,
      runtime: { kind: runtime.kind },
      target: runtime.target,
    };
  });
  return {
    cards,
    unavailableCopies,
    duplicateCopies: deck.cards.length - unavailableCopies - cards.length,
  };
}

function fingerprint(deck: SavedDeckRecord) {
  return [
    deck.leaderId,
    deck.runMode,
    deck.cards.map((card) => `${card.id}${card.upgraded ? '+' : ''}`).join(','),
  ].join(':');
}

function draw(cards: SavedDeckLabCard[], key: string, handSize: number, shuffled = true) {
  const prepared = prepareOpeningDraw(cards, key, shuffled, handSize, LAB_ENERGY);
  const hand = prepared.deck.slice(0, handSize);
  let remaining = LAB_ENERGY;
  let affordableTogether = 0;
  for (const card of hand.filter((entry) => entry.playable).sort((a, b) => a.cost - b.cost)) {
    if (card.cost > remaining) break;
    remaining -= card.cost;
    affordableTogether += 1;
  }
  return {
    cards: hand,
    playableCount: hand.filter((card) => card.playable).length,
    pressureCount: hand.filter((card) => card.pressure && card.playable).length,
    totalCost: hand.reduce((sum, card) => sum + card.cost, 0),
    protectionSwaps: prepared.state.protectionSwaps,
    affordableTogether,
  };
}

export function analyzeSavedDeck(
  deck: SavedDeckRecord,
  library: ReadonlyMap<string, RuntimeCard>,
  sampleIndex = 0,
): SavedDeckLabAnalysis {
  const canonical = canonicalLabCards(deck, library);
  const cards = canonical.cards;
  const flockDraw = cards.reduce((sum, card) => {
    const runtime = library.get(card.id)!;
    return sum + (runtime.flockStats.draw ?? 0) + (card.upgraded ? runtime.upgrade.flockStats.draw ?? 0 : 0);
  }, 0);
  const plumesKeystone = cards.filter((card) => library.get(card.id)?.suit === 'plumes').length >= 5;
  const handSize = flockHandTarget(flockDraw, plumesKeystone, deck.leaderId);
  const key = fingerprint(deck);
  const index = Math.max(0, Math.min(999, Math.floor(sampleIndex)));
  const sample = draw(cards, `${key}:flight-lab:${index}`, handSize, index !== 0);
  const hands = Array.from({ length: LAB_SAMPLE_COUNT }, (_, handIndex) => (
    draw(cards, `${key}:flight-lab:${handIndex}`, handSize)
  ));
  const pressureAvailable = cards.some((card) => card.pressure && card.playable);
  const issues = [
    canonical.duplicateCopies > 0
      ? `${canonical.duplicateCopies} duplicate ${canonical.duplicateCopies === 1 ? 'copy is' : 'copies are'} retained in the folio but counted once by current singleton combat rules.`
      : '',
    canonical.unavailableCopies > 0
      ? `${canonical.unavailableCopies} unavailable ${canonical.unavailableCopies === 1 ? 'card is' : 'cards are'} preserved in the folio but excluded from practice.`
      : '',
  ].filter(Boolean);
  const costCurve = [
    { label: '0', count: cards.filter((card) => card.cost === 0).length },
    { label: '1', count: cards.filter((card) => card.cost === 1).length },
    { label: '2', count: cards.filter((card) => card.cost === 2).length },
    { label: '3+', count: cards.filter((card) => card.cost >= 3).length },
  ];
  const resourceSignals = ['pressure', 'guard', 'draw', 'heal', 'wingbeat', 'resonance'];
  return {
    savedCopies: deck.cards.length,
    playableCards: cards.length,
    duplicateCopies: canonical.duplicateCopies,
    unavailableCopies: canonical.unavailableCopies,
    preenedCards: cards.filter((card) => card.upgraded).length,
    legalForStandardFlight: issues.length === 0,
    issues,
    averageCost: cards.length > 0
      ? Number((cards.reduce((sum, card) => sum + card.cost, 0) / cards.length).toFixed(2))
      : 0,
    costCurve,
    roles: countLabels(cards.map((card) => card.role), ['Pressure', 'Guard', 'Engine', 'Utility', 'Snag']),
    families: countLabels(
      cards.map((card) => card.family),
      ['Plumes', 'Quills', 'Basins', 'Nests', 'Legend', 'Aviary', 'Molt', 'Snag'],
    ),
    resourceHooks: resourceSignals.map((signal) => ({
      label: signal[0].toUpperCase() + signal.slice(1),
      count: cards.filter((card) => {
        const runtime = library.get(card.id);
        return runtime ? hasSignal(runtime, card.upgraded, signal) : false;
      }).length,
    })).filter((entry) => entry.count > 0),
    consistency: {
      sampleCount: LAB_SAMPLE_COUNT,
      averagePlayable: hands.length > 0
        ? Number((hands.reduce((sum, hand) => sum + hand.playableCount, 0) / hands.length).toFixed(2))
        : 0,
      atLeastTwoPlayablePercent: cards.length > 0 && hands.length > 0
        ? Math.round(hands.filter((hand) => hand.playableCount >= 2).length / hands.length * 100)
        : 0,
      pressureAvailable,
      pressurePercent: pressureAvailable && hands.length > 0
        ? Math.round(hands.filter((hand) => hand.pressureCount > 0).length / hands.length * 100)
        : 0,
      uniqueHands: new Set(hands.map((hand) => hand.cards.map((card) => `${card.id}${card.upgraded ? '+' : ''}`).sort().join('|'))).size,
      averageProtectionSwaps: hands.length > 0
        ? Number((hands.reduce((sum, hand) => sum + hand.protectionSwaps, 0) / hands.length).toFixed(2))
        : 0,
    },
    sample: {
      index,
      number: index + 1,
      ...sample,
    },
    rules: {
      handSize,
      wingbeats: LAB_ENERGY,
      baseHandSize: BASE_HAND_TARGET,
      flockDraw,
      keystoneDraw: plumesKeystone && deck.leaderId !== 'spark_caller' ? 1 : 0,
      leaderId: deck.leaderId,
      scope: 'First hand uses saved order; later samples model shuffled openings. Excludes Waymarks, route bonuses, and effects triggered by playing cards.',
      deterministic: true,
      usesCombatOpeningProtection: true,
      exactSavedOrderUnaffected: true,
      affectsPower: false,
      spendsResources: false,
    },
  };
}

export function suggestSavedDeckReplacements(
  deck: SavedDeckRecord,
  sourceIndex: number,
  ownedCardIds: readonly string[],
  library: ReadonlyMap<string, RuntimeCard>,
  limit = 5,
): SavedDeckLabReplacement[] {
  const source = deck.cards[Math.max(0, Math.min(deck.cards.length - 1, Math.floor(sourceIndex)))];
  if (!source) return [];
  const sourceRuntime = library.get(source.id);
  const sourceRole = sourceRuntime ? roleFor(sourceRuntime, source.upgraded) : undefined;
  const sourceFamily = sourceRuntime ? familyLabel(sourceRuntime) : familyFromId(source.id);
  const sourceCost = sourceRuntime ? cardCost(sourceRuntime, source.upgraded) : undefined;
  const sourceSignals = sourceRuntime
    ? ['pressure', 'guard', 'draw', 'heal', 'wingbeat', 'resonance']
      .filter((signal) => hasSignal(sourceRuntime, source.upgraded, signal))
    : [];
  const remainingIds = new Set(deck.cards.filter((_, index) => index !== sourceIndex).map((card) => card.id));
  const currentRoles = canonicalLabCards(deck, library).cards
    .filter((card) => card.id !== source.id)
    .reduce<Record<SavedDeckLabCard['role'], number>>((counts, card) => {
      counts[card.role] += 1;
      return counts;
    }, { Pressure: 0, Guard: 0, Engine: 0, Utility: 0, Snag: 0 });

  return [...new Set(ownedCardIds)].flatMap((id): SavedDeckLabReplacement[] => {
    const runtime = library.get(id);
    if (!runtime || runtime.kind === 'snag' || remainingIds.has(id) || id === source.id) return [];
    const role = roleFor(runtime, false);
    const family = familyLabel(runtime);
    const cost = cardCost(runtime, false);
    const candidateSignals = ['pressure', 'guard', 'draw', 'heal', 'wingbeat', 'resonance']
      .filter((signal) => hasSignal(runtime, false, signal));
    const reasons: string[] = [];
    let score = 0;
    if (sourceRole && role === sourceRole) {
      score += 50;
      reasons.push(`same ${role.toLowerCase()} role`);
    } else if (!sourceRole) {
      const need = Math.max(0, 4 - currentRoles[role]);
      score += need * 7;
      reasons.push(`${role.toLowerCase()} option`);
    }
    if (sourceFamily && family === sourceFamily) {
      score += 24;
      reasons.push(`keeps ${family}`);
    }
    if (sourceCost !== undefined) {
      const delta = Math.abs(cost - sourceCost);
      score += Math.max(0, 16 - delta * 6);
      if (delta === 0) reasons.push('same cost');
      else if (cost < sourceCost) reasons.push(`${sourceCost - cost} cheaper`);
    } else if (cost <= 1) {
      score += 8;
      reasons.push('opening-hand friendly');
    }
    if (sourceRuntime && runtime.target === sourceRuntime.target) score += 8;
    const sharedSignals = candidateSignals.filter((signal) => sourceSignals.includes(signal));
    score += sharedSignals.length * 5;
    if (sharedSignals.length > 0) reasons.push(`keeps ${sharedSignals.slice(0, 2).join(' + ')}`);
    if (reasons.length === 0) reasons.push(`${family} ${role.toLowerCase()}`);
    return [{
      id,
      name: runtime.displayName,
      cost,
      family,
      role,
      score,
      reasons: reasons.slice(0, 3),
    }];
  }).sort((a, b) => (
    b.score - a.score
    || a.cost - b.cost
    || a.name.localeCompare(b.name)
    || a.id.localeCompare(b.id)
  )).slice(0, Math.max(0, limit));
}
