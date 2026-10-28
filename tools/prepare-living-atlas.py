"""Package the approved generated atlas; preserve dimensions and alpha."""
from pathlib import Path
from PIL import Image

source = Path('assets/concept-art/flock-leaders/living-battles-atlas-v1.png')
target = Path('assets/runtime/flock/performances/living-battles-atlas-v1.webp')
image = Image.open(source).convert('RGBA')
assert image.size == (1402, 1122)
target.parent.mkdir(parents=True, exist_ok=True)
image.save(target, 'WEBP', quality=90, method=6)
print(f'{target}: {target.stat().st_size} bytes, {image.size}, RGBA')
