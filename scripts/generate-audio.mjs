// Complète les prononciations manquantes avec les voix neuronales de Google Cloud
// Text-to-Speech. Les enregistrements de vrais locuteurs (Lingua Libre) ne sont
// jamais remplacés.
//
//   GOOGLE_TTS_API_KEY=… npm run audio            → éléments sans audio
//   GOOGLE_TTS_API_KEY=… npm run audio -- --force → réenregistrer toutes les voix Google
//
// La voix de chaque cours est notée dans courses/voices.json : la modifier pour en changer.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { audioPath, itemsOf, loadCourses, root, saveAudio, saveCourse, spokenText } from './audio-lib.mjs';

const key = process.env.GOOGLE_TTS_API_KEY;
const force = process.argv.includes('--force');
const API = 'https://texttospeech.googleapis.com/v1';

if (!key) {
  console.error('GOOGLE_TTS_API_KEY manque (clé d’API Google Cloud avec Text-to-Speech activé).');
  process.exit(1);
}

// Codes de langue de Google : le mandarin est « cmn-CN », l'arabe standard « ar-XA ».
const GOOGLE_LANG = { 'en-GB': 'en-GB', 'ru-RU': 'ru-RU', 'zh-CN': 'cmn-CN', 'ar-SA': 'ar-XA', 'es-ES': 'es-ES' };
// Du plus naturel au plus basique.
const QUALITY = ['Chirp3-HD', 'Chirp-HD', 'Studio', 'Neural2', 'Wavenet', 'Standard'];

async function call(path, init) {
  const res = await fetch(`${API}/${path}${path.includes('?') ? '&' : '?'}key=${key}`, init);
  if (!res.ok) throw new Error(`${path.split('?')[0]} : ${res.status} ${await res.text()}`);
  return res.json();
}

async function bestVoice(languageCode) {
  const { voices = [] } = await call(`voices?languageCode=${languageCode}`);
  const ranked = voices
    .filter((v) => v.languageCodes.includes(languageCode))
    .map((v) => ({ v, rank: QUALITY.findIndex((q) => v.name.includes(q)) }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank || (a.v.ssmlGender === 'FEMALE' ? -1 : 1) || a.v.name.localeCompare(b.v.name));
  if (!ranked.length) throw new Error(`Aucune voix Google pour ${languageCode}`);
  return ranked[0].v.name;
}

const voicesPath = join(root, 'courses', 'voices.json');
const voices = existsSync(voicesPath) ? JSON.parse(readFileSync(voicesPath, 'utf8')) : {};
let made = 0;

for (const entry of loadCourses()) {
  const languageCode = GOOGLE_LANG[entry.course.ttsLang] ?? entry.course.ttsLang;
  voices[entry.id] ??= await bestVoice(languageCode);
  const name = voices[entry.id];

  for (const item of itemsOf(entry.course)) {
    const source = entry.sources[item.id]?.source;
    if (source === 'lingualibre') continue;
    if (source === 'google' && !force && existsSync(join(entry.dir, audioPath(item)))) continue;
    const { audioContent } = await call('text:synthesize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: { text: spokenText(item) },
        voice: { languageCode, name },
        // Débit un peu ralenti, plus confortable pour un débutant.
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, sampleRateHertz: 24000 },
      }),
    });
    saveAudio(entry, item, Buffer.from(audioContent, 'base64'), { source: 'google', voice: name });
    made++;
  }
  saveCourse(entry);
  console.log(`${entry.id} : voix ${name}`);
}

writeFileSync(voicesPath, JSON.stringify(voices, null, 2) + '\n');
console.log(`✓ ${made} voix Google enregistrée(s).`);
