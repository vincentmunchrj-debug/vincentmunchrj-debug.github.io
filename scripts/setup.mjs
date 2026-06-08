// ============================================================
//  Mise en place / mise à jour des données Supabase
//  Usage :  node scripts/setup.mjs
//   1) remplit la table `teams` (48 équipes pt-BR)
//   2) importe le calendrier + les scores depuis football-data.org
//  À relancer pour mettre à jour les scores et les matchs à élimination directe.
// ============================================================
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { TEAMS } from '../src/data/teams.js'

// --- Lecture du .env (simple)
const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const FD = env.VITE_FOOTBALL_DATA_KEY
if (!URL_ || !KEY) { console.error('❌ Clés Supabase manquantes dans .env'); process.exit(1) }

const sb = createClient(URL_, KEY)

const PHASE = {
  GROUP_STAGE: 'groups', LAST_32: 'r32', LAST_16: 'r16',
  QUARTER_FINALS: 'quarters', SEMI_FINALS: 'semis', THIRD_PLACE: 'third', FINAL: 'final',
}

async function seedTeams() {
  const rows = TEAMS.map((t) => ({ id: t.id, name: t.pt, flag: t.flag }))
  const { error } = await sb.from('teams').upsert(rows)
  if (error) throw error
  console.log(`✅ ${rows.length} équipes enregistrées`)
}

async function importMatches() {
  if (!FD) { console.log('⏭️  Pas de token football-data : import des matchs ignoré'); return }
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': FD },
  })
  if (!res.ok) throw new Error('football-data HTTP ' + res.status)
  const data = await res.json()
  const teamIds = new Set(TEAMS.map((t) => t.id))
  const rows = data.matches.map((m) => {
    const score = m.score?.fullTime || {}
    const home = m.homeTeam?.tla
    const away = m.awayTeam?.tla
    return {
      id: 'wc' + m.id,
      phase: PHASE[m.stage] || m.stage.toLowerCase(),
      grp: m.group ? m.group.replace('GROUP_', '') : null,
      kickoff: m.utcDate,
      home: teamIds.has(home) ? home : null,
      away: teamIds.has(away) ? away : null,
      actual_home: m.status === 'FINISHED' ? score.home : null,
      actual_away: m.status === 'FINISHED' ? score.away : null,
    }
  })
  const { error } = await sb.from('matches').upsert(rows)
  if (error) throw error
  const finished = rows.filter((r) => r.actual_home != null).length
  console.log(`✅ ${rows.length} matchs importés (${finished} terminés avec score)`)
  return data
}

// ------------------------------------------------------------
//  Réglages AUTOMATIQUES (aucune intervention humaine)
//   - fenêtre du champion : avance selon l'état du tournoi
//   - champion : vainqueur de la finale, dès le coup de sifflet final
// ------------------------------------------------------------
function computeWindow(matches) {
  const ofStage = (st) => matches.filter((m) => m.stage === st)
  const allFinished = (arr) => arr.length > 0 && arr.every((m) => m.status === 'FINISHED')
  const anyStarted = (arr) => arr.some((m) => new Date(m.utcDate) <= new Date())
  if (anyStarted(ofStage('QUARTER_FINALS'))) return 'closed'      // verrouillé dès les quarts
  if (allFinished(ofStage('LAST_16'))) return 'after_r16'         // 10 pts
  if (allFinished(ofStage('LAST_32'))) return 'after_r32'         // 12 pts
  if (allFinished(ofStage('GROUP_STAGE'))) return 'after_groups'  // 15 pts
  return 'initial'                                                // 25 pts
}

function computeChampion(matches) {
  const final = matches.find((m) => m.stage === 'FINAL')
  if (!final || final.status !== 'FINISHED') return null
  const w = final.score?.winner // gère aussi les tirs au but
  if (w === 'HOME_TEAM') return final.homeTeam?.tla
  if (w === 'AWAY_TEAM') return final.awayTeam?.tla
  return null
}

async function autoSettings(data) {
  const matches = data.matches
  const window = computeWindow(matches)
  const champ = computeChampion(matches)
  const patch = { champion_window: window }
  if (champ) patch.champion_team_id = champ // dès la fin de la finale → classement à jour
  const { error } = await sb.from('settings').update(patch).eq('id', 1)
  if (error) throw error
  console.log(`✅ Réglages auto: fenêtre=${window}${champ ? `, champion=${champ}` : ''}`)
}

try {
  await seedTeams()
  const data = await importMatches()
  if (data) await autoSettings(data)
  console.log('\n🎉 Terminé.')
} catch (e) {
  console.error('❌', e.message || e)
  process.exit(1)
}
