// Complète les prononciations manquantes avec Piper, une synthèse vocale neuronale
// libre qui tourne hors ligne (https://github.com/OHF-Voice/piper1-gpl). Les
// enregistrements de vrais locuteurs ne sont jamais remplacés.
//
//   npm run audio            → éléments sans audio, ou dont le texte ou la voix a changé
//   npm run audio -- --force → réenregistrer toutes les voix Piper (après un changement de voix)
//
// Prérequis : python3 -m pip install piper-tts, et ffmpeg. Les voix de chaque cours sont
// dans courses/voices.json (liste : https://huggingface.co/rhasspy/piper-voices) : une
// voix féminine et, si possible, une masculine pour les dialogues. Les éléments isolés
// prennent la voix féminine, les répliques celle de leur personnage.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HUMAN, audioPath, itemsOf, linesOf, loadCourses, normalizeToMp3, root, saveAudio, saveCourse, spokenText } from './audio-lib.mjs';

const force = process.argv.includes('--force');
const voices = JSON.parse(readFileSync(join(root, 'courses', 'voices.json'), 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'piper-'));

const entries = loadCourses();
const jobs = [];
for (const entry of entries) {
  const { female, male } = voices[entry.id] ?? {};
  if (!female && !male) {
    console.warn(`${entry.id} : pas de voix Piper dans courses/voices.json`);
    continue;
  }
  const voiceOf = (role) => (role === 'male' ? male : female) ?? female ?? male;
  const todo = [
    ...itemsOf(entry.course).map((item) => ({ item, voice: voiceOf('female') })),
    ...linesOf(entry.course).map((line) => ({ item: line, voice: voiceOf(line.voice) })),
  ];
  for (const { item, voice } of todo) {
    const known = entry.sources[item.id];
    const text = spokenText(item);
    if (HUMAN.has(known?.source)) continue;
    // Déjà enregistré avec la même voix et le même texte : rien à refaire.
    const upToDate = known?.source === 'piper' && known.voice === voice && known.text === text;
    if (upToDate && !force && existsSync(join(entry.dir, audioPath(item)))) continue;
    jobs.push({ entry, item, voice, text, out: join(tmp, `${item.id}.wav`) });
  }
}

if (jobs.length) {
  const input = JSON.stringify({ jobs: jobs.map(({ voice, text, out }) => ({ voice, text, out })) });
  execFileSync('python3', [join(root, 'scripts', 'piper_tts.py')], { input, stdio: ['pipe', 'inherit', 'inherit'] });
  for (const { entry, item, voice, text, out } of jobs) {
    saveAudio(entry, item, normalizeToMp3(out), { source: 'piper', voice, text });
  }
  for (const entry of entries) saveCourse(entry);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${jobs.length} voix Piper enregistrée(s).`);
