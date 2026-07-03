// ============================================================
//  Couche de données — Supabase (avec repli local automatique)
// ============================================================
//  - Si Supabase est configuré ET accessible : données partagées en ligne,
//    synchronisées entre tous les amis (rafraîchissement périodique + realtime).
//  - Sinon (clés absentes ou base pas encore prête) : repli sur localStorage,
//    pour que l'app fonctionne toujours.
//
//  Les pages lisent l'état en synchrone (get*) et écrivent via set* :
//  on met à jour l'état local immédiatement (optimiste), puis on pousse
//  vers Supabase en arrière-plan.

import { supabase, hasSupabase } from './supabaseClient'
import { MATCHES_2026 } from '../data/matches2026'
import { CHAMPION_WINDOW_ORDER } from './scoring'

const KEY = 'bolaocopa26.v1'

let state = {
  players: [],
  matches: [],
  bets: {},   // { [playerId]: { [matchId]: {home,away} } }
  picks: {},  // { [playerId]: { teams:[id,id,id], window } }
  settings: { championWindow: 'initial', championTeamId: null },
  ready: false,
  online: false,
}

// --- Abonnement / re-render global -------------------------------
const listeners = new Set()
let version = 0
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function getVersion() { return version }
function emit() { version++; listeners.forEach((fn) => fn()) }

// --- Repli local ------------------------------------------------
function seedLocal() {
  return {
    players: [], matches: MATCHES_2026.map((m) => ({ ...m })),
    bets: {}, picks: {}, settings: { championWindow: 'initial', championTeamId: null },
  }
}
function saveLocal() {
  if (!state.online) {
    localStorage.setItem(KEY, JSON.stringify({
      players: state.players, matches: state.matches, bets: state.bets,
      picks: state.picks, settings: state.settings,
    }))
  }
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return seedLocal()
}

// --- Hydratation Supabase --------------------------------------
function mapMatchRow(r) {
  return {
    id: r.id, phase: r.phase, group: r.grp, kickoff: r.kickoff,
    home: r.home, away: r.away,
    status: r.status ?? null, // null | 'live' | 'final'
    clock: r.clock ?? null, // horloge de jeu ESPN en direct ("47'", "90'+5'", "HT")
    winner: r.winner ?? null, // équipe qualifiée (élimination)
    psoHome: r.pso_home ?? null, // score des tirs au but (élimination)
    psoAway: r.pso_away ?? null,
    actual: r.actual_home != null && r.actual_away != null
      ? { home: r.actual_home, away: r.actual_away } : null,
  }
}

// Données GLOBALES (matchs + réglages) — communes à TOUS les groupes.
async function hydrateGlobal() {
  const [matches, settings] = await Promise.all([
    supabase.from('matches').select('*'),
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
  ])
  if (matches.error) throw matches.error
  const nextMatches = (matches.data && matches.data.length)
    ? matches.data.map(mapMatchRow).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    : MATCHES_2026.map((m) => ({ ...m }))
  state = {
    ...state,
    matches: nextMatches,
    settings: {
      championWindow: settings.data?.champion_window || 'initial',
      championTeamId: settings.data?.champion_team_id || null,
    },
    online: true,
  }
}

// Charge TOUTES les lignes d'une table filtrée par groupe, en paginant.
// ⚠️ Indispensable : Supabase/PostgREST plafonne chaque requête à 1000 lignes par défaut.
// Studio 1 dépasse 1000 paris → sans pagination, les paris au-delà de 1000 étaient
// ignorés en silence (faux « Sem palpite », points live manquants).
async function fetchAllByGroup(table, columns, g) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns)
      .eq('group_code', g).range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

// Données du GROUPE courant uniquement (joueurs + pronostics du groupe).
async function loadGroupData(g) {
  if (!g) { state = { ...state, players: [], bets: {}, picks: {} }; return }
  const [players, betsData, picksData] = await Promise.all([
    supabase.from('players').select('id, name').eq('group_code', g),
    fetchAllByGroup('bets', '*', g),          // paginé : récupère TOUS les paris (>1000)
    fetchAllByGroup('champion_picks', '*', g),
  ])
  if (players.error) throw players.error
  const nextBets = {}
  const nextPicks = {}
  for (const b of betsData) {
    if (!nextBets[b.player_id]) nextBets[b.player_id] = {}
    nextBets[b.player_id][b.match_id] = { home: b.pred_home, away: b.pred_away, qualifier: b.pred_winner ?? null }
  }
  for (const p of picksData) {
    // Chaque équipe garde SA fenêtre (window1/2/3). Repli sur l'ancien pick_window
    // (picks non encore migrés) pour rester rétro-compatible.
    const trip = [[p.team1, p.window1], [p.team2, p.window2], [p.team3, p.window3]].filter(([t]) => t)
    nextPicks[p.player_id] = {
      teams: trip.map(([t]) => t),
      windows: trip.map(([, w]) => w || p.pick_window || 'initial'),
    }
  }
  state = { ...state, players: players.data || [], bets: nextBets, picks: nextPicks }
}

// Rafraîchissement LÉGER : seulement les scores des matchs + réglages (104 lignes, quasi gratuit).
// On NE recharge PAS les pronostics de tout le monde ici — le classement ne change qu'à la fin
// d'un match, donc on le recharge à la demande (ouverture de la page Classement).
async function hydrateLight() {
  const [matches, settings] = await Promise.all([
    supabase.from('matches').select('*'),
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
  ])
  if (matches.error) throw matches.error
  const nextMatches = (matches.data && matches.data.length)
    ? matches.data.map(mapMatchRow).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    : state.matches
  state = {
    ...state,
    matches: nextMatches,
    settings: {
      championWindow: settings.data?.champion_window || state.settings.championWindow,
      championTeamId: settings.data?.champion_team_id ?? state.settings.championTeamId,
    },
  }
}

let pollTimer = null
export async function init() {
  if (hasSupabase) {
    try {
      await hydrateGlobal() // matchs + réglages (le groupe se charge à la connexion)
      pollTimer = setInterval(refresh, 60000)
      state.ready = true; emit(); return
    } catch (e) {
      console.warn('Supabase indisponible, repli local :', e?.message || e)
    }
  }
  state = { ...state, ...loadLocal(), online: false, ready: true }
  emit()
}

// Poll (scores des matchs + pronostics du groupe + dernier message pour le point rouge du chat).
// IMPORTANT : on recharge AUSSI les pronostics (loadGroupData), pas seulement les scores.
// Sinon un pari enregistré (depuis un autre appareil, ou juste avant qu'un match passe live)
// n'apparaît pas sur une page déjà ouverte → faux « Sem palpite ». Le rechargement des paris
// ne perturbe pas une saisie en cours : l'effet ne se déclenche que si la valeur SAUVÉE change.
export async function refresh() {
  if (!state.online) return
  try {
    await Promise.all([
      hydrateLight(),
      state.group ? loadGroupData(state.group) : Promise.resolve(),
    ])
    emit()
  } catch { /* garde l'état courant */ }
  if (supabase && state.group) {
    supabase.from('messages').select('created_at').eq('group_code', state.group)
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        const lat = data?.[0]?.created_at
        if (lat && lat !== state.lastChatAt) { state.lastChatAt = lat; emit() }
      }).catch(() => {})
  }
}

// Rechargement complet (scores + données du groupe) — à l'ouverture du Classement
export async function refreshAll() {
  if (!state.online) return
  try { await Promise.all([hydrateLight(), loadGroupData(state.group)]); emit() } catch { /* garde l'état */ }
}

// --- Studios créés sur cet appareil (pour afficher le bouton « Inviter » au créateur) ---
const CREATED_KEY = 'bolaocopa26.createdStudios'
export function markCreatedStudio(code) {
  if (!code) return
  try {
    const list = JSON.parse(localStorage.getItem(CREATED_KEY) || '[]')
    if (!list.includes(code)) { list.push(code); localStorage.setItem(CREATED_KEY, JSON.stringify(list)) }
  } catch { /* ignore */ }
}
export function isCreatedStudio(code) {
  if (!code) return false
  try { return JSON.parse(localStorage.getItem(CREATED_KEY) || '[]').includes(code) } catch { return false }
}

// --- Groupe courant -------------------------------------------
export function getGroup() { return state.group || null }
export async function enterGroup(g) {
  state.group = g
  if (!state.online) { emit(); return }
  startChatWatch(g) // veille du chat dès l'entrée dans le groupe (point rouge en temps réel)
  try { await loadGroupData(g) } catch { /* ignore */ }
  emit()
}
// Numéros des Studios existants (≥ 2). Studio 1 = groupe privé, jamais listé.
function studioNum(code) {
  const m = String(code || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : NaN
}
export async function listStudioNumbers() {
  if (!state.online) return []
  const { data, error } = await supabase.from('groups').select('code')
  if (error) { console.warn('list groups:', error.message); return [] }
  return (data || []).map((r) => studioNum(r.code))
    .filter((n) => Number.isFinite(n) && n >= 2)
    .sort((a, b) => a - b)
}
// Crée le prochain Studio libre en numérotation séquentielle (Studio 2, 3, 4…).
export async function createGroup() {
  if (!state.online) return 'Studio 1'
  try {
    const { data } = await supabase.from('groups').select('code')
    const used = new Set((data || []).map((r) => studioNum(r.code)).filter(Number.isFinite))
    let n = 2
    while (used.has(n)) n++
    const code = 'Studio ' + n
    const { error } = await supabase.from('groups').insert({ code })
    if (!error) return code // numéro qui se suit ✓
  } catch (e) { console.warn('create seq:', e?.message || e) }
  // Repli : RPC d'origine si l'insertion directe est refusée ou en cas de collision
  const { data, error } = await supabase.rpc('create_group')
  if (error) { console.warn('create_group:', error.message); return null }
  return data
}

// --- Lecture (synchrone) ---------------------------------------
export function isReady() { return state.ready }
export function isOnline() { return state.online }
export function getMatches() { return state.matches }
export function getPlayers() { return state.players }
export function getSettings() { return state.settings }
export function getBets(playerId) { return state.bets[playerId] || {} }
export function getPick(playerId) { return state.picks[playerId] || null }

// --- Joueurs ---------------------------------------------------
export function findPlayerByName(name) {
  const n = name.trim().toLowerCase()
  return state.players.find((p) => p.name.trim().toLowerCase() === n) || null
}
export function addPlayer(name) {
  const id = (crypto.randomUUID && crypto.randomUUID()) ||
    ('p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7))
  state.players = [...state.players, { id, name }]
  emit(); saveLocal()
  if (state.online) {
    supabase.from('players').insert({ id, name }).then(({ error }) => {
      if (error) console.warn('insert player:', error.message)
    })
  }
  return id
}

// Connexion / création / réservation avec code (PIN), vérifié côté serveur.
// Retour : { status, id?, name? }  status ∈ created | claimed | ok | wrong | invalid | error
export async function loginOrRegister(group, name, pin) {
  const n = (name || '').trim()
  const g = (group || '').trim()
  if (!state.online) {
    let p = findPlayerByName(n)
    if (!p) p = { id: addPlayer(n), name: n }
    return { status: 'ok', id: p.id, name: n }
  }
  const { data, error } = await supabase.rpc('login_or_register', { p_group: g, p_name: n, p_pin: pin })
  if (error) { console.warn('login rpc:', error.message); return { status: 'error' } }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { status: 'error' }
  if (row.id) return { status: row.status, id: row.id, name: n }
  return { status: row.status } // 'wrong' | 'invalid' | 'nogroup'
}

// --- Pronostics de match ---------------------------------------
// Verrou : un match est bloqué dès l'heure du coup d'envoi.
export function isMatchLocked(matchId) {
  const m = state.matches.find((x) => x.id === matchId)
  return !!m && new Date(m.kickoff).getTime() <= Date.now()
}
export function setBet(playerId, matchId, pred) {
  // Refus si le match a déjà commencé — impossible de modifier après le coup d'envoi
  if (isMatchLocked(matchId)) {
    console.warn('Pari refusé : le match a déjà commencé.', matchId)
    return false
  }
  if (!state.bets[playerId]) state.bets[playerId] = {}
  state.bets[playerId] = { ...state.bets[playerId], [matchId]: pred }
  emit(); saveLocal()
  if (state.online) {
    supabase.from('bets').upsert({
      player_id: playerId, match_id: matchId, group_code: state.group || 'Studio 1',
      pred_home: pred.home, pred_away: pred.away, pred_winner: pred.qualifier ?? null, updated_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.warn('upsert bet:', error.message) })
  }
  return true
}

// --- Pronostic champion ----------------------------------------
//  windows = fenêtre PAR équipe, alignée sur `teams` (cf. mergePickWindows).
export function setPick(playerId, teams, windows) {
  state.picks = { ...state.picks, [playerId]: { teams, windows } }
  emit(); saveLocal()
  if (state.online) {
    // pick_window (compat) = palier le moins avantageux des 3 (= dernière modif)
    const worst = (windows || []).reduce(
      (a, b) => (CHAMPION_WINDOW_ORDER.indexOf(b) > CHAMPION_WINDOW_ORDER.indexOf(a) ? b : a),
      'initial',
    )
    supabase.from('champion_picks').upsert({
      player_id: playerId, group_code: state.group || 'Studio 1',
      team1: teams[0] || null, team2: teams[1] || null, team3: teams[2] || null,
      window1: windows[0] || 'initial', window2: windows[1] || 'initial', window3: windows[2] || 'initial',
      pick_window: worst, updated_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.warn('upsert pick:', error.message) })
  }
}

// --- Réglages admin --------------------------------------------
export function setChampionWindow(w) {
  state.settings = { ...state.settings, championWindow: w }
  emit(); saveLocal()
  if (state.online) {
    supabase.from('settings').update({ champion_window: w }).eq('id', 1)
      .then(({ error }) => { if (error) console.warn('settings window:', error.message) })
  }
}
export function setChampionTeam(teamId) {
  state.settings = { ...state.settings, championTeamId: teamId }
  emit(); saveLocal()
  if (state.online) {
    supabase.from('settings').update({ champion_team_id: teamId }).eq('id', 1)
      .then(({ error }) => { if (error) console.warn('settings champ:', error.message) })
  }
}
export function setMatchResult(matchId, actual) {
  state.matches = state.matches.map((m) => m.id === matchId ? { ...m, actual } : m)
  emit(); saveLocal()
  if (state.online) {
    supabase.from('matches').update({
      actual_home: actual ? actual.home : null,
      actual_away: actual ? actual.away : null,
    }).eq('id', matchId).then(({ error }) => { if (error) console.warn('result:', error.message) })
  }
}

// --- Chat (messages en direct par Studio) ---------------------------------
let chatMessages = []
let chatChannel = null

const chatListeners = new Set()
export function subscribeChatMessages(fn) { chatListeners.add(fn); return () => chatListeners.delete(fn) }
export function getChatMessages() { return chatMessages }
function emitChat() { chatListeners.forEach((fn) => fn()) }

export async function loadMessages(group) {
  if (!supabase || !group) { chatMessages = []; emitChat(); return }
  try {
    const { data, error } = await supabase
      .from('messages').select('*').eq('group_code', group)
      .order('created_at', { ascending: true }).limit(200)
    if (error) throw error
    chatMessages = data || []
    emitChat()
  } catch (e) {
    console.warn('loadMessages:', e?.message || e)
    chatMessages = []; emitChat()
  }
}

export async function postMessage(group, playerId, name, text, langOrig, imageUrl = null) {
  if (!supabase || !group) return null
  try {
    const { data, error } = await supabase.functions.invoke('post-message', {
      body: {
        group_code: group, player_id: playerId, name,
        text: text || null, lang_orig: langOrig,
        image_url: imageUrl || null,
      }
    })
    if (error) { console.warn('postMessage:', error.message); return null }
    return data
  } catch (e) {
    console.warn('postMessage:', e?.message || e); return null
  }
}

export async function uploadChatImage(blob) {
  if (!supabase) return null
  const name = (crypto.randomUUID?.() || Date.now().toString(36)) + '.jpg'
  const { error } = await supabase.storage.from('chat-photos').upload(name, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) { console.warn('uploadChatImage:', error.message); return null }
  return supabase.storage.from('chat-photos').getPublicUrl(name).data.publicUrl
}

export function openChatRealtime(group) {
  if (!supabase || !group) return
  closeChatRealtime()
  chatChannel = supabase
    .channel('chat-' + group)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `group_code=eq.${group}`
    }, ({ new: msg }) => {
      chatMessages = [...chatMessages, msg]
      state.lastChatAt = msg.created_at
      emitChat()
    })
    .subscribe()
}

export function closeChatRealtime() {
  if (chatChannel && supabase) { supabase.removeChannel(chatChannel); chatChannel = null }
}

// Veille permanente du chat (point rouge instantané même quand le panneau est fermé).
// Indépendante de l'ouverture du panneau : tout nouveau message met à jour `lastChatAt`.
let chatWatchChannel = null
let chatWatchGroup = null
export async function startChatWatch(group) {
  if (!supabase || !group) return
  if (chatWatchChannel && chatWatchGroup === group) return // déjà en place
  stopChatWatch()
  chatWatchGroup = group
  // État initial : dernier message connu, pour que le point sorte dès l'ouverture de l'app.
  try {
    const { data } = await supabase.from('messages').select('created_at')
      .eq('group_code', group).order('created_at', { ascending: false }).limit(1)
    const lat = data?.[0]?.created_at
    if (lat) { state.lastChatAt = lat; emit() }
  } catch { /* ignore */ }
  chatWatchChannel = supabase
    .channel('chatwatch-' + group)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `group_code=eq.${group}`
    }, ({ new: msg }) => {
      if (msg?.created_at) { state.lastChatAt = msg.created_at; emit() }
    })
    .subscribe()
}
export function stopChatWatch() {
  if (chatWatchChannel && supabase) { supabase.removeChannel(chatWatchChannel); chatWatchChannel = null }
  chatWatchGroup = null
}

export function markChatSeen(group) {
  if (!group) return
  try { localStorage.setItem('bolaocopa26.chatSeen.' + group, new Date().toISOString()) } catch {}
}

export function getUnreadChat() {
  const g = state.group
  if (!g || !state.lastChatAt) return false
  try {
    const seen = localStorage.getItem('bolaocopa26.chatSeen.' + g)
    if (!seen) return true
    return new Date(state.lastChatAt) > new Date(seen)
  } catch { return false }
}

// --- Reset (mode local uniquement) -----------------------------
export function resetDemo() {
  if (state.online) return
  state = { ...state, ...seedLocal() }
  emit(); saveLocal()
}
