# Format des cours (v1)

Un cours est un fichier JSON validé par [`schema/course.schema.json`](../schema/course.schema.json).

```
Cours ─┬─ Unité (thème, niveau CECR)
       │    └─ Leçon (4 à 8 éléments, un conseil facultatif)
       │         └─ Élément (lettre, caractère, mot, expression, phrase)
```

## Champs d'un élément

| Champ | Obligatoire | Rôle |
|---|---|---|
| `id` | oui | Unique dans le cours, préfixé par l'id du cours (`ru-privet`). **Ne jamais renommer** : la progression de l'apprenant y est rattachée. |
| `kind` | oui | `letter`, `character`, `word`, `phrase` ou `sentence`. |
| `text` | oui | Forme écrite dans la langue apprise. |
| `romanization` | si écriture non latine | Pinyin avec diacritiques de ton, translittération pour le russe et l'arabe. |
| `translation` | oui | Traduction principale en français, affichée à l'apprenant. |
| `accept` | non | Autres réponses acceptées en saisie (synonymes, féminin, chiffres). |
| `emoji` | non | Illustration façon Drops. |
| `note` | non | Remarque affichée après la réponse (prononciation, exception). |
| `audio` | non | Enregistrement de la prononciation, relatif au fichier du cours (`audio/ru-privet.mp3`). Rempli par `npm run audio` ; à défaut l'app utilise la synthèse vocale du téléphone (`ttsLang`). |

## Scènes de conversation

Une leçon peut porter une `scene` : un dialogue modèle autour duquel l'app construit une séance complète (écoute du dialogue, vocabulaire, compréhension, grammaire, construction de phrases, dictée, puis jeu de rôle où l'apprenant tient son personnage). Les `items` de la leçon sont le vocabulaire de la scène.

| Champ | Rôle |
|---|---|
| `setting` | Mise en situation, en français. |
| `speakers` | Personnages par lettre : `name`, `voice` (`female` ou `male`, voir `courses/voices.json`) ; exactement un a `learner: true`. |
| `lines` | Répliques : `id` (unique, **ne jamais renommer**, la répétition espacée des phrases y est rattachée), `speaker`, `text`, `translation`, `romanization` si l'écriture n'est pas latine. 8 à 10 répliques courtes, dont au moins trois pour l'apprenant. |
| `questions` | Questions de compréhension en français : `options` (2 à 4) et `answer` (index). |
| `grammar` | `title`, `explanation` (paragraphes courts), `examples`, `drills` (phrases à un seul trou `___`, avec `options` et `answer`). |

Les dictées, les phrases à reconstruire et les choix de réplique sont tirés automatiquement des répliques : rien d'autre à rédiger.

## Règles par écriture

- **Russe (Cyrl)** : translittération simple et lisible (`zh`, `kh`, `ts`, `ch`, `sh`, `y`), l'apostrophe note le signe mou (`pyat'`). L'app accepte les saisies en cyrillique ou en translittération.
- **Mandarin (Hans)** : caractères simplifiés, pinyin avec tons en diacritiques (`nǐ hǎo`), syllabes séparées par des espaces. L'app accepte le pinyin sans tons ou avec chiffres (`ni3 hao3`).
- **Arabe (Arab)** : arabe standard moderne, vocalisé (harakat) pour les débutants, `direction: "rtl"`. Translittération avec `ʿ` (ʿayn), `ʾ` (hamza) et voyelles longues `ā ī ū`.

## Bonnes pratiques

- 6 éléments par leçon : assez pour un QCM à 4 choix, assez peu pour être mémorisés en une séance.
- Introduire d'abord les éléments simples (lettres, mots), puis les phrases qui les réutilisent.
- Monter `version` du cours à chaque changement publié.

## Voix

Le workflow « Enregistrer les voix » prépare la prononciation de chaque élément, sans service payant ni clé :

1. **Vrais locuteurs** (`npm run recordings`) : enregistrements de Lingua Libre, puis du Wiktionnaire, sur Wikimedia Commons (licences libres, auteur et licence notés dans `courses/<cours>/audio/sources.json` et affichés dans l'app).
2. **Piper** (`npm run audio`) : voix neuronale libre, calculée hors ligne, pour les éléments restants (lettres seules, phrases). La voix de chaque cours est dans `courses/voices.json` ; pour en changer, modifier ce fichier puis lancer le workflow avec « Réenregistrer toutes les voix Piper ».

Seuls les éléments sans audio sont traités : un nouvel élément ou un nouveau cours est enregistré automatiquement à son arrivée sur main. Un enregistrement humain n'est jamais remplacé par une voix de synthèse ; pour en déposer un à la main, garder le même nom de fichier (`courses/<cours>/audio/<élément>.mp3`) et noter sa source dans `sources.json`.
