import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useSession } from '../App.jsx'
import { loginOrRegister } from '../lib/store.js'
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
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  if (session) return <Navigate to="/" replace />

  const openSheet = () => { setOpen(true) }
  const canEnter = name.trim() && pin.length === 4 && !busy

  const entrar = async () => {
    const n = name.trim()
    if (!n || pin.length !== 4) { setError(t('errInvalid')); return }
    setBusy(true); setError('')
    const res = await loginOrRegister(n, pin)
    setBusy(false)
    if (res.id) {
      try { localStorage.setItem('bolaocopa26.lastname', n) } catch { /* ignore */ }
      login({ id: res.id, name: n })
      navigate('/')
    } else if (res.status === 'wrong') {
      setError(t('errTaken'))
    } else if (res.status === 'invalid') {
      setError(t('errInvalid'))
    } else {
      setError(t('errGeneric'))
    }
  }

  return (
    <div className="entry">
      <div className="entry-bg" />
      <div className="entry-shade" />

      <div className="entry-lang">
        <LangToggle variant="lg" />
      </div>

      {!open && (
        <button className="entry-cup" onClick={openSheet} aria-label={t('enter')}>
          <img src="/img/copa.png" alt="" />
        </button>
      )}
      {!open && <div className="entry-hint">{t('enterHint')}</div>}

      {!open && (
        <div className="entry-footer">
          <div className="ef-author">{t('authorLine')}</div>
          <div className="ef-copy">© 2026 RIO SELVAGEM STUDIO</div>
        </div>
      )}

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
              onChange={(e) => { setName(e.target.value); setError('') }}
              autoFocus
            />

            <label className="label" style={{ textAlign: 'left', marginTop: 12 }}>{t('codeLabel')}</label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
            />

            {error && <p className="entry-error">{error}</p>}

            <button className="btn yellow" style={{ marginTop: 14 }} onClick={entrar} disabled={!canEnter}>
              {busy ? '…' : t('enter')}
            </button>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{t('codeHint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
