import { useState } from 'react'
import { getGroup } from '../lib/store.js'
import { useT } from '../i18n.js'

// Bouton « Inviter » réservé au créateur du Studio : retrouve le lien d'invitation à tout moment.
export default function InviteButton() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const group = getGroup()
  if (!group) return null

  // Lien en forme racine → fiable sur GitHub Pages (la query est conservée à la redirection).
  const url = `${window.location.origin}/?g=${encodeURIComponent(group)}`
  const copy = () => {
    try { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <>
      <button className="invite-btn" onClick={() => setOpen(true)}>🔗 {t('invite')}</button>
      {open && (
        <div className="invite-modal" onClick={(e) => { if (e.target.classList.contains('invite-modal')) setOpen(false) }}>
          <div className="invite-modal-card">
            <h3 className="invite-modal-title">{t('inviteTitle')} <strong>{group}</strong></h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{t('inviteShare')}</p>
            <div className="invite-url">{url}</div>
            <button className="btn yellow" style={{ marginTop: 12 }} onClick={copy}>
              {copied ? t('copied') : t('copy')}
            </button>
            <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
