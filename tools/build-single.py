#!/usr/bin/env python3
"""Inline index.html + src/* into one self-contained file: dist/azzurri-arcade.html

Use it to publish the game as a Claude artifact (one file, no external scripts) or to
drop a single file on any static host. Usage:  python3 tools/build-single.py
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')

def inline_css(m):
    return '<style>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</style>'

def inline_js(m):
    code = (root / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + code.replace('</script', '<\\/script') + '</script>'

html = re.sub(r'<link rel="stylesheet" href="(src/[^"]+)">', inline_css, html)
html = re.sub(r'<script src="(src/[^"]+)"></script>', inline_js, html)

out = root / 'dist' / 'azzurri-arcade.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'wrote {out.relative_to(root)} ({out.stat().st_size // 1024} KB)')
