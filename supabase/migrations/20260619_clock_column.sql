-- Affichage du temps EXACT en direct : on stocke l'horloge de jeu fournie par ESPN
-- (ex. "47'", "90'+5'", "HT"). Purement ADDITIF et non destructif :
-- colonne nullable, aucune donnée ni aucun affichage existant n'est impacté.
alter table public.matches add column if not exists clock text;
