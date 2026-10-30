// Récupère des prononciations enregistrées par de vrais locuteurs sur Wikimedia Commons :
// d'abord Lingua Libre (« LL-Q… (code)-locuteur-mot.wav »), puis les fichiers du
// Wiktionnaire (« En-uk-mot.ogg », « Ru-mot.ogg », « Zh-pinyin.ogg »…). Ils sont
// convertis en MP3 court et normalisé (ffmpeg), avec auteur et licence dans sources.json.
// Un enregistrement humain remplace toujours une voix de synthèse.
//
//   npm run recordings
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HUMAN, itemsOf, loadCourses, normalizeToMp3, saveAudio, saveCourse, spokenText } from './audio-lib.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const HEADERS = { 'user-agent': 'GB-Learn/0.1 (https://github.com/gb7878w/gb-learn-data)' };
// Code ISO 639-3 utilisé dans les noms de fichiers Lingua Libre.
const ISO3 = { en: 'eng', ru: 'rus', zh: 'cmn', ar: 'ara', es: 'spa' };
// Préfixe des fichiers du Wiktionnaire, et variantes régionales préférées (l'anglais
// britannique d'abord, comme la voix du cours).
const WIKTIONARY = { en: { prefix: 'En', prefer: ['uk', 'gb', 'au', 'us'] }, ru: { prefix: 'Ru' }, zh: { prefix: 'Zh' }, ar: { prefix: 'Ar' }, es: { prefix: 'Es' } };

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
  const rec = await fileInfo(matches[0].title, matches[0].m[1]);
  return rec && { source: 'lingualibre', ...rec };
}

/** Prononciation du Wiktionnaire : « Ru-метро.ogg », « En-uk-thank you.ogg », « Zh-zàijiàn.ogg ». */
async function findWiktionary(lang, word) {
  const { prefix, prefer = [] } = WIKTIONARY[lang];
  const results = [];
  for (const q of new Set([word, lang === 'zh' ? word.replace(/\s+/g, '') : word])) {
    const { query } = await api({
      action: 'query',
      list: 'search',
      srnamespace: '6',
      srlimit: '50',
      srsearch: `intitle:"${prefix}" intitle:"${q.replace(HARAKAT, '')}"`,
    });
    results.push(...(query?.search ?? []));
  }
  // Le pinyin s'écrit avec ou sans espaces selon les fichiers (« zài jiàn », « zàijiàn »).
  const same = lang === 'zh' ? (a, b) => key(a).replace(/ /g, '') === key(b).replace(/ /g, '') : (a, b) => key(a) === key(b);
  const pattern = new RegExp(`^File:${prefix}(?:-([a-z]{2,3}))?-(.+)\\.(ogg|oga|wav|flac|mp3)$`, 'i');
  const rank = (region) => (region && prefer.includes(region.toLowerCase()) ? prefer.indexOf(region.toLowerCase()) : prefer.length);
  const matches = results
    .map((r) => ({ title: r.title, m: pattern.exec(r.title) }))
    .filter((r) => r.m && same(r.m[2], word))
    .sort((a, b) => rank(a.m[1]) - rank(b.m[1]) || a.title.localeCompare(b.title));
  if (!matches.length) return null;
  const rec = await fileInfo(matches[0].title);
  return rec && { source: 'commons', ...rec };
}

async function fileInfo(title, speaker) {
  const { query: info } = await api({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
  });
  const page = info.pages[0];
  const ii = page.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata ?? {};
  const strip = (html) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return {
    title: page.title,
    url: ii.url,
    page: ii.descriptionurl,
    ...(speaker ? { speaker } : {}),
    author: strip(meta.Artist?.value) || speaker || 'Wikimedia Commons',
    license: strip(meta.LicenseShortName?.value) || 'CC BY-SA 4.0',
  };
}

async function toMp3(url) {
  const res = await get(url);
  const input = join(tmp, 'in');
  writeFileSync(input, Buffer.from(await res.arrayBuffer()));
  return normalizeToMp3(input);
}

let found = 0;
let missing = 0;
for (const entry of loadCourses()) {
  const iso3 = ISO3[entry.id];
  if (!iso3) continue;
  for (const item of itemsOf(entry.course)) {
    // Les lettres seules et les débuts de phrase (« je m'appelle… ») n'ont pas d'enregistrement utile.
    if (item.kind === 'letter' || item.text.includes('…')) continue;
    if (HUMAN.has(entry.sources[item.id]?.source)) continue;
    const word = spokenText(item);
    try {
      // Les fichiers chinois du Wiktionnaire sont nommés en pinyin.
      const rec =
        (await findRecording(iso3, word)) ??
        (WIKTIONARY[entry.id] ? await findWiktionary(entry.id, entry.id === 'zh' ? (item.romanization ?? word) : word) : null);
      if (!rec) {
        missing++;
        continue;
      }
      const { url, ...source } = rec;
      saveAudio(entry, item, await toMp3(url), source);
      found++;
      console.log(`${item.id} ← ${rec.title}`);
    } catch (err) {
      console.warn(`${item.id} : ${err.message}`);
    }
  }
  saveCourse(entry);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${found} enregistrement(s) de vrais locuteurs ajouté(s), ${missing} élément(s) sans enregistrement.`);
