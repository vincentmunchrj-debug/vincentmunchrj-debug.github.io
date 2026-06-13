-- Migration : score des tirs au but pour les matchs à élimination directe.
-- À exécuter une seule fois sur la base de production (après validation).
-- Le robot update-scores remplit pso_home / pso_away depuis ESPN (shootoutScore)
-- quand un match KO se décide aux t.a.b. ; l'affichage montre « 3-3 (4-2 t.a.b.) ».

alter table public.matches add column if not exists pso_home int;
alter table public.matches add column if not exists pso_away int;
