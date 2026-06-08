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
//  Le nombre de points dépend de la DERNIÈRE modification de ses 3 équipes :
//
//   - jamais changé depuis le début ..................... 25 pts
//   - modifié après la phase de groupes ................. 15 pts
//   - modifié après les 16es (tour à 32 équipes) ........ 12 pts
//   - modifié après les 8es (tour à 16 équipes) ......... 10 pts
//   - verrouillage définitif au début des quarts ....... (plus de modif)
//
//  La « fenêtre » de modification (championWindow) est posée au moment
//  où le joueur enregistre, selon la phase courante du tournoi.
export const CHAMPION_POINTS = {
  initial: 25,      // choix initial, jamais retouché
  after_groups: 15, // dernière modif après la phase de groupes
  after_r32: 12,    // dernière modif après les 16es
  after_r16: 10,    // dernière modif après les 8es
}

// Calcule les points de la compétition 2 pour un joueur.
//  pick = { teams: [id, id, id], window: 'initial' | 'after_groups' | ... }
//  championTeamId = équipe réellement championne (ou null si pas encore connue)
export function scoreChampion(pick, championTeamId) {
  if (!pick || !championTeamId) return { points: 0, hit: false }
  if (!Array.isArray(pick.teams)) return { points: 0, hit: false }
  const hit = pick.teams.includes(championTeamId)
  if (!hit) return { points: 0, hit: false }
  return { points: CHAMPION_POINTS[pick.window] ?? 0, hit: true }
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
    if (!m || !m.actual) continue
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
