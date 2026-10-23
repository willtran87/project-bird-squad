"""Check immutable Major frames, exact Snag composition and all lossless card tiers."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from PIL import Image, ImageChops, ImageOps

ROOT=Path(__file__).resolve().parents[1]

def same(expected, actual, label, webp=False):
    if webp:
        # Lossless WebP may replace RGB under fully transparent pixels. Require
        # exact alpha and visible RGB; only those invisible RGB bytes are ignored.
        for image in (expected, actual):
            opaque=image.getchannel('A').point(lambda alpha: 255 if alpha else 0)
            image.paste((0,0,0,0),mask=ImageChops.invert(opaque))
    if expected.size != actual.size or ImageChops.difference(expected,actual).getbbox(alpha_only=False):
        raise ValueError(f'{label}: pixels differ')

def validate():
    cards=json.loads((ROOT/'assets/runtime/cards/card-art-manifest.json').read_text())['cards']
    by_id={c['cardId']:c for c in cards}
    frames=json.loads((ROOT/'assets/templates/major-arcana/manifest.json').read_text())['cards']
    if {c['cardId'] for c in frames}!={c['cardId'] for c in cards if c['cardId'].startswith('major_')}:
        raise ValueError('Major frame inventory does not cover the selected roster')
    for entry in frames:
        frame_path=ROOT/entry['frame']
        if hashlib.sha256(frame_path.read_bytes()).hexdigest()!=entry['sha256']:
            raise ValueError(f"{entry['cardId']}: immutable frame changed")
        with Image.open(frame_path).convert('RGBA') as frame,Image.open(ROOT/by_id[entry['cardId']]['source']).convert('RGBA') as master:
            expected=master.copy()
            expected.paste((0,0,0,0),tuple(entry['opening']))
            same(frame,expected,entry['cardId']+' locked frame/title')
            # Exact recomposition demonstrates the approved frame is independent
            # of the editable illustration opening, including antialiased edges.
            center=Image.new('RGBA',master.size)
            center.paste(master.crop(tuple(entry['opening'])),tuple(entry['opening'][:2]))
            same(Image.alpha_composite(center,frame),master,entry['cardId']+' recomposition')
    spec=importlib.util.spec_from_file_location('snag_compose',ROOT/'tools/compose-snag-cards.py')
    snag=importlib.util.module_from_spec(spec);spec.loader.exec_module(snag)
    snag.TITLE_FONT_PATH=snag.resolve_title_font(None)
    if not snag.TITLE_FONT_PATH: raise ValueError('Required Snag title font missing')
    with tempfile.TemporaryDirectory(prefix='bird-card-validation-') as td:
        for card in snag.snag_cards():
            source=snag.find_source(ROOT/'assets/concept-art/snag-cards/sources',card['id'])
            if not source: raise ValueError(f"{card['id']}: no separate center artwork")
            target=Path(td)/(card['id']+'.png')
            snag.compose_card(source,target,ROOT/'assets/templates/snag-card/snag-border.png',card['displayName'])
            with Image.open(target).convert('RGBA') as expected,Image.open(ROOT/by_id[card['id']]['source']).convert('RGBA') as actual:
                same(expected,actual,card['id']+' deterministic Snag composition')
    for card in cards:
        with Image.open(ROOT/card['source']).convert('RGBA') as source:
            for field,size in [('portrait',(512,768)),('thumbnail',(184,276))]:
                expected=ImageOps.contain(source,size,Image.Resampling.LANCZOS)
                with Image.open(ROOT/card[field]).convert('RGBA') as actual:
                    same(expected,actual,card['cardId']+' '+field,webp=True)
    print(f"Validated {len(frames)} locked Major frames/titles, {len(snag.snag_cards())} Snag compositions and {len(cards)*2} lossless card exports.")

if __name__=='__main__':
    validate()
