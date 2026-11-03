#!/bin/sh
set -eu

out="$(cd "$(dirname "$0")/.." && pwd)/icons/brawl"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
rm -rf "$out"
mkdir -p "$out/icon.icon/Assets"

slashes='<path d="M12.5 7 L17 7 L11.5 23 L7 23 Z" fill="#0B0B0D"/><path d="M19.5 7 L24 7 L18.5 23 L14 23 Z" fill="#0B0B0D"/>'

render() {
  printf '<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" viewBox="0 0 30 30" fill="none">%s</svg>' \
    "$1" "$1" "$3" >"$tmp/icon.svg"
  sips -s format png "$tmp/icon.svg" --out "$2" >/dev/null
}

tile() { render "$1" "$2" "<rect width=\"30\" height=\"30\" rx=\"8\" fill=\"#FF5A1F\"/>$slashes"; }
grid() { render "$1" "$2" "<g transform=\"translate(2.9297 2.9297) scale(0.8047)\"><rect width=\"30\" height=\"30\" rx=\"8\" fill=\"#FF5A1F\"/>$slashes</g>"; }
square() { render "$1" "$2" "<rect width=\"30\" height=\"30\" fill=\"#FF5A1F\"/>$slashes"; }

for size in 32 64 128 256 512; do tile "$size" "$out/${size}x${size}.png"; done
cp "$out/256x256.png" "$out/128x128@2x.png"
cp "$out/512x512.png" "$out/icon.png"

for size in 16 24 32 48 64 128 256; do tile "$size" "$tmp/ico-$size.png"; done
python3 - "$tmp" "$out/icon.ico" <<'PY'
import struct, sys
tmp, target = sys.argv[1], sys.argv[2]
images = [(size, open(f"{tmp}/ico-{size}.png", "rb").read()) for size in (16, 24, 32, 48, 64, 128, 256)]
offset = 6 + 16 * len(images)
header = struct.pack("<HHH", 0, 1, len(images))
entries = b""
for size, data in images:
    entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
    offset += len(data)
open(target, "wb").write(header + entries + b"".join(data for _, data in images))
PY

mkdir -p "$tmp/icon.iconset"
for size in 16 32 128 256 512; do
  grid "$size" "$tmp/icon.iconset/icon_${size}x${size}.png"
  grid "$((size * 2))" "$tmp/icon.iconset/icon_${size}x${size}@2x.png"
done
iconutil -c icns "$tmp/icon.iconset" -o "$out/icon.icns"
cp "$tmp/icon.iconset/icon_128x128@2x.png" "$out/dock.png"

square 1024 "$out/icon.icon/Assets/icon.png"
cat >"$out/icon.icon/icon.json" <<'JSON'
{
  "groups": [
    {
      "name": "Brawl Code",
      "layers": [
        {
          "name": "Brawl Code",
          "image-name": "icon.png",
          "glass": false
        }
      ],
      "shadow": {
        "kind": "none",
        "opacity": 0
      },
      "translucency": {
        "enabled": false,
        "value": 0.5
      }
    }
  ],
  "supported-platforms": {
    "squares": ["macOS"]
  }
}
JSON

echo "Brawl Code icons in $out"
