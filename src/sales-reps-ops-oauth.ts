/**
 * ERP POST …/WaterwayAPI/connect — password + refresh_token.
 * Store only the long-lived API user password as a secret; do not store the ~1h access_token in Cloudflare.
 */

const CONNECT_URL =
  "https://wwoperations.waterwayplastics.com/WaterwayAPI/connect";
const DEFAULT_USERNAME = "waterway_api";
const EXPIRY_SKEW_SEC = 90;

type ConnectResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

type TokenMemory = {
  accessToken: string;
  refreshToken: string;
  refreshBeforeMs: number;
};

let memory: TokenMemory | null = null;
let inflight: Promise<string | null> | null = null;

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

function readPasswordGrant(env: Env): { username: string; password: string } | null {
  const password = trim(
    (env as Env & { SALES_REPS_OAUTH_PASSWORD?: string }).SALES_REPS_OAUTH_PASSWORD,
  );
  if (!password) return null;
  const username = trim(
    (env as Env & { SALES_REPS_OAUTH_USERNAME?: string }).SALES_REPS_OAUTH_USERNAME,
  );
  return { username: username || DEFAULT_USERNAME, password };
}

function parseConnectJson(text: string): ConnectResponse | null {
  try {
    const j = JSON.parse(text) as ConnectResponse;
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

async function postConnect(
  body: URLSearchParams,
): Promise<{ ok: boolean; json: ConnectResponse | null }> {
  const res = await fetch(CONNECT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  return { ok: res.ok, json: parseConnectJson(text) };
}

function applySuccess(json: ConnectResponse): void {
  const access = trim(json.access_token);
  if (!access) {
    memory = null;
    return;
  }
  const expiresIn =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? Math.max(60, Math.floor(json.expires_in))
      : 3600;
  const refreshTok = trim(json.refresh_token);
  memory = {
    accessToken: access,
    refreshToken: refreshTok || memory?.refreshToken || "",
    refreshBeforeMs: Date.now() + (expiresIn - EXPIRY_SKEW_SEC) * 1000,
  };
}

export function invalidateSalesRepsOpsOAuth(): void {
  memory = null;
}

export async function getSalesRepsOAuthBearer(env: Env): Promise<string | null> {
  const creds = readPasswordGrant(env);
  if (!creds) return null;

  if (memory && Date.now() < memory.refreshBeforeMs) {
    return memory.accessToken;
  }

  if (inflight) return inflight;

  inflight = (async (): Promise<string | null> => {
    try {
      const refreshTok = memory?.refreshToken;
      if (refreshTok) {
        const body = new URLSearchParams();
        body.set("grant_type", "refresh_token");
        body.set("refresh_token", refreshTok);
        const refreshed = await postConnect(body);
        if (
          refreshed.ok &&
          refreshed.json?.access_token &&
          trim(refreshed.json.access_token)
        ) {
          applySuccess(refreshed.json);
          return memory?.accessToken ?? null;
        }
        memory = null;
      }

      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", creds.username);
      body.set("password", creds.password);
      const first = await postConnect(body);
      if (
        !first.ok ||
        !first.json?.access_token ||
        !trim(first.json.access_token)
      ) {
        memory = null;
        return null;
      }
      applySuccess(first.json);
      return memory?.accessToken ?? null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
