// Généré par 'npm run build:worker' — ne pas éditer à la main (source : worker/standalone.ts + shared/api.ts).

// shared/validate.ts
var SCHEMES = [
  "monochrome",
  "analogous",
  "complementary",
  "split-complementary",
  "triadic",
  "tetradic"
];
var HEX_RE = /^#[0-9a-f]{6}$/;
var MAX_BODY_BYTES = 4096;
function isFinite01(x, min, max) {
  return typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
}
function validatePalette(input, now) {
  if (typeof input !== "object" || input === null) return null;
  const o = input;
  if (typeof o.baseColor !== "string" || !HEX_RE.test(o.baseColor)) return null;
  const opts = o.options;
  if (typeof opts !== "object" || opts === null) return null;
  const op = opts;
  if (typeof op.scheme !== "string" || !SCHEMES.includes(op.scheme)) return null;
  if (op.wheel !== "ryb" && op.wheel !== "rgb") return null;
  if (!isFinite01(op.intensity, 0.5, 1.2)) return null;
  if (!isFinite01(op.neutralInfluence, 0, 1)) return null;
  if (!isFinite01(op.hueTorsion, -30, 30)) return null;
  return {
    version: 1,
    baseColor: o.baseColor,
    options: {
      scheme: op.scheme,
      wheel: op.wheel,
      intensity: op.intensity,
      neutralInfluence: op.neutralInfluence,
      hueTorsion: op.hueTorsion
    },
    created: now.toISOString()
  };
}
function generateId(randomBytes) {
  let id = "";
  for (const b of randomBytes) id += (b % 36).toString(36);
  return id;
}

// shared/api.ts
var JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
function apiError(status, message) {
  return json({ error: message }, status);
}
var ID_RE = /^[0-9a-z]{16}$/;
function healthResponse() {
  return json({ ok: true, service: "nuancier" });
}
async function savePalette(request, store) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return apiError(415, "Corps JSON attendu.");
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return apiError(413, "Recette trop volumineuse.");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return apiError(400, "JSON illisible.");
  }
  const palette = validatePalette(parsed, /* @__PURE__ */ new Date());
  if (!palette) {
    return apiError(422, "Recette de palette invalide.");
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = generateId(bytes);
  await store.put(`palette:${id}`, JSON.stringify(palette));
  return json({ id }, 201);
}
async function readPalette(id, store) {
  if (!ID_RE.test(id)) return apiError(400, "Identifiant invalide.");
  const stored = await store.get(`palette:${id}`, "text");
  if (stored === null) return apiError(404, "Palette introuvable.");
  return new Response(stored, { headers: JSON_HEADERS });
}

// worker/standalone.ts
var CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400"
};
function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
var standalone_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/")) {
      return withCors(
        new Response(
          "API Nuancier \u2014 le front est servi s\xE9par\xE9ment (Cloudflare Pages). Essayez /api/health.",
          { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }
        )
      );
    }
    if (!env.NUANCIER_KV) {
      return withCors(apiError(503, "Stockage non configur\xE9 (binding KV NUANCIER_KV absent)."));
    }
    if (pathname === "/api/health" && request.method === "GET") {
      return withCors(healthResponse());
    }
    if (pathname === "/api/palettes" && request.method === "POST") {
      return withCors(await savePalette(request, env.NUANCIER_KV));
    }
    const match = pathname.match(/^\/api\/palettes\/([0-9a-z]+)$/);
    if (match && request.method === "GET") {
      return withCors(await readPalette(match[1], env.NUANCIER_KV));
    }
    return withCors(apiError(404, "Route inconnue."));
  }
};
export {
  standalone_default as default
};
