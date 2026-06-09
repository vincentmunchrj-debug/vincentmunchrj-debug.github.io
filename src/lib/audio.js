// Musique de lancement : jouée au démarrage, en entier (ne se coupe pas au splash).
// Comme les navigateurs mobiles bloquent le son automatique sans geste, on expose
// aussi un bouton haut-parleur (lecture/pause) avec état observable.
let el = null
let playing = false
const subs = new Set()

function notify() { subs.forEach((fn) => fn()) }
export function subscribeAudio(fn) { subs.add(fn); return () => subs.delete(fn) }
export function isPlaying() { return playing }

function ensure() {
  if (!el) {
    el = new Audio('/audio/launch.mp3')
    el.volume = 0.5
    el.preload = 'auto'
    el.addEventListener('play', () => { playing = true; notify() })
    el.addEventListener('playing', () => { playing = true; notify() })
    el.addEventListener('pause', () => { playing = false; notify() })
    el.addEventListener('ended', () => { playing = false; notify() })
  }
  return el
}

// Bouton haut-parleur : démarre ou met en pause. (Silence par défaut : aucun
// déclenchement automatique — la musique ne part QUE sur appui du bouton.)
export function toggleMusic() {
  ensure()
  if (playing) { el.pause() } else { el.play().catch(() => {}) }
}
