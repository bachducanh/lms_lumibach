#!/usr/bin/env node
/**
 * Build script for self-hosted scratch-gui (TurboWarp fork).
 *
 * What it does:
 *   1. Clones TurboWarp/scratch-gui to external/scratch-gui/ (if missing)
 *   2. Runs `npm install` in that directory
 *   3. Applies our patch (adds postMessage save handler)
 *   4. Runs `npm run build` with publicPath=/scratch-gui/
 *   5. Copies the output to public/scratch-gui/
 *
 * Run with:  pnpm build:scratch-gui
 *
 * Requirements:  Node 18+, git, ~5 GB free disk (for node_modules during build)
 *
 * On Windows: ensure long path support is enabled (`git config --system core.longpaths true`)
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const SOURCE    = resolve(ROOT, 'external', 'scratch-gui');
const OUTPUT    = resolve(ROOT, 'public', 'scratch-gui');

// Pin to a known-good commit. Update when we want a newer Scratch version.
// As of Apr 2025, TurboWarp's scratch-gui develop branch builds cleanly on Node 18-20.
const REPO_URL = 'https://github.com/TurboWarp/scratch-gui.git';
const REPO_REF = 'develop';

function step(title) {
  console.log('\n\x1b[36m▶\x1b[0m \x1b[1m' + title + '\x1b[0m');
}

function ok(msg) { console.log('  \x1b[32m✓\x1b[0m ' + msg); }
function warn(msg) { console.log('  \x1b[33m!\x1b[0m ' + msg); }
function fail(msg) { console.error('  \x1b[31m✗\x1b[0m ' + msg); process.exit(1); }

function run(cmd, cwd) {
  console.log('  $ ' + cmd + (cwd ? '  (in ' + cwd + ')' : ''));
  const result = spawnSync(cmd, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) fail('Command failed: ' + cmd);
}

// ── Step 1: clone or update scratch-gui ──────────────────────

step('1/5  Sync scratch-gui source');
if (!existsSync(SOURCE)) {
  mkdirSync(dirname(SOURCE), { recursive: true });
  run('git clone --depth 1 -b ' + REPO_REF + ' ' + REPO_URL + ' "' + SOURCE + '"');
  ok('Cloned ' + REPO_URL + ' (' + REPO_REF + ')');
} else {
  warn('Already cloned — pulling latest');
  run('git pull --ff-only', SOURCE);
}

// ── Step 2: install deps ─────────────────────────────────────

step('2/5  Install dependencies (this can take 5–10 minutes)');
if (!existsSync(resolve(SOURCE, 'node_modules'))) {
  run('npm install --legacy-peer-deps', SOURCE);
} else {
  warn('node_modules exists — skipping install (delete to reinstall)');
}
ok('Dependencies ready');

// ── Step 3: apply our patch (LMS postMessage save) ───────────

step('3/5  Apply LMS patch');
const PATCH_MARKER = '/* LUMIBACH_LMS_POSTMESSAGE_PATCH */';

// `downloadBlob` is the central function in scratch-gui that triggers a download.
// All save-related code paths (save sb3, export sprite, export costume, export
// sound, etc) eventually call it. Patching here means we capture every save with
// a single-point modification.
const DOWNLOAD_BLOB_CANDIDATES = [
  resolve(SOURCE, 'src', 'lib', 'download-blob.js'),
  resolve(SOURCE, 'src', 'lib', 'download-blob.ts'),
];
const target = DOWNLOAD_BLOB_CANDIDATES.find((p) => existsSync(p));

if (!target) {
  warn('No download-blob.js found in expected paths — skipping patch.');
  warn('Build will produce stock scratch-gui without 1-click submit.');
  warn('Inspect ' + resolve(SOURCE, 'src', 'lib') + ' to locate the save helper.');
} else {
  const original = readFileSync(target, 'utf8');
  if (original.includes(PATCH_MARKER)) {
    ok('Patch already applied');
  } else if (!/export\s+default\s+/.test(original)) {
    warn(target + ' has no `export default` — skipping patch.');
  } else {
    // The patch strategy is bulletproof regardless of export shape
    // (`export default function() {}`, `export default (args) => {}`,
    //  `export default function name() {}`, etc):
    //
    //   1. Rename `export default <X>` to `const __lumibach_orig = <X>`
    //   2. Append a new default export that wraps the original.
    //
    // No regex matching of function bodies is required.
    const hook = `${PATCH_MARKER}
const __lumibach_postMessageSave = (filename, blob) => {
  try {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    if (typeof filename !== 'string' || !filename.toLowerCase().endsWith('.sb3')) return;
    Promise.resolve(blob && blob.arrayBuffer ? blob.arrayBuffer() : null).then((buf) => {
      if (!buf) return;
      window.parent.postMessage(
        { type: 'lumibach:scratch-save', filename: filename, sb3: buf },
        window.location.origin || '*',
      );
    });
  } catch (_) { /* ignore */ }
};
`;
    const renamed = original.replace(
      /export\s+default\s+/,
      'const __lumibach_orig_downloadBlob = ',
    );
    const wrapper = `

export default function (filename, blob) {
  __lumibach_postMessageSave(filename, blob);
  return __lumibach_orig_downloadBlob(filename, blob);
}
`;
    const patched = hook + renamed + wrapper;
    writeFileSync(target, patched, 'utf8');
    ok('Patched ' + target);
  }
}

// ── Step 3b: patch render-interface.jsx to allow same-origin iframe ──────────
// TurboWarp blocks iframe embedding by default with `isInvalidEmbed = window.parent !== window`.
// Since our LMS embeds via same-origin iframe, we relax the check to only block cross-origin.

const RENDER_INTERFACE = resolve(SOURCE, 'src', 'playground', 'render-interface.jsx');
const EMBED_PATCH_MARKER = '/* LUMIBACH_LMS_EMBED_PATCH';

if (existsSync(RENDER_INTERFACE)) {
  const ri = readFileSync(RENDER_INTERFACE, 'utf8');
  if (ri.includes(EMBED_PATCH_MARKER)) {
    ok('Embed-allow patch already applied');
  } else {
    const oldLine = 'const isInvalidEmbed = window.parent !== window;';
    const newLine = `${EMBED_PATCH_MARKER}: allow same-origin iframe embedding (LMS use case) */
const isInvalidEmbed = (() => {
  try {
    if (window.parent === window) return false;
    return window.parent.location.origin !== window.location.origin;
  } catch (_) {
    return true;
  }
})();`;
    if (ri.includes(oldLine)) {
      writeFileSync(RENDER_INTERFACE, ri.replace(oldLine, newLine), 'utf8');
      ok('Patched ' + RENDER_INTERFACE);
    } else {
      warn('isInvalidEmbed line not found in render-interface.jsx — skipping embed patch.');
    }
  }
}

// ── Step 4: prepublish (downloads microbit hex → generates src/generated/) ──

step('4a/5  Run prepublish (downloads microbit hex)');
if (existsSync(resolve(SOURCE, 'src', 'generated', 'microbit-hex-url.cjs'))) {
  ok('Generated files already present — skipping prepublish');
} else {
  const prep = spawnSync('node', ['scripts/prepublish.mjs'], {
    cwd: SOURCE, stdio: 'inherit', shell: true,
  });
  if (prep.status !== 0) fail('prepublish script failed');
  ok('Prepublish done');
}

// ── Step 4b: build with publicPath=/scratch-gui/ ─────────────

step('4b/5  Build static bundle');
// scratch-gui webpack reads ROOT (publicPath) from env vars.
const env = {
  ...process.env,
  STATIC_PATH: '/scratch-gui/static',
  ROOT: '/scratch-gui/',
  NODE_OPTIONS: (process.env.NODE_OPTIONS ?? '') + ' --max-old-space-size=8192',
};
const buildResult = spawnSync('npm', ['run', 'build'], {
  cwd: SOURCE, stdio: 'inherit', shell: true, env,
});
if (buildResult.status !== 0) fail('npm run build failed in scratch-gui');
ok('Build succeeded');

// ── Step 5: copy output ──────────────────────────────────────

step('5/5  Copy build output to public/scratch-gui/');
if (existsSync(OUTPUT)) rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });

// scratch-gui outputs to `build/` by default
const SOURCE_BUILD = resolve(SOURCE, 'build');
if (!existsSync(SOURCE_BUILD)) fail('Build output not found at ' + SOURCE_BUILD);
cpSync(SOURCE_BUILD, OUTPUT, { recursive: true });
ok('Copied to ' + OUTPUT);

// ── Step 6: post-build bundle patches ─────────────────────────
// scratch-vm pins htmlparser2@3.10.0 / domhandler@2.4.2 (CJS), but webpack
// resolves the require to domhandler@5 (ESM, pulled by enzyme/cheerio dev-deps).
// That mismatch crashes parseDOM the moment Blockly fires a workspace-change
// event, so blocks never reach the runtime and green-flag does nothing.
// Two surgical patches on the built bundle work around both halves:
//   (a) unwrap the ESM namespace to get the DomHandler class
//   (b) shim ElementType.Root / .Text / ... onto the v1 domelementtype module
// See scripts/patch-domhandler.mjs for the full rationale.

step('6/6  Apply DomHandler / ElementType bundle patches');
const bundlePath = resolve(OUTPUT, 'js', 'vendors~editor~embed~fullscreen~player.js');
if (!existsSync(bundlePath)) {
  warn('Bundle not found at ' + bundlePath + ' — skipping patches');
} else {
  let bundle = readFileSync(bundlePath, 'utf8');
  let touched = false;

  const DH_MARK = '/* LUMIBACH_DOMHANDLER_PATCH */';
  const DH_OLD  = 'var DomHandler = __webpack_require__(/*! domhandler */ "./node_modules/domhandler/lib/esm/index.js");';
  const DH_NEW  = `${DH_OLD} ${DH_MARK} DomHandler = DomHandler.DomHandler || DomHandler.default || DomHandler;`;
  if (bundle.includes(DH_MARK)) {
    ok('DomHandler patch already present');
  } else if (bundle.includes(DH_OLD)) {
    bundle = bundle.replace(DH_OLD, DH_NEW);
    touched = true;
    ok('DomHandler patch applied');
  } else {
    warn('DomHandler require pattern not found — skipping');
  }

  const ET_MARK = '/* LUMIBACH_ELEMENTTYPE_PATCH */';
  const ET_OLD  = 'module.exports = {\n\tText: "text", //Text\n\tDirective: "directive", //<? ... ?>\n\tComment: "comment", //<!-- ... -->\n\tScript: "script", //<script> tags\n\tStyle: "style", //<style> tags\n\tTag: "tag", //Any tag\n\tCDATA: "cdata", //<![CDATA[ ... ]]>\n\tDoctype: "doctype",';
  const ET_NEW  = `${ET_MARK} module.exports = {\n\tText: "text",\n\tDirective: "directive",\n\tComment: "comment",\n\tScript: "script",\n\tStyle: "style",\n\tTag: "tag",\n\tCDATA: "cdata",\n\tDoctype: "doctype",\n\tRoot: "root",\n\tElementType: {Root:"root",Text:"text",Directive:"directive",Comment:"comment",Script:"script",Style:"style",Tag:"tag",CDATA:"cdata",Doctype:"doctype"},`;
  if (bundle.includes(ET_MARK)) {
    ok('ElementType patch already present');
  } else if (bundle.includes(ET_OLD)) {
    bundle = bundle.replace(ET_OLD, ET_NEW);
    touched = true;
    ok('ElementType shim applied');
  } else {
    warn('domelementtype module-exports pattern not found — skipping');
  }

  if (touched) writeFileSync(bundlePath, bundle, 'utf8');
}

// ── Step 7: nullify showSaveFilePicker so 1-click submit works ────
// On Chrome/Edge, the menu otherwise shows "Save as..." that writes the .sb3
// directly via the File System Access API, bypassing downloadBlob and our
// postMessage hook — so the LMS never sees the save. Forcing it to null
// collapses the menu to a single "Save to your computer" that goes through
// downloadBlob → postMessage → 1-click submit.

step('7/7  Nullify showSaveFilePicker (route saves through downloadBlob hook)');
const SFP_MARK = '/* LUMIBACH_NO_SAVEFILEPICKER */';
const SFP_OLD = "showSaveFilePicker: typeof showSaveFilePicker === 'function' && !navigator.userAgent.includes('Android') ? window.showSaveFilePicker.bind(window) : null";
const SFP_NEW = `showSaveFilePicker: ${SFP_MARK} null`;
for (const name of ['editor.js', 'embed.js', 'fullscreen.js', 'player.js']) {
  const file = resolve(OUTPUT, 'js', name);
  if (!existsSync(file)) continue;
  let c = readFileSync(file, 'utf8');
  if (c.includes(SFP_MARK)) { ok(name + ' already patched'); continue; }
  if (!c.includes(SFP_OLD)) { warn(name + ' has no SB3Downloader.defaultProps — skipping'); continue; }
  writeFileSync(file, c.replaceAll(SFP_OLD, SFP_NEW), 'utf8');
  ok('Patched ' + name);
}

console.log('\n\x1b[32m✔  Done.\x1b[0m  Self-hosted scratch-gui is now available at /scratch-gui/');
console.log('   Test it: \x1b[36mhttp://localhost:3000/scratch-gui/\x1b[0m\n');
