import {
  GraphQLClient,
  type RequestDocument,
  type Variables,
} from "graphql-request";
import { STASH_URL, STASH_API_KEY } from "astro:env/server";
import http from "http";
import https from "https";

const TIMEOUT_MS = 5000;

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

export async function stashRequest<T>(
  query: RequestDocument,
  variables?: Variables,
): Promise<T> {
  try {
    return await client.request<T>(query, variables);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new StashConnectionError(
        `Stash request timed out after ${TIMEOUT_MS}ms`,
      );
    }
    // Surface the full error so it is visible in the server terminal
    if (err && typeof err === "object" && "response" in err) {
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
