#!/usr/bin/env node
/**
 * Force scratch-gui's SB3Downloader to ignore window.showSaveFilePicker.
 *
 * Without this, modern Chrome/Edge show "Save as..." in the File menu that
 * writes the .sb3 directly via the File System Access API, completely
 * bypassing `downloadBlob` — and therefore bypassing our postMessage hook
 * that triggers 1-click submit. Result: student saves but LMS never sees it.
 *
 * The patch null-ifies the defaultProp on SB3Downloader so every "Save"
 * action falls back to downloadProject() → downloadBlob() → postMessage.
 *
 * Idempotent. Run after build:scratch-gui (already wired into that script).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BUNDLES = ['editor.js', 'embed.js', 'fullscreen.js', 'player.js'].map((f) =>
  resolve(ROOT, 'public', 'scratch-gui', 'js', f)
);

const MARK = '/* LUMIBACH_NO_SAVEFILEPICKER */';
const OLD =
  "showSaveFilePicker: typeof showSaveFilePicker === 'function' && !navigator.userAgent.includes('Android') ? window.showSaveFilePicker.bind(window) : null";
const NEW = `showSaveFilePicker: ${MARK} null`;

let touched = 0;
for (const file of BUNDLES) {
  if (!existsSync(file)) continue;
  let c = readFileSync(file, 'utf8');
  if (c.includes(MARK)) {
    console.log('  ✓ ' + file.split(/[\\/]/).pop() + ' already patched');
    continue;
  }
  if (!c.includes(OLD)) {
    console.log(
      '  - ' + file.split(/[\\/]/).pop() + ' (no SB3Downloader.defaultProps — ok to skip)'
    );
    continue;
  }
  c = c.replaceAll(OLD, NEW);
  writeFileSync(file, c, 'utf8');
  console.log('  ✓ patched ' + file.split(/[\\/]/).pop());
  touched++;
}

if (touched === 0) console.log('  (nothing changed)');
