#!/usr/bin/env node
/**
 * Post-build patch for scratch-gui bundle.
 *
 * Fixes a webpack module-resolution bug introduced when building scratch-vm
 * (which depends on htmlparser2@3.10.0 / domhandler@2.4.2) under pnpm with
 * `shamefully-hoist=true`. Webpack ends up resolving the require to
 * `domhandler@5.0.3` (the ESM-namespace variant pulled in by enzyme/cheerio),
 * so the namespace object is returned where the v2 default class was expected.
 *
 *   var DomHandler = __webpack_require__('domhandler');
 *   new DomHandler(options);   // TypeError: DomHandler is not a constructor
 *
 * The fix unwraps the namespace to the class:
 *
 *   DomHandler = DomHandler.DomHandler || DomHandler.default || DomHandler;
 *
 * Without this, every Blockly workspace change throws — scratch-vm never
 * receives the new blocks, so green-flag clicks do nothing.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGET = resolve(ROOT, 'public', 'scratch-gui', 'js', 'vendors~editor~embed~fullscreen~player.js');

if (!existsSync(TARGET)) {
  console.error('  ✗ Bundle not found at ' + TARGET);
  console.error('    Run `pnpm build:scratch-gui` first.');
  process.exit(1);
}

const PATCH_MARKER = '/* LUMIBACH_DOMHANDLER_PATCH */';

// Patch 1: htmlparser2 v3 imported domhandler expecting CJS class, but webpack
// resolved it to domhandler v5 (ESM namespace). Unwrap to the class.
const oldDH = 'var DomHandler = __webpack_require__(/*! domhandler */ "./node_modules/domhandler/lib/esm/index.js");';
const newDH = oldDH + ' ' + PATCH_MARKER + ' DomHandler = DomHandler.DomHandler || DomHandler.default || DomHandler;';

// Patch 2: domhandler v5 needs `ElementType.Root` etc, but the bundle has
// domelementtype v1 which only exposes flat `Text`, `Directive`, ... constants.
// Shim the v3 namespace on top of the v1 module so domhandler v5 doesn't crash.
const oldDET = `module.exports = {
\tText: "text", //Text
\tDirective: "directive", //<? ... ?>
\tComment: "comment", //<!-- ... -->
\tScript: "script", //<script> tags
\tStyle: "style", //<style> tags
\tTag: "tag", //Any tag
\tCDATA: "cdata", //<![CDATA[ ... ]]>
\tDoctype: "doctype",`;

const newDET = `${PATCH_MARKER} module.exports = {
\tText: "text",
\tDirective: "directive",
\tComment: "comment",
\tScript: "script",
\tStyle: "style",
\tTag: "tag",
\tCDATA: "cdata",
\tDoctype: "doctype",
\tRoot: "root",
\tElementType: {
\t\tRoot: "root", Text: "text", Directive: "directive", Comment: "comment",
\t\tScript: "script", Style: "style", Tag: "tag", CDATA: "cdata", Doctype: "doctype",
\t},`;

let c = readFileSync(TARGET, 'utf8');

if (c.includes(PATCH_MARKER)) {
  console.log('  ✓ Bundle patches already applied');
  process.exit(0);
}

let missing = [];
if (!c.includes(oldDH)) missing.push('DomHandler require pattern');
if (!c.includes(oldDET)) missing.push('domelementtype module-exports pattern');
if (missing.length) {
  console.error('  ✗ Expected pattern(s) not found in bundle: ' + missing.join(', '));
  console.error('    The bundle structure may have changed. Inspect ' + TARGET + '.');
  process.exit(1);
}

c = c.replace(oldDH, newDH).replace(oldDET, newDET);
writeFileSync(TARGET, c, 'utf8');
console.log('  ✓ Patched DomHandler + ElementType in ' + TARGET);
