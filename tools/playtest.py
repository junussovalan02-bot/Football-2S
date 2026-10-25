#!/usr/bin/env python3
"""Automated playtest: serves the game, plays a short scripted match in headless Chromium
at phone sizes, saves screenshots and a sprite sheet, and reports JS errors.

    pip install playwright && python3 -m playwright install chromium   # once
    python3 tools/playtest.py                 # -> playtest/*.png, exit code 1 on JS errors

It injects a debug handle (window.__azz) into a temporary copy of the game, so src/ stays clean.
"""
import asyncio, base64, functools, http.server, pathlib, shutil, sys, tempfile, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'playtest'
HOOK = ("\nwindow.__azz = { game, get players(){return players}, ball, fury, setWeather, startMatch, emote, getSprite,"
        " EMO, BALLSPR, TEAMS, get W(){return W}, H, P, cam, superFor, electrocute, knockDown, ST };\n")

def make_site():
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='azz-'))
    for name in ('index.html', 'src'):
        src = ROOT / name
        (shutil.copytree if src.is_dir() else shutil.copy)(src, tmp / name)
    g = tmp / 'src' / 'game.js'
    code = g.read_text(encoding='utf-8'); i = code.rfind('})();')
    g.write_text(code[:i] + HOOK + code[i:], encoding='utf-8')
    return tmp

def serve(directory, port):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=str(directory))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

CANVAS = """() => { const c=document.getElementById('cv'), o=document.createElement('canvas'); o.width=c.width*3; o.height=c.height*3;
  const g=o.getContext('2d'); g.imageSmoothingEnabled=false; g.drawImage(c,0,0,o.width,o.height); return o.toDataURL('image/png'); }"""

async def save_canvas(pg, name):
    data = await pg.evaluate(CANVAS)
    (OUT / name).write_bytes(base64.b64decode(data.split(',')[1]))

async def run(url):
    from playwright.async_api import async_playwright
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for label, vp in (('landscape', {'width': 844, 'height': 390}), ('portrait', {'width': 390, 'height': 844})):
            ctx = await b.new_context(viewport=vp, has_touch=True, is_mobile=True, device_scale_factor=2)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'{label}: {e}'))
            await pg.goto(url); await pg.wait_for_timeout(800)
            await pg.screenshot(path=str(OUT / f'{label}-menu.png'))
            await pg.tap('#miPlay'); await pg.tap('#mi22'); await pg.wait_for_timeout(400)
            await pg.evaluate("__azz.setWeather('rain')")
            for key in ('ArrowRight', 'ArrowUp', 'ArrowRight', 'ArrowDown'):
                await pg.keyboard.down(key); await pg.wait_for_timeout(600); await pg.keyboard.up(key)
            await pg.screenshot(path=str(OUT / f'{label}-match.png'))
            await pg.evaluate("__azz.game.fury[0] = 100")
            await pg.keyboard.down('ArrowRight'); await pg.keyboard.down('j'); await pg.wait_for_timeout(700)
            await pg.keyboard.up('j'); await pg.wait_for_timeout(300); await pg.keyboard.up('ArrowRight')
            await save_canvas(pg, f'{label}-super.png')
            await pg.wait_for_timeout(8000)        # let the AI play a bit
            await save_canvas(pg, f'{label}-after-10s.png')
            await ctx.close()
        await b.close()
    return errors

def main():
    OUT.mkdir(exist_ok=True)
    site = make_site(); httpd = serve(site, 8799)
    try:
        errors = asyncio.run(run('http://127.0.0.1:8799/'))
    finally:
        httpd.shutdown(); shutil.rmtree(site, ignore_errors=True)
    print(f'screenshots in {OUT.relative_to(ROOT)}/')
    if errors:
        print('JS ERRORS:'); [print('  ' + e) for e in errors]; sys.exit(1)
    print('no JS errors')

if __name__ == '__main__':
    main()
