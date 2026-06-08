import { useT, setLang } from '../i18n.js'

// Bascule de langue 🇧🇷 / 🇫🇷. variant 'lg' = grande (écran d'entrée).
export default function LangToggle({ variant }) {
  const { lang } = useT()
  return (
    <div className={'lang-toggle' + (variant === 'lg' ? ' lg' : '')}>
      <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')} aria-label="Português">🇧🇷</button>
      <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')} aria-label="Français">🇫🇷</button>
    </div>
  )
}
