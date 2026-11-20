/** A hand preview is an ordered excerpt, never a reordered/merged rules engine. */
export function readableHandRules(formattedEffects: readonly string[]): string {
  return formattedEffects.map(effect => effect
    .replace(/^If first played:/, 'First use this fight:')
    .replace(/^If played (plumes|basins|quills|nests):/, 'If you played $1 this turn:')
    .replace(/^If Resonance:/, 'If you have Resonance:')
    .replace(/^If spent Resonance:/, 'If this card spent Resonance:')
    .replace(/^If no Resonance:/, 'If no Resonance remains and none was spent:')
    .replace(/^If target attacks:/, 'If the target intends to attack:')
    .replace(/^If target below half:/, 'If the target is at half health or less:')
    .replace(/^If target Winded:/, 'If the target is Winded:')
    .replace(/^If target (\d+)\+ Winded:/, 'If the target has $1+ Winded:')
    .replace(/^If (\d+)\+ Resonance:/, 'If you have $1+ Resonance:')
    .replace(/^If no Cover:/, 'If the flock has no Cover:')
    .replace(/^If low Cohesion:/, 'If the flock is below half Cohesion:')
    .replace(/^If full Cohesion:/, 'If the flock has full Cohesion:')
    .replace(/^If Molting:/, 'While in Molt:')
    .replace(/^If Open Sky:/, 'If the flock is in Open Sky:')
    .replace(/^If flockSuit\(([^,]+),\s*(\d+)\):/, 'If your flock has $2+ $1 cards:')
    .replace(/^If defeats enemy:/, 'If the previous hit defeated an enemy:')
    .replace(/Deal (\d+(?: per [^.,]+)?)(?=[.,])/, 'Deal $1 damage')
    .replace(/Deal (\d+) to all\./, 'Deal $1 damage to all enemies.')
  ).join('\n');
}

/** Lead with the action, but keep its entire condition attached. Each line
 * remains one written effect in engine order; never lift a conditional bonus. */
export function actionFirstHandRules(source: string): string {
  return source.split('\n').map(clause => {
    const match = /^(If [^:]+|First use this fight|While in Molt): (.+)$/.exec(clause);
    if (!match) return clause;
    const condition = match[1].replace(/^If you have /, 'if ').replace(/^If you played /, 'if you played ')
      .replace(/^If the target /, 'if target ').replace(/^If /, 'if ')
      .replace(/^First/, 'first').replace(/^While/, 'while');
    return `${match[2].replace(/\.$/, '')} (${condition}).`;
  }).join('\n');
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Short card-face names for readable conditions: [pattern, suffix, effects
 * that could change the condition mid-card]. Clauses sharing a condition
 * merge only when no earlier clause in the run can change it. */
const FACE_CONDITIONS: Array<[RegExp, string, RegExp?]> = [
  [/^If the flock is in Open Sky$/, 'in Open Sky', /Open Sky for/],
  [/^If the flock has full Cohesion$/, 'at full Cohesion', /Cohesion|Take \d/],
  [/^If the flock is below half Cohesion$/, 'below half Cohesion', /Heal|Cohesion|Take \d/],
  [/^If the flock has no Cover$/, 'with no Cover', /Cover/],
  [/^If you played (\w+)s this turn$/, 'if $C played'],
  [/^If your flock has (\d+\+) (\w+) cards$/, 'if $1 $D in flock'],
  [/^If the target intends to attack$/, 'if target attacks'],
  [/^If the target is at half health or less$/, 'if target ≤ half HP', /Deal|damage/],
  [/^If the target is Winded$/, 'if target Winded', /Winded/],
  [/^If the target has (\d+\+) Winded$/, 'if target has $1 Winded', /Winded/],
  [/^If target has Cover$/, 'if target has Cover', /Cover|Deal/],
  [/^If the previous hit defeated an enemy$/, 'on a defeat'],
  [/^If this card spent Resonance$/, 'if Resonance spent'],
  [/^If no Resonance remains and none was spent$/, 'if no Resonance', /Resonance/],
  [/^If you have (\d+\+ )?Resonance$/, 'if $1Resonance', /Resonance/],
  [/^If fully blocks next attack$/, 'if next hit fully blocked'],
  [/^First use this fight$/, '(first use)'],
  [/^While in Molt$/, 'in Molt', /Molt/],
];

function faceCondition(condition: string) {
  for (const [pattern, template, mutators] of FACE_CONDITIONS) {
    const match = pattern.exec(condition);
    if (!match) continue;
    const suffix = template.replace('$C', cap(match[1] ?? '')).replace('$D', cap(match[2] ?? '')).replace('$1', match[1] ?? '');
    return { prefix: cap(suffix.replace(/[()]/g, '')), suffix, mutators };
  }
  const suffix = condition.replace(/^If /, 'if ');
  return { prefix: cap(suffix), suffix, mutators: /./ as RegExp | undefined };
}

function faceAction(action: string) {
  return action
    .replace(/^Return a card from discard, then draw 1\./, 'Return 1 from discard; draw 1.')
    .replace(/^Return this to the draw pile after play\./, 'Return this to draw pile.')
    .replace(/^Spend all Resonance: deal (\d+) damage per point\./, 'Spend all Resonance: $1 damage each.')
    .replace(/^Consume the target's Winded: deal (\d+) damage per stack\./, 'Consume Winded: $1 damage each.')
    .replace(/^Gain (\d+) per card discarded Cover\./, 'Gain $1 Cover per discard.')
    .replace(/^Heal (\d+) per card discarded\./, 'Heal $1 per discard.')
    .replace(/^Deal (\d+) per Winded damage/, 'Deal $1 damage per Winded')
    .replace(/ damage to all enemies/, ' damage to all');
}

/** A tighter card-face dialect of the readable rules. Every clause, number and
 * condition survives in engine order; connective words are trimmed and a run
 * of clauses under one unchanging condition shares a single heading. Full
 * inspection keeps the long-form wording. */
export function compactHandRules(readable: string): string {
  const clauses = readable.split('\n').filter(Boolean).map(clause => {
    const match = /^(If [^:]+|First use this fight|While in Molt): (.+)$/.exec(clause);
    return match
      ? { condition: match[1], action: faceAction(match[2]) }
      : { condition: '', action: faceAction(clause) };
  });
  const lines: string[] = [];
  for (let index = 0; index < clauses.length;) {
    const { condition, action } = clauses[index];
    if (!condition) { lines.push(action); index++; continue; }
    const face = faceCondition(condition);
    const run = [action];
    while (clauses[index + run.length]?.condition === condition
      && !face.mutators?.test(run[run.length - 1])) {
      run.push(clauses[index + run.length].action);
    }
    index += run.length;
    if (run.length > 1) {
      const body = run.map((entry, at) => (at ? entry[0].toLowerCase() + entry.slice(1) : entry).replace(/\.$/, ''));
      lines.push(`${face.prefix}: ${body.join('; ')}.`);
    } else if (/[,:;]/.test(action)) {
      lines.push(`${face.prefix}: ${action}`);
    } else {
      lines.push(`${action.replace(/\.$/, '')} ${face.suffix}.`);
    }
  }
  return lines.join('\n');
}

/** Effects that resolve after this turn (next turn, after the next enemy
 * attack). When a face truly cannot hold every clause, only these may yield. */
export function isDeferredHandRule(clause: string) {
  return /\bnext turn\b|next hit fully blocked|fully blocks next attack|draw pile/i.test(clause);
}

/** Keep complete effect clauses when possible. Never show an effect without its predicate. */
export function fitHandRules(source: string, fits: (text: string) => boolean, maxClauses = Infinity) {
  const clauses = source.split('\n').filter(Boolean);
  if (clauses.length <= maxClauses && fits(source)) return { text: source, omitted: 0 };
  for (let count = Math.min(maxClauses, clauses.length - 1); count > 0; count--) {
    const omitted = clauses.length - count;
    const text = `${clauses.slice(0, count).join('\n')}\n+${omitted} more · Inspect`;
    if (fits(text)) return { text, omitted };
  }
  // Even one conditional may exceed the face. Do not strip its condition to fit.
  return { text: 'Complex effect\nInspect full rules', omitted: clauses.length };
}

/** Last-resort excerpt: only later-resolving clauses may be dropped, latest
 * first, so a this-turn effect is never hidden behind "Inspect". Returns
 * undefined when even that cannot fit. */
export function fitDeferredHandRules(source: string, fits: (text: string) => boolean) {
  const clauses = source.split('\n').filter(Boolean);
  const kept = [...clauses];
  for (let index = kept.length - 1; index >= 0; index--) {
    if (!isDeferredHandRule(kept[index])) continue;
    kept.splice(index, 1);
    const omitted = clauses.length - kept.length;
    const text = `${kept.join('\n')}\n+${omitted} later · Inspect`;
    if (kept.length && fits(text)) return { text, omitted };
  }
  return undefined;
}

/** Wrap with measured words, keeping short verb/quantity pairs together. */
export function wrapHandRules(source: string, measure: (text: string) => number, width: number) {
  return source.split('\n').flatMap(clause => {
    const words = clause.match(/\b(?:[Dd]eal|[Dd]raw|[Rr]etain|[Hh]eal|[Dd]iscard) \d+[.!;,]?|\d+\+? (?:damage|Cover|Resonance|Winded)[.!:;,]?|\S+/g) ?? [];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > width) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
  });
}
