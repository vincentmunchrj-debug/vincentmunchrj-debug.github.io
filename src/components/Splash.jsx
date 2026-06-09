import { useEffect, useState } from 'react'

// Splash de marque au démarrage : logo RSS + RIO SELVAGEM STUDIO ~3,5 s, puis fondu. Tap pour passer.
export default function Splash({ onDone }) {
  const [out, setOut] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 3200)
    const t2 = setTimeout(() => onDone(), 3800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])
  return (
    <div className={'splash' + (out ? ' out' : '')} onClick={onDone}>
      <img className="splash-logo" src="/img/rss-logo.png" alt="" />
      <div className="splash-studio">RIO SELVAGEM STUDIO</div>
    </div>
  )
}
