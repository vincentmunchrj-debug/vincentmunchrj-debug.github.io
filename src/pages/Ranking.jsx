import { useSession } from '../App.jsx'
import { getPlayers, getMatches, getBets, getPick, getSettings } from '../lib/store.js'
import { tallyPlayer } from '../lib/scoring.js'
import { teamName } from '../data/teams.js'
import { useT } from '../i18n.js'
import Crest from '../components/Crest.jsx'

export default function Ranking() {
  const { session } = useSession()
  const { t, lang } = useT()
  const players = getPlayers()
  const matches = getMatches()
  const settings = getSettings()
  const championTeamId = settings.championTeamId

  const rows = players.map((p) => {
    const bets = getBets(p.id)
    const betList = Object.entries(bets).map(([matchId, pred]) => ({ matchId, pred }))
    const pick = getPick(p.id)
    const tly = tallyPlayer(betList, matches, pick, championTeamId)
    return { player: p, ...tly, pick }
  })
  rows.sort((a, b) => b.total - a.total || b.matchPoints - a.matchPoints)

  return (
    <div>
      <h2 className="page-title">📊 {t('rankingTitle')}</h2>

      {championTeamId && (
        <div className="banner row" style={{ gap: 8, alignItems: 'center' }}>
          🏆 {t('cupChampion')}: <Crest id={championTeamId} size={22} /> <strong>{teamName(championTeamId, lang)}</strong>
        </div>
      )}

      {rows.length === 0 && <p className="muted center">{t('noPlayers')}</p>}

      <div className="card">
        {rows.map((r, i) => (
          <div key={r.player.id} className={'rank-row' + (i === 0 ? ' top1' : '')}>
            <div className="rank-pos">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
            <div>
              <div className="rank-name">
                {r.player.name}
                {r.player.id === session.id && <span className="tag" style={{ marginLeft: 8 }}>{t('you')}</span>}
              </div>
              <div className="rank-sub row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {t('rankGames')}: {r.matchPoints} · {t('rankChampion')}: {r.championPoints}{r.championHit && ' ✓'}
                {r.pick && r.pick.teams.map((id) => <Crest key={id} id={id} size={16} />)}
              </div>
            </div>
            <div className="rank-total">{r.total}</div>
          </div>
        ))}
      </div>

      <p className="muted center" style={{ fontSize: 12 }}>{t('totalNote')}</p>
    </div>
  )
}
