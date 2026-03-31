export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook/rebuild") {
      return handleWebhook(request, env);
    }

    return handleFrontend(request, env);
  },
};

type PurgeCacheResponse = {
  success: boolean;
  errors?: Array<{ message?: string }>;
};

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = request.headers.get("X-Waterway-Webhook-Secret");

  if (secret !== env.WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await purgeCache(env);
    return new Response("Cache cleared");
  } catch (e) {
    console.error("Purge failed:", e);
    return new Response("Purge failed", { status: 500 });
  }
}

async function purgeCache(env: Env): Promise<PurgeCacheResponse> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        purge_everything: true,
      }),
    },
  );

  const data = (await res.json()) as PurgeCacheResponse;

  console.log("Purge response:", data);

  if (!res.ok || !data.success) {
    const message = data.errors?.[0]?.message ?? "Purge failed";
    throw new Error(message);
  }

  return data;
}

async function handleFrontend(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(request);
}
