import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outRoot = path.join(root, 'assets/templates/minor-arcana/card-overlays');
const manifestPath = path.join(outRoot, 'overlay-manifest.json');

const canvas = {
  width: 1024,
  height: 1536,
};

const geometry = {
  outer: { x: 32, y: 32, width: 960, height: 1472, rx: 28 },
  inner: { x: 58, y: 58, width: 908, height: 1420, rx: 22 },
  imageWindow: { x: 104, y: 164, width: 816, height: 1098 },
  titleCartouche: { x: 154, y: 1310, width: 716, height: 112, rx: 32 },
  topMedallion: { cx: 512, cy: 92, r: 46 },
  cornerMedallions: [
    { cx: 88, cy: 88, r: 38 },
    { cx: 936, cy: 88, r: 38 },
    { cx: 88, cy: 1448, r: 38 },
    { cx: 936, cy: 1448, r: 38 },
  ],
  sideRails: [
    { x: 60, y: 176, width: 46, height: 1090, rx: 18 },
    { x: 918, y: 176, width: 46, height: 1090, rx: 18 },
  ],
};

const suits = [
  {
    key: 'plumes',
    suitName: 'Plumes',
    file: 'data/cards/arcana/minor-arcana-wands.json',
    colors: {
      accent: '#d58235',
      accent2: '#b84d77',
      enamel: '#3c2440',
    },
    motif: plumeMotif,
  },
  {
    key: 'basins',
    suitName: 'Basins',
    file: 'data/cards/arcana/minor-arcana-cups.json',
    colors: {
      accent: '#4aa7a5',
      accent2: '#8fb9d3',
      enamel: '#17384a',
    },
    motif: basinMotif,
  },
  {
    key: 'quills',
    suitName: 'Quills',
    file: 'data/cards/arcana/minor-arcana-swords.json',
    colors: {
      accent: '#8bb7d7',
      accent2: '#d6e5ee',
      enamel: '#1b2b3d',
    },
    motif: quillMotif,
  },
  {
    key: 'nests',
    suitName: 'Nests',
    file: 'data/cards/arcana/minor-arcana-pentacles.json',
    colors: {
      accent: '#c89b4f',
      accent2: '#7f9a66',
      enamel: '#352c1f',
    },
    motif: nestMotif,
  },
];

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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function displayRank(card, data) {
  return rankNames[card.rank] ?? data.courtNaming?.[card.rank] ?? card.rank;
}

function displayTitle(card, data, suitName) {
  return `${displayRank(card, data)} of ${suitName}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function titleFontSize(title) {
  if (title.length > 22) return 39;
  if (title.length > 18) return 42;
  return 46;
}

function rect({ x, y, width, height, rx }, attrs = '') {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx ?? 0}" ${attrs}/>`;
}

function circle({ cx, cy, r }, attrs = '') {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`;
}

function plumeMotif(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M0 34 C26 12 34 -18 8 -42 C38 -26 50 2 28 32 C16 48 2 54 -18 56 C-8 48 -2 42 0 34Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M2 34 C10 16 14 0 8 -38" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M8 6 L30 -2 M6 18 L22 22 M2 30 L18 38" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function basinMotif(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-34 -8 C-24 34 24 34 34 -8Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-42 -8 C-18 -18 18 -18 42 -8" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M-20 12 C-6 4 6 4 20 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function quillMotif(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-30 42 C12 28 38 -10 26 -42 C-8 -34 -30 -2 -30 42Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-28 40 C-8 12 8 -10 24 -40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M-10 14 L-28 10 M2 -4 L-18 -10 M12 -20 L-4 -28" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function nestMotif(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-38 8 C-24 38 24 38 38 8 C20 20 -20 20 -38 8Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-34 4 C-12 -10 12 -10 34 4 M-28 14 C-8 2 8 2 28 14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <circle cx="-11" cy="4" r="5" fill="currentColor"/><circle cx="11" cy="4" r="5" fill="currentColor"/>
  </g>`;
}

function buildOverlay({ suit, card, data }) {
  const title = displayTitle(card, data, suit.suitName);
  const fontSize = titleFontSize(title);
  const c = suit.colors;
  const motifs = [
    suit.motif(512, 92, 0.48),
    ...geometry.cornerMedallions.map((m) => suit.motif(m.cx, m.cy, 0.34)),
    suit.motif(83, 370, 0.25),
    suit.motif(83, 640, 0.25),
    suit.motif(83, 910, 0.25),
    suit.motif(941, 370, 0.25),
    suit.motif(941, 640, 0.25),
    suit.motif(941, 910, 0.25),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" fill="none">
  <title>${escapeXml(title)} locked Bird Squad Minor Arcana overlay</title>
  <defs>
    <linearGradient id="goldRail" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f0d58b"/>
      <stop offset="0.42" stop-color="#a96f2b"/>
      <stop offset="0.72" stop-color="#f7e7ad"/>
      <stop offset="1" stop-color="#6f421a"/>
    </linearGradient>
    <linearGradient id="suitAccent" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${c.accent2}"/>
      <stop offset="1" stop-color="${c.accent}"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000814" flood-opacity="0.72"/>
    </filter>
    <style>
      .panelFill { fill: #0c1020; }
      .enamel { fill: ${c.enamel}; }
      .goldStroke { stroke: url(#goldRail); }
      .suitStroke { stroke: url(#suitAccent); }
      .fine { stroke-width: 3; }
      .medium { stroke-width: 7; }
      .heavy { stroke-width: 14; }
      .motif { color: ${c.accent}; }
    </style>
  </defs>

  ${rect(geometry.outer, 'fill="none" stroke="#060913" stroke-width="30" filter="url(#softShadow)"')}
  ${rect(geometry.inner, 'fill="none" class="goldStroke heavy"')}
  ${rect({ x: 76, y: 76, width: 872, height: 1384, rx: 18 }, 'fill="none" class="suitStroke fine" opacity="0.85"')}
  ${geometry.sideRails.map((rail) => rect(rail, 'class="panelFill goldStroke medium"')).join('\n  ')}
  ${geometry.cornerMedallions.map((m) => circle(m, 'class="enamel goldStroke medium"')).join('\n  ')}
  ${circle(geometry.topMedallion, 'class="enamel goldStroke medium"')}
  ${rect(geometry.titleCartouche, 'fill="#e8d6ab" class="goldStroke medium" filter="url(#softShadow)"')}
  ${rect({ x: geometry.titleCartouche.x + 20, y: geometry.titleCartouche.y + 18, width: geometry.titleCartouche.width - 40, height: geometry.titleCartouche.height - 36, rx: 22 }, 'fill="none" stroke="#68451e" stroke-width="3" opacity="0.78"')}
  <g class="motif">
    ${motifs}
  </g>
  <text x="512" y="1378" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" fill="#241606" letter-spacing="0">${escapeXml(title)}</text>
  <text x="512" y="1410" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="18" fill="#68451e" opacity="0.55" letter-spacing="0">${escapeXml(suit.suitName.toUpperCase())}</text>
</svg>
`;
}

const manifest = {
  version: '0.1',
  generatedBy: 'tools/generate-minor-card-overlays.mjs',
  purpose: 'Deterministic border-and-title overlays for border-first Minor Arcana generation.',
  canvas,
  geometry,
  rules: [
    'The center illustration must stay inside imageWindow.',
    'The SVG overlay owns the border, medallions, side rails, title cartouche, and readable title text.',
    'The image model should not generate card borders or title text.',
  ],
  cards: [],
};

fs.mkdirSync(outRoot, { recursive: true });

for (const suit of suits) {
  const data = readJson(suit.file);
  const suitOut = path.join(outRoot, suit.key);
  fs.mkdirSync(suitOut, { recursive: true });

  for (const card of data.cards) {
    const title = displayTitle(card, data, suit.suitName);
    const relativeOutput = path
      .join('assets/templates/minor-arcana/card-overlays', suit.key, `${card.id}.svg`)
      .replaceAll('\\', '/');
    const output = path.join(root, relativeOutput);
    fs.writeFileSync(output, buildOverlay({ suit, card, data }));

    manifest.cards.push({
      cardId: card.id,
      suit: suit.suitName,
      title,
      overlay: relativeOutput,
      sourceData: suit.file,
    });
  }
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifest.cards.length} Minor Arcana overlays in ${path.relative(root, outRoot)}`);
console.log(`Wrote ${path.relative(root, manifestPath)}`);
