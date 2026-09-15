// Compact identity, not another simulation: only unconditional numeric rules
// get exact support values. Full authored conditions remain in the tooltip.
export function enemyIntentLabel(effects: string[], incomingDamage: number) {
  const direct = (name: string) => effects.reduce((total, effect) => {
    const match = new RegExp(`^${name}\\((\\d+)\\)$`).exec(effect);
    return total + (match ? Number(match[1]) : 0);
  }, 0);
  const extra = (name: string) => effects.some(effect => !effect.startsWith(`${name}(`));
  if (incomingDamage > 0) return {
    label: `Attack ${incomingDamage}${effects.some(effect => !/^(?:if .+ then )?damage\(/.test(effect)) ? ' + !' : ''}`,
    kind: 'attack' as const,
  };
  for (const [rule, label, kind] of [
    ['gainCover', 'Cover ', 'cover'], ['nextAttackBonus', 'Charge +', 'charge'], ['heal', 'Heal ', 'support'],
  ] as const) {
    const amount = direct(rule);
    if (amount > 0) return { label: `${label}${amount}${extra(rule) ? ' +' : ''}`, kind };
  }
  if (effects.some(effect => /heal|gainCover|nextAttackBonusAlly/.test(effect))) return { label: 'Support', kind: 'support' as const };
  if (effects.some(effect => /nextAttackBonus/.test(effect))) return { label: 'Prepare', kind: 'charge' as const };
  return { label: 'Pressure', kind: 'pressure' as const };
}
