import { useEffect, useState } from 'react'
import { useSession } from '../App.jsx'
import { getMatches, getPlayers, getBets, getPick, getSettings, refreshAll } from '../lib/store.js'
import { tallyPlayer, scoreMatch } from '../lib/scoring.js'
import { teamName } from '../data/teams.js'
import { useT } from '../i18n.js'
import Crest from '../components/Crest.jsx'

export default function Live() {
  const { session } = useSession()
  const { t, lang } = useT()
  const [, tick] = useState(0)

  useEffect(() => {
    refreshAll()
    const timer = setInterval(() => { refreshAll(); tick(n => n + 1) }, 30000)
    return () => clearInterval(timer)
  }, [])

  const matches = getMatches()
  const liveMatches = matches.filter(m => m.status === 'live')

  if (liveMatches.length === 0) {
    return (
      <div>
        <h2 className="page-title">🔴 {t('navLive')}</h2>
        <div className="card" style={{ textAlign: 'center', padding: '32px 14px' }}>
          <p className="muted">{t('noLive')}</p>
        </div>
      </div>
    )
  }

  const players = getPlayers().filter(p => !p.name.trim().startsWith('_'))
  const settings = getSettings()
  const championTeamId = settings.championTeamId
  const liveIds = new Set(liveMatches.map(m => m.id))

  // Base ranking : tous matchs SAUF les matchs live (non encore validés)
  const finishedMatches = matches.filter(m => !liveIds.has(m.id))
  const baseRows = players.map(p => {
    const bets = getBets(p.id)
    const betList = Object.entries(bets)
      .filter(([id]) => !liveIds.has(id))
      .map(([matchId, pred]) => ({ matchId, pred }))
    const pick = getPick(p.id)
    const tly = tallyPlayer(betList, finishedMatches, pick, championTeamId)
    return { player: p, base: tly.total }
  })
  baseRows.sort((a, b) => b.base - a.base)
  const baseRank = {}
  baseRows.forEach((r, i) => { baseRank[r.player.id] = i + 1 })

  // Points provisoires : somme des matchs live en cours
  function provPts(playerId) {
    let total = 0
    for (const m of liveMatches) {
      if (!m.actual) continue
      const bet = getBets(playerId)[m.id]
      if (!bet) continue
      const r = scoreMatch(bet, m.actual, { homeId: m.home, awayId: m.away, realWinner: m.winner })
      total += r.points
    }
    return total
  }

  const projRows = baseRows
    .map(r => ({ ...r, prov: provPts(r.player.id) }))
    .sort((a, b) => (b.base + b.prov) - (a.base + a.prov) || b.base - a.base)
  const projRank = {}
  projRows.forEach((r, i) => { projRank[r.player.id] = i + 1 })

  // Minute approximative depuis le coup d'envoi
  function elapsedMin(kickoff) {
    const ms = Date.now() - new Date(kickoff).getTime()
    return Math.min(90, Math.max(1, Math.floor(ms / 60000)))
  }

  return (
    <div>
      <h2 className="page-title">🔴 {t('navLive')}</h2>

      {liveMatches.map(m => {
        const myBet = session ? getBets(session.id)[m.id] : null
        const myPts = myBet && m.actual
          ? scoreMatch(myBet, m.actual, { homeId: m.home, awayId: m.away, realWinner: m.winner }).points
          : null
        const min = elapsedMin(m.kickoff)

        return (
          <div key={m.id} className="card" style={{ marginBottom: 12 }}>
            {/* En-tête live */}
            <div className="match-meta">
              <span className="live-badge">🔴 {t('live')} {min}'</span>
            </div>

            {/* Score */}
            <div className="match-teams" style={{ marginBottom: 8 }}>
              <div className="team">
                <Crest id={m.home} />
                <span className="name">{teamName(m.home, lang)}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#122038', lineHeight: 1 }}>
                  {m.actual?.home ?? 0} <span style={{ color: '#9fb0c7', fontWeight: 400 }}>-</span> {m.actual?.away ?? 0}
                </div>
              </div>
              <div className="team">
                <Crest id={m.away} />
                <span className="name">{teamName(m.away, lang)}</span>
              </div>
            </div>

            {/* Prono du joueur connecté */}
            {myBet && (
              <div className="row between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e3e8f0' }}>
                <span className="muted" style={{ fontSize: 13 }}>
                  {t('yourPickLive')} : <strong>{myBet.home}–{myBet.away}</strong>
                </span>
                {myPts !== null && (
                  myPts > 0
                    ? <span className={`live-badge-pts p${myPts}`}>{t('livePoints')(myPts)}</span>
                    : <span className="muted" style={{ fontSize: 12 }}>{t('liveNoPoints')}</span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Classement provisoire */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#5b6b86', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {t('liveRanking')}
      </h3>
      <div className="card">
        {projRows.map((r, i) => {
          const d = baseRank[r.player.id] - projRank[r.player.id]
          const [tri, col] = d > 0 ? ['▲', '#0a7d3c'] : d < 0 ? ['▼', '#d63c35'] : ['▶', '#aab4c6']
          const isMe = r.player.id === session?.id
          const pos = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
          return (
            <div key={r.player.id} className={'rank-row' + (i === 0 ? ' top1' : '')}>
              <div className="rank-pos">{pos}</div>
              <div>
                <div className="rank-name">
                  <span style={{ color: col, fontSize: 11, marginRight: 5 }}>{tri}</span>
                  {r.player.name}
                  {r.prov > 0 && (
                    <span className={`live-badge-pts p${r.prov}`}>+{r.prov}</span>
                  )}
                  {isMe && <span className="tag" style={{ marginLeft: 6 }}>{t('you')}</span>}
                </div>
              </div>
              <div className="rank-total">{r.base + r.prov}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
