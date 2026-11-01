// Builds js/vendor/three.js: three.js (MIT, https://threejs.org) plus its OrbitControls, as one minified ES module,
// so the game runs straight from the repo with no build step. Usage: npm install, then node tools/vendor.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
const ver = JSON.parse(fs.readFileSync('node_modules/three/package.json', 'utf8')).version;
await build({
  stdin: { contents: "export * from 'three';\nexport { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';\n", resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: 'js/vendor/three.js', legalComments: 'none',
  banner: { js: `// three.js ${ver} (https://threejs.org), MIT License: see THREE-LICENSE beside this file.
` },
});
console.log('wrote js/vendor/three.js', (fs.statSync('js/vendor/three.js').size / 1024).toFixed(0), 'KB');
