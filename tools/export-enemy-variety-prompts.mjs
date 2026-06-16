import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'data/game/enemy-variety-contracts.json');
const outPath = path.join(root, '.generated/imagegen/enemies/reserve-prompts/enemy-variety-prompts.json');
const checkOnly = process.argv.includes('--check');

const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const errors = [];
const required = [
  'id',
  'name',
  'species',
  'district',
  'role',
  'typeHint',
  'varietyContribution',
  'description',
  'visualBrief',
  'silhouette',
  'artPose',
  'moveKit',
];
const validTypeHints = new Set(['normal', 'rival', 'elite', 'boss']);
const validDistricts = new Set(['Rooftop Blocks', 'Canal Markets', 'Signal Spires', 'High Roost']);
const bannedVisualTerms = [
  'humanoid',
  'human arms',
  'human hands',
  'human posture',
  'robot',
  'hologram',
  'spell',
  'magic',
  'wizard',
  'armor suit',
];

const fail = (message) => errors.push(message);

if (!Array.isArray(data.reserveEnemies) || data.reserveEnemies.length === 0) {
  fail('reserveEnemies must be a nonempty array');
}

const ids = new Set();
for (const enemy of data.reserveEnemies ?? []) {
  const label = enemy?.id ?? '<missing id>';
  for (const field of required) {
    if (enemy[field] === undefined) fail(`${label}: missing ${field}`);
  }
  if (typeof enemy.id !== 'string' || !/^[a-z0-9_]+$/.test(enemy.id)) fail(`${label}: id must be snake_case`);
  if (ids.has(enemy.id)) fail(`${label}: duplicate id`);
  ids.add(enemy.id);
  if (!validTypeHints.has(enemy.typeHint)) fail(`${label}: invalid typeHint "${enemy.typeHint}"`);
  if (!validDistricts.has(enemy.district)) fail(`${label}: invalid district "${enemy.district}"`);
  for (const field of ['name', 'species', 'role', 'varietyContribution', 'description', 'visualBrief', 'silhouette', 'artPose']) {
    if (typeof enemy[field] !== 'string' || enemy[field].trim().length < 4) fail(`${label}: ${field} must be a useful string`);
  }
  if (!Array.isArray(enemy.moveKit) || enemy.moveKit.length < 3) fail(`${label}: moveKit must include at least three hooks`);
  for (const term of bannedVisualTerms) {
    if ((enemy.visualBrief ?? '').toLowerCase().includes(term)) {
      fail(`${label}: visualBrief contains banned drift term "${term}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Enemy variety contract validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const fashionFor = (enemy) => data.fashionDirections?.[enemy.id] ?? enemy.visualBrief;

const promptFor = (enemy) => `Use case: stylized-concept
Asset type: individual transparent enemy combat cutout concept
Primary request: High-resolution pixel art enemy concept for Bird Squad. ${enemy.name}, ${enemy.description}
Scene/backdrop: no illustrated scene background. Put the single enemy on a perfectly flat solid #00ff00 chroma-key background for removal. No floor plane, no horizon, no skyline, no wall, no props behind the character, no shadow, no scenery.
Subject: Anatomically grounded ${enemy.species}. Role: ${enemy.role}. Variety contribution: ${enemy.varietyContribution}
Style/medium: high-resolution pixel art only, crisp pixel clusters, deliberate dithering, polished game-art quality, readable combat silhouette, stylish present-day bird-city streetwear. Reject realistic painting, semi-realistic illustration, smooth digital painting, photographic rendering, or soft airbrush realism.
Composition/framing: one individual full-body enemy only, centered with generous padding, front-facing 3/4 dramatic idle cutout pose, on the ground or naturally resting on the ground; not a sheet, not a grid, not a lineup.
Pose/framing: ${enemy.artPose}
Clothing/accessories: ${fashionFor(enemy)}
Silhouette: ${enemy.silhouette}
Gameplay read: ${enemy.moveKit.join(' ')}
Wardrobe individuality: make this enemy's outfit silhouette and accessory mix distinct; do not default to a generic belt, waist belt, utility belt, identical harness, repeated black tactical straps, or one-size-fits-all gear. Use the named fashion direction above as the primary clothing design.
Grounding constraints: enemy must be on the ground or naturally resting on the ground, weight supported by species-appropriate paws, talons, webbed feet, claws, body coil, shell, or legs. Not floating, not flying, not hanging, not perched on a visible prop, not lunging out of frame.
Anatomy constraints: non-humanoid animal anatomy; clothing adapts to the animal body; props and clothing do not impair movement or alter anatomy; full natural species silhouette remains readable.
Chroma-key constraints: background must be one uniform #00ff00 color with no shadows, gradients, texture, reflections, floor plane, or lighting variation; do not use #00ff00 anywhere in the subject.
Avoid: contact sheet, grid, labels, title text, environment background, city background, floor plane, cast shadow, contact shadow, secondary enemies, flock, crew, formation, pair, trio, clustered group, generic belt, waist belt, repeated utility belt, human torso, human arms, human hands, fingers, human face, human legs, upright human posture, sleeves that imply arms, shoulder pads, readable text, readable logos, brand marks, gang signs, weapon display, gore, magic particles, aura clouds, spell circles, floating runes, sci-fi armor, cybernetic parts, holograms, fantasy costume, watermark.`;

const prompts = {
  version: data.version,
  project: data.project,
  basedOn: [
    'docs/art/enemy-art-bible.md',
    'data/game/enemy-variety-contracts.json',
  ],
  prompts: data.reserveEnemies.map((enemy) => ({
    enemyId: enemy.id,
    name: enemy.name,
    typeHint: enemy.typeHint,
    district: enemy.district,
    role: enemy.role,
    prompt: promptFor(enemy),
  })),
};

if (!checkOnly) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(prompts, null, 2)}\n`, 'utf8');
  console.log(`Exported ${prompts.prompts.length} enemy variety prompts.`);
  console.log(path.relative(root, outPath).replaceAll(path.sep, '/'));
} else {
  console.log(`Enemy variety contracts validated: ${data.reserveEnemies.length} enemies.`);
}
