"""Import a small, CRC-verified subset of Kenney Particle Pack (CC0).

HTTP ranges avoid downloading the Unity package and unused black-background set.
Source URL was resolved from https://kenney.nl/assets/particle-pack.
"""
import io
import struct
import urllib.request
import zlib
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw

URL = 'https://kenney.nl/media/pages/assets/particle-pack/f8fe0f8cb8-1677578741/kenney_particle-pack.zip'
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/resources/art/fx/kenney'
SELECTED = ['circle_01', 'circle_03', 'smoke_03', 'smoke_06', 'spark_07', 'star_04', 'slash_03', 'trace_01']


def prepare(im):
    # Remove nearly invisible padding so effect size corresponds to visible pixels.
    bounds = im.getchannel('A').point(lambda a: 255 if a >= 18 else 0).getbbox()
    if bounds:
        im = im.crop(bounds)
    im.thumbnail((128, 128), Image.Resampling.LANCZOS)
    square = Image.new('RGBA', (128, 128))
    square.alpha_composite(im, ((128 - im.width) // 2, (128 - im.height) // 2))
    return square


def fetch_range(start, end):
    req = urllib.request.Request(URL, headers={'Range': f'bytes={start}-{end}'})
    with urllib.request.urlopen(req, timeout=55) as response:
        if response.status != 206:
            raise RuntimeError('Server must support range downloads')
        data = response.read()
    if len(data) != end - start + 1:
        raise RuntimeError('Incomplete range')
    return data


def main():
    # EOCD size is 22 bytes for this archive; obtain it independently of archive size.
    req = urllib.request.Request(URL, headers={'Range': 'bytes=-22'})
    with urllib.request.urlopen(req, timeout=20) as response:
        tail = response.read()
    signature, _, _, _, _, size, offset, comment = struct.unpack('<4s4H2IH', tail)
    if signature != b'PK\x05\x06' or comment:
        raise RuntimeError('Unsupported archive footer')
    central = fetch_range(offset, offset + size - 1)
    entries = {}
    pos = 0
    while pos < len(central):
        v = struct.unpack_from('<4s6H3I5H2I', central, pos)
        name = central[pos + 46:pos + 46 + v[10]].decode()
        entries[name] = (v[4], v[7], v[8], v[9], v[16])
        pos += 46 + v[10] + v[11] + v[12]

    def extract(name):
        method, crc, compressed, expanded, start = entries[name]
        # Local header + UTF8 name, then compressed content; no extra field in this pack.
        header = fetch_range(start, start + 29)
        fields = struct.unpack('<4s5H3I2H', header)
        data_start = start + 30 + fields[9] + fields[10]
        data = fetch_range(data_start, data_start + compressed - 1)
        raw = zlib.decompress(data, -15) if method == 8 else data
        if len(raw) != expanded or zlib.crc32(raw) & 0xffffffff != crc:
            raise RuntimeError('CRC mismatch: ' + name)
        return name, raw

    names = [f'PNG (Transparent)/{name}.png' for name in SELECTED] + ['License.txt']
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name, raw in pool.map(extract, names):
            if name.endswith('.png'):
                im = Image.open(io.BytesIO(raw)).convert('RGBA')
                prepare(im).save(DEST / Path(name).name)
            else:
                path = ROOT / 'third-party/kenney-particle-pack/License.txt'
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
            print(name, 'CRC OK', flush=True)
    sheet = Image.new('RGB', (640, 320), '#343e2e')
    for i, name in enumerate(SELECTED):
        im = Image.open(DEST / (name + '.png'))
        x, y = (i % 4) * 160, (i // 4) * 160
        sheet.paste(im, (x + 16, y), im)
        ImageDraw.Draw(sheet).text((x + 8, y + 135), name, fill='white')
    sheet.save('/tmp/fww-kenney-preview.png')


if __name__ == '__main__':
    if '--prepare-local' in sys.argv:
        for name in SELECTED:
            path = DEST / (name + '.png')
            im = Image.open(path).convert('RGBA')
            bounds = im.getchannel('A').point(lambda a: 255 if a >= 18 else 0).getbbox()
            if bounds:
                im = im.crop(bounds)
                im = im.resize((max(1, round(im.width * 128 / max(im.size))),
                                max(1, round(im.height * 128 / max(im.size)))), Image.Resampling.LANCZOS)
            prepare(im).save(path)
    else:
        main()
