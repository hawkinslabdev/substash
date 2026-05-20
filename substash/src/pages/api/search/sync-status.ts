import type { APIRoute } from "astro";
import { getSyncState, isIndexEmpty } from "@/lib/search/sync";

export const GET: APIRoute = async () => {
  const state = getSyncState();
  return new Response(
    JSON.stringify({
      inProgress: state.inProgress,
      totalIndexed: state.totalIndexed,
      lastSyncedAt: state.lastSyncedAt?.getTime() ?? null,
      isEmpty: isIndexEmpty(),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
