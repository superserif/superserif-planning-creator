# PRD — Lineup
### Planning de projets en vue Gantt annuelle

> Nom de travail : **Lineup** (placeholder, à valider).
> Date : 12 juin 2026 — v1.0

---

## 1. Le concept en une phrase

Une seule page : l'année du studio, chaque projet est une barre qu'on attrape, étire et déplace directement — pas de formulaire avant le geste.

## 2. Contexte et objectif

Les outils de gestion de projet existants (Notion, Asana, Monday) demandent trop de configuration et trop de clics pour répondre à la seule question qui compte au quotidien : *qui fait quoi, quand, et où en est chaque projet*. Lineup réduit l'outil à cette question. Une vue, une année, des barres colorées par statut, et la manipulation directe comme mode d'édition principal.

L'objectif v1 : remplacer le tableau de planning improvisé (Figma / spreadsheet) par un outil qu'on ouvre, lit et modifie en moins de 5 secondes, synchronisé entre les membres du studio.

## 3. Utilisateurs

Équipe de 2 à 5 personnes plus collaborateurs ponctuels. Pas de rôles ni de permissions en v1 : tout le monde voit tout et peut tout éditer. Usage desktop d'abord (c'est un outil de pilotage, pas un outil de terrain), mais lisible sur tablette.

## 4. Périmètre v1

**Dedans** : vue Gantt annuelle, projets avec début/fin/statut/personne assignée, création par double-clic, déplacement et redimensionnement par drag, filtres par personne et par projet, changement de statut, sync Supabase temps réel, micro-interactions.

**Dehors** (v2+) : sous-tâches, dépendances entre projets, multi-année, vues alternatives (liste, calendrier), commentaires, notifications, auth multi-comptes, mobile natif.

## 5. Structure de l'écran

Une seule page, trois zones empilées :

```
┌──────────────────────────────────────────────────────────┐
│  Lineup                      2026          [+ Ajouter]   │  ← Titre + année + CTA
├──────────────────────────────────────────────────────────┤
│  [Personne ▾]  [Statut ▾]  [Recherche projet…]           │  ← Filtres
├──────────────────────────────────────────────────────────┤
│         Jan  Fév  Mar  Avr  Mai  Juin  Juil  …  Déc      │
│  ────────────────────────────────│←aujourd'hui           │
│  Projet A      ████████████                              │
│  Projet B           ▒▒▒▒▒▒▒▒▒▒▒▒▒▒                       │  ← Le Gantt
│  Projet C  ██████        ░░░░░░░░░                       │
│  …                                                       │
└──────────────────────────────────────────────────────────┘
```

**Header** : titre de l'app à gauche, année courante au centre (flèches ‹ › pour naviguer, v1 affiche l'année courante par défaut), bouton primaire « Ajouter un projet » à droite (style CTA Rausch).

**Filtres** : deux selects (personne, statut) et un champ de recherche par nom de projet. Les filtres se combinent. Un filtre actif s'affiche comme un chip avec croix de suppression. Le Gantt se réorganise avec une transition animée quand un filtre change.

**Gantt** : la grille occupe tout le reste du viewport. Colonne gauche fixe (~220 px) avec nom du projet, avatar de la personne, et pastille statut. À droite, la timeline de l'année : 12 mois en colonnes, subdivisées en semaines (lignes verticales fines). Une ligne verticale marquée « aujourd'hui ». Chaque projet occupe une ligne, les lignes s'enchaînent verticalement dans l'ordre de date de début (puis alphabétique).

## 6. Le Gantt en détail

**Grille temporelle.** L'unité de snap est le jour. La largeur d'un jour est calculée : `largeur disponible / 365`. Les mois alternent un fond blanc / Soft Cloud très léger pour scander l'année sans charger la grille. Les week-ends ne sont pas différenciés en v1.

**Barre de projet.** Hauteur 36 px, radius 8 px, remplie de la couleur de son statut. À l'intérieur : nom du projet (tronqué avec ellipse si la barre est courte), et si la barre fait moins de ~80 px, le nom bascule à droite de la barre en gris. Poignées de redimensionnement invisibles sur les 8 px de chaque extrémité, révélées au hover (curseur `ew-resize`).

**Statuts et couleurs.** Cinq statuts, cycle de vie linéaire. La palette suit la logique Airbnb (un accent fort, le reste discipliné) :

| Statut | Couleur | Logique |
|---|---|---|
| Devisé | Contour Hairline `#dddddd`, fond blanc, texte Ink | Pas encore réel : juste un contour |
| À démarrer | Info Blue `#428bff` à 12 % de fond, texte/bord bleu | Engagé mais pas actif |
| Démarré | Rausch `#ff385c` | L'accent du système = ce qui est vivant |
| Terminé | Vert `#0a8a5f` | Validé |
| Archivé | Mute Gray `#929292` à 40 %, texte gris | S'efface visuellement |

Le statut se change par clic sur la pastille (colonne gauche) ou clic droit / menu contextuel sur la barre : un petit popover liste les cinq statuts.

**Personnes.** Chaque projet a une personne assignée (une seule en v1). Avatar = initiales sur fond gris, 24 px, rond (géométrie signature du système). La liste des personnes est une table Supabase éditable depuis le filtre (« Gérer les personnes »).

## 7. Interactions

Tout passe par la manipulation directe. Règle : **aucune action courante ne doit ouvrir un formulaire.**

- **Créer** : double-clic n'importe où dans la grille → une barre naît à cet endroit (durée par défaut 2 semaines, statut « Devisé », snappée au jour cliqué), avec un champ de nom inline en focus immédiat. Échap annule, Entrée valide.
- **Déplacer** : drag du corps de la barre, horizontalement, snap au jour. Pendant le drag, un tooltip suit la barre avec les dates « 3 fév → 21 fév ».
- **Redimensionner** : drag d'une extrémité. Même tooltip de dates. Durée minimum : 1 jour.
- **Renommer** : double-clic sur la barre → édition inline du nom.
- **Changer le statut** : clic sur la pastille ou la barre → popover de statuts.
- **Supprimer** : touche Suppr quand une barre est sélectionnée, ou via le popover. Undo par toast « Projet supprimé — Annuler » (5 s).
- **Filtrer** : les selects du header. Les lignes non concernées sortent en fondu + les restantes remontent avec une transition de position.

## 8. Micro-interactions

Le mouvement porte le sens : chaque animation confirme une action ou révèle un état, jamais de décor. Répartition des rôles :

**anime.js — transitions structurelles** (le squelette bouge) :
- Apparition des lignes au chargement : translation 8 px + fondu, stagger 30 ms par ligne.
- Réorganisation au filtre : les lignes glissent vers leur nouvelle position (300 ms, ease-out-quint).
- Naissance d'une barre au double-clic : scale-x de 0 → 1 depuis le point cliqué (250 ms, spring léger).
- Snap de fin de drag : la barre se cale sur le jour avec un micro-rebond (translation résiduelle amortie).
- Popover de statut : scale 0.95 → 1 + fondu (150 ms).

**mo.js — gratifications ponctuelles** (le moment compte) :
- Passage au statut « Terminé » : burst de particules vertes depuis la pastille — la seule célébration du système, réservée à l'événement qui le mérite.
- Création validée (Entrée sur le nom) : ring discret qui se dilate depuis la barre.

**CSS seul** : hovers, curseurs, révélation des poignées, focus rings (`0 0 0 2px #222`), pressed `scale(0.97)` sur les boutons.

Durées : 150–300 ms partout. `prefers-reduced-motion` : toutes les animations tombent à des fondus simples.

## 9. Données et synchronisation

**Supabase** (plan gratuit), deux tables :

```sql
create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'devise'
    check (status in ('devise','a_demarrer','demarre','termine','archive')),
  person_id uuid references people(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Stratégie de sync** : optimistic UI systématique — l'état local change immédiatement, l'écriture Supabase suit, rollback + toast en cas d'échec. Pendant un drag, aucune écriture : un seul `update` au drop. Abonnement Realtime sur `projects` pour refléter les éditions des autres membres (la barre d'un collègue glisse toute seule, avec la même animation de snap).

**Mode dégradé** : sans variables d'env Supabase, l'app fonctionne en localStorage avec un jeu de données de démo — utile pour le proto et les démos.

Pas d'auth en v1 : une seule instance partagée, protégée par l'obscurité de l'URL (et RLS ouvert). L'auth Supabase est le premier chantier v2.

## 10. Stack technique

- **Next.js 15** (App Router, un seul vrai écran, client component pour le Gantt)
- **Tailwind CSS 4** — tokens du design system en CSS variables
- **anime.js v4** — transitions structurelles
- **mo.js** — bursts de gratification
- **@supabase/supabase-js** — données + Realtime
- Pas de librairie Gantt : la grille est du CSS (grid + positionnement %), le drag est du pointer-event natif. C'est le cœur du produit, il doit être possédé, pas wrappé.

## 11. Design

Référence : `DESIGN/systems/airbnb/DESIGN-airbnb.md`. Ce qu'on en prend :

- **Palette** : Canvas White, Ink Black `#222`, Ash Gray `#6a6a6a`, Hairline `#dddddd`, Soft Cloud `#f7f7f7`. Rausch `#ff385c` réservé au CTA « Ajouter » et au statut « Démarré » — l'accent désigne ce qui est actif.
- **Typo** : Inter (substitut documenté de Cereal), graisse de base 500, jamais de 400. Titres avec tracking négatif léger. Une seule famille.
- **Géométrie** : radius 8 px sur les barres et boutons, 50 % sur les avatars et boutons d'icône, 32 px sur le champ de recherche (pill).
- **Profondeur** : pas d'ombre sur les barres (séparation par espace et couleur), ombre trois couches signature uniquement sur les popovers et toasts.
- **Densité** : 4–8 px dans les groupes de métadonnées, l'espace fait la hiérarchie.

## 12. Avenant v1.1 — navigation continue et groupes par personne

Validé en cours de build avec JJ, remplace les sections 5–7 sur ces points :

**Timeline continue.** La grille n'est plus l'année figée : plage de trois ans (année précédente → suivante), zoom par défaut de **trois mois** dans le viewport, centré sur aujourd'hui. Navigation par **clic-drag** sur la grille (pan), flèches mois par mois, bouton « Aujourd'hui ». La colonne de gauche reste fixe pendant le pan, le calendrier prend toute la largeur.

**Groupes par personne.** La colonne de gauche groupe les projets par membre de l'équipe (JJ, Sylvain, Kiks — portraits dans `/public`). Chaque groupe : chevron plier/déplier, portrait, compteur, CTA `+` (nouveau projet assigné, créé au centre de la vue sur un mois). Groupe plié : les barres restent visibles en **miniature** (traits de 6 px aux couleurs de statut) sur la ligne du groupe. Les projets sans personne tombent dans « Non assigné ».

**Avatars dans les barres.** Chaque barre assez large porte le portrait de son assigné à son début.

**Raccourcis.** `⌘P` : nouveau projet (un mois, centre de la vue). `⌘K` : focus recherche.

## 13. Avenant v1.2 — charge et capacité

**Capacité par personne.** Chaque membre a un maximum de projets actifs simultanés (statuts Devisé et Démarré ; Terminé et Archivé ne pèsent pas). Par défaut : JJ 4, Sylvain 3, Kiks 4 — réglable dans le panneau « Le studio » (steppers, 1–8). À saturation sur une période : le `+` du groupe est grisé avec tooltip « Nombre de projets max atteint », les miniatures de la personne sont grisées avec tooltip dans le popover d'assignation, et la création par double-clic est bloquée avec toast.

**Jauges de charge.** À côté de chaque nom : une jauge grise qui se remplit en vert selon la charge sur la **fenêtre visible** (elle vit pendant le pan), avec le compte `n/max`. Dans le header de la grille : le pourcentage de charge global du studio (somme des charges / somme des capacités) sur la même fenêtre, en rouge à 100 %+.

**Navigation.** Clic sur le mois courant dans le header → liste déroulante des 36 mois de la plage pour sauter directement.

**Statuts.** « À démarrer » supprimé — le cycle devient : Devisé → Démarré → Terminé → Archivé.

## 14. Avenant v1.3 — duplication et tag Moon-Moon

**Duplication.** Un projet se duplique depuis le popover de sa barre (« Dupliquer » remplace « Renommer », le renommage reste au double-clic), au raccourci `⌘D` (case sélectionnée), ou via l'icône double-feuille au survol d'une ligne. La copie se place juste après l'original ; les cases du même nom partagent la même ligne (badge ×n), chacune restant manipulable indépendamment. La duplication respecte les capacités.

**Survols.** Barres : léger scale + ombre portée douce. Lignes de la colonne gauche : fond gris et apparition en stagger de deux icônes — dupliquer, puis poubelle rouge (supprime toutes les cases de la ligne, undo groupé).

**Tag Moon-Moon.** Switch dans le popover ; logo Moon-Moon (jaune sur pastille ink) à côté du nom quand actif ; filtre dédié dans la barre de filtres.

**Login.** Titre centré, sous-titre « Le planning du studio. », champs et CTA à 40 px ; shader plus sombre, courbes adoucies, grain analogique.

## 15. Critères de done

1. Je crée un projet par double-clic, le nomme, le déplace et l'étire — sans jamais voir un formulaire.
2. Les cinq statuts sont lisibles d'un coup d'œil à 2 m de l'écran.
3. Un filtre par personne réorganise la vue en moins de 400 ms, avec une transition propre.
4. Deux navigateurs ouverts côte à côte se synchronisent en moins de 2 s.
5. Passer un projet en « Terminé » fait sourire.
6. Aucune animation ne dépasse 300 ms ; tout respecte `prefers-reduced-motion`.
7. L'app tourne sans Supabase configuré (mode démo localStorage).
