/**
 * Which interface sound a shared button makes. Committing a choice (confirm,
 * select, buy, claim, start...) answers with `ui.confirm`; moving around,
 * reading and backing out keep the soft click. Navigation words win, so
 * "Back to Lab" or "Main Menu" never sound like a purchase.
 */
export type ButtonCue = 'commit' | 'navigate';

const NAVIGATE = /\b(back|close|cancel|clear|menu|resume|return|previous|next|earlier|more|details?|inspect|read|view|open|show|hide|page|tab|leave|later|settings|help|filter|sort|search|recovery)\b/i;
const COMMIT = /\b(confirm|select|choose|buy|claim|start|fly|take|accept|begin|launch|play|continue|equip|preen|release|rest|repair|save|apply|trade|purchase|restore|import|reset|delete|remove|pick|commit|replay|skip|keep|use|track|copy|archive|create)\b/i;

export function buttonCue(label: string, kind?: string): ButtonCue {
  if (NAVIGATE.test(label)) return 'navigate';
  return COMMIT.test(label) || kind === 'primary' ? 'commit' : 'navigate';
}

let depth = 0;
/** Run a committing control's action: its soft `confirm` click is played as `ui.confirm`. */
export function asCommit(run: () => void) {
  depth += 1;
  try { run(); } finally { depth -= 1; }
}
export const committing = () => depth > 0;
