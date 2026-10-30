// Complète les prononciations manquantes avec Piper, une synthèse vocale neuronale
// libre qui tourne hors ligne (https://github.com/OHF-Voice/piper1-gpl). Les
// enregistrements de vrais locuteurs ne sont jamais remplacés.
//
//   npm run audio            → éléments sans audio
//   npm run audio -- --force → réenregistrer toutes les voix Piper (après un changement de voix)
//
// Prérequis : python3 -m pip install piper-tts, et ffmpeg. La voix de chaque cours est
// dans courses/voices.json (liste : https://huggingface.co/rhasspy/piper-voices).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HUMAN, audioPath, itemsOf, loadCourses, normalizeToMp3, root, saveAudio, saveCourse, spokenText } from './audio-lib.mjs';

const force = process.argv.includes('--force');
const voices = JSON.parse(readFileSync(join(root, 'courses', 'voices.json'), 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'piper-'));

const entries = loadCourses();
const jobs = [];
for (const entry of entries) {
  const voice = voices[entry.id];
  if (!voice) {
    console.warn(`${entry.id} : pas de voix Piper dans courses/voices.json`);
    continue;
  }
  for (const item of itemsOf(entry.course)) {
    const source = entry.sources[item.id]?.source;
    if (HUMAN.has(source)) continue;
    if (source === 'piper' && !force && existsSync(join(entry.dir, audioPath(item)))) continue;
    jobs.push({ entry, item, voice, text: spokenText(item), out: join(tmp, `${item.id}.wav`) });
  }
}

if (jobs.length) {
  const input = JSON.stringify({ jobs: jobs.map(({ voice, text, out }) => ({ voice, text, out })) });
  execFileSync('python3', [join(root, 'scripts', 'piper_tts.py')], { input, stdio: ['pipe', 'inherit', 'inherit'] });
  for (const { entry, item, voice, out } of jobs) {
    saveAudio(entry, item, normalizeToMp3(out), { source: 'piper', voice });
  }
  for (const entry of entries) saveCourse(entry);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${jobs.length} voix Piper enregistrée(s).`);
