import {
  GraphQLClient,
  type RequestDocument,
  type Variables,
} from "graphql-request";
import { STASH_URL, STASH_API_KEY, STASH_TIMEOUT_MS } from "astro:env/server";
import http from "http";
import https from "https";

// Configurable: dev-server warmup and busy Stash instances (scans) need more
// headroom than a fast LAN round-trip suggests.
const TIMEOUT_MS = STASH_TIMEOUT_MS;

const agent = new (STASH_URL.startsWith("https") ? https : http).Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
});

const headers: Record<string, string> = STASH_API_KEY
  ? { ApiKey: STASH_API_KEY }
  : {};

const client = new GraphQLClient(`${STASH_URL}/graphql`, {
  headers,
  fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    return fetch(url instanceof URL ? url.toString() : url, {
      ...options,
      // @ts-expect-error - Node.js fetch supports agent
      agent,
      signal: options.signal ?? controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  },
});

// Circuit breaker: when Stash is busy (scanning/generating) every request
// hangs for the full timeout and SSR pages block on it, freezing navigation
// (issue #5). After a couple of consecutive connection failures we fail fast
// instead, and only let a single probe request through per cooldown window.
const BREAKER_THRESHOLD = 2;
const BREAKER_COOLDOWN_MS = 15_000;
let consecutiveFailures = 0;
let lastFailureAt = 0;
let probeInFlight = false;

function breakerIsOpen(): boolean {
  return consecutiveFailures >= BREAKER_THRESHOLD;
}

function recordSuccess() {
  consecutiveFailures = 0;
  probeInFlight = false;
}

function recordConnectionFailure() {
  consecutiveFailures += 1;
  lastFailureAt = Date.now();
  probeInFlight = false;
}

export async function stashRequest<T>(
  query: RequestDocument,
  variables?: Variables,
): Promise<T> {
  if (breakerIsOpen()) {
    const cooledDown = Date.now() - lastFailureAt >= BREAKER_COOLDOWN_MS;
    if (!cooledDown || probeInFlight) {
      throw new StashConnectionError(
        "Stash is busy or unreachable — failing fast until it recovers",
      );
    }
    // One probe request per cooldown window checks whether Stash recovered
    probeInFlight = true;
  }

  try {
    const result = await client.request<T>(query, variables);
    recordSuccess();
    return result;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      recordConnectionFailure();
      throw new StashConnectionError(
        `Stash request timed out after ${TIMEOUT_MS}ms`,
      );
    }
    // Surface the full error so it is visible in the server terminal
    if (err && typeof err === "object" && "response" in err) {
      // Stash answered (GraphQL-level error) — the connection itself is fine
      recordSuccess();
      const gqlErr = err as {
        response?: { errors?: unknown; status?: number };
      };
      console.error(
        "[stashRequest] GraphQL error: status:",
        gqlErr.response?.status,
        "errors:",
        JSON.stringify(gqlErr.response?.errors, null, 2),
        "variables:",
        JSON.stringify(variables, null, 2),
      );
    } else {
      recordConnectionFailure();
      console.error("[stashRequest] Network/unknown error:", err);
    }
    const cause = err instanceof Error ? err.message : String(err);
    throw new StashConnectionError(
      `Could not reach Stash at ${STASH_URL}: ${cause}`,
    );
  }
}

export class StashConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StashConnectionError";
  }
}
