#!/usr/bin/env node
/* Dino Giungla — build: concatenate src/*.js into one standalone index.html.
   No bundler, no deps. `node build.js` */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = __dirname;
const srcDir = path.join(root, 'src');

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
if (!files.length) { console.error('no sources in src/'); process.exit(1); }

const js = files
  .map((f) => `\n/* ==================== ${f} ==================== */\n` + fs.readFileSync(path.join(srcDir, f), 'utf8').trim() + '\n')
  .join('\n');

// Fail loudly on a syntax error in any module before writing anything.
try {
  new vm.Script(js, { filename: 'bundle.js' });
} catch (e) {
  console.error('\n[BUILD FAILED] syntax error in bundle:\n' + e.message + '\n');
  process.exit(1);
}

const css = read('style.css');
const body = read('body.html');
const shell = read('shell.html');

// String replacements must use functions: `$` sequences in code are special in .replace().
const html = shell
  .replace('/*STYLE*/', () => css)
  .replace('<!--BODY-->', () => body)
  .replace('/*SCRIPT*/', () => js);

fs.writeFileSync(path.join(root, 'index.html'), html);

// Service worker: cache name keyed to content so a deploy busts the old cache.
// The template counts too — changing only the caching strategy still has to
// invalidate what the old strategy put there.
const swTpl = read('sw.template.js');
const hash = crypto.createHash('sha1').update(html).update(swTpl).digest('hex').slice(0, 10);
const sw = swTpl.replace('__VERSION__', () => hash);
fs.writeFileSync(path.join(root, 'sw.js'), sw);

// A syntax error here would only show up on a device, and only offline.
try {
  new vm.Script(sw, { filename: 'sw.js' });
} catch (e) {
  console.error('\n[BUILD FAILED] syntax error in sw.js:\n' + e.message + '\n');
  process.exit(1);
}

// Body-only variant (for embedding where <html>/<head>/<body> are supplied).
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'dist', 'embed.html'),
  `<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`
);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' kB';
console.log(`built index.html  ${kb(html)}  (${files.length} modules, sw ${hash})`);
files.forEach((f) => console.log('   · ' + f));
