#!/usr/bin/env python3
"""Build the runtime UI web fonts.

Sources are the SIL OFL 1.1 "latin" subsets published by Fontsource
(@fontsource/barlow and @fontsource/fraunces). The only change is to the
vertical metrics: each face adopts the ascent/descent of the system face it
replaces (Arial for UI text, Georgia for display text), so authored 1280x720
layouts keep their measured line heights. Glyph outlines and advance widths
are untouched, except that tabular figures become the default
digits where the face provides them.

Usage:
  python tools/build-ui-fonts.py <dir containing the extracted fontsource packages>

Requires: fonttools, brotli.
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'fonts' / 'ui'

# (source file, output file, ascent, descent) in em units.
ARIAL = (0.905, 0.212)
GEORGIA = (0.917, 0.219)
FACES = [
    ('fontsource-barlow/package/files/barlow-latin-500-normal.woff2', 'bird-squad-ui-regular.woff2', ARIAL),
    ('fontsource-barlow/package/files/barlow-latin-700-normal.woff2', 'bird-squad-ui-bold.woff2', ARIAL),
    ('fontsource-fraunces/package/files/fraunces-latin-400-normal.woff2', 'bird-squad-display-regular.woff2', GEORGIA),
    ('fontsource-fraunces/package/files/fraunces-latin-700-normal.woff2', 'bird-squad-display-bold.woff2', GEORGIA),
    ('fontsource-fraunces/package/files/fraunces-latin-400-italic.woff2', 'bird-squad-display-italic.woff2', GEORGIA),
]


def freeze_tabular_figures(font: TTFont) -> None:
    """Make tabular figures the default digits.

    Canvas text cannot request OpenType features, so counters and costs would
    otherwise jitter as proportional digits change. Faces without a `tnum`
    feature are left as they are.
    """
    gsub = font.get('GSUB')
    if gsub is None:
        return
    mapping = {}
    for record in gsub.table.FeatureList.FeatureRecord:
        if record.FeatureTag != 'tnum':
            continue
        for index in record.Feature.LookupListIndex:
            for subtable in gsub.table.LookupList.Lookup[index].SubTable:
                mapping.update(getattr(subtable, 'mapping', {}))
    if not mapping:
        return
    for table in font['cmap'].tables:
        for codepoint in range(0x30, 0x3A):
            glyph = table.cmap.get(codepoint)
            if glyph in mapping:
                table.cmap[codepoint] = mapping[glyph]


def build(source_root: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for source, output, (ascent, descent) in FACES:
        font = TTFont(source_root / source)
        units = font['head'].unitsPerEm
        up, down = round(ascent * units), round(descent * units)
        hhea, os2 = font['hhea'], font['OS/2']
        hhea.ascent, hhea.descent, hhea.lineGap = up, -down, 0
        os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = up, -down, 0
        os2.usWinAscent, os2.usWinDescent = up, down
        freeze_tabular_figures(font)
        font.flavor = 'woff2'
        font.save(OUT / output)
        print(f'{output}: {(OUT / output).stat().st_size} bytes')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(Path(sys.argv[1]))
