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

export default function App() {
  // Re-render à chaque changement de données (local ou venant des autres amis)
  useSyncExternalStore(subscribe, getVersion)
  useEffect(() => { init() }, [])

  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })

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
            <Route path="/admin" element={<Guard><Admin /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {session && <BottomNav />}
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

function BottomNav() {
  const { t } = useT()
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end><span className="ic">⚽</span>{t('navMatches')}</NavLink>
      <NavLink to="/champion"><span className="ic">👑</span>{t('navChampion')}</NavLink>
      <NavLink to="/ranking"><span className="ic">📊</span>{t('navRanking')}</NavLink>
      <NavLink to="/admin"><span className="ic">⚙️</span>{t('navAdmin')}</NavLink>
    </nav>
  )
}
