import { useState, useEffect, useSyncExternalStore, createContext, useContext } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Matches from './pages/Matches.jsx'
import Champion from './pages/Champion.jsx'
import Ranking from './pages/Ranking.jsx'
import Live from './pages/Live.jsx'
import { init, subscribe, getVersion, isReady, isOnline, enterGroup, getGroup, isCreatedStudio, getMatches } from './lib/store.js'
import { useT } from './i18n.js'
import LangToggle from './components/LangToggle.jsx'
import SoundButton from './components/SoundButton.jsx'
// (musique : silence par défaut, déclenchée uniquement via le bouton haut-parleur)
import Splash from './components/Splash.jsx'
import InviteButton from './components/InviteButton.jsx'
import ChatBubble from './components/ChatBubble.jsx'
import ChatPanel from './components/ChatPanel.jsx'

// --- Session (joueur courant), persistée en localStorage
const SESSION_KEY = 'bolaocopa26.session'
const SessionCtx = createContext(null)
export const useSession = () => useContext(SessionCtx)

export default function App() {
  // Re-render à chaque changement de données (local ou venant des autres amis)
  useSyncExternalStore(subscribe, getVersion)

  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })
  const [splash, setSplash] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)

  // Démarrage : charge le global, puis le groupe de la session (défaut "Studio 1")
  useEffect(() => {
    init().then(() => { if (session) enterGroup(session.group || 'Studio 1') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = (player) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(player))
    setSession(player)
    enterGroup(player.group || 'Studio 1')
  }
  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  return (
    <>
      {splash && <Splash onDone={() => setSplash(false)} />}
      {!isReady() ? <Loading /> : (
        <SessionCtx.Provider value={{ session, login, logout }}>
          <div className="app">
            {session && <PageBg />}
            {session && <Header />}
            <div className="content">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Guard><Matches /></Guard>} />
                <Route path="/champion" element={<Guard><Champion /></Guard>} />
                <Route path="/ranking" element={<Guard><Ranking /></Guard>} />
                <Route path="/live" element={<Guard><Live /></Guard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            {session && <BottomNav />}
            {session && !chatOpen && <ChatBubble onOpen={() => setChatOpen(true)} />}
            {session && chatOpen && (
              <div className="chat-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChatOpen(false) }}>
                <ChatPanel onClose={() => setChatOpen(false)} />
              </div>
            )}
          </div>
        </SessionCtx.Provider>
      )}
    </>
  )
}

function Guard({ children }) {
  const { session } = useSession()
  const loc = useLocation()
  // On conserve la query (?g=new, ?g=Studio X) à travers la redirection vers /login
  if (!session) return <Navigate to={'/login' + loc.search} replace />
  return children
}

// Fond « terrain » différent selon la page
function PageBg() {
  const loc = useLocation()
  const map = { '/': 'fond1', '/champion': 'fond2', '/ranking': 'fond3', '/live': 'fond1' }
  const img = map[loc.pathname] || 'fond1'
  return <div className="page-bg" style={{ backgroundImage: `url(/img/${img}.jpg)` }} />
}

function Loading() {
  const { t } = useT()
  return (
    <div className="app">
      <div className="content center" style={{ paddingTop: 120 }}>
        <img src="/img/minicopa.png" alt="" style={{ height: 80 }} />
        <p className="muted">{t('loading')}</p>
      </div>
    </div>
  )
}

function Header() {
  const { session, logout } = useSession()
  const { t } = useT()
  const navigate = useNavigate()
  return (
    <header className="header">
      <img className="logo-img" src="/img/minicopa.png" alt="" />
      <div>
        <h1>BolãoCopa26</h1>
        <div className="sub">{getGroup() || t('subtitle')} · {isOnline() ? '🟢 ' + t('online') : '🟡 ' + t('local')}</div>
        {isCreatedStudio(getGroup()) && <InviteButton />}
      </div>
      <div className="header-right">
        <SoundButton />
        <LangToggle />
        <button className="me" onClick={() => { logout(); navigate('/login') }}>
          {session.name} · {t('logout')}
        </button>
      </div>
    </header>
  )
}

function BottomNav() {
  const { t } = useT()
  const hasLive = getMatches().some(m => m.status === 'live')
  return (
    <nav className={'bottom-nav' + (hasLive ? ' has-live' : '')}>
      <NavLink to="/" end><span className="ic">⚽</span>{t('navMatches')}</NavLink>
      <NavLink to="/champion"><span className="ic">👑</span>{t('navChampion')}</NavLink>
      <NavLink to="/ranking"><span className="ic">📊</span>{t('navRanking')}</NavLink>
      {hasLive && (
        <NavLink to="/live" className={({ isActive }) => 'live-tab' + (isActive ? ' active' : '')}>
          <span className="ic">🔴</span>
          {t('navLive')}
        </NavLink>
      )}
    </nav>
  )
}
