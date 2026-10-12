#!/usr/bin/env node
/*
 * Sanity check for the bilingual copy (no dependencies):
 *   node tools/check-i18n.js
 * - every data-i18n* key used in the HTML exists in BOTH languages
 * - both languages define the same keys
 * - the English default text in index.html matches the English dictionary
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
global.window = {};
eval(fs.readFileSync(path.join(root, 'assets/js/i18n-data.js'), 'utf8'));
const D = window.NEKIO_I18N;
let problems = 0;
const bad = (m) => { problems++; console.log('✗', m); };

const enKeys = Object.keys(D.en), huKeys = Object.keys(D.hu);
enKeys.filter(k => !(k in D.hu)).forEach(k => bad(`missing in HU: ${k}`));
huKeys.filter(k => !(k in D.en)).forEach(k => bad(`missing in EN: ${k}`));

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const norm = s => decode(s).replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ').trim();

for (const file of ['index.html', 'privacy.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const keys = new Set();
  // data-i18n="key"  (text)   and  data-i18n-html="key"
  const re = /<([a-z0-9]+)\b[^>]*?\bdata-i18n(-html)?="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, , isHtml, key, inner] = m;
    keys.add(key);
    if (!(key in D.en)) { bad(`${file}: unknown key ${key}`); continue; }
    if (!isHtml && !/<[a-z]/i.test(inner) && norm(inner) !== norm(D.en[key])) {
      bad(`${file}: default text for "${key}" differs from EN dictionary\n    html: ${norm(inner)}\n    dict: ${norm(D.en[key])}`);
    }
  }
  const attr = /data-i18n-attr="([^"]+)"/g;
  while ((m = attr.exec(html))) m[1].split(';').forEach(p => { const k = p.split(':')[1]; if (k && !(k.trim() in D.en)) bad(`${file}: unknown attr key ${k}`); });
  console.log(`${file}: ${keys.size} keys checked`);
}
console.log(problems ? `\n${problems} problem(s)` : `\nOK — ${enKeys.length} keys, EN and HU in sync`);
process.exit(problems ? 1 : 0);
