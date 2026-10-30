// Valide chaque cours contre le schéma JSON et vérifie les règles que le schéma
// ne peut pas exprimer (identifiants uniques, préfixes, écriture cohérente).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const SCRIPT_RANGES = {
  Latn: /[A-Za-z]/,
  Cyrl: /[Ѐ-ӿ]/,
  Hans: /[一-鿿]/,
  Arab: /[؀-ۿ]/,
};

const ajv = new Ajv2020({ allErrors: true });
const validateIndex = ajv.compile(readJson("schema/index.schema.json"));
const validateCourse = ajv.compile(readJson("schema/course.schema.json"));

const errors = [];
const stats = [];
const index = readJson("courses/index.json");
if (!validateIndex(index)) errors.push(...validateIndex.errors.map((e) => `index.json ${e.instancePath} ${e.message}`));

for (const entry of index.courses ?? []) {
  const file = `courses/${entry.path}`;
  const course = readJson(file);
  if (!validateCourse(course)) {
    errors.push(...validateCourse.errors.map((e) => `${file} ${e.instancePath} ${e.message}`));
    continue;
  }
  if (course.id !== entry.id) errors.push(`${file}: id « ${course.id} » ≠ index « ${entry.id} »`);
  if (course.script !== "Latn" && !course.romanization) errors.push(`${file}: une écriture non latine doit déclarer « romanization »`);
  if ((course.script === "Arab") !== (course.direction === "rtl")) errors.push(`${file}: direction incohérente avec l'écriture ${course.script}`);

  const seen = new Set();
  let items = 0;
  let lessons = 0;
  for (const unit of course.units) {
    if (!unit.id.startsWith(`${course.id}-`)) errors.push(`${file}: unité ${unit.id} doit commencer par « ${course.id}- »`);
    for (const id of [unit.id, ...unit.lessons.map((l) => l.id)]) {
      if (seen.has(id)) errors.push(`${file}: identifiant dupliqué ${id}`);
      seen.add(id);
    }
    for (const lesson of unit.lessons) {
      lessons++;
      for (const item of lesson.items) {
        items++;
        if (seen.has(item.id)) errors.push(`${file}: identifiant dupliqué ${item.id}`);
        seen.add(item.id);
        if (!item.id.startsWith(`${course.id}-`)) errors.push(`${file}: élément ${item.id} doit commencer par « ${course.id}- »`);
        if (!SCRIPT_RANGES[course.script].test(item.text)) errors.push(`${file}: ${item.id} ne contient aucun caractère ${course.script}`);
        if (course.script !== "Latn" && !item.romanization) errors.push(`${file}: ${item.id} n'a pas de ${course.romanization?.name ?? "romanisation"}`);
        if (item.audio && !existsSync(join(root, dirname(file), item.audio))) errors.push(`${file}: fichier audio absent pour ${item.id} (${item.audio})`);
      }
      if (lesson.scene) checkScene(file, course, lesson, seen);
    }
  }
  const scenes = course.units.flatMap((u) => u.lessons).filter((l) => l.scene);
  stats.push({ cours: course.id, unités: course.units.length, leçons: lessons, éléments: items, scènes: scenes.length, répliques: scenes.reduce((n, l) => n + l.scene.lines.length, 0) });
}

function checkScene(file, course, lesson, seen) {
  const { speakers, lines, questions, grammar } = lesson.scene;
  const where = `${file}: scène ${lesson.id}`;
  const learners = Object.values(speakers).filter((s) => s.learner).length;
  if (learners !== 1) errors.push(`${where} doit avoir exactement un personnage « learner » (${learners})`);
  for (const line of lines) {
    if (seen.has(line.id)) errors.push(`${file}: identifiant dupliqué ${line.id}`);
    seen.add(line.id);
    if (!line.id.startsWith(`${course.id}-`)) errors.push(`${where} : réplique ${line.id} doit commencer par « ${course.id}- »`);
    if (!speakers[line.speaker]) errors.push(`${where} : personnage inconnu ${line.speaker} (${line.id})`);
    if (!SCRIPT_RANGES[course.script].test(line.text)) errors.push(`${where} : ${line.id} ne contient aucun caractère ${course.script}`);
    if (course.script !== "Latn" && !line.romanization) errors.push(`${where} : ${line.id} n'a pas de romanisation`);
    if (line.audio && !existsSync(join(root, dirname(file), line.audio))) errors.push(`${where} : fichier audio absent pour ${line.id}`);
  }
  if (!lines.some((l) => speakers[l.speaker]?.learner)) errors.push(`${where} : l'apprenant n'a aucune réplique`);
  for (const [i, q] of questions.entries()) {
    if (q.answer >= q.options.length) errors.push(`${where} : question ${i + 1}, réponse hors des choix`);
  }
  for (const [i, d] of (grammar?.drills ?? []).entries()) {
    if (d.answer >= d.options.length) errors.push(`${where} : exercice de grammaire ${i + 1}, réponse hors des choix`);
    if ((d.text.match(/___/g) ?? []).length !== 1) errors.push(`${where} : exercice de grammaire ${i + 1}, il faut un seul trou ___`);
  }
}

if (process.argv.includes("--stats")) console.table(stats);
if (errors.length) {
  console.error(`✗ ${errors.length} erreur(s) :\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${stats.length} cours valides (${stats.reduce((n, s) => n + s.éléments, 0)} éléments).`);
