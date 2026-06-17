import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

const readText = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const readJson = (relativePath) =>
  JSON.parse(readText(relativePath));

const fail = (message) => errors.push(message);

const arcanaFiles = {
  major: 'data/cards/arcana/major-arcana-bird-map.json',
  aviary: 'data/cards/arcana/aviary-arcana.json',
  plumes: 'data/cards/arcana/minor-arcana-wands.json',
  basins: 'data/cards/arcana/minor-arcana-cups.json',
  quills: 'data/cards/arcana/minor-arcana-swords.json',
  nests: 'data/cards/arcana/minor-arcana-pentacles.json',
};

const arcana = Object.fromEntries(
  Object.entries(arcanaFiles).map(([key, file]) => [key, { file, data: readJson(file) }]),
);

const cards = Object.entries(arcana).flatMap(([set, { file, data }]) =>
  data.cards.map((card) => ({ ...card, set, file })),
);

const expectedCounts = {
  major: 22,
  aviary: 6,
  plumes: 14,
  basins: 14,
  quills: 14,
  nests: 14,
};

for (const [set, expected] of Object.entries(expectedCounts)) {
  const actual = arcana[set].data.cards.length;
  if (actual !== expected) {
    fail(`${arcana[set].file}: expected ${expected} cards, found ${actual}`);
  }
}

if (cards.length !== 84) {
  fail(`expected 84 total arcana cards, found ${cards.length}`);
}

const seenIds = new Map();
const seenBirds = new Map();
const traditionalVisibleTerms = /\b(Wands|Cups|Swords|Pentacles|Page|Knight|Queen|King)\b/i;
const numberedMinorRanks = new Set(['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
const expectedPipCounts = {
  Ace: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
};

for (const card of cards) {
  const label = `${card.file}:${card.id ?? card.gameName ?? card.name ?? card.tarot}`;

  for (const field of ['id', 'bird', 'rarity', 'description']) {
    if (!card[field] || typeof card[field] !== 'string') {
      fail(`${label}: missing string field "${field}"`);
    }
  }

  const displayName = card.gameName ?? card.name ?? card.tarot;
  if (!displayName || typeof displayName !== 'string') {
    fail(`${label}: missing display name via gameName, name, or tarot`);
  } else if (traditionalVisibleTerms.test(displayName)) {
    fail(`${label}: display name uses traditional tarot/suit term "${displayName}"`);
  }

  if (!Array.isArray(card.streetwear) || card.streetwear.length === 0) {
    fail(`${label}: missing nonempty streetwear array`);
  }

  if (card.id) {
    if (seenIds.has(card.id)) {
      fail(`${label}: duplicate card id also seen in ${seenIds.get(card.id)}`);
    }
    seenIds.set(card.id, label);
  }

  if (card.bird) {
    const birdKey = card.bird.trim().toLowerCase();
    if (seenBirds.has(birdKey)) {
      fail(`${label}: duplicate bird species "${card.bird}" also seen in ${seenBirds.get(birdKey)}`);
    }
    seenBirds.set(birdKey, label);
  }

  if ((card.set === 'major' || card.set === 'aviary') && card.rarity !== 'legendary') {
    fail(`${label}: Legend/Aviary cards must be legendary`);
  }

  if (!['major', 'aviary'].includes(card.set) && numberedMinorRanks.has(card.rank)) {
    const numberSymbolism = card.numberSymbolism;
    if (!numberSymbolism || typeof numberSymbolism !== 'object') {
      fail(`${label}: numbered minor card missing numberSymbolism object`);
    } else {
      const expectedCount = expectedPipCounts[card.rank];
      if (numberSymbolism.count !== expectedCount) {
        fail(`${label}: numberSymbolism.count expected ${expectedCount}, found ${numberSymbolism.count}`);
      }

      for (const field of ['element', 'represents', 'visualRequirement']) {
        if (!numberSymbolism[field] || typeof numberSymbolism[field] !== 'string') {
          fail(`${label}: numberSymbolism missing string field "${field}"`);
        }
      }
    }
  }
}

const minorRarityCounts = cards
  .filter((card) => !['major', 'aviary'].includes(card.set))
  .reduce((counts, card) => {
    counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
    return counts;
  }, {});

const expectedMinorRarityCounts = { common: 24, uncommon: 20, rare: 12 };
for (const [rarity, expected] of Object.entries(expectedMinorRarityCounts)) {
  const actual = minorRarityCounts[rarity] ?? 0;
  if (actual !== expected) {
    fail(`minor rarity count for ${rarity}: expected ${expected}, found ${actual}`);
  }
}

const artBible = readText('docs/art/art-bible.md');
const artSections = {
  'Major Arcana Bird Map': 22,
  'Aviary Legend Bird Map': 6,
  'Plumes / Brightwing': 14,
  'Basins / Tidewatch': 14,
  'Quills / Razorwind': 14,
  'Nests / Brassnest': 14,
};

for (const [section, expected] of Object.entries(artSections)) {
  const heading = section.includes('/') ? `### ${section}` : `## ${section}`;
  const start = artBible.indexOf(heading);
  if (start === -1) {
    fail(`docs/art/art-bible.md: missing section "${section}"`);
    continue;
  }

  const rest = artBible.slice(start + heading.length);
  const nextHeadingMatch = rest.match(/\n##[#]? /);
  const sectionText = nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;
  const headerLine = sectionText.split(/\r?\n/).find((line) => line.startsWith('| Card |'));

  if (!headerLine?.includes('Style Direction') || !headerLine?.includes('Description')) {
    fail(`docs/art/art-bible.md: "${section}" table must include Style Direction and Description`);
  }

  const rows = sectionText
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| ') && !line.includes('---') && !line.includes('Style Direction'));

  if (rows.length !== expected) {
    fail(`docs/art/art-bible.md: "${section}" expected ${expected} card rows, found ${rows.length}`);
  }
}

for (const section of [
  '## Runtime Asset Rules',
  '## Review Checklist',
]) {
  if (!artBible.includes(section)) {
    fail(`docs/art/art-bible.md: missing section "${section}"`);
  }
}

for (const phrase of [
  'assets/runtime/cards/card-art-manifest.json',
  'Runtime card portrait',
  'Runtime thumbnail',
  'Small icon crop',
  '`approved`, `placeholder`, or `needs-review`',
  'Runtime should never fail to load a card because finished art is missing.',
]) {
  if (!artBible.includes(phrase)) {
    fail(`docs/art/art-bible.md: missing runtime asset phrase "${phrase}"`);
  }
}

const activeDocPaths = [
  'README.md',
  'docs/game/game-design.md',
  'docs/game/core-gameplay-spec.md',
  'docs/game/run-design-spec.md',
  'docs/game/alpha-run-spec.md',
  'docs/art/art-bible.md',
  ...Object.values(arcanaFiles),
];

const stalePatterns = [
  /major-arcana-bird-map\.v0\.2\.json/,
  /docs\/bird-squad-playable-spec\.md/,
  /docs\/bird-squad-prototype-brief\.md/,
  /docs\/game\/card-mechanics-contract\.md/,
  /docs\/game\/combat-design-spec\.md/,
  /docs\/game\/flock-stats-contract\.md/,
  /docs\/game\/run-map-contract\.md/,
  /docs\/game\/run-systems-spec\.md/,
  /Current Prototype Deck/,
  /Prototype Reward Pool/,
  /^## Starting Deck/m,
  /\uFFFD/,
];

for (const docPath of activeDocPaths) {
  const text = readText(docPath);
  for (const pattern of stalePatterns) {
    if (pattern.test(text)) {
      fail(`${docPath}: stale reference matched ${pattern}`);
    }
  }
}

const coreGameplaySpec = readText('docs/game/core-gameplay-spec.md');
const requiredFlockStats = [
  'Cohesion',
  'Damage',
  'Cover',
  'Regen',
  'Draw',
  'Resonance',
  'Molt Power',
  'Open Sky Guard',
];

for (const stat of requiredFlockStats) {
  if (!coreGameplaySpec.includes(stat)) {
    fail(`docs/game/core-gameplay-spec.md: missing required Flock Stat "${stat}"`);
  }
}

for (const section of [
  '## Foundation Rules',
  '## Shared Terms',
  '## Combat Loop',
  '## Card Contract',
  '## Gameplay Data Contract',
  '## Effect Syntax',
  '## Timing And Status Rules',
  '## Rarity And Rewards',
  '## Flock Stats',
  '## Molt And Open Sky',
  '## Enemy Tells',
  '## Acceptance Criteria',
]) {
  if (!coreGameplaySpec.includes(section)) {
    fail(`docs/game/core-gameplay-spec.md: missing section "${section}"`);
  }
}

for (const phrase of [
  'singleton',
  'Every owned playable card contributes passive Flock Stats',
  'Reward samples exclude cards already in the run deck',
  'Improved cards show a `+` suffix',
  'Molt is the signature reversal mechanic',
  'Open Sky Guard',
  '`effects`',
  '`flockStats`',
  'firstPlayedThisCombat',
  'perDiscarded',
  'Formula order',
]) {
  if (!coreGameplaySpec.includes(phrase)) {
    fail(`docs/game/core-gameplay-spec.md: missing required gameplay phrase "${phrase}"`);
  }
}

if (/[+]\s*\d+\.\d+/.test(coreGameplaySpec)) {
  fail('docs/game/core-gameplay-spec.md: Flock Stat values must be whole numbers of at least +1');
}

const runDesignSpec = readText('docs/game/run-design-spec.md');
for (const phrase of [
  'A complete run contains 4 maps.',
  'Each boss blocks a chokepoint',
  "restoring the city's broken flyways",
  'route memory',
  'final signal to the High Roost',
  'Street Encounter',
  'Rival Crew',
  'Basin Stop',
  'Nest Workshop',
  'Signal Event',
  'Waymarks',
  'Scrap',
  'Markets',
  'Release a Card',
  'Supplies',
  'Snags',
  'Bad Signals',
  'Signals',
  'Rival Crews',
  'Flock Leaders',
  '`nodes`',
  '`edges`',
  '`payloadId`',
  'Singleton card filtering applies before card rewards are shown.',
]) {
  if (!runDesignSpec.includes(phrase)) {
    fail(`docs/game/run-design-spec.md: missing required run-design phrase "${phrase}"`);
  }
}

for (const section of [
  '## Run Structure',
  '## Four-Map Arc',
  '## Node Types',
  '## Map Generation Rules',
  '## Route Data Contract',
  '## Route Generation Contract',
  '## Node Resolution Contract',
  '## Waymarks',
  '## Scrap And Markets',
  '## Release A Card',
  '## Supplies',
  '## Snags And Bad Signals',
  '## Signals',
  '## Rival Crews',
  '## Bosses',
  '## Basin Versus Nest',
  '## Flock Leaders',
  '## MVP Cut',
  '## Acceptance Criteria',
]) {
  if (!runDesignSpec.includes(section)) {
    fail(`docs/game/run-design-spec.md: missing section "${section}"`);
  }
}

for (const legacySection of [
  '## Stat Value Rules',
  '## Suit Boundaries',
  '## Rarity Budgets',
  '## Legend Modifiers',
  '## Minor Arcana Assignments',
]) {
  if (coreGameplaySpec.includes(legacySection)) {
    fail(`docs/game/core-gameplay-spec.md: contains legacy section "${legacySection}"`);
  }
}

const alphaRunSpec = readText('docs/game/alpha-run-spec.md');
for (const phrase of [
  'Map 1 only: Rooftop Blocks.',
  'The Tar-Crowned Crow',
  'Starter deck',
  'Alpha Reward Pool',
  'Alpha Card Implementation Contract',
  'Waymarks',
  'Supplies',
  'Signals',
  'Snags',
  'Market Model',
  'Basin And Nest Nodes',
]) {
  if (!alphaRunSpec.includes(phrase)) {
    fail(`docs/game/alpha-run-spec.md: missing required Alpha phrase "${phrase}"`);
  }
}

for (const section of [
  '## Alpha Scope',
  '## Map 1 Frame',
  '## Route Shape',
  '## Starting Run State',
  '## Starter Deck',
  '## Alpha Reward Pool',
  '## Alpha Card Implementation Contract',
  '## Alpha Enemies',
  '## Alpha Boss',
  '## Waymarks',
  '## Supplies',
  '## Signals',
  '## Snags',
  '## Market Model',
  '## Basin And Nest Nodes',
  '## Acceptance Criteria',
]) {
  if (!alphaRunSpec.includes(section)) {
    fail(`docs/game/alpha-run-spec.md: missing section "${section}"`);
  }
}

const expectedAlphaCardIds = [
  'major_00',
  'wands_ace',
  'wands_08',
  'swords_02',
  'swords_ace',
  'cups_ace',
  'cups_03',
  'pentacles_04',
  'pentacles_02',
  'aviary_25',
  'wands_02',
  'wands_03',
  'wands_04',
  'wands_05',
  'wands_06',
  'wands_09',
  'swords_03',
  'swords_04',
  'swords_05',
  'swords_fledgling',
  'swords_06',
  'swords_07',
  'cups_02',
  'cups_04',
  'cups_05',
  'cups_fledgling',
  'cups_06',
  'cups_08',
  'pentacles_ace',
  'pentacles_03',
  'pentacles_05',
  'pentacles_fledgling',
  'pentacles_06',
  'pentacles_08',
];

for (const cardId of expectedAlphaCardIds.slice(0, 10)) {
  if (!alphaRunSpec.includes(`\`${cardId}\``)) {
    fail(`docs/game/alpha-run-spec.md: missing starter card ${cardId}`);
  }
}

const alphaImplementationStart = alphaRunSpec.indexOf('## Alpha Card Implementation Contract');
const alphaImplementationEnd = alphaRunSpec.indexOf('## Alpha Enemies');
if (alphaImplementationStart === -1 || alphaImplementationEnd === -1 || alphaImplementationEnd < alphaImplementationStart) {
  fail('docs/game/alpha-run-spec.md: cannot locate Alpha Card Implementation Contract table');
} else {
  const alphaImplementationText = alphaRunSpec.slice(alphaImplementationStart, alphaImplementationEnd);
  const alphaImplementationRows = alphaImplementationText
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| `'));
  const alphaImplementationIds = new Set();
  const flockStatPattern = /\b(?:Cohesion|Damage|Cover|Regen|Draw|Resonance|Molt Power|Open Sky Guard) \+\d+\b/;

  for (const row of alphaImplementationRows) {
    const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean);
    const id = cells[0]?.match(/^`([^`]+)`$/)?.[1];
    if (!id) {
      fail(`docs/game/alpha-run-spec.md: malformed Alpha implementation row "${row}"`);
      continue;
    }

    alphaImplementationIds.add(id);

    const baseEffects = cells[3] ?? '';
    const improvedEffects = cells[4] ?? '';
    const baseStats = cells[5] ?? '';
    const preenDelta = cells[6] ?? '';

    if (!baseEffects.includes('`') || !improvedEffects.includes('`')) {
      fail(`docs/game/alpha-run-spec.md:${id}: effects must use normalized backticked syntax`);
    }

    if (!flockStatPattern.test(baseStats)) {
      fail(`docs/game/alpha-run-spec.md:${id}: missing whole-number Base Flock Stats`);
    }

    if (!flockStatPattern.test(preenDelta)) {
      fail(`docs/game/alpha-run-spec.md:${id}: missing whole-number Preen Delta`);
    }

    if (/[+]\s*(?:0|\d+\.\d+)/.test(`${baseStats}; ${preenDelta}`)) {
      fail(`docs/game/alpha-run-spec.md:${id}: Flock Stats and Preen Delta must be whole numbers of at least +1`);
    }
  }

  for (const cardId of expectedAlphaCardIds) {
    if (!alphaImplementationIds.has(cardId)) {
      fail(`docs/game/alpha-run-spec.md: Alpha implementation table missing ${cardId}`);
    }
  }
}

const knownCardIds = new Set(cards.map((card) => card.id));
const alphaCardIds = [...alphaRunSpec.matchAll(/`((?:major|aviary|wands|cups|swords|pentacles)_[a-z0-9]+)`/g)]
  .map((match) => match[1]);
for (const cardId of alphaCardIds) {
  if (!knownCardIds.has(cardId)) {
    fail(`docs/game/alpha-run-spec.md: references unknown card id ${cardId}`);
  }
}

const promptPackPath = 'docs/art/prompt-packs/minor-arcana-prompts.json';
if (!fs.existsSync(path.join(root, promptPackPath))) {
  fail(`${promptPackPath}: missing; run npm run export:minor-prompts`);
} else {
  const promptPack = readJson(promptPackPath);
  const promptCards = promptPack.suits?.flatMap((suit) => suit.cards ?? []) ?? [];
  if (promptPack.totalCards !== 56 || promptCards.length !== 56) {
    fail(`${promptPackPath}: expected 56 prompts, found totalCards=${promptPack.totalCards}, rows=${promptCards.length}`);
  }

  const promptIds = new Set(promptCards.map((card) => card.id));
  const minorIds = new Set(cards.filter((card) => !['major', 'aviary'].includes(card.set)).map((card) => card.id));

  for (const id of minorIds) {
    if (!promptIds.has(id)) {
      fail(`${promptPackPath}: missing prompt for minor card ${id}`);
    }
  }

  for (const card of promptCards) {
    if (!card.prompt || typeof card.prompt !== 'string') {
      fail(`${promptPackPath}:${card.id}: missing prompt text`);
      continue;
    }

    if (!/\b(?:Ace|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Fledgling|Outrider|Matron|Elder) of (?:Plumes|Basins|Quills|Nests)\b/.test(card.card ?? '')) {
      fail(`${promptPackPath}:${card.id}: prompt card title must be formal rank-and-suit title, found "${card.card}"`);
    }

    const textLineMatch = card.prompt.match(/Text \(verbatim\): "([^"]+)"/);
    if (!textLineMatch) {
      fail(`${promptPackPath}:${card.id}: missing Text (verbatim) title line`);
    } else if (textLineMatch[1] !== card.card) {
      fail(`${promptPackPath}:${card.id}: Text (verbatim) "${textLineMatch[1]}" does not match prompt card title "${card.card}"`);
    }

    if (card.designName && textLineMatch?.[1] === card.designName) {
      fail(`${promptPackPath}:${card.id}: in-card title must not use design name "${card.designName}"`);
    }

    for (const required of ['Output geometry:', '1024 px wide x 1536 px tall', '2:3 vertical portrait', 'Locked border template:', 'Suit isolation:', 'Suit border inserts:', 'cartouche baseline', 'border silhouette', 'Species lock:', 'Subject species lock:', 'total bird count must match the card description exactly', 'Anatomy handling:', 'exactly two legs', 'beak, talons, feet, or legs', 'Action source:', 'Bird-originated action:', 'Wrong-suit hard gate:', 'Exact pip audit:', 'Style reference target:', 'World constraint:', 'Future-tech constraint:', 'Grounded effects constraint:', 'magical particles', 'Wardrobe individuality:', 'Style direction:', 'Streetwear adaptation', 'Text (verbatim):', 'Avoid:']) {
      if (!card.prompt.includes(required)) {
        fail(`${promptPackPath}:${card.id}: prompt missing "${required}"`);
      }
    }

    if (['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(card.rank)) {
      if (!card.prompt.includes('Tarot count requirement:')) {
        fail(`${promptPackPath}:${card.id}: pip prompt missing "Tarot count requirement:"`);
      }
      if (!card.prompt.includes('Use this single count-element type only')) {
        fail(`${promptPackPath}:${card.id}: pip prompt missing single count-element rule`);
      }
      if (!card.prompt.includes('count the visible pip elements one by one')) {
        fail(`${promptPackPath}:${card.id}: pip prompt missing explicit count audit rule`);
      }
      if (!card.prompt.includes('Pip representation:')) {
        fail(`${promptPackPath}:${card.id}: pip prompt missing "Pip representation:"`);
      }

      if (card.acceptance?.pipCount == null || !card.acceptance?.pipElement || !card.acceptance?.visualRequirement) {
        fail(`${promptPackPath}:${card.id}: pip prompt missing acceptance contract metadata`);
      }
    } else if (!card.prompt.includes('Tarot role requirement:')) {
      fail(`${promptPackPath}:${card.id}: court prompt missing "Tarot role requirement:"`);
    } else if (card.acceptance?.pipCount !== null) {
      fail(`${promptPackPath}:${card.id}: court prompt acceptance pipCount must be null`);
    }
  }
}

const centerPromptPackPath = 'docs/art/prompt-packs/minor-arcana-center-art-prompts.json';
if (!fs.existsSync(path.join(root, centerPromptPackPath))) {
  fail(`${centerPromptPackPath}: missing; run npm run export:minor-center-prompts`);
} else {
  const centerPromptPack = readJson(centerPromptPackPath);
  const centerPromptCards = centerPromptPack.suits?.flatMap((suit) => suit.cards ?? []) ?? [];
  if (centerPromptPack.mode !== 'center-art-only') {
    fail(`${centerPromptPackPath}: expected mode center-art-only, found ${centerPromptPack.mode}`);
  }
  if (centerPromptPack.totalCards !== 56 || centerPromptCards.length !== 56) {
    fail(`${centerPromptPackPath}: expected 56 prompts, found totalCards=${centerPromptPack.totalCards}, rows=${centerPromptCards.length}`);
  }

  for (const card of centerPromptCards) {
    if (!card.prompt || typeof card.prompt !== 'string') {
      fail(`${centerPromptPackPath}:${card.id}: missing prompt text`);
      continue;
    }

    for (const required of [
      'center illustration layer',
      'Do not generate a card border',
      'no readable title text',
      'The locked SVG overlay will add the border and title later.',
      'Leave clean visual margins',
      'Overlay safe area:',
      'Text handling for this layer:',
      'Wrong-suit hard gate:',
      'Exact pip audit:',
    ]) {
      if (!card.prompt.includes(required)) {
        fail(`${centerPromptPackPath}:${card.id}: center prompt missing "${required}"`);
      }
    }

    if (['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(card.rank)) {
      if (!card.prompt.includes('Use this single count-element type only')) {
        fail(`${centerPromptPackPath}:${card.id}: center pip prompt missing single count-element rule`);
      }
      if (card.acceptance?.pipCount == null || !card.acceptance?.pipElement || !card.acceptance?.visualRequirement) {
        fail(`${centerPromptPackPath}:${card.id}: center pip prompt missing acceptance contract metadata`);
      }
    } else if (card.acceptance?.pipCount !== null) {
      fail(`${centerPromptPackPath}:${card.id}: center court prompt acceptance pipCount must be null`);
    }

    for (const forbidden of [
      'Text (verbatim):',
      'only in the bottom title cartouche',
      'reuse the exact accepted Minor Arcana deck frame',
    ]) {
      if (card.prompt.includes(forbidden)) {
        fail(`${centerPromptPackPath}:${card.id}: center prompt should not include full-card phrase "${forbidden}"`);
      }
    }
  }
}

const aviaryPromptPackPath = 'docs/art/prompt-packs/aviary-center-art-prompts.json';
if (!fs.existsSync(path.join(root, aviaryPromptPackPath))) {
  fail(`${aviaryPromptPackPath}: missing; run npm run export:aviary-center-prompts`);
} else {
  const aviaryPromptPack = readJson(aviaryPromptPackPath);
  const aviaryPromptCards = aviaryPromptPack.cards ?? [];
  if (aviaryPromptPack.mode !== 'center-art-only') {
    fail(`${aviaryPromptPackPath}: expected mode center-art-only, found ${aviaryPromptPack.mode}`);
  }
  if (aviaryPromptPack.totalCards !== 6 || aviaryPromptCards.length !== 6) {
    fail(`${aviaryPromptPackPath}: expected 6 prompts, found totalCards=${aviaryPromptPack.totalCards}, rows=${aviaryPromptCards.length}`);
  }

  const aviaryIds = new Set(cards.filter((card) => card.set === 'aviary').map((card) => card.id));
  const promptIds = new Set(aviaryPromptCards.map((card) => card.id));
  for (const id of aviaryIds) {
    if (!promptIds.has(id)) {
      fail(`${aviaryPromptPackPath}: missing prompt for Aviary card ${id}`);
    }
  }

  for (const card of aviaryPromptCards) {
    if (!card.prompt || typeof card.prompt !== 'string') {
      fail(`${aviaryPromptPackPath}:${card.id}: missing prompt text`);
      continue;
    }

    for (const required of [
      'Aviary Legend center illustration layer',
      'Do not generate a card border',
      'no readable text',
      'locked master raster border',
      'master.png',
      'roman numeral',
      'Text handling for this layer:',
      'Species lock:',
      'Subject species lock:',
      'Anatomy handling:',
      'Bird-originated action:',
      'Style reference target:',
      'World constraint:',
      'Future-tech constraint:',
      'Grounded effects constraint:',
      'Master border reference:',
    ]) {
      if (!card.prompt.includes(required)) {
        fail(`${aviaryPromptPackPath}:${card.id}: Aviary prompt missing "${required}"`);
      }
    }

    for (const forbidden of [
      'Text (verbatim):',
      'only in the bottom title cartouche',
      'Suit border inserts:',
      'Tarot count requirement:',
      'Pip representation:',
    ]) {
      if (card.prompt.includes(forbidden)) {
        fail(`${aviaryPromptPackPath}:${card.id}: Aviary center prompt should not include full-card/minor phrase "${forbidden}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Documentation validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Documentation validation passed.');
console.log(`Checked ${cards.length} cards, ${seenBirds.size} unique bird species, and art style rows for all 84 mappings.`);
