// ============================================================
//  Petits bruitages d'interface — synthétisés (Web Audio, sans fichier)
//  Discrets, déclenchés par les gestes utilisateur.
// ============================================================
let ctx = null
function ac() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { return null }
  return ctx
}

function blip(freq, dur = 0.08, type = 'sine', gain = 0.05) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  o.connect(g); g.connect(c.destination)
  const t = c.currentTime
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.start(t)
  o.stop(t + dur)
}

// Clic léger (sélection, +/- des scores)
export function tick() { blip(620, 0.045, 'triangle', 0.045) }
// Tap doux (boutons)
export function tap() { blip(430, 0.06, 'sine', 0.045) }
// Validation (enregistrement d'un pronostic)
export function success() {
  blip(660, 0.09, 'sine', 0.05)
  setTimeout(() => blip(880, 0.12, 'sine', 0.05), 85)
}
