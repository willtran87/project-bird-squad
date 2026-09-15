export function comparisonPagingHint(mode: string) {
  return mode === 'controller' ? 'LB / RB: pages'
    : mode === 'keyboard' ? 'PgUp / PgDn: pages' : 'Use Previous / Next';
}
