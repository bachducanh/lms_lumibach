#!/usr/bin/env node
/** One-off: shim ElementType.Root onto domelementtype v1 in the built bundle. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(__dirname, '..', 'public', 'scratch-gui', 'js', 'vendors~editor~embed~fullscreen~player.js');

const oldDET = 'module.exports = {\n\tText: "text", //Text\n\tDirective: "directive", //<? ... ?>\n\tComment: "comment", //<!-- ... -->\n\tScript: "script", //<script> tags\n\tStyle: "style", //<style> tags\n\tTag: "tag", //Any tag\n\tCDATA: "cdata", //<![CDATA[ ... ]]>\n\tDoctype: "doctype",';

const MARK = '/* LUMIBACH_ELEMENTTYPE_PATCH */';
const newDET = MARK + ' module.exports = {\n\tText: "text",\n\tDirective: "directive",\n\tComment: "comment",\n\tScript: "script",\n\tStyle: "style",\n\tTag: "tag",\n\tCDATA: "cdata",\n\tDoctype: "doctype",\n\tRoot: "root",\n\tElementType: {Root:"root",Text:"text",Directive:"directive",Comment:"comment",Script:"script",Style:"style",Tag:"tag",CDATA:"cdata",Doctype:"doctype"},';

let c = readFileSync(TARGET, 'utf8');
if (c.includes(MARK)) { console.log('  ✓ already applied'); process.exit(0); }
if (!c.includes(oldDET)) { console.error('  ✗ pattern not found'); process.exit(1); }
c = c.replace(oldDET, newDET);
writeFileSync(TARGET, c, 'utf8');
console.log('  ✓ ElementType shim applied');
