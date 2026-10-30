// Outils communs aux scripts d'enregistrement : parcours des cours, champ « audio »
// et registre des sources (courses/<cours>/audio/sources.json), qui garde pour chaque
// fichier son origine et, pour un enregistrement humain, son auteur et sa licence.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadCourses() {
  const index = JSON.parse(readFileSync(join(root, 'courses', 'index.json'), 'utf8'));
  return index.courses.map(({ id, path }) => {
    const file = join(root, 'courses', path);
    const dir = dirname(file);
    const sourcesFile = join(dir, 'audio', 'sources.json');
    return {
      id,
      file,
      dir,
      text: readFileSync(file, 'utf8'),
      course: JSON.parse(readFileSync(file, 'utf8')),
      sourcesFile,
      sources: existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')) : {},
    };
  });
}

export function itemsOf(course) {
  return course.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
}

export const audioPath = (item) => `audio/${item.id}.mp3`;

/** Enregistre le fichier d'un élément et note son origine. */
export function saveAudio(entry, item, bytes, source) {
  mkdirSync(join(entry.dir, 'audio'), { recursive: true });
  writeFileSync(join(entry.dir, audioPath(item)), bytes);
  entry.sources[item.id] = source;
  if (!item.audio) {
    // Les éléments tiennent sur une ligne : on ajoute le champ sans reformater le fichier.
    entry.text = entry.text.replace(`"id": "${item.id}", `, `"id": "${item.id}", "audio": "${audioPath(item)}", `);
    item.audio = audioPath(item);
  }
}

export function saveCourse(entry) {
  writeFileSync(entry.file, entry.text);
  if (Object.keys(entry.sources).length) {
    mkdirSync(dirname(entry.sourcesFile), { recursive: true });
    const sorted = Object.fromEntries(Object.entries(entry.sources).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(entry.sourcesFile, JSON.stringify(sorted, null, 2) + '\n');
  }
}

/** Texte prononcé : « say » s'il existe, la minuscule seule pour une lettre « А а », sans points de suspension. */
export function spokenText(item) {
  if (item.say) return item.say;
  if (item.kind === 'letter') return item.text.split(/\s+/).pop();
  return item.text.replace(/…/g, '').trim();
}

/** Sources enregistrées par de vrais locuteurs, jamais remplacées par une voix de synthèse. */
export const HUMAN = new Set(['lingualibre', 'commons']);

/** Fichier audio → MP3 mono, silences de début et de fin retirés, volume normalisé (ffmpeg). */
export function normalizeToMp3(input) {
  const output = `${input}.mp3`;
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-af', `${trim},areverse,${trim},areverse,loudnorm=I=-16:TP=-1.5`, '-ac', '1', '-ar', '24000', '-b:a', '64k', output]);
  return readFileSync(output);
}
