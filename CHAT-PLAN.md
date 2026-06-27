# Plan d'implémentation — Chat bilingue par Studio (BolãoCopa26)

> Plan rédigé en Opus. **À implémenter en Sonnet 4.6, effort ÉLEVÉ.**
> Règle d'or : **développement local d'abord** (aperçu), **rien de poussé tant que ce n'est pas testé**.
> C'est **purement additif** — ne PAS modifier matchs / bets / champion_picks / ranking / robot de scores.

## Objectif (demandé par Vincent)
- Chat **par Studio** (groupe), chacun apparaît sous son **pseudo de joueur**.
- **@mentions** : taper `@` propose les pseudos du Studio, ex. `@Vince` ; les mentions sont surlignées.
- **Bulle de chat flottante en bas** avec **point rouge** quand il y a des messages **non lus**.
- **Traduction automatique** : chaque message s'affiche en **portugais** pour ceux qui ont choisi 🇧🇷 et en **français** pour ceux qui ont choisi 🇫🇷 (le toggle de langue existe déjà via i18n).
- **Même esthétique** que l'app (cartes translucides, dorés/verts, mêmes polices).

## Décisions d'architecture (déjà tranchées)

### 1) Base de données — table `messages` (additive)
Colonnes :
- `id uuid pk default gen_random_uuid()`
- `group_code text not null`
- `player_id text not null` (= session.id de l'expéditeur)
- `name text not null` (pseudo dénormalisé pour l'affichage)
- `text_orig text not null`
- `lang_orig text not null` ('fr' | 'pt')
- `text_fr text` / `text_pt text` (les deux versions traduites)
- `created_at timestamptz default now()`
- Index : `(group_code, created_at)`

RLS (cohérent avec l'existant = clé anon + filtrage client par groupe) :
- `messages_read` : `select` `using (true)` (le client filtre `?group_code=eq.X`)
- `messages_insert` : interdit en direct au client → l'insertion passe **par la fonction** (voir 2). Donc PAS de policy insert pour anon (ou insert via service role dans la fonction).
- Limite longueur message : 500 caractères (contrôle abus + coût traduction).

SQL à appliquer via Management API (User-Agent navigateur sinon Cloudflare 1010) :
`POST https://api.supabase.com/v1/projects/msxnrogicxzfwvplsily/database/query`

### 2) Traduction — Edge Function `post-message` (serveur)
Le client n'insère PAS directement : il appelle la fonction `post-message` qui **traduit puis insère** (le message apparaît déjà traduit, une seule traduction par message).
- Entrée : `{ group_code, player_id, name, text, lang_orig }`
- Langue source = **la langue de l'app de l'expéditeur** (fr/pt) → pas de détection hasardeuse.
- Traduction de la langue source vers l'autre :
  - si `lang_orig='fr'` → `text_fr=text`, `text_pt=traduire(fr→pt-BR)`
  - si `lang_orig='pt'` → `text_pt=text`, `text_fr=traduire(pt→fr)`
- **Moteur de traduction** (à confirmer par Vincent) :
  - **DeepL Free** (recommandé) : 500k caractères/mois gratuits, excellente qualité FR↔pt-BR. Nécessite une clé `DEEPL_KEY` (créer un compte DeepL API Free). Endpoint `https://api-free.deepl.com/v2/translate`.
  - Alternative : **Claude Haiku** (clé Anthropic, coût minime/message) si Vincent préfère ne pas créer de compte DeepL.
  - Clé stockée en secret de la fonction : `supabase secrets set DEEPL_KEY=...`
- **@mentions** : protéger les `@pseudo` pendant la traduction (les remplacer par des jetons `__M0__` avant, restaurer après) pour que DeepL ne déforme pas les noms.
- Insertion avec la **service role key** (déjà dispo dans l'env de la fonction). Déployer en `--no-verify-jwt` (idempotence non nécessaire ; valider la longueur).

### 3) Temps réel + point rouge (hybride, économe — respecte la philosophie bande passante de l'app)
- **Point rouge / non-lus** : piloté par le **poll 60 s déjà existant** → on récupère le `created_at` du dernier message du groupe (1 requête légère). Si dernier message > "dernier-vu" (stocké en localStorage `bolaocopa26.chatSeen.<group>`) ET chat fermé → point rouge.
- **Messages en direct dans le chat** : abonnement **Supabase Realtime** activé **uniquement quand le panneau chat est ouvert** (le websocket n'existe que pendant la discussion active → pas de connexion permanente inutile). À la fermeture → on se désabonne et on met à jour "dernier-vu".
- Node 22 requis si jamais on teste Realtime côté script (déjà le cas en CI).

### 4) Frontend (React, même style)
- **store.js** (ajouts, sans toucher l'existant) :
  - `loadMessages(group)` : `select * from messages where group_code=eq.X order by created_at` (limiter aux ~200 derniers).
  - `postMessage(text)` : appelle la fonction `post-message` avec session + lang courante.
  - `subscribeChat(group, cb)` / `unsubscribeChat()` : Realtime, actif seulement panneau ouvert.
  - `getUnreadChat()` / `markChatSeen()` : via localStorage + dernier `created_at` (alimenté par le poll).
- **i18n.js** : afficher `text_fr` ou `text_pt` selon `lang` ; bouton « voir l'original » (montre `text_orig`). Nouvelles clés : `chatTitle`, `chatPlaceholder`, `send`, `seeOriginal`, `chatEmpty`, `mentionHint`.
- **Composants** (nouveaux) :
  - `ChatBubble.jsx` : bouton flottant en bas (icône 💬) + **point rouge** si non-lus ; ouvre le panneau. Réutiliser le style des boutons existants (dorés/verts).
  - `ChatPanel.jsx` : feuille/overlay (comme `entry-sheet`) avec : en-tête (Studio + fermer), **liste de messages** (pseudo en gras + heure + texte dans la langue du lecteur, mentions surlignées, auto-scroll en bas), **champ de saisie** + bouton envoyer.
  - **@mention** : à la frappe de `@`, dropdown des pseudos du Studio (depuis `getPlayers()` déjà existant), insertion `@Pseudo`. Surlignage des `@Pseudo` dans les messages (et si ça te mentionne → léger highlight de la ligne, v2).
- **App.jsx** : monter `<ChatBubble/>` quand `session` existe (à côté du reste), sans toucher la nav 3 onglets existante. La bulle est flottante (n'entre pas dans la bottom-nav).
- **CSS (index.css)** : nouvelles classes `.chat-bubble`, `.chat-dot`, `.chat-panel`, `.chat-msg`, `.chat-mention`, `.chat-input` — **reprendre** variables/couleurs/cartes existantes pour rester raccord.

### 5) Garde-fous "ne pas perturber l'app live (15 joueurs)"
- Tout est **nouveau** (table, fonction, composants, bulle flottante). Aucune modification des tables/écrans existants.
- **Tester en local** (aperçu) avec **2 sessions simulées** : une en FR, une en pt → vérifier : envoi, réception temps réel, **traduction correcte dans les deux sens**, @mention (autocomplete + surlignage + noms préservés par la traduction), **point rouge** non-lus, auto-scroll, esthétique.
- Vérifier que **rien d'autre ne bouge** (matchs/paris/classement/scores intacts) avant de pousser.
- Déployer seulement quand tout est validé. La table `messages` étant additive, sa création seule n'a aucun impact visible côté joueurs.

## Étapes d'implémentation (ordre conseillé, pour Sonnet)
1. **SQL** : créer table `messages` + RLS + index (Management API). _(faible)_
2. **Edge Function `post-message`** : traduction (protéger @mentions) + insert ; déployer + `secrets set DEEPL_KEY`. _(moyen)_
3. **store.js** : loadMessages / postMessage / subscribeChat / unread. _(moyen)_
4. **i18n** : sélection fr/pt + voir l'original + nouvelles clés. _(faible)_
5. **Composants** ChatBubble + ChatPanel + @mention autocomplete. _(moyen-élevé)_
6. **CSS** raccord à l'esthétique. _(faible-moyen)_
7. **Tests locaux** (2 utilisateurs FR/pt) — le point critique. _(moyen)_
8. **Déploiement** (push → Pages) + fonction déjà déployée. _(faible)_

## Pré-requis à fournir par Vincent
- **Clé DeepL Free** (`DEEPL_KEY`) — créer un compte DeepL API Free (ou choisir l'option Claude Haiku).
- **Token d'accès Supabase** (le `sbp_…`, encore valide jusqu'au 31/07) pour déployer la fonction + appliquer le SQL.

## Modèle & effort recommandés
- **Ce plan** : Opus (fait).
- **Implémentation** : **Sonnet 4.6**, **effort ÉLEVÉ** (le chat touche au temps réel + à l'app live → mieux vaut le faire juste du premier coup ; Sonnet/élevé reste bien moins cher qu'Opus et largement suffisant pour ce CRUD + traduction).
- Garder Opus **en réserve** uniquement si un pépin d'architecture surgit.
