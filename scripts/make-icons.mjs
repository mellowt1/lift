// Renders app/icons/icon.svg to the PNG sizes iOS and Android want.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('../../kitchen/node_modules/playwright'); }
const svg = await readFile(new URL('../app/icons/icon.svg', import.meta.url), 'utf8');
const b = await pw.chromium.launch();
for (const [size, square] of [[180, true], [192, false], [512, false]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  // iOS rounds the corners itself, so its icon is a full square.
  const art = square ? svg.replace('rx="112"', 'rx="0"') : svg;
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`);
  await p.screenshot({ path: `app/icons/icon-${size}.png`, omitBackground: true });
}
await b.close();
