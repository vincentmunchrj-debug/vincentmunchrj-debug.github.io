// ============================================================
//  Internationalisation — Portugais brésilien (pt) & Français (fr)
// ============================================================
import { useSyncExternalStore } from 'react'

const LANG_KEY = 'bolaocopa26.lang'
let lang = (() => { try { return localStorage.getItem(LANG_KEY) || 'pt' } catch { return 'pt' } })()

const listeners = new Set()
export function subscribeLang(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function getLang() { return lang }
export function setLang(l) {
  lang = l
  try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ }
  document.documentElement.lang = l === 'fr' ? 'fr' : 'pt-BR'
  listeners.forEach((fn) => fn())
}

const DICT = {
  pt: {
    tagline: 'Bolão entre amigos · Copa do Mundo 2026',
    enterHint: 'Toque na taça para entrar',
    authorLine: 'por Vincent Munch',
    nickname: 'Seu apelido',
    nicknamePlaceholder: 'Ex.: Vince',
    enter: 'Entrar',
    loginHelp: 'Use o mesmo apelido para reencontrar seus palpites.',
    codeLabel: 'Seu código (4 dígitos)',
    codeHint: 'Escolha um código para proteger seu apelido (não esqueça!).',
    errTaken: 'Este apelido já existe. Se for você, digite seu código. Senão, escolha outro apelido.',
    errInvalid: 'Informe um apelido e um código de 4 dígitos.',
    errGeneric: 'Erro de conexão, tente novamente.',
    groupLabel: 'Grupo',
    createGroup: '+ Criar meu próprio grupo',
    joinGroup: 'Entrar em outro grupo (com código)',
    groupCodePlaceholder: 'Ex.: Studio 4827',
    inviteShare: 'Compartilhe este link com seus amigos:',
    pubTitle: 'Crie seu grupo',
    pubSub: 'Crie seu próprio grupo e convide seus amigos. Você receberá um link para compartilhar.',
    pubCreate: '+ Criar um Studio',
    pubOr: 'ou',
    joinTitle: 'Entrar em um Studio',
    joinBtn: 'Entrar',
    pubInviteNote: 'Dica: ao abrir o link enviado pelo seu amigo, você entra direto no grupo dele.',
    errNoGroup: 'Grupo não encontrado.',
    copy: 'Copiar', copied: 'Copiado!',
    subtitle: 'Copa do Mundo 2026',
    logout: 'sair',
    online: 'online',
    local: 'local',
    loading: 'Carregando…',
    // Nav
    navMatches: 'Jogos', navChampion: 'Campeão', navRanking: 'Ranking', navAdmin: 'Admin',
    // Matches
    matchesTitle: 'Jogos',
    matchesBanner: 'Acerte o vencedor (2 pts) + o saldo de gols (+1) + o placar exato (+1). Máx. 4 pts por jogo.',
    group: 'Grupo',
    result: 'Resultado',
    started: '🔒 começou',
    open: 'aberto',
    savePick: 'Salvar palpite',
    saved: '✓ Salvo!',
    whoQualifies: 'Quem se classifica? (pênaltis)',
    yourPick: 'Seu palpite',
    noPick: 'Sem palpite 😬',
    winnerOk: 'vencedor ✓', diffOk: 'saldo ✓', exactOk: 'exato ✓',
    pts: 'pts',
    pendingKo: (n) => `+ ${n} jogos do mata-mata serão liberados conforme as equipes se classificarem.`,
    // Champion
    championTitle: 'Campeão da Copa',
    championBanner: 'Escolha 3 seleções. Se uma delas for campeã, você pontua! Quanto antes você fixa e mantém, mais vale.',
    currentWindow: 'Janela atual',
    yourChoice: 'Sua escolha atual',
    worth: 'Vale', worthUpTo: 'Vale até',
    selected: 'Selecionadas',
    save: 'Salvar',
    lockedTitle: 'As escolhas estão travadas (começaram as quartas). Boa sorte!',
    // Ranking
    rankingTitle: 'Ranking',
    cupChampion: 'Campeão da Copa',
    noPlayers: 'Ainda não há jogadores.',
    you: 'você',
    rankGames: 'Jogos', rankChampion: 'Campeão',
    totalNote: 'Total = pontos dos jogos + pontos do campeão.',
    // Admin
    adminTitle: 'Admin',
    adminBanner: 'Espaço do organizador: lançar resultados, avançar a janela do campeão e definir o campeão.',
    adminWindowLabel: 'Janela do palpite "Campeão"',
    adminWindowHelp: 'Avance conforme a competição. "Encerrado" trava as escolhas (a partir das quartas).',
    adminChampLabel: 'Campeão da Copa (para pontuar)',
    notDefined: '— ainda não definido —',
    adminResults: 'Resultados dos jogos',
    resetDemo: '♻️ Reiniciar demonstração',
    resetConfirm: 'Reiniciar todos os dados de demonstração?',
    // Fenêtres champion (avec points)
    champWin: {
      initial: 'Escolha inicial — 25 pts',
      after_groups: 'Após a fase de grupos — 15 pts',
      after_r32: 'Após os 16-avos — 12 pts',
      after_r16: 'Após as oitavas — 10 pts',
      closed: 'Encerrado (a partir das quartas)',
    },
    champHint: {
      initial: 'Você ainda pode escolher e vale 25 pontos se acertar.',
      after_groups: 'Mudar agora vale no máximo 15 pontos.',
      after_r32: 'Mudar agora vale no máximo 12 pontos.',
      after_r16: 'Mudar agora vale no máximo 10 pontos. Última chance!',
      closed: 'As escolhas estão travadas. Boa sorte!',
    },
  },
  fr: {
    tagline: 'Pronostics entre amis · Coupe du Monde 2026',
    enterHint: 'Touchez la coupe pour entrer',
    authorLine: 'par Vincent Munch',
    nickname: 'Votre pseudo',
    nicknamePlaceholder: 'Ex. : Vince',
    enter: 'Entrer',
    loginHelp: 'Utilisez le même pseudo pour retrouver vos pronostics.',
    codeLabel: 'Votre code (4 chiffres)',
    codeHint: 'Choisis un code pour protéger ton pseudo (ne l\'oublie pas !).',
    errTaken: 'Ce pseudo est déjà utilisé. Si c\'est toi, entre ton code. Sinon, choisis un autre pseudo.',
    errInvalid: 'Indique un pseudo et un code à 4 chiffres.',
    errGeneric: 'Erreur de connexion, réessaie.',
    groupLabel: 'Groupe',
    createGroup: '+ Créer mon propre groupe',
    joinGroup: 'Rejoindre un autre groupe (avec un code)',
    groupCodePlaceholder: 'Ex. : Studio 4827',
    inviteShare: 'Partage ce lien avec tes amis :',
    pubTitle: 'Crée ton groupe',
    pubSub: 'Crée ton propre groupe et invite tes amis. Tu recevras un lien à partager.',
    pubCreate: '+ Créer un Studio',
    pubOr: 'ou',
    joinTitle: 'Entrer dans un Studio',
    joinBtn: 'Entrer',
    pubInviteNote: 'Astuce : en ouvrant le lien envoyé par le créateur, tu entres directement dans son Studio.',
    errNoGroup: 'Groupe introuvable.',
    copy: 'Copier', copied: 'Copié !',
    subtitle: 'Coupe du Monde 2026',
    logout: 'quitter',
    online: 'en ligne',
    local: 'local',
    loading: 'Chargement…',
    navMatches: 'Matchs', navChampion: 'Champion', navRanking: 'Classement', navAdmin: 'Admin',
    matchesTitle: 'Matchs',
    matchesBanner: 'Trouvez le vainqueur (2 pts) + la différence de buts (+1) + le score exact (+1). Max 4 pts par match.',
    group: 'Groupe',
    result: 'Résultat',
    started: '🔒 commencé',
    open: 'ouvert',
    savePick: 'Enregistrer',
    saved: '✓ Enregistré !',
    whoQualifies: 'Qui se qualifie ? (tirs au but)',
    yourPick: 'Votre prono',
    noPick: 'Pas de prono 😬',
    winnerOk: 'vainqueur ✓', diffOk: 'diff ✓', exactOk: 'exact ✓',
    pts: 'pts',
    pendingKo: (n) => `+ ${n} matchs à élimination directe s'afficheront au fil des qualifications.`,
    championTitle: 'Vainqueur de la Coupe',
    championBanner: 'Choisissez 3 équipes. Si l\'une d\'elles est championne, vous marquez ! Plus vous fixez tôt et gardez, plus ça rapporte.',
    currentWindow: 'Fenêtre actuelle',
    yourChoice: 'Votre choix actuel',
    worth: 'Vaut', worthUpTo: 'Vaut jusqu\'à',
    selected: 'Sélectionnées',
    save: 'Enregistrer',
    lockedTitle: 'Les choix sont verrouillés (les quarts ont commencé). Bonne chance !',
    rankingTitle: 'Classement',
    cupChampion: 'Vainqueur de la Coupe',
    noPlayers: 'Aucun joueur pour l\'instant.',
    you: 'vous',
    rankGames: 'Matchs', rankChampion: 'Champion',
    totalNote: 'Total = points des matchs + points du champion.',
    adminTitle: 'Admin',
    adminBanner: 'Espace organisateur : saisir les résultats, avancer la fenêtre du champion et désigner le champion.',
    adminWindowLabel: 'Fenêtre du pronostic « Champion »',
    adminWindowHelp: 'Avancez au fil de la compétition. « Fermé » verrouille les choix (dès les quarts).',
    adminChampLabel: 'Vainqueur de la Coupe (pour le calcul)',
    notDefined: '— pas encore défini —',
    adminResults: 'Résultats des matchs',
    resetDemo: '♻️ Réinitialiser la démo',
    resetConfirm: 'Réinitialiser toutes les données de démonstration ?',
    champWin: {
      initial: 'Choix initial — 25 pts',
      after_groups: 'Après la phase de groupes — 15 pts',
      after_r32: 'Après les 16es — 12 pts',
      after_r16: 'Après les 8es — 10 pts',
      closed: 'Fermé (dès les quarts)',
    },
    champHint: {
      initial: 'Vous pouvez encore choisir : 25 points si vous trouvez.',
      after_groups: 'Changer maintenant vaut au maximum 15 points.',
      after_r32: 'Changer maintenant vaut au maximum 12 points.',
      after_r16: 'Changer maintenant vaut au maximum 10 points. Dernière chance !',
      closed: 'Les choix sont verrouillés. Bonne chance !',
    },
  },
}

// Hook : renvoie { lang, t } et re-render au changement de langue
export function useT() {
  const l = useSyncExternalStore(subscribeLang, getLang)
  const dict = DICT[l] || DICT.pt
  const t = (key) => dict[key]
  return { lang: l, t, dict }
}
