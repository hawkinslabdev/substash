import { STASH_TAGS_EXCLUDED, STASH_TAGS_INCLUDED } from "astro:env/server";

export type TaggedItem = {
  tags?: { name: string }[];
};

// Debug: log at module load
console.log("[filter] Module loaded, env check:", {
  STASH_TAGS_EXCLUDED,
  STASH_TAGS_INCLUDED,
});

function getEnvFilters() {
  const excludedNames = (STASH_TAGS_EXCLUDED ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const includedNames = (STASH_TAGS_INCLUDED ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  console.log("[filter] getEnvFilters:", { excludedNames, includedNames });

  return { excludedNames, includedNames };
}

export function filterByTags<T extends TaggedItem>(items: T[]): T[] {
  const { excludedNames, includedNames } = getEnvFilters();

  console.log(
    "[filter] Before:",
    items.length,
    "excluded:",
    excludedNames,
    "included:",
    includedNames,
  );

  if (excludedNames.length === 0 && includedNames.length === 0) return items;

  const filtered = items.filter((item) => {
    const tagNames = (item.tags ?? []).map((t) => t.name.toLowerCase());

    // Remove items with ANY excluded tag
    if (excludedNames.length > 0) {
      const hasExcluded = excludedNames.some((name) => tagNames.includes(name));
      if (hasExcluded) {
        console.log("[filter] Excluded item:", {
          id: (item as { id?: string }).id,
          tags: tagNames,
        });
        return false;
      }
    }

    // Keep only items with ALL included tags
    if (includedNames.length > 0) {
      const hasAll = includedNames.every((name) => tagNames.includes(name));
      if (!hasAll) return false;
    }

    return true;
  });

  console.log(
    "[filter] After:",
    filtered.length,
    "removed:",
    items.length - filtered.length,
  );

  return filtered;
}

export function filterTagList<T extends { name: string }>(tags: T[]): T[] {
  const { excludedNames } = getEnvFilters();

  if (excludedNames.length === 0) return tags;

  return tags.filter((tag) => {
    return !excludedNames.includes(tag.name.toLowerCase());
  });
}
