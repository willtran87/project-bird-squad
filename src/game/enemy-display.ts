export function enemyStatus(enemy: { block: number; weak: number }): string {
  const statuses: string[] = [];
  if (enemy.block > 0) statuses.push(`${enemy.block} Cover`);
  if (enemy.weak > 0) statuses.push(`${enemy.weak} Winded`);
  return statuses.join(' / ');
}

export function enemyInitials(name: string): string {
  const words = name.split(/\s+/).filter((word) => word.toLowerCase() !== 'the');
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || '?';
}
