import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  isAllowedBrowserOrigin,
  jsonResponse,
} from "../_shared/cors.ts";

const METHODS = "GET, OPTIONS";
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 10;
const TOKEN_SKEW_MS = 60_000;

type CachedToken = { value: string; expiresAt: number };
type SpotifyTrack = {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
  external_urls?: { spotify?: string };
};
type SpotifySearchResponse = { tracks?: { items?: SpotifyTrack[] } };

let cachedToken: CachedToken | null = null;

async function getSpotifyAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_SKEW_MS) {
    return cachedToken.value;
  }

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Music catalog is not configured");
  }

  const basicCredentials = btoa(`${clientId}:${clientSecret}`);
  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicCredentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    console.error("Spotify token request failed", tokenResponse.status);
    throw new Error("Music provider is temporarily unavailable");
  }

  const token = await tokenResponse.json();
  if (
    typeof token.access_token !== "string" ||
    typeof token.expires_in !== "number"
  ) {
    throw new Error("Music provider returned an invalid token response");
  }

  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  return cachedToken.value;
}

function normalizeQuery(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > MAX_QUERY_LENGTH) {
    return null;
  }
  return normalized;
}

serve(async (request) => {
  if (!isAllowedBrowserOrigin(request)) {
    return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: corsHeaders(request, METHODS),
    });
  }

  if (request.method !== "GET") {
    return jsonResponse(request, METHODS, { error: "Method not allowed" }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(request, METHODS, { error: "Unauthorized" }, 401);
  }

  // Verify the caller again even when the Supabase function JWT gateway is on.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(request, METHODS, { error: "Unauthorized" }, 401);
  }

  const query = normalizeQuery(new URL(request.url).searchParams.get("q"));
  if (!query) {
    return jsonResponse(
      request,
      METHODS,
      { error: `q must be between 2 and ${MAX_QUERY_LENGTH} characters` },
      400,
    );
  }

  const { data: withinRateLimit, error: rateLimitError } = await supabase
    .rpc("consume_music_catalog_request");
  if (rateLimitError) {
    console.error(
      "music-catalog rate limit check failed",
      rateLimitError.message,
    );
    return jsonResponse(request, METHODS, {
      error: "Music search is temporarily unavailable",
    }, 503);
  }
  if (!withinRateLimit) {
    return jsonResponse(request, METHODS, {
      error: "Too many music searches; please try again shortly",
    }, 429);
  }

  try {
    const token = await getSpotifyAppToken();
    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "track");
    searchUrl.searchParams.set("limit", String(MAX_RESULTS));

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!searchResponse.ok) {
      console.error("Spotify catalog search failed", searchResponse.status);
      return jsonResponse(request, METHODS, {
        error: "Music provider is temporarily unavailable",
      }, 503);
    }

    const payload = await searchResponse.json() as SpotifySearchResponse;
    const tracks = (payload.tracks?.items ?? []).flatMap((track) => {
      if (!track.id || !track.name) return [];
      return [{
        provider: "spotify",
        provider_track_id: track.id,
        track_name: track.name,
        artist_name: track.artists
          ?.map((artist) => artist.name)
          .filter((name): name is string => Boolean(name))
          .join(", ") ?? "",
        album_image_url: track.album?.images?.[0]?.url ?? null,
        external_url: track.external_urls?.spotify ?? null,
      }];
    });

    return jsonResponse(request, METHODS, { tracks });
  } catch (error) {
    console.error("music-catalog error", error);
    return jsonResponse(request, METHODS, {
      error: "Music provider is temporarily unavailable",
    }, 503);
  }
});
