// Récupère des prononciations enregistrées par de vrais locuteurs sur Lingua Libre
// (fichiers « LL-Q… (code)-locuteur-mot.wav » de Wikimedia Commons, CC BY-SA),
// les convertit en MP3 court et normalisé (ffmpeg) et les note dans sources.json.
// Un enregistrement humain remplace toujours une voix de synthèse.
//
//   npm run recordings
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { itemsOf, loadCourses, saveAudio, saveCourse, spokenText } from './audio-lib.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const HEADERS = { 'user-agent': 'GB-Learn/0.1 (https://github.com/gb7878w/gb-learn-data)' };
// Code ISO 639-3 utilisé dans les noms de fichiers Lingua Libre.
const ISO3 = { en: 'eng', ru: 'rus', zh: 'cmn', ar: 'ara', es: 'spa' };

const HARAKAT = /[\u064B-\u065F\u0670\u0640]/g;

const tmp = mkdtempSync(join(tmpdir(), 'lingualibre-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Requête polie envers Wikimedia : une à la fois, espacées, et en cas de 429 on
 * attend le délai demandé (Retry-After) avant de réessayer.
 */
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    await sleep(attempt === 0 ? 300 : 0);
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res;
    if (attempt === 5 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5 * 2 ** attempt) * 1000);
  }
}

async function api(params) {
  const res = await get(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`);
  return res.json();
}

/** Forme comparable d'un mot : minuscules, sans harakat ni ponctuation. */
function key(text) {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[?!.,;:¿¡؟،。，？！…"«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findRecording(iso3, word) {
  const { query } = await api({
    action: 'query',
    list: 'search',
    srnamespace: '6',
    srlimit: '50',
    // Les titres arabes sont presque toujours sans voyelles courtes.
    srsearch: `intitle:"(${iso3})" intitle:"${word.replace(HARAKAT, '')}"`,
  });
  const pattern = new RegExp(`^File:LL-Q\\d+ \\(${iso3}\\)-(.+?)-(.+)\\.(wav|ogg|flac|mp3)$`, 'i');
  const matches = (query?.search ?? [])
    .map((r) => ({ title: r.title, m: pattern.exec(r.title) }))
    .filter((r) => r.m && key(r.m[2]) === key(word))
    .sort((a, b) => a.title.localeCompare(b.title));
  if (!matches.length) return null;

  const { query: info } = await api({
    action: 'query',
    titles: matches[0].title,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
  });
  const page = info.pages[0];
  const ii = page.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata ?? {};
  const strip = (html) => (html ?? '').replace(/<[^>]+>/g, '').trim();
  return {
    title: page.title,
    url: ii.url,
    page: ii.descriptionurl,
    speaker: matches[0].m[1],
    author: strip(meta.Artist?.value) || matches[0].m[1],
    license: strip(meta.LicenseShortName?.value) || 'CC BY-SA 4.0',
  };
}

/** WAV → MP3 mono, silences de début et de fin retirés, volume normalisé. */
async function toMp3(url) {
  const res = await get(url);
  const input = join(tmp, 'in');
  const output = join(tmp, 'out.mp3');
  writeFileSync(input, Buffer.from(await res.arrayBuffer()));
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-af', `${trim},areverse,${trim},areverse,loudnorm=I=-16:TP=-1.5`, '-ac', '1', '-ar', '24000', '-b:a', '64k', output]);
  return readFileSync(output);
}

let found = 0;
let missing = 0;
for (const entry of loadCourses()) {
  const iso3 = ISO3[entry.id];
  if (!iso3) continue;
  for (const item of itemsOf(entry.course)) {
    // Les lettres seules et les débuts de phrase (« je m'appelle… ») n'ont pas d'enregistrement utile.
    if (item.kind === 'letter' || item.text.includes('…')) continue;
    if (entry.sources[item.id]?.source === 'lingualibre') continue;
    const word = spokenText(item);
    try {
      const rec = await findRecording(iso3, word);
      if (!rec) {
        missing++;
        continue;
      }
      saveAudio(entry, item, await toMp3(rec.url), { source: 'lingualibre', ...rec });
      found++;
      console.log(`${item.id} ← ${rec.title}`);
    } catch (err) {
      console.warn(`${item.id} : ${err.message}`);
    }
  }
  saveCourse(entry);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${found} enregistrement(s) Lingua Libre ajouté(s), ${missing} élément(s) sans enregistrement.`);
