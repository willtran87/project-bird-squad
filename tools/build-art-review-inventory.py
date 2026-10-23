"""Inventory exact delivered raster art and produce reproducible review sheets.

Matches the production bytes to repository exports; an inventory is not an
artistic approval. Source overrides are explicit, versioned provenance.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path):
    return path.relative_to(ROOT).as_posix()


def family(path):
    parts = path.parts
    if 'runtime' in parts:
        return parts[parts.index('runtime') + 1]
    return 'title'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    selected = {}
    for name, key in [('cards/card-art-manifest.json', 'cards'), ('enemies/enemy-art-manifest.json', 'enemies')]:
        for row in json.loads((ROOT / 'assets/runtime' / name).read_text())[key]:
            for tier in ['portrait', 'thumbnail', 'icon', 'full']:
                if row.get(tier):
                    selected[row[tier]] = row['source']
    override_path = ROOT / 'docs/art/runtime-art-source-overrides.json'
    overrides = json.loads(override_path.read_text()) if override_path.exists() else {}
    pngs = list((ROOT / 'assets').rglob('*.png'))
    by_name = defaultdict(list)
    for file in pngs:
        by_name[file.name].append(file)
    exports = defaultdict(list)
    for file in (ROOT / 'assets').rglob('*'):
        if file.suffix.lower() in ['.webp', '.png', '.jpg', '.jpeg']:
            # PNG source tiers are not delivered, except explicit logo assets.
            if file.suffix.lower() == '.png' and '/assets/ui/' not in file.as_posix():
                continue
            exports[digest(file)].append(file)
    code = {relative(p): p.read_text(encoding='utf-8') for p in (ROOT / 'src').rglob('*')
            if p.suffix in ['.ts', '.css']}
    code['index.html'] = (ROOT / 'index.html').read_text(encoding='utf-8')
    patterns = []
    for owner, text in code.items():
        for token in re.findall(r"['\"]([^'\"\n]*assets/[^'\"\n]+\.(?:webp|png))['\"]", text):
            if '${' in token:
                continue
            base = ROOT / owner
            absolute = (base.parent / token).resolve() if token.startswith('.') else ROOT / token.lstrip('/')
            patterns.append((owner, absolute.as_posix()))
    from fnmatch import fnmatch
    entries, missing = [], []
    for delivered in sorted((args.build / 'assets').iterdir()):
        if delivered.suffix.lower() not in ['.webp', '.png', '.jpg', '.jpeg']:
            continue
        checksum = digest(delivered)
        matches = exports.get(checksum, [])
        if not matches:
            missing.append({'delivered': delivered.name, 'reason': 'no exact repository export'})
            continue
        # Identical sources are aliases, retained in the inventory.
        export = sorted(matches, key=lambda p: (not ('runtime' in p.parts), str(p)))[0]
        rel = relative(export)
        source_record = overrides.get(rel)
        source = (source_record.get('source') if isinstance(source_record, dict) else source_record) or selected.get(rel)
        if not source:
            candidates = []
            if '/thumb/' in rel:
                candidates.append(ROOT / rel.replace('/thumb/', '/icons/'))
            candidates += [export.with_suffix('.png')]
            if 'title-preload' in rel:
                candidates.append(export.parent.parent / (export.stem.replace('-title-preload', '') + '.png'))
            for ending in ['.png', '-source.png', '-scene-source.png', '-alpha-source.png']:
                candidates += by_name.get(export.stem + ending, [])
            found = list(dict.fromkeys(p for p in candidates if p.exists()))
            if found:
                source = relative(found[0])
        with Image.open(export) as im:
            rgba = im.convert('RGBA')
            alpha = rgba.getchannel('A')
            extrema = alpha.getextrema()
            bounds = alpha.getbbox()
            info = {'dimensions': list(im.size), 'alphaRange': list(extrema),
                    'visibleBounds': list(bounds) if bounds else None,
                    'transparentPixels': alpha.histogram()[0], 'bytes': export.stat().st_size}
        owners = sorted({owner for owner, pattern in patterns if any(fnmatch(p.as_posix(), pattern) for p in matches)})
        group = family(export)
        policies = {
            'cards': ('contained full canonical card; square icon unused', 'on-demand surface loader; bounded explicit retry'),
            'enemies': ('uniform fit of alpha bounds to combat slot', 'encounter essential art; fallback and retry'),
            'flock': ('uniform fit to leader slot', 'setup optional; battle essential'),
            'backdrops': ('cover stage; environment edges may crop', 'scene essential backdrop'),
            'route-events': ('scene plate cover; cutout uniform contain', 'route set-piece optional; stable fallback'),
            'market-kit': ('scene plate cover; resident/props uniform contain', 'Market optional; stable fallback'),
            'map-icons': ('uniform contain', 'route optional; node glyph fallback'),
            'fx': ('authored effect geometry; directional scaling allowed', 'lazy combat FX; reduced-motion budget'),
            'ui': ('role-specific contain/quiet replacement; see decorative-frame-inventory.md', 'title preload or surface lazy; vector fallback'),
            'supplies': ('uniform contain', 'surface lazy; label fallback'),
            'waymarks': ('uniform contain', 'surface lazy; label fallback'),
            'title': ('cover splash; contain logo', 'title essential'),
        }
        crop, load = policies[group]
        entry = {'export': rel, 'aliases': [relative(p) for p in matches], 'delivered': delivered.name,
                 'family': group, 'sha256': checksum, 'source': source, 'consumers': owners,
                 'sourceKind': source_record.get('kind', 'upstream raster') if isinstance(source_record, dict) else 'upstream raster',
                 'cropPolicy': crop, 'loadPolicy': load, **info}
        if source and (ROOT / source).exists():
            entry['sourceSha256'] = digest(ROOT / source)
            with Image.open(ROOT / source) as im:
                entry['sourceDimensions'] = list(im.size)
        else:
            missing.append({'export': rel, 'reason': 'source provenance missing', 'source': source})
        entries.append(entry)
    # Cards have their own 110-card, three-scale review. Other families use
    # dark/light backgrounds to expose matte, edge and compression problems.
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
    groups = defaultdict(list)
    for entry in entries:
        if entry['family'] != 'cards':
            groups[entry['family']].append(entry)
    for group, rows in groups.items():
        for start in range(0, len(rows), 12):
            batch = rows[start:start + 12]
            sheet = Image.new('RGB', (1440, 1080), '#101a26')
            draw = ImageDraw.Draw(sheet)
            for index, entry in enumerate(batch):
                x, y = (index % 4) * 360, (index // 4) * 360
                with Image.open(ROOT / entry['export']) as im:
                    art = ImageOps.contain(im.convert('RGBA'), (340, 290), Image.Resampling.LANCZOS)
                    tile = Image.new('RGBA', (340, 290), '#c0c4ca' if index % 2 else '#172330')
                    tile.alpha_composite(art, ((340-art.width)//2, (290-art.height)//2))
                    sheet.paste(tile.convert('RGB'), (x+10, y+6))
                label = Path(entry['export']).stem
                draw.text((x+10, y+301), label[:43], font=font, fill='#ffe1a3')
                if len(label)>43: draw.text((x+10, y+319), label[43:], font=font, fill='#ffe1a3')
                draw.text((x+10,y+339), f"{entry['dimensions']} / alpha {entry['alphaRange']}", font=font, fill='#dde6ee')
                entry['reviewSheet'] = f'{group}-{start//12+1:02d}.png'
                entry['reviewCell'] = index+1
            sheet.save(output / f'{group}-{start//12+1:02d}.png')
    result = {'schema': 1, 'build': str(args.build.resolve()), 'counts': dict(Counter(e['family'] for e in entries)),
              'assets': entries, 'unresolved': missing,
              'note': 'Exact byte inventory and alpha facts. Visual review and browser load evidence remain separate.'}
    (output/'inventory.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'counts': result['counts'], 'unresolved': missing}, indent=2))
    if missing: raise SystemExit(1)


if __name__ == '__main__':
    main()
