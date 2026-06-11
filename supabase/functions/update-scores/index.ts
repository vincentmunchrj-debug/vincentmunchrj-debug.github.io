// Fonction serveur Supabase — robot de scores 24/7.
// Source : ESPN (diffuseurs). Écrit UNIQUEMENT le score des matchs terminés.
// Aucun ré-import, aucun effacement, idempotent (n'écrit que si le score change).
// Déclenchée toutes les minutes par pg_cron.

const MAP: Record<string, string> = {
  MEX: "Mexico", RSA: "South Africa", KOR: "South Korea", CZE: "Czechia", CAN: "Canada",
  BIH: "Bosnia-Herzegovina", USA: "United States", PAR: "Paraguay", QAT: "Qatar", SUI: "Switzerland",
  BRA: "Brazil", MAR: "Morocco", HAI: "Haiti", SCO: "Scotland", AUS: "Australia", TUR: "Türkiye",
  GER: "Germany", CUW: "Curaçao", NED: "Netherlands", JPN: "Japan", CIV: "Ivory Coast", ECU: "Ecuador",
  SWE: "Sweden", TUN: "Tunisia", ESP: "Spain", CPV: "Cape Verde", BEL: "Belgium", EGY: "Egypt",
  KSA: "Saudi Arabia", URY: "Uruguay", IRN: "Iran", NZL: "New Zealand", FRA: "France", SEN: "Senegal",
  IRQ: "Iraq", NOR: "Norway", ARG: "Argentina", ALG: "Algeria", AUT: "Austria", JOR: "Jordan",
  POR: "Portugal", COD: "Congo DR", UZB: "Uzbekistan", ENG: "England", GHA: "Ghana", PAN: "Panama",
  CRO: "Croatia", COL: "Colombia",
};

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const toMin = (i: string) => new Date(i).toISOString().slice(0, 16);
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

Deno.serve(async () => {
  const db = await (await fetch(`${URL_}/rest/v1/matches?select=id,kickoff,home,away,actual_home,actual_away,status`, { headers: H })).json();
  const byMin = new Map<string, any[]>();
  for (const m of db) { const k = toMin(m.kickoff); if (!byMin.has(k)) byMin.set(k, []); byMin.get(k)!.push(m); }

  const now = new Date();
  const days: string[] = [];
  for (let off = 1; off >= 0; off--) { const d = new Date(now); d.setUTCDate(d.getUTCDate() - off); days.push(d.toISOString().slice(0, 10).replace(/-/g, "")); }

  let updates = 0, unresolved = 0;
  const log: string[] = [];
  for (const ymd of days) {
    let j: any;
    try { j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${ymd}`)).json(); }
    catch (_e) { continue; }
    for (const e of j.events ?? []) {
      const state = e.status?.type?.state; // 'pre' | 'in' | 'post'
      if (state === "pre" || !state) continue;        // pas commencé -> on ne touche à rien
      const c = e.competitions[0];
      const h = c.competitors.find((x: any) => x.homeAway === "home");
      const a = c.competitors.find((x: any) => x.homeAway === "away");
      const hs = Number(h.score), as = Number(a.score);
      if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
      const st = state === "post" ? "final" : "live"; // 'in' -> en direct
      const min = toMin(e.date);
      const cands = byMin.get(min) ?? [];
      let match: any = null;
      if (cands.length === 1) match = cands[0];
      else if (cands.length > 1) {
        match = cands.find((m: any) => m.home && m.away &&
          norm(MAP[m.home]) === norm(h.team.displayName) &&
          norm(MAP[m.away]) === norm(a.team.displayName)) ?? null;
      }
      if (!match) { unresolved++; continue; }
      // Idempotent : on n'écrit que si le score OU le statut a changé.
      if (match.actual_home === hs && match.actual_away === as && match.status === st) continue;
      const r = await fetch(`${URL_}/rest/v1/matches?id=eq.${match.id}`, {
        method: "PATCH",
        headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ actual_home: hs, actual_away: as, status: st }),
      });
      if (r.ok) { updates++; log.push(`${match.id} ${hs}-${as} ${st}`); }
    }
  }
  return new Response(JSON.stringify({ ok: true, updates, unresolved, log }), { headers: { "Content-Type": "application/json" } });
});
