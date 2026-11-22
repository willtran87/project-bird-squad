import { describe, expect, it } from 'vitest';
import { asCommit, buttonCue, committing } from './button-cue';

describe('buttonCue', () => {
  it('commits choices, purchases, claims and starts', () => {
    for (const label of ['Confirm', 'Select', 'Select offer', 'Buy · 40 Scrap', 'Claim', 'Start Flight', 'Take this route', 'Fly', 'Skip street', 'Rest at the shelter'])
      expect(buttonCue(label), label).toBe('commit');
  });
  it('keeps navigation, reading and backing out on the soft click', () => {
    for (const label of ['Back', 'Close', 'Cancel', 'Main Menu', 'Back to Lab', 'Read', 'Inspect', 'Details', 'Next', 'Earlier', 'All', 'Plumes', 'Recovery options'])
      expect(buttonCue(label), label).toBe('navigate');
  });
  it('treats an unlabelled primary action as a commitment, but never a navigation word', () => {
    expect(buttonCue('Onward', 'primary')).toBe('commit');
    expect(buttonCue('Back', 'primary')).toBe('navigate');
    expect(buttonCue('Onward', 'secondary')).toBe('navigate');
  });
  it('scopes the commit flag to the action, even when it throws', () => {
    let seen = false;
    asCommit(() => { seen = committing(); });
    expect(seen).toBe(true);
    expect(() => asCommit(() => { throw new Error('x'); })).toThrow();
    expect(committing()).toBe(false);
  });
});
