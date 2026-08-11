export interface RetainItem {
  instanceId: string;
}

export const RETAIN_PRIORITY_RULE = 'Selected card first; remaining slots keep the rightmost unplayed cards.';

export function retainPriorityItems<T extends RetainItem>(items: T[], amount: number, priorityId?: string) {
  const count = Math.min(Math.max(0, amount), items.length);
  if (count === 0) return [];
  const retained: T[] = [];
  const priority = priorityId ? items.find((item) => item.instanceId === priorityId) : undefined;
  if (priority) retained.push(priority);
  for (let index = items.length - 1; index >= 0 && retained.length < count; index -= 1) {
    const item = items[index];
    if (!retained.some((candidate) => candidate.instanceId === item.instanceId)) retained.push(item);
  }
  return retained;
}

export function retainedInOriginalOrder<T extends RetainItem>(items: T[], amount: number, priorityId?: string) {
  const ids = new Set(retainPriorityItems(items, amount, priorityId).map((item) => item.instanceId));
  return items.filter((item) => ids.has(item.instanceId));
}

export function roostRetainTriggerMatches(trigger: string, cardsHeld: number, wingbeat: number, cardsPlayed: number, overextensionThreshold: number) {
  const lowCard = /^onLowCardTurn\((\d+)\)$/.exec(trigger);
  return (trigger === 'onRoostWithWingbeat' && wingbeat > 0)
    || (trigger === 'onRoostWithCardsInHand' && cardsHeld > 0)
    || (trigger === 'onTurnEndNoOverextension' && cardsPlayed > 0 && cardsPlayed < overextensionThreshold)
    || Boolean(lowCard && cardsPlayed > 0 && cardsPlayed <= Number(lowCard[1]));
}

export function retainInputHint(count: number, names: string[], roostBinding: string) {
  const summary = names.slice(0, 2).join(' + ') + (names.length > 2 ? ` + ${names.length - 2} MORE` : '');
  return `RETAIN ${count}: ${summary.toUpperCase()}   |   SELECT CARD = KEEP FIRST   |   ${roostBinding}  ROOST`;
}
