// Builds dist/super-orbital-simulator.html: the whole prototype as one self-contained file (inline CSS and JS).
// Usage: node tools/bundle.mjs   (needs `npm install` for esbuild)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = await build({ entryPoints: [path.join(root, 'js/main.js')], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="js/main.js"></script>', () => `<script>\n${js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'super-orbital-simulator.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
