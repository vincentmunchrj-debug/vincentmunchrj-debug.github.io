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
    winner: r.winner ?? null, // équipe qualifiée (élimination)
    actual: r.actual_home != null && r.actual_away != null
      ? { home: r.actual_home, away: r.actual_away } : null,
  }
}

async function hydrateOnline() {
  const [players, matches, bets, picks, settings] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('matches').select('*'),
    supabase.from('bets').select('*'),
    supabase.from('champion_picks').select('*'),
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
  ])
  if (players.error || matches.error || bets.error || picks.error) {
    throw players.error || matches.error || bets.error || picks.error
  }

  const next = {
    players: players.data || [],
    matches: (matches.data && matches.data.length)
      ? matches.data.map(mapMatchRow).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
      : MATCHES_2026.map((m) => ({ ...m })), // calendrier de secours si pas encore importé
    bets: {},
    picks: {},
    settings: {
      championWindow: settings.data?.champion_window || 'initial',
      championTeamId: settings.data?.champion_team_id || null,
    },
  }
  for (const b of bets.data || []) {
    if (!next.bets[b.player_id]) next.bets[b.player_id] = {}
    next.bets[b.player_id][b.match_id] = { home: b.pred_home, away: b.pred_away, qualifier: b.pred_winner ?? null }
  }
  for (const p of picks.data || []) {
    next.picks[p.player_id] = {
      teams: [p.team1, p.team2, p.team3].filter(Boolean),
      window: p.pick_window || 'initial',
    }
  }
  state = { ...state, ...next, online: true }
}

let pollTimer = null
export async function init() {
  if (hasSupabase) {
    try {
      await hydrateOnline()
      // Rafraîchissement périodique (robuste, simple) + realtime si dispo
      pollTimer = setInterval(refresh, 60000) // 60 s : économise la bande passante (marge x3)
      try {
        supabase.channel('bolao')
          .on('postgres_changes', { event: '*', schema: 'public' }, () => refresh())
          .subscribe()
      } catch { /* realtime optionnel */ }
      state.ready = true; emit(); return
    } catch (e) {
      console.warn('Supabase indisponible, repli local :', e?.message || e)
    }
  }
  state = { ...state, ...loadLocal(), online: false, ready: true }
  emit()
}

export async function refresh() {
  if (!state.online) return
  try { await hydrateOnline(); emit() } catch { /* garde l'état courant */ }
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
      player_id: playerId, match_id: matchId,
      pred_home: pred.home, pred_away: pred.away, pred_winner: pred.qualifier ?? null, updated_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.warn('upsert bet:', error.message) })
  }
  return true
}

// --- Pronostic champion ----------------------------------------
export function setPick(playerId, teams, windowName) {
  state.picks = { ...state.picks, [playerId]: { teams, window: windowName } }
  emit(); saveLocal()
  if (state.online) {
    supabase.from('champion_picks').upsert({
      player_id: playerId, team1: teams[0] || null, team2: teams[1] || null,
      team3: teams[2] || null, pick_window: windowName, updated_at: new Date().toISOString(),
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

// --- Reset (mode local uniquement) -----------------------------
export function resetDemo() {
  if (state.online) return
  state = { ...state, ...seedLocal() }
  emit(); saveLocal()
}
