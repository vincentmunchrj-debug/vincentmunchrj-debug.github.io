// Musique de lancement : jouée UNE fois au démarrage, en entier.
// Elle n'est PAS liée au splash → elle continue jusqu'au bout (ne se coupe pas).
let el = null
let started = false

function ensure() {
  if (!el) {
    el = new Audio('/audio/launch.mp3')
    el.volume = 0.45 // volume modéré
    el.preload = 'auto'
  }
}

export function playLaunchOnce() {
  if (started) return
  ensure()
  el.play().then(() => { started = true }).catch(() => {
    // Autoplay bloqué par le navigateur (mobile) → on retentera au 1er tap de l'utilisateur
  })
}
