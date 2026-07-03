// ============================================================
//  CŒUR LOGIQUE — Calcul des points BolãoCopa26
// ============================================================
//  Deux compétitions :
//   1) Pronostics des matchs (max 4 pts / match)
//   2) Pronostic du vainqueur de la Coupe (25 / 15 / 12 / 10 pts)
// ============================================================

// --- Signe d'un résultat : 1 = victoire domicile, 0 = nul, -1 = victoire extérieur
function outcome(home, away) {
  if (home > away) return 1
  if (home < away) return -1
  return 0
}

// ------------------------------------------------------------
//  COMPÉTITION 1 — un match
// ------------------------------------------------------------
//  pred   = { home, away }  -> le pronostic du joueur
//  actual = { home, away }  -> le score réel
//
//  Règles (les points de diff/score exact NÉCESSITENT le bon vainqueur,
//  on ne peut pas avoir le bon score « à l'envers ») :
//   - bon vainqueur (ou nul)        -> 2 pts
//   - + bonne différence de buts    -> +1 pt
//   - + score exact                 -> +1 pt
//   => maximum 4 pts
//
//  ctx (matchs à élimination) = { homeId, awayId, realWinner }
//   - realWinner : équipe réellement qualifiée (vainqueur aux t.a.b. en cas de nul). null sinon.
//   - pred.qualifier : équipe que le joueur désigne comme qualifiée s'il prédit un nul.
//
//  Le « vainqueur » (2 pts) = bonne équipe qualifiée (pour un match à élimination,
//  le qualifié aux tirs au but). La diff et le score exact se calculent sur le score
//  (même sens requis) — et restent acquis même si le qualifié est faux sur un nul.
//
//  Retour : { points, gotWinner, gotDiff, gotExact }
function winnerOf(h, a, homeId, awayId, drawWinner) {
  if (h > a) return homeId
  if (a > h) return awayId
  return drawWinner ?? null // nul : qualifié (élimination) ou null (groupe)
}

export function scoreMatch(pred, actual, ctx = {}) {
  const empty = { points: 0, gotWinner: false, gotDiff: false, gotExact: false }
  if (!pred || !actual) return empty
  if (pred.home == null || pred.away == null) return empty
  if (actual.home == null || actual.away == null) return empty

  const { homeId, awayId, realWinner = null } = ctx
  const predWinner = winnerOf(pred.home, pred.away, homeId, awayId, pred.qualifier ?? null)
  const realWin = winnerOf(actual.home, actual.away, homeId, awayId, realWinner)

  let points = 0
  // 1) Bon vainqueur / qualifié (inclut le nul de groupe : null === null)
  const gotWinner = predWinner === realWin
  if (gotWinner) points += 2

  // 2 & 3) Diff et score exact : seulement si le score va dans le même sens
  let gotDiff = false
  let gotExact = false
  if (outcome(pred.home, pred.away) === outcome(actual.home, actual.away)) {
    gotDiff = (pred.home - pred.away) === (actual.home - actual.away)
    if (gotDiff) points += 1
    gotExact = pred.home === actual.home && pred.away === actual.away
    if (gotExact) points += 1
  }

  return { points, gotWinner, gotDiff, gotExact }
}

// ------------------------------------------------------------
//  COMPÉTITION 2 — Vainqueur de la Coupe
// ------------------------------------------------------------
//  Le joueur choisit 3 équipes. Il suffit qu'UNE devienne championne.
//  Le barème s'applique ÉQUIPE PAR ÉQUIPE : chaque équipe garde la « fenêtre »
//  du moment où elle a été choisie. Remplacer une équipe ne dégrade QUE cette
//  équipe-là ; les équipes conservées gardent leur palier d'origine.
//
//   - choisie au départ, jamais changée ................. 25 pts
//   - (r)ajoutée après la phase de groupes .............. 15 pts
//   - (r)ajoutée après les 16es (tour à 32 équipes) ..... 12 pts
//   - (r)ajoutée après les 8es (tour à 16 équipes) ...... 10 pts
//   - verrouillage définitif au début des quarts ....... (plus de modif)
//
//  À l'enregistrement, chaque équipe reçoit : sa fenêtre d'origine si elle
//  était déjà présente, ou la fenêtre courante si elle vient d'être ajoutée
//  (cf. mergePickWindows).
export const CHAMPION_POINTS = {
  initial: 25,      // équipe choisie au départ, jamais retouchée
  after_groups: 15, // équipe (r)ajoutée après la phase de groupes
  after_r32: 12,    // équipe (r)ajoutée après les 16es
  after_r16: 10,    // équipe (r)ajoutée après les 8es
}

// Ordre des paliers, du plus au moins avantageux. Sert au repli de compat
// (pick_window = palier le moins avantageux des 3).
export const CHAMPION_WINDOW_ORDER = ['initial', 'after_groups', 'after_r32', 'after_r16', 'closed']

// Fenêtre d'une équipe donnée dans un pick.
// Repli sur l'ancienne window unique (`pick.window`) pour les picks non migrés.
export function windowOfTeam(pick, index) {
  if (pick && Array.isArray(pick.windows) && pick.windows[index] != null) return pick.windows[index]
  return (pick && pick.window) || 'initial'
}

// Calcule les points de la compétition 2 pour un joueur.
//  pick = { teams: [id, id, id], windows: ['initial', 'after_r16', ...] }
//  championTeamId = équipe réellement championne (ou null si pas encore connue)
//  Les points = ceux de la fenêtre DE L'ÉQUIPE championne.
export function scoreChampion(pick, championTeamId) {
  if (!pick || !championTeamId) return { points: 0, hit: false }
  if (!Array.isArray(pick.teams)) return { points: 0, hit: false }
  const idx = pick.teams.indexOf(championTeamId)
  if (idx < 0) return { points: 0, hit: false }
  const w = windowOfTeam(pick, idx)
  return { points: CHAMPION_POINTS[w] ?? 0, hit: true }
}

// Recalcule la fenêtre de CHAQUE équipe lors d'un enregistrement :
//  - équipe déjà présente (conservée)  -> garde sa fenêtre d'origine
//  - équipe nouvelle (remplacement)    -> prend la fenêtre courante (palier du moment)
export function mergePickWindows(oldPick, newTeams, currentWindow) {
  const oldTeams = (oldPick && Array.isArray(oldPick.teams)) ? oldPick.teams : []
  return newTeams.map((id) => {
    const i = oldTeams.indexOf(id)
    return i < 0 ? currentWindow : windowOfTeam(oldPick, i)
  })
}

// ------------------------------------------------------------
//  TOTAUX — agrège tout pour un joueur
// ------------------------------------------------------------
//  bets   = [{ matchId, pred }]      pronostics du joueur
//  matches= [{ id, actual, ... }]    matchs (avec score réel si dispo)
//  pick   = pronostic vainqueur du joueur
//  championTeamId = champion réel
//
//  Retour : { matchPoints, championPoints, total, detail: [...] }
export function tallyPlayer(bets, matches, pick, championTeamId) {
  const byId = new Map(matches.map((m) => [m.id, m]))
  let matchPoints = 0
  const detail = []

  for (const bet of bets || []) {
    const m = byId.get(bet.matchId)
    // On ne compte un match QUE s'il est terminé (le classement ne bouge pas pendant le direct).
    if (!m || !m.actual || m.status === 'live') continue
    const r = scoreMatch(bet.pred, m.actual, { homeId: m.home, awayId: m.away, realWinner: m.winner })
    matchPoints += r.points
    detail.push({ matchId: bet.matchId, ...r })
  }

  const champ = scoreChampion(pick, championTeamId)
  return {
    matchPoints,
    championPoints: champ.points,
    championHit: champ.hit,
    total: matchPoints + champ.points,
    detail,
  }
}
