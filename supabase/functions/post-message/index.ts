// Edge Function — post-message
// Traduit le message (DeepL) puis l'insère dans messages (service role).
// Protège les @mentions pendant la traduction.
// Accepte text (optionnel si image_url fournie) + image_url (optionnel).
// Déployer avec : --no-verify-jwt

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEEPL = Deno.env.get("DEEPL_KEY") ?? "";
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

function protectMentions(text: string): [string, string[]] {
  const map: string[] = [];
  const out = text.replace(/@[\p{L}\d_]+/gu, (m) => { const i = map.length; map.push(m); return `__M${i}__`; });
  return [out, map];
}
function restoreMentions(text: string, map: string[]): string {
  return text.replace(/__M(\d+)__/g, (_, i) => map[+i] ?? _);
}
async function translate(text: string, src: string, tgt: string): Promise<string> {
  const [prot, map] = protectMentions(text);
  const r = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${DEEPL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [prot], source_lang: src.toUpperCase(), target_lang: tgt === "pt" ? "PT-BR" : "FR" }),
  });
  if (!r.ok) throw new Error(`DeepL ${r.status}`);
  const j = await r.json();
  return restoreMentions(j.translations?.[0]?.text ?? prot, map);
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: {
    group_code?: string; player_id?: string; name?: string;
    text?: string | null; lang_orig?: string; image_url?: string | null;
  };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors }); }

  const { group_code, player_id, name, text, lang_orig, image_url } = body;

  // Champs toujours requis
  if (!group_code || !player_id || !name || !lang_orig) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: cors });
  }
  if (!["fr", "pt"].includes(lang_orig)) {
    return new Response(JSON.stringify({ error: "Invalid lang_orig" }), { status: 400, headers: cors });
  }

  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasImage = typeof image_url === "string" && image_url.startsWith(URL_ + "/storage/v1/object/public/chat-photos/");

  if (!hasText && !hasImage) {
    return new Response(JSON.stringify({ error: "text or image_url required" }), { status: 400, headers: cors });
  }
  if (hasText && text!.length > 500) {
    return new Response(JSON.stringify({ error: "Message too long (max 500)" }), { status: 400, headers: cors });
  }

  let text_fr: string | null = null;
  let text_pt: string | null = null;
  if (hasText) {
    try {
      if (lang_orig === "fr") {
        text_fr = text!;
        text_pt = await translate(text!, "FR", "pt");
      } else {
        text_pt = text!;
        text_fr = await translate(text!, "PT", "fr");
      }
    } catch (e) {
      console.error("DeepL error (fallback to original):", e);
      text_fr = text!; text_pt = text!;
    }
  }

  const res = await fetch(`${URL_}/rest/v1/messages`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({
      group_code, player_id, name,
      text_orig: hasText ? text : null,
      lang_orig,
      text_fr,
      text_pt,
      image_url: hasImage ? image_url : null,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("DB insert error:", err);
    return new Response(JSON.stringify({ error: "DB error", detail: err }), { status: 500, headers: cors });
  }

  const inserted = await res.json();
  return new Response(JSON.stringify({ ok: true, message: inserted[0] }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
