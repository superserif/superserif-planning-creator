# Lineup

Planning de projets en vue Gantt annuelle. Une page : l'année du studio, chaque projet est une barre qu'on attrape, étire et déplace. PRD complet dans `../PRD.md`.

## Lancer

```bash
npm install
npm run dev
```

Sans configuration, l'app tourne en **mode démo** : données en localStorage, seed de démonstration, pas de page de connexion, sync entre onglets via l'événement `storage`.

## Supabase et authentification

Le projet de prod est branché sur Supabase (projet `lineup`, région Paris). Pour reproduire l'environnement :

1. Créer un projet sur [supabase.com](https://supabase.com) (plan gratuit) et exécuter `supabase/schema.sql` dans le SQL Editor — tables, RLS, Realtime et seed de l'équipe.
2. Copier `.env.local.example` vers `.env.local` et remplir l'URL et la clé anon (Settings → API).
3. Créer le compte d'équipe : Authentication → Users → Add user (email + mot de passe, confirmé).

Quand Supabase est configuré, l'app est protégée par une page de connexion (un seul compte d'équipe pour l'instant). Les tables sont en RLS `authenticated` uniquement : la garde côté client est du confort, la vraie frontière est en base. La sync temps réel entre clients passe par Supabase Realtime.

## Utilisation

La vue couvre trois mois par défaut, centrée sur aujourd'hui, sur une plage continue de trois ans. La colonne de gauche groupe les projets par personne et reste fixe pendant la navigation.

- **Se déplacer** : clic-drag sur la grille (ou scroll horizontal), flèches du header, « Aujourd'hui » pour revenir.
- **Créer** : `⌘P` ou « Ajouter un projet » (un mois, au centre de la vue), le `+` d'un groupe (assigné à la personne), ou double-clic dans la grille au jour voulu.
- **Grouper** : chevron pour plier/déplier une personne ; un groupe plié garde une représentation miniature de ses barres.
- **Déplacer / redimensionner** : drag du corps de la barre ou de ses extrémités, snap au jour.
- **Statut / personne / suppression** : clic sur la barre ou sur la pastille de statut.
- **Renommer** : double-clic sur la barre.
- **Supprimer** : touche Suppr sur la barre sélectionnée — annulable depuis le toast.
- **Rechercher** : `⌘K`, ou les filtres personne/statut.

Les portraits de l'équipe vivent dans `public/portrait-*.png` et sont référencés par `people.avatar`.

## Stack

Next.js (App Router) · Tailwind CSS 4 · anime.js 4 (transitions structurelles) · mo.js (burst au passage en « Terminé ») · @supabase/supabase-js. Pas de librairie Gantt : la grille est du CSS, le drag des pointer events natifs.

Design : tokens dérivés du système Airbnb (`DESIGN/systems/airbnb/DESIGN-airbnb.md`) — Ink `#222`, Hairline `#ddd`, Rausch `#ff385c` réservé au CTA et au statut « Démarré », Inter en graisse 500 minimum, ombre trois couches sur les surfaces flottantes uniquement.
