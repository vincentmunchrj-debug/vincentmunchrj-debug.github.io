// Fonction serveur Supabase — robot de scores 24/7.
// Source : ESPN (diffuseurs). Idempotent (n'écrit que ce qui change).
// Déclenchée toutes les minutes par pg_cron.
//
// Trois rôles :
//  1) SCORES — écrit le score des matchs en cours / terminés (poules + élimination).
//  2) BRACKET — remplit home/away des matchs à élimination DÈS qu'ESPN connaît
//     les deux équipes (même avant le jour du match), sans jamais écraser.
//  3) ÉLIMINATION — sur un match KO terminé : qualifié (winner) + score des t.a.b.

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
const toYmd = (i: string) => new Date(i).toISOString().slice(0, 10).replace(/-/g, "");
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

// Index inversé : nom normalisé (côté ESPN) -> notre code d'équipe.
const INV = new Map<string, string>();
for (const [code, name] of Object.entries(MAP)) INV.set(norm(name), code);
// Résout un competitor ESPN vers notre code (null si inconnu / "TBD" / slot non déterminé).
function espnCode(comp: any): string | null {
  const dn = comp?.team?.displayName;
  if (!dn) return null;
  return INV.get(norm(dn)) ?? null;
}

Deno.serve(async () => {
  const db = await (await fetch(
    `${URL_}/rest/v1/matches?select=id,phase,kickoff,home,away,actual_home,actual_away,status,winner,pso_home,pso_away`,
    { headers: H },
  )).json();

  const byMin = new Map<string, any[]>();
  for (const m of db) { const k = toMin(m.kickoff); if (!byMin.has(k)) byMin.set(k, []); byMin.get(k)!.push(m); }

  // Jours à interroger : hier + aujourd'hui (scores) ∪ jours des KO encore vides (bracket à venir).
  const now = new Date();
  const days = new Set<string>();
  for (let off = 1; off >= 0; off--) { const d = new Date(now); d.setUTCDate(d.getUTCDate() - off); days.add(d.toISOString().slice(0, 10).replace(/-/g, "")); }
  for (const m of db) { if (m.phase !== "groups" && (!m.home || !m.away)) days.add(toYmd(m.kickoff)); }

  let updates = 0, unresolved = 0, bracket = 0;
  const log: string[] = [];

  for (const ymd of days) {
    let j: any;
    try { j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${ymd}`)).json(); }
    catch (_e) { continue; }

    for (const e of j.events ?? []) {
      const state = e.status?.type?.state; // 'pre' | 'in' | 'post'
      if (!state) continue;
      const c = e.competitions[0];
      const h = c.competitors.find((x: any) => x.homeAway === "home");
      const a = c.competitors.find((x: any) => x.homeAway === "away");
      if (!h || !a) continue;

      // Identification du match en base : par minute de coup d'envoi.
      const min = toMin(e.date);
      const cands = byMin.get(min) ?? [];
      let match: any = null;
      if (cands.length === 1) match = cands[0];
      else if (cands.length > 1) {
        // Plusieurs matchs à la même minute (poules) : on désambiguïse par les équipes.
        match = cands.find((m: any) => m.home && m.away &&
          norm(MAP[m.home]) === norm(h.team.displayName) &&
          norm(MAP[m.away]) === norm(a.team.displayName)) ?? null;
      }
      if (!match) { unresolved++; continue; }

      const patch: Record<string, unknown> = {};

      // 2) BRACKET : remplir home/away d'un KO vide dès qu'ESPN connaît les 2 équipes.
      //    On n'écrase jamais une équipe déjà posée.
      if (match.phase !== "groups") {
        const hc = espnCode(h), ac = espnCode(a);
        if (hc && ac && hc !== ac) {
          if (!match.home) patch.home = hc;
          if (!match.away) patch.away = ac;
        }
      }

      // 1) SCORE : uniquement si le match a démarré (on ne touche à rien en 'pre').
      if (state !== "pre") {
        const hs = Number(h.score), as = Number(a.score);
        if (Number.isFinite(hs) && Number.isFinite(as)) {
          const st = state === "post" ? "final" : "live";
          if (match.actual_home !== hs) patch.actual_home = hs;
          if (match.actual_away !== as) patch.actual_away = as;
          if (match.status !== st) patch.status = st;

          // 3) ÉLIMINATION terminée : qualifié + score des t.a.b. (si l'API les fournit).
          if (match.phase !== "groups" && st === "final") {
            const winnerComp = h.winner === true ? h : a.winner === true ? a : null;
            const wc = winnerComp ? espnCode(winnerComp) : null;
            if (wc && match.winner !== wc) patch.winner = wc;
            const ph = Number(h.shootoutScore), pa = Number(a.shootoutScore);
            if (Number.isFinite(ph) && Number.isFinite(pa)) {
              if (match.pso_home !== ph) patch.pso_home = ph;
              if (match.pso_away !== pa) patch.pso_away = pa;
            }
          }
        }
      }

      if (Object.keys(patch).length === 0) continue; // rien n'a changé -> idempotent

      const r = await fetch(`${URL_}/rest/v1/matches?id=eq.${match.id}`, {
        method: "PATCH",
        headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (r.ok) {
        updates++;
        if (patch.home || patch.away) bracket++;
        log.push(`${match.id} ${JSON.stringify(patch)}`);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, updates, bracket, unresolved, log }), {
    headers: { "Content-Type": "application/json" },
  });
});
