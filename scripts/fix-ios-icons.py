#!/usr/bin/env python3
"""Regenerate the iOS app icons with NO alpha channel.

App Store Connect hard-rejects any app icon that contains an alpha channel
(even a fully-opaque one). `tauri icon` always emits RGBA PNGs, so after
regenerating we flatten every AppIcon PNG onto opaque white and drop the alpha
channel. `src-tauri/gen/` is gitignored/regenerated, so re-run this whenever the
iOS project is re-initialized or the source icon changes.

Usage:  python3 scripts/fix-ios-icons.py [source_png]
        (defaults to src-tauri/icons/icon.png)
"""
import glob
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "src-tauri/icons/icon.png")
APPICON = os.path.join(ROOT, "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset")


def main() -> int:
    from PIL import Image

    # 1. Build an opaque, 1024px source (marketing-icon size, no alpha).
    src = Image.open(SRC).convert("RGBA")
    if src.size[0] < 1024:
        src = src.resize((1024, 1024), Image.LANCZOS)
    flat = Image.new("RGB", src.size, (255, 255, 255))
    flat.paste(src, mask=src.split()[3])
    opaque = os.path.join(ROOT, "src-tauri/icons/.icon-opaque-1024.png")
    flat.save(opaque, "PNG")

    # 2. Regenerate the whole icon set from the opaque source.
    subprocess.run(["bunx", "tauri", "icon", opaque, "--ios-color", "#ffffff"],
                   cwd=ROOT, check=True)

    # 3. tauri re-adds an alpha channel — strip it from every iOS AppIcon PNG.
    n = 0
    for f in glob.glob(os.path.join(APPICON, "*.png")):
        im = Image.open(f).convert("RGBA")
        rgb = Image.new("RGB", im.size, (255, 255, 255))
        rgb.paste(im, mask=im.split()[3])
        rgb.save(f, "PNG")
        n += 1
    os.remove(opaque)
    print(f"Stripped alpha from {n} iOS AppIcon PNGs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
