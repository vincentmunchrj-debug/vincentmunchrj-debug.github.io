import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { useSession } from '../App.jsx'
import {
  subscribeChatMessages, getChatMessages,
  getPlayers, getGroup,
  loadMessages, postMessage, uploadChatImage,
  openChatRealtime, closeChatRealtime, markChatSeen,
} from '../lib/store.js'
import { useT } from '../i18n.js'

const MENTION_RE = /@([\wÀ-ſ]+)/g
// Mention « tout le groupe » : @studio (FR) / @todos (PT). Les deux sont reconnus à la lecture.
const GLOBAL_ALIASES = ['studio', 'todos']

// Compresse une image en JPEG ≤ 1280px, ~70 % de qualité (≈ 200–400 Ko)
async function compressToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      const MAX = 1280
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(resolve, 'image/jpeg', 0.72)
    }
    img.onerror = reject
    img.src = blobUrl
  })
}

export default function ChatPanel({ onClose }) {
  const { session } = useSession()
  const { t, lang } = useT()
  const group = getGroup()
  const messages = useSyncExternalStore(subscribeChatMessages, getChatMessages)
  const players = getPlayers()

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showOrig, setShowOrig] = useState({})
  const [mentionQ, setMentionQ] = useState(null) // null = fermé, '' = tout, 'vi' = préfixe
  const [lightbox, setLightbox] = useState(null) // URL de l'image agrandie
  const [pendingPhoto, setPendingPhoto] = useState(null) // { blob, previewUrl } en attente d'envoi
  const inputRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadMessages(group)
    openChatRealtime(group)
    markChatSeen(group)
    return () => {
      closeChatRealtime()
      markChatSeen(group)
    }
  }, [group])

  // Auto-scroll vers le dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Libère l'aperçu photo si le panneau se ferme avec une photo en attente
  useEffect(() => () => {
    setPendingPhoto((p) => { if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl); return null })
  }, [])

  // Mot « tout le groupe » selon la langue active (proposé en tête de liste)
  const globalWord = lang === 'fr' ? 'studio' : 'todos'

  // Suggestions de mention : entrée « tout le groupe » en tête, puis les joueurs.
  const suggestions = mentionQ !== null
    ? (() => {
        const q = mentionQ.toLowerCase()
        const ppl = players.filter((p) => p.id !== session.id && p.name.toLowerCase().startsWith(q))
        const out = []
        if (globalWord.startsWith(q)) out.push({ id: '__all__', name: globalWord, all: true })
        return out.concat(ppl).slice(0, 6)
      })()
    : []

  const handleChange = (e) => {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const m = before.match(/@([\wÀ-ſ]*)$/)
    setMentionQ(m ? m[1] : null)
  }

  const insertMention = (name) => {
    const el = inputRef.current
    const cursor = el?.selectionStart ?? input.length
    const before = input.slice(0, cursor)
    const after = input.slice(cursor)
    const atIdx = before.lastIndexOf('@')
    const newVal = before.slice(0, atIdx) + '@' + name + ' ' + after
    setInput(newVal)
    setMentionQ(null)
    setTimeout(() => { el?.focus(); el?.setSelectionRange(atIdx + name.length + 2, atIdx + name.length + 2) }, 0)
  }

  const handleKeyDown = (e) => {
    if (suggestions.length > 0 && mentionQ !== null && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      insertMention(suggestions[0].name)
      return
    }
    if (e.key === 'Escape') {
      if (mentionQ !== null) { setMentionQ(null) } else { onClose() }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQ === null) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    const txt = input.trim()
    if (busy) return
    if (!txt && !pendingPhoto) return
    setMentionQ(null)

    // Envoi avec photo : on uploade d'abord, puis on poste (photo + légende éventuelle)
    if (pendingPhoto) {
      setUploading(true)
      const caption = txt || null
      setInput('')
      try {
        const url = await uploadChatImage(pendingPhoto.blob)
        if (url) {
          await postMessage(group, session.id, session.name, caption, lang, url)
          clearPendingPhoto()
        } else {
          // échec d'upload : on restaure la légende pour ne pas la perdre
          if (caption) setInput(caption)
        }
      } catch (err) {
        console.warn('photo upload:', err)
        if (caption) setInput(caption)
      }
      setUploading(false)
      return
    }

    // Envoi texte simple
    setSending(true)
    setInput('')
    await postMessage(group, session.id, session.name, txt, lang)
    setSending(false)
  }

  // Sélection d'une photo : compression → aperçu (l'envoi se fait ensuite via « Envoyer »)
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressToJpeg(file)
      clearPendingPhoto()
      setPendingPhoto({ blob: compressed, previewUrl: URL.createObjectURL(compressed) })
      inputRef.current?.focus()
    } catch (err) {
      console.warn('photo compress:', err)
    }
    setUploading(false)
  }

  // Annule la photo en attente (revenir en arrière)
  const clearPendingPhoto = () => {
    setPendingPhoto((p) => {
      if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl)
      return null
    })
  }

  // Rendu du texte avec @mentions surlignées
  const renderText = (text) => {
    if (!text) return null
    const parts = text.split(MENTION_RE)
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const low = part.toLowerCase()
        const isMe = low === session.name.toLowerCase()
        const isAll = GLOBAL_ALIASES.includes(low)
        return <span key={i} className={'chat-mention' + (isMe ? ' me' : isAll ? ' all' : '')}>@{part}</span>
      }
      return part
    })
  }

  const fmt = (iso) =>
    new Date(iso).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'pt-BR', { hour: '2-digit', minute: '2-digit' })

  const busy = sending || uploading

  return (
    <>
      <div className="chat-panel">
        <div className="chat-header">
          <span className="chat-title">{t('chatTitle')} — {group}</span>
          <button className="chat-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && <p className="chat-empty">{t('chatEmpty')}</p>}
          {messages.map((msg) => {
            const isMe = msg.player_id === session.id
            const text = (lang === 'fr' ? msg.text_fr : msg.text_pt) || msg.text_orig
            const isDiff = text && msg.text_orig && text !== msg.text_orig
            const displayed = showOrig[msg.id] ? msg.text_orig : text
            return (
              <div key={msg.id} className={'chat-msg' + (isMe ? ' me' : '')}>
                <div className="chat-msg-header">
                  <span className="chat-msg-name">{msg.name}</span>
                  <span className="chat-msg-time">{fmt(msg.created_at)}</span>
                </div>
                {msg.image_url && (
                  <img
                    className="chat-msg-img"
                    src={msg.image_url}
                    alt=""
                    onClick={() => setLightbox(msg.image_url)}
                  />
                )}
                {displayed && <div className="chat-msg-text">{renderText(displayed)}</div>}
                {isDiff && (
                  <button
                    className="chat-orig-btn"
                    onClick={() => setShowOrig((s) => ({ ...s, [msg.id]: !s[msg.id] }))}>
                    {showOrig[msg.id]
                      ? (lang === 'fr' ? '← traduction' : '← tradução')
                      : t('seeOriginal')}
                  </button>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Aperçu de la photo en attente d'envoi — ✕ pour annuler */}
        {pendingPhoto && (
          <div className="chat-photo-preview">
            <img src={pendingPhoto.previewUrl} alt="" className="chat-photo-preview-img" />
            <span className="chat-photo-preview-label">
              {lang === 'fr' ? 'Photo prête — ajoutez une légende si vous voulez' : 'Foto pronta — adicione uma legenda se quiser'}
            </span>
            <button
              className="chat-photo-cancel"
              type="button"
              onClick={clearPendingPhoto}
              disabled={uploading}
              aria-label={lang === 'fr' ? 'Annuler la photo' : 'Cancelar foto'}
            >
              ✕
            </button>
          </div>
        )}

        <div className="chat-input-row">
          {suggestions.length > 0 && mentionQ !== null && (
            <div className="chat-mention-list">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  className={'chat-mention-opt' + (p.all ? ' all' : '')}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(p.name) }}>
                  @{p.name}
                  {p.all && <span className="mention-hint"> · {lang === 'fr' ? 'tout le groupe' : 'todo o grupo'}</span>}
                </button>
              ))}
            </div>
          )}
          {/* Input fichier caché — déclenché par le bouton 📷 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button
            className="chat-photo-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label={lang === 'fr' ? 'Envoyer une photo' : 'Enviar foto'}
          >
            {uploading ? '⏳' : '📷'}
          </button>
          <input
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={pendingPhoto
              ? (lang === 'fr' ? 'Légende (optionnelle)…' : 'Legenda (opcional)…')
              : t('chatPlaceholder')}
            maxLength={500}
            autoComplete="off"
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={(!input.trim() && !pendingPhoto) || busy}
          >
            {t('chatSend')}
          </button>
        </div>
      </div>

      {/* Lightbox — ✕ ou tap ailleurs pour fermer */}
      {lightbox && (
        <div
          className="chat-lightbox"
          onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
        >
          <button
            className="chat-lightbox-close"
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
            aria-label={lang === 'fr' ? 'Fermer' : 'Fechar'}
          >
            ✕
          </button>
          <img src={lightbox} alt="" className="chat-lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
