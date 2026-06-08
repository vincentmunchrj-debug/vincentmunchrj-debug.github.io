import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useSession } from '../App.jsx'
import { loginOrRegister, createGroup } from '../lib/store.js'
import { useT } from '../i18n.js'
import LangToggle from '../components/LangToggle.jsx'
import SoundButton from '../components/SoundButton.jsx'

const DEFAULT_GROUP = 'Studio 1'

export default function Login() {
  const { session, login } = useSession()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('bolaocopa26.lastname') || '' } catch { return '' }
  })
  const [pin, setPin] = useState('')
  const [group, setGroup] = useState(() => {
    const g = new URLSearchParams(window.location.search).get('g')
    return g ? g.trim() : DEFAULT_GROUP
  })
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  if (session) return <Navigate to="/" replace />

  const inviteUrl = `${window.location.origin}${window.location.pathname}?g=${encodeURIComponent(group)}`
  const canEnter = name.trim() && pin.length === 4 && !busy

  const onCreateGroup = async () => {
    setBusy(true); setError('')
    const code = await createGroup()
    setBusy(false)
    if (code) { setGroup(code); setShowInvite(true) }
    else setError(t('errGeneric'))
  }

  const copyInvite = () => {
    try { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const entrar = async () => {
    const n = name.trim()
    if (!n || pin.length !== 4) { setError(t('errInvalid')); return }
    setBusy(true); setError('')
    const res = await loginOrRegister(group, n, pin)
    setBusy(false)
    if (res.id) {
      try { localStorage.setItem('bolaocopa26.lastname', n) } catch { /* ignore */ }
      login({ id: res.id, name: n, group })
      navigate('/')
    } else if (res.status === 'wrong') setError(t('errTaken'))
    else if (res.status === 'nogroup') setError(t('errNoGroup'))
    else if (res.status === 'invalid') setError(t('errInvalid'))
    else setError(t('errGeneric'))
  }

  return (
    <div className="entry">
      <div className="entry-bg" />
      <div className="entry-shade" />

      <div className="entry-lang"><SoundButton /><LangToggle variant="lg" /></div>

      {!open && (
        <button className="entry-cup" onClick={() => setOpen(true)} aria-label={t('enter')}>
          <img src="/img/copa.png" alt="" />
        </button>
      )}
      {!open && <div className="entry-hint">{t('enterHint')}</div>}

      {!open && (
        <div className="entry-bottom">
          <div className="entry-title-big">BOLÃO DA COPA 2026</div>
          <div className="entry-studio-big">RIO SELVAGEM STUDIO</div>
          <div className="entry-author">{t('authorLine')}</div>
          <div className="entry-credit">© 2026</div>
        </div>
      )}

      {open && (
        <div className="entry-sheet" onClick={(e) => { if (e.target.classList.contains('entry-sheet')) setOpen(false) }}>
          <div className="entry-card">
            <div className="entry-logo"><img src="/img/minicopa.png" alt="" /></div>
            <h1 className="entry-title">BolãoCopa26</h1>

            <div className="group-chip">{t('groupLabel')} · <strong>{group}</strong></div>

            {showInvite && (
              <div className="invite-box">
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('inviteShare')}</div>
                <div className="invite-url">{inviteUrl}</div>
                <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={copyInvite}>
                  {copied ? t('copied') : t('copy')}
                </button>
              </div>
            )}

            <label className="label" style={{ textAlign: 'left', marginTop: 12 }}>{t('nickname')}</label>
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

            {!showInvite && (
              <button type="button" className="link-btn" onClick={onCreateGroup} disabled={busy}>
                {t('createGroup')}
              </button>
            )}

            <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 10 }}>{t('codeHint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
