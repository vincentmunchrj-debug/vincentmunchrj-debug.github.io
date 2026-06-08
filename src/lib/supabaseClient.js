import { createClient } from '@supabase/supabase-js'

// Lit les clés depuis .env (voir .env.example).
// Tant qu'elles ne sont pas remplies, l'app tourne en mode DÉMO (localStorage).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabase = Boolean(url && key && !url.includes('xxxxxxxx'))

export const supabase = hasSupabase ? createClient(url, key) : null
