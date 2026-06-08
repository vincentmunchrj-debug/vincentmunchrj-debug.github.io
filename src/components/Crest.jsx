import { useState } from 'react'
import { teamCrest, teamFlag } from '../data/teams.js'

// Affiche l'écusson officiel de l'équipe ; repli sur le drapeau emoji si absent/erreur.
export default function Crest({ id, size = 30 }) {
  const url = teamCrest(id)
  const [err, setErr] = useState(false)
  if (!url || err) {
    return <span className="flag" style={{ fontSize: size }}>{teamFlag(id)}</span>
  }
  return (
    <img
      className="crest"
      src={url}
      alt=""
      loading="lazy"
      style={{ width: size, height: size }}
      onError={() => setErr(true)}
    />
  )
}
