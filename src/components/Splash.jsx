import { useEffect, useRef, useState } from 'react'

// Splash de marque au démarrage : vidéo d'intro (6 s) + RIO SELVAGEM STUDIO superposé,
// puis fondu vers l'app à la fin de la vidéo. Tap pour passer. Poster en repli.
export default function Splash({ onDone }) {
  const [out, setOut] = useState(false)
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    setOut(true)
    setTimeout(onDone, 600) // laisse le fondu se jouer
  }
  // Sécurité : si la vidéo ne démarre pas (autoplay bloqué, etc.), on passe quand même.
  useEffect(() => {
    const t = setTimeout(finish, 7000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className={'splash splash-video-wrap' + (out ? ' out' : '')} onClick={finish}>
      <video
        className="splash-video"
        src="/video/intro.mp4"
        poster="/img/intro-poster.jpg"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
      />
      <div className="splash-studio splash-studio-over">RIO SELVAGEM STUDIO</div>
    </div>
  )
}
