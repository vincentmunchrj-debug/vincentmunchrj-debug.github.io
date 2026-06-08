import { useSyncExternalStore } from 'react'
import { subscribeAudio, isPlaying, toggleMusic } from '../lib/audio.js'

// Bouton haut-parleur : active / coupe la musique. Affiche l'état réel.
export default function SoundButton() {
  const playing = useSyncExternalStore(subscribeAudio, isPlaying, isPlaying)
  return (
    <button className="sound-btn" onClick={toggleMusic}
      aria-label={playing ? 'Couper le son' : 'Activer le son'}>
      {playing ? '🔊' : '🔇'}
    </button>
  )
}
