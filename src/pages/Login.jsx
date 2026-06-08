import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useSession } from '../App.jsx'
import { addPlayer, findPlayerByName } from '../lib/store.js'
import { useT } from '../i18n.js'
import LangToggle from '../components/LangToggle.jsx'

export default function Login() {
  const { session, login } = useSession()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  // Pré-remplit avec le dernier pseudo utilisé (mémorisé sur l'appareil)
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('bolaocopa26.lastname') || '' } catch { return '' }
  })
  const navigate = useNavigate()

  if (session) return <Navigate to="/" replace />

  const openSheet = () => { setOpen(true) }

  const entrar = () => {
    const n = name.trim()
    if (!n) return
    try { localStorage.setItem('bolaocopa26.lastname', n) } catch { /* ignore */ }
    let player = findPlayerByName(n)
    if (!player) { player = { id: addPlayer(n), name: n } }
    login(player)
    navigate('/')
  }

  return (
    <div className="entry">
      <div className="entry-bg" />
      <div className="entry-shade" />

      {/* Langue */}
      <div className="entry-lang">
        <LangToggle variant="lg" />
      </div>

      {/* La Coupe = bouton d'entrée */}
      {!open && (
        <button className="entry-cup" onClick={openSheet} aria-label={t('enter')}>
          <img src="/img/copa.png" alt="" />
        </button>
      )}
      {!open && <div className="entry-hint">{t('enterHint')}</div>}

      {/* Feuille de saisie du nom */}
      {open && (
        <div className="entry-sheet" onClick={(e) => { if (e.target.classList.contains('entry-sheet')) setOpen(false) }}>
          <div className="entry-card">
            <div className="entry-logo"><img src="/img/minicopa.png" alt="" /></div>
            <h1 className="entry-title">BolãoCopa26</h1>
            <p className="muted" style={{ marginTop: 0 }}>{t('tagline')}</p>
            <label className="label" style={{ textAlign: 'left' }}>{t('nickname')}</label>
            <input
              className="input"
              placeholder={t('nicknamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              autoFocus
            />
            <button className="btn yellow" style={{ marginTop: 14 }} onClick={entrar} disabled={!name.trim()}>
              {t('enter')}
            </button>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{t('loginHelp')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
