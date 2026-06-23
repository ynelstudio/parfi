# ParFi — site & éditeur visuel

Reproduction fidèle du site **ParFi France** (cabinet d'expertise comptable transfrontalier FR · LU · BE) + un **éditeur visuel WYSIWYG** (type Canva) pour le modifier sans toucher au code.

## Contenu du dépôt

```
editor/                 Éditeur visuel (back-office WYSIWYG)
├─ index.html           Shell de l'éditeur (3 panneaux)
├─ editor.css / .js     UI + logique (vanilla, zéro dépendance)
├─ site/                LE site édité — MULTI-PAGES
│  ├─ index.html        Accueil
│  ├─ services.html     Services
│  ├─ apropos.html      À propos
│  ├─ contact.html      Contact (formulaire + 10 bureaux du groupe)
│  └─ assets/           images, logos, icônes
└─ BLUEPRINT.md         Architecture détaillée

copie/                  Recopie fidèle (Accueil, fichier autonome)
copie-immersif/         Même recopie + couche d'animations immersives
CONTENT.md              Contenu verbatim de référence
```

## Lancer en local

L'éditeur charge le site dans une `<iframe>` même-origine : il faut le servir en **HTTP** (pas un double-clic `file://`).

**Windows (le plus simple) :** double-clic sur **`editor/lancer-editeur.cmd`** → l'éditeur s'ouvre dans le navigateur. Garder la fenêtre noire ouverte pendant le travail.

**Ou en ligne de commande :**
```bash
# depuis le dossier editor/
python -m http.server 5050
# puis ouvrir http://localhost:5050/
```

- **L'éditeur** : http://localhost:5050/ (panneau Pages pour basculer entre les 4 pages)
- **Le site seul** : http://localhost:5050/site/

## L'éditeur en bref

Clic sur n'importe quel élément → l'inspecteur de droite s'adapte (texte, image, bouton, lien).
Édition de texte en place, couleurs de marque, thème global, ajout/réorganisation de sections,
**undo/redo**, **autosave** + **versions** (par page), aperçu Desktop/Tablette/Mobile, validation
avant publication, export HTML propre. Conçu pour qu'on **ne puisse pas casser le design**
(les marges/grilles/responsive sont portées par le gabarit, l'utilisateur ne remplit que des « slots »).

## Statut

Prototype **front** (sauvegarde locale `localStorage`). Phase 2 prévue : backend de sauvegarde
serveur + publication en ligne + médias optimisés (WebP/S3).

---
Identité : navy `#23346B` · cyan `#00BAE5` · police Open Sans.
