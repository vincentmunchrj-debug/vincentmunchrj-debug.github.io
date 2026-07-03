import { useState } from 'react'
import { useSession } from '../App.jsx'
import { getPick, setPick, getSettings } from '../lib/store.js'
import { TEAMS, teamName } from '../data/teams.js'
import { isChampionLocked } from '../lib/tournament.js'
import { CHAMPION_POINTS, mergePickWindows, windowOfTeam } from '../lib/scoring.js'
import { useT } from '../i18n.js'
import Crest from '../components/Crest.jsx'

export default function Champion() {
  const { session } = useSession()
  const { t, lang } = useT()
  const settings = getSettings()
  const currentWindow = settings.championWindow
  const locked = isChampionLocked(currentWindow)
  const pick = getPick(session.id)

  const [sel, setSel] = useState(pick?.teams ?? [])
  const [saved, setSaved] = useState(false)

  const toggle = (id) => {
    if (locked) return
    setSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }
  const onSave = () => {
    if (sel.length !== 3 || locked) return
    // Chaque équipe garde sa fenêtre d'origine ; une équipe ajoutée prend le palier courant.
    setPick(session.id, sel, mergePickWindows(pick, sel, currentWindow))
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  // Palier qu'obtiendrait une équipe donnée si on enregistrait maintenant :
  //  - déjà dans le pick sauvegardé -> sa fenêtre d'origine (ex. 25 pts)
  //  - nouvelle -> la fenêtre courante (palier du moment)
  const teamWindow = (id) => {
    const i = pick?.teams?.indexOf(id) ?? -1
    return i >= 0 ? windowOfTeam(pick, i) : currentWindow
  }

  const teamsSorted = [...TEAMS].sort((a, b) => (lang === 'fr' ? a.fr : a.pt).localeCompare(lang === 'fr' ? b.fr : b.pt))

  return (
    <div>
      <h2 className="page-title">👑 {t('championTitle')}</h2>
      <div className="banner">{t('championBanner')}</div>

      {pick && (
        <div className="card">
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t('yourChoice')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pick.teams.map((id, i) => {
              const w = windowOfTeam(pick, i)
              return (
                <span key={id} className="row between">
                  <span className="row" style={{ gap: 6 }}>
                    <Crest id={id} size={24} /><span style={{ fontSize: 13 }}>{teamName(id, lang)}</span>
                  </span>
                  <span className="tag">{CHAMPION_POINTS[w]} {t('pts')}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {!locked ? (
        <>
          <div className="row between" style={{ margin: '4px 0 10px' }}>
            <span className="muted">{t('selected')}: {sel.length}/3</span>
          </div>
          <div className="team-grid">
            {teamsSorted.map((tm) => {
              const isSel = sel.includes(tm.id)
              const disabled = !isSel && sel.length >= 3
              return (
                <button key={tm.id}
                  className={'team-chip' + (isSel ? ' sel' : '') + (disabled ? ' disabled' : '')}
                  onClick={() => toggle(tm.id)}>
                  <Crest id={tm.id} size={26} />
                  <span className="name">{teamName(tm.id, lang)}</span>
                  {isSel && <span className="tag">{CHAMPION_POINTS[teamWindow(tm.id)]} {t('pts')}</span>}
                </button>
              )
            })}
          </div>
          <button className="btn yellow champ-save" onClick={onSave} disabled={sel.length !== 3}>
            {saved ? t('saved') : `${t('save')} (${sel.length}/3)`}
          </button>
        </>
      ) : (
        <div className="card center">
          <div style={{ fontSize: 36 }}>🔒</div>
          <p className="muted">{t('lockedTitle')}</p>
        </div>
      )}
    </div>
  )
}
