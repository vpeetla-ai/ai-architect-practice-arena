/**
 * A minimal, stateless pass-through for OpenAI's chat completions endpoint.
 *
 * Live browser testing (see docs/adr/0001) confirmed OpenAI's API does not
 * support direct browser-to-API calls the way Anthropic's does -- the
 * request fails with a generic CORS-blocked network error rather than a
 * readable HTTP response. This route exists ONLY to work around that
 * browser restriction, not to add any server-side logic:
 *
 * - The caller's API key arrives in the Authorization header on every
 *   request and is forwarded to OpenAI as-is.
 * - Nothing is logged, cached, or persisted -- this function holds no
 *   state between requests and never writes the key (or the request body)
 *   anywhere.
 * - If OpenAI ever adds proper browser CORS support, this route can be
 *   deleted and the frontend adapter pointed back at api.openai.com
 *   directly with no other code changes (see openaiAdapter.ts's
 *   OPENAI_API_BASE).
 */
export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing Authorization header" }), { status: 401 });
  }

  const body = await request.text();

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body,
  });

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
