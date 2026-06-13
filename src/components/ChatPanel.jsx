import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { useSession } from '../App.jsx'
import {
  subscribeChatMessages, getChatMessages,
  getPlayers, getGroup,
  loadMessages, postMessage,
  openChatRealtime, closeChatRealtime, markChatSeen,
} from '../lib/store.js'
import { useT } from '../i18n.js'

const MENTION_RE = /@([\wÀ-ſ]+)/g

export default function ChatPanel({ onClose }) {
  const { session } = useSession()
  const { t, lang } = useT()
  const group = getGroup()
  const messages = useSyncExternalStore(subscribeChatMessages, getChatMessages)
  const players = getPlayers()

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showOrig, setShowOrig] = useState({})
  const [mentionQ, setMentionQ] = useState(null) // null = fermé, '' = tout, 'vi' = préfixe
  const inputRef = useRef(null)
  const bottomRef = useRef(null)

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

  // Suggestions de mention filtrées
  const suggestions = mentionQ !== null
    ? players
        .filter((p) => p.id !== session.id && p.name.toLowerCase().startsWith(mentionQ.toLowerCase()))
        .slice(0, 5)
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
    if (!txt || sending) return
    setSending(true)
    setInput('')
    setMentionQ(null)
    await postMessage(group, session.id, session.name, txt, lang)
    setSending(false)
  }

  // Rendu du texte avec @mentions surlignées
  const renderText = (text) => {
    if (!text) return null
    const parts = text.split(MENTION_RE)
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const isMe = part.toLowerCase() === session.name.toLowerCase()
        return <span key={i} className={'chat-mention' + (isMe ? ' me' : '')}>@{part}</span>
      }
      return part
    })
  }

  const fmt = (iso) =>
    new Date(iso).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
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
              <div className="chat-msg-text">{renderText(displayed)}</div>
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

      <div className="chat-input-row">
        {suggestions.length > 0 && mentionQ !== null && (
          <div className="chat-mention-list">
            {suggestions.map((p) => (
              <button
                key={p.id}
                className="chat-mention-opt"
                onMouseDown={(e) => { e.preventDefault(); insertMention(p.name) }}>
                @{p.name}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('chatPlaceholder')}
          maxLength={500}
          autoComplete="off"
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || sending}>
          {t('chatSend')}
        </button>
      </div>
    </div>
  )
}
