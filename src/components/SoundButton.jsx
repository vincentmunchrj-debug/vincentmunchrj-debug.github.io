import { useState, useEffect, useSyncExternalStore } from 'react'
import { subscribeAudio, isPlaying, toggleMusic } from '../lib/audio.js'

// Bouton haut-parleur : active / coupe la musique. Affiche l'état réel.
// Au début, il clignote pour inviter ceux qui veulent le son à cliquer.
// L'app reste SILENCIEUSE par défaut.
export default function SoundButton() {
  const playing = useSyncExternalStore(subscribeAudio, isPlaying, isPlaying)
  const [hint, setHint] = useState(true)

  // Le clignotement d'invitation s'arrête tout seul au bout d'un moment.
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 14000)
    return () => clearTimeout(t)
  }, [])

  const onClick = () => { setHint(false); toggleMusic() }
  const blink = hint && !playing

  return (
    <button className={'sound-btn' + (blink ? ' hint' : '')} onClick={onClick}
      aria-label={playing ? 'Couper le son' : 'Activer le son'}>
      {playing ? '🔊' : '🔇'}
    </button>
  )
}
