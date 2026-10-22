"""Remove green-screen spill from the existing rock; retain original source."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
image = Image.open(root / 'assets/resources/art/fx/fx_boulder.png').convert('RGBA')
# The rock occupies this bounding box; painted ground shadow must not fly with it.
image = image.crop((18, 24, 78, 76))
pixels = []
for r, g, b, a in image.getdata():
    spill = max(0, g - max(r, b))
    if spill > 12:
        a = round(a * max(0, 1 - (spill - 12) / 32))
        g = min(g, max(r, b))
    pixels.append((r, g, b, a))
image.putdata(pixels)
canvas = Image.new('RGBA', (64, 64))
canvas.alpha_composite(image, (2, 6))
canvas.save(root / 'assets/resources/art/fx/boulder_clean.png')
