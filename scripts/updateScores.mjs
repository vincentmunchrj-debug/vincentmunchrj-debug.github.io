// Robot de scores — source ESPN (diffuseurs), 100 % automatique.
// IMPORTANT : il NE FAIT QUE écrire le score des matchs TERMINÉS.
// Il ne ré-importe RIEN, n'efface RIEN, et n'écrit que si le score a changé.
import { readFileSync } from 'node:fs'

const env = (k) => process.env[k] || (() => {
  const m = readFileSync(new URL('../.env', import.meta.url), 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim().replace(/^"|"$/g, '') : ''
})()
const URL_ = env('VITE_SUPABASE_URL')
const KEY = env('VITE_SUPABASE_ANON_KEY')
const MAP = JSON.parse(readFileSync(new URL('./espn-teams.json', import.meta.url), 'utf8'))
const toMin = (i) => new Date(i).toISOString().slice(0, 16)
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '')

// Nos matchs (id, heure, équipes, score actuel)
const db = await (await fetch(`${URL_}/rest/v1/matches?select=id,kickoff,home,away,actual_home,actual_away`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json()
const dbByMin = new Map()
for (const m of db) { const k = toMin(m.kickoff); if (!dbByMin.has(k)) dbByMin.set(k, []); dbByMin.get(k).push(m) }

// ESPN : aujourd'hui + hier (UTC) pour rattraper les matchs finis après minuit
const now = new Date()
const days = []
for (let off = 1; off >= 0; off--) { const d = new Date(now); d.setUTCDate(d.getUTCDate() - off); days.push(d.toISOString().slice(0, 10).replace(/-/g, '')) }

let updates = 0, unresolved = 0
for (const ymd of days) {
  let j
  try { j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${ymd}`)).json() }
  catch (e) { console.log('ESPN err', ymd, e.message); continue }
  for (const e of j.events || []) {
    if (!e.status?.type?.completed) continue           // uniquement les matchs TERMINÉS
    const c = e.competitions[0]
    const h = c.competitors.find((x) => x.homeAway === 'home')
    const a = c.competitors.find((x) => x.homeAway === 'away')
    const hs = Number(h.score), as = Number(a.score)
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue
    const min = toMin(e.date)
    const cands = dbByMin.get(min) || []
    let match = null
    if (cands.length === 1) match = cands[0]
    else if (cands.length > 1) {
      match = cands.find((m) => m.home && m.away &&
        norm(MAP[m.home]) === norm(h.team.displayName) &&
        norm(MAP[m.away]) === norm(a.team.displayName)) || null
    }
    if (!match) { unresolved++; console.log('⚠️ NON résolu', min, h.team.displayName, `${hs}-${as}`, a.team.displayName); continue }
    if (match.actual_home === hs && match.actual_away === as) continue   // déjà à jour
    const r = await fetch(`${URL_}/rest/v1/matches?id=eq.${match.id}`, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_home: hs, actual_away: as }),
    })
    if (r.ok) { updates++; console.log('✅ MAJ', match.id, `${match.home} ${hs}-${as} ${match.away}`) }
    else console.log('PATCH err', match.id, await r.text())
  }
}
console.log(`Terminé. ${updates} mise(s) à jour, ${unresolved} non résolu(s).`)
