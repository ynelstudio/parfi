# ParFi France — recopie immersive

**Register:** brand (site vitrine corporate, expert-comptable transfrontalier FR·LU·BE, depuis 2014).

**Nature de la tâche:** recopie FIDÈLE de `https://sc10flga8844.universe.wf` (déjà livrée dans `../copie/`), **enrichie d'une couche de mouvement immersive**. Le design, le contenu, les couleurs, la typo et le layout sont **VERROUILLÉS** — identité préservée, on n'ajoute QUE du mouvement.

## Identité (immuable)
- **Police:** Open Sans (300–800). Corps 14px / interligne 1.8 / `#4A4A4A`.
- **Couleurs:** navy `#23346B`, cyan `#00BAE5`, bleu clair `#6EC1E4`, dark `#212121/#242424`, blanc.
- **Boutons:** pilule pleine navy, pilule contour blanc (hero), pilule contour navy, lien « En savoir plus → ».
- **Carte couleurs (ordre):** Hero `#6EC1E4` → Services blanc → À propos blanc → 4 valeurs cyan → Bandeau frontières → FAQ navy → CTA blanc → Newsletter cyan → Footer navy.

## Couche motion (ce qu'on ajoute, sans toucher au visuel statique)
- **Moment signature:** chorégraphie d'entrée du hero (H1 en wipe, sous-titre/CTA fade-up, portrait scale+parallax).
- **Reveals différenciés par section** (pas de fade-up uniforme) : stagger des listes (cartes, valeurs, FAQ, footer), wipe des titres, tracé de la frise FR·LU·BE et du filet cyan.
- **Scroll fluide** (Lenis, CDN, dégrade en natif), **curseur custom** discret (pointeur fin only), **boutons magnétiques** + balayage, **barre de progression** cyan en tête.
- **a11y:** tout coupé sous `prefers-reduced-motion` (contenu visible, zéro transform). Reveals = amélioration d'un défaut déjà visible (failsafe d'affichage).

**Easing:** ease-out-quint / expo. Jamais bounce/elastic. Durées 100/300/500/800.
