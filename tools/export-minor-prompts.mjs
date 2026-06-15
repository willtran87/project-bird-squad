import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs/art/prompt-packs');
const centerArtOnly = process.argv.includes('--center-art-only');

const suitFiles = [
  {
    key: 'plumes',
    suitName: 'Plumes',
    label: 'Plumes / Brightwing',
    file: 'data/cards/arcana/minor-arcana-wands.json',
    borderMotif: 'plume-flash, crest, call-wave, feather-rhythm, and biological resonance marks',
    forbiddenMotifs: 'basins, rain vessels, care-station marks, signal-quills, antenna fields as the action source, nests, shine tags, and scaffold gear',
    countElement: 'plumage display beats, rhythm tabs, feather-color echoes, call-wave marks, reflection beats, or carefully staged plume markers',
    suitStyle:
      'modern urban performance culture with distinct card-by-card lanes: rooftop busker set, billboard scout lookout, rooftop runway fit-check, block-party setup, dance cypher, festival victory wire, skate-ledge standoff, parkour speed run, sound-crew barricade, performance-load runner, poster-runner route, skyline courier run, rooftop runway lead, and water-tower rhythm director. Use individualized bird-fitted streetwear rather than a black-and-bright uniform: cropped bombers, varsity shells, washed hoodies, puffers, mesh overshirts, dance wraps, windbreakers, crossbody pouches, abstract patches without text, flight-safe harnesses, talon wraps, poster walls, stage tape, chalk circles, rooftop mats, billboards, fire escapes, wet rooftops, waterfront rails, dense apartment-window backdrops, grounded signage, iridescent throat or plumage accents, and rooftop utility texture. The Plumes action must come from the bird itself: throat color, chest color, plume display, wingbeat rhythm, call posture, feather vibration, iridescence, or body motion, supported by practical performance gear. Plume light and sound must read as biological or reflective: calls, wingbeats, feather buzz, plumage sheen, throat flash, wet pavement reflections, and ordinary city light; no repeated generic flashy rooftop pose, no readable logos, no sorcerer robes, fantasy performer costumes, glowing spell effects, magical particles, occult staging, tactical armor, electric beams, antenna flashes, holograms, LED-tech effects, or technology-driven action',
  },
  {
    key: 'basins',
    suitName: 'Basins',
    label: 'Basins / Tidewatch',
    file: 'data/cards/arcana/minor-arcana-cups.json',
    borderMotif: 'basin, rain, canal ripple, droplet, and care-station marks',
    forbiddenMotifs: 'plume flashes, stage plumes, signal-quills, antenna fields, nests, shine tags, and scaffold gear',
    countElement: 'basin vessels, rain cups, care-station containers, or canal-light basin markers',
    suitStyle:
      'modern canal mutual-aid culture, rain shells, hooded wraps, care stations, underpasses, harbor railings, shelter, reflective wet-weather trim, first-aid pouches, contemporary utility fountains',
  },
  {
    key: 'quills',
    suitName: 'Quills',
    label: 'Quills / Razorwind',
    file: 'data/cards/arcana/minor-arcana-swords.json',
    borderMotif: 'quill, antenna, wind-cut, signal, and pressure-mark details',
    forbiddenMotifs: 'plume flashes, stage plumes, basin vessels, rain-care symbols, nests, shine tags, and scaffold gear',
    countElement: 'signal-quills, built-in signal posts, pressure marks, clipped feather tags, window reflections, rooftop cracks, or rain-streak marks',
    suitStyle:
      'modern signal-and-strategy culture with distinct card-by-card lanes: rooftop radio analyst, billboard decision perch, rain-alley witness, utility-room night watch, ledge salvage runner, elevated-transit storm crossing, service-wire sneak thief, rooftop service enclosure, 3am apartment-wire insomnia, dawn recovery ledge, rookie message runner, aerial strategy racer, rooftop tactician, and radio-tower commander. Use varied present-day signalwear rather than repeated matching uniforms or Basin-like caretaker rainwear: cropped courier jackets, blue varsity windbreakers, wind-cut shells, padded roost vests, asymmetric salvage vests, waterproof flight capes, thrifted black anoraks, mesh utility wraps, rumpled knit snoods, patched coach jackets, rookie messenger hoodies, racing shells, tailored tactician coats, heavy command mantles, signal-quill pins, wind-cut cuffs, rooftop radio rigs, transit wires, utility boxes, service units, wet apartment windows, and concrete. Quills pip counts must be integrated into working city surfaces, carried tags, clipped route markers, pressure marks, window reflections, rooftop cracks, or equipment the bird is actually using; avoid rows of pasted loose feathers or isolated icon clusters. Present-day infrastructure rather than futuristic sci-fi',
  },
  {
    key: 'nests',
    suitName: 'Nests',
    label: 'Nests / Brassnest',
    file: 'data/cards/arcana/minor-arcana-pentacles.json',
    borderMotif: 'nest, scaffold, gear, shine tag, and vine marks',
    forbiddenMotifs: 'plume flashes, stage spotlights as magic, basin vessels, rain-care symbols, signal-quills, and antenna fields',
    countElement: 'shine tags, scaffold clips, nested materials, tagged crates, or practical resource markers',
    suitStyle:
      'modern urban maker culture with distinct card-by-card hipster workwear subcultures: community garden, bike shop, hardware co-op, storage unit, laundromat/corner store, food-pantry table, rooftop planter crew, maker bench, thrift-alley record stall, loading-dock block party, coffee-roastery maker corner, cargo courier route, parts-library alcove, and hardware co-op mezzanine. Use beanies, flannel wraps, denim or canvas chore coats, hoodies, utility vests, work aprons, tool slings, salvage satchels, scaffold clips, brass hardware, crates, concrete, work lights, folding tables, pegboards, cargo bikes, milk crates, planters, roll-up doors, and modern shop fixtures; no repeated generic repair-market scene, no medieval craft market, old-world fantasy stall, treasure room, tavern, robes, parchment, or wizard-shop staging',
  },
];

const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const artBible = readText('docs/art/art-bible.md');

function parseArtBibleStyleRows() {
  const rows = new Map();
  let section = '';

  for (const line of artBible.split(/\r?\n/)) {
    if (line.startsWith('### Plumes / Brightwing')) section = 'plumes';
    else if (line.startsWith('### Basins / Tidewatch')) section = 'basins';
    else if (line.startsWith('### Quills / Razorwind')) section = 'quills';
    else if (line.startsWith('### Nests / Brassnest')) section = 'nests';
    else if (line.startsWith('## ') || line.startsWith('### ')) section = '';

    if (!section || !line.startsWith('| ') || line.includes('---') || line.includes('Style Direction')) {
      continue;
    }

    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());

    if (cells.length < 5) continue;
    const [card, bird, rarity, styleDirection, description] = cells;
    rows.set(card, { section, card, bird, rarity, styleDirection, description });
  }

  return rows;
}

const styleRows = parseArtBibleStyleRows();

const fullCardPromptRules = [
  'Use case: stylized-concept',
  'Asset type: high-resolution Bird Squad Minor Arcana card illustration',
  'Style/medium: high-resolution pixel art only, crisp pixel clusters, deliberate dithering, polished game-art quality. Reject realistic painting, semi-realistic illustration, smooth digital painting, painterly brushwork, photographic rendering, soft airbrush realism, or non-pixel-art concept art',
  'Output geometry: fixed 1024 px wide x 1536 px tall canvas, 2:3 vertical portrait aspect ratio; do not vary width, height, aspect ratio, frame crop, or title-cartouche position between cards',
  'Composition/framing: vertical tarot card, centered full-body bird, clear silhouette, consistent Tarot Aviary border width and symmetry, readable bottom title cartouche, full card frame visible with no clipped border',
  'Border: dark outer keyline, gilded inner filigree rail, four corner medallions, slim vertical side rails, top suit crest medallion, bottom title cartouche',
  'Locked border template: reuse the exact accepted Minor Arcana deck frame: same outer margin, dark keyline, gilded inner rail, four corner medallions, side rails, centered top medallion, central image window, and bottom title cartouche across the full Minor Arcana; do not alter frame thickness, cartouche height, cartouche baseline, medallion placement, side-rail placement, crop, border palette, or border silhouette; reject borders that look lighter, simpler, cream-card, newly drawn, or from a different deck',
  'Text: only the formal Minor Arcana rank-and-suit title in the bottom cartouche, such as "Ace of Plumes"; do not use the Bird Squad game/design name as in-card title text',
  'Constraints: anatomically bird, no human torso, no arms, no hands, no fingers, no human face, no human legs, no humanoid posture, no wing-hands, no wing-arms, no duplicate wings',
  'Species lock: depict only the named bird species for this card; do not add any other bird species, mixed flocks, hybrid traits, or background birds from another species. If additional birds are needed for tarot meaning, they must be the same named species and visually secondary to the main subject',
  'Anatomy handling: wings are wings, not arms or hands; do not pose wing tips as fingers, palms, elbows, sleeves, forearms, shoulders, human-like side limbs, or graspers. Clothing sleeves, capes, ponchos, jackets, straps, and harnesses must follow folded wings or the bird torso and must never create an arm silhouette. Birds have exactly two legs and exactly two wings, never three or more visible legs, duplicate wings, extra wing sets, or extra limbs. Any actively held prop must be held only by the beak, talons, feet, or legs. Harnesses, straps, and satchels may carry passive attachments, but must never look like hands or gripping fingers',
  'Action source: the card effect must originate from the bird itself through species behavior, posture, movement, voice, plumage display, gaze, flight, guarding, gathering, carrying, or nurturing; props and surroundings only frame, amplify, or echo the action',
  'Wrong-suit hard gate: if the finished image reads primarily as another suit, reject it before saving even if the bird species and style look good',
  'Exact pip audit: for Ace-Ten cards, count the visible pip elements one by one before accepting the candidate. The image fails if the count is high, low, ambiguous, split across multiple object types, hidden by the frame, hidden or cropped by the final border/title overlay, or padded by extra birds',
  'Pip integration: for Ace-Ten cards, count elements must feel motivated by the scene: carried, worn, built, guarded, reflected, clipped to working equipment, arranged by the bird, or produced by bird behavior. Avoid rows of pasted icons, floating tokens, isolated prop clusters, or count objects that look glued onto the art after the scene was composed',
  'Streetwear constraints: fitted to bird anatomy, no readable text on clothing, no slogans, no brand marks, no crew names, no pseudo-writing',
  'Style reference target: grounded modern bird-city streetwear like assets/splash/bird-squad-bold-streetwear-splash-v3.png; contemporary jackets, hoodies, workwear layers, utility harnesses, rain shells, beanies, pouches, straps, rooftop/canal/market infrastructure, neon signage, crates, antennas, HVAC units, cables, concrete, and wet pavement',
  'World constraint: modern urban present-day or near-present city only; avoid old-world fantasy villages, medieval markets, castles, temples, taverns, parchment shops, wizard robes, generic fantasy costume, and Renaissance fair craft staging',
  'Future-tech constraint: avoid futuristic sci-fi cityscapes, hologram UI, spaceship panels, cybernetic armor, robotic accessories, floating screens, and neon cyberpunk tech overload',
  'Grounded effects constraint: no magical particles, sparkles, glowing motes, aura clouds, spell circles, floating runes, particle swirls, generic energy bursts, fireworks, electric arcs, antenna flashes, holograms, LED-tech beams, or spellcasting; Plumes effects must read as biological plumage color, bird calls, wingbeats, feather buzz, motion, reflection, rhythm, and grounded performance',
  'Culture constraint: modern urban streetwear culture, not a gang; avoid uniforms, territory marks, gang signs, weapon display, and aggressive affiliation marks',
  'Fantasy/tarot constraint: tarot symbolism as subtle physical motifs, border insets, practical props, light, and composition; avoid generic fantasy costume, generic spellcasting, and occult spectacle',
];

const centerArtPromptRules = [
  'Use case: stylized-concept',
  'Asset type: high-resolution Bird Squad Minor Arcana center illustration layer',
  'Style/medium: high-resolution pixel art only, crisp pixel clusters, deliberate dithering, polished game-art quality. Reject realistic painting, semi-realistic illustration, smooth digital painting, painterly brushwork, photographic rendering, soft airbrush realism, or non-pixel-art concept art',
  'Output geometry: fixed 1024 px wide x 1536 px tall canvas, 2:3 vertical portrait aspect ratio, designed to sit underneath a deterministic Bird Squad border/title overlay',
  'Center-art-only composition: create the bird and scene art only. Do not generate a card border, title cartouche, corner medallions, side rails, top medallion, rank label, suit label, or readable card title. Leave clean visual margins so the locked overlay can sit on top without covering the bird, beak, feet, tail, action, or important pip elements',
  'Overlay safe area: keep the entire primary bird silhouette, head, beak, tail, feet, held props, and every countable pip element comfortably inside the central safe zone while the urban environment still fills the full canvas behind them. Do not create blank margins, dark vignettes, spotlight falloff, faded edges, empty safety moats, or cropped-looking borders in the generated art',
  'Centering rule: compose as if the final border will cover the outer edge of the image. Keep the subject mass and count elements centered, not pushed into the top, sides, or bottom, while allowing background architecture, pavement, water, rooftops, rails, windows, and city texture to continue full-frame behind the future border. Keep count elements at least one full pip-width away from any future border, side rail, corner medallion, top medallion, or title cartouche; if an element would touch the border or be partly covered after compositing, move the subject and pips inward but keep the setting filled out to the image edges',
  'Text handling: no readable text anywhere in the image layer. Final title text is rendered later from card data by the overlay/compositing pipeline',
  'Constraints: anatomically bird, no human torso, no arms, no hands, no fingers, no human face, no human legs, no humanoid posture, no wing-hands, no wing-arms, no duplicate wings',
  'Species lock: depict only the named bird species for this card; do not add any other bird species, mixed flocks, hybrid traits, or background birds from another species. If additional birds are needed for tarot meaning, they must be the same named species and visually secondary to the main subject',
  'Anatomy handling: wings are wings, not arms or hands; do not pose wing tips as fingers, palms, elbows, sleeves, forearms, shoulders, human-like side limbs, or graspers. Clothing sleeves, capes, ponchos, jackets, straps, and harnesses must follow folded wings or the bird torso and must never create an arm silhouette. Birds have exactly two legs and exactly two wings, never three or more visible legs, duplicate wings, extra wing sets, or extra limbs. Any actively held prop must be held only by the beak, talons, feet, or legs. Harnesses, straps, and satchels may carry passive attachments, but must never look like hands or gripping fingers',
  'Action source: the card effect must originate from the bird itself through species behavior, posture, movement, voice, plumage display, gaze, flight, guarding, gathering, carrying, or nurturing; props and surroundings only frame, amplify, or echo the action',
  'Wrong-suit hard gate: if the finished image reads primarily as another suit, reject it before saving even if the bird species and style look good',
  'Exact pip audit: for Ace-Ten cards, count the visible pip elements one by one before accepting the candidate. The image fails if the count is high, low, ambiguous, split across multiple object types, hidden by the frame, hidden or cropped by the final border/title overlay, or padded by extra birds',
  'Pip integration: for Ace-Ten cards, count elements must feel motivated by the scene: carried, worn, built, guarded, reflected, clipped to working equipment, arranged by the bird, or produced by bird behavior. Avoid rows of pasted icons, floating tokens, isolated prop clusters, or count objects that look glued onto the art after the scene was composed. Count elements should be large and separated enough to count after the border is added, not tiny background texture',
  'Streetwear constraints: fitted to bird anatomy, no readable text on clothing, no slogans, no brand marks, no crew names, no pseudo-writing',
  'Style reference target: grounded modern bird-city streetwear like assets/splash/bird-squad-bold-streetwear-splash-v3.png; contemporary jackets, hoodies, workwear layers, utility harnesses, rain shells, beanies, pouches, straps, rooftop/canal/market infrastructure, neon signage shapes without readable text, crates, antennas, HVAC units, cables, concrete, and wet pavement',
  'World constraint: modern urban present-day or near-present city only; avoid old-world fantasy villages, medieval markets, castles, temples, taverns, parchment shops, wizard robes, generic fantasy costume, and Renaissance fair craft staging',
  'Future-tech constraint: avoid futuristic sci-fi cityscapes, hologram UI, spaceship panels, cybernetic armor, robotic accessories, floating screens, and neon cyberpunk tech overload',
  'Grounded effects constraint: no magical particles, sparkles, glowing motes, aura clouds, spell circles, floating runes, particle swirls, generic energy bursts, fireworks, electric arcs, antenna flashes, holograms, LED-tech beams, or spellcasting; Plumes effects must read as biological plumage color, bird calls, wingbeats, feather buzz, motion, reflection, rhythm, and grounded performance',
  'Culture constraint: modern urban streetwear culture, not a gang; avoid uniforms, territory marks, gang signs, weapon display, and aggressive affiliation marks',
  'Fantasy/tarot constraint: tarot symbolism as subtle physical motifs, practical props, light, and composition inside the scene; avoid generic fantasy costume, generic spellcasting, and occult spectacle',
];

const globalPromptRules = centerArtOnly ? centerArtPromptRules : fullCardPromptRules;

const quillsExtraAvoid = 'For Quills: conflict must be symbolic; no wounds, blood, ropes, nooses, or gore.';

const pipCounts = {
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

const rankNames = {
  Ace: 'Ace',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  '10': 'Ten',
};

function countElementLabel(element) {
  return String(element ?? '')
    .replace(/^(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+/i, '')
    .trim();
}

function displayRank(card, data) {
  return rankNames[card.rank] ?? data.courtNaming?.[card.rank] ?? card.rank;
}

function displayTitle(card, data, suit) {
  return `${displayRank(card, data)} of ${suit.suitName}`;
}

function makePrompt({ suit, card, artRow }) {
  const styleDirection = artRow?.styleDirection ?? card.streetwear.join(', ');
  const description = artRow?.description ?? card.description;
  const palette = Array.isArray(card.palette) ? card.palette.join(', ') : '';
  const streetwear = Array.isArray(card.streetwear) ? card.streetwear.join(', ') : '';
  const designTitle = card.gameName ?? card.name ?? card.tarot;
  const inCardTitle = card.displayTitle;
  const pipCount = pipCounts[card.rank];
  const numberSymbolism = card.numberSymbolism;
  const repairDirective = card.repairDirective;
  const countElement = numberSymbolism?.element ?? suit.countElement;
  const visibleCountElement = countElementLabel(countElement) || countElement;
  const tarotCountLine = pipCount
    ? `Tarot count requirement: visibly include exactly ${pipCount} ${visibleCountElement} for the ${inCardTitle} pip count. Use this single count-element type only; do not substitute a different suit object, mix alternate objects, add lookalike extras, use unreadable numbers, use border motifs, or pad the count with extra birds. Before accepting the image, count the visible pip elements one by one; if the count is not exactly ${pipCount}, reject and reroll.`
    : `Tarot role requirement: express the ${inCardTitle} court role through posture, clothing silhouette, scene authority, and unmistakable ${suit.suitName} suit identity rather than numbered icons.`;
  const pipRepresentationLine = pipCount
    ? `Pip representation: ${numberSymbolism.visualRequirement} Count element: ${numberSymbolism.element}. Meaning: ${numberSymbolism.represents}.`
    : null;

  const lines = [
    ...globalPromptRules,
    centerArtOnly
      ? `Primary request: Create the center illustration layer for the Bird Squad Minor Arcana card "${inCardTitle}" featuring an anatomically correct ${card.bird}. The locked SVG overlay will add the border and title later.`
      : `Primary request: Create the Bird Squad Minor Arcana card "${inCardTitle}" featuring an anatomically correct ${card.bird}.`,
    centerArtOnly
      ? `Design name for prompt context only, not visible text: "${designTitle}".`
      : `Design name for prompt context only, not in-card title text: "${designTitle}".`,
    `Suit / crew: ${suit.label}. ${suit.suitStyle}.`,
    `Suit isolation: this card may use only ${suit.suitName} suit language and motifs. Do not import other suit motifs such as ${suit.forbiddenMotifs}.`,
    centerArtOnly
      ? `Suit overlay reference: final border inserts will use ${suit.borderMotif}; do not draw border medallions, rails, cartouches, suit labels, rank symbols, or frame ornament in the center art.`
      : `Suit border inserts: ${suit.borderMotif}; keep these motifs inside the fixed medallions, side-rail insets, top crest, or fine filigree only; do not let suit motifs change the shared border geometry.`,
    `Scene/backdrop: ${description}`,
    `Subject species lock: ${card.bird} only; no other bird species on this card, no mixed flock, no hybrid bird anatomy, and no repeated species from another card. If the card describes multiple birds, every bird must be ${card.bird} and the total bird count must match the card description exactly; otherwise use one primary ${card.bird} and no background birds. Subject: ${card.bird}; ${card.pose}`,
    tarotCountLine,
    ...(pipRepresentationLine ? [pipRepresentationLine] : []),
    ...(repairDirective
      ? [
          `Card-specific repair directive: ${repairDirective}`,
          `Card-specific reject gate: reject this candidate before saving if it repeats the known failure for ${card.id}: wrong suit read, wrong pip count, count elements cropped or covered by the future overlay, subject head/feet/tail pushed into the future border, realistic/non-pixel art style, extra bird species, extra birds beyond the described scene, pasted count objects, magical/electrical effects, arm/hand anatomy, humanoid clothing silhouettes, extra wings, or countable lookalike clutter.`,
        ]
      : []),
    ...(pipCount
      ? [
          'Natural count integration: the count elements must be part of the bird-led scene and must stay fully inside the overlay-safe center after final compositing: carried, worn, guarded, clipped to working objects, reflected in water or glass, built into urban infrastructure, or produced by the bird\'s posture, call, wingbeat, plumage, or movement. Do not glue count objects into empty space as decorative symbols. Do not place count elements near the future border, side rails, top medallion, corner medallions, or title cartouche. Do not add extra pips as background clutter, clothing trim, border ornament, lights, tags, feathers, vessels, or reflections that could be counted.',
        ]
      : []),
    `Bird-originated action: show "${card.coreMeaning}" as an action, emotion, or pressure created by ${card.bird} through body language, movement, call, plumage, gaze, or species behavior; do not make an external prop, antenna, loose feather, border motif, or background light look like the source of the effect.`,
    `Style direction: ${styleDirection}`,
    `Streetwear adaptation from production data: ${streetwear}`,
    `Wardrobe individuality: give this ${card.bird} a distinct outfit silhouette and accessory mix within ${suit.suitName}; do not reuse the same jacket, hood, harness, mask, or uniform shape from neighboring cards in the suit.`,
    `Pose energy and silhouette: ${card.poseEnergy}; ${card.silhouetteClass}`,
    `Color palette: ${palette}; accent ${card.accent}`,
    `Card meaning / gameplay feel: ${card.coreMeaning}; ${card.gameplayFantasy}`,
    centerArtOnly
      ? 'Text handling for this layer: no readable title text, no cartouche text, no clothing text, no signage text, no logos, no pseudo-writing. The compositor owns all readable final text.'
      : `Text (verbatim): "${inCardTitle}" only in the bottom title cartouche.`,
    `Avoid: human anatomy, hands, fingers, wing-hands, wing tips acting like fingers, wing-arms, sleeve-arms, sleeve shapes that read as arms, human arms, human shoulders, human face, human legs, three-legged birds, extra wings, duplicate wings, extra limbs, humanoid bird bodies, realistic painting, semi-realistic illustration, smooth digital painting, photographic realism, readable clothing text, readable logos, readable slogans, readable crew names, brand names, pseudo-writing, mixed bird species, unrelated background bird species, wrong-suit scene reads, overcounted pips, undercounted pips, ambiguous pip counts, cropped pip elements, pip elements hidden under the future border, subject head cut off by the future border, suit motif bleed from other suits, repeated outfit uniforms, pasted-on pip icons, loose rows of count props, ${centerArtOnly ? 'any generated card border, any title cartouche, any medallions, any side rails, any rank text, any suit text, ' : ''}mismatched card borders, cream/light simplified borders, gang uniforms, gang signs, weapon display, gore, watermark, extra text, blurred pixel art, medieval fantasy, old-world market, castle, temple, tavern, wizard robe, fantasy cloak costume, futuristic sci-fi, holograms, cybernetic armor, floating UI, magical particles, sparkles, glowing motes, aura clouds, spell circles, floating runes, particle swirls, generic spellcasting, floating magic icons with no physical source.${suit.key === 'quills' ? ` ${quillsExtraAvoid}` : ''}`,
  ];

  return lines.join('\n');
}

const promptSets = [];

for (const suit of suitFiles) {
  const data = readJson(suit.file);
  const cards = data.cards.map((card) => {
    const designTitle = card.gameName ?? card.name ?? card.tarot;
    const inCardTitle = displayTitle(card, data, suit);
    const artRow = styleRows.get(designTitle);
    const promptCard = { ...card, displayTitle: inCardTitle };
    return {
      id: card.id,
      suit: suit.label,
      card: inCardTitle,
      designName: designTitle,
      bird: card.bird,
      rarity: card.rarity,
      rank: card.rank,
      acceptance: {
        exactSpecies: card.bird,
        pipCount: pipCounts[card.rank] ?? null,
        pipElement: card.numberSymbolism?.element ?? null,
        visualRequirement: card.numberSymbolism?.visualRequirement ?? null,
        hardRejects: [
          'wrong suit read',
          'mixed bird species',
          'arms, hands, fingers, wing-hands, extra legs, or extra wings',
          'overcounted, undercounted, or ambiguous pips',
          'pasted pip icons or loose prop rows',
          'magical particles or technology-sourced action',
          'generated border or readable text in center art',
          ...(card.repairDirective ? ['card-specific repair directive not satisfied'] : []),
        ],
        repairDirective: card.repairDirective ?? null,
      },
      prompt: makePrompt({ suit, card: promptCard, artRow }),
      source: {
        dataFile: suit.file,
        artBible: 'docs/art/art-bible.md',
      },
    };
  });

  promptSets.push({
    suit: suit.label,
    sourceFile: suit.file,
    count: cards.length,
    cards,
  });
}

const output = {
  version: '0.1',
  project: 'Bird Squad',
  purpose: centerArtOnly
    ? 'Minor Arcana center-art-only regeneration prompt pack for border-first compositing'
    : 'Minor Arcana image regeneration prompt pack',
  mode: centerArtOnly ? 'center-art-only' : 'full-card',
  generatedFrom: [
    'docs/art/art-bible.md',
    ...suitFiles.map((suit) => suit.file),
  ],
  totalCards: promptSets.reduce((sum, suit) => sum + suit.cards.length, 0),
  promptRules: globalPromptRules,
  suits: promptSets,
};

const promptBaseName = centerArtOnly ? 'minor-arcana-center-art-prompts' : 'minor-arcana-prompts';
const briefsDirName = centerArtOnly ? 'subagent-center-art-briefs' : 'subagent-briefs';

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, `${promptBaseName}.json`),
  `${JSON.stringify(output, null, 2)}\n`,
);

const markdown = [
  centerArtOnly
    ? '# Minor Arcana Center-Art Regeneration Prompt Pack'
    : '# Minor Arcana Regeneration Prompt Pack',
  '',
  'Generated from `docs/art/art-bible.md` and `data/cards/arcana/*.json`.',
  centerArtOnly
    ? 'Mode: center art only. Locked overlays add borders and title text later.'
    : 'Mode: full card prompt pack.',
  '',
  `Total cards: ${output.totalCards}`,
  '',
  ...promptSets.flatMap((suit) => [
    `## ${suit.suit}`,
    '',
    ...suit.cards.flatMap((card) => [
      `### ${card.card} - ${card.designName} - ${card.bird}`,
      '',
      '```text',
      card.prompt,
      '```',
      '',
    ]),
  ]),
].join('\n');

fs.writeFileSync(path.join(outDir, `${promptBaseName}.md`), `${markdown}\n`);

const briefsDir = path.join(outDir, briefsDirName);
fs.mkdirSync(briefsDir, { recursive: true });

for (const suit of promptSets) {
  const key = suit.suit.split(' / ')[0].toLowerCase();
  const brief = [
    `# ${suit.suit} Minor Arcana Generation Brief`,
    '',
    centerArtOnly
      ? 'Generated from the canonical Minor Arcana center-art prompt pack.'
      : 'Generated from the canonical Minor Arcana prompt pack.',
    '',
    '## Shared Requirements',
    '',
    centerArtOnly
      ? '- Generate center art only. Do not generate borders, title cartouches, medallions, side rails, rank labels, suit labels, or readable title text.'
      : '- Use the formal rank-and-suit display title as the only readable in-card title text.',
    centerArtOnly
      ? '- The deterministic overlay/compositing pipeline owns all final readable title text.'
      : '- Do not use the Bird Squad game/design name as the readable card title.',
    '- Birds must remain anatomically birds: no human torso, arms, hands, fingers, human face, human legs, or humanoid posture.',
    '- Wings are wings, not arms or hands. Do not pose wing tips as fingers, palms, sleeves, elbows, forearms, or human-like graspers.',
    '- Depict only the named bird species for the card. Do not add other bird species, mixed flocks, hybrid traits, or background birds from another species.',
    '- If a card describes multiple birds, every bird must be the named species and the total visible bird count must match the description exactly. Otherwise use one primary bird and no background birds.',
    '- Birds have exactly two legs and exactly two wings. Do not generate three-legged birds, extra wings, duplicate wings, wing-arms, or extra limbs.',
    '- Any actively held prop must be held only by beak, talons, feet, or legs. Harnesses and satchels may carry passive attachments, but must never look like hands or gripping fingers.',
    '- Pip cards must satisfy their tarot number through the exact count and meaning specified in their Pip representation line, using one count-element type only, not through extra bird species, unreadable numerals, pasted icons, floating tokens, or loose rows of props.',
    '- Before saving any Ace-Ten candidate, count the visible pip elements one by one. Reject overcounts, undercounts, ambiguous counts, mixed count-object types, hidden pips, or extra background objects that could be counted.',
    '- Pip elements must feel naturally integrated into the scene: carried, worn, built, guarded, reflected, clipped to working equipment, arranged by the bird, or produced by bird behavior.',
    '- Do not bleed suit motifs across suits; use only the current suit language, setting, props, and border inserts. If a candidate reads as another suit, reject it before compositing.',
    '- Each card needs an individualized outfit silhouette inside its suit theme; avoid matching uniforms across the suit.',
    '- The card action must originate from the bird through species behavior, posture, movement, voice, plumage, gaze, flight, guarding, gathering, carrying, or nurturing. Props and scenery only support that action.',
    centerArtOnly
      ? '- Leave clean visual margins for the locked SVG overlay; keep the bird, action, and important pips inside the central image window.'
      : '- Use the exact accepted locked border template on every card: same outer margin, dark keyline, gilded inner rail, corner medallions, side rails, top medallion, central image window, and bottom title cartouche.',
    centerArtOnly
      ? '- Reject center art with generated borders, cartouches, medallions, title text, rank text, suit text, or other frame remnants.'
      : '- Reject borders that look lighter, simpler, cream-card, newly drawn, mismatched, or from a different deck.',
    centerArtOnly
      ? '- Suit motifs belong in the scene only when they support the card action; final border motifs are supplied by the overlay.'
      : '- Suit motifs belong only inside fixed border insets and must not change frame thickness, cartouche height, cartouche baseline, medallion placement, side-rail placement, crop, or border silhouette.',
    '- Use the splash reference direction from `assets/splash/bird-squad-bold-streetwear-splash-v3.png`: grounded modern bird-city streetwear, utility harnesses, hoodies, rain shells, beanies, pouches, straps, rooftops, canals, repair markets, crates, antennas, HVAC units, cables, concrete, wet pavement, and neon signage.',
    '- Avoid old-world fantasy, medieval markets, castles, temples, taverns, parchment shops, wizard robes, generic fantasy costume, and Renaissance fair craft staging.',
    '- Avoid futuristic sci-fi, hologram UI, spaceship panels, cybernetic armor, robotic accessories, floating screens, and cyberpunk tech overload.',
    '- Avoid magical particles, sparkles, glowing motes, aura clouds, spell circles, floating runes, particle swirls, generic energy bursts, fireworks, electric arcs, antenna flashes, holograms, LED-tech beams, and spellcasting. Keep all effects grounded in bird behavior, clothing, props, signage, reflections, motion, and weather.',
    '- Streetwear must adapt to bird anatomy and represent urban culture, not gang affiliation.',
    '- No readable clothing text, slogans, brand marks, crew names, pseudo-writing, gang uniforms, gang signs, or territory marks.',
    '',
    '## Production Prompts',
    '',
    ...suit.cards.flatMap((card) => [
      `### ${card.card} - ${card.designName}`,
      '',
      '```text',
      card.prompt,
      '```',
      '',
    ]),
  ].join('\n');

  fs.writeFileSync(path.join(briefsDir, `${key}-series-brief.md`), `${brief}\n`);
}

console.log(`Wrote ${output.totalCards} prompts to docs/art/prompt-packs/${promptBaseName}.json`);
console.log(`Wrote markdown prompts to docs/art/prompt-packs/${promptBaseName}.md`);
console.log(`Wrote suit briefs to docs/art/prompt-packs/${briefsDirName}/*.md`);
