# ParFi Éditeur — Blueprint (back-office visuel mono-site)

Éditeur WYSIWYG type Canva pour modifier **le site ParFi** sans toucher au code et **sans pouvoir casser le design / le responsive**. Mono-site (pas de multi-tenant). Phasé : **prototype 100 % front (localStorage)** d'abord, **backend minimal** ensuite.

---

## 1. Principe directeur — « slots, pas page blanche »

La règle d'or anti-casse : l'utilisateur **n'édite pas une page libre**, il remplit des **emplacements (slots) verrouillés** dans un gabarit déjà parfait.

- La **structure** (grilles, marges, paddings, breakpoints) appartient au **gabarit** (le CSS du site, déjà responsive). L'utilisateur **n'y touche jamais**.
- L'utilisateur ne modifie que le **contenu des slots** : texte, image, lien, + des **réglages bornés** (couleur dans la palette de marque, taille dans une échelle, etc.).
- Conséquence : il est **structurellement impossible** de désaligner ou de casser le mobile — le responsive est porté par le CSS, pas par les choix de l'utilisateur.

C'est la différence avec WordPress/page-builders : ici on **contraint** au lieu de tout permettre.

---

## 2. Architecture (phasée)

```
                 ┌─────────────────────────────────────────────┐
                 │  PARFI ÉDITEUR (shell)  index.html          │
                 │  ┌──────────┬──────────────────┬──────────┐ │
                 │  │ Panneau  │   CANVAS          │ Panneau  │ │
                 │  │ GAUCHE   │  (iframe = site)  │ DROITE   │ │
                 │  │ sections │  site/index.html  │ propriétés│ │
                 │  │ médias   │  ?edit=1          │ de l'élt │ │
                 │  │ thème    │                   │ sélect.  │ │
                 │  │ versions │                   │          │ │
                 │  └──────────┴──────────────────┴──────────┘ │
                 └───────────────┬─────────────────────────────┘
                                 │ accès direct au DOM de l'iframe (même origine)
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │  ÉTAT (Store)                                │
                 │  { contenu: bodyHTML, thème: vars CSS }      │
                 │  history[] (undo/redo) · versions[]          │
                 └───────────────┬─────────────────────────────┘
   PHASE 1 (proto)               │                  PHASE 2 (prod)
   localStorage  ◀───────────────┴───────────────▶  API REST
                                                    Node + SQLite/PostgreSQL
                                                    médias → S3 + WebP
```

**Phase 1 — Prototype (ce qu'on livre maintenant)** : tout en front, zéro backend. État persisté en `localStorage`. Médias en `ObjectURL`. Export HTML par téléchargement.

**Phase 2 — Production** : petit backend Node (Fastify/Express) + base (SQLite suffit pour 1 site, PostgreSQL si on grandit). Médias uploadés → conversion **WebP** + compression → stockage **S3-compatible**. Auth simple (1 compte client + 1 admin, JWT). « Publier » écrit la page rendue et la déploie.

> Note : la stack lourde Next.js/Postgres/S3/OAuth de ton brief est **surdimensionnée pour 1 seul site**. On la garde en cible Phase 2 *si* tu veux en faire un produit, mais pour ParFi un mono-front + un micro-backend de sauvegarde suffit et tient le score Lighthouse > 95 (le site publié reste du **HTML statique**, l'éditeur n'alourdit jamais le site livré).

---

## 3. Modèle de contenu (le cœur anti-casse)

Le site est annoté en **slots typés**. Chaque élément éditable porte un type qui décide **quels réglages** apparaissent à droite (et lesquels sont interdits).

| Type de slot | Édition autorisée | **Interdit** (anti-casse) |
|---|---|---|
| `text` (h1/h2/h3/p) | contenu, couleur (palette), taille (échelle), alignement, graisse | largeur, position, marges libres |
| `button` | libellé, style (plein/contour), lien | taille fixe hors presets |
| `image` | remplacer, arrondi, ombre, texte alt | dimensions cassant la grille |
| `link/nav` | libellé, destination | — |
| `section` | réordonner, dupliquer, masquer, supprimer, **ajouter depuis bibliothèque** | éditer sa grille interne |
| `theme` (global) | couleurs de marque, paire de polices, échelle d'espacement | — |

Le **thème** est piloté par les **variables CSS** du site (`--navy`, `--cyan`, `--sky`, polices, espacement). Changer une pastille re-thème **tout le site d'un coup, harmonieusement** → impossible d'obtenir un résultat incohérent.

---

## 4. UX écran par écran

**Barre du haut** : logo · bascule **Desktop / Tablette / Mobile** · **Annuler/Refaire** · indicateur **« Enregistré »** (autosave) · **Aperçu** · **Versions** · **Publier**.

**Panneau gauche (onglets)**
- **Sections** : liste ordonnée des sections de la page → cliquer pour aller dessus, poignées pour **réordonner**, ✚ pour **ajouter**, 👁 masquer, 🗑 supprimer.
- **Composants** : bibliothèque de blocs prêts à l'emploi (Hero, 2/3/4 colonnes, Témoignages, FAQ, Galerie, CTA, Contact…) → **insertion en 1 clic** au style ParFi.
- **Médias** : vignettes, **glisser-déposer** depuis le PC, compression auto (WebP en prod).
- **Thème** : pastilles couleurs de marque, paires de polices, espacement (Compact/Normal/Aéré).
- **Versions** : historique horodaté, **restaurer** en 1 clic.

**Canvas central** : le **vrai site** dans une iframe. Survol = **contour bleu + barre flottante** (✎ modifier · ⤴ déplacer · ⧉ dupliquer · 🗑 supprimer), exactement comme Canva/Figma. Clic = sélection.

**Panneau droit** : **uniquement** les propriétés de l'élément sélectionné (contextuel). Vide = message d'aide.

---

## 5. Interactions (façon Canva)

- **Clic-pour-éditer le texte** : `contenteditable`, saisie directe, collage nettoyé (texte brut), pas de retour à la ligne cassant.
- **Glisser-déposer image** depuis le PC.
- **Drag & drop** de réordonnancement des sections.
- **Raccourcis** : `Ctrl+Z` / `Ctrl+Shift+Z` (annuler/refaire), `Ctrl+D` (dupliquer), `Suppr` (supprimer), `Échap` (désélectionner).
- **Aperçu instantané** : chaque réglage s'applique en direct dans le canvas.

---

## 6. Système anti-erreur & validation

**Contraintes permanentes** : grille/marges/responsive du gabarit non éditables · couleurs limitées à la **palette de marque** · tailles sur **échelle** (pas de valeur libre) · alignements snap.

**Adaptation auto Desktop/Tablette/Mobile** : portée à 100 % par le CSS du gabarit. La bascule d'appareil ne fait que **prévisualiser** — aucune action requise.

**Validation avant sauvegarde/publication** (checklist bloquante pour le critique) :
- images manquantes (`src` vide) · liens cassés (`#`/vide) · textes vides ou trop longs (dépassement de slot) · **contraste insuffisant** (ratio < 4.5:1 sur texte édité) · alt manquant (SEO/a11y).

---

## 7. Sauvegarde · Historique · Versions

- **Autosave** toutes les 5 s (+ à chaque modif, debouncé) → `localStorage` (Phase 1) / API (Phase 2).
- **Undo/Redo illimité** : pile de **snapshots** `{ bodyHTML, thème }`.
- **Versioning** : snapshots nommés/horodatés (v1, v2, v3…), **restauration** à n'importe quel point.

---

## 8. Médias

Bibliothèque intégrée (images, SVG, icônes) · **drag & drop** du PC · **compression + conversion WebP** + redimensionnement responsive (Phase 2, côté backend) · en Phase 1 : aperçu immédiat via `ObjectURL`.

---

## 9. Publication & performance

« Publier » = rendu du gabarit + slots remplis → **HTML statique** (les variables de thème sont *gelées* dans le fichier). Le site livré ne contient **aucun JS d'éditeur** → **Lighthouse > 95**, < 2 s, responsive parfait, SEO préservé (balises, alt, structure intacts).

---

## 10. Arborescence projet

```
editor/
├─ index.html         ← shell de l'éditeur (3 panneaux + barre)
├─ editor.css         ← UI de l'éditeur (chrome) — n'affecte jamais le site
├─ editor.js          ← logique : sélection, panneaux, store, undo, versions…
├─ site/              ← LE site édité (gabarit + slots)
│  ├─ index.html      (copie de la recopie ParFi)
│  └─ assets/
└─ BLUEPRINT.md       ← ce document
```
Phase 2 ajoute `server/` (API + auth), `db/` (schéma), `media/` (pipeline WebP/S3).

---

## 11. Schéma de base de données (Phase 2)

```sql
-- 1 site, mais le modèle reste propre/extensible
site(id, slug, name, created_at)
page(id, site_id→site, path, title, seo_description)
content(id, page_id→page, body_json, theme_json, updated_at)   -- état courant
version(id, page_id→page, label, body_json, theme_json, created_at, author)
media(id, site_id→site, url, webp_url, width, height, bytes, alt, created_at)
user(id, email, password_hash, role)   -- role: 'admin' | 'editor'
session(id, user_id→user, jwt_id, expires_at)
```
`body_json` = arbre de slots (id, type, contenu, réglages) ; `theme_json` = variables de marque.

---

## 12. Structure des composants (cible React/Phase 2)

```
<EditorApp>
 ├─ <TopBar>            (DeviceSwitch, UndoRedo, SaveStatus, PublishBtn)
 ├─ <LeftPanel>        (Tabs: Sections | Components | Media | Theme | Versions)
 ├─ <Canvas>           (iframe + overlay de sélection)
 │   └─ <SelectionLayer> (HoverOutline, FloatingToolbar)
 └─ <RightPanel>       (Inspector → TextProps | ImageProps | ButtonProps | ThemeProps)
store (Zustand): { doc, selection, history, versions, device, dirty }
```
En Phase 1, la même logique est écrite en **vanilla JS** (un seul `editor.js`, store maison) — zéro dépendance, prototype instantané.

---

## 13. Plan de développement par étapes

1. **Shell 3 panneaux + canvas iframe** (sélection au survol/clic). ← *prototype*
2. **Édition de texte inline** + inspecteur texte (couleur/taille/alignement). ← *prototype*
3. **Image** (remplacer/arrondi/ombre) + **bouton** (libellé/style/lien). ← *prototype*
4. **Thème global** (couleurs de marque, polices, espacement). ← *prototype*
5. **Sections** : réordonner/dupliquer/supprimer/**ajouter depuis bibliothèque**. ← *prototype*
6. **Undo/Redo + Autosave + Versions** (localStorage). ← *prototype*
7. **Validation** (liens/images/contraste/longueurs) + **Export HTML**. ← *prototype*
8. *(Phase 2)* Backend save/publish, médias WebP/S3, auth JWT, déploiement.

> **Le prototype livré couvre les étapes 1 à 7.**
