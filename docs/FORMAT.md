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
| `audio` | non | Fichier audio enregistré ; à défaut l'app utilise la synthèse vocale (`ttsLang`). |

## Règles par écriture

- **Russe (Cyrl)** : translittération simple et lisible (`zh`, `kh`, `ts`, `ch`, `sh`, `y`), l'apostrophe note le signe mou (`pyat'`). L'app accepte les saisies en cyrillique ou en translittération.
- **Mandarin (Hans)** : caractères simplifiés, pinyin avec tons en diacritiques (`nǐ hǎo`), syllabes séparées par des espaces. L'app accepte le pinyin sans tons ou avec chiffres (`ni3 hao3`).
- **Arabe (Arab)** : arabe standard moderne, vocalisé (harakat) pour les débutants, `direction: "rtl"`. Translittération avec `ʿ` (ʿayn), `ʾ` (hamza) et voyelles longues `ā ī ū`.

## Bonnes pratiques

- 6 éléments par leçon : assez pour un QCM à 4 choix, assez peu pour être mémorisés en une séance.
- Introduire d'abord les éléments simples (lettres, mots), puis les phrases qui les réutilisent.
- Monter `version` du cours à chaque changement publié.
