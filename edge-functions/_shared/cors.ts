/**
 * Strict browser CORS helper for Jodi Supabase Edge Functions.
 *
 * Set APP_ALLOWED_ORIGINS to a comma-separated list of exact HTTPS origins in
 * production, for example `https://jodi.ctonew.app`. The function intentionally
 * never emits a wildcard origin. Native clients do not send an Origin header and
 * are authenticated by their Supabase JWT instead.
 */
const DEFAULT_HEADERS = "authorization, x-client-info, apikey, content-type";

function configuredOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

export function isAllowedBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return configuredOrigins().has(origin.replace(/\/$/, ""));
}

export function corsHeaders(
  request: Request,
  methods: string,
): Record<string, string> {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": DEFAULT_HEADERS,
    "Access-Control-Allow-Methods": methods,
    Vary: "Origin",
  };

  if (origin && isAllowedBrowserOrigin(request)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function jsonResponse(
  request: Request,
  methods: string,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request, methods),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
