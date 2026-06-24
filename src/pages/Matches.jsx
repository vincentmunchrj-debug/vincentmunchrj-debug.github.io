import { useState, useEffect } from 'react'
import { useSession } from '../App.jsx'
import { getMatches, getBets, setBet } from '../lib/store.js'
import { teamName } from '../data/teams.js'
import { scoreMatch } from '../lib/scoring.js'
import { useT } from '../i18n.js'
import Crest from '../components/Crest.jsx'

export default function Matches() {
  const { session } = useSession()
  const { t } = useT()
  const matches = getMatches()
  const bets = getBets(session.id)
  const [, force] = useState(0)
  const refresh = () => force((n) => n + 1)
  const visible = matches.filter((m) => m.home && m.away)
  const pending = matches.length - visible.length

  // Journées de poules : pour chaque groupe (4 équipes), 2 matchs par journée.
  // On replie les journées déjà passées (J1, J2) ; la journée courante reste déroulée.
  const byGroup = {}
  for (const m of matches) {
    if (m.phase !== 'groups' || !m.home || !m.away) continue
    ;(byGroup[m.group] ||= []).push(m)
  }
  const r1Ids = new Set(); const r2Ids = new Set()
  for (const g of Object.keys(byGroup)) {
    const sorted = [...byGroup[g]].sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    sorted.slice(0, 2).forEach((m) => r1Ids.add(m.id))
    sorted.slice(2, 4).forEach((m) => r2Ids.add(m.id))
  }
  const round1 = visible.filter((m) => r1Ids.has(m.id))
  const round2 = visible.filter((m) => r2Ids.has(m.id))
  const rest = visible.filter((m) => !r1Ids.has(m.id) && !r2Ids.has(m.id))

  return (
    <div>
      <h2 className="page-title">⚽ {t('matchesTitle')}</h2>
      <div className="banner">{t('matchesBanner')}</div>

      {round1.length > 0 && (
        <FoldSection title={t('round1')} matches={round1} bets={bets} playerId={session.id} onSaved={refresh} />
      )}
      {round2.length > 0 && (
        <FoldSection title={t('round2')} matches={round2} bets={bets} playerId={session.id} onSaved={refresh} />
      )}

      {rest.map((m) => (
        <MatchCard key={m.id} match={m} bet={bets[m.id]} playerId={session.id} onSaved={refresh} />
      ))}
      {pending > 0 && (
        <p className="muted center" style={{ fontSize: 13, marginTop: 16 }}>{t('pendingKo')(pending)}</p>
      )}
    </div>
  )
}

function FoldSection({ title, matches, bets, playerId, onSaved }) {
  const [open, setOpen] = useState(false) // replié par défaut
  return (
    <div className="round-fold">
      <button className="round-fold-head" onClick={() => setOpen((o) => !o)}>
        <span>{open ? '▾' : '▸'} {title}</span>
        <span className="round-fold-count">{matches.length}</span>
      </button>
      {open && (
        <div className="round-fold-body">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} bet={bets[m.id]} playerId={playerId} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stepper({ value, onChange, disabled }) {
  const empty = value === '' || value == null
  const dec = () => {
    if (empty) return
    onChange(value <= 0 ? '' : value - 1) // 0 puis − => on revide la case
  }
  const inc = () => onChange(empty ? 0 : Math.min(20, value + 1))
  return (
    <div className="stepper">
      <button type="button" className="step-btn" disabled={disabled}
        onClick={inc} aria-label="+">+</button>
      <span className={'step-val' + (empty ? ' empty' : '')}>{empty ? '–' : value}</span>
      <button type="button" className="step-btn" disabled={disabled || empty}
        onClick={dec} aria-label="-">−</button>
    </div>
  )
}

function MatchCard({ match, bet, playerId, onSaved }) {
  const { t, lang, dict } = useT()
  const locked = new Date(match.kickoff).getTime() <= Date.now()
  const live = match.status === 'live'     // match en cours -> score en direct (mis à jour chaque minute)
  const final = !!match.actual && !live    // match terminé -> score définitif
  const played = final
  const [home, setHome] = useState(bet?.home ?? '')
  const [away, setAway] = useState(bet?.away ?? '')
  const [qualifier, setQualifier] = useState(bet?.qualifier ?? null)
  const [saved, setSaved] = useState(false)

  // Si le pari se (re)charge depuis le serveur (ex. après reconnexion), on met à jour
  // l'affichage. Ne se déclenche que si les VALEURS changent → ne gêne pas la saisie.
  useEffect(() => {
    setHome(bet?.home ?? '')
    setAway(bet?.away ?? '')
    setQualifier(bet?.qualifier ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet?.home, bet?.away, bet?.qualifier])

  // Match à élimination : si on prédit un nul, il faut désigner le qualifié (t.a.b.)
  const isKnockout = match.phase && match.phase !== 'groups'
  const isDraw = home !== '' && away !== '' && Number(home) === Number(away)
  const needsQualifier = isKnockout && isDraw

  const canSave = !locked && home !== '' && away !== '' &&
    (!needsQualifier || qualifier === match.home || qualifier === match.away)
  const onSave = () => {
    setBet(playerId, match.id, {
      home: Number(home), away: Number(away),
      qualifier: needsQualifier ? qualifier : null,
    })
    setSaved(true); setTimeout(() => setSaved(false), 1500); onSaved && onSaved()
  }

  let result = null
  if (played && bet) {
    result = scoreMatch(bet, match.actual, { homeId: match.home, awayId: match.away, realWinner: match.winner })
  }

  const d = new Date(match.kickoff)
  const dateStr = d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'pt-BR',
    { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  // Libellé du niveau : « Groupe X » pour les poules, sinon le nom du tour
  const levelLabel = isKnockout
    ? (dict.phaseLabel?.[match.phase] || '')
    : `${t('group')} ${match.group}`
  // Score des tirs au but (matchs à élimination terminés aux t.a.b.)
  const hasShootout = match.psoHome != null && match.psoAway != null

  return (
    <div className={'card phase-' + match.phase}>
      <div className="match-meta">
        <span>{levelLabel} · {dateStr}</span>
        {final ? (
          <span className="result-badge">
            {t('result')}: {match.actual.home}–{match.actual.away}
            {hasShootout && <span className="pso-badge"> ({t('shootout')(match.psoHome, match.psoAway)})</span>}
          </span>
        ) : live ? (
          <span className="live-badge">{t('live')} {match.actual.home}–{match.actual.away}</span>
        ) : locked ? (
          <span className="locked-badge">{t('started')}</span>
        ) : (
          <span className="locked-badge">{t('open')}</span>
        )}
      </div>

      <div className="match-teams">
        <div className="team">
          <Crest id={match.home} />
          <span className="name">{teamName(match.home, lang)}</span>
        </div>
        <span className="vs">×</span>
        <div className="team">
          <Crest id={match.away} />
          <span className="name">{teamName(match.away, lang)}</span>
        </div>
      </div>

      <div className="score-row">
        <Stepper value={home} onChange={setHome} disabled={locked} />
        <span className="vs">×</span>
        <Stepper value={away} onChange={setAway} disabled={locked} />
      </div>

      {!locked && needsQualifier && (
        <div className="qualifier">
          <div className="qualifier-q">{t('whoQualifies')}</div>
          <div className="qualifier-opts">
            <button type="button" className={'qual-opt' + (qualifier === match.home ? ' sel' : '')}
              onClick={() => setQualifier(match.home)}>
              <Crest id={match.home} size={22} /> <span>{teamName(match.home, lang)}</span>
            </button>
            <button type="button" className={'qual-opt' + (qualifier === match.away ? ' sel' : '')}
              onClick={() => setQualifier(match.away)}>
              <Crest id={match.away} size={22} /> <span>{teamName(match.away, lang)}</span>
            </button>
          </div>
        </div>
      )}

      {!locked && (
        <button
          className={'btn' + (!saved && bet ? ' modify' : '')}
          style={{ marginTop: 12 }}
          onClick={onSave}
          disabled={!canSave}
        >
          {saved ? t('saved') : bet ? t('modifyPick') : t('savePick')}
        </button>
      )}

      {locked && !played && bet && (
        <p className="muted center" style={{ marginTop: 10, marginBottom: 0 }}>
          {t('yourPick')}: <strong>{bet.home}–{bet.away}</strong>
        </p>
      )}
      {locked && !played && !bet && (
        <p className="muted center" style={{ marginTop: 10, marginBottom: 0 }}>{t('noPick')}</p>
      )}

      {result && (
        <div className="row between" style={{ marginTop: 12 }}>
          <span className="muted">
            {t('yourPick')}: <strong>{bet.home}–{bet.away}</strong>
            {result.gotWinner && ' · ' + t('winnerOk')}
            {result.gotDiff && ' · ' + t('diffOk')}
            {result.gotExact && ' · ' + t('exactOk')}
          </span>
          <span className={'pts-pill' + (result.points === 0 ? ' zero' : '')}>+{result.points} {t('pts')}</span>
        </div>
      )}
    </div>
  )
}
