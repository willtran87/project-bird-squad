import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs/art/prompt-packs');
const dataFile = 'data/cards/arcana/aviary-arcana.json';

const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const artBible = readText('docs/art/art-bible.md');
const data = readJson(dataFile);

function parseAviaryRows() {
  const rows = new Map();
  let inSection = false;

  for (const line of artBible.split(/\r?\n/)) {
    if (line.startsWith('## Aviary Legend Bird Map')) inSection = true;
    else if (inSection && line.startsWith('## ') && !line.startsWith('## Aviary Legend Bird Map')) inSection = false;

    if (!inSection || !line.startsWith('| ') || line.includes('---') || line.includes('Style Direction')) {
      continue;
    }

    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());

    if (cells.length < 5) continue;
    const [card, bird, rarity, styleDirection, description] = cells;
    rows.set(card, { card, bird, rarity, styleDirection, description });
  }

  return rows;
}

const artRows = parseAviaryRows();

const promptRules = [
  'Use case: stylized-concept',
  'Asset type: high-resolution Bird Squad Aviary Legend center illustration layer',
  'Style/medium: high-resolution pixel art only, crisp pixel clusters, deliberate dithering, polished game-art quality. Reject realistic painting, semi-realistic illustration, smooth digital painting, painterly brushwork, photographic rendering, soft airbrush realism, or non-pixel-art concept art',
  'Output geometry: fixed 1024 px wide x 1536 px tall canvas, 2:3 vertical portrait aspect ratio, designed to sit underneath the deterministic Bird Squad master border/title overlay',
  'Center-art-only composition: create the bird and scene art only. Do not generate a card border, title cartouche, corner medallions, side rails, top medallion, roman numeral, rank label, suit label, readable card title, or other readable text. The compositor will add the master border, roman numeral, and title later',
  'Overlay safe area: keep the entire primary bird silhouette, head, beak, tail, feet, held props, and card-defining action comfortably inside the central safe zone while the urban environment still fills the full canvas behind them. Do not create blank margins, dark vignettes, spotlight falloff, faded edges, empty safety moats, or cropped-looking borders in the generated art',
  'Centering rule: compose as if the final master border will cover the outer edge of the image. Keep the subject mass centered, not pushed into the top, sides, or bottom, while allowing background architecture, sky, city texture, rooftops, rails, windows, weather, and light to continue full-frame behind the future border',
  'Text handling: no readable text anywhere in the image layer. Final title text and roman numeral are rendered later from card data by the overlay/compositing pipeline',
  'Constraints: anatomically bird, no human torso, no arms, no hands, no fingers, no human face, no human legs, no humanoid posture, no wing-hands, no wing-arms, no duplicate wings',
  'Species lock: depict only the named bird species for this card unless the card explicitly requires same-species supporting birds. Do not add any other bird species, mixed flocks, hybrid traits, or background birds from another species',
  'Anatomy handling: wings are wings, not arms or hands; do not pose wing tips as fingers, palms, elbows, sleeves, forearms, shoulders, human-like side limbs, or graspers. Clothing sleeves, capes, ponchos, jackets, straps, and harnesses must follow folded wings or the bird torso and must never create an arm silhouette. Birds have exactly two legs and exactly two wings, never three or more visible legs, duplicate wings, extra wing sets, or extra limbs. Any actively held prop must be held only by the beak, talons, feet, or legs',
  'Action source: the card effect must originate from the bird itself through species behavior, posture, movement, voice, plumage display, gaze, flight, guarding, gathering, carrying, watching, sheltering, or transformation; props and surroundings only frame, amplify, or echo the action',
  'Streetwear constraints: fitted to bird anatomy, no readable text on clothing, no slogans, no brand marks, no crew names, no pseudo-writing',
  'Style reference target: grounded modern bird-city streetwear like assets/splash/bird-squad-bold-streetwear-splash-v3.png; contemporary jackets, hoodies, workwear layers, utility harnesses, rain shells, beanies, pouches, straps, rooftops, towers, wet pavement, signage shapes without readable text, antennas, railings, cables, concrete, twilight city light, and practical urban texture',
  'World constraint: modern urban present-day or near-present city only; avoid old-world fantasy villages, medieval markets, castles, temples, taverns, parchment shops, wizard robes, generic fantasy costume, and Renaissance fair craft staging',
  'Future-tech constraint: avoid futuristic sci-fi cityscapes, hologram UI, spaceship panels, cybernetic armor, robotic accessories, floating screens, and neon cyberpunk tech overload',
  'Grounded effects constraint: no magical particles, sparkles, glowing motes, aura clouds, spell circles, floating runes, particle swirls, generic energy bursts, fireworks, electric arcs, holograms, LED-tech beams, or spellcasting. Dramatic light must read as weather, city light, plumage, silhouette, reflection, eclipse, dawn, dusk, or natural storm atmosphere',
  'Culture constraint: modern urban streetwear culture, not a gang; avoid uniforms, territory marks, gang signs, weapon display, and aggressive affiliation marks',
  'Fantasy/tarot constraint: tarot symbolism as subtle physical motifs, practical props, light, weather, posture, and composition inside the scene; avoid generic fantasy costume, generic spellcasting, occult spectacle, and floating magic icons',
];

function makePrompt(card) {
  const displayTitle = card.gameName ?? card.tarot;
  const row = artRows.get(displayTitle);
  const styleDirection = row?.styleDirection ?? card.streetwear.join(', ');
  const description = row?.description ?? card.description;
  const palette = Array.isArray(card.palette) ? card.palette.join(', ') : '';
  const streetwear = Array.isArray(card.streetwear) ? card.streetwear.join(', ') : '';
  const sameSpeciesLine = card.id === 'aviary_26'
    ? `Supporting flock rule: this card may include many Red-billed Quelea because the card meaning requires a same-species murmuration. The foreground bird must remain the clear subject; every visible bird must be Red-billed Quelea.`
    : `Supporting bird rule: use one primary ${card.bird}; do not add background birds or mixed flocks unless they are explicitly described as same-species support.`;

  return [
    ...promptRules,
    `Primary request: Create the center illustration layer for the Bird Squad Aviary Legend card "${displayTitle}" featuring an anatomically correct ${card.bird}. The locked master raster border will add the border, roman numeral, and title later.`,
    `Aviary trump identity: ${card.roman} / ${card.number}. This numeral is for prompt context only; do not draw any readable roman numeral or number in the center art.`,
    `Card lineage/name: ${displayTitle}. Use this as the final title concept, but do not draw any title text in the center art.`,
    `Scene/backdrop: ${description}`,
    `Subject species lock: ${card.bird} only; no other bird species on this card, no hybrid bird anatomy, and no unrelated background birds. Subject: ${card.bird}; ${card.pose}`,
    sameSpeciesLine,
    `Bird-originated action: show "${card.coreMeaning}" as an action, emotion, pressure, or state created by ${card.bird} through body language, movement, flight, sheltering posture, watching, molt/preen behavior, flock leadership, plumage, gaze, or species behavior; do not make an external prop, border motif, light, or background device look like the source of the effect.`,
    `Style direction: ${styleDirection}`,
    `Streetwear adaptation from production data: ${streetwear}`,
    `Wardrobe individuality: give this ${card.bird} a legendary, distinct outfit silhouette and accessory mix. Do not reuse the same jacket, hood, harness, mask, or uniform shape from the Minor Arcana suits or neighboring Aviary cards.`,
    `Pose energy and silhouette: ${card.poseEnergy}; ${card.silhouetteClass}`,
    `Color palette: ${palette}; accent ${card.accent}`,
    `Variety notes: ${card.varietyNotes}`,
    `Card meaning / gameplay feel: ${card.coreMeaning}; ${card.gameplayFantasy}`,
    'Master border reference: final compositing will use assets/templates/minor-arcana/raster-border-templates/master.png as the shared Aviary border. Do not draw border medallions, rails, cartouches, roman numerals, title text, labels, rank marks, or frame ornament in the center art.',
    'Text handling for this layer: no readable title text, no cartouche text, no roman numeral text, no clothing text, no signage text, no logos, no pseudo-writing. The compositor owns all readable final text.',
    'Avoid: human anatomy, hands, fingers, wing-hands, wing tips acting like fingers, wing-arms, sleeve-arms, sleeve shapes that read as arms, human arms, human shoulders, human face, human legs, three-legged birds, extra wings, duplicate wings, extra limbs, humanoid bird bodies, realistic painting, semi-realistic illustration, smooth digital painting, photographic realism, readable clothing text, readable logos, readable slogans, readable crew names, brand names, pseudo-writing, mixed bird species, unrelated background bird species, generated card border, title cartouche, medallions, side rails, rank text, suit text, roman numeral text, mismatched card borders, cream/light simplified borders, gang uniforms, gang signs, weapon display, gore, watermark, extra text, blurred pixel art, medieval fantasy, old-world market, castle, temple, tavern, wizard robe, fantasy cloak costume, futuristic sci-fi, holograms, cybernetic armor, floating UI, magical particles, sparkles, glowing motes, aura clouds, spell circles, floating runes, particle swirls, generic spellcasting, floating magic icons with no physical source.',
  ].join('\n');
}

const cards = data.cards.map((card) => ({
  id: card.id,
  number: card.number,
  roman: card.roman,
  card: card.gameName ?? card.tarot,
  bird: card.bird,
  rarity: card.rarity,
  acceptance: {
    exactSpecies: card.bird,
    title: card.gameName ?? card.tarot,
    roman: card.roman,
    hardRejects: [
      'generated border, cartouche, medallions, roman numerals, title text, or readable text in center art',
      'mixed bird species or hybrid traits',
      'arms, hands, fingers, wing-hands, extra legs, or extra wings',
      'realistic, semi-realistic, painterly, photographic, or non-pixel art style',
      'old-world fantasy, future sci-fi, magical particles, or technology-sourced spectacle',
      'subject head, feet, tail, or card-defining action pushed into the future border',
    ],
  },
  prompt: makePrompt(card),
  source: {
    dataFile,
    artBible: 'docs/art/art-bible.md',
    masterTemplate: 'assets/templates/minor-arcana/raster-border-templates/master.png',
  },
}));

const output = {
  version: '0.1',
  project: 'Bird Squad',
  purpose: 'Aviary Legend center-art-only prompt pack for master-template compositing',
  mode: 'center-art-only',
  generatedFrom: ['docs/art/art-bible.md', dataFile],
  totalCards: cards.length,
  promptRules,
  cards,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'aviary-center-art-prompts.json'),
  `${JSON.stringify(output, null, 2)}\n`,
);

const markdown = [
  '# Aviary Legend Center-Art Prompt Pack',
  '',
  'Generated from `docs/art/art-bible.md` and `data/cards/arcana/aviary-arcana.json`.',
  'Mode: center art only. The locked master raster template adds border, roman numeral, and title text later.',
  '',
  `Total cards: ${output.totalCards}`,
  '',
  ...cards.flatMap((card) => [
    `## ${card.roman} - ${card.card} - ${card.bird}`,
    '',
    '```text',
    card.prompt,
    '```',
    '',
  ]),
].join('\n');

fs.writeFileSync(path.join(outDir, 'aviary-center-art-prompts.md'), `${markdown}\n`);

const brief = [
  '# Aviary Legend Generation Brief',
  '',
  'Generated from the canonical Aviary Legend center-art prompt pack.',
  '',
  '## Shared Requirements',
  '',
  '- Generate center art only. Do not generate borders, title cartouches, medallions, side rails, roman numerals, card titles, labels, or readable text.',
  '- The deterministic compositor owns the shared master border, top roman numeral, and bottom title.',
  '- Final compositing uses `assets/templates/minor-arcana/raster-border-templates/master.png` as the shared Aviary border.',
  '- Birds must remain anatomically birds: no human torso, arms, hands, fingers, human face, human legs, wing-hands, duplicate wings, or humanoid posture.',
  '- Depict only the named bird species. `Flock Signal` may show a same-species Red-billed Quelea murmuration; all other cards should use one primary bird unless same-species support is explicitly needed.',
  '- Keep the bird, beak, feet, tail, action, and important symbolic objects inside the central safe area so the master border does not crop them.',
  '- Fill the full raw canvas with urban environment behind the centered subject; no blank safety margins, dark vignettes, or generated border-like edges.',
  '- Use grounded modern bird-city streetwear and practical urban texture; avoid old-world fantasy, future sci-fi, magic particles, readable logos, gang-coded markings, and weapon display.',
  '- Use high-resolution pixel art only, with crisp clusters and deliberate dithering.',
  '',
  '## Production Prompts',
  '',
  ...cards.flatMap((card) => [
    `### ${card.roman} - ${card.card}`,
    '',
    '```text',
    card.prompt,
    '```',
    '',
  ]),
].join('\n');

const briefsDir = path.join(outDir, 'subagent-aviary-center-art-briefs');
fs.mkdirSync(briefsDir, { recursive: true });
fs.writeFileSync(path.join(briefsDir, 'aviary-legends-brief.md'), `${brief}\n`);

console.log(`Wrote ${output.totalCards} prompts to docs/art/prompt-packs/aviary-center-art-prompts.json`);
console.log('Wrote markdown prompts to docs/art/prompt-packs/aviary-center-art-prompts.md');
console.log('Wrote Aviary brief to docs/art/prompt-packs/subagent-aviary-center-art-briefs/aviary-legends-brief.md');
