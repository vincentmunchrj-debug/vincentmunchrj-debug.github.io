import { useSyncExternalStore } from 'react'
import { subscribe, getVersion, getUnreadChat, isOnline } from '../lib/store.js'

export default function ChatBubble({ onOpen }) {
  useSyncExternalStore(subscribe, getVersion)
  if (!isOnline()) return null
  const unread = getUnreadChat()
  return (
    <button className="chat-bubble" onClick={onOpen} aria-label="Chat">
      💬
      {unread && <span className="chat-dot" />}
    </button>
  )
}
