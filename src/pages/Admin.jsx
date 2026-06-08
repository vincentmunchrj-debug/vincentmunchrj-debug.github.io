import { useState } from 'react'
import { getMatches, getSettings, setMatchResult, setChampionWindow, setChampionTeam, resetDemo, isOnline } from '../lib/store.js'
import { teamName, TEAMS } from '../data/teams.js'
import { CHAMPION_WINDOWS } from '../lib/tournament.js'
import { useT } from '../i18n.js'
import Crest from '../components/Crest.jsx'

export default function Admin() {
  const { t, lang, dict } = useT()
  const [, force] = useState(0)
  const refresh = () => force((n) => n + 1)
  const matches = getMatches()
  const settings = getSettings()
  const teamsSorted = [...TEAMS].sort((a, b) => (lang === 'fr' ? a.fr : a.pt).localeCompare(lang === 'fr' ? b.fr : b.pt))
  const visible = matches.filter((m) => m.home && m.away)

  return (
    <div>
      <h2 className="page-title">⚙️ {t('adminTitle')}</h2>
      <div className="banner">{t('adminBanner')}</div>

      <div className="card">
        <label className="label">{t('adminWindowLabel')}</label>
        <select className="select" value={settings.championWindow}
          onChange={(e) => { setChampionWindow(e.target.value); refresh() }}>
          {CHAMPION_WINDOWS.map((w) => (<option key={w} value={w}>{dict.champWin[w]}</option>))}
        </select>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{t('adminWindowHelp')}</p>
      </div>

      <div className="card">
        <label className="label">{t('adminChampLabel')}</label>
        <select className="select" value={settings.championTeamId ?? ''}
          onChange={(e) => { setChampionTeam(e.target.value || null); refresh() }}>
          <option value="">{t('notDefined')}</option>
          {teamsSorted.map((tm) => (<option key={tm.id} value={tm.id}>{teamName(tm.id, lang)}</option>))}
        </select>
      </div>

      <h3 style={{ margin: '18px 0 10px' }}>{t('adminResults')}</h3>
      {visible.map((m) => (<ResultRow key={m.id} match={m} onSaved={refresh} />))}

      {!isOnline() && (
        <button className="btn secondary" style={{ marginTop: 18 }}
          onClick={() => { if (confirm(t('resetConfirm'))) { resetDemo(); refresh() } }}>
          {t('resetDemo')}
        </button>
      )}
    </div>
  )
}

function ResultRow({ match, onSaved }) {
  const { lang } = useT()
  const [home, setHome] = useState(match.actual?.home ?? '')
  const [away, setAway] = useState(match.actual?.away ?? '')

  const save = () => {
    if (home === '' || away === '') return
    setMatchResult(match.id, { home: Number(home), away: Number(away) }); onSaved && onSaved()
  }
  const clear = () => { setMatchResult(match.id, null); setHome(''); setAway(''); onSaved && onSaved() }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="row" style={{ gap: 6 }}><Crest id={match.home} size={20} /> {teamName(match.home, lang)}</span>
        <span className="muted">×</span>
        <span className="row" style={{ gap: 6 }}>{teamName(match.away, lang)} <Crest id={match.away} size={20} /></span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input className="score-input" type="number" min="0" inputMode="numeric"
          value={home} onChange={(e) => setHome(e.target.value)} />
        <input className="score-input" type="number" min="0" inputMode="numeric"
          value={away} onChange={(e) => setAway(e.target.value)} />
        <button className="btn" style={{ width: 'auto', flex: 1 }} onClick={save}>OK</button>
        <button className="btn secondary" style={{ width: 'auto' }} onClick={clear}>✕</button>
      </div>
    </div>
  )
}
