-- ============================================================
--  BolãoCopa26 — Schéma Supabase
--  À coller dans Supabase > SQL Editor > New query, puis "Run".
-- ============================================================

-- Joueurs (amis)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Équipes
create table if not exists teams (
  id text primary key,        -- ex. 'BRA'
  name text not null,
  flag text
);

-- Matchs
create table if not exists matches (
  id text primary key,        -- ex. 'm1' ou id football-data.org
  phase text not null,        -- groups | r32 | r16 | quarters | semis | final
  grp text,                   -- groupe (A, B, ...)
  kickoff timestamptz not null,
  home text references teams(id),
  away text references teams(id),
  actual_home int,            -- null tant que pas joué
  actual_away int
);

-- Pronostics de match
create table if not exists bets (
  player_id uuid references players(id) on delete cascade,
  match_id text references matches(id) on delete cascade,
  pred_home int not null,
  pred_away int not null,
  updated_at timestamptz default now(),
  primary key (player_id, match_id)
);

-- Pronostic "champion" (3 équipes)
create table if not exists champion_picks (
  player_id uuid primary key references players(id) on delete cascade,
  team1 text references teams(id),
  team2 text references teams(id),
  team3 text references teams(id),
  pick_window text not null default 'initial',  -- initial|after_groups|after_r32|after_r16 (window est réservé en SQL)
  updated_at timestamptz default now()
);

-- Réglages globaux (une seule ligne)
create table if not exists settings (
  id int primary key default 1,
  champion_window text not null default 'initial', -- ...|closed
  champion_team_id text references teams(id)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
--  Sécurité (RLS). Démarrage simple entre amis : lecture/écriture
--  publiques via la clé anon. À durcir plus tard si besoin.
-- ------------------------------------------------------------
alter table players enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table bets enable row level security;
alter table champion_picks enable row level security;
alter table settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['players','teams','matches','bets','champion_picks','settings']
  loop
    execute format('drop policy if exists p_all on %I;', t);
    execute format('create policy p_all on %I for all using (true) with check (true);', t);
  end loop;
end $$;
