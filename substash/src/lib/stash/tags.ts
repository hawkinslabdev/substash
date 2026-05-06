import { stashRequest } from "./client";
import { FIND_TAGS } from "./queries";
import type { FindTagsQuery } from "./types";

let tagCache: Map<string, string> | null = null;
let tagLookup: Map<string, string> | null = null; // lowercase -> id

async function ensureTagCache(): Promise<Map<string, string>> {
  if (tagCache) return tagCache;

  const data = await stashRequest<FindTagsQuery>(FIND_TAGS, {
    filter: { page: 1, per_page: 5000, sort: "name" },
  });

  tagCache = new Map(data.findTags.tags.map((t) => [t.name, t.id]));
  tagLookup = new Map(
    data.findTags.tags.map((t) => [t.name.toLowerCase(), t.id]),
  );
  return tagCache;
}

export async function resolveTagNamesToIds(names: string[]): Promise<string[]> {
  const cache = await ensureTagCache();
  return names
    .map((n) => {
      const id = tagLookup!.get(n.toLowerCase());
      if (!id) console.warn(`[tags] Tag not found: ${n}`);
      return id;
    })
    .filter((id): id is string => !!id);
}
