import { createInitialRunState } from '../main';
import { beginPracticeSession, endPracticeSession, practiceStartingDeck } from './practice-session';
import { memoryStorageSessionActive } from './safe-storage';
import { skipFirstFlightGuide } from './first-flight-guide';

const shelterCards = ['pentacles_04','swords_ace','pentacles_fledgling','major_00','cups_ace','swords_fledgling'];
const tempoCards = ['cups_02','wands_ace','cups_fledgling','swords_ace','pentacles_fledgling','wands_fledgling'];
const moltCards = ['pentacles_04','aviary_25','wands_ace','swords_ace','cups_fledgling','major_00'];

/** Real encounter loops and real cards. No scripted win, bonus energy or
 * progression unlocks. A second attempt can test a different approach. */
export const strategyShowcases = [
  { id: 'shelter', name: 'Hold & Answer', encounter: 'enc_canal_alternating_watch', map: 1,
    cards: shelterCards,
    opportunity: 'The defenders alternate attacks, then both recover. Block and retain a strike for the recovery beat.',
    alternative: 'Or focus one defender to reduce later pressure. Spending everything on Cover can prolong the fight.' },
  { id: 'tempo', name: 'Chorus Engine', encounter: 'enc_canal_open_perch', map: 1,
    cards: tempoCards,
    opportunity: 'The support bird prepares a stronger strike. Basins → Plumes earns Resonance; build a short sequence before it attacks.',
    alternative: 'Or remove the support to stop future aid. Stored force remains; extra draws still cost Wingbeats and a fourth play opens the sky.' },
  { id: 'molt', name: 'Storm Window', encounter: 'enc_spire_quiet_beat', map: 2,
    cards: moltCards,
    opportunity: 'The attacker gathers force, strikes, then rests. Prepare protection before transforming the hand.',
    alternative: 'Or hit during Gather Force to interrupt its stored power. Molt ends at Roost and exposes the flock during the enemy phase.' },
  { id: 'ferry', plan: 'shelter', name: 'Ferry Defender', encounter: 'enc_signature_ferry', map: 1,
    cards: shelterCards,
    opportunity: 'Mastery: protect the flock through three enemy beats to secure the crossing. The crow shields the attacking gull.',
    alternative: 'Replay with the same flock and try defeating both sooner. The two approaches use the same real rules; practice grants no Scrap or unlocks.' },
  { id: 'relay', plan: 'tempo', name: 'Relay Interceptor', encounter: 'enc_signature_relay', map: 2,
    cards: tempoCards,
    opportunity: 'Mastery: defeat the relay crow before its third Tell to win by interception. Read the countdown before committing.',
    alternative: 'Replay and defeat both defenders instead. If the bell rings, stored force remains; prepare Cover. No progression is saved.' },
  { id: 'watch', plan: 'molt', name: 'Rooftop Escape', encounter: 'enc_signature_watch', map: 1,
    cards: moltCards,
    opportunity: 'Mastery: defeat one defender before the third enemy beat, then survive that beat to escape through the gap.',
    alternative: 'Replay and clear both defenders. Molt can help the burst, but its exposed enemy phase still needs protection. No progression is saved.' },
] as const;

export function renderStrategyShowcases(root: HTMLElement, scene: any, close: () => void) {
  if (scene.scene.key !== 'RouteScene' && scene.scene.key !== 'MenuScene') return;
  if (memoryStorageSessionActive()) return;
  const heading = document.createElement('h3'); heading.textContent = 'Try a strategy'; root.append(heading);
  const note = document.createElement('p');
  note.textContent = 'Repeatable challenge fights with a supplied flock. Your saved flight and collection stay unchanged. These are later-district encounters; return to Main Menu to resume your flight.';
  root.append(note);
  for (const showcase of strategyShowcases) {
    const box = document.createElement('section'); box.dataset.strategyShowcase = showcase.id;
    const title = document.createElement('h4'); title.textContent = showcase.name; box.append(title);
    for (const value of [showcase.opportunity, showcase.alternative]) {
      const p = document.createElement('p'); p.textContent = value; box.append(p);
    }
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `Practice ${showcase.name}`;
    button.onclick = async () => {
      button.disabled = true;
      try {
        await window.__birdSquadEnsureScene?.('BattleScene');
        // The Journal intentionally pauses its owning scene while open.
        if (!button.isConnected) return;
        const cards = showcase.cards.map(id => ({ id, upgraded: false }));
        if (!beginPracticeSession(cards)) return;
        skipFirstFlightGuide();
        const runState = createInitialRunState('fledgling', 0, 'full', `strategy-${showcase.id}`, practiceStartingDeck());
        runState.mapIndex = showcase.map; runState.flyway!.rooftopPlan = 'plan' in showcase ? showcase.plan : showcase.id;
        close(); scene.scene.start('BattleScene', { runState, practiceRematch: true, practiceEncounterId: showcase.encounter });
      } catch {
        endPracticeSession(); note.textContent = 'The challenge could not load. Your saved flight is unchanged; try again.';
      } finally { button.disabled = false; }
    };
    box.append(button); root.append(box);
  }
}
