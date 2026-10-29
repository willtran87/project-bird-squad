"""Package the approved v2 atlas without altering its pixels or alpha geometry."""
from pathlib import Path
from PIL import Image

source = Path('assets/concept-art/flock-leaders/living-battles-atlas-v2.png')
target = Path('assets/runtime/flock/performances/living-battles-atlas-v2.webp')
image = Image.open(source).convert('RGBA')
assert image.size == (1145, 1374)
image.save(target, 'WEBP', quality=80, method=6)
assert target.stat().st_size <= 575 * 1024
print(f'{target}: {target.stat().st_size} bytes, {image.size}, RGBA')
