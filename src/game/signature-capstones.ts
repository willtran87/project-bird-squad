import type { RuntimeRouteMark } from './types';

export const capstones = {
  shelter: { id: 'capstone-answerkeeper', name: 'Answerkeeper Knot', family: 'safety', source: 'boss', rarity: 'boss',
    trigger: 'onLowCardTurn(2)', effects: ['retainHand(2)', 'gainEnergyNextTurn(2)'],
    description: 'Once per fight: Roost after playing 1 or 2 cards to retain 2 cards and bank 2 Wingbeats. Gives no immediate Cover or damage; you must survive the enemy phase.' },
  tempo: { id: 'capstone-answering-bell', name: 'Answering Bell', family: 'suit', source: 'boss', rarity: 'boss',
    trigger: 'onNthCardThisTurn(3)', effects: ['gainResonance(2)', 'draw(2)'],
    description: 'Once per fight: your third card in one turn grants 2 Resonance and draws 2 cards. Gives no Wingbeats; playing a fourth card still risks Open Sky.' },
  molt: { id: 'capstone-storm-anchor', name: 'Storm Anchor', family: 'molt', source: 'boss', rarity: 'boss',
    trigger: 'onEnterMolt', effects: ['gainOpenSkyGuard(2)', 'gainEnergyNextTurn(1)'],
    description: 'Once per fight: enter Molt to gain 2 Open Sky Guard and bank 1 Wingbeat. Gives no Cover or healing; Guard only cancels the Open Sky bonus on two attacks.' },
} satisfies Record<string, RuntimeRouteMark>;
export type Capstone = keyof typeof capstones;
export function capstoneMarks(choice?: Capstone): RuntimeRouteMark[] {
  return choice && Object.hasOwn(capstones, choice) ? [capstones[choice]] : [];
}
