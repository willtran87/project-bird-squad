import { combinations, type FlywayState } from './flyway-rules';

export function flightHighlights(s: FlywayState, cardName: (id: string) => string) {
  const m = s.comboMoment, c = s.cardMoment;
  const combo = combinations.find(c => c.id === m?.id);
  const combination = m && combo ? `${combo.name}, beat ${m.turn}: ${[
    m.damage && `${m.damage} Cohesion damage`, m.cover && `${m.cover} Cover gained`, m.resonance && `${m.resonance} Resonance gained`,
  ].filter(Boolean).join(' · ') || 'no numeric gain'}${m.defeated ? '; the combination defeated its target' : ''}.`
    : `${s.combinations} combinations recorded. No detailed combination moment was saved.`;
  const bird = c ? `${cardName(c.cardId)} was your most-played recorded bird: ${c.plays} plays, ${c.damage} damage and ${c.cover} Cover gained. Includes triggered effects; Cover gained is not damage prevented.`
    : 'No card contribution record is available for this flight.';
  const resident = s.cityAid?.includes('sella') ? 'Your earlier help opened Sella’s High Roost shelter, and you used the rest stop.'
    : s.cityAid?.includes('oren') ? 'Your ferry repair opened Oren’s supply crossing, and you claimed its Guard.'
    : s.cityAid?.includes('ivo') ? 'Your relay repair carried Ivo’s final warning, and you listened before the summit.'
    : s.canalFerry?.rewarded ? `You completed Oren’s ${s.canalFerry.pledge} ferry repair.`
    : s.spireRelay?.rewarded ? `You completed Ivo’s ${s.spireRelay.pledge} relay repair.`
    : s.visits.length ? 'You visited the city’s residents; no completed ferry, relay or summit favor was recorded.'
    : 'No resident visits were recorded on this flight.';
  const next = !s.canalFerry?.rewarded ? 'Next flight: pledge materials to Oren in Canal Markets and clear two further crossings to finish the ferry.'
    : !s.spireRelay?.rewarded ? 'Next flight: reconnect Ivo’s relay in Signal Spires and deliver its warning to High Roost.'
    : s.rooftopPlan !== 'tempo' ? 'Next flight: follow Chorus Engine; try Answering Basin before Plume Flash and keep Wingbeats for the draw.'
    : 'Next flight: follow Hold & Answer; retain Patient Answer behind Locked Nest and strike on recovery.';
  return [combination, bird, resident, next];
}
