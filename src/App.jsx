import { useState, useEffect, useSyncExternalStore, createContext, useContext } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Matches from './pages/Matches.jsx'
import Champion from './pages/Champion.jsx'
import Ranking from './pages/Ranking.jsx'
import Admin from './pages/Admin.jsx'
import { init, subscribe, getVersion, isReady, isOnline } from './lib/store.js'
import { useT } from './i18n.js'
import LangToggle from './components/LangToggle.jsx'

// --- Session (joueur courant), persistée en localStorage
const SESSION_KEY = 'bolaocopa26.session'
const SessionCtx = createContext(null)
export const useSession = () => useContext(SessionCtx)

// --- Accès Admin : débloqué uniquement via un lien secret ?admin=<code>
const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || ''
const ADMIN_KEY = 'bolaocopa26.admin'

export default function App() {
  // Re-render à chaque changement de données (local ou venant des autres amis)
  useSyncExternalStore(subscribe, getVersion)
  useEffect(() => { init() }, [])

  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })

  // Mode admin (lien secret ?admin=<code>) — mémorisé sur cet appareil
  const [admin, setAdmin] = useState(() => {
    try { return localStorage.getItem(ADMIN_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('admin')
    if (p == null) return
    if (ADMIN_CODE && p === ADMIN_CODE) { localStorage.setItem(ADMIN_KEY, '1'); setAdmin(true) }
    else if (p === 'off') { localStorage.removeItem(ADMIN_KEY); setAdmin(false) }
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('admin')
      window.history.replaceState({}, '', url)
    } catch { /* ignore */ }
  }, [])

  if (!isReady()) return <Loading />


  const login = (player) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(player))
    setSession(player)
  }
  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  return (
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
            <Route path="/admin" element={admin ? <Guard><Admin /></Guard> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {session && <BottomNav admin={admin} />}
      </div>
    </SessionCtx.Provider>
  )
}

function Guard({ children }) {
  const { session } = useSession()
  if (!session) return <Navigate to="/login" replace />
  return children
}

// Fond « terrain » différent selon la page
function PageBg() {
  const loc = useLocation()
  const map = { '/': 'fond1', '/champion': 'fond2', '/ranking': 'fond3', '/admin': 'fond1' }
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
        <div className="sub">{t('subtitle')} · {isOnline() ? '🟢 ' + t('online') : '🟡 ' + t('local')}</div>
      </div>
      <div className="header-right">
        <LangToggle />
        <button className="me" onClick={() => { logout(); navigate('/login') }}>
          {session.name} · {t('logout')}
        </button>
      </div>
    </header>
  )
}

function BottomNav({ admin }) {
  const { t } = useT()
  return (
    <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${admin ? 4 : 3}, 1fr)` }}>
      <NavLink to="/" end><span className="ic">⚽</span>{t('navMatches')}</NavLink>
      <NavLink to="/champion"><span className="ic">👑</span>{t('navChampion')}</NavLink>
      <NavLink to="/ranking"><span className="ic">📊</span>{t('navRanking')}</NavLink>
      {admin && <NavLink to="/admin"><span className="ic">⚙️</span>{t('navAdmin')}</NavLink>}
    </nav>
  )
}
