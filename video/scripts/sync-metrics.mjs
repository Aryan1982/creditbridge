// Copies ../engine/models/model_card.json (written by the training pipeline) into video/public
// so the composition can fetch it via staticFile('model_card.json').
// If the file is absent, the video falls back to clearly-labelled placeholder metrics.
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../engine/models/model_card.json');
const destDir = resolve(here, '../public');
const dest = resolve(destDir, 'model_card.json');

if (existsSync(src)) {
  mkdirSync(destDir, {recursive: true});
  copyFileSync(src, dest);
  console.log(`[sync-metrics] copied ${src} -> ${dest}`);
} else {
  console.log(`[sync-metrics] ${src} not found; video will use placeholder metrics.`);
}
