export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/webhook/rebuild") {
      return handleWebhook(request, env)
    }

    return handleFrontend(request, env)
  },
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("X-Waterway-Webhook-Secret")

  if (secret !== env.WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 })
  }

  await triggerUpdate(env)

  return new Response("OK")
}

async function handleFrontend(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(request)
}

async function triggerUpdate(env: Env): Promise<void> {
  void env
}
