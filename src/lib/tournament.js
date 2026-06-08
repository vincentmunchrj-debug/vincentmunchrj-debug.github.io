// ============================================================
//  Fenêtres de modification du pronostic "champion" (Compétition 2)
// ============================================================
//
//  Plutôt que de déduire le palier des phases de match, on le pilote par
//  un réglage ADMIN explicite : la "fenêtre" actuellement ouverte.
//  Quand un joueur enregistre ses 3 équipes, son pronostic est estampillé
//  avec la fenêtre courante => c'est la DERNIÈRE modification qui fixe le palier.
//
//   'initial'      -> 25 pts  (avant / pendant la phase de groupes)
//   'after_groups' -> 15 pts  (après la phase de groupes)
//   'after_r32'    -> 12 pts  (après les 16es, tour à 32)
//   'after_r16'    -> 10 pts  (après les 8es, tour à 16)
//   'closed'       -> verrouillé (début des quarts de finale) : plus de modif
//
//  L'admin fait simplement avancer cette fenêtre au fil de la compétition.

export const CHAMPION_WINDOWS = ['initial', 'after_groups', 'after_r32', 'after_r16', 'closed']

export const CHAMPION_WINDOW_LABEL = {
  initial: 'Escolha inicial — 25 pts',
  after_groups: 'Após a fase de grupos — 15 pts',
  after_r32: 'Após os 16-avos — 12 pts',
  after_r16: 'Após as oitavas — 10 pts',
  closed: 'Encerrado (a partir das quartas)',
}

// Description courte (pt-BR) de l'état pour le joueur
export const CHAMPION_WINDOW_HINT = {
  initial: 'Você ainda pode escolher e vale 25 pontos se acertar.',
  after_groups: 'Mudar agora vale no máximo 15 pontos.',
  after_r32: 'Mudar agora vale no máximo 12 pontos.',
  after_r16: 'Mudar agora vale no máximo 10 pontos. Última chance!',
  closed: 'As escolhas estão travadas. Boa sorte!',
}

export function isChampionLocked(currentWindow) {
  return currentWindow === 'closed'
}
