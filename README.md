# GB Learn · contenu pédagogique

Les programmes d'apprentissage utilisés par l'application [GB Learn](https://github.com/gb7878w/gb-learn), pour des apprenants francophones.

| Cours | Écriture | Sens | Romanisation | Unités | Leçons | Éléments |
|---|---|---|---|---|---|---|
| 🇬🇧 Anglais | latine | gauche → droite | — | 3 | 7 | 42 |
| 🇷🇺 Russe | cyrillique | gauche → droite | translittération | 3 | 8 | 46 |
| 🇨🇳 Mandarin | hanzi simplifiés | gauche → droite | pinyin avec tons | 3 | 7 | 40 |
| 🇸🇦 Arabe | arabe (vocalisé) | droite → gauche | translittération | 3 | 7 | 40 |

L'espagnol viendra dans une version ultérieure : il suffira d'ajouter son cours ici, sans modifier l'application.

## Organisation

```
courses/
  index.json            catalogue des cours
  <langue>/course.json  un cours : unités → leçons → éléments
schema/                 schémas JSON (format v1)
scripts/validate.mjs    validation du schéma + règles de cohérence
docs/FORMAT.md          guide de rédaction du contenu
```

## Ajouter ou modifier du contenu

1. Modifier `courses/<langue>/course.json` (voir [docs/FORMAT.md](docs/FORMAT.md)).
2. Lancer `npm install` puis `npm run validate`.
3. Ouvrir une PR : la CI relance la validation.
4. Dans gb-learn, `npm run sync-data` copie le contenu dans l'application.

Les exercices (QCM, saisie, écoute, paires) ne sont pas écrits à la main : l'application les génère à partir des éléments de chaque leçon.
